-- supabase/seed.sql
--
-- Bo seed day du theo D-06: port toan bo du lieu mau V1 (src/lib/mock/seed.ts,
-- 1285 dong) sang hai doanh nghiep - Ngoc Phat (28 nhan vien) va Binh Minh
-- (12 nhan vien) - 9 phong ban, 7 ca lam viec (moi ben mot ca dem), 12 yeu
-- cau cong (8 pending), va lich su cham cong ~30 ngay cho TUNG nhan vien.
--
-- D-07: moc thoi gian trong seed TRUOT theo ngay chay, khong chot cung nhu
-- hang REFERENCE_DATE cua V1 (xem src/lib/constants.ts). Moc neo duy nhat la
-- public.tf_work_date(now()) - hom nay theo Asia/Ho_Chi_Minh - va moi ngay
-- van hanh (cham cong, yeu cau cong, ky cong) deu sinh bang phep cong/tru so
-- ngay tu moc do. Ngay sinh/ngay vao lam cua nhan vien la du lieu ho so nen
-- giu nguyen gia tri tuyet doi tu seed.ts.
--
-- Id doi ten so voi seed.ts de giu duoc bon id neo ma bo test co lap cua cac
-- plan truoc (01-04, 01-05) da hardcode: department 'dept-01'/'dept-02',
-- shift 'sft-01-day'/'sft-02-day', employee 'nv-01a'/'nv-02a', attendance
-- 'att-02a'. Nhan vien dau tien cua cty-01 (nv-01a) la Nguyen Minh Anh -
-- NV001, nhan vien demo cua Phase 2.
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
-- 0004_core_entities.sql nen chi duoc kiem tra luc COMMIT.

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

insert into memberships (user_id, company_id, role, status, last_accessed_at) values
  ('00000000-0000-0000-0000-000000000001', 'cty-01', 'owner', 'active', now()),
  ('00000000-0000-0000-0000-000000000002', 'cty-02', 'owner', 'active', now()),
  ('00000000-0000-0000-0000-000000000003', 'cty-01', 'admin', 'active', now()),
  ('00000000-0000-0000-0000-000000000003', 'cty-02', 'admin', 'active', now());
-- User 0004 co ton tai trong auth.users nhung khong co membership nao —
-- dung lam fixture cho ca "khong thuoc doanh nghiep nao doc duoc 0 dong".

/* -------------------------------------------------------------------------- */
/* departments — 9 dong (5 cty-01 + 4 cty-02), port tu seedDepartments +      */
/* seedDepartments2. Id danh so xen ke (dept-01=cty-01, dept-02=cty-02, ...)  */
/* de giu duoc dung hai id neo ma 03_isolation_core.sql da hardcode.          */
/* manager_id de NULL o day, dien sau khi employees da ton tai (xem update    */
/* ben duoi — dung tham chieu tien duoc vi khoa ngoai deferred).              */
/* -------------------------------------------------------------------------- */

insert into departments (id, company_id, name, description, status) values
  ('dept-01', 'cty-01', 'Ban giám đốc', 'Điều hành chung, hoạch định chiến lược và phê duyệt ngân sách.', 'active'),
  ('dept-02', 'cty-02', 'Phân xưởng A', 'Dây chuyền ép nhựa và tạo hình sản phẩm.', 'active'),
  ('dept-03', 'cty-01', 'Kinh doanh', 'Phát triển khách hàng, chăm sóc đại lý và triển khai doanh số.', 'active'),
  ('dept-04', 'cty-02', 'Phân xưởng B', 'Lắp ráp, hoàn thiện và đóng gói thành phẩm.', 'active'),
  ('dept-05', 'cty-01', 'Kế toán', 'Quản lý thu chi, công nợ, hóa đơn và báo cáo tài chính.', 'active'),
  ('dept-06', 'cty-02', 'Hành chính nhân sự', 'Tuyển dụng, chấm công và các thủ tục hành chính.', 'active'),
  ('dept-07', 'cty-01', 'Kho vận', 'Nhập xuất hàng hóa, kiểm kê tồn kho và điều phối giao nhận.', 'active'),
  ('dept-08', 'cty-02', 'Bảo trì thiết bị', 'Bảo dưỡng định kỳ và sửa chữa máy móc dây chuyền.', 'inactive'),
  ('dept-09', 'cty-01', 'Sản xuất', 'Vận hành dây chuyền, kiểm soát chất lượng và bảo trì thiết bị.', 'active');

/* -------------------------------------------------------------------------- */
/* shifts — 7 dong (4 cty-01 + 3 cty-02), port tu seedShifts + seedShifts2.   */
/* Moi cong ty dung mot ca dem (D-08): sft-01-night va sft-02-night.          */
/* overnight KHONG duoc chen — do la cot sinh, tu suy tu start_time/end_time. */
/* -------------------------------------------------------------------------- */

