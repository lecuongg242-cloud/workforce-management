-- supabase/tests/05_seed_fixture.sql
--
-- Test do lai fixture cua seed.sql sau khi plan 01-06 port trong ven bo du
-- lieu V1: khang dinh do day du (tieu chi nghiem thu so 1 cua phase), tinh
-- truot theo ngay chay (D-07), va quy uoc ca dem (tieu chi nghiem thu so 5,
-- D-08) tren DU LIEU THAT thay vi chi tren ham thuan tuy nhu 02_time_overnight.sql.
-- Chay bang vai tro mac dinh cua ket noi (khong gia lap dang nhap qua
-- tf_test_login) vi day la test ve do day du cua fixture, khong phai ve co
-- lap RLS.

begin;

select plan(35);

/* ============================================================================
   Nhom 1 — do day du (tieu chi nghiem thu so 1): dem dung con so da chot o
   Task 1, va moi bang thuoc pham vi doanh nghiep (tru holidays, co y de
   rong) deu co it nhat mot dong cho CA HAI cong ty — neu khong, cac khang
   dinh "doc duoc 0 dong" trong bo test co lap se xanh rong (T-01-27).
   ========================================================================= */

select is((select count(*)::int from companies), 2,
  'companies: dung 2 dong (cty-01 Ngoc Phat + cty-02 Binh Minh)');

select is((select count(*)::int from departments), 9,
  'departments: dung 9 dong (5 cty-01 + 4 cty-02)');

select is((select count(*)::int from shifts), 7,
  'shifts: dung 7 dong (4 cty-01 + 3 cty-02)');

select is((select count(*)::int from employees), 40,
  'employees: dung 40 dong (28 cty-01 + 12 cty-02)');

select is((select count(*)::int from employees where company_id = 'cty-01'), 28,
  'employees: cty-01 dung 28 dong');

select is((select count(*)::int from employees where company_id = 'cty-02'), 12,
  'employees: cty-02 dung 12 dong');

select is((select count(*)::int from work_requests), 12,
  'work_requests: dung 12 dong (9 cty-01 + 3 cty-02)');

select is((select count(*)::int from work_requests where status = 'pending'), 8,
  'work_requests: dung 8 dong trang thai pending');

select ok(
  (select count(*) from memberships where company_id = 'cty-01') > 0
    and (select count(*) from memberships where company_id = 'cty-02') > 0,
  'memberships: co it nhat mot dong cho ca cty-01 va cty-02 (nguon du lieu la fixture cua bo test — 00_fixture_users.sql — khong con o seed.sql tu D-15)'
);

select ok(
  (select count(*) from departments where company_id = 'cty-01') > 0
    and (select count(*) from departments where company_id = 'cty-02') > 0,
  'departments: co it nhat mot dong cho ca cty-01 va cty-02'
);

select ok(
  (select count(*) from shifts where company_id = 'cty-01') > 0
    and (select count(*) from shifts where company_id = 'cty-02') > 0,
  'shifts: co it nhat mot dong cho ca cty-01 va cty-02'
);

select ok(
  (select count(*) from employees where company_id = 'cty-01') > 0
    and (select count(*) from employees where company_id = 'cty-02') > 0,
  'employees: co it nhat mot dong cho ca cty-01 va cty-02'
);

select ok(
  (select count(*) from attendance_records where company_id = 'cty-01') > 0
    and (select count(*) from attendance_records where company_id = 'cty-02') > 0,
  'attendance_records: co it nhat mot dong cho ca cty-01 va cty-02'
);

select ok(
  (select count(*) from work_requests where company_id = 'cty-01') > 0
    and (select count(*) from work_requests where company_id = 'cty-02') > 0,
  'work_requests: co it nhat mot dong cho ca cty-01 va cty-02'
);

select ok(
  (select count(*) from work_sites where company_id = 'cty-01') > 0
    and (select count(*) from work_sites where company_id = 'cty-02') > 0,
  'work_sites: co it nhat mot dong cho ca cty-01 va cty-02'
);

select ok(
  (select count(*) from attendance_photos where company_id = 'cty-01') > 0
    and (select count(*) from attendance_photos where company_id = 'cty-02') > 0,
  'attendance_photos: co it nhat mot dong cho ca cty-01 va cty-02'
);

select ok(
  (select count(*) from overtime_rules where company_id = 'cty-01') > 0
    and (select count(*) from overtime_rules where company_id = 'cty-02') > 0,
  'overtime_rules: co it nhat mot dong cho ca cty-01 va cty-02'
);

select ok(
  (select count(*) from audit_log where company_id = 'cty-01') > 0
    and (select count(*) from audit_log where company_id = 'cty-02') > 0,
  'audit_log: co it nhat mot dong cho ca cty-01 va cty-02'
);

select ok(
  (select count(*) from periods where company_id = 'cty-01') > 0
    and (select count(*) from periods where company_id = 'cty-02') > 0,
  'periods: co it nhat mot dong cho ca cty-01 va cty-02'
);

select is((select count(*)::int from holidays), 0,
  'holidays: rong o ca hai cong ty — trang thai hop le khi doanh nghiep moi khoi tao, khong phai thieu du lieu');

/* ============================================================================
   Nhom 2 — truot theo ngay chay (D-07)
   ========================================================================= */

