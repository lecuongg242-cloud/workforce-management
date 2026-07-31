-- 0005_v2_tables.sql
--
-- Sau bang moi cua V2 ma src/lib/types/domain.ts chua co: work_sites,
-- attendance_photos, holidays, overtime_rules, audit_log, periods. Day la
-- "bang cua phase sau" (Phase 3 dung work_sites/attendance_photos, Phase 4
-- dung holidays/overtime_rules, Phase 5 dung periods, Phase 2 tro di dung
-- audit_log) — dung ngay bay gio, duoi cung cong RLS voi 0004_core_entities,
-- de khong phase nao phai nho bat RLS ve sau. Nhan rong dung mau policy
-- <bang>_<lenh>_member, dieu kien duy nhat public.tf_is_member(company_id).

/* -------------------------------------------------------------------------- */
/* Enum moi                                                                    */
/* -------------------------------------------------------------------------- */

create type period_status as enum ('open', 'closed');
create type photo_review_status as enum ('pending', 'approved', 'rejected');
create type audit_action as enum ('insert', 'update', 'delete');

/* -------------------------------------------------------------------------- */
/* work_sites                                                                  */
/* -------------------------------------------------------------------------- */

create table work_sites (
  id text primary key,
  company_id text not null references companies (id) on delete cascade,
  name text not null,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  radius_meters int not null check (radius_meters > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

/* -------------------------------------------------------------------------- */
/* attendance_photos                                                          */
/* -------------------------------------------------------------------------- */

create table attendance_photos (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  attendance_record_id text not null references attendance_records (id) on delete cascade,
  kind text not null check (kind in ('check_in', 'check_out')),
  storage_path text not null,
  captured_at timestamptz not null,
  latitude numeric(9, 6) null,
  longitude numeric(9, 6) null,
  review_status photo_review_status not null default 'pending',
  reviewed_by uuid null references auth.users (id),
  reviewed_at timestamptz null,
  unique (attendance_record_id, kind),
  -- Tien to duong dan phai bat dau bang chinh company_id cua dong nay, de
  -- policy tren storage.objects o Phase 3 dung lai duoc cung ranh gioi thay
  -- vi phai nghi ra mo hinh thu hai (Pitfall 6).
  check (storage_path like company_id || '/%')
);

/* -------------------------------------------------------------------------- */
/* holidays — co y de rong khi doanh nghiep moi khoi tao, khong chen san      */
/* -------------------------------------------------------------------------- */

create table holidays (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  holiday_date date not null,
  name text not null,
  unique (company_id, holiday_date)
);

/* -------------------------------------------------------------------------- */
/* overtime_rules — khong he so nao nhung cung mac dinh trong DDL             */
/* -------------------------------------------------------------------------- */

create table overtime_rules (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  rule_key text not null check (rule_key in ('weekday', 'weekend', 'holiday', 'night')),
  multiplier numeric(4, 2) not null check (multiplier > 0),
  effective_from date not null,
  unique (company_id, rule_key, effective_from)
);

/* -------------------------------------------------------------------------- */
/* audit_log — company_id nullable de Phase 6 ghi duoc thao tac super admin   */
/* khong thuoc doanh nghiep nao; dong company_id NULL khong lot qua policy    */
/* thanh vien nen khong nguoi dung doanh nghiep nao doc duoc — dung y muon.   */
/* -------------------------------------------------------------------------- */

create table audit_log (
  id bigint primary key generated always as identity,
  company_id text null references companies (id) on delete set null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  action audit_action not null,
  entity_table text not null,
  entity_id text null,
  before jsonb null,
  after jsonb null,
  reason text null,
  created_at timestamptz not null default now()
);

/* -------------------------------------------------------------------------- */
/* periods — ky cong bi ep tron thang duong lich (D-09), mot tuong minh       */
/* -------------------------------------------------------------------------- */

create table periods (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status period_status not null default 'open',
  closed_at timestamptz null,
  closed_by uuid null references auth.users (id),
  unique (company_id, start_date),
  check (end_date >= start_date),
  -- D-09: ky cong phai la tron mot thang duong lich. Van luu hai moc tuong
  -- minh de doi quy uoc ve sau khong phai doi schema.
  check (
    start_date = date_trunc('month', start_date)::date
    and end_date = (date_trunc('month', start_date) + interval '1 month - 1 day')::date
  )
);

/* -------------------------------------------------------------------------- */
/* Index                                                                       */
/* -------------------------------------------------------------------------- */

create index work_sites_company_id_idx on work_sites (company_id);
create index attendance_photos_company_id_idx on attendance_photos (company_id);
create index attendance_photos_company_id_attendance_record_id_idx
  on attendance_photos (company_id, attendance_record_id);
create index holidays_company_id_idx on holidays (company_id);
create index holidays_company_id_holiday_date_idx on holidays (company_id, holiday_date);
create index overtime_rules_company_id_idx on overtime_rules (company_id);
create index overtime_rules_company_id_rule_key_effective_from_idx
  on overtime_rules (company_id, rule_key, effective_from desc);
create index audit_log_company_id_idx on audit_log (company_id);
create index audit_log_company_id_created_at_idx on audit_log (company_id, created_at desc);
create index periods_company_id_idx on periods (company_id);
create index periods_company_id_status_idx on periods (company_id, status);

/* -------------------------------------------------------------------------- */
/* RLS — 4 policy PERMISSIVE moi bang, dieu kien duy nhat public.tf_is_member */
/* -------------------------------------------------------------------------- */

alter table work_sites enable row level security;

create policy work_sites_select_member on work_sites
  for select
  using (public.tf_is_member(company_id));

create policy work_sites_insert_member on work_sites
  for insert
  with check (public.tf_is_member(company_id));

create policy work_sites_update_member on work_sites
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy work_sites_delete_member on work_sites
  for delete
  using (public.tf_is_member(company_id));

alter table attendance_photos enable row level security;

create policy attendance_photos_select_member on attendance_photos
  for select
  using (public.tf_is_member(company_id));

create policy attendance_photos_insert_member on attendance_photos
  for insert
  with check (public.tf_is_member(company_id));

create policy attendance_photos_update_member on attendance_photos
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy attendance_photos_delete_member on attendance_photos
  for delete
  using (public.tf_is_member(company_id));

alter table holidays enable row level security;

create policy holidays_select_member on holidays
  for select
  using (public.tf_is_member(company_id));

create policy holidays_insert_member on holidays
  for insert
  with check (public.tf_is_member(company_id));

create policy holidays_update_member on holidays
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy holidays_delete_member on holidays
  for delete
  using (public.tf_is_member(company_id));

alter table overtime_rules enable row level security;

create policy overtime_rules_select_member on overtime_rules
  for select
  using (public.tf_is_member(company_id));

create policy overtime_rules_insert_member on overtime_rules
  for insert
  with check (public.tf_is_member(company_id));

create policy overtime_rules_update_member on overtime_rules
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy overtime_rules_delete_member on overtime_rules
  for delete
  using (public.tf_is_member(company_id));

alter table audit_log enable row level security;

create policy audit_log_select_member on audit_log
  for select
  using (public.tf_is_member(company_id));

create policy audit_log_insert_member on audit_log
  for insert
  with check (public.tf_is_member(company_id));

create policy audit_log_update_member on audit_log
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy audit_log_delete_member on audit_log
  for delete
  using (public.tf_is_member(company_id));

alter table periods enable row level security;

create policy periods_select_member on periods
  for select
  using (public.tf_is_member(company_id));

create policy periods_insert_member on periods
  for insert
  with check (public.tf_is_member(company_id));

create policy periods_update_member on periods
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy periods_delete_member on periods
  for delete
  using (public.tf_is_member(company_id));
