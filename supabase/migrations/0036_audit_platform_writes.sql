-- 0036_audit_platform_writes.sql
--
-- Duong ghi audit cho hai thao tac NEN TANG cua super admin (SADM-04, D-56):
-- cap lai mat khau tam, va cap lai membership owner. Hai thao tac nay khong
-- thuoc doanh nghiep nao — chung o TANG NEN TANG — nen dong audit cua chung
-- mang `company_id = NULL`.
--
-- `audit_log.company_id` da nullable tu 0005 va comment o do ghi ro rang no
-- nullable "de Phase 6 ghi duoc thao tac super admin". Day la phase do.
--
-- Hai policy insert hien co deu KHONG cho dong nay qua:
--   - `audit_log_insert_member`  doi tf_is_member(company_id)  -> NULL, false
--   - `audit_log_insert_support` doi tf_has_support_access(...) -> NULL, false
-- Ca hai deu tra NULL (khong phai true) cho company_id NULL, va mot bieu thuc
-- `with check` tra NULL bi coi la tu choi — dung nhu mong muon, chi la khong
-- co duong nao cho thao tac nen tang.

create policy audit_log_insert_platform on audit_log
  for insert
  with check (
    company_id is null
    and public.tf_is_platform_admin()
  );

-- Doc: nhung dong company_id NULL khong lot qua `audit_log_select_member`
-- (dieu kien do cung tra NULL), nen hien tai KHONG AI doc lai duoc chung —
-- ke ca chinh platform admin vua ghi. Mo dung mot duong doc cho platform
-- admin, giu nguyen ranh gioi cu: nguoi cua doanh nghiep van khong thay dong
-- nao co company_id NULL.
create policy audit_log_select_platform on audit_log
  for select
  using (
    company_id is null
    and public.tf_is_platform_admin()
  );