insert into shifts (
  id, company_id, name, code, start_time, end_time,
  break_minutes, late_tolerance_minutes, working_days, status
) values
  ('sft-01-day', 'cty-01', 'Ca hành chính', 'HC', '08:00', '17:30', 90, 5, array[1,2,3,4,5]::smallint[], 'active'),
  ('sft-01-morning', 'cty-01', 'Ca sáng', 'S1', '06:00', '14:00', 30, 10, array[1,2,3,4,5,6]::smallint[], 'active'),
  ('sft-01-afternoon', 'cty-01', 'Ca chiều', 'C1', '14:00', '22:00', 30, 10, array[1,2,3,4,5,6]::smallint[], 'active'),
  ('sft-01-night', 'cty-01', 'Ca đêm', 'D1', '22:00', '06:00', 45, 10, array[1,2,3,4,5,6,7]::smallint[], 'active'),
  ('sft-02-day', 'cty-02', 'Ca ngày 12 tiếng', 'N12', '06:00', '18:00', 60, 10, array[1,3,5,6]::smallint[], 'active'),
  ('sft-02-night', 'cty-02', 'Ca đêm 12 tiếng', 'D12', '18:00', '06:00', 60, 10, array[2,4,7]::smallint[], 'active'),
  ('sft-02-admin', 'cty-02', 'Ca hành chính xưởng', 'HCX', '07:30', '16:30', 60, 5, array[1,2,3,4,5,6]::smallint[], 'active');

/* -------------------------------------------------------------------------- */
/* employees — 40 dong (28 cty-01 + 12 cty-02), port tu employeeSeeds +      */
/* employee2Seeds. Nhan vien dau tien cua moi cong ty giu id neo 'nv-01a'/   */
/* 'nv-02a' (03_isolation_core.sql, 04_isolation_v2.sql hardcode id nay) va  */
/* duoc gan user_id toi user owner tuong ung de Phase 2 co san cap tai khoan */
/* <-> nhan vien. nv-01a = Nguyen Minh Anh (NV001), nhan vien demo.          */
/* -------------------------------------------------------------------------- */

