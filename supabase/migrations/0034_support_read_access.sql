-- 0034_support_read_access.sql
--
-- Mo nhanh doc cho phien ho tro (D-50). CHI lenh SELECT. Ba lenh ghi giu
-- nguyen `tf_is_member` — do la cho tieu chi 4 cua Phase 6 duoc thoa o TANG
-- DATABASE, khong phai bang mot loi hua o tang ung dung.
--
-- KHONG doi:
--   - `notifications`: RLS theo NGUOI NHAN chu khong theo doanh nghiep (D-34)
--     — doi ho tro khong co viec gi voi hop thong bao ca nhan cua mot nhan vien.
--   - `platform_admins`: D-11a giu nguyen chan doc truc tiep, moi cau tra loi
--     van di qua tf_is_platform_admin().
--
-- Bo test co lap cua Phase 1 (01/03/04_isolation_*.sql) chay lai KHONG SUA
-- mot assertion nao: tai khoan trong do khong nam trong platform_admins nen
-- tf_has_support_access tra false o moi nhanh, va `or false` khong doi ket
-- qua cua bat ky phep doc nao.

/* -------------------------------------------------------------------------- */
/* (a) 19 policy *_select_member dung dung khuon tf_is_member(company_id)      */
/* -------------------------------------------------------------------------- */

-- companies scope theo chinh khoa chinh `id`, khong phai cot `company_id`.
alter policy companies_select_member on companies
  using (public.tf_is_member(id) or public.tf_has_support_access(id));

alter policy memberships_select_member on memberships
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy departments_select_member on departments
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy employees_select_member on employees
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy shifts_select_member on shifts
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy attendance_records_select_member on attendance_records
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy work_sites_select_member on work_sites
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy attendance_photos_select_member on attendance_photos
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy holidays_select_member on holidays
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy overtime_rules_select_member on overtime_rules
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy employee_overtime_rates_select_member on employee_overtime_rates
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy company_settings_select_member on company_settings
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy audit_log_select_member on audit_log
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy periods_select_member on periods
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy work_requests_select_member on work_requests
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy request_reviews_select_member on request_reviews
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy pay_adjustments_select_member on pay_adjustments
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy pay_adjustment_scopes_select_member on pay_adjustment_scopes
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy employee_pay_rates_select_member on employee_pay_rates
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

/* -------------------------------------------------------------------------- */
/* (a2) Bon bang luong — dieu kien KHAC HAN, chep nguyen roi them mot nhanh    */
/* -------------------------------------------------------------------------- */

-- CANH BAO cho nguoi sua file nay ve sau: `alter policy ... using (...)` THAY
-- THE toan bo bieu thuc, khong bo sung vao no. Bon bang duoi day KHONG dung
-- `tf_is_member` — 0029 (PAY-05) da thay ba policy `*_select_member` bang
-- `*_select_scoped` voi dieu kien CHAT HON (`tf_is_company_admin` thay vi moi
-- thanh vien) cong mot nhanh cho nhan vien xem phieu luong CUA CHINH MINH, va
-- 0030 nhan ban khuon do cho bang thu tu. Ap khuon chung o tren vao day se
-- am tham NOI quyen doc bang luong tu "chi quan tri" thanh "moi thanh vien" —
-- mot lo hong lang le, khong phai mot loi bao do.
--
-- Vi vay ba nhanh cu duoc CHEP NGUYEN VAN tu 0029/0030, chi them dung mot
-- dong `or public.tf_has_support_access(company_id)`.

alter policy payroll_runs_select_scoped on payroll_runs
  using (
    public.tf_is_company_admin(company_id)
    or public.tf_has_support_access(company_id)
    or exists (
      select 1
      from payroll_lines line
      where line.run_id = payroll_runs.id
        and public.tf_owns_payroll_line(line.employee_id)
    )
  );

alter policy payroll_lines_select_scoped on payroll_lines
  using (
    public.tf_is_company_admin(company_id)
    or public.tf_has_support_access(company_id)
    or public.tf_owns_payroll_line(employee_id)
  );

alter policy payroll_line_items_select_scoped on payroll_line_items
  using (
    public.tf_is_company_admin(company_id)
    or public.tf_has_support_access(company_id)
    or exists (
      select 1
      from payroll_lines line
      where line.id = payroll_line_items.line_id
        and public.tf_owns_payroll_line(line.employee_id)
    )
  );

-- Bang thu tu, them o 0030 sau khi spec cua phase nay duoc viet — spec ghi
-- "22 bang", con so dung la 23.
alter policy payroll_line_days_select_scoped on payroll_line_days
  using (
    public.tf_is_company_admin(company_id)
    or public.tf_has_support_access(company_id)
    or exists (
      select 1
      from payroll_lines line
      where line.id = payroll_line_days.line_id
        and public.tf_owns_payroll_line(line.employee_id)
    )
  );

/* -------------------------------------------------------------------------- */
/* (b) storage.objects — bucket attendance-photos                              */
/* -------------------------------------------------------------------------- */

-- Khong doi thi anh cham cong tra 403 trong phien ho tro va Dialog xem lai
-- cua quan tri vo dung voi doi ho tro — dung thu ho can nhat khi tra loi mot
-- cau hoi ho tro ve cham cong.
--
-- Boc trong DO block dieu kien theo to_regclass() dung khuon 0012: Postgres
-- tam cua CI KHONG CO schema `storage`, migration nay phai ap dung duoc
-- (no-op) o do. Chi doi policy SELECT; `attendance_photos_insert_member`
-- giu nguyen tf_is_member vi phien ho tro khong duoc GHI anh.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute $sql$
      alter policy attendance_photos_select_member
      on storage.objects
      using (
        bucket_id = 'attendance-photos'
        and (
          public.tf_is_member(split_part(name, '/', 1))
          or public.tf_has_support_access(split_part(name, '/', 1))
        )
      );
    $sql$;
  end if;
end
$$;
