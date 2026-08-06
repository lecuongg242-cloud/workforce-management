-- supabase/tests/11_overtime_rules_append_only.sql
--
-- Cuong che append-only va phep tra he so hieu luc (migration 0016, plan
-- 04-04). Hai khang dinh `throws_ok` cho UPDATE/DELETE la QUAN TRONG NHAT
-- file nay: chung la thu duy nhat chung minh tieu chi 4 cua Phase 4 co rang o
-- tang database chu khong chi la mot thoa thuan trong ma ung dung (D-25a).

begin;

select plan(7);

/* ============================================================================
   Du lieu doi chieu: hai phien ban cua cung mot khoa cho cty-01.
   Chay o vai tro mac dinh (chu bang, bo qua RLS) — day la buoc dung fixture,
   phan kiem RLS thuoc ve 04_isolation_v2.sql.
   ========================================================================= */

insert into overtime_rules (company_id, rule_key, multiplier, effective_from) values
  ('cty-01', 'holiday', 2.00, '2020-01-01'),
  ('cty-01', 'holiday', 3.00, '2026-06-01');

/* ============================================================================
   Append-only — 2 khang dinh
   ========================================================================= */

select throws_ok(
  $upd$update overtime_rules set multiplier = 9.99
     where company_id = 'cty-01' and rule_key = 'holiday'$upd$,
  '23001',
  null,
  'overtime_rules: UPDATE bi trigger tu choi (append-only, D-25a)'
);

select throws_ok(
  $del$delete from overtime_rules
     where company_id = 'cty-01' and rule_key = 'holiday'$del$,
  '23001',
  null,
  'overtime_rules: DELETE bi trigger tu choi (append-only, D-25a)'
);

select lives_ok(
  $ins$insert into overtime_rules (company_id, rule_key, multiplier, effective_from)
    values ('cty-01', 'night', 1.30, '2026-01-01')$ins$,
  'overtime_rules: INSERT van hoat dong binh thuong'
);

/* ============================================================================
   He so dang hieu luc — 4 khang dinh
   ========================================================================= */

select is(
  public.tf_overtime_multiplier('cty-01', 'holiday', '2026-08-06'),
  3.00::numeric,
  'tf_overtime_multiplier: ngay sau moc hieu luc moi -> he so moi'
);

select is(
  public.tf_overtime_multiplier('cty-01', 'holiday', '2026-05-31'),
  2.00::numeric,
  'tf_overtime_multiplier: ngay TRUOC moc hieu luc moi -> van he so cu (tieu chi 4)'
);

select is(
  public.tf_overtime_multiplier('cty-01', 'holiday', '2019-12-31'),
  null,
  'tf_overtime_multiplier: ngay truoc MOI phien ban -> NULL, khong lui ve dong gan nhat (D-26)'
);

select is(
  public.tf_overtime_multiplier('cty-01', 'weekend', '2026-08-06'),
  null,
  'tf_overtime_multiplier: khoa chua duoc khai lan nao -> NULL, khong bia he so'
);

select * from finish(true);

rollback;
