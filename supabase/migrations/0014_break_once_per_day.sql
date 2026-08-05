-- 0014_break_once_per_day.sql
--
-- Sua cach tru gio nghi. Truoc day `checkOut` goi
-- `tf_worked_minutes(check_in, check_out, shift.break_minutes)` nen gio nghi
-- cua CA bi tru vao TUNG LUOT cham cong. Hai hong hoc that:
--
--   1. Mot luot ngan hon gio nghi ra 0 phut. Vao 14:37, ra 15:05 (28 phut)
--      voi ca co 60 phut nghi -> greatest(28 - 60, 0) = 0. Nguoi lam that 28
--      phut duoc ghi la khong lam gi.
--   2. Tu migration 0013 mot ngay co nhieu luot, nen 60 phut nghi bi tru LAP
--      LAI o moi luot: ba luot mat 180 phut cho mot ca chi nghi 60 phut.
--
-- Mo hinh moi:
--   * `worked_minutes` cua mot dong = THOI LUONG THO cua chinh luot do
--     (check_out - check_in), KHONG tru gio nghi.
--   * Gio nghi duoc tru MOT LAN cho ca ngay, o tang doc
--     (`src/lib/attendance/day.ts`), va chi tru PHAN CHUA DUOC BU bang cac
--     khoang nghi giua cac luot: nguoi da tu cham ra de di an trua thi khoang
--     trong do da la thoi gian khong duoc tinh cong roi, tru them lan nua la
--     tru hai lan cung mot gio nghi.
--
-- Vi sao tang doc chu khong phai luu san mot con so da tru: gio nghi thuoc ve
-- CA NGAY, khong thuoc ve mot luot nao. Chia no cho tung luot buoc phai chon
-- mot quy tac phan bo tuy tien ("luot nao ganh?") — dung loai fudge am tham
-- ma sau nay thanh tranh cai tien luong. Giu du lieu tho, tinh khi doc.

/* -------------------------------------------------------------------------- */
/* Doi y nghia cot: cac dong cu dang la "da tru gio nghi" -> dua ve tho        */
/* -------------------------------------------------------------------------- */

-- Chuyen doi CHINH XAC, khong phai uoc luong: `check_in_at`/`check_out_at`
-- van con nguyen nen thoi luong tho tinh lai duoc dung tuyet doi.
update attendance_records
set worked_minutes = public.tf_worked_minutes(check_in_at, check_out_at, 0)
where check_in_at is not null
  and check_out_at is not null;

comment on column attendance_records.worked_minutes is
  'THOI LUONG THO cua rieng luot nay (check_out_at - check_in_at), CHUA tru '
  'gio nghi cua ca. Gio nghi duoc tru mot lan cho ca ngay o tang doc — xem '
  'src/lib/attendance/day.ts. Cong don cot nay ma khong tru gio nghi se ra '
  'tong LON HON so gio duoc tinh cong.';