insert into employees (
  id, company_id, code, full_name, email, phone, date_of_birth, gender,
  avatar_url, department_id, position, contract_type, start_date,
  manager_id, shift_id, work_location, status, system_role,
  invitation_sent, can_view_payslip, can_check_in_remotely, user_id
) values
  (
    'nv-01a', 'cty-01', 'NV001', 'Nguyễn Minh Anh', 'nv001@ngocphat.test', '0901000137',
    '1997-04-12', 'female', null, 'dept-03', 'Nhân viên kinh doanh', 'full_time', '2023-03-06',
    'nv-05', 'sft-01-day', 'Văn phòng chính', 'active', 'employee',
    true, true, false, '00000000-0000-0000-0000-000000000001'::uuid
  ),
  (
    'nv-02', 'cty-01', 'NV002', 'Trần Hoàng Nam', 'nv002@ngocphat.test', '0901000274',
    '1983-09-25', 'male', null, 'dept-01', 'Giám đốc điều hành', 'full_time', '2019-01-02',
    null, 'sft-01-day', 'Văn phòng chính', 'active', 'owner',
    true, true, true, null
  ),
  (
    'nv-03', 'cty-01', 'NV003', 'Lê Thu Hương', 'nv003@ngocphat.test', '0901000411',
    '1993-11-03', 'female', null, 'dept-05', 'Kế toán tổng hợp', 'full_time', '2021-06-14',
    'nv-11', 'sft-01-day', 'Văn phòng chính', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv-04', 'cty-01', 'NV004', 'Phạm Quốc Khánh', 'nv004@ngocphat.test', '0901000548',
    '1995-02-18', 'male', null, 'dept-07', 'Nhân viên kho', 'full_time', '2022-08-01',
    'nv-16', 'sft-01-morning', 'Kho Long An', 'active', 'employee',
    true, true, false, null
  ),
  (
    'nv-05', 'cty-01', 'NV005', 'Vũ Ngọc Mai', 'nv005@ngocphat.test', '0901000685',
    '1990-07-30', 'female', null, 'dept-03', 'Trưởng phòng kinh doanh', 'full_time', '2020-02-17',
    'nv-02', 'sft-01-day', 'Văn phòng chính', 'active', 'manager',
    true, true, true, null
  ),
  (
    'nv-06', 'cty-01', 'NV006', 'Đỗ Văn Thành', 'nv006@ngocphat.test', '0901000822',
    '1994-12-05', 'male', null, 'dept-09', 'Công nhân vận hành', 'full_time', '2022-04-11',
    'nv-21', 'sft-01-afternoon', 'Nhà máy Bình Dương', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv-07', 'cty-01', 'NV007', 'Bùi Thị Lan Phương', 'nv007@ngocphat.test', '0901000959',
    '1998-06-21', 'female', null, 'dept-03', 'Nhân viên chăm sóc khách hàng', 'full_time', '2023-09-18',
    'nv-05', 'sft-01-day', 'Văn phòng chính', 'active', 'employee',
    true, true, false, null
  ),
  (
    'nv-08', 'cty-01', 'NV008', 'Hoàng Đức Duy', 'nv008@ngocphat.test', '0901001096',
    '2001-01-09', 'male', null, 'dept-03', 'Nhân viên kinh doanh', 'probation', '2026-06-15',
    'nv-05', 'sft-01-day', 'Chi nhánh Quận 7', 'active', 'employee',
    true, true, false, null
  ),
  (
    'nv-09', 'cty-01', 'NV009', 'Ngô Thanh Tuyền', 'nv009@ngocphat.test', '0901001233',
    '2000-10-14', 'female', null, 'dept-03', 'Nhân viên telesales', 'part_time', '2025-03-03',
    'nv-05', 'sft-01-afternoon', 'Làm việc từ xa', 'on_leave', 'employee',
    true, false, true, null
  ),
  (
    'nv-10', 'cty-01', 'NV010', 'Đặng Hữu Tài', 'nv010@ngocphat.test', '0901001370',
    '1992-03-27', 'male', null, 'dept-03', 'Giám sát bán hàng', 'full_time', '2021-11-08',
    'nv-05', 'sft-01-day', 'Chi nhánh Quận 7', 'active', 'employee',
    true, true, false, null
  ),
  (
    'nv-11', 'cty-01', 'NV011', 'Trịnh Bảo Châu', 'nv011@ngocphat.test', '0901001507',
    '1987-08-08', 'female', null, 'dept-05', 'Kế toán trưởng', 'full_time', '2019-05-20',
    'nv-02', 'sft-01-day', 'Văn phòng chính', 'active', 'manager',
    true, true, true, null
  ),
  (
    'nv-12', 'cty-01', 'NV012', 'Lý Gia Huy', 'nv012@ngocphat.test', '0901001644',
    '1996-05-19', 'male', null, 'dept-05', 'Kế toán công nợ', 'full_time', '2023-01-16',
    'nv-11', 'sft-01-day', 'Văn phòng chính', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv-13', 'cty-01', 'NV013', 'Cao Thị Kim Ngân', 'nv013@ngocphat.test', '0901001781',
    '1999-09-02', 'female', null, 'dept-05', 'Kế toán kho', 'full_time', '2024-07-01',
    'nv-11', 'sft-01-day', 'Kho Long An', 'active', 'employee',
    true, true, false, null
  ),
  (
    'nv-14', 'cty-01', 'NV014', 'Nguyễn Hải Đăng', 'nv014@ngocphat.test', '0901001918',
    '2004-02-11', 'male', null, 'dept-05', 'Thực tập sinh kế toán', 'intern', '2026-05-04',
    'nv-11', 'sft-01-day', 'Văn phòng chính', 'pending_invite', 'employee',
    false, true, false, null
  ),
  (
    'nv-15', 'cty-01', 'NV015', 'Trương Mỹ Duyên', 'nv015@ngocphat.test', '0901002055',
    '1995-12-24', 'female', null, 'dept-07', 'Nhân viên chứng từ', 'full_time', '2022-12-05',
    'nv-16', 'sft-01-morning', 'Kho Long An', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv-16', 'cty-01', 'NV016', 'Phan Trọng Nghĩa', 'nv016@ngocphat.test', '0901002192',
    '1989-04-04', 'male', null, 'dept-07', 'Trưởng kho', 'full_time', '2020-09-14',
    'nv-02', 'sft-01-morning', 'Kho Long An', 'active', 'manager',
    true, true, true, null
  ),
  (
    'nv-17', 'cty-01', 'NV017', 'Võ Thành Luân', 'nv017@ngocphat.test', '0901002329',
    '1997-07-16', 'male', null, 'dept-07', 'Tài xế giao hàng', 'seasonal', '2026-02-09',
    'nv-16', 'sft-01-morning', 'Kho Long An', 'active', 'employee',
    true, true, false, null
  ),
  (
    'nv-18', 'cty-01', 'NV018', 'Huỳnh Nhật Minh', 'nv018@ngocphat.test', '0901002466',
    '2002-08-30', 'male', null, 'dept-07', 'Nhân viên bốc xếp', 'part_time', '2025-10-20',
    'nv-16', 'sft-01-afternoon', 'Kho Long An', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv-19', 'cty-01', 'NV019', 'Dương Khánh Vy', 'nv019@ngocphat.test', '0901002603',
    '1998-01-28', 'female', null, 'dept-07', 'Nhân viên kiểm kê', 'full_time', '2024-03-11',
    'nv-16', 'sft-01-morning', 'Kho Long An', 'active', 'employee',
    true, true, false, null
  ),
  (
    'nv-20', 'cty-01', 'NV020', 'Tô Anh Kiệt', 'nv020@ngocphat.test', '0901002740',
    '1994-10-07', 'male', null, 'dept-07', 'Nhân viên điều phối', 'full_time', '2023-06-26',
    'nv-16', 'sft-01-morning', 'Kho Long An', 'terminated', 'employee',
    true, true, false, null
  ),
  (
    'nv-21', 'cty-01', 'NV021', 'Lâm Thị Bích Hạnh', 'nv021@ngocphat.test', '0901002877',
    '1986-06-13', 'female', null, 'dept-09', 'Quản đốc phân xưởng', 'full_time', '2019-10-01',
    'nv-02', 'sft-01-afternoon', 'Nhà máy Bình Dương', 'active', 'manager',
    true, true, true, null
  ),
  (
    'nv-22', 'cty-01', 'NV022', 'Chu Văn Lộc', 'nv022@ngocphat.test', '0901003014',
    '1993-03-15', 'male', null, 'dept-09', 'Công nhân vận hành', 'full_time', '2021-07-19',
    'nv-21', 'sft-01-night', 'Nhà máy Bình Dương', 'active', 'employee',
    true, true, false, null
  ),
  (
    'nv-23', 'cty-01', 'NV023', 'Đinh Thị Hồng Nhung', 'nv023@ngocphat.test', '0901003151',
    '1996-11-11', 'female', null, 'dept-09', 'Nhân viên kiểm định chất lượng', 'full_time', '2022-01-24',
    'nv-21', 'sft-01-afternoon', 'Nhà máy Bình Dương', 'active', 'employee',
    true, true, false, null
  ),
  (
    'nv-24', 'cty-01', 'NV024', 'Mai Xuân Trường', 'nv024@ngocphat.test', '0901003288',
    '1991-09-09', 'male', null, 'dept-09', 'Kỹ thuật viên bảo trì', 'full_time', '2020-05-11',
    'nv-21', 'sft-01-night', 'Nhà máy Bình Dương', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv-25', 'cty-01', 'NV025', 'Hà Thị Ngọc Trâm', 'nv025@ngocphat.test', '0901003425',
    '2000-05-22', 'female', null, 'dept-09', 'Công nhân đóng gói', 'seasonal', '2026-04-06',
    'nv-21', 'sft-01-morning', 'Nhà máy Bình Dương', 'active', 'employee',
    true, true, false, null
  ),
  (
    'nv-26', 'cty-01', 'NV026', 'Lưu Đình Phúc', 'nv026@ngocphat.test', '0901003562',
    '1998-12-30', 'male', null, 'dept-09', 'Công nhân vận hành', 'full_time', '2023-11-13',
    'nv-21', 'sft-01-night', 'Nhà máy Bình Dương', 'on_leave', 'employee',
    true, true, false, null
  ),
  (
    'nv-27', 'cty-01', 'NV027', 'Nguyễn Thị Thu Hà', 'nv027@ngocphat.test', '0901003699',
    '1999-02-06', 'female', null, 'dept-09', 'Công nhân đóng gói', 'full_time', '2024-09-09',
    'nv-21', 'sft-01-morning', 'Nhà máy Bình Dương', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv-28', 'cty-01', 'NV028', 'Trần Gia Bảo', 'nv028@ngocphat.test', '0901003836',
    '1997-10-19', 'male', null, 'dept-01', 'Trợ lý giám đốc', 'full_time', '2024-01-08',
    'nv-02', 'sft-01-day', 'Văn phòng chính', 'pending_invite', 'admin',
    false, true, true, null
  ),
  (
    'nv-02a', 'cty-02', 'BM001', 'Đoàn Minh Trí', 'bm001@binhminh.test', '0902000149',
    '1985-03-18', 'male', null, 'dept-02', 'Quản đốc phân xưởng A', 'full_time', '2020-04-06',
    null, 'sft-02-day', 'Nhà máy Bình Dương', 'active', 'manager',
    true, true, false, '00000000-0000-0000-0000-000000000002'::uuid
  ),
  (
    'nv2-02', 'cty-02', 'BM002', 'Nguyễn Thị Bích Ngọc', 'bm002@binhminh.test', '0902000298',
    '1996-08-24', 'female', null, 'dept-02', 'Công nhân ép nhựa', 'full_time', '2022-02-14',
    null, 'sft-02-day', 'Nhà máy Bình Dương', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv2-03', 'cty-02', 'BM003', 'Trần Văn Sơn', 'bm003@binhminh.test', '0902000447',
    '1994-11-02', 'male', null, 'dept-02', 'Công nhân ép nhựa', 'full_time', '2021-09-20',
    null, 'sft-02-night', 'Nhà máy Bình Dương', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv2-04', 'cty-02', 'BM004', 'Lê Thị Hồng Vân', 'bm004@binhminh.test', '0902000596',
    '1990-05-30', 'female', null, 'dept-04', 'Tổ trưởng lắp ráp', 'full_time', '2019-11-11',
    null, 'sft-02-day', 'Nhà máy Bình Dương', 'active', 'manager',
    true, true, false, null
  ),
  (
    'nv2-05', 'cty-02', 'BM005', 'Phạm Hoàng Long', 'bm005@binhminh.test', '0902000745',
    '2001-01-15', 'male', null, 'dept-04', 'Công nhân đóng gói', 'seasonal', '2026-03-02',
    null, 'sft-02-night', 'Nhà máy Bình Dương', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv2-06', 'cty-02', 'BM006', 'Hồ Thị Kim Chi', 'bm006@binhminh.test', '0902000894',
    '1998-07-07', 'female', null, 'dept-04', 'Công nhân đóng gói', 'full_time', '2023-05-08',
    null, 'sft-02-day', 'Nhà máy Bình Dương', 'on_leave', 'employee',
    true, false, false, null
  ),
  (
    'nv2-07', 'cty-02', 'BM007', 'Vương Đức Hiếu', 'bm007@binhminh.test', '0902001043',
    '1988-12-12', 'male', null, 'dept-06', 'Trưởng phòng nhân sự', 'full_time', '2020-01-13',
    null, 'sft-02-admin', 'Nhà máy Bình Dương', 'active', 'admin',
    true, true, false, null
  ),
  (
    'nv2-08', 'cty-02', 'BM008', 'Bùi Thanh Trúc', 'bm008@binhminh.test', '0902001192',
    '1999-04-19', 'female', null, 'dept-06', 'Nhân viên chấm công', 'full_time', '2024-06-03',
    null, 'sft-02-admin', 'Nhà máy Bình Dương', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv2-09', 'cty-02', 'BM009', 'Nguyễn Văn Cường', 'bm009@binhminh.test', '0902001341',
    '1992-09-28', 'male', null, 'dept-08', 'Kỹ thuật viên bảo trì', 'full_time', '2021-03-15',
    null, 'sft-02-night', 'Nhà máy Bình Dương', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv2-10', 'cty-02', 'BM010', 'Trịnh Quốc Đạt', 'bm010@binhminh.test', '0902001490',
    '2000-06-11', 'male', null, 'dept-08', 'Kỹ thuật viên bảo trì', 'probation', '2026-07-01',
    null, 'sft-02-admin', 'Nhà máy Bình Dương', 'pending_invite', 'employee',
    false, false, false, null
  ),
  (
    'nv2-11', 'cty-02', 'BM011', 'Đặng Thị Lệ Quyên', 'bm011@binhminh.test', '0902001639',
    '1997-02-26', 'female', null, 'dept-04', 'Nhân viên kiểm tra chất lượng', 'part_time', '2025-08-18',
    null, 'sft-02-day', 'Nhà máy Bình Dương', 'active', 'employee',
    true, false, false, null
  ),
  (
    'nv2-12', 'cty-02', 'BM012', 'Lý Văn Tuấn', 'bm012@binhminh.test', '0902001788',
    '1993-10-04', 'male', null, 'dept-02', 'Công nhân tạo hình', 'full_time', '2022-07-25',
    null, 'sft-02-night', 'Nhà máy Bình Dương', 'terminated', 'employee',
    true, false, false, null
  );

