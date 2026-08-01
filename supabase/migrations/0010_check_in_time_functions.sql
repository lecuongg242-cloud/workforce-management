-- 0010_check_in_time_functions.sql
--
-- Hai ham gian tiep phuc vu D-19 (plan 02-08): "hom nay" va dau thoi gian
-- cham cong PHAI la dong ho cua database, khong bao gio la tham so client
-- gui len. PostgREST khong cho RPC goi thang cac ham built-in trong
-- pg_catalog (nhu now()), nen tf_server_now() la lop boc mong nhat de tang
-- ung dung doc duoc dong ho server qua cung mot duong RPC nhu cac ham thoi
-- gian khac cua Phase 1 (0003_enums_time.sql), khong mo mot duong rieng.
--
-- tf_local_instant() ghep mot ngay lich (work_date) voi mot gio-trong-ngay
-- (shift.start_time/end_time) thanh MOT khoanh khac tuyet doi theo gio VN
-- (tf_tz()) -- dung de tinh thoi diem BAT DAU/KET THUC CA THEO KE HOACH ma
-- khong viet mot phep cong offset +7 thu cong o tang ung dung (day chinh la
-- dieu cam trong <prohibitions> cua 02-08-PLAN.md).

create function public.tf_server_now()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

comment on function public.tf_server_now() is
  'Dong ho DUY NHAT ma checkIn/checkOut (src/lib/data/mutations/attendance.ts) '
  'duoc phep dung de ghi check_in_at/check_out_at (D-19). Khong bao gio nhan '
  'tham so gio tu client -- ham nay khong co tham so.';

create function public.tf_local_instant(p_date date, p_time time)
returns timestamptz
language sql
immutable
as $$
  select (p_date + p_time) at time zone public.tf_tz();
$$;

comment on function public.tf_local_instant(date, time) is
  'Ghep mot ngay lich voi mot gio-trong-ngay thanh mot khoanh khac tuyet doi '
  '(timestamptz) theo gio VN (tf_tz()) -- dung de tinh thoi diem BAT DAU CA '
  'THEO KE HOACH tu work_date + shift.start_time. Cong them tf_shift_minutes() '
  '(0003_enums_time.sql) de ra thoi diem KET THUC CA THEO KE HOACH (phep cong '
  'epoch don thuan sau do, khong phai mot quy uoc mui gio thu hai).';
