-- supabase/tests/19_payslip_rls.sql
--
-- RLS cua ban chot luong sau khi siet (migration 0029, PAY-05).
--
-- ======================================================================
-- VI SAO FILE NAY TON TAI
-- ======================================================================
--
-- 0024 dat `select` tren ba bang luong voi dieu kien duy nhat
-- `tf_is_member(company_id)` — moi thanh vien doc duoc moi dong luong. Cho toi
-- truoc PAY-05 dieu do chua khai thac duoc vi khong Route Handler nao mo ba
-- bang do cho vai tro ngoai `owner`/`admin`. PAY-05 tao ra duong doc do.
--
-- KHANG DINH DOI NHAU la cot loi cua file nay: chi kiem "nhan vien khong thay
-- dong cua nguoi khac" se de lot mot bo policy siet qua tay lam CHINH nhan
-- vien do khong thay dong cua minh, va lam man hinh bang luong cua quan tri
-- trong rong. Vi vay moi ve deu duoc kiem ca hai chieu.

begin;

select plan(9);

/* ============================================================================
   Fixture. Chay o vai tro mac dinh (chu bang, bo qua RLS) — day la buoc dung
   du lieu, khong phai buoc kiem tra.

   Bo fixture cua `00_fixture_users.sql` khong co mot nguoi nao vai tro
   `employee`: 0001/0002 la `owner`, 0003 la `admin` kep, 0004 khong co
   membership. Ma dieu can kiem o day CHINH LA vai tro do — nen file nay tu
   dung lay hai nhan vien thuong cua cty-01.
   ========================================================================= */

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'payslip-a@timeflow.test'),
  ('00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'payslip-b@timeflow.test')
on conflict (id) do nothing;

insert into memberships (user_id, company_id, role, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'cty-01', 'employee', 'active'),
  ('00000000-0000-0000-0000-0000000000a2', 'cty-01', 'employee', 'active')
on conflict (user_id, company_id) do nothing;

insert into employees (
  id, company_id, code, full_name, email, start_date,
  status, system_role, work_location, user_id
) values
  ('nv-pay-a', 'cty-01', 'NVPA', 'Nhân viên A', 'payslip-a@timeflow.test',
   '2020-01-01', 'active', 'employee', 'office',
   '00000000-0000-0000-0000-0000000000a1'),
  ('nv-pay-b', 'cty-01', 'NVPB', 'Nhân viên B', 'payslip-b@timeflow.test',
   '2020-01-01', 'active', 'employee', 'office',
   '00000000-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;

insert into payroll_runs (
  id, company_id, period_start, work_mode,
  standard_hours_per_day, standard_days_per_month
) values (
  '44444444-4444-4444-4444-444444444444',
  'cty-01', '2016-02-01', 'shift', 8, 26
);

-- Hai dong cua CUNG mot ban chot: mot cua A, mot cua B. Do la hinh dang duy
-- nhat kiem duoc "A thay dong cua minh nhung khong thay dong cua B" — hai ban
-- chot rieng se lan sang chuyen khac (loc theo `run_id`).
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
) values
  ('55555555-5555-5555-5555-555555555555',
   'cty-01', '44444444-4444-4444-4444-444444444444', 'nv-pay-a',
   'NVPA', 'Nhân viên A', null, 'month', 10000000,
   22, 10560, 0, 0, 0, 22, 10560, 0, 0, 0,
   10000000, 0, 0, 0, 0, 10000000),
  ('66666666-6666-6666-6666-666666666666',
   'cty-01', '44444444-4444-4444-4444-444444444444', 'nv-pay-b',
   'NVPB', 'Nhân viên B', null, 'month', 20000000,
   22, 10560, 0, 0, 0, 22, 10560, 0, 0, 0,
   20000000, 0, 0, 0, 0, 20000000);

insert into payroll_line_items (
  company_id, line_id, adjustment_id, kind, name, amount, multiplier
) values
  ('cty-01', '55555555-5555-5555-5555-555555555555', null,
   'allowance', 'Phụ cấp của A', 500000, 1),
  ('cty-01', '66666666-6666-6666-6666-666666666666', null,
   'allowance', 'Phụ cấp của B', 900000, 1);

/* ============================================================================
   1-3. NHAN VIEN A — thay dong cua minh, KHONG thay dong cua B
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-0000000000a1');

select is(
  (select count(*)::int from payroll_lines
    where run_id = '44444444-4444-4444-4444-444444444444'),
  1,
  'payroll_lines: nhan vien doc dung MOT dong cua ban chot — dong cua chinh minh'
);

select is(
  (select employee_id from payroll_lines
    where run_id = '44444444-4444-4444-4444-444444444444'),
  'nv-pay-a',
  'payroll_lines: dong doc duoc dung la dong cua chinh minh, khong phai cua B'
);

select is(
  (select count(*)::int from payroll_line_items
    where line_id = '66666666-6666-6666-6666-666666666666'),
  0,
  'payroll_line_items: khong doc duoc khoan thuoc dong luong cua nguoi khac'
);

/* ============================================================================
   4-5. NHAN VIEN A — doc duoc ban chot (de biet ngay chot), va doc duoc khoan
        CUA CHINH MINH. Hai khang dinh nay giu cho viec siet khong qua tay.
   ========================================================================= */

select is(
  (select count(*)::int from payroll_runs
    where id = '44444444-4444-4444-4444-444444444444'),
  1,
  'payroll_runs: nhan vien doc duoc ban chot vi co dong luong cua minh trong do'
);

select is(
  (select count(*)::int from payroll_line_items
    where line_id = '55555555-5555-5555-5555-555555555555'),
  1,
  'payroll_line_items: doc duoc khoan cua chinh dong luong cua minh'
);

select tf_test_logout();

/* ============================================================================
   6-7. NHAN VIEN B — doi xung. Neu chi kiem mot nguoi thi mot policy viet
        nham thanh "chi nv-pay-a duoc doc" van xanh.
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-0000000000a2');

select is(
  (select count(*)::int from payroll_lines
    where run_id = '44444444-4444-4444-4444-444444444444'),
  1,
  'payroll_lines: nhan vien B cung chi doc duoc dung mot dong'
);

select is(
  (select employee_id from payroll_lines
    where run_id = '44444444-4444-4444-4444-444444444444'),
  'nv-pay-b',
  'payroll_lines: va dong do la cua B — dieu kien theo nguoi goi, khong co dinh'
);

select tf_test_logout();

/* ============================================================================
   8-9. QUAN TRI — van thay CA HAI dong. Day la ve doi lai cua khang dinh 1:
        siet qua tay se lam man hinh bang luong cua quan tri trong rong.
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001');

select is(
  (select count(*)::int from payroll_lines
    where run_id = '44444444-4444-4444-4444-444444444444'),
  2,
  'payroll_lines: owner van doc duoc MOI dong cua doanh nghiep minh'
);

select is(
  (select count(*)::int from payroll_line_items
    where line_id in (
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666'
    )),
  2,
  'payroll_line_items: owner van doc duoc moi khoan cua moi dong'
);

select tf_test_logout();

select * from finish(true);

rollback;
