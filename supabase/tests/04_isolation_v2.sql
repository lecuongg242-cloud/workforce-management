-- supabase/tests/04_isolation_v2.sql
--
-- Test co lap doc/ghi cheo cho sau bang moi cua V2: work_sites,
-- attendance_photos, overtime_rules, audit_log, periods, holidays. Rut gon
-- so voi khuon bay-khang-dinh cua 03_isolation_core.sql (chi dinh toc do thi
-- hanh): moi bang thuong chi hai khang dinh — mot doc cheo bi tu choi, mot
-- ghi cheo bi tu choi voi SQLSTATE 42501 — vi co che RLS da duoc chung minh o
-- 01-01/01-04, khong lap lai controlled-sabotage o day. Ten bang xuat hien
-- nguyen van trong tung mo ta.

begin;

select plan(15);

/* ============================================================================
   Mot dong audit_log co company_id NULL, chen bang vai tro mac dinh cua ket
   noi (truoc bat ky lan gia lap dang nhap nao) — vai tro nay la chu bang nen
   bo qua RLS. Danh dau bang entity_table rieng de doi chieu sau khi dang
   nhap (T-01-23).
   ========================================================================= */

insert into audit_log (company_id, actor_user_id, action, entity_table, entity_id)
  values (null, null, 'insert', 'audit_log_null_company_marker', null);

/* ============================================================================
   work_sites — 2 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from work_sites where company_id = 'cty-01') > 0
    and (select count(*) from work_sites where company_id = 'cty-02') = 0,
  'work_sites: user 0001 doc duoc >0 dong cty-01 va 0 dong cty-02'
);

select throws_ok(
  $ins_ws$insert into work_sites (id, company_id, name, latitude, longitude, radius_meters)
    values ('fake-ws-42501', 'cty-02', 'Fake Site', 10.000000, 106.000000, 100)$ins_ws$,
  '42501',
  'new row violates row-level security policy for table "work_sites"',
  'work_sites: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select tf_test_logout();

/* ============================================================================
   attendance_photos — 2 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from attendance_photos where company_id = 'cty-01') > 0
    and (select count(*) from attendance_photos where company_id = 'cty-02') = 0,
  'attendance_photos: user 0001 doc duoc >0 dong cty-01 va 0 dong cty-02'
);

select throws_ok(
  $ins_ap$insert into attendance_photos (company_id, attendance_record_id, kind, storage_path, captured_at)
    values ('cty-02', 'att-02a', 'check_out', 'cty-02/x.jpg', now())$ins_ap$,
  '42501',
  'new row violates row-level security policy for table "attendance_photos"',
  'attendance_photos: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select tf_test_logout();

/* ============================================================================
   overtime_rules — 2 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from overtime_rules where company_id = 'cty-01') > 0
    and (select count(*) from overtime_rules where company_id = 'cty-02') = 0,
  'overtime_rules: user 0001 doc duoc >0 dong cty-01 va 0 dong cty-02'
);

select throws_ok(
  $ins_ot$insert into overtime_rules (company_id, rule_key, multiplier, effective_from)
    values ('cty-02', 'weekend', 1.50, '2026-01-01')$ins_ot$,
  '42501',
  'new row violates row-level security policy for table "overtime_rules"',
  'overtime_rules: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select tf_test_logout();

/* ============================================================================
   periods — 2 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from periods where company_id = 'cty-01') > 0
    and (select count(*) from periods where company_id = 'cty-02') = 0,
  'periods: user 0001 doc duoc >0 dong cty-01 va 0 dong cty-02'
);

select throws_ok(
  $ins_pe$insert into periods (company_id, start_date, end_date)
    values (
      'cty-02',
      (date_trunc('month', now() at time zone public.tf_tz()) + interval '1 month')::date,
      (date_trunc('month', now() at time zone public.tf_tz()) + interval '2 month - 1 day')::date
    )$ins_pe$,
  '42501',
  'new row violates row-level security policy for table "periods"',
  'periods: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select tf_test_logout();

/* ============================================================================
   audit_log — 2 khang dinh doc/ghi cheo + 2 khang dinh rieng cho dong
   company_id NULL (T-01-23: khong nguoi dung doanh nghiep nao duoc thay)
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from audit_log where company_id = 'cty-01') > 0
    and (select count(*) from audit_log where company_id = 'cty-02') = 0,
  'audit_log: user 0001 doc duoc >0 dong cty-01 va 0 dong cty-02'
);

select throws_ok(
  $ins_al$insert into audit_log (company_id, action, entity_table)
    values ('cty-02', 'insert', 'fake')$ins_al$,
  '42501',
  'new row violates row-level security policy for table "audit_log"',
  'audit_log: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select is(
  (select count(*) from audit_log where entity_table = 'audit_log_null_company_marker')::int,
  0,
  'audit_log: user 0001 khong thay dong company_id NULL (T-01-23)'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000002'::uuid);

select is(
  (select count(*) from audit_log where entity_table = 'audit_log_null_company_marker')::int,
  0,
  'audit_log: user 0002 khong thay dong company_id NULL (T-01-23)'
);

select tf_test_logout();

/* ============================================================================
   holidays — bang co y de rong o ca hai cong ty; khang dinh so 1 cua khuon
   chuan (doc duoc >0 dong cua chinh minh) khong ap dung duoc. Thay vao do:
   chen mot dong cho cty-01 trong chinh test nay de co du lieu doi chieu, roi
   moi khang dinh doc cheo va ghi cheo nhu cac bang khac.
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select lives_ok(
  $ins_hol$insert into holidays (company_id, holiday_date, name)
    values ('cty-01', '2026-09-02', 'Quốc khánh')$ins_hol$,
  'holidays: bang co y rong luc khoi tao — user 0001 chen dong cho cty-01 de co du lieu doi chieu thanh cong'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000002'::uuid);

select is(
  (select count(*) from holidays where company_id = 'cty-01')::int,
  0,
  'holidays: user 0002 doc duoc 0 dong cty-01 (dong vua duoc user 0001 chen o tren)'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select throws_ok(
  $ins_hol2$insert into holidays (company_id, holiday_date, name)
    values ('cty-02', '2026-09-03', 'Fake Holiday')$ins_hol2$,
  '42501',
  'new row violates row-level security policy for table "holidays"',
  'holidays: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select tf_test_logout();

select * from finish(true);

rollback;
