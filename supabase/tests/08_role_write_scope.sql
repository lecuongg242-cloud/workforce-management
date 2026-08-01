-- supabase/tests/08_role_write_scope.sql
--
-- pgTAP cho pham vi ghi theo doanh nghiep tren `employees` (plan 02-07).
--
-- GIOI HAN PHAI GHI RO NGAY TU DAU FILE: RLS cua Phase 1 (policy
-- `employees_update_member` o 0004_core_entities.sql) chi phan biet THANH
-- VIEN hay khong (`tf_is_member(company_id)`), KHONG phan biet VAI TRO
-- (owner/admin/manager/employee). Phan biet vai tro nam O TANG SERVER ACTION
-- (`requireRole()` va nhanh "ho so cua chinh minh" trong
-- `mutations/employees.ts`) — neu mot Server Action tuong lai quen goi
-- `requireRole()`, database se KHONG chan thay. Muc 5 duoi day ghi lai dung
-- trang thai THAT nay, khong phai trang thai mong muon.
--
-- Ghi chu ky thuat: WITH chua mot cau lenh sua doi du lieu (UPDATE ...
-- RETURNING) phai o CAP CAO NHAT cua cau lenh, khong duoc long trong mot
-- subquery vo huong lam tham so cho `is()` — nen moi kiem tra co UPDATE o
-- day tach thanh HAI cau lenh: `with updated as (update ... returning id)
-- select is((select count(*)::int from updated), ...)` la MOT cau lenh top
-- level duy nhat (WITH bao trum ca SELECT goi is()).
--
-- Theo khuon begin/plan/finish/rollback cua 01_isolation_companies.sql.
-- Muc 2 va muc 5 tam mutate bang `memberships` NGAY TRONG giao dich nay de
-- mo phong hai tinh huong ma fixture co san (00_fixture_users.sql) khong the
-- tao truc tiep (chi co hai doanh nghiep, user 0003 la thanh vien ca hai, va
-- khong co san mot user vai tro 'employee') — rollback cuoi file hoan tac
-- lai dung nhu 00_fixture_users.sql da thiet lap, khong anh huong file test
-- nao chay sau trong run-all.sql.

begin;

select plan(7);

/* ============================================================================
   1. User 0003 (admin ca hai doanh nghiep) cap nhat duoc mot dong employees
      cua cty-01
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000003'::uuid);

with updated as (
  update employees set position = 'Cap nhat boi 0003 (test)'
  where id = 'nv-01a' and company_id = 'cty-01'
  returning id
)
select is(
  (select count(*)::int from updated),
  1,
  '0003 (admin ca hai doanh nghiep): cap nhat duoc 1 dong employees cua cty-01'
);

select tf_test_logout();

/* ============================================================================
   2. User 0003 KHONG cap nhat duoc dong employees cua mot doanh nghiep ho
      khong thuoc -- tam vo hieu hoa membership tai cty-02 NGAY TRONG giao
      dich nay de tao ra dung tinh huong do (fixture chi co hai doanh
      nghiep, 0003 mac dinh la thanh vien ca hai qua 00_fixture_users.sql)
   ========================================================================= */

update memberships set status = 'inactive'
  where user_id = '00000000-0000-0000-0000-000000000003' and company_id = 'cty-02';

select tf_test_login('00000000-0000-0000-0000-000000000003'::uuid);

with updated as (
  update employees set position = 'Khong duoc phep (test)'
  where id = 'nv-02a' and company_id = 'cty-02'
  returning id
)
select is(
  (select count(*)::int from updated),
  0,
  '0003 sau khi tam mat membership tai cty-02: cap nhat 0 dong employees cua cty-02 (RLS chan)'
);

select tf_test_logout();

update memberships set status = 'active'
  where user_id = '00000000-0000-0000-0000-000000000003' and company_id = 'cty-02';

/* ============================================================================
   3. User 0004 (khong membership nao) khong doc va khong ghi duoc dong
      employees nao
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*)::int from employees),
  0,
  '0004 (khong membership nao): doc duoc 0 dong employees'
);

with updated as (
  update employees set position = 'Khong duoc phep (test)'
  where id = 'nv-01a'
  returning id
)
select is(
  (select count(*)::int from updated),
  0,
  '0004 (khong membership nao): cap nhat 0 dong employees'
);

select tf_test_logout();

/* ============================================================================
   4. User 0001 (owner cty-01) doc dung 28 dong employees cua cty-01, 0 dong
      cua cty-02
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select is(
  (select count(*)::int from employees where company_id = 'cty-01'),
  28,
  '0001 (owner cty-01): doc dung 28 dong employees cua cty-01'
);

select is(
  (select count(*)::int from employees where company_id = 'cty-02'),
  0,
  '0001 (owner cty-01): doc 0 dong employees cua cty-02 (khong thay du lieu doanh nghiep khac)'
);

select tf_test_logout();

/* ============================================================================
   5. GIOI HAN DA BIET (ghi nhan, khong phai xac nhan la dung): RLS chi phan
      biet THANH VIEN hay khong, KHONG phan biet VAI TRO trong memberships.
      Tam them mot membership vai tro 'employee' cho user 0004 tai cty-01
      NGAY TRONG giao dich nay (fixture khong co san mot user vai tro
      employee) de chung minh: mot vai tro ma tang Server Action SE TU CHOI
      (updateEmployee — vai tro 'employee' chi sua duoc ho so CUA CHINH
      MINH, khong sua duoc ho so nguoi khac) VAN cap nhat duoc BAT KY dong
      employees nao cua cty-01 qua RLS thuan tuy -- vi RLS chi kiem
      tf_is_member(company_id), khong kiem vai tro. Neu mot thay doi RLS
      trong tuong lai (them dieu kien vai tro vao policy
      employees_update_member) lam assertion nay do, do la TIN HIEU DUNG:
      nguoi sua PHAI doc lai ghi chu nay truoc khi tiep tuc, khong duoc coi
      do la mot loi hong can vang lai.
   ========================================================================= */

insert into memberships (user_id, company_id, role, status, last_accessed_at)
values ('00000000-0000-0000-0000-000000000004', 'cty-01', 'employee', 'active', now());

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

with updated as (
  update employees set position = 'Cap nhat boi vai tro employee qua RLS (test)'
  where id = 'nv-01a' and company_id = 'cty-01'
  returning id
)
select is(
  (select count(*)::int from updated),
  1,
  'GIOI HAN DA BIET: RLS khong phan biet vai tro -- mot membership vai tro ''employee'' (vai tro ma tang Server Action se tu choi khi sua ho so nguoi khac) van cap nhat duoc dong employees cua nguoi khac qua RLS thuan tuy. Phan biet vai tro nam o tang Server Action (requireRole()/nhanh "ho so cua chinh minh"), KHONG o RLS -- xem ghi chu dau file.'
);

select tf_test_logout();

select * from finish(true);

rollback;
