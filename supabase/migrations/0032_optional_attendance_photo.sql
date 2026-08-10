-- 0032_optional_attendance_photo.sql
--
-- ANH CHAM CONG TRO THANH TUY CHON — MOT DONG BANG CHUNG KHONG CON BUOC PHAI
-- CO MOT TEP ANH.
--
-- ======================================================================
-- (1) VI SAO
-- ======================================================================
--
-- Tu ban dau moi lan cham cong deu phai kem mot anh. Nhung anh chi tra loi mot
-- cau hoi: "lan cham nay co dang de hoi khong?". Voi mot nhan vien dung DUNG
-- trong khu vuc lam viec, cau hoi do da duoc GPS tra loi xong truoc khi camera
-- kip bat — bat ho chup them mot tam anh khong them mot bit thong tin nao, chi
-- them ba thao tac.
--
-- Tu day: CAN ANH <=> lan cham vuot NGUONG CHO PHEP cua chinh doanh nghiep
-- (`work_sites.radius_meters` x `company_settings.suspicious_distance_multiplier`,
-- xem `requiresPunchPhoto()` o `src/lib/attendance/suspicious.ts`). Khong mot
-- con so nao trong migration nay — nguong van thuoc ve cau hinh (D-26/D-29).
--
-- ======================================================================
-- (2) VI SAO VAN GHI MOT DONG attendance_photos KHI KHONG CO ANH
-- ======================================================================
--
-- Cach re hon la khong ghi dong nao. Nhung dong nay khong chi giu ANH: no giu
-- TOA DO, KHOANG CACH da do, va DIEM LAM VIEC GAN NHAT. Bo dong di thi moi lan
-- cham GAN — tuc da so lan cham cua he thong — se khong con mot dau vet vi tri
-- nao, va man hinh quan tri mat kha nang doi chieu dung o cho no can nhat: khi
-- co ai do hoi lai ve mot ngay cong da qua.
--
-- Vay `storage_path` thanh null-able, va rang buoc tien to duong dan (lop
-- chan bien gioi doanh nghiep cua 0005, dung lai boi policy RLS tren
-- storage.objects o 0012) doi thanh "null HOAC dung tien to". Rang buoc do
-- KHONG duoc noi long theo bat ky nghia nao khac: mot duong dan khac null van
-- phai bat dau bang chinh company_id cua dong.

alter table attendance_photos
  alter column storage_path drop not null;

-- Rang buoc goc (0005) duoc khai KHONG TEN, nen ten that la ten Postgres tu
-- sinh — tra ra tu catalog thay vi doan, de migration nay khong vo neu ten do
-- khac giua cac moi truong.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'attendance_photos'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%storage_path%'
    and pg_get_constraintdef(con.oid) like '%company_id%';

  if constraint_name is not null then
    execute format(
      'alter table attendance_photos drop constraint %I',
      constraint_name
    );
  end if;
end
$$;

alter table attendance_photos
  add constraint attendance_photos_storage_path_prefix_check
  check (storage_path is null or storage_path like company_id || '/%');
