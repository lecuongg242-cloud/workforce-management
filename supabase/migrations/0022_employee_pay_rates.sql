-- 0022_employee_pay_rates.sql
--
-- CHO DE KHAI LUONG (PAY-06, plan 05-2-01). Ba thu, khong mot phep tinh tien
-- nao:
--   (1) bang `employee_pay_rates` APPEND-ONLY co trigger cuong che;
--   (2) ham `tf_pay_rate_at()` tra muc luong DANG HIEU LUC tai mot ngay;
--   (3) ba cot cau hinh cach tinh cong vao `company_settings`.
--
-- (A) VI SAO APPEND-ONLY O DAY NANG HON O 0016
--
-- 0016 da dat cung khuon nay cho `overtime_rules` (D-25a): sua mot he so
-- nghia la khai mot PHIEN BAN MOI, khong bao gio UPDATE hay DELETE dong cu.
-- O day hau qua nang hon mot bac.
--
-- Sua de mot he so tang ca lam SO LIEU cua ky da qua doi. Sua de mot muc
-- luong lam TIEN DA TRA CHO NGUOI LAO DONG tinh lai ra mot con so khac — va
-- sai ve QUA KHU, tuc la ve nhung ky ma tien da ra khoi tai khoan doanh
-- nghiep va vao tai khoan nguoi lao dong. Khong ai phat hien ra, vi bang luong
-- khong bao loi: no chi don gian la khac di.
--
-- Tang luong giua nam la chuyen binh thuong. Cach dung DUNG la khai mot dong
-- moi voi `effective_from` la ngay bat dau muc luong moi; dong cu o lai, va
-- thang truoc do van tra loi duoc cau hoi "thang do nguoi nay an luong bao
-- nhieu".
--
-- (B) KHI THAT SU CAN SUA DU LIEU HONG (vi du mot dong khai nham vao dung
-- ngay hom nay, chua ai chot luong ky nao): tam go trigger trong MOT
-- transaction roi gan lai —
--
--   begin;
--   alter table employee_pay_rates disable trigger employee_pay_rates_append_only;
--   -- ... cau lenh sua ...
--   alter table employee_pay_rates enable trigger employee_pay_rates_append_only;
--   commit;
--
-- Ghi lai o day de nguoi sau khong phai doan, va de viec do luon la mot hanh
-- dong CO Y THUC chu khong phai mot lan `update` tien tay. Cung thu tuc, cung
-- ly do voi 0016.
--
-- (C) HAI HE QUA DA BIET (giong 0016):
--   - `truncate` KHONG bi chan (trigger la FOR EACH ROW tren delete) — nen
--     `supabase/seed.sql` van chay duoc.
--   - XOA MOT DOANH NGHIEP se keo `on delete cascade` xuong bang nay va bi
--     trigger chan. Duong xoa doanh nghiep chua ton tai trong ung dung; khi
--     nao co, no phai tam go trigger theo dung thu tuc o tren.
--
-- (D) FILE NAY CHAY LAI DUOC MA VO HAI — khuon 0018/0021 cua Phase 5. Mot
-- migration chua phat hanh ma sua duoc tai cho thi khong phai de lai mot file
-- va chi de doi mot dong.

-- `drop trigger ... on <bang>` can bang do TON TAI, ke ca voi `if exists` o mot
-- so phien ban — nen buoc nay duoc bao boi mot phep kiem bang, de LAN CHAY DAU
-- (chua co bang) khong phai la mot ngoai le.
do $$
begin
  if to_regclass('public.employee_pay_rates') is not null then
    execute 'drop trigger if exists employee_pay_rates_append_only on employee_pay_rates';
  end if;
end;
$$;

drop function if exists public.tf_employee_pay_rates_append_only();
drop function if exists public.tf_pay_rate_at(text, date);

/* -------------------------------------------------------------------------- */
/* (1) employee_pay_rates                                                      */
/* -------------------------------------------------------------------------- */

