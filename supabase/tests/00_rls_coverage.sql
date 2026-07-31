-- supabase/tests/00_rls_coverage.sql
--
-- Cong quet toan bo schema `public` tim bang thieu RLS hoac bat RLS ma
-- khong co policy nao (threat T-01-02: bang them ve sau quen bat RLS).
-- File nay doc lap, chay duoc ca trong bo test day du (\ir tu run-all.sql)
-- lan nhu mot buoc CI rieng (psql -f truc tiep).

begin;

select plan(4);

-- Danh sach mien tru: CHI duoc mo rong cho bang tra cuu khong chua du lieu
-- doanh nghiep (vd bang danh muc tinh du lieu). Mo rong danh sach nay
-- KHONG BAO GIO la cach hop le de lam CI xanh — cong do chi duoc sua bang
-- cach them policy con thieu.
create temporary table tf_rls_exempt (tablename text) on commit drop;
insert into tf_rls_exempt select unnest(array[]::text[]);

/* ============================================================================
   Tu chung minh cong co rang, truoc khi chay 3 khang dinh that.
   Tao mot bang trong `public` KHONG bat RLS, chay rieng truy van cua khang
   dinh 2 va dung isnt_empty de xac nhan no bat duoc bang do, roi drop truoc
   khi chay 3 khang dinh that — nho vay mot lan chay xanh vua chung minh
   schema sach vua chung minh cong khong phai luon xanh.
   ========================================================================= */

create table public.tf_gate_probe_self_check (id int);

select isnt_empty(
  $probe$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = false
      and c.relname not in (select tablename from tf_rls_exempt)
  $probe$,
  'tu-kiem-chung: khang dinh "bang thieu RLS" bat duoc bang tam chua bat RLS (chung minh cong co rang)'
);

drop table public.tf_gate_probe_self_check;

/* ============================================================================
   1. Khong rong: schema `public` phai co it nhat mot bang de quet. Schema
      rong khong duoc tinh la dat.
   ========================================================================= */

select ok(
  (
    select count(*)
    from pg_tables
    where schemaname = 'public'
      and tablename not in (select tablename from tf_rls_exempt)
  ) > 0,
  'schema public co it nhat mot bang de quet cong RLS (schema rong khong duoc tinh la dat)'
);

/* ============================================================================
   2. Bang thieu RLS: bang thuong (relkind = 'r') trong public co
      relrowsecurity = false. Thong diep loi liet ke ten bang sap theo
      tablename tang dan de output CI on dinh.
   ========================================================================= */

select ok(
  n_missing = 0,
  format(
    'khong co bang public nao thieu RLS%s',
    case when n_missing > 0 then ' — vi pham: ' || violator_names else '' end
  )
)
from (
  select
    count(*) as n_missing,
    string_agg(tablename, ', ' order by tablename) as violator_names
  from (
    select c.relname as tablename
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = false
      and c.relname not in (select tablename from tf_rls_exempt)
  ) v
) agg;

/* ============================================================================
   3. Bang bat RLS ma 0 policy: bat RLS nhung khong xuat hien trong
      pg_policies. Thong diep loi cung liet ke ten bang sap theo tablename.
   ========================================================================= */

select ok(
  n_missing = 0,
  format(
    'khong co bang public nao bat RLS ma khong co policy%s',
    case when n_missing > 0 then ' — vi pham: ' || violator_names else '' end
  )
)
from (
  select
    count(*) as n_missing,
    string_agg(tablename, ', ' order by tablename) as violator_names
  from (
    select c.relname as tablename
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = true
      and c.relname not in (select tablename from tf_rls_exempt)
      and not exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = c.relname
      )
  ) v
) agg;

select * from finish(true);

rollback;
