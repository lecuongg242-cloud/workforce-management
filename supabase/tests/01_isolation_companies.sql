-- supabase/tests/01_isolation_companies.sql
--
-- Test co lap doc/ghi cheo cho `companies` va `memberships`, dung hai doanh
-- nghiep seed san (cty-01 Ngoc Phat, cty-02 Binh Minh) lam bo doi chieu.
-- Moi assertion neu dich danh ten bang trong mo ta de output TAP tra loi
-- duoc "bang nao" khi do.

begin;

select plan(18);

/* ============================================================================
   User 0001 (owner Ngoc Phat) doc duoc cty-01, khong doc duoc cty-02
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from companies where id = 'cty-01') > 0,
  'companies: user 0001 doc duoc >0 dong cty-01 cua chinh minh'
);

select is(
  (select count(*) from companies where id = 'cty-02')::int,
  0,
  'companies: user 0001 doc duoc 0 dong cty-02'
);

select ok(
  (select count(*) from memberships where company_id = 'cty-01') > 0,
  'memberships: user 0001 doc duoc >0 dong thuoc cty-01'
);

select is(
  (select count(*) from memberships where company_id = 'cty-02')::int,
  0,
  'memberships: user 0001 doc duoc 0 dong thuoc cty-02'
);

select tf_test_logout();

/* ============================================================================
   User 0002 (owner Binh Minh) — guong lai theo chieu nguoc
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000002'::uuid);

select ok(
  (select count(*) from companies where id = 'cty-02') > 0,
  'companies: user 0002 doc duoc >0 dong cty-02 cua chinh minh'
);

select is(
  (select count(*) from companies where id = 'cty-01')::int,
  0,
  'companies: user 0002 doc duoc 0 dong cty-01'
);

select ok(
  (select count(*) from memberships where company_id = 'cty-02') > 0,
  'memberships: user 0002 doc duoc >0 dong thuoc cty-02'
);

select is(
  (select count(*) from memberships where company_id = 'cty-01')::int,
  0,
  'memberships: user 0002 doc duoc 0 dong thuoc cty-01'
);

select tf_test_logout();

/* ============================================================================
   Ghi cheo doanh nghiep khac bi tu choi (SQLSTATE 42501)
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

-- companies khong co cot company_id (chinh no la thuc the doanh nghiep) —
-- bien the tuong duong la chen mot doanh nghiep moi ma user 0001 khong phai
-- thanh vien (tf_is_member(id) = false).
-- Dung dang 4 tham so (sql, errcode, errmsg, description) — day la overload
-- duy nhat nhan errcode kieu SQLSTATE (bpchar); dang 3 tham so voi mot chuoi
-- text se bi hieu nham thanh (sql, errmsg, description) va so sanh sai.
select throws_ok(
  $ins1$insert into companies (id, name, code, industry, size, phone, address, accent)
    values ('cty-99', 'Cong ty gia mao', 'FAKE99', 'retail', '1-10', '000', 'khong ton tai', 'indigo')$ins1$,
  '42501',
  'new row violates row-level security policy for table "companies"',
  'companies: user 0001 chen doanh nghiep ngoai pham vi thanh vien bi tu choi'
);

select throws_ok(
  $ins2$insert into memberships (user_id, company_id, role)
    values ('00000000-0000-0000-0000-000000000001', 'cty-02', 'employee')$ins2$,
  '42501',
  'new row violates row-level security policy for table "memberships"',
  'memberships: user 0001 tu them minh vao cty-02 bi tu choi'
);

/* ============================================================================
   Update/delete nham vao du lieu doanh nghiep khac tac dong dung 0 dong
   ========================================================================= */
-- CTE ghi du lieu (UPDATE/DELETE ... RETURNING) phai nam o cap cao nhat cua
-- cau lenh, khong duoc long trong bieu thuc con truyen cho is() — nen moi
-- WITH duoi day la WITH cua chinh cau SELECT goi is(), khong phai subquery.

with updated as (
  update companies set name = name where id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from updated),
  0,
  'companies: user 0001 update dong cty-02 tac dong 0 dong'
);

with deleted as (
  delete from companies where id = 'cty-02' returning 1
)
select is(
  (select count(*)::int from deleted),
  0,
  'companies: user 0001 delete dong cty-02 tac dong 0 dong'
);

with updated as (
  update memberships set role = 'employee'
    where company_id = 'cty-02'
      and user_id = '00000000-0000-0000-0000-000000000002'
    returning 1
)
select is(
  (select count(*)::int from updated),
  0,
  'memberships: user 0001 update dong cty-02 tac dong 0 dong'
);

with deleted as (
  delete from memberships
    where company_id = 'cty-02'
      and user_id = '00000000-0000-0000-0000-000000000002'
    returning 1
)
select is(
  (select count(*)::int from deleted),
  0,
  'memberships: user 0001 delete dong cty-02 tac dong 0 dong'
);

select tf_test_logout();

/* ============================================================================
   User 0003 (thanh vien ca hai doanh nghiep) doc duoc dong cua ca hai
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000003'::uuid);

select is(
  (select count(*) from companies)::int,
  2,
  'companies: user 0003 (thanh vien kep) doc duoc dong cua ca cty-01 va cty-02'
);

select is(
  (select count(*) from memberships)::int,
  4,
  'memberships: user 0003 (thanh vien kep) doc duoc dong cua ca cty-01 va cty-02'
);

select tf_test_logout();

/* ============================================================================
   User 0004 (khong membership) doc duoc 0 dong o ca hai bang
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*) from companies)::int,
  0,
  'companies: user 0004 (khong membership) doc duoc 0 dong'
);

select is(
  (select count(*) from memberships)::int,
  0,
  'memberships: user 0004 (khong membership) doc duoc 0 dong'
);

select tf_test_logout();

select * from finish(true);

rollback;
