-- supabase/tests/03_isolation_core.sql
--
-- Test co lap doc/ghi cheo cho nam thuc the V1 con lai: departments, shifts,
-- employees, attendance_records, work_requests. Nhan rong dung khuon cua
-- 01_isolation_companies.sql: moi bang bay khang dinh rieng, ten bang xuat
-- hien nguyen van trong tung mo ta de output TAP tra loi duoc "bang nao" khi
-- do (yeu cau tieu chi nghiem thu so 2 cua phase).
--
-- Bay khang dinh moi bang:
--   1. user 0001 doc duoc >0 dong cty-01 cua chinh minh (ve chong test xanh
--      rong — khong co no thi khang dinh so 2 vo nghia)
--   2. user 0001 doc duoc 0 dong cty-02
--   3. user 0002 guong lai ca hai chieu tren trong MOT khang dinh gop
--      (doc duoc >0 dong cty-02 cua chinh minh VA 0 dong cty-01)
--   4. user 0001 insert mot dong hop le ve kieu nhung mang company_id =
--      'cty-02' bi tu choi voi SQLSTATE 42501
--   5. user 0001 update cot van ban tren cac dong cty-02 tac dong 0 dong
--   6. user 0001 delete cac dong cty-02 tac dong 0 dong
--   7. user 0004 (khong membership nao) doc duoc 0 dong
--
-- Cong them: hai khang dinh chung cho ca nhom tren employees (user 0003 —
-- thanh vien ca hai doanh nghiep — doc duoc dong cua CA HAI cong ty, khong
-- gop lam mot), va bon khang dinh ve cot nullable (mot moi bang co cot
-- nullable duoc nhac trong must_haves cua plan).

begin;

select plan(41);

