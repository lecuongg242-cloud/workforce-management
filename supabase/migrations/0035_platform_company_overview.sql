-- 0035_platform_company_overview.sql
--
-- SADM-01: danh sach toan he thong cho doi van hanh TimeFlow.
--
-- KHONG doc bang khoa service. Cong `src/__tests__/admin-client-scope.test.ts`
-- cam `createAdminSupabase()` ngoai `"use server"`/`mutations/`, va noi cong
-- do cho mot Route Handler DOC la doi mot cong dang co rang lay su tien tay
-- (D-56). Thay vao do la mot ham SECURITY DEFINER tu kiem quyen ben trong.
--
-- Ham nay duoc phep nhin xuyen doanh nghiep MA KHONG CAN mot phien ho tro, vi
-- no chi tra ve SO TONG HOP — khong mot dong du lieu nghiep vu nao (khong ten
-- nhan vien, khong ban ghi cham cong, khong con so tien). Doc sau vao mot
-- doanh nghiep van bat buoc phai mo phien, va do moi la thu duoc ghi vet.

create function public.tf_platform_company_overview()
returns table (
  company_id text,
  company_name text,
  company_code text,
  employee_count int,
  last_activity_at timestamptz,
  open_period_start date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.name,
    c.code,
    (select count(*)::int from employees e where e.company_id = c.id),
    -- `attendance_records` KHONG co cot `created_at`. `check_in_at` la moc
    -- dung nghia "hoat dong gan nhat" hon mot dau thoi gian tao dong: no la
    -- luc co nguoi that bam cham cong. Nullable, nhung max() bo qua NULL.
    (select max(a.check_in_at) from attendance_records a where a.company_id = c.id),
    -- `periods` khong co cot thang: ky bi ep tron mot thang duong lich (D-09)
    -- va luu hai moc `start_date`/`end_date`. Tra ve `start_date`, tang ung
    -- dung cat lay "YYYY-MM".
    (select p.start_date from periods p
       where p.company_id = c.id and p.status = 'open'
       order by p.start_date desc limit 1)
  from companies c
  -- Toan bo phep nhin xuyen doanh nghiep cua ham nay nam sau DUNG MOT dieu
  -- kien. Sai o day la sai toan bo, nen no dung o menh de where — mot cho,
  -- khong the bi mot nhanh nao di vong qua.
  where public.tf_is_platform_admin()
  order by c.name;
$$;

revoke execute on function public.tf_platform_company_overview() from public;
grant execute on function public.tf_platform_company_overview() to authenticated;
