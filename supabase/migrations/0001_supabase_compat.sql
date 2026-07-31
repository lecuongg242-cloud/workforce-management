-- 0001_supabase_compat.sql
--
-- Lop tuong thich idempotent: cung mot bo migration nay phai chay duoc ca tren
-- Supabase cloud (project ujvgagujfsdrlmjdhooi, D-01) lan tren Postgres trang
-- ma GitHub Actions dung trong CI (D-04). Tren project cloud, moi nhanh duoi
-- day deu la no-op vi schema/role/bang/ham da ton tai san.
--
-- Khong dat `create extension pgtap` o day — pgTAP la cong cu test, khong
-- thuoc schema san pham (xem supabase/tests/00_install_pgtap.sql).

create schema if not exists extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;

-- Bang toi thieu chi du de seed/test dung — chi tao khi auth.users chua ton
-- tai (tren cloud, GoTrue da tao bang day du voi nhieu cot hon). Can them
-- instance_id/aud/role vi supabase/seed.sql chen du cac cot nay de mo phong
-- dung hinh dang ban ghi auth.users cua Supabase Auth that.
do $$
begin
  if to_regclass('auth.users') is null then
    create table auth.users (
      id uuid primary key,
      instance_id uuid,
      aud text,
      role text,
      email text
    );
  end if;
end
$$;

-- Shim cho auth.uid(): tren cloud ham nay da ton tai san (bo qua). Tren CI,
-- doc GUC `request.jwt.claims` ma supabase/tests/helpers.sql dat qua
-- set_config(..., true) de gia lap nguoi dang dang nhap.
do $$
begin
  if to_regprocedure('auth.uid()') is null then
    execute $fn$
      create function auth.uid()
      returns uuid
      language sql
      stable
      as $body$
        select (
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
        )::uuid
      $body$;
    $fn$;
  end if;
end
$$;
