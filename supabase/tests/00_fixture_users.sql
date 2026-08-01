-- supabase/tests/00_fixture_users.sql
--
-- Fixture, KHONG PHAI test: khong bat begin/rollback, khong plan() — du lieu
-- chen o day phai con nguyen cho moi file test chay SAU no trong run-all.sql.
-- Day la noi bon uuid tong hop lam nguoi dung gia lap con lai (D-15), tach
-- khoi supabase/seed.sql vi ly do sau:
--
--   - Postgres CI: `auth.users` chi la bang tuong thich (compat) duoc tao o
--     0001_supabase_compat.sql, khong co rang buoc `auth.identities` cua
--     Supabase Auth that — nen chen thang vao day an toan, chi dung de pgTAP
--     gia lap dang nhap qua tf_test_login()/tf_test_logout() (helpers.sql).
--   - Cloud that: duong DUY NHAT tao tai khoan dang nhap duoc la
--     `scripts/seed-auth.mjs` (goi Supabase Auth API, tao ca `auth.identities`).
--     Bon uuid tong hop o day KHONG BAO GIO chay tren cloud — `npm run
--     db:seed` chi nap supabase/seed.sql, khong nap thu muc tests/.
--
-- Thu tu: helpers.sql -> 00_fixture_users.sql (file nay) -> moi file test
-- khac (xem run-all.sql). 00_rls_coverage.sql chay SAU fixture nay nen bang
-- platform_admins da co du lieu khi cong RLS quet schema.

/* -------------------------------------------------------------------------- */
/* 1. auth.users — bon uuid tong hop co dinh                                  */
/* -------------------------------------------------------------------------- */
-- 0001: owner Ngoc Phat | 0002: owner Binh Minh
-- 0003: thanh vien ca hai doanh nghiep (ca thanh vien kep)
-- 0004: khong thuoc doanh nghiep nao, la platform admin (xem muc 6)

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner1@timeflow.test'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner2@timeflow.test'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dualmember@timeflow.test'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nomember@timeflow.test')
on conflict (id) do nothing;

/* -------------------------------------------------------------------------- */
/* 2. memberships                                                              */
/* -------------------------------------------------------------------------- */

insert into memberships (user_id, company_id, role, status, last_accessed_at) values
  ('00000000-0000-0000-0000-000000000001', 'cty-01', 'owner', 'active', now()),
  ('00000000-0000-0000-0000-000000000002', 'cty-02', 'owner', 'active', now()),
  ('00000000-0000-0000-0000-000000000003', 'cty-01', 'admin', 'active', now()),
  ('00000000-0000-0000-0000-000000000003', 'cty-02', 'admin', 'active', now());
-- User 0004 co ton tai trong auth.users nhung khong co membership nao —
-- dung lam fixture cho ca "khong thuoc doanh nghiep nao doc duoc 0 dong".

/* -------------------------------------------------------------------------- */
/* 3. employees.user_id — gan hai nhan vien neo toi user owner tuong ung      */
/* -------------------------------------------------------------------------- */

update employees set user_id = '00000000-0000-0000-0000-000000000001' where id = 'nv-01a';
update employees set user_id = '00000000-0000-0000-0000-000000000002' where id = 'nv-02a';

/* -------------------------------------------------------------------------- */
/* 4. audit_log.actor_user_id — khoi phuc khoa ngoai toi auth.users           */
/* -------------------------------------------------------------------------- */

update audit_log set actor_user_id = '00000000-0000-0000-0000-000000000001'
  where company_id = 'cty-01' and entity_id = 'nv-01a';
update audit_log set actor_user_id = '00000000-0000-0000-0000-000000000002'
  where company_id = 'cty-02' and entity_id = 'nv-02a';

/* -------------------------------------------------------------------------- */
/* 5. platform_admins — user 0004 (D-11)                                      */
/* -------------------------------------------------------------------------- */
-- Chon co chu dich user 0004: nguoi nay KHONG la thanh vien doanh nghiep
-- nao, nen fixture the hien dung mo hinh "platform admin khong phai mot gia
-- tri thu nam cua vai tro doanh nghiep".

insert into platform_admins (user_id) values
  ('00000000-0000-0000-0000-000000000004')
on conflict (user_id) do nothing;
