-- 0023_pay_adjustments.sql
--
-- Danh muc PHU CAP va KHAU TRU do doanh nghiep tu khai (PAY-04, plan 05-2-03),
-- kem PHAM VI AP DUNG cua tung khoan. Khong mot con so tien nao duoc tinh o
-- day: `percent_of_daily_wage` chi la mot CACH KHAI gia tri, quy no ra tien la
-- viec cua 05-2-04.
--
-- (1) VI SAO HAI BANG CHU KHONG PHAI MOT COT MANG
--
-- Chinh sach that co hinh dang "TOAN CONG TY, TRU MAY NGUOI" (D-40). Do la
-- HAI CHIEU khac nhau — mot chieu gom vao, mot chieu loai ra — va mot cot
-- `text[]` khong dien dat duoc chieu thu hai.
--
-- Neu ep no thanh mot danh sach, cach khai duy nhat con lai la LIET KE TAY 37
-- nguoi. Va khi doanh nghiep tuyen nguoi thu 41, nguoi do KHONG nhan duoc phu
-- cap dang ra phai co — khong co gi bao dong, vi he thong khong biet dang ra
-- ho phai co. Do la dung loai sai lang le ma ca phase nay ton tai de chan.
--
-- Voi hai bang: "toan cong ty tru 3 nguoi" la MOT dong `include`/`company`
-- cong BA dong `exclude`/`employee`. Nguoi thu 41 tu dong vao pham vi, khong
-- ai phai nho sua gi.
--
-- (2) PHAM VI THEO CHUC VU SO KHOP THEO CHUOI, VA DO LA MOT GIOI HAN THAT
--
-- `employees.position` la TEXT TU DO (migration 0004), khong phai mot bang tra
-- cuu. Nen `scope_type = 'position'` so khop `scope_value` voi chinh chuoi do.
-- HE QUA phai biet truoc: go sai chinh ta — "Nhan vien kho" va "Nhan vien Kho"
-- — la KHONG KHOP AI, va man hinh se hien "0 nguoi bi ap" chu khong bao loi.
-- Do la ly do man hinh khai BAT BUOC hien truoc danh sach nguoi bi ap.
--
-- (3) KHONG CO COT THANG (D-40a)
--
-- Moi khoan ap cho MOI KY LUONG. Khong co khoan "chi ky nay". Gioi han da
-- biet, ghi ro de nguoi sau khong tuong la bo sot: THUONG THANG, TAM UNG va
-- PHAT MOT LAN chua nhap duoc — muon cong/tru mot lan thi phai tao khoan, chay
-- ky, roi tat khoan do. Neu pilot thay vuong, THEM MOT COT THANG vao bang nay
-- la du; khong phai doi mo hinh.
--
-- (4) KHONG XOA, CHI TAT
--
-- Khong co duong xoa cung o tang ung dung (`is_active = false` thay the). Mot
-- khoan da tung vao mot ban chot luong ma bi xoa thi ban chot cua ky DA TRA
-- mat phan giai thich "vi sao ra con so do" — va do la thu duy nhat tra loi
-- duoc cau hoi do sau nay. Bang van co policy `delete` (xem muc 6).
--
-- (5) FILE NAY CHAY LAI DUOC MA VO HAI — khuon 0018/0021/0022.

drop table if exists pay_adjustment_scopes;
drop table if exists pay_adjustments;

/* -------------------------------------------------------------------------- */
/* (a) pay_adjustments — mot KHOAN                                             */
/* -------------------------------------------------------------------------- */

create table pay_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,

  name text not null check (length(trim(name)) > 0),

  -- Cong hay tru. Text + check theo tien le `overtime_rules.rule_key` (0005).
  kind text not null check (kind in ('allowance', 'deduction')),

  -- CACH KHAI gia tri, khong phai gia tri da quy doi:
  --   fixed_amount           — mot so tien dong
  --   percent_of_daily_wage  — phan tram cua LUONG NGAY (khong phai luong thang)
  value_type text not null
    check (value_type in ('fixed_amount', 'percent_of_daily_wage')),

  value numeric(14, 2) not null check (value > 0),

  -- `per_period` — ap mot lan cho ca ky.
  -- `per_late`   — nhan voi SO LAN di muon ma he thong da dem (D-41).
  basis text not null default 'per_period'
    check (basis in ('per_period', 'per_late')),

  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  -- Phat di muon khong the la mot khoan CONG. Rang buoc nay chan mot cach
  -- khai vo nghia ngay tai database thay vi de no song trong du lieu roi lam
  -- bang luong cong them tien moi lan ai do di muon.
  check (basis = 'per_period' or kind = 'deduction'),

  -- Mot khoan tru 300% luong ngay gan nhu chac chan la go nham. Chan o day de
  -- no khong bao gio den duoc phep tinh cua 05-2-04.
  check (value_type = 'fixed_amount' or value <= 100)
);

