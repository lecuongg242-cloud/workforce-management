-- supabase/seed.sql
--
-- Auth.users gia lap, hai doanh nghiep, memberships, va bo toi thieu cua nam
-- thuc the V1 con lai (departments, shifts, employees, attendance_records,
-- work_requests) — du de test co lap co dong o CA HAI phia cho tung bang.
-- Bo seed day du theo D-06 (28 nhan vien Ngoc Phat, 12 nhan vien Binh Minh,
-- lich su cham cong ca thang, ...) la viec cua plan 01-06.
--
-- Chay lai duoc nhieu lan: `truncate ... restart identity cascade` xoa sach
-- toan bo du lieu doanh nghiep truoc khi chen lai; auth.users dung
-- `on conflict (id) do nothing` vi khong co cot identity de restart.

truncate
  periods, audit_log, overtime_rules, holidays, attendance_photos, work_sites,
  work_requests, attendance_records, employees, shifts, departments,
  memberships, companies
  restart identity cascade;

/* -------------------------------------------------------------------------- */
/* auth.users gia lap — 4 user co dinh dung lam fixture                        */
/* -------------------------------------------------------------------------- */
-- 0001: owner Ngoc Phat | 0002: owner Binh Minh
-- 0003: thanh vien ca hai doanh nghiep (ca thanh vien kep)
-- 0004: khong thuoc doanh nghiep nao (ca khong membership)

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner1@timeflow.test'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner2@timeflow.test'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dualmember@timeflow.test'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nomember@timeflow.test')
on conflict (id) do nothing;

-- Tu day tro di chay trong MOT transaction: departments.manager_id tham
-- chieu toi mot dong employees se chi ton tai o cau insert phia sau (tham
-- chieu tien). Khoa ngoai da khai bao deferrable initially deferred o
-- 0004_core_entities.sql nen chi duoc kiem tra luc COMMIT — neu moi cau la
-- mot autocommit rieng (mac dinh cua psql khi khong co begin/commit) thi
-- insert departments se van bao loi ngay lap tuc.

begin;

/* -------------------------------------------------------------------------- */
/* companies — du lieu port tu src/lib/mock/seed.ts (seedCompanies)            */
/* -------------------------------------------------------------------------- */

insert into companies (id, name, code, industry, size, phone, address, accent) values
  (
    'cty-01',
    'Công ty TNHH Thương mại Ngọc Phát',
    'NGOCPHAT',
    'retail',
    '11-30',
    '028 3822 4567',
    '142 Nguyễn Thị Minh Khai, Quận 3, TP. Hồ Chí Minh',
    'indigo'
  ),
  (
    'cty-02',
    'Xưởng Sản xuất Bình Minh',
    'BINHMINH',
    'manufacturing',
    '31-100',
    '0274 3756 118',
    'Lô C7, KCN Sóng Thần, Dĩ An, Bình Dương',
    'navy'
  );

/* -------------------------------------------------------------------------- */
/* memberships                                                                 */
/* -------------------------------------------------------------------------- */

insert into memberships (user_id, company_id, role, status) values
  ('00000000-0000-0000-0000-000000000001', 'cty-01', 'owner', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'cty-02', 'owner', 'active'),
  ('00000000-0000-0000-0000-000000000003', 'cty-01', 'admin', 'active'),
  ('00000000-0000-0000-0000-000000000003', 'cty-02', 'admin', 'active');
-- User 0004 co ton tai trong auth.users nhung khong co membership nao —
-- dung lam fixture cho ca "khong thuoc doanh nghiep nao doc duoc 0 dong".

/* -------------------------------------------------------------------------- */
/* departments — bo toi thieu: mot phong ban moi cong ty                       */
/* -------------------------------------------------------------------------- */
-- manager_id tham chieu toi nv-01a/nv-02a, chua ton tai luc nay (tham chieu
-- tien) — hop le vi khoa ngoai deferred va toan bo file nay nam trong mot
-- transaction (xem `begin;` o tren).

insert into departments (id, company_id, name, description, manager_id, status) values
  ('dept-01', 'cty-01', 'Kinh doanh', 'Phu trach ban hang va cham soc khach hang', 'nv-01a', 'active'),
  ('dept-02', 'cty-02', 'San xuat', 'Phu trach van hanh day chuyen san xuat', 'nv-02a', 'active');

/* -------------------------------------------------------------------------- */
/* shifts — moi cong ty mot ca ngay + mot ca dem, gia tri khop seedShifts/     */
/* seedShifts2 trong src/lib/mock/seed.ts                                      */
/* -------------------------------------------------------------------------- */

