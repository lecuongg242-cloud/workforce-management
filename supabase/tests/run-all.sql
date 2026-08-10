-- supabase/tests/run-all.sql
--
-- Entry point gom moi file test. Duong dan trong \ir tinh theo thu muc chua
-- chinh file nay (supabase/tests/), khong theo thu muc lam viec khi goi psql.

\set ON_ERROR_STOP on

\ir helpers.sql
\ir 00_fixture_users.sql
\ir 00_rls_coverage.sql
\ir 01_isolation_companies.sql
\ir 02_time_overnight.sql
\ir 03_isolation_core.sql
\ir 04_isolation_v2.sql
\ir 05_seed_fixture.sql
\ir 06_platform_admins.sql
\ir 07_search_normalize.sql
\ir 08_role_write_scope.sql
\ir 09_attendance_evidence.sql
\ir 10_company_settings.sql
\ir 11_overtime_rules_append_only.sql
\ir 12_request_reviews.sql
\ir 13_apply_approved_request.sql
\ir 14_notifications.sql
\ir 15_period_close.sql
\ir 16_employee_pay_rates.sql
\ir 17_pay_adjustments.sql
\ir 18_payroll_runs.sql
\ir 19_payslip_rls.sql
\ir 20_support_sessions.sql
