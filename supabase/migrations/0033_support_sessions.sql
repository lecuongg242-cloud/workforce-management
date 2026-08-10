-- 0033_support_sessions.sql
--
-- Phien ho tro co thoi han (D-49). Quyen doc xuyen doanh nghiep cua platform
-- admin suy tu MOT PHIEN, khong suy tu danh tinh: mot policy
-- `or tf_is_platform_admin()` gan thang vao 23 bang chinh la "quyen vuot RLS
-- dung chung" ma tieu chi 4 cua Phase 6 loai tru — mot lan dang nhap la thay
-- moi doanh nghiep, mai mai, khong ranh gioi thoi gian, khong ly do, khong vet.
--
-- Bang nay CHINH LA nhat ky cua SADM-03 (D-55) — khong dung co che thu hai.
--
-- Migration nay CHI khai bao ha tang cua phien. Viec mo nhanh doc tren 22
-- bang nghiep vu nam o 0034_support_read_access.sql, tach ra de mot lan
-- `git revert` go duoc quyen doc ma khong go mat bang nhat ky.

/* -------------------------------------------------------------------------- */
/* (a) Bang                                                                    */
/* -------------------------------------------------------------------------- */

create table support_sessions (
  id uuid primary key default gen_random_uuid(),
  platform_admin_id uuid not null references auth.users (id) on delete cascade,
  company_id text not null references companies (id) on delete cascade,
  -- `reason` not null va KHONG co gia tri mac dinh: mot phien khong ly do la
  -- mot dong nhat ky khong tra loi duoc cau hoi duy nhat nguoi ta hoi no.
  reason text not null,
  opened_at timestamptz not null default now(),
  expires_at timestamptz not null,
  closed_at timestamptz null,
  constraint support_sessions_expires_after_open check (expires_at > opened_at)
);

create index support_sessions_company_id_opened_at_idx
  on support_sessions (company_id, opened_at desc);

-- Index phuc vu dung truy van nong nhat cua he thong: tf_has_support_access()
-- chay MOT LAN CHO MOI DONG duoc kiem trong moi policy select da mo nhanh.
create index support_sessions_admin_open_idx
  on support_sessions (platform_admin_id, expires_at)
  where closed_at is null;

/* -------------------------------------------------------------------------- */
/* (b) Ham kiem tra — cung khuon bao ve tf_is_member (0002_tenancy.sql:63-77) */
/* -------------------------------------------------------------------------- */

-- KHONG nhan tham so user: nhan user_id tu ben ngoai se mo cua cho ke tan
-- cong truyen user_id bat ky (cung threat T-01-03 ma tf_is_member da ghi).
-- Ham tu loc theo auth.uid(), boc trong (select ...) de planner cache duoc
-- gia tri trong cung mot cau lenh.
--
-- So `now() < expires_at` MOI LAN GOI nghia la phien TU CHET o tang database:
-- khong tien trinh nen nao phai chay de thu hoi quyen, va khong co khoanh
-- khac nao giua "het han" va "mat quyen".
create function public.tf_has_support_access(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from support_sessions
    where company_id = p_company_id
      and platform_admin_id = (select auth.uid())
      and closed_at is null
      and now() < expires_at
  );
$$;

revoke execute on function public.tf_has_support_access(text) from public;
grant execute on function public.tf_has_support_access(text) to authenticated;

/* -------------------------------------------------------------------------- */
/* (c) RLS cua chinh bang support_sessions                                     */
/* -------------------------------------------------------------------------- */

alter table support_sessions enable row level security;

-- Doc: platform admin doc duoc moi dong; VA thanh vien doanh nghiep doc duoc
-- dong cua doanh nghiep MINH. Ve thu hai la TINH NANG chu khong phai ro ri:
-- khach hang co quyen biet doi van hanh da vao du lieu cua ho luc nao.
--
-- He qua phai biet truoc: vi policy nay cho platform admin doc MOI dong,
-- moi cho o tang ung dung can "phien cua chinh toi" deu phai tu loc
-- `platform_admin_id = auth.uid()`, khong duoc pho mac cho RLS.
create policy support_sessions_select_admin_or_member on support_sessions
  for select
  using (
    public.tf_is_platform_admin()
    or public.tf_is_member(company_id)
  );

-- Ghi: chi platform admin, va chi dong mang ten CHINH MINH.
create policy support_sessions_insert_platform_admin on support_sessions
  for insert
  with check (
    public.tf_is_platform_admin()
    and platform_admin_id = (select auth.uid())
  );

-- Cap nhat: de dat `closed_at`. Dieu kien platform_admin_id co mat o CA
-- `using` lan `with check` nen khong ai doi duoc chu so huu cua mot dong.
create policy support_sessions_update_own on support_sessions
  for update
  using (
    public.tf_is_platform_admin()
    and platform_admin_id = (select auth.uid())
  )
  with check (
    public.tf_is_platform_admin()
    and platform_admin_id = (select auth.uid())
  );

-- KHONG CO policy delete — nhat ky khong xoa duoc. RLS bat ma khong co policy
-- cho mot lenh nghia la lenh do bi tu choi mac dinh (cung khuon D-11a).

/* -------------------------------------------------------------------------- */
/* (d) audit_log: gia tri enum moi + duong ghi cho phien ho tro (D-55)        */
/* -------------------------------------------------------------------------- */

-- `access` la hanh dong thu tu ben canh insert/update/delete: doi van hanh
-- KHONG doi du lieu, ho DOC no — va chinh viec doc do la thu can ghi vet.
-- Migration nay chi KHAI BAO gia tri, khong dung no o cau lenh nao khac, nen
-- khong vuong rang buoc "khong dung gia tri enum moi trong cung transaction".
alter type audit_action add value if not exists 'access';

-- Policy `audit_log_insert_member` (0005) doi tf_is_member(company_id) nen
-- platform admin (khong la thanh vien doanh nghiep nao) khong lot qua. Duong
-- ghi rieng nay chi mo cho DUNG doanh nghiep dang co phien con han.
create policy audit_log_insert_support on audit_log
  for insert
  with check (public.tf_has_support_access(company_id));