insert into shifts (
  id, company_id, name, code, start_time, end_time,
  break_minutes, late_tolerance_minutes, working_days, status
) values
  -- cty-01: "Ca hanh chinh" (HC, seedShifts[0]) + "Ca dem" (D1, seedShifts[3])
  ('sft-01-day', 'cty-01', 'Ca hành chính', 'HC', '08:00', '17:30', 90, 5, array[1,2,3,4,5]::smallint[], 'active'),
  ('sft-01-night', 'cty-01', 'Ca đêm', 'D1', '22:00', '06:00', 45, 10, array[1,2,3,4,5,6,7]::smallint[], 'active'),
  -- cty-02: "Ca ngay 12 tieng" (N12, seedShifts2[0]) + "Ca dem 12 tieng" (D12, seedShifts2[1])
  ('sft-02-day', 'cty-02', 'Ca ngày 12 tiếng', 'N12', '06:00', '18:00', 60, 10, array[1,3,5,6]::smallint[], 'active'),
  ('sft-02-night', 'cty-02', 'Ca đêm 12 tiếng', 'D12', '18:00', '06:00', 60, 10, array[2,4,7]::smallint[], 'active');

/* -------------------------------------------------------------------------- */
/* employees — hai nhan vien moi cong ty: mot quan ly (manager_id NULL) va    */
/* mot nhan vien bao cao ve nguoi kia (manager_id tro toi quan ly)            */
/* -------------------------------------------------------------------------- */

insert into employees (
  id, company_id, code, full_name, email, phone, date_of_birth, gender,
  avatar_url, department_id, position, contract_type, start_date,
  manager_id, shift_id, work_location, status, system_role,
  invitation_sent, can_view_payslip, can_check_in_remotely, user_id
) values
  (
    'nv-01a', 'cty-01', 'NP001', 'Đoàn Minh Trí', 'tri.doan@ngocphat.test', '090 111 2201',
    '1985-03-12', 'male', null, 'dept-01', 'Trưởng phòng Kinh doanh', 'full_time', '2020-01-06',
    null, 'sft-01-day', 'Văn phòng chính', 'active', 'manager', true, true, false, null
  ),
  (
    'nv-01b', 'cty-01', 'NP002', 'Nguyễn Thị Bích Ngọc', 'ngoc.nguyen@ngocphat.test', '090 111 2202',
    '1992-07-21', 'female', null, 'dept-01', 'Nhân viên kinh doanh', 'full_time', '2021-05-10',
    'nv-01a', 'sft-01-night', 'Văn phòng chính', 'active', 'employee', true, false, true, null
  ),
  (
    'nv-02a', 'cty-02', 'BM001', 'Vương Đức Hiếu', 'hieu.vuong@binhminh.test', '090 222 3301',
    '1983-11-02', 'male', null, 'dept-02', 'Quản đốc phân xưởng', 'full_time', '2019-02-18',
    null, 'sft-02-day', 'Xưởng sản xuất', 'active', 'manager', true, true, false, null
  ),
  (
    'nv-02b', 'cty-02', 'BM002', 'Bùi Thanh Trúc', 'truc.bui@binhminh.test', '090 222 3302',
    '1996-09-14', 'female', null, 'dept-02', 'Công nhân vận hành', 'full_time', '2022-08-01',
    'nv-02a', 'sft-02-night', 'Xưởng sản xuất', 'active', 'employee', true, false, true, null
  );

/* -------------------------------------------------------------------------- */
/* attendance_records — moi cong ty mot ban ghi ca ngay day du va mot ban     */
/* ghi ca dem chua check_out_at (needs_supplement)                            */
/* -------------------------------------------------------------------------- */
-- work_date la ngay bat dau ca (D-08): dung offset +07 tuong minh trong moi
-- literal timestamptz nen tf_work_date luon ra dung ngay lich cua chinh
-- literal do, khong phu thuoc timezone phien cua ket noi dang chay file nay.

insert into attendance_records (
  id, company_id, employee_id, work_date, shift_id,
  check_in_at, check_out_at, worked_minutes, late_minutes, early_leave_minutes,
  status, location, needs_supplement, note
) values
  (
    'att-01a', 'cty-01', 'nv-01a', '2026-07-28', 'sft-01-day',
    '2026-07-28 08:10:00+07', '2026-07-28 17:15:00+07',
    public.tf_worked_minutes('2026-07-28 08:10:00+07'::timestamptz, '2026-07-28 17:15:00+07'::timestamptz, 90),
    0, 0, 'on_time', 'Văn phòng chính', false, null
  ),
  (
    'att-01b', 'cty-01', 'nv-01b', '2026-07-28', 'sft-01-night',
    '2026-07-28 22:05:00+07', null,
    0, 0, 0, 'missing_checkout', 'Văn phòng chính', true, 'Chưa ghi nhận giờ ra'
  ),
  (
    'att-02a', 'cty-02', 'nv-02a', '2026-07-28', 'sft-02-day',
    '2026-07-28 06:05:00+07', '2026-07-28 18:10:00+07',
    public.tf_worked_minutes('2026-07-28 06:05:00+07'::timestamptz, '2026-07-28 18:10:00+07'::timestamptz, 60),
    0, 0, 'on_time', 'Xưởng sản xuất', false, null
  ),
  (
    'att-02b', 'cty-02', 'nv-02b', '2026-07-28', 'sft-02-night',
    '2026-07-28 18:05:00+07', null,
    0, 0, 0, 'missing_checkout', 'Xưởng sản xuất', true, 'Chưa ghi nhận giờ ra'
  );

