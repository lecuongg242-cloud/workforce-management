-- supabase/tests/02_time_overnight.sql
--
-- Test quy uoc thoi gian cua TimeFlow: ca qua dem, diem cham nua dem, ca do
-- dai 0, va cac moc NULL. Toan bo danh sach assertion duoi day duoc lap lai
-- BA LAN, moi lan sau mot lenh `set timezone` phien khac nhau (UTC,
-- Asia/Ho_Chi_Minh, America/New_York) — vi tham so cua nam ham tf_* la
-- `time`/`timestamptz` (khong phai gia tri phu thuoc mui gio phien), ket qua
-- phai giu nguyen o ca ba lan (D-08, threat T-01-07). Mo ta cua moi assertion
-- neu ro mui gio phien dang dat de khi do biet ngay mui gio nao lam vo.

begin;

select plan(53);

/* ============================================================================
   Vong 1/3 — session timezone = UTC
   ========================================================================= */

set timezone to 'UTC';

select is(
  public.tf_shift_minutes('22:00', '06:00', 0),
  480,
  'tf_shift_minutes: 22:00-06:00 qua dem, 0 phut nghi = 480 (tz=UTC)'
);

select is(
  public.tf_shift_minutes('22:00', '06:00', 45),
  435,
  'tf_shift_minutes: 22:00-06:00 qua dem, 45 phut nghi = 435 (tz=UTC)'
);

select is(
  public.tf_shift_minutes('08:00', '17:30', 90),
  480,
  'tf_shift_minutes: 08:00-17:30 trong ngay, 90 phut nghi = 480 (tz=UTC)'
);

select is(
  public.tf_shift_minutes('18:00', '06:00', 60),
  660,
  'tf_shift_minutes: 18:00-06:00 qua dem, 60 phut nghi = 660 (tz=UTC)'
);

select is(
  public.tf_shift_minutes('22:00', '00:00', 0),
  120,
  'tf_shift_minutes: 22:00-00:00 cham dung nua dem = 120 (tz=UTC)'
);

select is(
  public.tf_shift_minutes('00:00', '08:00', 0),
  480,
  'tf_shift_minutes: 00:00-08:00 bat dau tu nua dem = 480 (tz=UTC)'
);

select is(
  public.tf_shift_minutes('14:00', '22:00', 0)
    + public.tf_shift_minutes('22:00', '06:00', 0),
  960,
  'tf_shift_minutes: hai ca lien ke 14:00-22:00 va 22:00-06:00 cong lai = 960, khong mat phut, khong chong lan (tz=UTC)'
);

select is(
  public.tf_shift_minutes('08:00', '08:00', 0),
  0,
  'tf_shift_minutes: start = end tra 0, khong phai 1440 (tz=UTC)'
);

select ok(
  public.tf_overnight('22:00', '06:00'),
  'tf_overnight: 22:00-06:00 la ca qua dem (tz=UTC)'
);

select ok(
  not public.tf_overnight('08:00', '17:30'),
  'tf_overnight: 08:00-17:30 khong phai ca qua dem (tz=UTC)'
);

select ok(
  not public.tf_overnight('08:00', '08:00'),
  'tf_overnight: start = end khong tinh la qua dem (tz=UTC)'
);

select is(
  public.tf_work_date(timestamptz '2026-03-15 15:00:00+00'),
  date '2026-03-15',
  'tf_work_date: 22:00 gio VN ngay 2026-03-15 (15:00 UTC) -> 2026-03-15 (tz=UTC)'
);

select is(
  public.tf_work_date(timestamptz '2026-03-15 17:30:00+00'),
  date '2026-03-16',
  'tf_work_date: 00:30 gio VN ngay 2026-03-16 (17:30 UTC ngay 2026-03-15) -> 2026-03-16 (tz=UTC)'
);

select is(
  public.tf_worked_minutes(null, timestamptz '2026-03-15 15:00:00+00', 30),
  0,
  'tf_worked_minutes: check_in NULL -> 0 (tz=UTC)'
);

select is(
  public.tf_worked_minutes(timestamptz '2026-03-15 15:00:00+00', null, 30),
  0,
  'tf_worked_minutes: check_out NULL -> 0 (tz=UTC)'
);

select is(
  public.tf_worked_minutes(null, null, 30),
  0,
  'tf_worked_minutes: ca hai moc NULL -> 0 (tz=UTC)'
);

