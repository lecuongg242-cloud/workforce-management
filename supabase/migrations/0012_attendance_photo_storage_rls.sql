-- 0012_attendance_photo_storage_rls.sql
--
-- RLS tren storage.objects cho bucket "attendance-photos" — khoang trong da
-- duoc chinh 03-01 danh dau truoc nhung chua bao gio duoc do: comment dau
-- src/app/api/attendance-photos/[id]/__tests__/route.test.ts (dong 16-17)
-- ghi ro "Backstop: policy storage.objects chua co cong tu dong", va comment
-- tai 0005_v2_tables.sql (dong 51-54) noi truoc RLS Phase 3 se dung lai cung
-- tien to storage_path bat dau bang company_id.
--
-- Vi sao day la mot loi CHAN, khong phai mot khoang trong vo hai: broker
-- Route Handler (GET /api/attendance-photos/[id]) VA checkIn()/checkOut()
-- (Server Action ghi anh) deu goi createServerSupabase() — mot client SCOPED
-- THEO PHIEN nguoi dung THAT (vai tro Postgres `authenticated`), khong phai
-- secret key. storage.objects cua Supabase BAT RLS THEO MAC DINH; khong co
-- policy nao nghia la MOI thao tac Storage (ca doc lan ghi) cua nguoi dung
-- that deu bi Postgres tu choi thang, bat ke tang ung dung co kiem company_id
-- dung hay khong. Cac test tich hop truoc do (route.test.ts, cac test
-- checkIn() co evidence) MOCK createServerSupabase() de tra ve mot client
-- dung SUPABASE_SECRET_KEY (co tinh bo qua RLS, dung y do rieng lop ung
-- dung — xem chinh comment dau file cua route.test.ts) nen KHONG BAO GIO
-- cham duoc lop nay. plan 03-07 phat hien ra khoang trong bang
-- scripts/e2e-photo.mjs — script DUY NHAT trong repo goi qua HTTP that voi
-- cookie phien that, khong mock createServerSupabase(): metadata (đọc, không
-- cham Storage) tra 200 dung, nhung broker route tra 502 ("Không tải được
-- ảnh.") vi .download() bi RLS chan.
--
-- Bien gioi RLS o day CHI can tho hon lop ung dung (moi thanh vien active
-- cua doanh nghiep, khong phan biet vai tro) — dung khuon voi MOI bang khac
-- trong repo (companies/memberships/... deu chi dung tf_is_member(), khong
-- phan biet vai tro o tang RLS, xem 0002_tenancy.sql): kiem vai tro (chi
-- owner/admin duoc XEM anh, ATT-04) da la trach nhiem cua requireRole() o
-- tang ung dung (D-12b), RLS o day chi can chan DUNG bien gioi doanh nghiep
-- (khong ai xem/ghi duoc object cua doanh nghiep khac) — bien gioi do doc
-- duoc thang tu tien to duong dan (`storage_path like company_id || '/%'`,
-- rang buoc da co san tren attendance_photos tu 0005_v2_tables.sql).
--
-- CHI ap dung tren Supabase cloud that: Postgres tam cua CI KHONG CO schema
-- `storage` (pgTAP khong dung duoc schema nay, xem comment dau route.test.ts
-- va 0001_supabase_compat.sql — file do chi stub schema `auth`, khong stub
-- `storage`). Boc trong mot DO block dieu kien theo to_regclass() de migration
-- nay van ap dung duoc (no-op) tren CI, dung khuon voi 0001_supabase_compat.sql.

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute $sql$
      create policy attendance_photos_select_member
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'attendance-photos'
        and public.tf_is_member(split_part(name, '/', 1))
      );
    $sql$;

    execute $sql$
      create policy attendance_photos_insert_member
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'attendance-photos'
        and public.tf_is_member(split_part(name, '/', 1))
      );
    $sql$;
  end if;
end
$$;
