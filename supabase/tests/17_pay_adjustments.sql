-- supabase/tests/17_pay_adjustments.sql
--
-- Danh muc phu cap / khau tru va pham vi ap dung (migration 0023, plan
-- 05-2-03).
--
-- Cac khang dinh `throws_ok` o day deu kiem MOT CACH KHAI VO NGHIA bi chan
-- ngay tai database. Khong cai nao trong so do la mot loi nguoi dung se gap
-- hang ngay — chung la nhung dong du lieu ma neu LOT VAO duoc thi phep tinh
-- luong cua 05-2-04 se ra mot con so ma khong ai giai thich duoc: mot dong
-- `company` kem gia tri (gia tri bi lo di), mot dong `department` khong gia
-- tri (khong biet phong nao), mot khoan CONG tinh theo so lan di muon, hay
-- mot khoan tru 300% luong ngay.

begin;

select plan(10);

/* ============================================================================
   Du lieu doi chieu: mot khoan phu cap toan cong ty cua cty-01.
   Chay o vai tro mac dinh (chu bang, bo qua RLS) — day la buoc dung fixture.
   ========================================================================= */

insert into pay_adjustments (id, company_id, name, kind, value_type, value)
values (
  '11111111-1111-1111-1111-111111111111',
  'cty-01', 'Phụ cấp ăn trưa', 'allowance', 'fixed_amount', 730000
);

/* ============================================================================
   scope_value va scope_type phai khop nhau — 3 khang dinh
   ========================================================================= */

select lives_ok(
  $ok$insert into pay_adjustment_scopes
      (company_id, adjustment_id, mode, scope_type, scope_value)
    values ('cty-01', '11111111-1111-1111-1111-111111111111',
            'include', 'company', null)$ok$,
  'pay_adjustment_scopes: scope_type=company voi scope_value NULL la hop le'
);

select throws_ok(
  $bad1$insert into pay_adjustment_scopes
      (company_id, adjustment_id, mode, scope_type, scope_value)
    values ('cty-01', '11111111-1111-1111-1111-111111111111',
            'include', 'company', 'dept-01')$bad1$,
  '23514',
  null,
  'pay_adjustment_scopes: scope_type=company KEM gia tri bi chan (gia tri do se bi lo di)'
);

select throws_ok(
  $bad2$insert into pay_adjustment_scopes
      (company_id, adjustment_id, mode, scope_type, scope_value)
    values ('cty-01', '11111111-1111-1111-1111-111111111111',
            'include', 'department', null)$bad2$,
  '23514',
  null,
  'pay_adjustment_scopes: scope_type=department KHONG co gia tri bi chan (khong biet phong nao)'
);

/* ============================================================================
   Cach khai vo nghia o bang khoan — 2 khang dinh
   ========================================================================= */

select throws_ok(
  $bad3$insert into pay_adjustments (company_id, name, kind, value_type, value, basis)
    values ('cty-01', 'Thưởng đi muộn', 'allowance', 'fixed_amount', 50000, 'per_late')$bad3$,
  '23514',
  null,
  'pay_adjustments: basis=per_late voi kind=allowance bi chan (phat di muon khong the la khoan cong, D-41)'
);

select throws_ok(
  $bad4$insert into pay_adjustments (company_id, name, kind, value_type, value)
    values ('cty-01', 'Trừ ba trăm phần trăm', 'deduction', 'percent_of_daily_wage', 300)$bad4$,
  '23514',
  null,
  'pay_adjustments: percent_of_daily_wage > 100 bi chan (gan nhu chac chan la go nham)'
);

/* ============================================================================
   Cascade — 2 khang dinh

   Xoa mot khoan phai keo theo pham vi cua no. Neu khong, cac dong pham vi mo
   coi se o lai va mot khoan MOI dung lai id do (khong the xay ra voi uuid,
   nhung mot lan phuc hoi du lieu tay thi co) se thua huong pham vi cua khoan
   cu — tuc la mot nhom nguoi bong nhien nhan mot khoan khong ai khai cho ho.
   ========================================================================= */

select is(
  (select count(*)::int from pay_adjustment_scopes
    where adjustment_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'pay_adjustment_scopes: dong pham vi hop le da duoc ghi'
);

select lives_ok(
  $del$delete from pay_adjustments
     where id = '11111111-1111-1111-1111-111111111111'$del$,
  'pay_adjustments: xoa duoc o tang database (quy tac "chi tat, khong xoa" nam o tang ung dung)'
);

select is(
  (select count(*)::int from pay_adjustment_scopes
    where adjustment_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'pay_adjustment_scopes: xoa khoan keo theo pham vi cua no (on delete cascade)'
);

/* ============================================================================
   Co lap cheo doanh nghiep — 2 khang dinh
   ========================================================================= */

insert into pay_adjustments (company_id, name, kind, value_type, value)
values ('cty-01', 'Phụ cấp xăng xe', 'allowance', 'fixed_amount', 500000);

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  (select count(*) from pay_adjustments where company_id = 'cty-01') > 0
    and (select count(*) from pay_adjustments where company_id = 'cty-02') = 0,
  'pay_adjustments: user 0001 doc duoc >0 dong cty-01 va 0 dong cty-02'
);

select throws_ok(
  $ins_pa$insert into pay_adjustments (company_id, name, kind, value_type, value)
    values ('cty-02', 'Khoản chéo', 'allowance', 'fixed_amount', 100000)$ins_pa$,
  '42501',
  'new row violates row-level security policy for table "pay_adjustments"',
  'pay_adjustments: user 0001 chen dong mang company_id cty-02 bi tu choi'
);

select tf_test_logout();

select * from finish(true);

rollback;
