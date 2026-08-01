-- 0006_platform_admins.sql
--
-- Vai tro nen tang thu tu (D-11): platform admin. Ba vai tro doanh nghiep
-- hien co (owner/admin/manager/employee, xem enum company_role o
-- 0002_tenancy.sql) deu gan voi mot company_id cu the qua `memberships`.
-- Platform admin KHONG gan voi company nao — day la nguoi van hanh TimeFlow,
-- khong phai thanh vien mot doanh nghiep khach hang. Vi vay khong them gia
-- tri vao enum company_role (se sai vi enum do gan voi memberships.company_id);
-- thay vao do dung mot bang rieng + mot ham kiem tra rieng, nhan ban dung
-- khuon bao ve cua tf_is_member o 0002_tenancy.sql dong 60-77.
--
-- Bang nay phai co mat truoc khi tang kiem quyen cua Phase 2 duoc viet
-- (xem 02-02-PLAN.md <objective>) — them vai tro thu tu sau khi moi guard da
-- viet xong nghia la mo lai tung guard, D-11 goi day la "costly".
--
-- Gioi han kiem chung o phase nay (D-11, ghi lai de SUMMARY khong phong dai):
-- chi chung minh duoc "ham tra dung true/false". "Platform admin thay dung
-- cai duoc phep thay" chua co duong doc nao de chung minh va se doi Phase 6.

/* -------------------------------------------------------------------------- */
/* (a) Bang                                                                    */
/* -------------------------------------------------------------------------- */

-- Dung hai cot theo D-11 — khong them `note`/`granted_by`/`is_active` "de sau
-- nay dung". user_id lam khoa chinh vi mot nguoi chi co the la platform admin
-- mot lan (khong co khai niem "nhieu dong platform admin cho cung mot nguoi").
create table platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

/* -------------------------------------------------------------------------- */
/* (b) Ham kiem tra — khong tham so, tu loc theo auth.uid() (D-11b)           */
/* -------------------------------------------------------------------------- */

-- Khac tf_is_member(text): ham nay KHONG nhan tham so user. Nhan user_id lam
-- tham so se mo cua cho ke tan cong truyen user_id bat ky (cung threat
-- T-01-03 nhu tf_is_member da ghi o 0002_tenancy.sql) — vi vay ham tu loc
-- theo nguoi goi thuc su qua auth.uid() ben trong. SECURITY DEFINER de ham
-- doc duoc platform_admins du RLS cua bang do chan doc truc tiep (xem muc d).
-- auth.uid() boc trong (select ...) dung nhu tf_is_member de planner cache
-- duoc gia tri trong cung mot cau lenh.
create function public.tf_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from platform_admins
    where user_id = (select auth.uid())
  );
$$;

/* -------------------------------------------------------------------------- */
/* (c) Quyen thuc thi (D-11b)                                                  */
/* -------------------------------------------------------------------------- */

revoke execute on function public.tf_is_platform_admin() from public;
grant execute on function public.tf_is_platform_admin() to authenticated;

/* -------------------------------------------------------------------------- */
/* (d) RLS chan het (D-11a)                                                    */
/* -------------------------------------------------------------------------- */

alter table platform_admins enable row level security;

-- Khong policy nao cho INSERT/UPDATE/DELETE — RLS bat ma khong co policy cho
-- mot lenh nghia la lenh do bi tu choi mac dinh, dung dieu D-11a muon.
-- Policy SELECT `using (false)` duoi day CHI ton tai de
-- supabase/tests/00_rls_coverage.sql khong do o nhanh "bat RLS ma 0 policy" —
-- day KHONG PHAI policy cho phep doc, khong ai (ke ca chinh nguoi co ten
-- trong bang) doc truc tiep duoc mot dong nao cua bang nay. Moi cau tra loi
-- "toi co phai platform admin khong" phai di qua tf_is_platform_admin().
create policy platform_admins_select_none on platform_admins
  for select
  using (false);
