-- supabase/tests/18_payroll_runs.sql
--
-- Ban chot luong (migration 0024, plan 05-2-05).
--
-- BON KHANG DINH QUAN TRONG NHAT la bon khang dinh DOI NHAU: `UPDATE` bi chan
-- tren ca ba bang, nhung `DELETE` thi CHAY DUOC. Chi kiem mot chieu se de lot
-- ca hai loai hong nguoc nhau — mot ban chot sua duoc (mat kha nang tra loi
-- "thang 7 da tra bao nhieu"), va mot ban chot khong huy duoc (day nguoi dung
-- sang sua tay o database).

begin;

select plan(11);

/* ============================================================================
   Du lieu doi chieu: mot ban chot cua cty-01 voi mot dong va mot khoan.
   Chay o vai tro mac dinh (chu bang, bo qua RLS) — day la buoc dung fixture.
   ========================================================================= */

insert into payroll_runs (
  id, company_id, period_start, work_mode,
  standard_hours_per_day, standard_days_per_month
) values (
  '22222222-2222-2222-2222-222222222222',
  'cty-01', '2016-01-01', 'shift', 8, 26
);

insert into payroll_lines (
  id, company_id, run_id, employee_id,
  employee_code, employee_name, department_name,
  pay_unit, pay_amount,
  credited_days, regular_minutes, hour_delta_minutes,
  converted_overtime_hours, late_count,
  worked_days, total_minutes, leave_days,
  overtime_minutes, overtime_night_minutes,
  base_pay, overtime_pay, hour_adjustment,
  allowance_total, deduction_total, net_pay
) values (
  '33333333-3333-3333-3333-333333333333',
  'cty-01', '22222222-2222-2222-2222-222222222222', 'nv-01a',
  'NV001', 'Nguyễn Minh Anh', 'Phòng Kinh doanh',
  'month', 13000000,
  22, 10560, 0, 6, 2,
  22, 10800, 1, 240, 0,
  11000000, 750000, 0, 730000, 100000, 12380000
);

insert into payroll_line_items (
  company_id, line_id, adjustment_id, kind, name, amount, multiplier
) values (
  'cty-01', '33333333-3333-3333-3333-333333333333', null,
  'allowance', 'Phụ cấp ăn trưa', 730000, 1
);

/* ============================================================================
   UPDATE bi chan tren CA BA bang — 3 khang dinh
   ========================================================================= */

select throws_ok(
  $u1$update payroll_runs set work_mode = 'daily_hours'
     where id = '22222222-2222-2222-2222-222222222222'$u1$,
  '23001',
  null,
  'payroll_runs: UPDATE bi trigger tu choi (ban chot bat bien, D-42)'
);

select throws_ok(
  $u2$update payroll_lines set net_pay = 1
     where id = '33333333-3333-3333-3333-333333333333'$u2$,
  '23001',
  null,
  'payroll_lines: UPDATE bi trigger tu choi — khong sua le duoc mot dong'
);

select throws_ok(
  $u3$update payroll_line_items set amount = 1
     where line_id = '33333333-3333-3333-3333-333333333333'$u3$,
  '23001',
  null,
  'payroll_line_items: UPDATE bi trigger tu choi'
);

/* ============================================================================
   Chot hai lan bi chan — 1 khang dinh
   ========================================================================= */

select throws_ok(
  $dup$insert into payroll_runs (company_id, period_start, work_mode)
     values ('cty-01', '2016-01-01', 'shift')$dup$,
  '23505',
  null,
  'payroll_runs: mot ky mot ban chot — chot lan hai bi unique chan o DATABASE'
);

/* ============================================================================
   Co lap cheo doanh nghiep — 2 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from payroll_runs where company_id = 'cty-01') > 0
    and (select count(*) from payroll_runs where company_id = 'cty-02') = 0,
  'payroll_runs: user 0001 doc duoc >0 dong cty-01 va 0 dong cty-02'
);

select throws_ok(
  $ins_pr$insert into payroll_runs (company_id, period_start, work_mode)
     values ('cty-02', '2016-03-01', 'shift')$ins_pr$,
  '42501',
  'new row violates row-level security policy for table "payroll_runs"',
  'payroll_runs: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select tf_test_logout();

/* ============================================================================
   DELETE DUOC PHEP, va keo theo ca cay — 4 khang dinh

   Day la chieu NGUOC LAI cua ba khang dinh dau file, va no quan trong ngang
   chung: mot ban chot khong huy duoc se day nguoi dung sang sua tay o
   database khi ho phat hien mot sai sot TRUOC KHI tra tien (D-45).
   ========================================================================= */

select is(
  (select count(*)::int from payroll_line_items
    where line_id = '33333333-3333-3333-3333-333333333333'),
  1,
  'payroll_line_items: khoan cua dong da duoc ghi'
);

select lives_ok(
  $del$delete from payroll_runs
     where id = '22222222-2222-2222-2222-222222222222'$del$,
  'payroll_runs: DELETE DUOC PHEP — huy ca ban chot la duong lui hop le (D-45)'
);

select is(
  (select count(*)::int from payroll_lines
    where run_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'payroll_lines: xoa ban chot keo theo cac dong (on delete cascade)'
);

select is(
  (select count(*)::int from payroll_line_items
    where line_id = '33333333-3333-3333-3333-333333333333'),
  0,
  'payroll_line_items: xoa ban chot keo theo ca cac khoan cua tung dong'
);

select * from finish(true);

rollback;
