-- 0028_optional_employee_fields.sql
--
-- Sau truong cua ho so nhan vien thoi bat buoc: so dien thoai, ngay sinh, gioi
-- tinh, phong ban, chuc vu, loai hop dong.
--
-- VI SAO LA NULL CHU KHONG PHAI MOT GIA TRI DAI DIEN
--
-- Cach re hon la giu NOT NULL va dien san mot gia tri khi nguoi dung bo trong:
-- ngay sinh "1990-01-01", gioi tinh "male", chuc vu "Nhân viên". Chinh
-- `createCompanyAction` dang lam vay cho buoc onboarding (xem SUMMARY §Known
-- Stubs) — va do la mot mon no, khong phai mot khuon mau.
--
-- Mot ngay sinh dai dien KHONG PHAN BIET DUOC voi mot ngay sinh that. No hien
-- ra man hinh nhu moi ngay sinh khac, loc va sap xep nhu moi ngay sinh khac, va
-- khong mot man hinh nao noi duoc "cai nay he thong tu dien". Doanh nghiep se
-- doc no nhu du lieu that. `null` thi khong the doc nham: moi noi hien no phai
-- tu quyet dinh noi gi, va cau tra loi dung la "chua khai" — cung nguyen tac
-- D-26 ma `standard_hours_per_day` va `pay_rates` dang giu.
--
-- HAI TRUONG CO ANH HUONG TOI TIEN, va ca hai da duoc luong truoc:
--
--   * `department_id` va `position` tham gia phep giai PHAM VI cua phu cap /
--     khau tru (`src/lib/payroll/scope.ts`). Module do da khai
--     `departmentId: string | null` va da co dieu kien loai bo chuc vu rong tu
--     truoc migration nay — nguoi chua khai phong ban KHONG khop pham vi
--     "phong ban", nguoi chua khai chuc vu KHONG khop pham vi "chuc vu". Do la
--     chieu an toan: khong ai bong nhien nhan them tien vi mot o de trong.
--
-- KHONG DUNG TRONG DANH SACH NAY: `code`, `full_name`, `email`, `start_date`,
-- `shift_id`, `work_location`, `status`, `system_role`. Chung dinh danh nguoi
-- do, quyet dinh ho cham cong the nao, hoac quyet dinh ho dang nhap duoc gi —
-- de trong mot trong so do thi ho so khong dung duoc vao viec gi.

alter table employees
  alter column phone drop not null,
  alter column date_of_birth drop not null,
  alter column gender drop not null,
  alter column department_id drop not null,
  alter column position drop not null,
  alter column contract_type drop not null;

comment on column employees.phone is
  'Khong bat buoc (0028). `null` = CHUA KHAI, khong phai chuoi rong.';

comment on column employees.date_of_birth is
  'Khong bat buoc (0028). `null` = CHUA KHAI — khong bao gio duoc thay bang '
  'mot ngay dai dien: mot ngay sinh bia ra khong phan biet duoc voi ngay sinh that.';

comment on column employees.gender is
  'Khong bat buoc (0028). `null` = CHUA KHAI, khac han voi mot gia tri mac dinh.';

comment on column employees.department_id is
  'Khong bat buoc (0028). `null` = CHUA XEP phong ban. Nguoi nhu vay KHONG '
  'khop pham vi "phong ban" cua phu cap/khau tru (src/lib/payroll/scope.ts).';

comment on column employees.position is
  'Khong bat buoc (0028). `null` = CHUA KHAI. Nguoi nhu vay KHONG khop pham vi '
  '"chuc vu" cua phu cap/khau tru — cung mot chieu an toan voi phong ban.';

comment on column employees.contract_type is
  'Khong bat buoc (0028). `null` = CHUA KHAI loai hop dong.';
