-- supabase/tests/10_company_settings.sql
--
-- Bang cau hinh doanh nghiep (migration 0015, plan 04-01). Theo khuon rut gon
-- cua 04_isolation_v2.sql: doc cheo bi tu choi, ghi cheo bi tu choi. Them hai
-- khang dinh rieng cua bang nay ma cac bang khac khong co:
--   - bat bien "moi doanh nghiep dung MOT dong" (backfill cua 0015),
--   - gia tri mac dinh dung bang gia tri ma `src/lib/attendance/suspicious.ts`
--     dang dung, de doanh nghiep chua dong toi cau hinh khong bi doi hanh vi
--     khi D-29 chuyen nguong tu hang so sang cau hinh.

begin;

select plan(6);

/* ============================================================================
   Bat bien backfill — chay o vai tro mac dinh (chu bang, bo qua RLS) de nhin
   duoc CA HAI doanh nghiep trong mot cau truy van.
   ========================================================================= */

select is(
  (select count(*)::int from companies c
     left join company_settings s on s.company_id = c.id
    where s.company_id is null),
  0,
  'company_settings: moi doanh nghiep dang ton tai co dung mot dong cau hinh (backfill 0015)'
);

select results_eq(
  $def$select suspicious_distance_multiplier, shift_window_grace_minutes,
              night_start_time, night_end_time
       from company_settings where company_id = 'cty-01'$def$,
  $exp$values (5::numeric(5,2), 120, '22:00'::time, '06:00'::time)$exp$,
  'company_settings: mac dinh 5 lan ban kinh / 120 phut / 22:00-06:00 (D-27, D-29)'
);

/* ============================================================================
   Co lap doc — 2 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from company_settings where company_id = 'cty-01') = 1
    and (select count(*) from company_settings where company_id = 'cty-02') = 0,
  'company_settings: user 0001 doc duoc dong cua cty-01 va 0 dong cty-02'
);

/* ============================================================================
   Co lap ghi — chen cheo bi tu choi han; sua cheo khong nem loi nhung KHONG
   cham duoc dong nao (policy USING loc dong ra khoi tam nhin truoc khi UPDATE
   chay). Hai hinh dang tu choi khac nhau nen phai kiem bang hai cach khac
   nhau — mot `throws_ok` va mot phep dem dong bi tac dong.
   ========================================================================= */

select throws_ok(
  $ins_cs$insert into company_settings (company_id) values ('cty-02')$ins_cs$,
  '42501',
  'new row violates row-level security policy for table "company_settings"',
  'company_settings: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select is(
  (with updated as (
     update company_settings set shift_window_grace_minutes = 999
      where company_id = 'cty-02'
      returning 1
   )
   select count(*)::int from updated),
  0,
  'company_settings: user 0001 sua dong cua cty-02 khong cham duoc dong nao'
);

/* ============================================================================
   Rang buoc khung gio dem — hai moc bang nhau lam khung dem vo nghia
   ========================================================================= */

select throws_ok(
  $chk_night$update company_settings
     set night_start_time = '22:00', night_end_time = '22:00'
   where company_id = 'cty-01'$chk_night$,
  '23514',
  null,
  'company_settings: night_start_time bang night_end_time bi rang buoc CHECK tu choi'
);

select tf_test_logout();

select * from finish(true);

rollback;
