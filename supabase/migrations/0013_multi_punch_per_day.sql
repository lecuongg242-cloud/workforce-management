-- 0013_multi_punch_per_day.sql
--
-- Cho phep nhan vien cham cong NHIEU LUOT trong cung mot ngay/mot ca: ra
-- ngoai giua ca (an trua, di cong viec) roi quay lai cham tiep. Moi cap
-- vao/ra la MOT DONG attendance_records; tong gio cua ngay la tong cac dong.
--
-- Vi sao mo hinh "moi luot mot dong" chu khong phai mot bang con
-- attendance_punches: attendance_photos da rang buoc
-- `unique (attendance_record_id, kind)` — dung MOT anh vao va MOT anh ra cho
-- moi dong. Voi mot dong moi luot, rang buoc do vua khit (moi luot co dung
-- mot anh vao va mot anh ra) nen bang anh, cac policy RLS o 0012 va duong
-- dan Storage KHONG phai doi gi.

/* -------------------------------------------------------------------------- */
/* Bo rang buoc "moi ngay/ca dung mot dong"                                   */
/* -------------------------------------------------------------------------- */

alter table attendance_records
  drop constraint if exists attendance_records_employee_id_work_date_shift_id_key;

/* -------------------------------------------------------------------------- */
/* Thay bang rang buoc "moi ngay/ca chi mot luot DANG MO"                     */
/* -------------------------------------------------------------------------- */

-- Bat bien that su can giu: khong ai duoc dang o trong hai luot cung luc.
-- Da vao ca thi phai tan ca xong moi vao lai duoc.
--
-- Dieu kien PHAI la `check_in_at is not null and check_out_at is null` chu
-- KHONG chi `check_out_at is null`: nhung dong nghi phep / nghi khong luong
-- co ca hai cot deu null, neu chi loc theo check_out_at thi mot dong nghi
-- phep se chiem mat cho va chan luon lan cham cong that cua ngay hom do.
create unique index if not exists attendance_records_open_punch_uidx
  on attendance_records (employee_id, work_date, shift_id)
  where check_in_at is not null and check_out_at is null;

-- Sap xep cac luot trong cung mot ngay theo thoi gian vao. `id` la UUID nen
-- KHONG phan anh thu tu thoi gian — moi noi liet ke "luot 1, luot 2" deu
-- phai sap theo check_in_at, va index nay phuc vu dung truy van do.
create index if not exists attendance_records_employee_work_date_check_in_idx
  on attendance_records (employee_id, work_date, check_in_at);
