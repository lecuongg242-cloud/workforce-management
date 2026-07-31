-- 0003_enums_time.sql
--
-- Enum nghiep vu con lai cua src/lib/types/domain.ts + quy uoc thoi gian
-- UTC+7 va ca qua dem cua TimeFlow. Day la diem quy doi mui gio DUY NHAT cua
-- toan he thong (tf_tz()) va la ban SQL cua minutesBetween/isOvernight trong
-- src/lib/format.ts, dung nguyen ven de attendance_records (plan 01-04) va
-- periods (plan 01-05) chi viec goi lai, khong tu viet offset o noi khac.
--
-- D-08 (one-way, xac nhan qua checkpoint:decision cua plan 01-02 Task 1):
-- ca qua dem tinh tron vao NGAY BAT DAU CA. Xem comment tren tf_work_date.

/* -------------------------------------------------------------------------- */
/* Enum nghiep vu con lai — gia tri chep nguyen van tu domain.ts, KHONG dich  */
/* -------------------------------------------------------------------------- */

create type employee_status as enum (
  'active', 'on_leave', 'terminated', 'pending_invite'
);

create type contract_type as enum (
  'full_time', 'part_time', 'probation', 'seasonal', 'intern'
);

create type gender as enum ('male', 'female', 'other');

create type attendance_status as enum (
  'on_time', 'late', 'early_leave', 'missing_checkout',
  'leave_paid', 'leave_unpaid', 'day_off'
);

create type request_type as enum (
  'leave', 'attendance_supplement', 'time_adjustment', 'overtime'
);

create type request_status as enum ('pending', 'approved', 'rejected');

-- system_role va company_role (tao o 0002_tenancy.sql) trung tap gia tri
-- nhung la hai khai niem khac nhau: vai tro trong he thong so voi vai tro
-- trong mot doanh nghiep cu the. Giu hai kieu enum rieng bat — khong tai su
-- dung company_role cho cot employees.system_role o plan 01-04.
create type system_role as enum ('owner', 'admin', 'manager', 'employee');

create type department_status as enum ('active', 'inactive');

create type shift_status as enum ('active', 'archived');

/* -------------------------------------------------------------------------- */
/* Ham quy doi mui gio duy nhat cua he thong                                  */
/* -------------------------------------------------------------------------- */

create function public.tf_tz()
returns text
language sql
immutable
as $$
  select 'Asia/Ho_Chi_Minh';
$$;

comment on function public.tf_tz() is
  'Diem quy doi mui gio DUY NHAT cua TimeFlow. Khong noi nao khac trong schema '
  'duoc viet offset gio bang tay hay hang mui gio rieng.';

/* -------------------------------------------------------------------------- */
/* Ngay cong cua mot khoanh khac — quy uoc D-08                               */
/* -------------------------------------------------------------------------- */

create function public.tf_work_date(p_instant timestamptz)
returns date
language sql
immutable
as $$
  select (p_instant at time zone public.tf_tz())::date;
$$;

comment on function public.tf_work_date(timestamptz) is
  'Quy uoc D-08 (one-way, xac nhan tai checkpoint:decision cua plan 01-02): '
  'ngay cong cua MOT KHOANH KHAC la ngay theo gio Asia/Ho_Chi_Minh cua chinh '
  'khoanh khac do. Ap dung cho ca qua dem: mot lan cham vao luc 22:00 gio VN '
  'ngay D thuoc ve work_date = D du gio UTC cua khoanh khac da sang ngay D+1. '
  'Khong cau hinh duoc theo doanh nghiep. p_instant la timestamptz (diem tuyet '
  'doi tren truc thoi gian) nen ket qua KHONG phu thuoc SET timezone cua phien.';

/* -------------------------------------------------------------------------- */
/* Ca co qua dem hay khong                                                    */
/* -------------------------------------------------------------------------- */

create function public.tf_overnight(p_start time, p_end time)
returns boolean
language sql
immutable
as $$
  select p_end < p_start;
$$;

comment on function public.tf_overnight(time, time) is
  'Dung khi p_end nho hon THUC SU p_start. Bang nhau tra false vi truong hop '
  'do da bi CHECK tren bang shifts cam luu (xem plan 01-04).';

/* -------------------------------------------------------------------------- */
/* So phut cua mot ca theo gio ke hoach (start_time/end_time kieu time)       */
/* -------------------------------------------------------------------------- */

create function public.tf_shift_minutes(
  p_start time,
  p_end time,
  p_break_minutes int
)
returns int
language sql
immutable
as $$
  select case
    when p_end = p_start then 0
    else greatest(
      (
        case
          when p_end < p_start then
            -- Qua dem: cong them 24h (1440 phut) truoc khi tru start, roi
            -- moi tru break — khong dung `time + interval` vi phep cong do
            -- wrap modulo 24h trong Postgres va se trieu tieu chinh muc dich
            -- cua nhanh nay.
            (extract(hour from p_end)::int * 60 + extract(minute from p_end)::int) + 1440
              - (extract(hour from p_start)::int * 60 + extract(minute from p_start)::int)
          else
            (extract(hour from p_end)::int * 60 + extract(minute from p_end)::int)
              - (extract(hour from p_start)::int * 60 + extract(minute from p_start)::int)
        end
      ) - coalesce(p_break_minutes, 0),
      0
    )
  end;
$$;

comment on function public.tf_shift_minutes(time, time, int) is
  'Ban SQL cua minutesBetween trong src/lib/format.ts, khac mot diem co chu '
  'dich: p_end = p_start tra 0 thay vi 1440 (mot ca khong the dai dung 24 gio '
  'trong mo hinh nghiep vu nay).';

/* -------------------------------------------------------------------------- */
/* So phut lam viec thuc te giua hai moc cham cong (timestamptz)             */
/* -------------------------------------------------------------------------- */

create function public.tf_worked_minutes(
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_break_minutes int
)
returns int
language sql
immutable
as $$
  select case
    when p_check_in is null or p_check_out is null then 0
    else greatest(
      (extract(epoch from (p_check_out - p_check_in)) / 60)::int
        - coalesce(p_break_minutes, 0),
      0
    )
  end;
$$;

comment on function public.tf_worked_minutes(timestamptz, timestamptz, int) is
  'Tra 0 khi mot trong hai moc la NULL, khong loi va khong am — ban ghi thieu '
  'gio ra la trang thai du lieu that sinh ra duoc, khong phai truong hop can '
  'chan lai o tang ham.';