select is(
  public.tf_worked_minutes(
    timestamptz '2026-03-15 15:00:00+00',
    timestamptz '2026-03-15 23:00:00+00',
    0
  ),
  480,
  'tf_worked_minutes: 22:00 ngay D -> 06:00 ngay D+1 gio VN, 0 phut nghi = 480 (tz=UTC)'
);

/* ============================================================================
   Vong 2/3 — session timezone = Asia/Ho_Chi_Minh
   ========================================================================= */

set timezone to 'Asia/Ho_Chi_Minh';

select is(
  public.tf_shift_minutes('22:00', '06:00', 0),
  480,
  'tf_shift_minutes: 22:00-06:00 qua dem, 0 phut nghi = 480 (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_shift_minutes('22:00', '06:00', 45),
  435,
  'tf_shift_minutes: 22:00-06:00 qua dem, 45 phut nghi = 435 (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_shift_minutes('08:00', '17:30', 90),
  480,
  'tf_shift_minutes: 08:00-17:30 trong ngay, 90 phut nghi = 480 (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_shift_minutes('18:00', '06:00', 60),
  660,
  'tf_shift_minutes: 18:00-06:00 qua dem, 60 phut nghi = 660 (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_shift_minutes('22:00', '00:00', 0),
  120,
  'tf_shift_minutes: 22:00-00:00 cham dung nua dem = 120 (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_shift_minutes('00:00', '08:00', 0),
  480,
  'tf_shift_minutes: 00:00-08:00 bat dau tu nua dem = 480 (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_shift_minutes('14:00', '22:00', 0)
    + public.tf_shift_minutes('22:00', '06:00', 0),
  960,
  'tf_shift_minutes: hai ca lien ke 14:00-22:00 va 22:00-06:00 cong lai = 960, khong mat phut, khong chong lan (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_shift_minutes('08:00', '08:00', 0),
  0,
  'tf_shift_minutes: start = end tra 0, khong phai 1440 (tz=Asia/Ho_Chi_Minh)'
);

select ok(
  public.tf_overnight('22:00', '06:00'),
  'tf_overnight: 22:00-06:00 la ca qua dem (tz=Asia/Ho_Chi_Minh)'
);

select ok(
  not public.tf_overnight('08:00', '17:30'),
  'tf_overnight: 08:00-17:30 khong phai ca qua dem (tz=Asia/Ho_Chi_Minh)'
);

select ok(
  not public.tf_overnight('08:00', '08:00'),
  'tf_overnight: start = end khong tinh la qua dem (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_work_date(timestamptz '2026-03-15 15:00:00+00'),
  date '2026-03-15',
  'tf_work_date: 22:00 gio VN ngay 2026-03-15 (15:00 UTC) -> 2026-03-15 (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_work_date(timestamptz '2026-03-15 17:30:00+00'),
  date '2026-03-16',
  'tf_work_date: 00:30 gio VN ngay 2026-03-16 (17:30 UTC ngay 2026-03-15) -> 2026-03-16 (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_worked_minutes(null, timestamptz '2026-03-15 15:00:00+00', 30),
  0,
  'tf_worked_minutes: check_in NULL -> 0 (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_worked_minutes(timestamptz '2026-03-15 15:00:00+00', null, 30),
  0,
  'tf_worked_minutes: check_out NULL -> 0 (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_worked_minutes(null, null, 30),
  0,
  'tf_worked_minutes: ca hai moc NULL -> 0 (tz=Asia/Ho_Chi_Minh)'
);

select is(
  public.tf_worked_minutes(
    timestamptz '2026-03-15 15:00:00+00',
    timestamptz '2026-03-15 23:00:00+00',
    0
  ),
  480,
  'tf_worked_minutes: 22:00 ngay D -> 06:00 ngay D+1 gio VN, 0 phut nghi = 480 (tz=Asia/Ho_Chi_Minh)'
);

/* ============================================================================
   Vong 3/3 — session timezone = America/New_York
   ========================================================================= */

set timezone to 'America/New_York';

select is(
  public.tf_shift_minutes('22:00', '06:00', 0),
  480,
  'tf_shift_minutes: 22:00-06:00 qua dem, 0 phut nghi = 480 (tz=America/New_York)'
);

select is(
  public.tf_shift_minutes('22:00', '06:00', 45),
  435,
  'tf_shift_minutes: 22:00-06:00 qua dem, 45 phut nghi = 435 (tz=America/New_York)'
);

select is(
  public.tf_shift_minutes('08:00', '17:30', 90),
  480,
  'tf_shift_minutes: 08:00-17:30 trong ngay, 90 phut nghi = 480 (tz=America/New_York)'
);

