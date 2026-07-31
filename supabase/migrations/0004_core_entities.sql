-- 0004_core_entities.sql
--
-- Nam thuc the con lai cua V1 (`departments`, `shifts`, `employees`,
-- `attendance_records`, `work_requests`), nhan rong dung mau RLS da chung
-- minh o 0002_tenancy.sql: moi bang bon policy PERMISSIVE, dieu kien duy
-- nhat la public.tf_is_member(company_id). Cot va kieu du lieu anh xa tu
-- src/lib/types/domain.ts (nguon chuan cho schema).
--
-- `departments.manager_id` va `employees.manager_id` deu tro toi
-- employees(id) nhung `departments` duoc tao truoc `employees`; hai khoa
-- ngoai do them o cuoi file bang `alter table ... add constraint`,
-- deferrable initially deferred, de seed chen duoc theo thu tu cong ty ->
-- phong ban -> ca -> nhan vien ma khong vuong tham chieu tien (yeu cau tham
-- chieu tien phai nam trong CUNG mot transaction, xem seed.sql).

/* -------------------------------------------------------------------------- */
/* departments                                                                 */
/* -------------------------------------------------------------------------- */

create table departments (
  id text primary key,
  company_id text not null references companies (id) on delete cascade,
  name text not null,
  description text not null,
  manager_id text null,
  status department_status not null default 'active'
);

/* -------------------------------------------------------------------------- */
/* shifts                                                                      */
/* -------------------------------------------------------------------------- */

create table shifts (
  id text primary key,
  company_id text not null references companies (id) on delete cascade,
  name text not null,
  code text not null,
  start_time time not null,
  end_time time not null,
  break_minutes int not null default 0 check (break_minutes >= 0),
  late_tolerance_minutes int not null default 0 check (late_tolerance_minutes >= 0),
  -- Sinh tu so sanh gio thuc cua ca, khong the lech khoi start_time/end_time
  -- that duoc luu — cung dieu kien voi public.tf_overnight().
  overnight boolean generated always as (end_time < start_time) stored,
  working_days smallint[] not null check (
    working_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    and array_length(working_days, 1) between 1 and 7
  ),
  status shift_status not null default 'active',
  -- Ca do dai 0 khong phai trang thai nghiep vu hop le.
  check (start_time <> end_time)
);

/* -------------------------------------------------------------------------- */
/* employees                                                                   */
/* -------------------------------------------------------------------------- */

create table employees (
  id text primary key,
  company_id text not null references companies (id) on delete cascade,
  code text not null,
  full_name text not null,
  email text not null,
  phone text not null,
  date_of_birth date not null,
  gender gender not null,
  avatar_url text null,
  department_id text not null references departments (id),
  position text not null,
  contract_type contract_type not null,
  start_date date not null,
  manager_id text null,
  shift_id text not null references shifts (id),
  work_location text not null,
  status employee_status not null,
  system_role system_role not null,
  invitation_sent boolean not null default false,
  can_view_payslip boolean not null default false,
  can_check_in_remotely boolean not null default false,
  -- Chua co trong domain.ts — noi Phase 2 gan tai khoan Supabase Auth vao
  -- nhan vien. NULL cho toi khi nhan vien nhan loi moi va dang nhap.
  user_id uuid null references auth.users (id) on delete set null,
  unique (company_id, code)
);

/* -------------------------------------------------------------------------- */
/* attendance_records                                                          */
/* -------------------------------------------------------------------------- */

create table attendance_records (
  id text primary key,
  company_id text not null references companies (id) on delete cascade,
  employee_id text not null references employees (id) on delete cascade,
  work_date date not null,
  shift_id text not null references shifts (id),
  check_in_at timestamptz null,
  check_out_at timestamptz null,
  worked_minutes int not null default 0 check (worked_minutes >= 0),
  late_minutes int not null default 0 check (late_minutes >= 0),
  early_leave_minutes int not null default 0 check (early_leave_minutes >= 0),
  status attendance_status not null,
  location text not null,
  needs_supplement boolean not null default false,
  note text null,
  unique (employee_id, work_date, shift_id),
  -- D-08 ep o tang database: khi da cham vao, ngay cong phai la ngay theo
  -- gio VN cua chinh khoanh khac cham vao (tf_work_date), khong phai ngay
  -- lich cua check_out_at.
  check (check_in_at is null or work_date = public.tf_work_date(check_in_at))
);

