-- supabase/tests/15_period_close.sql
--
-- Chot ky va bao ve ky da chot (migration 0021, plan 05-05). Day la bat bien
-- nang nhat cua Phase 5.
--
-- HAI KHANG DINH LIEN NHAU O CUOI FILE la bang chung quan trong nhat: co
-- `tf.applying_approved_request` bat thi ghi duoc, TAT di thi lai bi chan
-- ngay. Neu co ro ra ngoai — hoac neu trigger doc no sai — thi ca hai chieu
-- deu se xanh voi mot cai khoa da hong (T-05-05-02).
--
-- Ky dung lam vi du: thang 02/2016 (da qua tu lau, 29 ngay).

begin;

select plan(11);

/* ============================================================================
   Ky DANG MO — cham cong binh thuong, trigger khong duoc dong toi
   ========================================================================= */

select lives_ok(
  $open$insert into attendance_records (
     id, company_id, employee_id, work_date, shift_id,
     check_in_at, check_out_at, worked_minutes, late_minutes,
     early_leave_minutes, status, location, needs_supplement, note
   ) values (
     'att-t15-open', 'cty-01', 'nv-01a', '2016-02-01', 'sft-01-day',
     public.tf_local_instant('2016-02-01', '08:00'),
     public.tf_local_instant('2016-02-01', '17:00'),
     540, 0, 0, 'on_time', 'Văn phòng chính', false, null
   )$open$,
  'attendance_records: ky chua ton tai/dang mo -> ghi binh thuong (trigger khong chan nham)'
);

/* ============================================================================
   Chot ky — 4 khang dinh
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

-- Ky CHUA KET THUC: thang cua chinh hom nay khong chot duoc.
select throws_ok(
  format(
    $fut$select public.tf_close_period('cty-01', %L::date)$fut$,
    date_trunc('month', public.tf_work_date(now()))::date
  ),
  '23001',
  null,
  'tf_close_period: ky chua ket thuc bi tu choi (T-05-05-05)'
);

select is(
  (select status::text from public.tf_close_period('cty-01', '2016-02-01')),
  'closed',
  'tf_close_period: ky da ket thuc chot duoc, va tu tao dong ky neu chua co'
);

select is(
  (select closed_by from periods
    where company_id = 'cty-01' and start_date = '2016-02-01'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'tf_close_period: closed_by la nguoi dang thuc hien, khong phai NULL (T-05-05-04)'
);

select throws_ok(
  $twice$select public.tf_close_period('cty-01', '2016-02-01')$twice$,
  '23001',
  null,
  'tf_close_period: chot lan thu hai bi tu choi'
);

/* ============================================================================
   Ky DA CHOT — ba lenh ghi deu bi chan
   ========================================================================= */

select throws_ok(
  $ins$insert into attendance_records (
     id, company_id, employee_id, work_date, shift_id,
     check_in_at, check_out_at, worked_minutes, late_minutes,
     early_leave_minutes, status, location, needs_supplement, note
   ) values (
     'att-t15-blocked', 'cty-01', 'nv-01a', '2016-02-10', 'sft-01-day',
     null, null, 0, 0, 0, 'leave_paid', 'Văn phòng chính', false, null
   )$ins$,
  'TF001',
  null,
  'attendance_records: INSERT vao ky da chot bi trigger tu choi (PERD-02)'
);

select throws_ok(
  $upd$update attendance_records set worked_minutes = 1
     where id = 'att-t15-open'$upd$,
  'TF001',
  null,
  'attendance_records: UPDATE dong cu cua ky da chot bi tu choi'
);

select throws_ok(
  $del$delete from attendance_records where id = 'att-t15-open'$del$,
  'TF001',
  null,
  'attendance_records: DELETE dong cua ky da chot bi tu choi'
);

/* ============================================================================
   Ky KHAC van khong bi anh huong
   ========================================================================= */

select lives_ok(
  $other$insert into attendance_records (
     id, company_id, employee_id, work_date, shift_id,
     check_in_at, check_out_at, worked_minutes, late_minutes,
     early_leave_minutes, status, location, needs_supplement, note
   ) values (
     'att-t15-other-month', 'cty-01', 'nv-01a', '2016-03-01', 'sft-01-day',
     public.tf_local_instant('2016-03-01', '08:00'),
     public.tf_local_instant('2016-03-01', '17:00'),
     540, 0, 0, 'on_time', 'Văn phòng chính', false, null
   )$other$,
  'attendance_records: thang KHAC (chua chot) van ghi binh thuong'
);

/* ============================================================================
   Co bo qua trigger — hai khang dinh LIEN NHAU, bang chung co khong ro
   ========================================================================= */

select set_config('tf.applying_approved_request', 'on', true);

select lives_ok(
  $flag$insert into attendance_records (
     id, company_id, employee_id, work_date, shift_id,
     check_in_at, check_out_at, worked_minutes, late_minutes,
     early_leave_minutes, status, location, needs_supplement, note
   ) values (
     'att-t15-via-flag', 'cty-01', 'nv-01a', '2016-02-11', 'sft-01-day',
     null, null, 0, 0, 0, 'leave_paid', 'Văn phòng chính', false, null
   )$flag$,
  'attendance_records: co tf.applying_approved_request bat -> duong hop le di duoc vao ky da chot'
);

select set_config('tf.applying_approved_request', 'off', true);

select throws_ok(
  $noflag$insert into attendance_records (
     id, company_id, employee_id, work_date, shift_id,
     check_in_at, check_out_at, worked_minutes, late_minutes,
     early_leave_minutes, status, location, needs_supplement, note
   ) values (
     'att-t15-after-flag', 'cty-01', 'nv-01a', '2016-02-12', 'sft-01-day',
     null, null, 0, 0, 0, 'leave_paid', 'Văn phòng chính', false, null
   )$noflag$,
  'TF001',
  null,
  'attendance_records: co TAT -> lai bi chan ngay; cai khoa phu thuoc DUNG vao co (T-05-05-02)'
);

select tf_test_logout();

select * from finish(true);

rollback;
