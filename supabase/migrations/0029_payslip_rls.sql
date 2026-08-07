-- 0029_payslip_rls.sql
--
-- SIET RLS BA BANG LUONG truoc khi mo duong doc cho nhan vien (PAY-05).
--
-- ======================================================================
-- (1) VI SAO PHAI SIET, VA VI SAO LA BAY GIO
-- ======================================================================
--
-- 0024 dat `select` tren ca ba bang luong voi dieu kien DUY NHAT
-- `tf_is_member(company_id)`. Nghia la MOI thanh vien cua doanh nghiep doc
-- duoc MOI dong luong — ke ca mot nhan vien doc bang luong cua giam doc.
--
-- Cho toi truoc file nay dieu do chua khai thac duoc, vi khong mot Route
-- Handler nao mo ba bang do cho vai tro ngoai `owner`/`admin`
-- (`/api/payroll/summary` goi `requireRole(role, ['owner','admin'])`). Lop
-- phong thu thu nhat kin, nen lop thu hai khong bi thu thach.
--
-- PAY-05 chinh la thu tao ra duong doc do. Ke tu day, mot loi o tang ung dung
-- khong con duoc lop thu hai do lai — tru khi lop thu hai biet phan biet
-- "dong cua chinh minh" voi "dong cua nguoi khac". Do la viec cua file nay.
--
-- Thu tu co chu dich: SIET TRUOC, mo duong doc SAU.
--
-- ======================================================================
-- (2) DIEU KIEN MOI: QUAN TRI THI CA CONG TY, CON LAI THI CHINH MINH
-- ======================================================================
--
--   owner/admin  -> moi dong cua doanh nghiep (bang luong la cong viec cua ho)
--   con lai      -> chi dong co `employee_id` tro ve `employees.user_id`
--                   bang `auth.uid()`
--
-- `manager` NAM O VE THU HAI. Duyet mot cap chi cho `owner`/`admin` (D-30), va
-- xem luong cua cap duoi khong nam trong pham vi da quyet — mot `manager` o
-- day chi la mot nguoi lam cong co them quyen duyet, khong phai mot nguoi lam
-- luong.
--
-- `payroll_runs` KHONG co `employee_id`. Dieu kien cua no la "co it nhat mot
-- dong luong cua chinh minh trong ban chot nay" — nho vay nhan vien doc duoc
-- ngay chot cua ky co phieu cua ho, va khong thay ky nao khong lien quan.
--
-- ======================================================================
-- (3) GHI/XOA GIU NGUYEN
-- ======================================================================
--
-- `insert`/`update`/`delete` van la `tf_is_member`. Ba ly do:
--   - duong ghi duy nhat o tang ung dung la `closePayroll`/`reopenPayroll`, ca
--     hai da goi `requireRole(role, ['owner','admin'])`;
--   - `update` da bi trigger `tf_payroll_immutable()` chan hoan toan (0024),
--     nen policy `update` co noi long cung khong ghi duoc gi;
--   - siet them o day se lam file nay dong hai viec, va viec thu hai khong
--     duoc test nao cua PAY-05 cham toi.
--
-- ======================================================================
-- (4) GIOI HAN GHI RO
-- ======================================================================
--
-- Khoa `service_role` legacy VAN bo qua toan bo RLS (rui ro da duoc chap nhan
-- co y thuc — xem REQUIREMENTS.md/PROJECT.md §Out of Scope). RLS o day la lop
-- phong thu THU HAI, khong phai lop duy nhat: chan chan van la
-- `getSessionContext()` + pham vi mac dinh o Route Handler.
--
-- (5) FILE NAY CHAY LAI DUOC MA VO HAI — khuon 0018/0021/0022/0023/0024.

/* -------------------------------------------------------------------------- */
/* (a) tf_is_company_admin — vai tro lam luong cua mot doanh nghiep            */
/* -------------------------------------------------------------------------- */