/* -------------------------------------------------------------------------- */
/* work_requests — moi cong ty mot yeu cau nghi phep, from_time/to_time NULL  */
/* -------------------------------------------------------------------------- */

insert into work_requests (
  id, company_id, employee_id, type, status, from_date, to_date,
  from_time, to_time, reason, reviewer_id, review_note, reviewed_at
) values
  (
    'wr-01', 'cty-01', 'nv-01b', 'leave', 'pending', '2026-08-03', '2026-08-04',
    null, null, 'Nghỉ phép việc gia đình', null, null, null
  ),
  (
    'wr-02', 'cty-02', 'nv-02b', 'leave', 'pending', '2026-08-05', '2026-08-05',
    null, null, 'Xin nghỉ khám sức khỏe', null, null, null
  );

/* -------------------------------------------------------------------------- */
/* work_sites — moi cong ty mot dia diem lam viec                             */
/* -------------------------------------------------------------------------- */

insert into work_sites (id, company_id, name, latitude, longitude, radius_meters, is_active) values
  ('ws-01', 'cty-01', 'Văn phòng chính', 10.782300, 106.695800, 150, true),
  ('ws-02', 'cty-02', 'Xưởng sản xuất', 10.895500, 106.771200, 200, true);

/* -------------------------------------------------------------------------- */
/* attendance_photos — gan vao ban ghi cham cong da seed o tren; duong dan    */
/* bat dau bang chinh company_id (CHECK cua bang buoc dieu nay)               */
/* -------------------------------------------------------------------------- */

insert into attendance_photos (
  company_id, attendance_record_id, kind, storage_path, captured_at
) values
  ('cty-01', 'att-01a', 'check_in', 'cty-01/nv-01a/att-01a-check_in.jpg', '2026-07-28 08:10:00+07'),
  ('cty-02', 'att-02a', 'check_in', 'cty-02/nv-02a/att-02a-check_in.jpg', '2026-07-28 06:05:00+07');

/* -------------------------------------------------------------------------- */
/* holidays — CO Y de rong o ca hai cong ty; khong chen dong nao o day.       */
/* Doanh nghiep moi khoi tao khong co ngay le cai san la trang thai hop le.   */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* overtime_rules — moi cong ty mot he so cho rule_key = 'weekday'            */
/* -------------------------------------------------------------------------- */

insert into overtime_rules (company_id, rule_key, multiplier, effective_from) values
  ('cty-01', 'weekday', 1.50, '2026-01-01'),
  ('cty-02', 'weekday', 1.50, '2026-01-01');

/* -------------------------------------------------------------------------- */
/* audit_log — moi cong ty mot dong ghi thao tac tao nhan vien quan ly        */
/* -------------------------------------------------------------------------- */

insert into audit_log (company_id, actor_user_id, action, entity_table, entity_id, after) values
  (
    'cty-01', '00000000-0000-0000-0000-000000000001', 'insert', 'employees', 'nv-01a',
    jsonb_build_object('full_name', 'Đoàn Minh Trí', 'status', 'active')
  ),
  (
    'cty-02', '00000000-0000-0000-0000-000000000002', 'insert', 'employees', 'nv-02a',
    jsonb_build_object('full_name', 'Vương Đức Hiếu', 'status', 'active')
  );

/* -------------------------------------------------------------------------- */
/* periods — mot ky cong dang mo cho thang hien tai, tinh theo Asia/Ho_Chi_   */
/* Minh (D-07: du lieu seed truot theo ngay chay, khong chot cung nhu V1)     */
/* -------------------------------------------------------------------------- */

insert into periods (company_id, start_date, end_date, status) values
  (
    'cty-01',
    date_trunc('month', now() at time zone public.tf_tz())::date,
    (date_trunc('month', now() at time zone public.tf_tz()) + interval '1 month - 1 day')::date,
    'open'
  ),
  (
    'cty-02',
    date_trunc('month', now() at time zone public.tf_tz())::date,
    (date_trunc('month', now() at time zone public.tf_tz()) + interval '1 month - 1 day')::date,
    'open'
  );

commit;