/* -------------------------------------------------------------------------- */
/* departments.manager_id — dien sau khi employees da ton tai, dung cach     */
/* seed.ts dat managerId cho phong ban truoc khi nhan vien duoc dinh nghia.  */
/* dept-08 (Bao tri thiet bi) khong co manager, giu NULL nhu seedDepartments2 */
/* -------------------------------------------------------------------------- */

update departments as d set manager_id = v.manager_id
from (values
  ('dept-01', 'nv-02'),
  ('dept-02', 'nv-02a'),
  ('dept-03', 'nv-05'),
  ('dept-04', 'nv2-04'),
  ('dept-05', 'nv-11'),
  ('dept-06', 'nv2-07'),
  ('dept-07', 'nv-16'),
  ('dept-09', 'nv-21')
) as v(dept_id, manager_id)
where d.id = v.dept_id;

/* -------------------------------------------------------------------------- */
/* attendance_records — lich su ~30 ngay cho TUNG nhan vien (must_have: "lich */
/* su cham cong ca thang cho tung nhan vien"), sinh bang generate_series lui  */
/* tu moc neo public.tf_work_date(now()) (D-07). Tai tao chu ky 8 ngay cua    */
/* buildMonthlyHistory trong src/lib/mock/db.ts: gio vao/ra dinh nghia bang   */
/* do lech phut so voi start_time/end_time CUA CHINH CA nhan vien do (khong  */
/* phai gio tuyet doi nhu ban goc, vi ban goc chi ap cho mot nhan vien mot   */
/* ca hanh chinh — ap dung nguyen van cho ca dem se ra du lieu vo nghia).    */
/* Ngay khong nam trong working_days cua ca -> status 'day_off'. O vi tri    */
/* chu ky thu 6 (lich su goc la leave_paid), luan phien sang leave_unpaid o  */
/* nua sau moi 16 ngay de bao phu ca 7 trang thai attendance_status.         */
/*                                                                            */
/* Rieng ca overnight (D-08, tieu chi nghiem thu so 5): moi ban ghi co ca hai */
/* moc gio phai co worked_minutes bang DUNG public.tf_shift_minutes cua ca —  */
/* khong duoc lech theo do tre/som nhu ca ngay, vi lech se lam               */
/* worked_minutes # tf_shift_minutes(start,end,break). Nen voi nhan vien lam  */
/* ca overnight, cac vi tri chu ky co ca hai moc gio (0-5) deu ep ve dung gio */
/* bat dau/ket thuc ca (offset 0) va status 'on_time'; vi tri 6 (nghi) va 7   */
/* (missing_checkout, thieu gio ra) khong bi anh huong vi nam ngoai pham vi   */
/* khang dinh do ("co du hai moc gio").                                      */
/* -------------------------------------------------------------------------- */