/* ============================================================================
   departments — 7 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from departments where company_id = 'cty-01') > 0,
  'departments: user 0001 doc duoc >0 dong cty-01 cua chinh minh'
);

select is(
  (select count(*) from departments where company_id = 'cty-02')::int,
  0,
  'departments: user 0001 doc duoc 0 dong cty-02'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000002'::uuid);

select ok(
  (select count(*) from departments where company_id = 'cty-02') > 0
    and (select count(*) from departments where company_id = 'cty-01') = 0,
  'departments: user 0002 (guong lai user 0001) doc duoc >0 dong cty-02 cua chinh minh va 0 dong cty-01'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select throws_ok(
  $ins_dept$insert into departments (id, company_id, name, description, status)
    values ('fake-dept-42501', 'cty-02', 'Fake Dept', 'fake', 'active')$ins_dept$,
  '42501',
  'new row violates row-level security policy for table "departments"',
  'departments: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

with updated as (
  update departments set name = name where company_id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from updated),
  0,
  'departments: user 0001 update dong cty-02 tac dong 0 dong'
);

with deleted as (
  delete from departments where company_id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from deleted),
  0,
  'departments: user 0001 delete dong cty-02 tac dong 0 dong'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*) from departments)::int,
  0,
  'departments: user 0004 (khong membership) doc duoc 0 dong'
);

select tf_test_logout();

/* ============================================================================
   shifts — 7 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from shifts where company_id = 'cty-01') > 0,
  'shifts: user 0001 doc duoc >0 dong cty-01 cua chinh minh'
);

select is(
  (select count(*) from shifts where company_id = 'cty-02')::int,
  0,
  'shifts: user 0001 doc duoc 0 dong cty-02'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000002'::uuid);

select ok(
  (select count(*) from shifts where company_id = 'cty-02') > 0
    and (select count(*) from shifts where company_id = 'cty-01') = 0,
  'shifts: user 0002 (guong lai user 0001) doc duoc >0 dong cty-02 cua chinh minh va 0 dong cty-01'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select throws_ok(
  $ins_shift$insert into shifts (id, company_id, name, code, start_time, end_time, working_days)
    values ('fake-shift-42501', 'cty-02', 'Fake Shift', 'FK1', '08:00', '09:00', array[1]::smallint[])$ins_shift$,
  '42501',
  'new row violates row-level security policy for table "shifts"',
  'shifts: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

with updated as (
  update shifts set name = name where company_id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from updated),
  0,
  'shifts: user 0001 update dong cty-02 tac dong 0 dong'
);

with deleted as (
  delete from shifts where company_id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from deleted),
  0,
  'shifts: user 0001 delete dong cty-02 tac dong 0 dong'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*) from shifts)::int,
  0,
  'shifts: user 0004 (khong membership) doc duoc 0 dong'
);

select tf_test_logout();

/* ============================================================================
   employees — 7 khang dinh + 2 khang dinh chung cho thanh vien kep
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from employees where company_id = 'cty-01') > 0,
  'employees: user 0001 doc duoc >0 dong cty-01 cua chinh minh'
);

select is(
  (select count(*) from employees where company_id = 'cty-02')::int,
  0,
  'employees: user 0001 doc duoc 0 dong cty-02'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000002'::uuid);

select ok(
  (select count(*) from employees where company_id = 'cty-02') > 0
    and (select count(*) from employees where company_id = 'cty-01') = 0,
  'employees: user 0002 (guong lai user 0001) doc duoc >0 dong cty-02 cua chinh minh va 0 dong cty-01'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select throws_ok(
  $ins_emp$insert into employees (
    id, company_id, code, full_name, email, phone, date_of_birth, gender,
    department_id, position, contract_type, start_date, shift_id,
    work_location, status, system_role
  ) values (
    'fake-emp-42501', 'cty-02', 'FAKE01', 'Fake Employee', 'fake@x.test', '000',
    '1990-01-01', 'other', 'dept-02', 'Fake', 'full_time', '2020-01-01',
    'sft-02-day', 'Xuong', 'active', 'employee'
  )$ins_emp$,
  '42501',
  'new row violates row-level security policy for table "employees"',
  'employees: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

with updated as (
  update employees set full_name = full_name where company_id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from updated),
  0,
  'employees: user 0001 update dong cty-02 tac dong 0 dong'
);

with deleted as (
  delete from employees where company_id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from deleted),
  0,
  'employees: user 0001 delete dong cty-02 tac dong 0 dong'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*) from employees)::int,
  0,
  'employees: user 0004 (khong membership) doc duoc 0 dong'
);

select tf_test_logout();

-- Hai khang dinh chung cho ca nhom: user 0003 (thanh vien ca hai doanh
-- nghiep) doc duoc dong cua CA HAI cong ty tren employees — policy danh gia
-- tung dong doc lap, khong gop hai doanh nghiep lam mot.
select tf_test_login('00000000-0000-0000-0000-000000000003'::uuid);

select ok(
  (select count(*) from employees where company_id = 'cty-01') > 0,
  'employees: user 0003 (thanh vien kep) doc duoc >0 dong cty-01'
);

select ok(
  (select count(*) from employees where company_id = 'cty-02') > 0,
  'employees: user 0003 (thanh vien kep) doc duoc >0 dong cty-02'
);

select tf_test_logout();

/* ============================================================================
   attendance_records — 7 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from attendance_records where company_id = 'cty-01') > 0,
  'attendance_records: user 0001 doc duoc >0 dong cty-01 cua chinh minh'
);

select is(
  (select count(*) from attendance_records where company_id = 'cty-02')::int,
  0,
  'attendance_records: user 0001 doc duoc 0 dong cty-02'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000002'::uuid);

select ok(
  (select count(*) from attendance_records where company_id = 'cty-02') > 0
    and (select count(*) from attendance_records where company_id = 'cty-01') = 0,
  'attendance_records: user 0002 (guong lai user 0001) doc duoc >0 dong cty-02 cua chinh minh va 0 dong cty-01'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select throws_ok(
  $ins_att$insert into attendance_records (
    id, company_id, employee_id, work_date, shift_id, status, location
  ) values (
    'fake-att-42501', 'cty-02', 'nv-02a', '2026-07-28', 'sft-02-day', 'on_time', 'Xuong'
  )$ins_att$,
  '42501',
  'new row violates row-level security policy for table "attendance_records"',
  'attendance_records: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

with updated as (
  update attendance_records set location = location where company_id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from updated),
  0,
  'attendance_records: user 0001 update dong cty-02 tac dong 0 dong'
);

with deleted as (
  delete from attendance_records where company_id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from deleted),
  0,
  'attendance_records: user 0001 delete dong cty-02 tac dong 0 dong'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*) from attendance_records)::int,
  0,
  'attendance_records: user 0004 (khong membership) doc duoc 0 dong'
);

select tf_test_logout();

/* ============================================================================
   work_requests — 7 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from work_requests where company_id = 'cty-01') > 0,
  'work_requests: user 0001 doc duoc >0 dong cty-01 cua chinh minh'
);

select is(
  (select count(*) from work_requests where company_id = 'cty-02')::int,
  0,
  'work_requests: user 0001 doc duoc 0 dong cty-02'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000002'::uuid);

select ok(
  (select count(*) from work_requests where company_id = 'cty-02') > 0
    and (select count(*) from work_requests where company_id = 'cty-01') = 0,
  'work_requests: user 0002 (guong lai user 0001) doc duoc >0 dong cty-02 cua chinh minh va 0 dong cty-01'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select throws_ok(
  $ins_wr$insert into work_requests (
    id, company_id, employee_id, type, from_date, to_date, reason
  ) values (
    'fake-wr-42501', 'cty-02', 'nv-02a', 'leave', '2026-08-01', '2026-08-01', 'fake reason'
  )$ins_wr$,
  '42501',
  'new row violates row-level security policy for table "work_requests"',
  'work_requests: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

with updated as (
  update work_requests set reason = reason where company_id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from updated),
  0,
  'work_requests: user 0001 update dong cty-02 tac dong 0 dong'
);

with deleted as (
  delete from work_requests where company_id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from deleted),
  0,
  'work_requests: user 0001 delete dong cty-02 tac dong 0 dong'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*) from work_requests)::int,
  0,
  'work_requests: user 0004 (khong membership) doc duoc 0 dong'
);

select tf_test_logout();

/* ============================================================================
   Cot nullable — bon khang dinh, mot moi bang co cot nullable, dung tu cach
   cua user 0001 (thanh vien cty-01). Toan bo file nay nam trong mot
   transaction se rollback o cuoi nen khong lam ban seed.
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select lives_ok(
  $null_dept$insert into departments (id, company_id, name, description, manager_id, status)
    values ('dept-nullable-check', 'cty-01', 'Phong kiem tra null', 'test', null, 'active')$null_dept$,
  'departments: chen dong voi manager_id NULL thanh cong'
);

select lives_ok(
  $null_emp$insert into employees (
    id, company_id, code, full_name, email, phone, date_of_birth, gender,
    department_id, position, contract_type, start_date, manager_id, shift_id,
    work_location, status, system_role
  ) values (
    'nv-nullable-check', 'cty-01', 'NPNULL', 'Nhan vien kiem tra null',
    'null.check@ngocphat.test', '000', '1990-01-01', 'other', 'dept-01', 'Test',
    'full_time', '2020-01-01', null, 'sft-01-day', 'Van phong', 'active', 'employee'
  )$null_emp$,
  'employees: chen dong voi manager_id NULL thanh cong'
);

-- Ngay dung mot bieu thuc tuong doi (moc neo + 5, tuong lai) thay vi hang so
-- tuyet doi: tu plan 01-06, seed.sql sinh lich su ~30 ngay gan day cho MOI
-- nhan vien (D-06/D-07), nen bat ky ngay qua khu co dinh nao gan "hom nay"
-- deu co the trung voi mot dong da duoc seed cho nv-01a/sft-01-day va vo
-- unique(employee_id, work_date, shift_id). Ngay tuong lai khong bao gio
-- nam trong pham vi lich su do.
select lives_ok(
  $null_att$insert into attendance_records (
    id, company_id, employee_id, work_date, shift_id, check_in_at, check_out_at,
    status, location
  ) values (
    'att-nullable-check', 'cty-01', 'nv-01a', (public.tf_work_date(now()) + 5), 'sft-01-day',
    ((public.tf_work_date(now()) + 5)::timestamp + time '08:00') at time zone public.tf_tz(),
    null, 'missing_checkout', 'Van phong'
  )$null_att$,
  'attendance_records: chen dong voi check_out_at NULL thanh cong'
);

select lives_ok(
  $null_wr$insert into work_requests (
    id, company_id, employee_id, type, from_date, to_date, from_time, to_time, reason
  ) values (
    'wr-nullable-check', 'cty-01', 'nv-01a', 'leave', '2026-08-10', '2026-08-10',
    null, null, 'test null from_time/to_time'
  )$null_wr$,
  'work_requests: chen dong voi from_time va to_time NULL thanh cong'
);

select tf_test_logout();

select * from finish(true);

rollback;