create table if not exists employee_pay_rates (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  employee_id text not null references employees (id) on delete cascade,

  -- D-37: DON VI khai theo TUNG NGUOI, khong ep mot don vi cho ca doanh
  -- nghiep. Van phong de luong thang, xuong de luong gio — cung mot noi.
  -- Text + check theo tien le `overtime_rules.rule_key` (0005): them mot don
  -- vi ve sau la sua danh sach nay, khong phai doi mot enum ma bang khac cung
  -- dung.
  unit text not null check (unit in ('month', 'day', 'hour')),

  -- numeric(14, 2): du cho luong thang tinh bang tram trieu dong, va KHONG
  -- BAO GIO la float — mot con so tien luu bang dau phay dong se lech vai
  -- dong khi cong don, va ke toan se phat hien ra (D-42a).
  amount numeric(14, 2) not null check (amount > 0),

  -- Ngay BAT DAU hieu luc cua phien ban nay.
  effective_from date not null,

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null,

  -- Mot nguoi mot muc luong cho mot moc hieu luc. Trung moc nghia la nguoi
  -- khai dang co sua de bang duong vong — va `tf_pay_rate_at()` se khong biet
  -- chon dong nao.
  unique (employee_id, effective_from)
);

comment on table employee_pay_rates is
  'PAY-06/D-37a: muc luong cua tung nhan vien, APPEND-ONLY theo effective_from. '
  'Sua luong = khai mot phien ban moi. Xem khoi comment cua migration 0022 ve '
  'vi sao UPDATE/DELETE bi trigger tu choi.';

create index if not exists employee_pay_rates_company_id_idx
  on employee_pay_rates (company_id);
create index if not exists employee_pay_rates_employee_id_effective_from_idx
  on employee_pay_rates (employee_id, effective_from desc);

/* -------------------------------------------------------------------------- */
/* (2) Cuong che append-only                                                   */
/* -------------------------------------------------------------------------- */

create function public.tf_employee_pay_rates_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Bảng employee_pay_rates chỉ được thêm mới (append-only). Muốn đổi mức lương, hãy khai một phiên bản mới với effective_from là ngày bắt đầu hiệu lực — sửa đè dòng cũ sẽ làm bảng lương của các kỳ đã trả tính lại ra một con số khác.'
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.tf_employee_pay_rates_append_only() is
  'D-37a: cuong che quy uoc append-only cua employee_pay_rates o tang database. '
  'Thong diep noi CACH LAM DUNG (khai phien ban moi) chu khong chi noi "cam".';

create trigger employee_pay_rates_append_only
  before update or delete on employee_pay_rates
  for each row
  execute function public.tf_employee_pay_rates_append_only();

/* -------------------------------------------------------------------------- */
/* (3) Muc luong DANG HIEU LUC tai mot ngay                                    */
/* -------------------------------------------------------------------------- */
-- `security invoker` (mac dinh) CO Y, cung ly do voi `tf_overtime_multiplier`
-- (0016): day khong phai ham kiem quyen, no phai di qua RLS nhu moi truy van
-- khac — nguoi goi chi thay dong cua doanh nghiep minh la thanh vien.
--
-- Tra NULL khi ngay can tra nam TRUOC moi `effective_from` cua nhan vien do,
-- hoac khi nguoi do chua duoc khai luong lan nao. KHONG lui ve dong gan nhat
-- va KHONG bia ra 0: mot muc luong bia cho khoang thoi gian doanh nghiep chua
-- khai gi la dung loai sai lang le ma D-26 ton tai de chan — va o day no ra
-- tien.

create function public.tf_pay_rate_at(
  p_employee_id text,
  p_date date
)
returns employee_pay_rates
language sql
stable
as $$
  select r.*
  from employee_pay_rates r
  where r.employee_id = p_employee_id
    and r.effective_from <= p_date
  order by r.effective_from desc
  limit 1;
$$;

comment on function public.tf_pay_rate_at(text, date) is
  'Muc luong DANG HIEU LUC cua mot nhan vien tai p_date: dong co effective_from '
  'lon nhat ma van <= p_date. Tra NULL khi ngay do nam truoc moi phien ban da '
  'khai, hoac khi nhan vien chua duoc khai luong lan nao — KHONG lui ve dong '
  'gan nhat va khong bia ra 0 (D-26).';