-- SECURITY DEFINER va TU LOC theo `auth.uid()` ben trong — KHONG nhan
-- `user_id` tu tham so. Day la cung mot rang buoc da ghi o `tf_is_member`
-- (0002, threat T-01-03): mot ham nhan `user_id` tu ben ngoai la mot ham cho
-- phep ke goi tu khai minh la ai.
--
-- Ranh gioi `owner`/`admin` TRUNG voi `ADMIN_AREA_ROLES` va `isAdminRole` da
-- dung o moi Route Handler — khong phai mot danh sach vai tro thu hai.

create or replace function public.tf_is_company_admin(p_company_id text)
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
      and role in ('owner', 'admin')
  );
$$;

comment on function public.tf_is_company_admin(text) is
  'Nguoi goi co phai owner/admin dang hoat dong cua doanh nghiep nay khong. '
  'Tu loc theo auth.uid() ben trong — khuon tf_is_member (0002).';

revoke execute on function public.tf_is_company_admin(text) from public;
grant execute on function public.tf_is_company_admin(text) to authenticated;

/* -------------------------------------------------------------------------- */
/* (b) tf_owns_payroll_line — dong luong nay co phai cua nguoi goi khong       */
/* -------------------------------------------------------------------------- */

-- Tach rieng thay vi viet thang subquery vao ba policy: mot dieu kien duoc
-- nhac ba lan la mot dieu kien se bi sua o hai cho.

create or replace function public.tf_owns_payroll_line(p_employee_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from employees
    where id = p_employee_id
      and user_id = (select auth.uid())
  );
$$;

comment on function public.tf_owns_payroll_line(text) is
  'Dong luong cua employee_id nay co thuoc ve chinh nguoi goi khong (PAY-05). '
  'Tu loc theo auth.uid() — khong nhan user_id tu tham so.';

revoke execute on function public.tf_owns_payroll_line(text) from public;
grant execute on function public.tf_owns_payroll_line(text) to authenticated;

/* -------------------------------------------------------------------------- */
/* (c) Thay ba policy `select`                                                 */
/* -------------------------------------------------------------------------- */

-- Bo ca ten cu LAN ten moi truoc khi tao: file phai chay lai duoc ma vo hai,
-- va tren mot database da chay 0029 mot lan thi ten cu khong con ton tai.

drop policy if exists payroll_runs_select_member on payroll_runs;
drop policy if exists payroll_runs_select_scoped on payroll_runs;

create policy payroll_runs_select_scoped on payroll_runs
  for select using (
    public.tf_is_company_admin(company_id)
    or exists (
      select 1
      from payroll_lines line
      where line.run_id = payroll_runs.id
        and public.tf_owns_payroll_line(line.employee_id)
    )
  );

drop policy if exists payroll_lines_select_member on payroll_lines;
drop policy if exists payroll_lines_select_scoped on payroll_lines;

create policy payroll_lines_select_scoped on payroll_lines
  for select using (
    public.tf_is_company_admin(company_id)
    or public.tf_owns_payroll_line(employee_id)
  );

drop policy if exists payroll_line_items_select_member on payroll_line_items;
drop policy if exists payroll_line_items_select_scoped on payroll_line_items;

create policy payroll_line_items_select_scoped on payroll_line_items
  for select using (
    public.tf_is_company_admin(company_id)
    or exists (
      select 1
      from payroll_lines line
      where line.id = payroll_line_items.line_id
        and public.tf_owns_payroll_line(line.employee_id)
    )
  );

/* -------------------------------------------------------------------------- */
/* (d) Index ho tro dieu kien moi                                              */
/* -------------------------------------------------------------------------- */

-- `tf_owns_payroll_line` tra cuu `employees` theo `id` (da la khoa chinh)
-- nhung loc them `user_id`; va `getSessionContext()` cung tra cuu
-- `employees` theo `user_id`. Mot index tren `user_id` phuc vu ca hai.
create index if not exists employees_user_id_idx on employees (user_id);
