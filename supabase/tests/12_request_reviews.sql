-- supabase/tests/12_request_reviews.sql
--
-- Lich su xu ly yeu cau (migration 0017, plan 05-01). Ba nhom khang dinh:
--   - APPEND-ONLY: UPDATE/DELETE bi trigger tu choi. Day la nhom quan trong
--     nhat — no la thu duy nhat lam cau "sau sau thang van tra loi duoc ai
--     duyet cai nay" thanh mot bao dam thay vi mot loi hua (D-33, khuon D-25a).
--   - LY DO BAT BUOC KHI TU CHOI: lop THU HAI cua rang buoc; lop thu nhat o
--     Server Action. Neu lop thu nhat bi mot duong ghi moi quen mat, lop nay
--     van tu choi.
--   - CO LAP DOANH NGHIEP: doc cheo tra 0 dong, ghi cheo bi RLS tu choi han.

begin;

select plan(8);

/* ============================================================================
   Fixture: mot dong lich su cua CTY-02, chen o vai tro mac dinh (chu bang, bo
   qua RLS) de buoc kiem co lap phia duoi co thu that de KHONG nhin thay.
   ========================================================================= */

insert into request_reviews (company_id, request_id, decision, note, reviewer_user_id)
values (
  'cty-02', 'wr2-03', 'rejected',
  'Ly do cua doanh nghiep khac (fixture 12)',
  '00000000-0000-0000-0000-000000000002'
);

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

/* ============================================================================
   Ghi hop le — 2 khang dinh
   ========================================================================= */

select lives_ok(
  $ok_appr$insert into request_reviews
     (company_id, request_id, decision, note, reviewer_user_id, reviewer_employee_id)
   values ('cty-01', 'wr-01', 'approved', null,
           '00000000-0000-0000-0000-000000000001', 'nv-01a')$ok_appr$,
  'request_reviews: duyet KHONG ghi chu van chen duoc (ghi chu chi bat buoc khi tu choi)'
);

select lives_ok(
  $ok_rej$insert into request_reviews
     (company_id, request_id, decision, note, reviewer_user_id)
   values ('cty-01', 'wr-02', 'rejected', 'Khong du nhan su ngay hom do.',
           '00000000-0000-0000-0000-000000000001')$ok_rej$,
  'request_reviews: tu choi CO ly do chen duoc'
);

/* ============================================================================
   Ly do bat buoc khi tu choi — 2 khang dinh (null va chuoi toan khoang trang
   la HAI hinh dang khac nhau cua cung mot loi, phai kiem ca hai)
   ========================================================================= */

select throws_ok(
  $no_note$insert into request_reviews (company_id, request_id, decision, note)
   values ('cty-01', 'wr-03', 'rejected', null)$no_note$,
  '23514',
  null,
  'request_reviews: tu choi voi note NULL bi rang buoc CHECK tu choi'
);

select throws_ok(
  $blank$insert into request_reviews (company_id, request_id, decision, note)
   values ('cty-01', 'wr-03', 'rejected', '   ')$blank$,
  '23514',
  null,
  'request_reviews: tu choi voi note toan khoang trang bi tu choi (btrim, khong chi kiem null)'
);

/* ============================================================================
   Append-only — 2 khang dinh
   ========================================================================= */

select throws_ok(
  $upd$update request_reviews set note = 'sua lai ly do sau khi bi chat van'
     where company_id = 'cty-01'$upd$,
  '23001',
  null,
  'request_reviews: UPDATE bi trigger tu choi (lich su khong sua duoc, D-33)'
);

select throws_ok(
  $del$delete from request_reviews where company_id = 'cty-01'$del$,
  '23001',
  null,
  'request_reviews: DELETE bi trigger tu choi (lich su khong xoa duoc, D-33)'
);

/* ============================================================================
   Co lap doanh nghiep — 2 khang dinh
   ========================================================================= */

select is(
  (select count(*)::int from request_reviews where company_id = 'cty-02'),
  0,
  'request_reviews: user 0001 khong doc duoc dong lich su nao cua cty-02'
);

select throws_ok(
  $cross$insert into request_reviews (company_id, request_id, decision, note)
   values ('cty-02', 'wr2-01', 'approved', null)$cross$,
  '42501',
  'new row violates row-level security policy for table "request_reviews"',
  'request_reviews: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select tf_test_logout();

select * from finish(true);

rollback;
