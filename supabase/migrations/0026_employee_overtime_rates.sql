-- 0026_employee_overtime_rates.sql
--
-- TIEN TANG CA KHAI THEO TUNG NGUOI. `overtime_rules` (0016) la he so cua CA
-- DOANH NGHIEP theo tung loai ngay; bang nay la mot muc RIENG cua mot nguoi,
-- ap cho MOI gio tang ca cua ho va thay cho toan bo he so theo loai ngay.
-- Khong khai gi thi nguoi do van an theo he so cua doanh nghiep.
--
-- MOT MUC, KHONG PHAI BON: mot thoa thuan kieu "tang ca 60.000d/gio" trong
-- doanh nghiep nho la mot con so duy nhat, khong tach theo ngay thuong / ngay
-- nghi / ngay le. Man hinh khai phai NOI RO dieu do, vi hau qua la ngay le
-- cua nguoi co muc rieng se khong con duoc nhan 300% theo Dieu 98 BLLD —
-- do la lua chon cua doanh nghiep, nhung phai la mot lua chon co y thuc.
-- Muon tach theo loai ngay ve sau thi them mot cot `rule_key` vao day; mo
-- hinh hien tai la truong hop dac biet "ap cho moi loai ngay" cua no.
--
-- (A) VI SAO CAN, VA VI SAO KHONG PHAI MOT CON SO O `employee_pay_rates`
--
-- Mot xuong san xuat tra 60.000d/gio cho gio thu 11 tro di, trong khi khoi
-- van phong an he so 150% theo luat. Hai cach tinh cung ton tai trong mot
-- doanh nghiep, va cach cua tung nguoi la mot THOA THUAN co ngay hieu luc
-- rieng — nen no phai co `effective_from` cua chinh no, khong the treo vao
-- dong luong co ban (doi luong co ban khong nhat thiet doi thoa thuan tang
-- ca, va nguoc lai).
--
-- (B) HAI KIEU GIA TRI, VA VI SAO CA HAI DEU CAN
--
--   `multiplier`    — he so nhan voi don gia gio (1,5 = 150%). Luat viet bang
--                     phan tram (Dieu 98 BLLD: 150/200/300%), va tang luong
--                     co ban thi tien tang ca tu tang theo.
--   `fixed_hourly`  — SO TIEN mot gio tang ca, tinh bang dong. Doi luong co
--                     ban KHONG lam doi con so nay cho toi khi ai do khai
--                     mot phien ban moi — dung y voi mot thoa thuan viet
--                     bang so tien tuyet doi.
--
-- Khong quy `fixed_hourly` ve mot he so luc ghi: he so do se sai ngay lan dau
-- tien muc luong co ban doi, va khong ai phat hien ra vi bang luong khong bao
-- loi — no chi khac di.
--
-- (C) APPEND-ONLY, cung khuon va cung ly do voi 0016/0022: sua de mot dong cu
-- lam TIEN DA TRA cua ky da qua tinh lai ra con so khac. Muon doi thi khai
-- mot phien ban moi voi `effective_from`.
--
-- Thu tuc sua du lieu hong (khi that su can) giong het 0022:
--
--   begin;
--   alter table employee_overtime_rates disable trigger employee_overtime_rates_append_only;
--   -- ... cau lenh sua ...
--   alter table employee_overtime_rates enable trigger employee_overtime_rates_append_only;
--   commit;

do $$
begin
  if to_regclass('public.employee_overtime_rates') is not null then
    execute 'drop trigger if exists employee_overtime_rates_append_only on employee_overtime_rates';
  end if;
end;
$$;

drop function if exists public.tf_employee_overtime_rates_append_only();
drop function if exists public.tf_employee_overtime_rate_at(text, date);

/* -------------------------------------------------------------------------- */
/* (1) Bang                                                                    */
/* -------------------------------------------------------------------------- */

create table if not exists employee_overtime_rates (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  employee_id text not null references employees (id) on delete cascade,

  value_type text not null check (value_type in ('multiplier', 'fixed_hourly')),

  -- Mot cot cho ca hai kieu: `multiplier` doc la he so (1.5), `fixed_hourly`
  -- doc la so tien mot gio (60000). numeric(14, 2) vi no CO THE la tien —
  -- va tien thi khong bao gio duoc luu bang dau phay dong (D-42a).
  value numeric(14, 2) not null check (value > 0),

  effective_from date not null,

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null,

  -- Mot nguoi, mot moc hieu luc. Trung moc nghia la nguoi khai dang sua de
  -- bang duong vong, va phep tra "dang hieu luc" se khong biet chon dong nao.
  unique (employee_id, effective_from)
);