comment on table pay_adjustments is
  'PAY-04/D-40: danh muc phu cap (cong) va khau tru (tru) do doanh nghiep tu '
  'khai. KHONG co cot thang — moi khoan ap cho moi ky luong (D-40a). Tat bang '
  'is_active, khong xoa: xem muc (4) cua khoi comment migration 0023.';

comment on column pay_adjustments.value_type is
  'percent_of_daily_wage tinh tren LUONG NGAY, khong phai luong thang. Quy ra '
  'tien la viec cua 05-2-04, khong phai cua bang nay.';

comment on column pay_adjustments.basis is
  'D-41: per_late nhan gia tri voi SO LAN di muon he thong da dem. Gioi han da '
  'biet: chi dem SO LAN, khong phan bac theo so phut muon.';

/* -------------------------------------------------------------------------- */
/* (b) pay_adjustment_scopes — PHAM VI va LOAI TRU                             */
/* -------------------------------------------------------------------------- */

create table pay_adjustment_scopes (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  adjustment_id uuid not null
    references pay_adjustments (id) on delete cascade,

  -- HAI CHIEU, khong phai hai gia tri cua cung mot danh sach — xem muc (1).
  mode text not null check (mode in ('include', 'exclude')),

  scope_type text not null
    check (scope_type in ('company', 'department', 'position', 'employee')),

  -- `department` -> departments.id | `position` -> chuoi position | `employee`
  -- -> employees.id. KHONG dat khoa ngoai: ba loai tro toi ba dich khac nhau,
  -- va mot khoa ngoai chi ap duoc cho mot trong ba.
  scope_value text null,

  created_at timestamptz not null default now(),

  -- "Toan cong ty" khong nhan gia tri, ba loai con lai bat buoc co. Hai ve cua
  -- rang buoc nay chan hai cach khai vo nghia nguoc nhau: mot dong `company`
  -- kem gia tri (gia tri do se bi lo di) va mot dong `department` khong gia
  -- tri (khong biet phong nao).
  check (
    (scope_type = 'company' and scope_value is null)
    or (scope_type <> 'company' and scope_value is not null
        and length(trim(scope_value)) > 0)
  )
);

comment on table pay_adjustment_scopes is
  'D-40: pham vi ap dung cua mot khoan. `include` gom vao, `exclude` loai ra — '
  'HAI CHIEU khac nhau. "Toan cong ty tru 3 nguoi" = 1 dong include/company + '
  '3 dong exclude/employee, KHONG phai liet ke 37 nguoi (xem muc (1) cua khoi '
  'comment migration 0023).';

comment on column pay_adjustment_scopes.scope_value is
  'department -> departments.id | position -> chuoi employees.position (SO '
  'KHOP THEO CHUOI, go sai la khong khop ai) | employee -> employees.id. '
  'NULL khi va chi khi scope_type = company.';

/* -------------------------------------------------------------------------- */
/* Index                                                                       */
/* -------------------------------------------------------------------------- */

create index pay_adjustments_company_id_idx on pay_adjustments (company_id);
create index pay_adjustments_company_id_is_active_idx
  on pay_adjustments (company_id, is_active);
create index pay_adjustment_scopes_company_id_idx
  on pay_adjustment_scopes (company_id);
create index pay_adjustment_scopes_adjustment_id_idx
  on pay_adjustment_scopes (adjustment_id);

/* -------------------------------------------------------------------------- */
/* (6) RLS — 4 policy moi bang, dieu kien duy nhat tf_is_member               */
/* -------------------------------------------------------------------------- */
-- Policy `delete` VAN CO tren ca hai bang, va do khong mau thuan voi muc (4):
--   - `pay_adjustment_scopes` PHAI xoa duoc — pham vi la mot TAP, va ghi lai
--     pham vi nghia la xoa tap cu roi chen tap moi.
--   - `pay_adjustments` giu policy `delete` de RLS khong phai la lop dat quy
--     tac nghiep vu. "Khong xoa khoan" duoc giu o tang ung dung (khong co
--     Server Action xoa) — mot lop RLS mang y nghia nghiep vu se lam nguoi sau
--     tuong ranh gioi doanh nghiep va quy tac nghiep vu la cung mot thu.

alter table pay_adjustments enable row level security;

create policy pay_adjustments_select_member on pay_adjustments
  for select
  using (public.tf_is_member(company_id));

create policy pay_adjustments_insert_member on pay_adjustments
  for insert
  with check (public.tf_is_member(company_id));

create policy pay_adjustments_update_member on pay_adjustments
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy pay_adjustments_delete_member on pay_adjustments
  for delete
  using (public.tf_is_member(company_id));

alter table pay_adjustment_scopes enable row level security;

create policy pay_adjustment_scopes_select_member on pay_adjustment_scopes
  for select
  using (public.tf_is_member(company_id));

create policy pay_adjustment_scopes_insert_member on pay_adjustment_scopes
  for insert
  with check (public.tf_is_member(company_id));

create policy pay_adjustment_scopes_update_member on pay_adjustment_scopes
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy pay_adjustment_scopes_delete_member on pay_adjustment_scopes
  for delete
  using (public.tf_is_member(company_id));
