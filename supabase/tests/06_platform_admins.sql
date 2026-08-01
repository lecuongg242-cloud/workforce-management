-- supabase/tests/06_platform_admins.sql
--
-- pgTAP cho vai tro platform admin (D-11/D-11a/D-11b). Dung user 0004 (fixture
-- o 00_fixture_users.sql) — nguoi nay la platform admin va KHONG la thanh
-- vien doanh nghiep nao. Theo khuon 01_isolation_companies.sql: begin/plan/
-- finish/rollback. Moi mo ta neu dich danh `platform_admins` hoac
-- `tf_is_platform_admin` de output TAP tra loi duoc "cai gi do".

begin;

select plan(8);

/* ============================================================================
   1-3. tf_is_platform_admin() tra dung true/false theo nguoi dang dang nhap
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select ok(
  public.tf_is_platform_admin(),
  'tf_is_platform_admin: tra true khi dang nhap bang user 0004 (co ten trong platform_admins)'
);

select tf_test_logout();
select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  not public.tf_is_platform_admin(),
  'tf_is_platform_admin: tra false khi dang nhap bang user 0001 (owner, khong phai platform admin)'
);

select tf_test_logout();

select ok(
  not public.tf_is_platform_admin(),
  'tf_is_platform_admin: tra false khi khong co phien dang nhap (auth.uid() la NULL)'
);

/* ============================================================================
   4-5. platform_admins bat RLS va co it nhat mot policy (00_rls_coverage.sql)
   ========================================================================= */

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.platform_admins'::regclass
  ),
  'platform_admins: relrowsecurity = true'
);

select ok(
  (
    select count(*) > 0
    from pg_policies
    where schemaname = 'public' and tablename = 'platform_admins'
  ),
  'platform_admins: co it nhat mot dong trong pg_policies'
);

/* ============================================================================
   6. Khong ai doc truc tiep duoc — ke ca chinh nguoi co ten trong bang
      (khang dinh cot loi cua D-11a)
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*)::int from platform_admins),
  0,
  'platform_admins: user 0004 (chinh nguoi co ten trong bang) doc truc tiep duoc 0 dong'
);

select tf_test_logout();

/* ============================================================================
   7. Ghi (INSERT) bi tu choi — khong policy nao cho phep, mac dinh tu choi
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select throws_ok(
  $ins_pa$insert into platform_admins (user_id)
    values ('00000000-0000-0000-0000-000000000001')$ins_pa$,
  '42501',
  'new row violates row-level security policy for table "platform_admins"',
  'platform_admins: user 0001 tu chen minh vao bang bi tu choi'
);

select tf_test_logout();

/* ============================================================================
   8. Vai tro public khong co quyen execute tren tf_is_platform_admin()
      (chung minh revoke da co hieu luc that, khong chi co mat trong file
      migration)
   ========================================================================= */

select ok(
  not has_function_privilege('public', 'public.tf_is_platform_admin()', 'execute'),
  'tf_is_platform_admin: vai tro public khong co quyen execute'
);

select * from finish(true);

rollback;
