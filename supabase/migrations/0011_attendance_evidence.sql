-- 0011_attendance_evidence.sql
--
-- Nen du lieu cho lat cat tracer cua Phase 3 (03-01-PLAN.md Task 1): ba cot
-- con thieu tren attendance_photos ma D-20/D-21/ATT-02/ATT-07 can, va ham
-- khoang cach haversine dat cung ho voi tf_server_now()/tf_local_instant()
-- (migration 0010) — quy uoc "moi phep tinh thoi gian/khong gian di qua RPC,
-- khong tu viet lai o tang ung dung".

/* -------------------------------------------------------------------------- */
/* attendance_photos — ba cot moi, ca ba nullable                             */
/* -------------------------------------------------------------------------- */

-- Nullable vi hai ly do: (1) cac dong seed hien co (truoc phase nay) khong co
-- gia tri; (2) mot lan cham cong o doanh nghiep chua khai diem lam viec nao
-- van phai ghi duoc, voi work_site_id/distance_meters de trong.
alter table attendance_photos
  add column accuracy_meters numeric(7, 2) null,
  add column work_site_id text null references work_sites (id) on delete set null,
  add column distance_meters numeric(10, 2) null;

create index attendance_photos_work_site_id_idx
  on attendance_photos (work_site_id);

/* -------------------------------------------------------------------------- */
/* tf_distance_meters — haversine, cung khuon voi cac ham tf_* cua 0010       */
/* (khong revoke/grant rieng: day la ham tinh toan thuan tuy, khong phai      */
/* security-definer bypass RLS nhu tf_is_member/tf_is_platform_admin)         */
/* -------------------------------------------------------------------------- */

create function public.tf_distance_meters(
  p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric
)
returns numeric
language sql
immutable
as $$
  -- Cong thuc haversine, ban kinh Trai Dat 6371000 m. `least(1.0, greatest(-1.0, ...))`
  -- la buoc BAT BUOC: sai so dau phay dong day gia tri acos() ra ngoai [-1, 1] khi hai
  -- toa do gan trung nhau (khoang cach ~0m — chinh la truong hop pho bien nhat, nhan
  -- vien dung dung tai diem lam viec). Bo buoc kep nay thi acos() tra NaN dung luc he
  -- thong chay dung nhat. Khong dung PostGIS: du lieu chi can khoang cach diem-diem
  -- don gian, them extension la chi phi khong tuong xung.
  select 6371000 * acos(
    least(1.0, greatest(-1.0,
      cos(radians(p_lat1)) * cos(radians(p_lat2)) * cos(radians(p_lng2) - radians(p_lng1))
      + sin(radians(p_lat1)) * sin(radians(p_lat2))
    ))
  );
$$;

comment on function public.tf_distance_meters(numeric, numeric, numeric, numeric) is
  'Khoang cach haversine (met) giua hai toa do. Ham tinh toan thuan tuy, cung ho voi '
  'tf_server_now()/tf_local_instant() (0010) — checkIn (src/lib/data/mutations/attendance.ts) '
  'goi ham nay de tu do khoang cach, khong bao gio nhan gia tri distance tu client (D-20/T-03-04).';

-- KHONG them cot boolean luu cung co danh dau dang ngo. Co duoc tinh tai thoi
-- diem truy van (plan 03-06) bang cach so distance_meters voi radius_meters
-- cua work_site_id nhan nguong hien hanh, de khi Phase 4 chuyen nguong tu
-- hang so sang cau hinh doanh nghiep (D-21a) thi danh sach tu cap nhat, khong
-- phai ghi de hang loat len du lieu lich su.
