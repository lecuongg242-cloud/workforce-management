-- 0015_company_settings.sql
--
-- Bang cau hinh cua tung doanh nghiep — MOT dong cho MOT doanh nghiep. Day la
-- nen cua Phase 4 (SET-01..SET-04) va la noi dong not loi hua D-21a cua Phase
-- 3: hai nguong cuoi cung con nhung trong ma nguon
-- (`SUSPICIOUS_DISTANCE_MULTIPLIER`, `SHIFT_WINDOW_GRACE_MINUTES` o
-- `src/lib/attendance/suspicious.ts`) chuyen ve day (D-29).
--
-- VI SAO CAC COT O DAY CO MAC DINH TRONG KHI `overtime_rules` VA `holidays`
-- CO Y DE RONG (0005_v2_tables.sql):
--   D-26 cam mac dinh cho GIA TRI NGHIEP VU MA DOANH NGHIEP TU QUYET — he so
--   tang ca, ngay nghi le. Mot he so mac dinh lam man hinh trong nhu da tinh
--   dung trong khi doanh nghiep chua khai gi.
--   Cac cot o day khac han: hai nguong dau la NGUONG VAN HANH cua chinh he
--   thong phat hien (khong co chung thi danh sach "Can xem lai" khong chay
--   duoc), va khung gio dem la mot DINH NGHIA PHAP LY (22:00-06:00 theo Bo
--   luat Lao dong) chu khong phai mot muc gia — van sua duoc, chi la co diem
--   khoi dau dung (D-27).
--
-- `updated_by` KHONG thay the `audit_log`. No chi la loi tat doc nhanh "ai
-- doi lan cuoi"; vet day du (truoc/sau, ly do) van nam o audit_log, ghi boi
-- `logMutation()` ngay trong Server Action (D-17).

/* -------------------------------------------------------------------------- */
/* company_settings                                                            */
/* -------------------------------------------------------------------------- */

create table company_settings (
  -- Khoa chinh la chinh company_id: bat bien "mot doanh nghiep mot dong"
  -- duoc ep bang khoa chinh, khong bang mot unique index thu hai.
  company_id text primary key references companies (id) on delete cascade,

  -- D-29 (dong D-21a): nguong danh dau dang ngo, boi so cua ban kinh diem lam
  -- viec gan nhat. Mac dinh 5 — dung con so ma `suspicious.ts` da dung tu
  -- Phase 3, de hanh vi khong doi voi doanh nghiep chua dong toi cau hinh.
  suspicious_distance_multiplier numeric(5, 2) not null default 5
    check (suspicious_distance_multiplier > 0),

  -- D-29: bien do noi rong hai dau khung gio ca, dung cho tin hieu "ngoai
  -- khung gio ca" cua danh sach can xem lai. Bang 0 la hop le (siet chat het
  -- muc), am thi khong.
  shift_window_grace_minutes int not null default 120
    check (shift_window_grace_minutes >= 0),

  -- D-27: khung gio dem la DINH NGHIA, khong phai he so. Mac dinh theo Bo
  -- luat Lao dong (22:00-06:00) va sua duoc. Hai moc bang nhau se lam khung
  -- dem thanh vo nghia (khong phai 0 phut, cung khong phai 24 gio) nen bi
  -- chan o tang rang buoc.
  night_start_time time not null default '22:00',
  night_end_time time not null default '06:00',

  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users (id) on delete set null,

  check (night_start_time <> night_end_time)
);

/* -------------------------------------------------------------------------- */
/* updated_at do DATABASE dat, khong do tang ung dung                          */
/* -------------------------------------------------------------------------- */
-- Quy uoc thoi gian cua du an (D-19): moi dau thoi gian ghi vao du lieu deu
-- den tu dong ho cua database, khong bao gio tu dong ho cua may nguoi dung.
-- Cot `updated_at` co DEFAULT now() nhung DEFAULT chi ap luc INSERT, nen phai
-- co trigger nay thi lan UPDATE moi lam moi duoc dau thoi gian — neu de tang
-- ung dung gui len thi da mo mot duong cho dong ho client di vao du lieu.

create function public.tf_company_settings_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger company_settings_touch_updated_at
  before update on company_settings
  for each row
  execute function public.tf_company_settings_touch();

/* -------------------------------------------------------------------------- */
/* Backfill — moi doanh nghiep dang ton tai co dung mot dong cau hinh          */
/* -------------------------------------------------------------------------- */
-- `on conflict do nothing` de chay lai migration tren mot database da co du
-- lieu khong tao dong thu hai (khoa chinh la company_id nen trung la bat kha,
-- day chi la lop lam cho phep chay lai tro nen vo hai).

insert into company_settings (company_id)
  select id from companies
  on conflict (company_id) do nothing;

/* -------------------------------------------------------------------------- */
/* RLS — 4 policy PERMISSIVE, dieu kien duy nhat public.tf_is_member           */
/* -------------------------------------------------------------------------- */
-- Nhan rong nguyen ban mau cua 0002/0004/0005. KHONG co policy nao rieng cho
-- vai tro: gioi han "chi owner/admin duoc ghi" nam o tang Server Action
-- (`requireRole`), giong het moi bang khac cua du an — RLS o day la lop phong
-- thu thu hai theo RANH GIOI DOANH NGHIEP, khong phai lop phan quyen theo vai
-- tro.

alter table company_settings enable row level security;

create policy company_settings_select_member on company_settings
  for select
  using (public.tf_is_member(company_id));

create policy company_settings_insert_member on company_settings
  for insert
  with check (public.tf_is_member(company_id));

create policy company_settings_update_member on company_settings
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy company_settings_delete_member on company_settings
  for delete
  using (public.tf_is_member(company_id));

comment on table company_settings is
  'Cau hinh van hanh cua tung doanh nghiep (Phase 4). Mot dong cho mot doanh '
  'nghiep, ep bang khoa chinh. Gia tri nghiep vu doanh nghiep tu quyet (he so '
  'tang ca, ngay le) KHONG nam o day — chung o overtime_rules/holidays va co y '
  'de rong khi khoi tao (D-26).';
