-- 0030_payroll_line_days.sql
--
-- CHI TIET THEO NGAY cua mot dong luong da chot (PAY-01).
--
-- ======================================================================
-- (1) VI SAO BAN CHOT PHAI TU CHUA CA CHI TIET NGAY
-- ======================================================================
--
-- Tu plan nay, tien cua mot ky la TONG CUA CAC NGAY chu khong con la mot phep
-- nhan tu so tong. Neu ban chot chi luu con so thang, thi mo lai mot ky da
-- chot se phai TINH LAI tung ngay tu du lieu cham cong cua HOM NAY — va khi
-- mot yeu cau duoc duyet ve sau lam doi so lieu cua ky (qua
-- `tf_apply_approved_request`), cac dong ngay se khong con cong lai ra dung
-- con so tien DA TRA.
--
-- Mot phieu tu mau thuan voi chinh no te hon ca mot phieu sai: nguoi doc thay
-- 22 dong cong lai ra mot so, va o tren cung mot so khac — va khong ai giai
-- thich duoc ben nao dung.
--
-- Vi vay bang nay chep lai TIEN cua tung ngay tai thoi diem chot, cung khuon
-- `payroll_lines` va `payroll_line_items` (0024 muc (1)).
--
-- ======================================================================
-- (2) NGAY NAO DUOC GHI
-- ======================================================================
--
-- Chi ngay CO IT NHAT MOT BAN GHI CHAM CONG — ke ca nghi co phep / khong phep
-- (chung la ban ghi trang thai, khong phai khoang trong). Ngay khong co ban
-- ghi nao thi khong sinh dong: bang nay khong phai mot cuon lich.
--
-- He qua CO Y: mot ngay nghi khong phep CO dong voi moi cot bang 0. Do la mot
-- su that ("hom do nghi va khong duoc tra gi"), khac han voi khong co dong
-- ("hom do khong phai ngay lam viec").
--
-- Ngay DANG DO (da cham vao chua cham ra) khong den duoc day: ky luong chi
-- chot duoc sau khi ky cong da chot. Neu van con thi `closePayroll` bo qua no
-- thay vi ghi mot dong `null` vao mot bang khai `not null`.
--
-- (3) `not null` tren cac cot tien la mot BAT BIEN, khong phai tien nghi: mot
-- ky chi chot duoc khi khong dong nao thieu du kien (xem `closePayroll`).
--
-- (4) FILE NAY CHAY LAI DUOC MA VO HAI — khuon 0018/0021/0024.

drop table if exists payroll_line_days;

create table payroll_line_days (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  -- `on delete cascade` di qua HAI tang: huy chot luong xoa `payroll_runs`,
  -- keo theo `payroll_lines`, keo theo bang nay.
  line_id uuid not null references payroll_lines (id) on delete cascade,

  work_date date not null,
  day_type text not null check (day_type in ('weekday', 'weekend', 'holiday')),

  -- SO LIEU CONG cua ngay, chep lai.
  credited_days numeric(8, 4) not null,
  regular_minutes int not null,
  overtime_minutes int not null,
  converted_overtime_hours numeric(8, 2) not null,
  hour_delta_minutes int not null,

  -- TIEN cua ngay. `day_total` = base_pay + overtime_pay + hour_adjustment;
  -- ca ba DA LAM TRON o muc ngay, va khong duoc lam tron lai o bat ky dau.
  base_pay numeric(14, 2) not null,
  overtime_pay numeric(14, 2) not null,
  hour_adjustment numeric(14, 2) not null,
  day_total numeric(14, 2) not null,

  unique (line_id, work_date)
);

comment on table payroll_line_days is
  'Chi tiet theo ngay cua mot dong luong da chot. Tong day_total cua mot dong '
  'bang DUNG (base_pay + overtime_pay + hour_adjustment) cua payroll_lines — '
  'xem khoi comment migration 0030.';

create index payroll_line_days_company_id_idx on payroll_line_days (company_id);
create index payroll_line_days_line_id_idx on payroll_line_days (line_id);

/* -------------------------------------------------------------------------- */
/* Bat bien: khong sua duoc tung dong (khuon 0024)                             */
/* -------------------------------------------------------------------------- */

create trigger payroll_line_days_immutable
  before update on payroll_line_days
  for each row
  execute function public.tf_payroll_immutable();

/* -------------------------------------------------------------------------- */
/* RLS — quan tri ca cong ty, con lai chi dong cua chinh minh                   */
/* -------------------------------------------------------------------------- */

alter table payroll_line_days enable row level security;

-- Bang nay KHONG co `employee_id`. Dieu kien di qua `line_id` — CHEP DUNG
-- khuon `payroll_line_items_select_scoped` cua 0029, vi hai bang o cung mot
-- the: deu treo duoi `payroll_lines` va deu khong tu biet chu cua minh. Hai
-- bang cung the ma dien dat khac nhau la cho de mot lo hong lot qua ma khong
-- ai doi chieu duoc.
create policy payroll_line_days_select_scoped on payroll_line_days
  for select using (
    public.tf_is_company_admin(company_id)
    or exists (
      select 1
      from payroll_lines line
      where line.id = payroll_line_days.line_id
        and public.tf_owns_payroll_line(line.employee_id)
    )
  );

-- Ghi/xoa giu `tf_is_member` — cung ba ly do voi 0029 muc (3): duong ghi duy
-- nhat o tang ung dung da goi `requireRole(role, ['owner','admin'])`, va
-- `update` da bi trigger chan hoan toan.
create policy payroll_line_days_insert_member on payroll_line_days
  for insert with check (public.tf_is_member(company_id));
create policy payroll_line_days_update_member on payroll_line_days
  for update using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));
create policy payroll_line_days_delete_member on payroll_line_days
  for delete using (public.tf_is_member(company_id));