with anchor as (
  select public.tf_work_date(now()) as d
),
pattern as (
  select * from (values
    (0, -5, 4, 'on_time'::attendance_status),
    (1, 11, 3, 'late'::attendance_status),
    (2, -12, 1, 'on_time'::attendance_status),
    (3, -1, -48, 'early_leave'::attendance_status),
    (4, -8, 8, 'on_time'::attendance_status),
    (5, 7, 0, 'late'::attendance_status),
    (6, null, null, 'leave_paid'::attendance_status),
    (7, -3, null, 'missing_checkout'::attendance_status)
  ) as p(pattern_idx, checkin_offset, checkout_offset, base_status)
),
days as (
  select generate_series(1, 30) as day_offset
),
raw as (
  select
    e.id as employee_id,
    e.company_id,
    e.shift_id,
    e.work_location,
    s.start_time,
    s.end_time,
    s.break_minutes,
    s.late_tolerance_minutes,
    s.overnight,
    s.working_days,
    (anchor.d - d.day_offset) as work_date,
    extract(isodow from (anchor.d - d.day_offset))::int as weekday,
    case
      when s.overnight and p.checkin_offset is not null and p.checkout_offset is not null
        then 'on_time'::attendance_status
      when (d.day_offset % 8) = 6 and (d.day_offset % 16) >= 8
        then 'leave_unpaid'::attendance_status
      else p.base_status
    end as pattern_status,
    case
      when s.overnight and p.checkin_offset is not null and p.checkout_offset is not null then 0
      else p.checkin_offset
    end as checkin_offset,
    case
      when s.overnight and p.checkin_offset is not null and p.checkout_offset is not null then 0
      else p.checkout_offset
    end as checkout_offset
  from employees e
  join shifts s on s.id = e.shift_id
  cross join days d
  cross join anchor
  join pattern p on p.pattern_idx = d.day_offset % 8
),
computed as (
  select r.*, (r.weekday = any(r.working_days)) as is_working_day
  from raw r
),
final as (
  select
    c.employee_id,
    c.company_id,
    c.work_date,
    c.shift_id,
    c.work_location,
    c.break_minutes,
    c.late_tolerance_minutes,
    case when not c.is_working_day then 'day_off'::attendance_status else c.pattern_status end as status,
    case
      when not c.is_working_day then null
      when c.checkin_offset is null then null
      else (c.work_date + c.start_time + (c.checkin_offset || ' minutes')::interval) at time zone public.tf_tz()
    end as check_in_at,
    case
      when not c.is_working_day then null
      when c.checkout_offset is null then null
      else (
        (case when c.overnight then c.work_date + 1 else c.work_date end)
          + c.end_time + (c.checkout_offset || ' minutes')::interval
      ) at time zone public.tf_tz()
    end as check_out_at,
    c.checkin_offset,
    c.checkout_offset
  from computed c
)
insert into attendance_records (
  id, company_id, employee_id, work_date, shift_id,
  check_in_at, check_out_at, worked_minutes, late_minutes, early_leave_minutes,
  status, location, needs_supplement, note
)
select
  'att-' || f.employee_id || '-' || to_char(f.work_date, 'YYYYMMDD'),
  f.company_id,
  f.employee_id,
  f.work_date,
  f.shift_id,
  f.check_in_at,
  f.check_out_at,
  public.tf_worked_minutes(f.check_in_at, f.check_out_at, f.break_minutes),
  case when f.status = 'late' and f.check_in_at is not null
    then greatest(f.checkin_offset - f.late_tolerance_minutes, 0) else 0 end,
  case when f.status = 'early_leave' and f.check_out_at is not null
    then greatest(-f.checkout_offset, 0) else 0 end,
  f.status,
  case when f.status = 'day_off' then '—' else f.work_location end,
  (f.status in ('missing_checkout', 'leave_unpaid')),
  null
