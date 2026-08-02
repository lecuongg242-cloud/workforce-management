-- supabase/tests/09_attendance_evidence.sql
--
-- pgTAP cho migration 0011: ba cot moi tren attendance_photos, ham
-- tf_distance_meters(), va co lap RLS tren cac cot moi. Khuon theo
-- 04_isolation_v2.sql — file test moi dung canh no, khong sua no.

begin;

select plan(8);

/* ============================================================================
   Ba cot moi da ton tai tren attendance_photos
   ========================================================================= */

select has_column(
  'attendance_photos', 'accuracy_meters',
  'attendance_photos co cot accuracy_meters'
);

select has_column(
  'attendance_photos', 'work_site_id',
  'attendance_photos co cot work_site_id'
);

select has_column(
  'attendance_photos', 'distance_meters',
  'attendance_photos co cot distance_meters'
);

/* ============================================================================
   tf_distance_meters da ton tai
   ========================================================================= */

select has_function(
  'public', 'tf_distance_meters', array['numeric', 'numeric', 'numeric', 'numeric'],
  'public.tf_distance_meters(numeric, numeric, numeric, numeric) da ton tai'
);

/* ============================================================================
   tf_distance_meters — hai toa do giong het nhau cho ra 0 (bai kiem buoc kep
   acos(), khong phai bai kiem hinh thuc)
   ========================================================================= */

select is(
  public.tf_distance_meters(21.028500, 105.854200, 21.028500, 105.854200),
  0::numeric,
  'tf_distance_meters: hai toa do trung nhau cho ra 0, khong phai NULL/NaN'
);

/* ============================================================================
   tf_distance_meters — khoang cach da biet: ~1 do vi tuyen ~ 110000-112000 m
   ========================================================================= */

select ok(
  public.tf_distance_meters(21.000000, 105.000000, 22.000000, 105.000000)
    between 110000 and 112000,
  'tf_distance_meters: 1 do vi tuyen cho ra khoang 110000-112000 m'
);

/* ============================================================================
   tf_distance_meters — tinh doi xung
   ========================================================================= */

select is(
  public.tf_distance_meters(21.000000, 105.000000, 22.000000, 106.000000),
  public.tf_distance_meters(22.000000, 106.000000, 21.000000, 105.000000),
  'tf_distance_meters: doi cho hai diem cho cung mot ket qua'
);

/* ============================================================================
   RLS van phu cac cot moi. Luu y ve co che RLS cua Postgres: mot UPDATE
   nham vao dong khong nhin thay duoc qua USING (vi du where company_id =
   'cty-02' voi user 0001) chi lang le cap nhat 0 dong, KHONG nem loi — do la
   dung thiet ke, USING loc dong truoc khi WITH CHECK duoc danh gia. De thuc
   su chung minh policy con phu cac cot moi, khang dinh nay cho user 0001 sua
   mot dong CUA CHINH HO (cty-01, nhin thay duoc qua USING) nhung dong thoi
   thu doi company_id sang cty-02 cung luc voi distance_meters — WITH CHECK
   danh gia tren dong MOI se tu choi vi tf_is_member('cty-02') la false.
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select throws_ok(
  $upd_ap$update attendance_photos
     set distance_meters = 42, company_id = 'cty-02'
     where attendance_record_id = 'att-01a' and kind = 'check_in'$upd_ap$,
  '42501',
  'new row violates row-level security policy for table "attendance_photos"',
  'attendance_photos: user 0001 sua distance_meters kem chuyen company_id sang cty-02 bi tu choi'
);

select tf_test_logout();

select * from finish(true);

rollback;
