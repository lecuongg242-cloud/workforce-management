-- supabase/tests/14_notifications.sql
--
-- Thong bao trong ung dung (migration 0020, plan 05-04).
--
-- KHANG DINH QUAN TRONG NHAT CUA FILE NAY la cai ma khong bang nao khac cua du
-- an co: HAI NGUOI CUNG MOT DOANH NGHIEP khong doc duoc thong bao cua nhau.
-- Moi bang khac chi can chung minh ranh gioi doanh nghiep; o day ranh gioi la
-- CON NGUOI, vi noi dung mang ly do tu choi — mot nhan xet rieng ve mot nguoi
-- (T-05-04-01).
--
-- Hai fixture user deu thuoc cty-01: 0001 (owner) va 0003 (admin, thanh vien
-- kep cty-01 + cty-02).

begin;

select plan(6);

/* ============================================================================
   Fixture — chay o vai tro mac dinh (chu bang, bo qua RLS)
   ========================================================================= */

insert into notifications (id, company_id, user_id, kind, title, body, request_id)
values
  (
    '00000000-0000-0000-0000-0000000000a1',
    'cty-01', '00000000-0000-0000-0000-000000000001',
    'request_reviewed', 'Yêu cầu của bạn đã được duyệt',
    'Xin nghỉ phép 01/01 – 02/01 đã được duyệt.', 'wr-01'
  ),
  (
    '00000000-0000-0000-0000-0000000000a2',
    'cty-01', '00000000-0000-0000-0000-000000000003',
    'request_reviewed', 'Yêu cầu của bạn bị từ chối',
    'Lý do: trùng lịch kiểm kê cuối quý.', null
  );

/* ============================================================================
   Co lap theo NGUOI NHAN — 2 khang dinh, ca hai nguoi deu o cty-01
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select is(
  (select count(*)::int from notifications),
  1,
  'notifications: user 0001 chi doc duoc DONG CUA CHINH MINH, du dong kia cung o cty-01'
);

select is(
  (select count(*)::int from notifications
    where id = '00000000-0000-0000-0000-0000000000a2'),
  0,
  'notifications: user 0001 KHONG doc duoc thong bao cua dong nghiep cung doanh nghiep (T-05-04-01)'
);

/* ============================================================================
   Danh dau da doc — chi tren dong cua chinh minh, 2 khang dinh
   ========================================================================= */

select is(
  (with updated as (
     update notifications set read_at = now()
      where id = '00000000-0000-0000-0000-0000000000a2'
      returning 1
   )
   select count(*)::int from updated),
  0,
  'notifications: user 0001 danh dau da doc dong cua nguoi khac -> khong cham duoc dong nao (T-05-04-02)'
);

select is(
  (with updated as (
     update notifications set read_at = now()
      where id = '00000000-0000-0000-0000-0000000000a1'
      returning 1
   )
   select count(*)::int from updated),
  1,
  'notifications: user 0001 danh dau da doc dong CUA MINH -> doi dung mot dong'
);

/* ============================================================================
   Khong co policy delete — khong ai xoa duoc, ke ca chinh chu
   ========================================================================= */

select is(
  (with deleted as (
     delete from notifications
      where id = '00000000-0000-0000-0000-0000000000a1'
      returning 1
   )
   select count(*)::int from deleted),
  0,
  'notifications: khong co policy delete -> chinh chu cung khong xoa duoc thong bao cua minh'
);

/* ============================================================================
   Ranh gioi doanh nghiep van con nguyen — chen cheo bi tu choi han
   ========================================================================= */

select throws_ok(
  $cross$insert into notifications (company_id, user_id, kind, title, body)
   values ('cty-02', '00000000-0000-0000-0000-000000000001',
           'request_reviewed', 'Chen trom', 'Chen trom')$cross$,
  '42501',
  'new row violates row-level security policy for table "notifications"',
  'notifications: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select tf_test_logout();

select * from finish(true);

rollback;
