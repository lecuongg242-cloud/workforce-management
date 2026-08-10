-- supabase/tests/20_support_sessions.sql
--
-- pgTAP cho phien ho tro (D-49/D-50/D-55). User 0004 la platform admin va
-- KHONG thuoc doanh nghiep nao (fixture 00_fixture_users.sql) — dung lam
-- nguoi mo phien. Khuon begin/plan/finish/rollback nhu 06_platform_admins.sql.
--
-- Cot loi cua ca file: quyen doc xuyen doanh nghiep suy tu MOT PHIEN CO HAN,
-- khong suy tu danh tinh. Vi vay moi khang dinh o day deu ve mot trong ba
-- ranh gioi cua phien: dung doanh nghiep, dung khoang thoi gian, dung nguoi.

begin;

select plan(8);

/* ============================================================================
   1-2. Bang co mat, bat RLS
   ========================================================================= */

select has_table('public', 'support_sessions', 'support_sessions: bang ton tai');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.support_sessions'::regclass),
  'support_sessions: relrowsecurity = true'
);

/* ============================================================================
   3-5. tf_has_support_access: chua co phien -> false; co phien con han ->
        true cho DUNG cty do va false cho cty khac
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select ok(
  not public.tf_has_support_access('cty-01'),
  'tf_has_support_access: false khi user 0004 chua mo phien nao'
);

select tf_test_logout();

-- Chen bang vai tro mac dinh cua ket noi (chu bang, bo qua RLS) de tach
-- phep chen ra khoi thu dang duoc kiem o day la phep DOC.
insert into support_sessions (platform_admin_id, company_id, reason, expires_at)
  values ('00000000-0000-0000-0000-000000000004', 'cty-01', 'pgTAP', now() + interval '60 minutes');

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select ok(
  public.tf_has_support_access('cty-01'),
  'tf_has_support_access: true cho cty-01 khi phien con han'
);

select ok(
  not public.tf_has_support_access('cty-02'),
  'tf_has_support_access: false cho cty-02 — phien chi mo dung MOT doanh nghiep'
);

select tf_test_logout();

/* ============================================================================
   6. Phien HET HAN khong con hieu luc — het han khong can cron, ham so
      now() < expires_at moi lan goi
   ========================================================================= */

update support_sessions set expires_at = now() - interval '1 minute'
  where platform_admin_id = '00000000-0000-0000-0000-000000000004';

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select ok(
  not public.tf_has_support_access('cty-01'),
  'tf_has_support_access: false khi phien da het han'
);

select tf_test_logout();

/* ============================================================================
   7. Nguoi thuong khong bao gio co support access
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  not public.tf_has_support_access('cty-01'),
  'tf_has_support_access: false cho owner 0001 — khong phai platform admin thi khong co phien'
);

select tf_test_logout();

/* ============================================================================
   8. Nhat ky khong xoa duoc (D-55: khong co policy delete)
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select throws_ok(
  $del_ss$delete from support_sessions where company_id = 'cty-01'$del_ss$,
  '42501',
  null,
  'support_sessions: platform admin xoa nhat ky cua chinh minh bi tu choi'
);

select tf_test_logout();

select * from finish(true);

rollback;