from final f;

/* -------------------------------------------------------------------------- */
/* attendance_records — hai dong "hom nay" chen co chu dich, mang id neo     */
/* 'att-01a'/'att-02a' ma 04_isolation_v2.sql da hardcode (FK that cho test   */
/* attendance_photos). check_out_at NULL + status missing_checkout theo dung */
/* yeu cau cua Task 1: "it nhat mot ban ghi nhu vay cho moi cong ty".         */
/* -------------------------------------------------------------------------- */

insert into attendance_records (
  id, company_id, employee_id, work_date, shift_id,
  check_in_at, check_out_at, worked_minutes, late_minutes, early_leave_minutes,
  status, location, needs_supplement, note
)
select
  'att-01a', 'cty-01', 'nv-01a', anchor.d, e.shift_id,
  (anchor.d + s.start_time - interval '3 minutes') at time zone public.tf_tz(), null,
  0, 0, 0, 'missing_checkout', e.work_location, true, 'Chưa ghi nhận giờ ra hôm nay.'
from (select public.tf_work_date(now()) as d) anchor
join employees e on e.id = 'nv-01a'
join shifts s on s.id = e.shift_id;

insert into attendance_records (
  id, company_id, employee_id, work_date, shift_id,
  check_in_at, check_out_at, worked_minutes, late_minutes, early_leave_minutes,
  status, location, needs_supplement, note
)
select
  'att-02a', 'cty-02', 'nv-02a', anchor.d, e.shift_id,
  (anchor.d + s.start_time - interval '3 minutes') at time zone public.tf_tz(), null,
  0, 0, 0, 'missing_checkout', e.work_location, true, 'Chưa ghi nhận giờ ra hôm nay.'
from (select public.tf_work_date(now()) as d) anchor
join employees e on e.id = 'nv-02a'
join shifts s on s.id = e.shift_id;

/* -------------------------------------------------------------------------- */
/* work_requests — 12 dong (9 cty-01 + 3 cty-02), dung 8 pending, port tu     */
/* seedRequests + seedRequests2. Ngay trượt quanh moc neo bang offset ngay   */
/* giu nguyen tu do lech tuong doi cua seed.ts so voi REFERENCE_DATE (D-07). */
/* from_time/to_time chi co gia tri voi attendance_supplement/time_adjustment */
/* — 'leave' va 'overtime' luon NULL (khac ban goc seed.ts co gio cho một vai */
/* yeu cau overtime; theo dung chi dan cua PLAN, khong theo nguyen van V1).  */
/* -------------------------------------------------------------------------- */

