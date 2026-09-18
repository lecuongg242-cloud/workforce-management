-- 0038_rate_void.sql
--
-- HUY MOT DONG KHAI NHAM tren `employee_pay_rates` va `employee_overtime_rates`
-- (D-57). Truoc file nay, mot dong khai nham la KHONG SUA DUOC bang bat ky
-- duong nao trong ung dung: trigger append-only chan ca UPDATE lan DELETE, con
-- `unique (employee_id, effective_from)` chan luon viec khai lai dung ngay do.
-- Nguoi dung go nham mot so tien chi con mot lua chon la song chung voi no.
--
-- (1) VI SAO LA "HUY" CHU KHONG PHAI "SUA" HAY "XOA"
--
-- Hai tinh huong hoan toan khac nhau tung bi gop lam mot:
--   - DOI MUC LUONG THAT (tang luong, doi thoa thuan): dong cu DUNG cho qua
--     khu. Khai mot phien ban moi -- khuon nay da co tu 0022, khong doi gi.
--   - GO NHAM: khong he co ky nao nguoi do thuc su an muc do. Dong ay phai
--     bien mat khoi Y NGHIA NGHIEP VU, nhung KHONG duoc bien mat khoi DAU VET.
--
-- Nen huy la mot dau dong len dong cu (`voided_at`/`voided_by`/`void_reason`),
-- khong phai mot lenh xoa. Lich su van hien dong da huy kem ly do -- nguoi doc
-- sau van thay "co nguoi khai nham va da huy", thay vi mot khoang trong.
--
-- Huy la MOT CHIEU. Khong co "bo huy": huy nham thi khai lai. Mot duong quay
-- lai se lam `voided_at` thanh mot cong tac bat/tat, va con so nao bat/tat
-- duoc thi khong con la dau vet nua.
--
-- (2) VI SAO KY DA CHOT LUONG KHONG BI ANH HUONG (D-57)
--
-- Khong co mot phep kiem nao o day chan viec huy mot dong da di vao ky da
-- chot -- va khong can co. `payroll_lines` CHEP `pay_unit`/`pay_amount` vao
-- chinh no luc chot (0024): khong con so nao cua ban chot doc lai bang nay.
-- Huy mot dong muc luong vi the KHONG THE lam ban chot doi, ve mat vat ly chu
-- khong phai ve mat quy uoc.
--
-- Va CHAN viec huy do se sai: muc luong MANG THEO VE SAU (`tf_pay_rate_at`
-- lay phien ban moi nhat <= ngay hoi), nen mot dong khai nham tu 01/08 -- du
-- thang 8 da chot -- VAN DANG la muc cua thang 9 va moi ky sau. Khong huy
-- duoc no nghia la cai sai chay tiep mai mai.
--
-- D-57 noi ky da chot thi khong tinh lai. Dieu do duoc bao dam boi anh chup o
-- 0024, khong phai boi mot lenh cam o day.
--
-- (3) TRIGGER NOI DUNG HAI KHE, KHONG HON
--
-- (a) DONG DAU HUY len mot dong CHUA huy, voi dieu kien moi cot nghiep vu
--     (`amount`, `unit`, `effective_from`, `employee_id`, `created_at`...)
--     khong doi mot chu. Bat bien goc giu nguyen: KHONG con so tien nao doi
--     tai cho, bao gio.
--
-- (b) FK `on delete set null` cua `created_by`/`voided_by`. Khe nay SUA MOT
--     BUG CO SAN: truoc file nay, xoa mot tai khoan da tung khai luong luon
--     that bai, vi phep set-null cua khoa ngoai la mot UPDATE va bi chinh
--     trigger append-only chan. Khong ai gap vi duong xoa tai khoan chua duoc
--     dung nhieu -- nhung no hong tu 0022.
--
--     Danh doi da biet: mot thanh vien goi thang PostgREST co the tu dat
--     `created_by = null` de xoa dau ten nguoi khai. Chap nhan duoc -- phep do
--     khong doi mot con so tien nao, va `audit_log` van giu nguyen dong cu.
--
-- (4) UNIQUE THANH PARTIAL
--
-- `unique (employee_id, effective_from)` thanh mot index chi tren cac dong
-- CHUA HUY. Thieu manh nay thi huy xong van khong khai lai duoc dung ngay cu,
-- va ca co che nay vo dung.
--
-- (5) FILE NAY CHAY LAI DUOC MA VO HAI -- khuon 0018/0021/0022/0023/0024.