/* -------------------------------------------------------------------------- */
/* (4) RLS — 4 policy, dieu kien duy nhat tf_is_member                         */
/* -------------------------------------------------------------------------- */
-- Van co day du bon policy ke ca khi update/delete da bi trigger chan: policy
-- va trigger tra loi hai cau hoi khac nhau ("ai duoc dong toi dong nay" va
-- "dong nay co duoc doi khong"). Bo policy update/delete di se lam cong
-- `00_rls_coverage.sql` van xanh nhung thong diep loi khi ai do thu sua se la
-- mot loi RLS chung chung thay vi cau giai thich cua trigger.

alter table employee_pay_rates enable row level security;

drop policy if exists employee_pay_rates_select_member on employee_pay_rates;
drop policy if exists employee_pay_rates_insert_member on employee_pay_rates;
drop policy if exists employee_pay_rates_update_member on employee_pay_rates;
drop policy if exists employee_pay_rates_delete_member on employee_pay_rates;

create policy employee_pay_rates_select_member on employee_pay_rates
  for select
  using (public.tf_is_member(company_id));

create policy employee_pay_rates_insert_member on employee_pay_rates
  for insert
  with check (public.tf_is_member(company_id));

create policy employee_pay_rates_update_member on employee_pay_rates
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy employee_pay_rates_delete_member on employee_pay_rates
  for delete
  using (public.tf_is_member(company_id));

/* -------------------------------------------------------------------------- */
/* (5) Cach tinh cong cua doanh nghiep (D-36) + hai mau so quy doi (D-38)      */
/* -------------------------------------------------------------------------- */
--
-- `work_mode` CO MAC DINH `shift`, va do la mot lua chon co y: doanh nghiep
-- dang chay tren he thong nay tu Phase 4 den nay deu o che do co ca. Mac dinh
-- `shift` nghia la migration nay KHONG DOI HANH VI cua ai — khong phai nghia
-- la "he thong doan gium".
--
-- HAI MAU SO THI KHONG CO MAC DINH, va do khong phai su so sot (D-38 + D-26).
-- 22 hay 26 ngay cong chuan la chuyen cua tung doanh nghiep, 8 hay 10 gio mot
-- cong cung vay. Mot mac dinh se lam man hinh trong nhu da tinh dung trong khi
-- chua ai khai gi — va vi day la mau so cua phep quy doi luong thang -> don
-- gia gio, doan sai mau so nghia la sai don gia gio cua MOI NGUOI.
--
-- `NULL` o day nghia la CHUA KHAI, khong phai 0. Rang buoc CHECK cam gia tri
-- <= 0 chinh la de khoang cach giua hai y nghia do khong the bi lam nhoe —
-- cung lap luan voi `overtime_cap_hours_per_month` (0019).

alter table company_settings
  add column if not exists work_mode text not null default 'shift'
    check (work_mode in ('daily_hours', 'shift', 'shift_hourly'));

alter table company_settings
  add column if not exists standard_hours_per_day numeric(5, 2) null
    check (standard_hours_per_day is null or standard_hours_per_day > 0);

alter table company_settings
  add column if not exists standard_days_per_month numeric(5, 2) null
    check (standard_days_per_month is null or standard_days_per_month > 0);

comment on column company_settings.work_mode is
  'D-36: cach doanh nghiep dinh nghia MOT NGAY CONG. daily_hours = khong co ca, '
  'mot cong bang N gio; shift = co ca (hanh vi tu Phase 4); shift_hourly = co ca '
  'nhung luong cong/tru theo gio thuc te. Mac dinh shift de doanh nghiep dang '
  'chay giu nguyen hanh vi.';

comment on column company_settings.standard_hours_per_day is
  'D-38: MAU SO quy doi mot ngay cong ra gio. NULL = CHUA KHAI (khong phai 0, '
  'khong phai 8). Che do daily_hours can con so nay moi chay duoc.';

comment on column company_settings.standard_days_per_month is
  'D-38: MAU SO quy doi luong thang ra don gia ngay. NULL = CHUA KHAI (khong '
  'phai 0, khong phai 22 hay 26 — do la chuyen cua tung doanh nghiep, D-26).';