insert into work_requests (
  id, company_id, employee_id, type, status, from_date, to_date,
  from_time, to_time, reason, created_at, reviewer_id, review_note, reviewed_at
) values
  (
    'wr-01', 'cty-01', 'nv-01a', 'leave', 'pending',
    (public.tf_work_date(now()) + 3), (public.tf_work_date(now()) + 4), null, null, 'Về quê giải quyết việc gia đình.',
    ((public.tf_work_date(now()) + -1)::timestamp + time '09:12') at time zone public.tf_tz(), null, null, null
  ),
  (
    'wr-02', 'cty-01', 'nv-01a', 'attendance_supplement', 'pending',
    (public.tf_work_date(now()) + -4), (public.tf_work_date(now()) + -4), '07:58', '17:30', 'Quên bấm giờ ra do đi gặp khách hàng cuối ngày.',
    ((public.tf_work_date(now()) + -3)::timestamp + time '08:05') at time zone public.tf_tz(), null, null, null
  ),
  (
    'wr-03', 'cty-01', 'nv-06', 'time_adjustment', 'pending',
    (public.tf_work_date(now()) + -2), (public.tf_work_date(now()) + -2), '14:00', '22:00', 'Máy chấm công lỗi, giờ vào ghi nhận sai 15 phút.',
    ((public.tf_work_date(now()) + -2)::timestamp + time '22:40') at time zone public.tf_tz(), null, null, null
  ),
  (
    'wr-04', 'cty-01', 'nv-22', 'overtime', 'pending',
    (public.tf_work_date(now()) + 1), (public.tf_work_date(now()) + 1), null, null, 'Hỗ trợ hoàn thành đơn hàng gấp cho khách.',
    ((public.tf_work_date(now()) + -1)::timestamp + time '15:20') at time zone public.tf_tz(), null, null, null
  ),
  (
    'wr-05', 'cty-01', 'nv-09', 'leave', 'pending',
    (public.tf_work_date(now()) + 7), (public.tf_work_date(now()) + 9), null, null, 'Nghỉ phép năm đã đăng ký từ đầu quý.',
    ((public.tf_work_date(now()) + 0)::timestamp + time '06:55') at time zone public.tf_tz(), null, null, null
  ),
  (
    'wr-06', 'cty-01', 'nv-14', 'attendance_supplement', 'pending',
    (public.tf_work_date(now()) + -3), (public.tf_work_date(now()) + -3), '08:00', '17:30', 'Chưa được cấp tài khoản nên không chấm công được.',
    ((public.tf_work_date(now()) + -2)::timestamp + time '10:02') at time zone public.tf_tz(), null, null, null
  ),
  (
    'wr-07', 'cty-01', 'nv-01a', 'leave', 'approved',
    (public.tf_work_date(now()) + -17), (public.tf_work_date(now()) + -17), null, null, 'Khám sức khỏe định kỳ.',
    ((public.tf_work_date(now()) + -21)::timestamp + time '11:30') at time zone public.tf_tz(), 'nv-05', 'Đã xử lý theo quy trình duyệt yêu cầu.',
    ((public.tf_work_date(now()) + -21)::timestamp + time '11:30') at time zone public.tf_tz() + interval '1 day'
  ),
  (
    'wr-08', 'cty-01', 'nv-01a', 'overtime', 'approved',
    (public.tf_work_date(now()) + -10), (public.tf_work_date(now()) + -10), null, null, 'Chuẩn bị báo cáo doanh số quý.',
    ((public.tf_work_date(now()) + -12)::timestamp + time '14:00') at time zone public.tf_tz(), 'nv-05', 'Đã xử lý theo quy trình duyệt yêu cầu.',
    ((public.tf_work_date(now()) + -12)::timestamp + time '14:00') at time zone public.tf_tz() + interval '1 day'
  ),
  (
    'wr-09', 'cty-01', 'nv-01a', 'time_adjustment', 'rejected',
    (public.tf_work_date(now()) + -24), (public.tf_work_date(now()) + -24), '08:00', '17:30', 'Xin điều chỉnh giờ vào do kẹt xe.',
    ((public.tf_work_date(now()) + -24)::timestamp + time '18:20') at time zone public.tf_tz(), 'nv-05', 'Đã xử lý theo quy trình duyệt yêu cầu.',
    ((public.tf_work_date(now()) + -24)::timestamp + time '18:20') at time zone public.tf_tz() + interval '1 day'
  ),
  (
    'wr2-01', 'cty-02', 'nv2-05', 'overtime', 'pending',
    (public.tf_work_date(now()) + 2), (public.tf_work_date(now()) + 2), null, null, 'Chạy thêm ca để kịp đơn hàng xuất khẩu cuối tháng.',
    ((public.tf_work_date(now()) + -1)::timestamp + time '14:05') at time zone public.tf_tz(), null, null, null
  ),
  (
    'wr2-02', 'cty-02', 'nv2-06', 'leave', 'pending',
    (public.tf_work_date(now()) + 1), (public.tf_work_date(now()) + 3), null, null, 'Nghỉ chăm người thân nằm viện.',
    ((public.tf_work_date(now()) + -2)::timestamp + time '08:30') at time zone public.tf_tz(), null, null, null
  ),
  (
    'wr2-03', 'cty-02', 'nv2-09', 'time_adjustment', 'approved',
    (public.tf_work_date(now()) + -5), (public.tf_work_date(now()) + -5), '18:00', '06:00', 'Máy quét vân tay lỗi đầu ca đêm.',
    ((public.tf_work_date(now()) + -4)::timestamp + time '07:10') at time zone public.tf_tz(), 'nv2-07', 'Đã xử lý theo quy trình duyệt yêu cầu.',
    ((public.tf_work_date(now()) + -4)::timestamp + time '07:10') at time zone public.tf_tz() + interval '1 day'
  );