comment on table employee_overtime_rates is
  'Tien tang ca khai theo TUNG NGUOI, de len tren he so cua doanh nghiep '
  '(overtime_rules). Khoa nao khong khai thi nguoi do an theo he so doanh '
  'nghiep. APPEND-ONLY theo effective_from — xem comment migration 0026.';

comment on column employee_overtime_rates.value is
  'He so nhan (value_type = multiplier) HOAC so tien mot gio tang ca, don vi '
  'dong (value_type = fixed_hourly). Khong bao gio quy kieu nay ve kieu kia '
  'luc ghi: mot he so quy tu so tien se sai ngay lan dau muc luong co ban doi.';

create index if not exists employee_overtime_rates_company_id_idx
  on employee_overtime_rates (company_id);
create index if not exists employee_overtime_rates_lookup_idx
  on employee_overtime_rates (employee_id, effective_from desc);

/* -------------------------------------------------------------------------- */
/* (2) Cuong che append-only                                                   */
/* -------------------------------------------------------------------------- */

create function public.tf_employee_overtime_rates_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Bảng employee_overtime_rates chỉ được thêm mới (append-only). Muốn đổi tiền tăng ca của một người, hãy khai một phiên bản mới với effective_from là ngày bắt đầu hiệu lực — sửa đè dòng cũ sẽ làm bảng lương của các kỳ đã trả tính lại ra một con số khác.'
    using errcode = 'restrict_violation';
end;
$$;

create trigger employee_overtime_rates_append_only
  before update or delete on employee_overtime_rates
  for each row
  execute function public.tf_employee_overtime_rates_append_only();

/* -------------------------------------------------------------------------- */
/* (3) Muc DANG HIEU LUC tai mot ngay                                          */
/* -------------------------------------------------------------------------- */
-- `security invoker` (mac dinh), cung ly do voi `tf_pay_rate_at` (0022): day
-- khong phai ham kiem quyen, no phai di qua RLS nhu moi truy van khac.
--
-- Tra NULL khi nguoi do chua khai khoa nay, hoac khi ngay can tra nam TRUOC
-- moi phien ban — noi goi hieu NULL la "dung he so cua doanh nghiep", chu
-- KHONG lui ve dong gan nhat va khong bia ra mot con so.

create function public.tf_employee_overtime_rate_at(
  p_employee_id text,
  p_date date
)
returns employee_overtime_rates
language sql
stable
as $$
  select r.*
  from employee_overtime_rates r
  where r.employee_id = p_employee_id
    and r.effective_from <= p_date
  order by r.effective_from desc
  limit 1;
$$;

comment on function public.tf_employee_overtime_rate_at(text, date) is
  'Muc tang ca rieng DANG HIEU LUC cua mot nhan vien tai p_date. NULL nghia la '
  'nguoi do khong co muc rieng -> dung he so theo loai ngay cua doanh nghiep '
  '(tf_overtime_multiplier).';

/* -------------------------------------------------------------------------- */
/* (4) RLS — bon policy, dieu kien duy nhat tf_is_member                       */
/* -------------------------------------------------------------------------- */
-- Van khai du bon policy ke ca khi update/delete da bi trigger chan, cung ly
-- do da ghi o 0022: policy va trigger tra loi hai cau hoi khac nhau.

alter table employee_overtime_rates enable row level security;

drop policy if exists employee_overtime_rates_select_member on employee_overtime_rates;
drop policy if exists employee_overtime_rates_insert_member on employee_overtime_rates;
drop policy if exists employee_overtime_rates_update_member on employee_overtime_rates;
drop policy if exists employee_overtime_rates_delete_member on employee_overtime_rates;

create policy employee_overtime_rates_select_member on employee_overtime_rates
  for select
  using (public.tf_is_member(company_id));

create policy employee_overtime_rates_insert_member on employee_overtime_rates
  for insert
  with check (public.tf_is_member(company_id));

create policy employee_overtime_rates_update_member on employee_overtime_rates
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy employee_overtime_rates_delete_member on employee_overtime_rates
  for delete
  using (public.tf_is_member(company_id));
