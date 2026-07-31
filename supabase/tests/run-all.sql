-- supabase/tests/run-all.sql
--
-- Entry point gom moi file test. Duong dan trong \ir tinh theo thu muc chua
-- chinh file nay (supabase/tests/), khong theo thu muc lam viec khi goi psql.

\set ON_ERROR_STOP on

\ir helpers.sql
\ir 00_rls_coverage.sql
\ir 01_isolation_companies.sql
\ir 02_time_overnight.sql
\ir 03_isolation_core.sql
\ir 04_isolation_v2.sql
