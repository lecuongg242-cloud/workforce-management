-- 0031_realign_attendance_to_shift.sql
--
-- AP CA LINH HOAT CHO KY CHUA CHOT.
--
-- ======================================================================
-- (1) VI SAO PHAN GHI NAM O DAY CHU KHONG O TANG UNG DUNG
-- ======================================================================
--
-- Hai ly do, va ly do thu hai moi la ly do that:
--
--   a) Cong `no-silent-period-write` (plan 05-06) cam moi file mutation ngoai
--      danh sach mien tru ghi thang vao `attendance_records`. Danh sach do
--      "chi duoc thu hep, khong duoc noi rong de lam cong xanh".
--
--   b) MOT LAN AP CA PHAI LA MOT GIAO DICH. Mot vong lap `update` tung dong
--      qua PostgREST khong nguyen tu: hong o dong thu ba de lai hai ngay da
--      doi, mot ngay chua doi, va KHONG co dong audit nao (audit duoc ghi sau
--      vong lap). So lieu do chay thang vao bang luong.
--
-- Than ham chay trong MOT giao dich, nen hoac ca lo doi, hoac khong ngay nao
-- doi.
--
-- ======================================================================
-- (2) MOT DINH NGHIA DUY NHAT CHO "NGAY NAO"
-- ======================================================================
--
-- `p_dry_run` cho phep DEM truoc khi ghi ma khong phai viet phep chon lan thu
-- hai o tang ung dung. Neu dem mot dang va ghi mot dang khac thi cau hoi xac
-- nhan ("co 3 ngay...") se noi doi, va khong ai phat hien ra.
--
-- ======================================================================
-- (3) KHONG BO QUA TRIGGER KY DA CHOT — CO Y
-- ======================================================================
--
-- Ham nay KHONG dat co `tf.applying_approved_request`, khac han
-- `tf_apply_approved_request()` (0018). Do la khac biet CO CHU DICH: duong
-- yeu cau duoc duyet CAN di qua ky da chot; duong nay thi KHONG BAO GIO duoc.
--
-- Bo loc `tf_closed_period_start(...) is null` o duoi la de khong gui mot lenh
-- chac chan hong. Trigger `attendance_period_guard` van la ranh gioi THAT: neu
-- bo loc nay co sai, trigger nem TF001 va ca giao dich bi huy.
--
-- (4) FILE NAY CHAY LAI DUOC MA VO HAI — khuon 0018/0021/0024/0030.

drop function if exists public.tf_realign_attendance_to_shift(text, text, text, boolean);

create function public.tf_realign_attendance_to_shift(
  p_company_id text,
  p_employee_id text,
  p_shift_id text,
  p_dry_run boolean default false
)
returns table (work_date date, was_late boolean)
language plpgsql
as $$
declare
  v_kind text;
begin
  -- TIEN DE: ca dich phai la ca LINH HOAT cua CHINH doanh nghiep do.
  --
  -- Kiem o day chu khong chi o tang ung dung: mot lan goi nham voi ca co gio
  -- se XOA do muon that cua nguoi ta, va do la mat du lieu khong khoi phuc
  -- duoc tu giao dien.
  select s.kind into v_kind
  from shifts s
  where s.id = p_shift_id
    and s.company_id = p_company_id;

  if v_kind is null then
    raise exception 'Không tìm thấy ca làm việc của doanh nghiệp này.'
      using errcode = 'no_data_found';
  end if;

  if v_kind <> 'hours' then
    raise exception
      'Chỉ áp được cho ca linh hoạt. Ca có giờ bắt đầu và kết thúc giữ nguyên phân loại của ngày hôm đó.'
      using errcode = 'restrict_violation';
  end if;

  if p_dry_run then
    return query
    select r.work_date, r.late_minutes > 0
    from attendance_records r
    where r.company_id = p_company_id
      and r.employee_id = p_employee_id
      and r.shift_id <> p_shift_id
      and public.tf_closed_period_start(r.company_id, r.work_date) is null
    order by r.work_date;
    return;
  end if;

  return query
  update attendance_records r
  set
    shift_id = p_shift_id,
    late_minutes = 0,
    early_leave_minutes = 0,
    -- CHI hai trang thai noi ve GIO GIAC moi doi. `missing_checkout` la mot su
    -- that ve du lieu; `leave_paid`/`leave_unpaid`/`day_off` la nhung ngay
    -- khong di lam. Dat het ve 'on_time' se lam bien mat ba su that khac nhau
    -- de sua mot cai thu tu.
    status = case
      when r.status in ('late', 'early_leave') then 'on_time'::attendance_status
      else r.status
    end
  where r.company_id = p_company_id
    and r.employee_id = p_employee_id
    and r.shift_id <> p_shift_id
    and public.tf_closed_period_start(r.company_id, r.work_date) is null
  returning r.work_date, false;
end;
$$;

comment on function public.tf_realign_attendance_to_shift(text, text, text, boolean) is
  'Ap mot ca LINH HOAT cho moi ngay cham cong cua ky CHUA CHOT. Mot giao dich '
  'duy nhat. KHONG bo qua trigger attendance_period_guard — khac han '
  'tf_apply_approved_request(). p_dry_run tra ve dung tap ngay se doi, de cau '
  'hoi xac nhan va lenh ghi khong bao gio noi hai dang khac nhau.';
