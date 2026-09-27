-- 0039_shift_break_paid.sql
--
-- GIO NGHI CO DUOC TINH CONG HAY KHONG — MOT CO TREN TUNG CA.
--
-- Truoc day gio nghi cua ca LUON bi tru khoi gio lam (`src/lib/attendance/day.ts`)
-- va khoi do dai ca theo ke hoach (`shiftScheduledMinutes()`). Co doanh nghiep
-- tra luong ca gio nghi (nghi tai cho, an ca tai xuong) — voi ho, tru di la tru
-- sai tien cua nhan vien.
--
-- `break_paid = true`: khung gio nghi VAN duoc luu va hien thi, nhung khong
-- bi tru o bat ky phep tinh cong nao. Mac dinh `false` giu nguyen hanh vi cu
-- cho moi ca da co — khong mot con so lich su nao doi.

alter table shifts
  add column break_paid boolean not null default false;

comment on column shifts.break_paid is
  'true = gio nghi cua ca duoc tinh cong (khong tru khoi gio lam, khong tru khoi do dai ca). Mac dinh false: tru nhu truoc 0039.';
