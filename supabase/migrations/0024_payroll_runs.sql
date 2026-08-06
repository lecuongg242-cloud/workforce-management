-- 0024_payroll_runs.sql
--
-- BAN CHOT LUONG cua mot ky (PAY-01/D-42, plan 05-2-05). Ba bang, tu chua:
--   payroll_runs       — mot ky da chot luong, kem CACH TINH da ap
--   payroll_lines      — mot dong moi nhan vien, kem ANH CHUP danh tinh + luong
--   payroll_line_items — tung khoan cong/tru cua mot dong, CHEP LAI ten va tien
--
-- ======================================================================
-- (1) VI SAO BAN CHOT TU CHUA — NGOAI LE CO CHU DICH THU HAI CUA DU AN
-- ======================================================================
--
-- Moi thu khac trong TimeFlow TINH LUC TRUY VAN (D-21, SET-04), va do la lua
-- chon DUNG cho so lieu cong: no cho phep sua quy tac ma khong phai ghi de
-- lich su, va mot ngay cong duoc phan loai lai theo quy tac dung la mot dieu
-- tot.
--
-- Tien luong thi nguoc lai. Mot khi da tra cho nguoi lao dong, con so do la
-- MOT SU KIEN DA XAY RA — khong phai mot phep tinh co the ra ket qua khac vao
-- thang sau. Neu bang luong thang 07 duoc tinh lai tu cau hinh cua thang 09,
-- thi cau hoi "thang 07 da tra bao nhieu va vi sao" khong con cau tra loi.
--
-- Vi vay ban chot chep lai TAT CA dau vao, khong tham chieu song toi cai gi:
--   - `work_mode` + hai mau so  -> cach tinh cong co the doi
--   - `pay_unit` + `pay_amount` -> muc luong co the co phien ban moi
--   - `employee_code`/`_name`   -> nguoi co the doi ten hoac nghi viec
--   - `payroll_line_items.name` -> khoan co the bi tat hoac doi ten
--
-- Khoa ngoai toi `employees` van co (de doi chieu), nhung KHONG MOT CON SO NAO
-- cua ban chot phu thuoc vao viec doc lai bang do.
--
-- ======================================================================
-- (2) `UPDATE` BI CHAN NHUNG `DELETE` THI KHONG — VA DO KHONG MAU THUAN
-- ======================================================================
--
-- 0017 (`request_reviews`) dat khuon nguoc lai: chan `UPDATE`, cung chan
-- `DELETE`. O day chi chan `UPDATE`. Hai bang trong giong nhau ve hinh dang
-- nhung khac nhau ve BAN CHAT cua thu chung ghi lai:
--
--   - Mot dong `request_reviews` la mot HANH DONG DA DIEN RA (ai da duyet cai
--     gi). Xoa no la xoa mot su that ve qua khu.
--   - Mot ban chot luong la mot BAN TUYEN BO ve so tien SE tra. Truoc khi tien
--     ra khoi tai khoan, phat hien mot sai sot (khai nham muc luong, quen mot
--     khoan phu cap) la chuyen THUONG. Khong co duong lui se day nguoi dung
--     sang sua tay o database — va do la ket cuc te hon nhieu.
--
-- Vi vay D-45: HUY duoc CA BAN CHOT, khong sua duoc TUNG DONG. Sua le mot dong
-- la mo duong cho mot con so khong ai giai thich duoc; huy ca ban roi chot lai
-- thi moi con so deu duoc tinh lai cung mot luc, va co mot dong `audit_log`
-- mang LY DO BAT BUOC.
--
-- GIOI HAN GHI RO: he thong KHONG BIET tien da tra hay chua, nen no khong chan
-- duoc viec huy mot ky da tra. Ban chot bi xoa van de lai vet o `audit_log`.
--
-- (3) KHONG CO COT TRANG THAI o `payroll_runs`. Dong TON TAI nghia la DA CHOT
-- LUONG; khong co ban nhap. Mot cot trang thai se tao ra mot trang thai thu ba
-- ("dang chot") ma khong ai biet doc the nao, va mot ban nhap thi khong khac gi
-- phep tinh luc truy van da co san.
--
-- (4) FILE NAY CHAY LAI DUOC MA VO HAI — khuon 0018/0021/0022/0023.

drop table if exists payroll_line_items;
drop table if exists payroll_lines;
drop table if exists payroll_runs;
drop function if exists public.tf_payroll_immutable();

/* -------------------------------------------------------------------------- */
/* (a) payroll_runs — mot ky da chot luong                                     */
/* -------------------------------------------------------------------------- */

