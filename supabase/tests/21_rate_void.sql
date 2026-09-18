-- supabase/tests/21_rate_void.sql
--
-- HUY MOT DONG KHAI NHAM tren `employee_pay_rates` (migration 0038, D-57).
--
-- Bon khang dinh nang nhat file nay:
--   - dau huy la phep UPDATE DUY NHAT duoc chap nhan; moi phep khac van bi tu
--     choi, ke ca mot phep huy co kem thay doi so tien (dong `sneaky` ben
--     duoi). Neu khe nay ho ra, D-37a mat rang va tien da tra tinh lai duoc;
--   - huy PHAI co ly do, nen mot dau huy im lang la khong the;
--   - huy la MOT CHIEU — go dau huy bi tu choi;
--   - sau khi huy, `effective_from` do duoc khai lai (partial unique index).
--     Thieu khang dinh nay thi ca co che vo dung: nguoi dung huy xong van
--     khong sua lai duoc dung ngay minh go nham.

begin;

select plan(18);

/* ============================================================================
   Fixture: mot dong khai nham 111d/thang cho nv-01a
   ========================================================================= */

insert into employee_pay_rates (id, company_id, employee_id, unit, amount, effective_from)
values (
  '11111111-1111-1111-1111-111111111111',
  'cty-01', 'nv-01a', 'month', 111, '2024-02-01'
);

/* ============================================================================
   Truoc khi huy — 2 khang dinh
   ========================================================================= */

select throws_ok(
  $dup$insert into employee_pay_rates (company_id, employee_id, unit, amount, effective_from)
       values ('cty-01', 'nv-01a', 'month', 9000000, '2024-02-01')$dup$,
  '23505',
  null,
  'chua huy thi KHONG khai lai duoc cung effective_from'
);

select throws_ok(
  $upd$update employee_pay_rates set amount = 9000000
     where id = '11111111-1111-1111-1111-111111111111'$upd$,
  '23001',
  null,
  'sua de so tien van bi tu choi (D-37a khong bi noi long)'
);

/* ============================================================================
   Dau huy — 4 khang dinh
   ========================================================================= */

select throws_ok(
  $noreason$update employee_pay_rates
     set voided_at = now(), voided_by = '00000000-0000-0000-0000-000000000001'
     where id = '11111111-1111-1111-1111-111111111111'$noreason$,
  '23001',
  null,
  'huy KHONG kem ly do bi tu choi'
);

-- Huy MA DOI LUON SO TIEN: phep nguy hiem nhat, va no phai bi chan. Mot khe
-- huy cho phep doi `amount` la mot duong sua de tra hinh.
select throws_ok(
  $sneaky$update employee_pay_rates
     set voided_at = now(),
         voided_by = '00000000-0000-0000-0000-000000000001',
         void_reason = 'x',
         amount = 9000000
     where id = '11111111-1111-1111-1111-111111111111'$sneaky$,
  '23001',
  null,
  'huy MA DOI LUON so tien bi tu choi'
);

select throws_ok(
  $anon$update employee_pay_rates
     set voided_at = now(), voided_by = null, void_reason = 'x'
     where id = '11111111-1111-1111-1111-111111111111'$anon$,
  '23001',
  null,
  'huy KHONG neu ten nguoi huy bi tu choi'
);

select lives_ok(
  $void$update employee_pay_rates
     set voided_at = now(),
         voided_by = '00000000-0000-0000-0000-000000000001',
         void_reason = 'go nham 111 thay vi 9.000.000'
     where id = '11111111-1111-1111-1111-111111111111'$void$,
  'huy kem ly do va ten nguoi huy duoc chap nhan'
);

select throws_ok(
  $unvoid$update employee_pay_rates
     set voided_at = null, void_reason = null
     where id = '11111111-1111-1111-1111-111111111111'$unvoid$,
  '23001',
  null,
  'go dau huy bi tu choi — huy la MOT CHIEU'
);

/* ============================================================================
   Sau khi huy — 5 khang dinh
   ========================================================================= */

select lives_ok(
  $redo$insert into employee_pay_rates (company_id, employee_id, unit, amount, effective_from)
        values ('cty-01', 'nv-01a', 'month', 9000000, '2024-02-01')$redo$,
  'huy roi thi khai lai duoc DUNG ngay cu (partial unique index)'
);

select is(
  (select amount from public.tf_pay_rate_at('nv-01a', '2024-02-15')),
  9000000::numeric(14,2),
  'tf_pay_rate_at bo qua dong da huy, tra dong khai lai'
);

select is(
  (select count(*)::int from employee_pay_rates
   where employee_id = 'nv-01a' and effective_from = '2024-02-01'),
  2,
  'ca hai dong van o lai — huy KHONG phai xoa'
);

select is(
  (select void_reason from employee_pay_rates
   where id = '11111111-1111-1111-1111-111111111111'),
  'go nham 111 thay vi 9.000.000',
  'ly do huy doc lai duoc tu lich su'
);

select throws_ok(
  $del$delete from employee_pay_rates
     where id = '11111111-1111-1111-1111-111111111111'$del$,
  '23001',
  null,
  'DELETE van bi tu choi ke ca tren mot dong da huy'
);

/* ============================================================================
   employee_overtime_rates — cung co che, 4 khang dinh

   Bang nay la ban sao cua employee_pay_rates va co CUNG ngo cut truoc 0038.
   Sua mot bang ma bo bang kia se de lai dung con bug do o mot man hinh trong
   giong het man hinh vua sua — nen no duoc kiem o day, khong duoc suy ra.
   ========================================================================= */

insert into employee_overtime_rates (id, company_id, employee_id, value_type, value, effective_from)
values (
  '22222222-2222-2222-2222-222222222222',
  'cty-01', 'nv-01a', 'fixed_hourly', 1, '2024-03-01'
);

select throws_ok(
  $otsneaky$update employee_overtime_rates
     set voided_at = now(), void_reason = 'x', value = 60000
     where id = '22222222-2222-2222-2222-222222222222'$otsneaky$,
  '23001',
  null,
  'employee_overtime_rates: huy MA DOI LUON gia tri bi tu choi'
);

select lives_ok(
  $otvoid$update employee_overtime_rates
     set voided_at = now(),
         voided_by = '00000000-0000-0000-0000-000000000001',
         void_reason = 'go nham 1d/gio'
     where id = '22222222-2222-2222-2222-222222222222'$otvoid$,
  'employee_overtime_rates: huy kem ly do duoc chap nhan'
);

select lives_ok(
  $otredo$insert into employee_overtime_rates (company_id, employee_id, value_type, value, effective_from)
          values ('cty-01', 'nv-01a', 'fixed_hourly', 60000, '2024-03-01')$otredo$,
  'employee_overtime_rates: huy roi thi khai lai duoc DUNG ngay cu'
);

select is(
  (select value from public.tf_employee_overtime_rate_at('nv-01a', '2024-03-15')),
  60000::numeric(14,2),
  'tf_employee_overtime_rate_at bo qua dong da huy'
);

select lives_ok(
  $otfk$update employee_overtime_rates set voided_by = null
     where id = '22222222-2222-2222-2222-222222222222'$otfk$,
  'employee_overtime_rates: set-null cua khoa ngoai toi auth.users di qua duoc'
);

select lives_ok(
  $fk$update employee_pay_rates set voided_by = null
     where id = '11111111-1111-1111-1111-111111111111'$fk$,
  'set-null cua khoa ngoai toi auth.users di qua duoc (bug tu 0022, sua o 0038)'
);

select * from finish();

rollback;