/* -------------------------------------------------------------------------- */
/* (a) Ba cot dau huy                                                          */
/* -------------------------------------------------------------------------- */

alter table employee_pay_rates
  add column if not exists voided_at timestamptz null,
  add column if not exists voided_by uuid null references auth.users (id) on delete set null,
  add column if not exists void_reason text null;

alter table employee_overtime_rates
  add column if not exists voided_at timestamptz null,
  add column if not exists voided_by uuid null references auth.users (id) on delete set null,
  add column if not exists void_reason text null;

-- Da huy thi PHAI co ly do. `voided_by` KHONG nam trong rang buoc nay: khoa
-- ngoai cua no la `on delete set null`, nen mot ban ghi huy hop le van phai
-- song duoc sau khi tai khoan nguoi huy bi xoa.
alter table employee_pay_rates
  drop constraint if exists employee_pay_rates_void_reason_check;
alter table employee_pay_rates
  add constraint employee_pay_rates_void_reason_check check (
    (voided_at is null and void_reason is null)
    or (voided_at is not null and btrim(void_reason) <> '')
  );

alter table employee_overtime_rates
  drop constraint if exists employee_overtime_rates_void_reason_check;
alter table employee_overtime_rates
  add constraint employee_overtime_rates_void_reason_check check (
    (voided_at is null and void_reason is null)
    or (voided_at is not null and btrim(void_reason) <> '')
  );

comment on column employee_pay_rates.voided_at is
  'D-57: dau huy mot dong KHAI NHAM. Dong van o lai trong lich su; moi duong '
  'doc muc luong deu bo qua no. Khong the bo huy -- huy nham thi khai lai.';
comment on column employee_overtime_rates.voided_at is
  'D-57: dau huy mot dong KHAI NHAM -- cung quy uoc voi employee_pay_rates.';

/* -------------------------------------------------------------------------- */
/* (b) Unique chi tren cac dong CHUA HUY                                       */
/* -------------------------------------------------------------------------- */

alter table employee_pay_rates
  drop constraint if exists employee_pay_rates_employee_id_effective_from_key;
drop index if exists employee_pay_rates_active_effective_from_idx;
create unique index employee_pay_rates_active_effective_from_idx
  on employee_pay_rates (employee_id, effective_from)
  where voided_at is null;

alter table employee_overtime_rates
  drop constraint if exists employee_overtime_rates_employee_id_effective_from_key;
drop index if exists employee_overtime_rates_active_effective_from_idx;
create unique index employee_overtime_rates_active_effective_from_idx
  on employee_overtime_rates (employee_id, effective_from)
  where voided_at is null;

/* -------------------------------------------------------------------------- */
/* (c) Trigger append-only, noi hai khe o muc (3)                              */
/* -------------------------------------------------------------------------- */

create or replace function public.tf_employee_pay_rates_append_only()
returns trigger
language plpgsql
as $$
declare
  v_business_unchanged boolean;