create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,

  -- Khop `periods.start_date` (D-09: ky cong la tron mot thang duong lich).
  -- KHONG dat khoa ngoai toi `periods`: ban chot phai song duoc ke ca khi ai
  -- do xoa dong ky — no la mot ban ghi tai chinh doc lap.
  period_start date not null,

  -- CACH TINH DA AP, chep lai (xem muc (1)). Hai mau so `null` duoc: mot
  -- doanh nghiep tra luong ngay/gio khong can chung, va ban chot phai ghi lai
  -- DUNG nhung gi da duoc dung — ke ca "khong dung mau so nao".
  work_mode text not null
    check (work_mode in ('daily_hours', 'shift', 'shift_hourly')),
  standard_hours_per_day numeric(5, 2) null,
  standard_days_per_month numeric(5, 2) null,

  closed_at timestamptz not null default now(),
  closed_by uuid null references auth.users (id) on delete set null,

  -- Mot ky mot ban chot. Chot lan hai bi chan o day, khong chi o tang ung dung.
  unique (company_id, period_start),

  check (period_start = date_trunc('month', period_start)::date)
);

comment on table payroll_runs is
  'D-42: ban chot luong cua mot ky. Dong TON TAI nghia la da chot — khong co '
  'cot trang thai, khong co ban nhap. Xem khoi comment cua migration 0024.';

/* -------------------------------------------------------------------------- */
/* (b) payroll_lines — mot dong moi nhan vien                                  */
/* -------------------------------------------------------------------------- */

create table payroll_lines (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  run_id uuid not null references payroll_runs (id) on delete cascade,

  -- Khoa ngoai de doi chieu, nhung KHONG con so nao phu thuoc vao no.
  employee_id text not null references employees (id) on delete cascade,

  -- ANH CHUP danh tinh: nguoi co the doi ten, doi phong ban, hoac nghi viec
  -- sau khi chot. Ban chot phai doc duoc sau nhieu nam ma khong can join.
  employee_code text not null,
  employee_name text not null,
  department_name text null,

  -- MUC LUONG DA AP, chep lai.
  pay_unit text not null check (pay_unit in ('month', 'day', 'hour')),
  pay_amount numeric(14, 2) not null check (pay_amount > 0),

  -- SO LIEU CONG da dung de ra con so tien. Chep lai vi cung ly do: mot yeu
  -- cau duoc duyet ve sau co the doi so lieu cua ky (qua
  -- `tf_apply_approved_request`), va khi ay ban chot van phai giai thich duoc
  -- con so DA TRA.
  credited_days numeric(8, 4) not null,
  regular_minutes int not null,
  hour_delta_minutes int not null,
  converted_overtime_hours numeric(8, 2) not null,
  late_count int not null,

  -- SO LIEU CONG CHI DE HIEN THI — khong tham gia vao phep tinh tien, nhung
  -- van duoc chep lai. Ly do: mo mot ky da chot phai cho ra DUNG cai bang ma
  -- nguoi chot da nhin thay, khong phai mot ban rut gon chi con cot tien. Neu
  -- may cot nay duoc suy lai luc doc, chung se doi theo du lieu cham cong cua
  -- hom nay trong khi cac cot tien thi khong — va mot bang tu mau thuan voi
  -- chinh no la thu te hon ca mot bang sai.
  worked_days int not null,
  total_minutes int not null,
  leave_days int not null,
  overtime_minutes int not null,
  overtime_night_minutes int not null,

  -- CAC CON SO TIEN. `not null` o day la mot BAT BIEN, khong phai mot tien
  -- nghi: mot ky chi chot duoc khi KHONG dong nao thieu du kien (xem
  -- `closePayroll`), nen mot dong `null` trong ban chot la khong the xay ra.
  base_pay numeric(14, 2) not null,
  overtime_pay numeric(14, 2) not null,
  hour_adjustment numeric(14, 2) not null,
  allowance_total numeric(14, 2) not null,
  deduction_total numeric(14, 2) not null,
  net_pay numeric(14, 2) not null,

  unique (run_id, employee_id)
);

comment on table payroll_lines is
  'Mot dong luong da chot. Moi truong danh tinh va muc luong deu la ANH CHUP — '
  'khong con so nao cua ban chot phu thuoc vao viec doc lai employees hay '
  'employee_pay_rates.';

/* -------------------------------------------------------------------------- */
/* (c) payroll_line_items — tung khoan cong/tru cua mot dong                    */
/* -------------------------------------------------------------------------- */