/* -------------------------------------------------------------------------- */
/* work_sites — moi cong ty mot dia diem lam viec                             */
/* -------------------------------------------------------------------------- */

insert into work_sites (id, company_id, name, latitude, longitude, radius_meters, is_active) values
  ('ws-01', 'cty-01', 'Văn phòng chính', 10.782300, 106.695800, 150, true),
  ('ws-02', 'cty-02', 'Xưởng sản xuất', 10.895500, 106.771200, 200, true);

/* -------------------------------------------------------------------------- */
/* attendance_photos — gan vao hai ban ghi cham cong "hom nay" o tren; duong  */
/* dan bat dau bang chinh company_id (CHECK cua bang buoc dieu nay). 'check_in' */
/* tren att-02a la FK that cho test ghi cheo kind='check_out' cua             */
/* 04_isolation_v2.sql (khong trung unique(attendance_record_id, kind)).      */
/* -------------------------------------------------------------------------- */

insert into attendance_photos (company_id, attendance_record_id, kind, storage_path, captured_at)
select 'cty-01', 'att-01a', 'check_in', 'cty-01/nv-01a/att-01a-check_in.jpg',
  (anchor.d + s.start_time - interval '3 minutes') at time zone public.tf_tz()
from (select public.tf_work_date(now()) as d) anchor
join employees e on e.id = 'nv-01a'
join shifts s on s.id = e.shift_id;

insert into attendance_photos (company_id, attendance_record_id, kind, storage_path, captured_at)
select 'cty-02', 'att-02a', 'check_in', 'cty-02/nv-02a/att-02a-check_in.jpg',
  (anchor.d + s.start_time - interval '3 minutes') at time zone public.tf_tz()
from (select public.tf_work_date(now()) as d) anchor
join employees e on e.id = 'nv-02a'
join shifts s on s.id = e.shift_id;

/* -------------------------------------------------------------------------- */
/* holidays — CO Y de rong o ca hai cong ty; khong chen dong nao o day.       */
/* Doanh nghiep moi khoi tao khong co ngay le cai san la trang thai hop le.   */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* overtime_rules — moi cong ty mot he so cho rule_key = 'weekday', hieu luc  */
/* tu dau nam hien tai (trượt theo nam chay seed, khong chot cung).           */
/* -------------------------------------------------------------------------- */

insert into overtime_rules (company_id, rule_key, multiplier, effective_from) values
  ('cty-01', 'weekday', 1.50, date_trunc('year', now() at time zone public.tf_tz())::date),
  ('cty-02', 'weekday', 1.50, date_trunc('year', now() at time zone public.tf_tz())::date);

/* -------------------------------------------------------------------------- */
/* audit_log — moi cong ty mot dong ghi thao tac tao nhan vien demo           */
/* -------------------------------------------------------------------------- */

insert into audit_log (company_id, actor_user_id, action, entity_table, entity_id, after) values
  (
    'cty-01', '00000000-0000-0000-0000-000000000001', 'insert', 'employees', 'nv-01a',
    jsonb_build_object('full_name', 'Nguyễn Minh Anh', 'status', 'active')
  ),
  (
    'cty-02', '00000000-0000-0000-0000-000000000002', 'insert', 'employees', 'nv-02a',
    jsonb_build_object('full_name', 'Đoàn Minh Trí', 'status', 'active')
  );

/* -------------------------------------------------------------------------- */
/* periods — ky cong thang hien tai + thang truoc cho moi cong ty (D-09),    */
/* ca hai o trang thai 'open' de Phase 5 co du lieu tap chuyen trang thai.   */
/* Tinh theo Asia/Ho_Chi_Minh, trượt theo ngay chay (D-07).                   */
/* -------------------------------------------------------------------------- */

insert into periods (company_id, start_date, end_date, status) values
  (
    'cty-01',
    date_trunc('month', now() at time zone public.tf_tz())::date,
    (date_trunc('month', now() at time zone public.tf_tz()) + interval '1 month - 1 day')::date,
    'open'
  ),
  (
    'cty-01',
    (date_trunc('month', now() at time zone public.tf_tz()) - interval '1 month')::date,
    (date_trunc('month', now() at time zone public.tf_tz()) - interval '1 day')::date,
    'open'
  ),
  (
    'cty-02',
    date_trunc('month', now() at time zone public.tf_tz())::date,
    (date_trunc('month', now() at time zone public.tf_tz()) + interval '1 month - 1 day')::date,
    'open'
  ),
  (
    'cty-02',
    (date_trunc('month', now() at time zone public.tf_tz()) - interval '1 month')::date,
    (date_trunc('month', now() at time zone public.tf_tz()) - interval '1 day')::date,
    'open'
  );

commit;
