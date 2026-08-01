-- 0009_employee_code_duplicate_check.sql
--
-- `createEmployee` (plan 02-07) can kiem tra ma nhan vien trung trong PHAM VI
-- mot doanh nghiep, khong phan biet hoa thuong -- dung lai public.tf_normalize()
-- (0007_search_normalize.sql) thay vi viet lai logic chuan hoa o tang ung
-- dung. PostgREST khong cho phep goi tf_normalize(code) truc tiep trong
-- `.filter()` tren mot cot thuong (cung ly do voi RPC tim kiem cua
-- 0008_employee_search.sql), nen phep so sanh nay di qua mot RPC tra ve
-- boolean.
--
-- Day la lop MOT (tang ung dung, cho thong diep loi tieng Viet ro rang).
-- Rang buoc `unique (company_id, code)` cua 0004_core_entities.sql van la
-- lop HAI (dua tren so sanh byte chinh xac, khong chuan hoa) — bat rieng
-- ma loi 23505 o tang Server Action neu ca hai request dua vao cung mot
-- luc voi CHINH XAC cung ma (T-02-07-07).
--
-- security invoker (mac dinh, khong khai security definer) -- RLS
-- employees_select_member van la lop phong thu doc lap: nguoi goi khong
-- phai thanh vien cua p_company_id luon nhan ve false du co ma trung that
-- hay khong (cung tinh than voi tf_search_employee_ids cua 0008).
create function public.tf_employee_code_taken(p_company_id text, p_code text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from employees e
    where e.company_id = p_company_id
      and public.tf_normalize(e.code) = public.tf_normalize(p_code)
  );
$$;
