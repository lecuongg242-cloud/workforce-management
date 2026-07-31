-- supabase/tests/helpers.sql
--
-- Ham dung chung cho bo test pgTAP: gia lap dang nhap mot user cu the (bang
-- cach dat GUC `request.jwt.claims` va chuyen role sang `authenticated`) va
-- dang xuat. Hai ham nay chi ton tai o day, KHONG duoc dua vao
-- supabase/migrations/ — CI va `db:push` chi ap migrations/*.sql, khong bao
-- gio nap thu muc tests/ vao schema san pham (threat T-01-04).

create or replace function tf_test_login(p_user_id uuid) returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text)::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

create or replace function tf_test_logout() returns void
language plpgsql
as $$
begin
  reset role;
end;
$$;
