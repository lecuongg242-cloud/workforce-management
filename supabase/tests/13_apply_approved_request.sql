-- supabase/tests/13_apply_approved_request.sql
--
-- Tac dong cua mot yeu cau da duyet (migration 0018, plan 05-02). Day la file
-- test tra loi cau hoi lam ca Phase 5 co nghia: duyet xong thi so lieu cong co
-- doi DUNG khong.
--
-- Bo cuc du lieu (nhan vien nv-01a, ca sft-01-day: Thu Hai–Thu Sau, 08:00–17:30,
-- an han 5 phut):
--   2018-03-08 Thu Nam  -> ngay lam viec, chua co du lieu  => SINH ban ghi
--   2018-03-09 Thu Sau  -> khai la NGAY LE                 => bo qua (D-35)
--   2018-03-10 Thu Bay  -> ngoai working_days              => bo qua (D-35)
--   2018-03-11 Chu Nhat -> ngoai working_days              => bo qua (D-35)
--   2018-03-12 Thu Hai  -> DA CO ban ghi cham cong that    => bo qua, vao
--                                                             skipped_dates
--
-- Mot khoang 5 ngay ra dung 1 ban ghi. Neu ham sinh 5 dong, nhan vien mat 5
-- ngay phep cho 2 ngay ho von duoc nghi, 1 ngay le, va 1 ngay ho da di lam.

begin;

select plan(13);

/* ============================================================================
   Fixture — chay o vai tro mac dinh (chu bang, bo qua RLS)
   ========================================================================= */

insert into holidays (company_id, holiday_date, name)
values ('cty-01', '2018-03-09', 'Ngày lễ test 13');

-- Ban ghi cham cong THAT cua ngay 2018-03-12: don nghi phai bo qua ngay nay,
-- va dong nay phai con NGUYEN VEN sau khi ap dung.
insert into attendance_records (
  id, company_id, employee_id, work_date, shift_id,
  check_in_at, check_out_at, worked_minutes, late_minutes,
  early_leave_minutes, status, location, needs_supplement, note
) values (
  'att-t13-real', 'cty-01', 'nv-01a', '2018-03-12', 'sft-01-day',
  public.tf_local_instant('2018-03-12', '07:58'),
  public.tf_local_instant('2018-03-12', '17:35'),
  577, 0, 0, 'on_time', 'Văn phòng chính', false, null
);

-- Ban ghi cua ngay 2018-03-16, de yeu cau dieu chinh gio co cai ma sua.
insert into attendance_records (
  id, company_id, employee_id, work_date, shift_id,
  check_in_at, check_out_at, worked_minutes, late_minutes,
  early_leave_minutes, status, location, needs_supplement, note
) values (
  'att-t13-adjust', 'cty-01', 'nv-01a', '2018-03-16', 'sft-01-day',
  public.tf_local_instant('2018-03-16', '09:00'),
  public.tf_local_instant('2018-03-16', '17:00'),
  480, 55, 0, 'late', 'Văn phòng chính', false, null
);

insert into work_requests (
  id, company_id, employee_id, type, status, from_date, to_date,
  from_time, to_time, reason
) values
  ('wr-t13-leave', 'cty-01', 'nv-01a', 'leave', 'approved',
   '2018-03-08', '2018-03-12', null, null, 'Test 13 — nghỉ phép'),
  ('wr-t13-supp', 'cty-01', 'nv-01a', 'attendance_supplement', 'approved',
   '2018-03-15', '2018-03-15', '08:00', '17:30', 'Test 13 — bổ sung công'),
  ('wr-t13-adjust', 'cty-01', 'nv-01a', 'time_adjustment', 'approved',
   '2018-03-16', '2018-03-16', '08:30', '17:30', 'Test 13 — điều chỉnh giờ'),
  ('wr-t13-noadjust', 'cty-01', 'nv-01a', 'time_adjustment', 'approved',
   '2018-03-19', '2018-03-19', '08:30', '17:30', 'Test 13 — không có bản ghi'),
  ('wr-t13-ot', 'cty-01', 'nv-01a', 'overtime', 'approved',
   '2018-03-20', '2018-03-20', null, null, 'Test 13 — tăng ca'),
  ('wr-t13-pending', 'cty-01', 'nv-01a', 'leave', 'pending',
   '2018-03-22', '2018-03-22', null, null, 'Test 13 — chưa duyệt');

/* ============================================================================
   Xem truoc — cung phep dem, KHONG ghi gi
   ========================================================================= */

select is(
  (select row(inserted_count, updated_count, skipped_count)::text
     from public.tf_preview_request_effect('wr-t13-leave')),
  '(1,0,1)',
  'tf_preview_request_effect: 5 ngay -> 1 ngay sinh ban ghi, 1 ngay bo qua vi da co du lieu'
);

