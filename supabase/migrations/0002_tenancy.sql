-- 0002_tenancy.sql
--
-- Bang companies + memberships va RLS co lap doanh nghiep. Day la lat cat
-- xuyen suot dau tien cua Phase 1 — moi bang thuoc pham vi doanh nghiep o
-- cac plan sau deu lap lai dung mau policy nay (xem
-- .planning/research/ARCHITECTURE.md §"Pattern 3").
--
-- Khong dung `current_setting('app.company_id')` hay bat ky bien phien
-- Postgres nao khac — pooler cua Supabase khong bao dam pham vi bien phien
-- (§"Anti-Pattern 2"). Dieu kien duy nhat suy tu quan he thanh vien qua
-- `auth.uid()`.

create type company_role as enum ('owner', 'admin', 'manager', 'employee');
create type company_size as enum ('1-10', '11-30', '31-100', '101-500', '500+');
create type company_accent as enum ('indigo', 'navy', 'ruby', 'cream');
create type membership_status as enum ('active', 'inactive');

/* -------------------------------------------------------------------------- */
/* Bang                                                                        */
/* -------------------------------------------------------------------------- */

create table companies (
  id text primary key,
  name text not null,
  code text not null,
  industry text not null,
  size company_size not null,
  phone text not null,
  address text not null,
  accent company_accent not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Cot `role`, `employeeCount`, `lastAccessedAt` cua interface Company khong
-- thanh cot: chung phu thuoc nguoi dang dang nhap, se suy tu `memberships`
-- va phep dem o tang truy van, khong luu tinh trang.

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id text not null references companies (id) on delete cascade,
  role company_role not null,
  status membership_status not null default 'active',
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index memberships_company_id_idx on memberships (company_id);
create index memberships_user_id_idx on memberships (user_id);

/* -------------------------------------------------------------------------- */
/* Ham kiem tra thanh vien                                                     */
/* -------------------------------------------------------------------------- */

-- SECURITY DEFINER de policy tren `companies` doc duoc `memberships` du RLS
-- cua `memberships` co the chan truy van truc tiep; tu ham phai tu loc theo
-- nguoi goi bang auth.uid() ben trong, khong nhan user_id tu tham so, neu
-- khong se mo cua cho ke tan cong truyen user_id bat ky (threat T-01-03).
create function public.tf_is_member(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from memberships
    where company_id = p_company_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

revoke execute on function public.tf_is_member(text) from public;
grant execute on function public.tf_is_member(text) to authenticated;

/* -------------------------------------------------------------------------- */
/* RLS: companies                                                              */
/* -------------------------------------------------------------------------- */

alter table companies enable row level security;

create policy companies_select_member on companies
  for select
  using (public.tf_is_member(id));

create policy companies_insert_member on companies
  for insert
  with check (public.tf_is_member(id));

create policy companies_update_member on companies
  for update
  using (public.tf_is_member(id))
  with check (public.tf_is_member(id));

create policy companies_delete_member on companies
  for delete
  using (public.tf_is_member(id));

/* -------------------------------------------------------------------------- */
/* RLS: memberships                                                            */
/* -------------------------------------------------------------------------- */

alter table memberships enable row level security;

-- Chinh nguoi dung luon doc duoc dong membership cua chinh minh (ke ca khi
-- status = 'inactive'), cong voi moi dong thuoc doanh nghiep ho dang la
-- thanh vien active.
create policy memberships_select_member on memberships
  for select
  using (
    user_id = (select auth.uid())
    or public.tf_is_member(company_id)
  );

create policy memberships_insert_member on memberships
  for insert
  with check (public.tf_is_member(company_id));

create policy memberships_update_member on memberships
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy memberships_delete_member on memberships
  for delete
  using (public.tf_is_member(company_id));
