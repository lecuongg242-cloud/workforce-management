-- supabase/tests/16_employee_pay_rates.sql
--
-- Muc luong append-only va phep tra muc luong hieu luc tai mot ngay
-- (migration 0022, plan 05-2-01).
--
-- Hai khang dinh `throws_ok` cho UPDATE/DELETE la QUAN TRONG NHAT file nay:
-- chung la thu duy nhat chung minh D-37a co rang o tang database chu khong
-- chi la mot thoa thuan trong ma ung dung. Hau qua neu no khong co rang la
-- TIEN DA TRA cho nguoi lao dong tinh lai ra mot con so khac.
--
-- Ba khang dinh cuoi kiem MAC DINH CUA COT chu khong kiem hanh vi: hai mau so
-- quy doi phai KHONG co `column_default` (D-38 + D-26), con `work_mode` thi
-- PHAI co mac dinh `shift` (doanh nghiep dang chay giu nguyen hanh vi). Ba
-- khang dinh do la cach duy nhat de "quen dat DEFAULT" va "co tinh dat
-- DEFAULT" khong the bi lan voi nhau ve sau.

begin;

select plan(12);

/* ============================================================================
   Du lieu doi chieu: hai phien ban muc luong cua cung mot nhan vien cty-01.
   Chay o vai tro mac dinh (chu bang, bo qua RLS) — day la buoc dung fixture;
   phan kiem RLS nam o hai khang dinh co lap cuoi file.
   ========================================================================= */

insert into employee_pay_rates (company_id, employee_id, unit, amount, effective_from) values
  ('cty-01', 'nv-01a', 'month', 10000000, '2020-01-01'),
  ('cty-01', 'nv-01a', 'month', 12000000, '2026-06-01');

/* ============================================================================
   Append-only — 3 khang dinh
   ========================================================================= */

select throws_ok(
  $upd$update employee_pay_rates set amount = 1
     where company_id = 'cty-01' and employee_id = 'nv-01a'$upd$,
  '23001',
  null,
  'employee_pay_rates: UPDATE bi trigger tu choi (append-only, D-37a)'
);

select throws_ok(
  $del$delete from employee_pay_rates
     where company_id = 'cty-01' and employee_id = 'nv-01a'$del$,
  '23001',
  null,
  'employee_pay_rates: DELETE bi trigger tu choi (append-only, D-37a)'
);

select lives_ok(
  $ins$insert into employee_pay_rates (company_id, employee_id, unit, amount, effective_from)
    values ('cty-01', 'nv-02', 'hour', 45000, '2026-01-01')$ins$,
  'employee_pay_rates: INSERT van hoat dong binh thuong'
);

/* ============================================================================
   Muc luong DANG HIEU LUC tai mot ngay — 4 khang dinh
   ========================================================================= */

select is(
  (public.tf_pay_rate_at('nv-01a', '2026-08-06')).amount,
  12000000::numeric,
  'tf_pay_rate_at: ngay sau moc hieu luc moi -> muc luong moi'
);

select is(
  (public.tf_pay_rate_at('nv-01a', '2026-05-31')).amount,
  10000000::numeric,
  'tf_pay_rate_at: ngay TRUOC moc hieu luc moi -> van muc luong cu (khong viet lai lich su)'
);

select is(
  (public.tf_pay_rate_at('nv-01a', '2019-12-31')).amount,
  null,
  'tf_pay_rate_at: ngay truoc MOI phien ban -> NULL, khong lui ve dong gan nhat va khong bia ra 0 (D-26)'
);

select is(
  (public.tf_pay_rate_at('nv-02a', '2026-08-06')).amount,
  null,
  'tf_pay_rate_at: nhan vien chua khai luong lan nao -> NULL, khong bia muc luong'
);

/* ============================================================================
   Co lap cheo doanh nghiep — 2 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from employee_pay_rates where company_id = 'cty-01') > 0
    and (select count(*) from employee_pay_rates where company_id = 'cty-02') = 0,
  'employee_pay_rates: user 0001 doc duoc >0 dong cty-01 va 0 dong cty-02'
);

select throws_ok(
  $ins_pr$insert into employee_pay_rates (company_id, employee_id, unit, amount, effective_from)
    values ('cty-02', 'nv-02a', 'month', 9000000, '2026-01-01')$ins_pr$,
  '42501',
  'new row violates row-level security policy for table "employee_pay_rates"',
  'employee_pay_rates: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select tf_test_logout();

/* ============================================================================
   Mac dinh cua ba cot moi tren company_settings — 3 khang dinh

   `column_default` rong la KHANG DINH NGHIEP VU, khong phai chi tiet schema:
   mot mac dinh 8 gio hay 26 ngay se lam moi doanh nghiep chua khai gi bong
   nhien co mot mau so quy doi ma ho khong dat ra — va vi day la mau so cua
   phep quy doi luong thang -> don gia gio, no sai don gia gio cua MOI NGUOI.
   ========================================================================= */

select is(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'company_settings'
      and column_name = 'standard_hours_per_day'),
  null,
  'company_settings.standard_hours_per_day KHONG co mac dinh (D-38: de trong = chua khai)'
);

select is(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'company_settings'
      and column_name = 'standard_days_per_month'),
  null,
  'company_settings.standard_days_per_month KHONG co mac dinh (D-38: 22 hay 26 la chuyen cua tung doanh nghiep)'
);

select is(
  (select work_mode from company_settings where company_id = 'cty-01'),
  'shift',
  'company_settings.work_mode mac dinh shift — doanh nghiep dang chay giu nguyen hanh vi cu (D-36)'
);

select * from finish(true);

rollback;