select is(
  (select count(*)::int from attendance_records
    where employee_id = 'nv-01a' and work_date between '2018-03-08' and '2018-03-12'),
  1,
  'tf_preview_request_effect: KHONG ghi gi — van dung mot dong (dong cham cong that co san)'
);

/* ============================================================================
   Ap dung — nghi phep
   ========================================================================= */

select is(
  (select row(inserted_count, updated_count, skipped_count, skipped_dates)::text
     from public.tf_apply_approved_request('wr-t13-leave')),
  '(1,0,1,{2018-03-12})',
  'tf_apply_approved_request(leave): 1 chen, 1 bo qua, va noi RO ngay nao bi bo qua'
);

select results_eq(
  $leave$select work_date, status, check_in_at, check_out_at, worked_minutes
     from attendance_records
    where employee_id = 'nv-01a'
      and work_date between '2018-03-08' and '2018-03-12'
      and id <> 'att-t13-real'
    order by work_date$leave$,
  $exp$values ('2018-03-08'::date, 'leave_paid'::attendance_status,
               null::timestamptz, null::timestamptz, 0)$exp$,
  'tf_apply_approved_request(leave): dung MOT dong nghi phep, hai cot gio deu null (hinh dang cua 0013)'
);

select results_eq(
  $intact$select check_in_at, worked_minutes, status, note
     from attendance_records where id = 'att-t13-real'$intact$,
  $exp2$values (public.tf_local_instant('2018-03-12', '07:58'), 577,
                'on_time'::attendance_status, null::text)$exp2$,
  'tf_apply_approved_request(leave): ban ghi cham cong THAT cua ngay xung dot con nguyen ven'
);

select throws_ok(
  $twice$select public.tf_apply_approved_request('wr-t13-leave')$twice$,
  '23001',
  null,
  'tf_apply_approved_request: goi lan thu hai bi tu choi (applied_at) — khong tru cong hai lan'
);

/* ============================================================================
   Bo sung cong / dieu chinh gio / tang ca
   ========================================================================= */

select lives_ok(
  $supp$select public.tf_apply_approved_request('wr-t13-supp')$supp$,
  'tf_apply_approved_request(attendance_supplement): chay duoc'
);

select results_eq(
  $suppr$select worked_minutes, status, note
     from attendance_records
    where employee_id = 'nv-01a' and work_date = '2018-03-15'$suppr$,
  -- 08:00 -> 17:30 = 570 phut THO (gio nghi khong tru o tang dong, xem 0014)
  $exp3$values (570, 'on_time'::attendance_status,
                'Bổ sung công theo yêu cầu wr-t13-supp'::text)$exp3$,
  'tf_apply_approved_request(attendance_supplement): mot dong dung gio cua yeu cau, mang dau vet nguon goc'
);

select results_eq(
  $adj$select count(*)::int, min(check_in_at), min(late_minutes)
     from attendance_records
    where employee_id = 'nv-01a' and work_date = '2018-03-16'$adj$,
  $exp4$select 1, public.tf_local_instant('2018-03-16', '08:30'), 25$exp4$,
  'tf_apply_approved_request(time_adjustment): SUA dong da co (van 1 dong), gio vao va do muon tinh lai'
);

select throws_ok(
  $noadj$select public.tf_apply_approved_request('wr-t13-noadjust')$noadj$,
  'P0002',
  null,
  'tf_apply_approved_request(time_adjustment): khong co ban ghi thi NEM LOI, khong tu tao moi'
);

/* ============================================================================
   Tang ca — KHONG ghi gi (D-31). Day la khang dinh quan trong nhat cua nhom:
   duyet tang ca la CHO PHEP LAM THEM, so gio van do cham cong that quyet dinh.
   ========================================================================= */

select is(
  (select row(inserted_count, updated_count, skipped_count)::text
     from public.tf_apply_approved_request('wr-t13-ot')),
  '(0,0,0)',
  'tf_apply_approved_request(overtime): khong chen, khong sua — duyet la cho phep, khong phai ghi gio (D-31)'
);

select is(
  (select count(*)::int from attendance_records
    where employee_id = 'nv-01a' and work_date = '2018-03-20'),
  0,
  'tf_apply_approved_request(overtime): khong mot dong cham cong nao duoc tao ra'
);

/* ============================================================================
   Yeu cau chua duyet — ham tu kiem trang thai, khong tin nguoi goi
   ========================================================================= */

select throws_ok(
  $pending$select public.tf_apply_approved_request('wr-t13-pending')$pending$,
  '23001',
  null,
  'tf_apply_approved_request: yeu cau chua duyet bi tu choi (T-05-02-04)'
);

select * from finish(true);

rollback;