create table payroll_line_items (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  line_id uuid not null references payroll_lines (id) on delete cascade,

  -- KHONG co khoa ngoai toi `pay_adjustments`: khoan co the bi tat, doi ten,
  -- hoac doi gia tri sau khi chot. Ban chot chep lai ten va so tien tai thoi
  -- diem chot — do la phan tra loi "vi sao ra con so do".
  --
  -- `adjustment_id` van duoc giu de doi chieu, nhung la TEXT khong rang buoc:
  -- mot khoan bi xoa cung khong duoc lam hong ban chot.
  adjustment_id text null,

  kind text not null check (kind in ('allowance', 'deduction')),
  name text not null,
  amount numeric(14, 2) not null,
  -- So lan nhan (`per_late` nhan voi so lan di muon); 1 voi `per_period`.
  multiplier numeric(8, 2) not null default 1
);

comment on table payroll_line_items is
  'Tung khoan cong/tru cua mot dong luong da chot. `name` va `amount` CHEP LAI, '
  'khong tham chieu song toi pay_adjustments — khoan co the bi tat hoac doi ten '
  'sau khi chot, va ban chot van phai giai thich duoc con so.';

/* -------------------------------------------------------------------------- */
/* Index                                                                       */
/* -------------------------------------------------------------------------- */

create index payroll_runs_company_id_idx on payroll_runs (company_id);
create index payroll_runs_company_id_period_start_idx
  on payroll_runs (company_id, period_start);
create index payroll_lines_company_id_idx on payroll_lines (company_id);
create index payroll_lines_run_id_idx on payroll_lines (run_id);
create index payroll_line_items_company_id_idx on payroll_line_items (company_id);
create index payroll_line_items_line_id_idx on payroll_line_items (line_id);

/* -------------------------------------------------------------------------- */
/* Bat bien: ban chot KHONG SUA DUOC (nhung xoa duoc — xem muc (2))            */
/* -------------------------------------------------------------------------- */
-- SQLSTATE '23001' dung chung voi hai trigger append-only da co (0016/0022):
-- day cung la mot vi pham "khong duoc sua de", va tang ung dung khong can
-- phan biet ba truong hop do.
--
-- THU TUC GO TRIGGER CO Y THUC (khi phai sua du lieu hong that):
--
--   begin;
--   alter table payroll_lines disable trigger payroll_lines_immutable;
--   -- ... cau lenh sua ...
--   alter table payroll_lines enable trigger payroll_lines_immutable;
--   commit;
--
-- Nhung o day duong dung gan nhu luon la HUY CA BAN CHOT roi chot lai (D-45),
-- vi no de lai audit va tinh lai moi con so cung mot luc.

create function public.tf_payroll_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Bảng lương đã chốt không sửa được từng dòng. Nếu con số sai, hãy huỷ chốt lương cả kỳ (kèm lý do) rồi chốt lại — cách đó tính lại mọi dòng cùng một lúc và để lại dấu vết.'
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.tf_payroll_immutable() is
  'D-42: ban chot luong bat bien voi UPDATE. DELETE KHONG bi chan — D-45 cho '
  'phep huy CA ban chot (xem muc (2) cua khoi comment migration 0024).';

create trigger payroll_runs_immutable
  before update on payroll_runs
  for each row
  execute function public.tf_payroll_immutable();

create trigger payroll_lines_immutable
  before update on payroll_lines
  for each row
  execute function public.tf_payroll_immutable();

create trigger payroll_line_items_immutable
  before update on payroll_line_items
  for each row
  execute function public.tf_payroll_immutable();

/* -------------------------------------------------------------------------- */
/* RLS — 4 policy moi bang, dieu kien duy nhat tf_is_member                    */
/* -------------------------------------------------------------------------- */

alter table payroll_runs enable row level security;

create policy payroll_runs_select_member on payroll_runs
  for select using (public.tf_is_member(company_id));
create policy payroll_runs_insert_member on payroll_runs
  for insert with check (public.tf_is_member(company_id));
create policy payroll_runs_update_member on payroll_runs
  for update using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));
create policy payroll_runs_delete_member on payroll_runs
  for delete using (public.tf_is_member(company_id));

alter table payroll_lines enable row level security;

create policy payroll_lines_select_member on payroll_lines
  for select using (public.tf_is_member(company_id));
create policy payroll_lines_insert_member on payroll_lines
  for insert with check (public.tf_is_member(company_id));
create policy payroll_lines_update_member on payroll_lines
  for update using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));
create policy payroll_lines_delete_member on payroll_lines
  for delete using (public.tf_is_member(company_id));

alter table payroll_line_items enable row level security;

create policy payroll_line_items_select_member on payroll_line_items
  for select using (public.tf_is_member(company_id));
create policy payroll_line_items_insert_member on payroll_line_items
  for insert with check (public.tf_is_member(company_id));
create policy payroll_line_items_update_member on payroll_line_items
  for update using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));
create policy payroll_line_items_delete_member on payroll_line_items
  for delete using (public.tf_is_member(company_id));
