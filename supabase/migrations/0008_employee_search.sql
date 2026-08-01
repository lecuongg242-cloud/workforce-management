-- 0008_employee_search.sql
--
-- RPC dung boi GET /api/employees (plan 02-05) de loc tim kiem bo dau qua
-- public.tf_normalize() (0007_search_normalize.sql). PostgREST khong goi
-- duoc mot bieu thuc tuy y (vi du tf_normalize(full_name)) truc tiep trong
-- .filter() tren mot cot thuong, nen phep loc nay di qua mot RPC tra ve
-- DANH SACH id KHOP tim kiem — Route Handler sau do dung ket qua nay lam
-- `.in("id", ...)` tren truy van `.from("employees")` binh thuong, cung
-- hang voi cac bo loc/phan trang khac. Chon huong nay (thay vi chain
-- .eq()/.order()/.range() truc tiep len ket qua mot RPC tra ve setof
-- employees) de Route Handler chi co MOT hinh dang builder duy nhat
-- (`.from("employees")`) bat ke co tu khoa tim kiem hay khong — don gian
-- hon va khong phu thuoc suy dien kieu cua hai nhanh khac nhau.
--
-- security invoker (mac dinh, khong khai security definer) — RLS
-- employees_select_member van la lop phong thu thu hai binh thuong, RPC
-- khong bypass RLS: mot nguoi khong phai thanh vien cua p_company_id se
-- nhan ve mang rong du ham co duoc goi voi company_id nao di nua.
--
-- Ky tu `%`/`_` trong tu khoa nguoi dung go duoc escape truoc khi dua vao
-- LIKE — mock V1 dung `.includes()` (khop chuoi con thuan tuy), khong phai
-- ky tu dai dien SQL, nen mot nguoi go "%" khong duoc phep bien thanh
-- "khop moi thu".
create function public.tf_search_employee_ids(p_company_id text, p_keyword text)
returns table (id text)
language sql
stable
set search_path = public, pg_temp
as $$
  select e.id
  from employees e
  where e.company_id = p_company_id
    and public.tf_normalize(
      e.full_name || ' ' || e.code || ' ' || e.phone || ' ' || e.email
    ) like '%' || replace(replace(public.tf_normalize(p_keyword), '%', '\%'), '_', '\_') || '%' escape '\'
$$;