/* -------------------------------------------------------------------------- */
/* work_requests                                                               */
/* -------------------------------------------------------------------------- */

create table work_requests (
  id text primary key,
  company_id text not null references companies (id) on delete cascade,
  employee_id text not null references employees (id) on delete cascade,
  type request_type not null,
  status request_status not null default 'pending',
  from_date date not null,
  to_date date not null,
  -- Chi dung cho attendance_supplement / time_adjustment.
  from_time time null,
  to_time time null,
  reason text not null,
  created_at timestamptz not null default now(),
  reviewer_id text null references employees (id),
  review_note text null,
  reviewed_at timestamptz null,
  check (to_date >= from_date)
);

/* -------------------------------------------------------------------------- */
/* Khoa ngoai tu tham chieu — deferred vi tham chieu tien khi seed             */
/* -------------------------------------------------------------------------- */

alter table departments
  add constraint departments_manager_id_fkey
  foreign key (manager_id) references employees (id)
  deferrable initially deferred;

alter table employees
  add constraint employees_manager_id_fkey
  foreign key (manager_id) references employees (id)
  deferrable initially deferred;

/* -------------------------------------------------------------------------- */
/* Index — cot ma policy tham chieu, cong them index cho truy van nong        */
/* -------------------------------------------------------------------------- */

create index departments_company_id_idx on departments (company_id);
create index shifts_company_id_idx on shifts (company_id);
create index employees_company_id_idx on employees (company_id);
-- Truy van phan trang cua Phase 2 can thu tu on dinh ke ca khi hai nhan vien
-- trung ten — id lam tiebreaker cuoi cung.
create index employees_company_id_full_name_id_idx on employees (company_id, full_name, id);
create index employees_company_id_department_id_idx on employees (company_id, department_id);
create index attendance_records_company_id_idx on attendance_records (company_id);
create index attendance_records_company_id_employee_id_work_date_idx
  on attendance_records (company_id, employee_id, work_date);
create index work_requests_company_id_idx on work_requests (company_id);
create index work_requests_company_id_status_created_at_idx
  on work_requests (company_id, status, created_at desc);

/* -------------------------------------------------------------------------- */
/* RLS — 4 policy PERMISSIVE moi bang, dieu kien duy nhat public.tf_is_member */
/* -------------------------------------------------------------------------- */

alter table departments enable row level security;

create policy departments_select_member on departments
  for select
  using (public.tf_is_member(company_id));

create policy departments_insert_member on departments
  for insert
  with check (public.tf_is_member(company_id));

create policy departments_update_member on departments
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy departments_delete_member on departments
  for delete
  using (public.tf_is_member(company_id));

alter table shifts enable row level security;

create policy shifts_select_member on shifts
  for select
  using (public.tf_is_member(company_id));

create policy shifts_insert_member on shifts
  for insert
  with check (public.tf_is_member(company_id));

create policy shifts_update_member on shifts
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy shifts_delete_member on shifts
  for delete
  using (public.tf_is_member(company_id));

alter table employees enable row level security;

create policy employees_select_member on employees
  for select
  using (public.tf_is_member(company_id));

create policy employees_insert_member on employees
  for insert
  with check (public.tf_is_member(company_id));

create policy employees_update_member on employees
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy employees_delete_member on employees
  for delete
  using (public.tf_is_member(company_id));

alter table attendance_records enable row level security;

create policy attendance_records_select_member on attendance_records
  for select
  using (public.tf_is_member(company_id));

create policy attendance_records_insert_member on attendance_records
  for insert
  with check (public.tf_is_member(company_id));

create policy attendance_records_update_member on attendance_records
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy attendance_records_delete_member on attendance_records
  for delete
  using (public.tf_is_member(company_id));

alter table work_requests enable row level security;

create policy work_requests_select_member on work_requests
  for select
  using (public.tf_is_member(company_id));

create policy work_requests_insert_member on work_requests
  for insert
  with check (public.tf_is_member(company_id));

create policy work_requests_update_member on work_requests
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy work_requests_delete_member on work_requests
  for delete
  using (public.tf_is_member(company_id));