select is(
  public.tf_shift_minutes('18:00', '06:00', 60),
  660,
  'tf_shift_minutes: 18:00-06:00 qua dem, 60 phut nghi = 660 (tz=America/New_York)'
);

select is(
  public.tf_shift_minutes('22:00', '00:00', 0),
  120,
  'tf_shift_minutes: 22:00-00:00 cham dung nua dem = 120 (tz=America/New_York)'
);

select is(
  public.tf_shift_minutes('00:00', '08:00', 0),
  480,
  'tf_shift_minutes: 00:00-08:00 bat dau tu nua dem = 480 (tz=America/New_York)'
);

select is(
  public.tf_shift_minutes('14:00', '22:00', 0)
    + public.tf_shift_minutes('22:00', '06:00', 0),
  960,
  'tf_shift_minutes: hai ca lien ke 14:00-22:00 va 22:00-06:00 cong lai = 960, khong mat phut, khong chong lan (tz=America/New_York)'
);

select is(
  public.tf_shift_minutes('08:00', '08:00', 0),
  0,
  'tf_shift_minutes: start = end tra 0, khong phai 1440 (tz=America/New_York)'
);

select ok(
  public.tf_overnight('22:00', '06:00'),
  'tf_overnight: 22:00-06:00 la ca qua dem (tz=America/New_York)'
);

select ok(
  not public.tf_overnight('08:00', '17:30'),
  'tf_overnight: 08:00-17:30 khong phai ca qua dem (tz=America/New_York)'
);

select ok(
  not public.tf_overnight('08:00', '08:00'),
  'tf_overnight: start = end khong tinh la qua dem (tz=America/New_York)'
);

select is(
  public.tf_work_date(timestamptz '2026-03-15 15:00:00+00'),
  date '2026-03-15',
  'tf_work_date: 22:00 gio VN ngay 2026-03-15 (15:00 UTC) -> 2026-03-15 (tz=America/New_York)'
);

select is(
  public.tf_work_date(timestamptz '2026-03-15 17:30:00+00'),
  date '2026-03-16',
  'tf_work_date: 00:30 gio VN ngay 2026-03-16 (17:30 UTC ngay 2026-03-15) -> 2026-03-16 (tz=America/New_York)'
);

select is(
  public.tf_worked_minutes(null, timestamptz '2026-03-15 15:00:00+00', 30),
  0,
  'tf_worked_minutes: check_in NULL -> 0 (tz=America/New_York)'
);

select is(
  public.tf_worked_minutes(timestamptz '2026-03-15 15:00:00+00', null, 30),
  0,
  'tf_worked_minutes: check_out NULL -> 0 (tz=America/New_York)'
);

select is(
  public.tf_worked_minutes(null, null, 30),
  0,
  'tf_worked_minutes: ca hai moc NULL -> 0 (tz=America/New_York)'
);

select is(
  public.tf_worked_minutes(
    timestamptz '2026-03-15 15:00:00+00',
    timestamptz '2026-03-15 23:00:00+00',
    0
  ),
  480,
  'tf_worked_minutes: 22:00 ngay D -> 06:00 ngay D+1 gio VN, 0 phut nghi = 480 (tz=America/New_York)'
);

/* ============================================================================
   Enum nghiep vu: du 13 kieu (4 tao o 0002_tenancy.sql + 9 tao o
   0003_enums_time.sql), khong gia tri nao la nhan tieng Viet.
   ========================================================================= */

select is(
  (
    select count(*)::int
    from pg_type
    where typname in (
      'employee_status', 'contract_type', 'gender', 'attendance_status',
      'request_type', 'request_status', 'system_role', 'company_role',
      'department_status', 'shift_status', 'company_size', 'company_accent',
      'membership_status'
    )
  ),
  13,
  'enum: du 13 kieu nghiep vu ton tai trong Postgres (4 tu 0002 + 9 tu 0003)'
);

-- Chi quet enum trong schema `public` (nghia la enum nghiep vu cua TimeFlow).
-- Cac schema he thong cua Supabase (storage.buckettype, ...) co enum nhan
-- UPPERCASE rieng cua ho (vd storage.buckettype: STANDARD/ANALYTICS/VECTOR) —
-- khong phai enum nghiep vu, khong thuoc pham vi khang dinh nay.
select is(
  (
    select count(*)::int
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and e.enumlabel ~ '[^a-z0-9_+-]'
  ),
  0,
  'enum: khong gia tri nao trong schema public chua ky tu ngoai chu thuong/so/gach duoi/cong/tru — tuc khong nhan tieng Viet'
);

select * from finish(true);

rollback;