select ok(
  abs(public.tf_work_date(now()) - (select max(work_date) from attendance_records)) <= 1,
  'attendance_records: max(work_date) cach public.tf_work_date(now()) khong qua 1 ngay — khong chot cung nhu REFERENCE_DATE cua V1'
);

select ok(
  (select count(distinct work_date) from attendance_records where work_date > public.tf_work_date(now()) - 35) >= 28,
  'attendance_records: phu it nhat 28 ngay cong (work_date) khac nhau trong 35 ngay gan nhat'
);

select is(
  (select count(*)::int from attendance_records where work_date > public.tf_work_date(now())),
  0,
  'attendance_records: khong ban ghi nao co work_date o tuong lai so voi public.tf_work_date(now())'
);

/* ============================================================================
   Nhom 3 — quy uoc ca dem (tieu chi nghiem thu so 5, D-08). Lap lai duoi
   session timezone khac (America/New_York) de khang dinh ket qua khong doi.
   ========================================================================= */

select is((select count(*)::int from shifts where company_id = 'cty-01' and overnight), 1,
  'shifts: cty-01 dung 1 ca overnight (vong 1 — tz mac dinh cua ket noi)');

select is((select count(*)::int from shifts where company_id = 'cty-02' and overnight), 1,
  'shifts: cty-02 dung 1 ca overnight (vong 1 — tz mac dinh cua ket noi)');

select is(
  (
    select count(*)::int
    from attendance_records a
    join shifts s on s.id = a.shift_id
    where s.overnight and a.check_in_at is not null and a.check_out_at is not null
      and a.work_date <> public.tf_work_date(a.check_in_at)
  ),
  0,
  'attendance_records: ban ghi ca overnight co work_date dung bang public.tf_work_date(check_in_at) (vong 1 — tz mac dinh cua ket noi)'
);

select is(
  (
    select count(*)::int
    from attendance_records a
    join shifts s on s.id = a.shift_id
    where s.overnight and a.check_in_at is not null and a.check_out_at is not null
      and a.check_out_at <= a.check_in_at
  ),
  0,
  'attendance_records: ban ghi ca overnight co check_out_at lon hon check_in_at (vong 1 — tz mac dinh cua ket noi)'
);

select is(
  (
    select count(*)::int
    from attendance_records a
    join shifts s on s.id = a.shift_id
    where s.overnight and a.check_in_at is not null and a.check_out_at is not null
      and a.worked_minutes <> public.tf_shift_minutes(s.start_time, s.end_time, s.break_minutes)
  ),
  0,
  'attendance_records: ban ghi ca overnight co worked_minutes dung bang public.tf_shift_minutes cua chinh ca do (vong 1 — tz mac dinh cua ket noi)'
);

set timezone to 'America/New_York';

select is((select count(*)::int from shifts where company_id = 'cty-01' and overnight), 1,
  'shifts: cty-01 dung 1 ca overnight (vong 2 — tz=America/New_York)');

select is((select count(*)::int from shifts where company_id = 'cty-02' and overnight), 1,
  'shifts: cty-02 dung 1 ca overnight (vong 2 — tz=America/New_York)');

select is(
  (
    select count(*)::int
    from attendance_records a
    join shifts s on s.id = a.shift_id
    where s.overnight and a.check_in_at is not null and a.check_out_at is not null
      and a.work_date <> public.tf_work_date(a.check_in_at)
  ),
  0,
  'attendance_records: ban ghi ca overnight co work_date dung bang public.tf_work_date(check_in_at) (vong 2 — tz=America/New_York)'
);

select is(
  (
    select count(*)::int
    from attendance_records a
    join shifts s on s.id = a.shift_id
    where s.overnight and a.check_in_at is not null and a.check_out_at is not null
      and a.check_out_at <= a.check_in_at
  ),
  0,
  'attendance_records: ban ghi ca overnight co check_out_at lon hon check_in_at (vong 2 — tz=America/New_York)'
);

select is(
  (
    select count(*)::int
    from attendance_records a
    join shifts s on s.id = a.shift_id
    where s.overnight and a.check_in_at is not null and a.check_out_at is not null
      and a.worked_minutes <> public.tf_shift_minutes(s.start_time, s.end_time, s.break_minutes)
  ),
  0,
  'attendance_records: ban ghi ca overnight co worked_minutes dung bang public.tf_shift_minutes cua chinh ca do (vong 2 — tz=America/New_York)'
);

reset timezone;

/* ============================================================================
   Nhom 4 — nhan hien thi tieng Viet khong lot vao database. Kieu enum da bao
   dam khang dinh dau, nhung ghi lai tuong minh de neu ai do doi employees.status
   sang cot text tu do se co canh bao ngay.
   ========================================================================= */

select is(
  (
    select count(*)::int
    from employees
    where status::text not in ('active', 'on_leave', 'terminated', 'pending_invite')
  ),
  0,
  'employees: khong dong nao co status ngoai tap gia tri enum employee_status (khang dinh y dinh, kieu enum da bao dam)'
);

select is(
  (select count(*)::int from attendance_records where location = ''),
  0,
  'attendance_records: khong dong nao co location la chuoi rong'
);

select * from finish(true);

rollback;