begin
  if tg_op = 'DELETE' then
    raise exception
      'Bảng employee_pay_rates chỉ được thêm mới (append-only) — không xoá được dòng nào. Khai nhầm thì huỷ dòng đó kèm lý do; đổi lương thì khai một phiên bản mới.'
      using errcode = 'restrict_violation';
  end if;

  v_business_unchanged :=
    new.id = old.id
    and new.company_id = old.company_id
    and new.employee_id = old.employee_id
    and new.unit = old.unit
    and new.amount = old.amount
    and new.effective_from = old.effective_from
    and new.created_at = old.created_at;

  -- Khe (a): dong dau huy len mot dong chua huy.
  if v_business_unchanged
    and old.voided_at is null
    and new.voided_at is not null
    and new.voided_by is not null
    and btrim(coalesce(new.void_reason, '')) <> ''
    and new.created_by is not distinct from old.created_by
  then
    return new;
  end if;

  -- Khe (b): `on delete set null` cua khoa ngoai toi auth.users.
  if v_business_unchanged
    and new.voided_at is not distinct from old.voided_at
    and new.void_reason is not distinct from old.void_reason
    and (new.created_by is not distinct from old.created_by or new.created_by is null)
    and (new.voided_by is not distinct from old.voided_by or new.voided_by is null)
  then
    return new;
  end if;

  if old.voided_at is not null then
    raise exception
      'Dòng mức lương này đã bị huỷ rồi — một dấu huỷ không gỡ lại được. Nếu mức đó là đúng, hãy khai lại nó như một phiên bản mới.'
      using errcode = 'restrict_violation';
  end if;

  raise exception
    'Bảng employee_pay_rates là append-only: chỉ đổi được bằng hai cách — khai một phiên bản mới (khi lương thật sự đổi), hoặc huỷ dòng khai nhầm kèm lý do. Sửa đè số tiền của một dòng cũ sẽ làm bảng lương của các kỳ đã trả tính lại ra một con số khác.'
    using errcode = 'restrict_violation';
end;
$$;

create or replace function public.tf_employee_overtime_rates_append_only()
returns trigger
language plpgsql
as $$
declare
  v_business_unchanged boolean;
begin
  if tg_op = 'DELETE' then
    raise exception
      'Bảng employee_overtime_rates chỉ được thêm mới (append-only) — không xoá được dòng nào. Khai nhầm thì huỷ dòng đó kèm lý do; đổi mức thì khai một phiên bản mới.'
      using errcode = 'restrict_violation';
  end if;

  v_business_unchanged :=
    new.id = old.id
    and new.company_id = old.company_id
    and new.employee_id = old.employee_id
    and new.value_type = old.value_type
    and new.value = old.value
    and new.effective_from = old.effective_from
    and new.created_at = old.created_at;

  if v_business_unchanged
    and old.voided_at is null
    and new.voided_at is not null
    and new.voided_by is not null
    and btrim(coalesce(new.void_reason, '')) <> ''
    and new.created_by is not distinct from old.created_by
  then
    return new;
  end if;

  if v_business_unchanged
    and new.voided_at is not distinct from old.voided_at
    and new.void_reason is not distinct from old.void_reason
    and (new.created_by is not distinct from old.created_by or new.created_by is null)
    and (new.voided_by is not distinct from old.voided_by or new.voided_by is null)
  then
    return new;
  end if;

  if old.voided_at is not null then
    raise exception
      'Dòng mức tăng ca này đã bị huỷ rồi — một dấu huỷ không gỡ lại được. Nếu mức đó là đúng, hãy khai lại nó như một phiên bản mới.'
      using errcode = 'restrict_violation';
  end if;

  raise exception
    'Bảng employee_overtime_rates là append-only: chỉ đổi được bằng hai cách — khai một phiên bản mới, hoặc huỷ dòng khai nhầm kèm lý do.'
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.tf_employee_pay_rates_append_only() is
  'D-37a + D-57: append-only, noi dung hai khe -- dong dau huy, va set-null cua '
  'khoa ngoai toi auth.users. Xem muc (3) cua migration 0038.';

comment on function public.tf_employee_overtime_rates_append_only() is
  'D-37a + D-57: cung khuon voi tf_employee_pay_rates_append_only.';

/* -------------------------------------------------------------------------- */
/* (d) Hai ham "dang hieu luc" bo qua dong da huy                              */
/* -------------------------------------------------------------------------- */

create or replace function public.tf_pay_rate_at(
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
    and r.voided_at is null
  order by r.effective_from desc
  limit 1;
$$;

create or replace function public.tf_employee_overtime_rate_at(
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
    and r.voided_at is null
  order by r.effective_from desc
  limit 1;
$$;
