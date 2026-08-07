-- 0025_shift_break_window.sql
--
-- Gio nghi cua ca chuyen tu MOT CON SO PHUT sang MOT KHUNG GIO co gio bat
-- dau va gio ket thuc.
--
-- Vi sao doi: "30 phut nghi" khong tra loi duoc cau hoi ma nguoi quan ly hoi
-- thuong xuyen nhat — "nghi luc may gio?". Nhan vien khong biet duoc khung
-- gio nghi tu bang ca, va quan ly khong doi chieu duoc mot lan cham cong
-- giua trua voi gio nghi cua chinh ca do.
--
-- COT `break_minutes` KHONG BI BO DI, va do la mot quyet dinh co y:
--
--   * Toan bo phep tinh cong (`tf_worked_minutes`, `src/lib/attendance/day.ts`)
--     dang tru gio nghi theo THOI LUONG, voi mot quy tac ty le da duoc kiem
--     bang test (tru theo phan ca co mat, tru phan chua duoc bu bang cac
--     khoang nghi giua cac luot — xem 0014). Doi ca hai thu cung luc (nguon
--     nhap VA cach tru) la doi hai bien trong mot phep do.
--   * Nen tu nay `break_minutes` la GIA TRI DAN XUAT: bang do dai cua khung
--     gio, do dung MOT noi ghi (`shiftInputSchema` trong
--     `src/lib/validation/api/shifts.ts`) tinh ra. Khong noi goi nao khac
--     duoc phep dat rieng hai gia tri lech nhau.
--
-- Ca CU (da co `break_minutes` nhung chua co khung gio) van chay dung: phep
-- tinh doc `break_minutes` nhu truoc. Man hinh sua ca hien o khung gio trong
-- kem mot cau nhac, de nguoi dung KHAI khung gio that — he thong khong tu
-- bia ra mot gio nghi ma no khong biet.

alter table shifts
  add column break_start_time time,
  add column break_end_time time;

-- Hai cot di CUNG NHAU: mot ca khong the co gio bat dau nghi ma khong co gio
-- ket thuc. Ca khong nghi thi ca hai cung `null` (va `break_minutes` = 0).
alter table shifts
  add constraint shifts_break_window_both_or_neither check (
    (break_start_time is null) = (break_end_time is null)
  );

-- Khung gio do dai 0 khong phai mot khoang nghi.
alter table shifts
  add constraint shifts_break_window_not_empty check (
    break_start_time is null or break_start_time <> break_end_time
  );

comment on column shifts.break_start_time is
  'Gio bat dau nghi giua ca ("HH:mm"), `null` khi ca khong co gio nghi. '
  'Di cung `break_end_time` — hai cot cung null hoac cung co gia tri.';

comment on column shifts.break_end_time is
  'Gio ket thuc nghi giua ca. Co the NHO HON `break_start_time` khi khoang '
  'nghi vat qua nua dem trong mot ca dem — cung quy uoc voi start_time/'
  'end_time cua chinh ca.';

comment on column shifts.break_minutes is
  'DO DAI khoang nghi, tinh bang phut. Tu migration 0025 day la gia tri DAN '
  'XUAT tu (break_start_time, break_end_time) va duoc tang ung dung ghi kem '
  'moi lan luu ca — KHONG sua tay cot nay. Cac ca tao truoc 0025 co gia tri '
  'nay ma chua co khung gio; phep tinh cong van doc cot nay nen chung chay '
  'dung nhu cu.';
