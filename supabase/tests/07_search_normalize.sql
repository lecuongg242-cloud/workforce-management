-- supabase/tests/07_search_normalize.sql
--
-- pgTAP doi chieu public.tf_normalize voi ket qua ma normalizeText()
-- (src/lib/format.ts) tra ve cho cung dau vao — dung chinh chuoi co that
-- trong seed (supabase/seed.sql) de khang dinh khong phai gia dinh suong.
-- Theo khuon 02_time_overnight.sql: begin/plan/finish/rollback.

begin;

select plan(6);

select is(
  public.tf_normalize('Nguyễn Minh Anh'),
  'nguyen minh anh',
  'tf_normalize: "Nguyễn Minh Anh" (nv-01a trong seed) -> "nguyen minh anh"'
);

select is(
  public.tf_normalize('Đoàn Minh Trí'),
  'doan minh tri',
  'tf_normalize: "Đoàn Minh Trí" (nv-02a trong seed) -> "doan minh tri" (đ/Đ -> d)'
);

select is(
  public.tf_normalize('  Trần Hoàng Nam  '),
  'tran hoang nam',
  'tf_normalize: "  Trần Hoàng Nam  " -> "tran hoang nam" (cat khoang trang hai dau)'
);

select is(
  public.tf_normalize('NV001'),
  'nv001',
  'tf_normalize: "NV001" (ma nhan vien nv-01a trong seed) -> "nv001" (ha chu thuong)'
);

select is(
  public.tf_normalize(''),
  '',
  'tf_normalize: chuoi rong -> chuoi rong'
);

select is(
  (select provolatile from pg_proc where proname = 'tf_normalize')::text,
  'i',
  'tf_normalize: la ham IMMUTABLE (provolatile = ''i'' trong pg_proc)'
);

select * from finish(true);

rollback;
