-- 0021_period_close.sql
--
-- Chot ky cong va bao ve ky da chot (PERD-01/PERD-02, plan 05-05). Day la loi
-- hua nang nhat cua Phase 5: mot con so da chot thi khong doi sau lung ai.
--
-- (1) VI SAO BAO VE NAM O DATABASE CHU KHONG O TANG UNG DUNG (D-32)
--
-- Mot lop kiem o tang ung dung chi bao ve duoc nhung duong ghi ma nguoi viet
-- NHO kiem. Mot duong ghi moi — viet o phase sau, boi mot nguoi khac, cho mot
-- man hinh khac — quen kiem la ky da chot bi sua lang le. Va khong ai phat
-- hien ra: so lieu khong bao loi, no chi don gian la khac di.
--
-- Trigger o day chan TAT CA: cham cong hang ngay, mot Server Action moi, mot
-- lenh `update` chay tay qua PostgREST. Do la cung ly do da dan toi D-25a o
-- Phase 4, ap cho mot bat bien nang hon.
--
-- (2) CO BO QUA TRIGGER — VA VI SAO NO KHONG PHAI MOT CUA HAU
--
-- Duong ghi HOP LE duy nhat vao mot ky da chot la
-- `tf_apply_approved_request()` (migration 0018). Ham do tu dat
-- `set_config('tf.applying_approved_request', 'on', true)` o dau than no;
-- tham so `true` lam co TRANSACTION-LOCAL, tuc la no khong ton tai ngoai
-- transaction dang chay.
--
-- CANH BAO CHO NGUOI SUA SAU: dat co nay o BAT KY cho nao khac —
-- mot Server Action, mot migration, mot phien psql — la mo mot cua hau vao
-- toan bo du lieu da chot. Neu mot duong ghi moi can vao ky da chot, cach dung
-- la mo rong `tf_apply_approved_request()`, khong phai dat co o cho khac.
--
-- (3) KHONG CO HAM MO LAI KY DA CHOT (D-32b)
--
-- Co chu dich, khong phai bo sot. Mot nut "mo lai" lam rong nghia cua viec
-- chot. Khi pilot that su can, no phai la mot thao tac CO TEN RIENG, co ly do
-- bat buoc va co audit rieng — thiet ke do chua duoc lam, nen o day khong co
-- gi de goi.
--
-- (4) THU TUC GO TRIGGER CO Y THUC (khi phai sua du lieu hong that)
--
--   begin;
--   alter table attendance_records disable trigger attendance_period_guard;
--   -- ... cau lenh sua ...
--   alter table attendance_records enable trigger attendance_period_guard;
--   commit;
--
-- Ghi lai o day de nguoi sau khong phai doan, va de viec do luon la mot hanh
-- dong CO Y THUC chu khong phai mot lan `update` tien tay.
--
-- (5) FILE NAY CHAY LAI DUOC MA VO HAI — cung ly do voi 0018: mot migration
-- chua phat hanh ma sua duoc tai cho thi khong phai de lai mot file chi de va
-- mot dong.

drop trigger if exists attendance_period_guard on attendance_records;
drop function if exists public.tf_attendance_period_guard();
drop function if exists public.tf_close_period(text, date);
drop function if exists public.tf_close_period(text, date, uuid);
drop function if exists public.tf_closed_period_start(text, date);

/* -------------------------------------------------------------------------- */
/* Ky da chot cua mot ngay cong                                                */
/* -------------------------------------------------------------------------- */
-- Tach thanh mot ham rieng de trigger doc duoc va de test goi thang duoc.
-- `security definer` CAN THIET o day: trigger chay duoi quyen nguoi ghi, ma
-- nguoi ghi co the khong doc duoc bang `periods` qua RLS trong moi tinh huong
-- (vi du duong ghi di bang service key voi `auth.uid()` rong). Mot lop bao ve
-- ma chinh no bi RLS lam mu la mot lop bao ve co lo.

create function public.tf_closed_period_start(
  p_company_id text,
  p_work_date date
)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.start_date
  from periods p
  where p.company_id = p_company_id
    and p.status = 'closed'
    and p_work_date between p.start_date and p.end_date
  limit 1;
$$;

comment on function public.tf_closed_period_start(text, date) is
  'Ngay bat dau cua ky DA CHOT chua p_work_date, hoac NULL neu ngay do khong '
  'thuoc ky da chot nao. security definer co y: mot lop bao ve bi RLS lam mu '
  'la mot lop bao ve co lo.';

/* -------------------------------------------------------------------------- */
/* Trigger bao ve                                                              */
/* -------------------------------------------------------------------------- */
-- SQLSTATE 'TF001' la ma RIENG cua bat bien nay. Dung mot ma rieng thay vi
-- '23001' dung chung voi cac trigger append-only de tang ung dung bat duoc
-- DUNG truong hop nay va doi thanh mot cau noi duoc ("ky thang nay da chot,
-- hay gui yeu cau bo sung cong") thay vi mot thong diep chung chung.

create function public.tf_attendance_period_guard()
returns trigger
language plpgsql
as $$
declare
  v_company_id text;
  v_work_date date;
  v_period_start date;
begin
  if tg_op = 'DELETE' then
    v_company_id := old.company_id;
    v_work_date := old.work_date;
  else
    v_company_id := new.company_id;
    v_work_date := new.work_date;
  end if;

  -- Duong ghi hop le duy nhat: ben trong tf_apply_approved_request(), noi co
  -- nay duoc dat. `true` o tham so thu hai cua current_setting nghia la tra
  -- NULL thay vi loi khi bien chua duoc dat lan nao.
  if current_setting('tf.applying_approved_request', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_period_start := public.tf_closed_period_start(v_company_id, v_work_date);

  if v_period_start is not null then
    raise exception
      'Kỳ công tháng % đã chốt. Dữ liệu chấm công của kỳ này chỉ thay đổi được qua một yêu cầu được duyệt.',
      to_char(v_period_start, 'MM/YYYY')
      using errcode = 'TF001';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

comment on function public.tf_attendance_period_guard() is
  'D-32/PERD-02: tu choi moi thao tac ghi vao attendance_records cua mot ngay '
  'thuoc ky da chot, TRU khi co transaction-local tf.applying_approved_request '
  'dang bat (chi tf_apply_approved_request dat co do). SQLSTATE rieng TF001.';

create trigger attendance_period_guard
  before insert or update or delete on attendance_records
  for each row
  execute function public.tf_attendance_period_guard();

/* -------------------------------------------------------------------------- */
/* Chot ky                                                                     */
/* -------------------------------------------------------------------------- */
-- `security invoker` (mac dinh) CO Y: day khong phai ham kiem quyen. Gioi han
-- "chi owner/admin chot ky" nam o Server Action (`requireRole`), con RLS cua
-- bang `periods` van la lop phong thu thu hai theo ranh gioi doanh nghiep.
--
-- KHONG co ham nguoc lai (D-32b) — xem muc (3) cua khoi comment dau file.

-- VI SAO CO THAM SO `p_closed_by` TRONG KHI DA CO `auth.uid()`
--
-- `auth.uid()` LUON THANG khi no co gia tri, nen mot nguoi dung dang nhap
-- KHONG THE ghi ten nguoi khac vao `closed_by` du co truyen tham so gi
-- (T-05-05-04). Tham so nay chi duoc dung khi KHONG co ngu canh auth — tuc la
-- nguoi goi da o trong mot ngu canh dac quyen san (khoa secret phia server,
-- hoac mot phien psql), noi ma mot ke tan cong khong den duoc.
--
-- Khong co no thi moi lan chot ky di qua duong dac quyen se ghi `closed_by`
-- NULL — mot vet khong tra loi duoc cau hoi "ai chot", tuc la mat dung dieu
-- ma T-05-05-04 ton tai de giu.

create function public.tf_close_period(
  p_company_id text,
  p_start_date date,
  p_closed_by uuid default null
)
returns periods
language plpgsql
as $$
declare
  v_start date;
  v_end date;
  v_today date;
  v_period periods%rowtype;
begin
  -- Ep tron thang o day chu khong tin tham so: rang buoc CHECK cua bang
  -- (0005) se tu choi mot khoang khong tron thang, nhung thong diep cua no
  -- khong doc duoc. Tu chuan hoa thi khong bao gio cham toi truong hop do.
  v_start := date_trunc('month', p_start_date)::date;
  v_end := (date_trunc('month', p_start_date) + interval '1 month - 1 day')::date;
  v_today := public.tf_work_date(now());

  -- Chot mot thang chua qua la chot mot con so con dang thay doi.
  if v_end >= v_today then
    raise exception
      'Kỳ công tháng % chưa kết thúc (còn đến hết ngày %) nên chưa chốt được.',
      to_char(v_start, 'MM/YYYY'), to_char(v_end, 'DD/MM/YYYY')
      using errcode = 'restrict_violation';
  end if;

  -- Ky chua co dong nao thi TAO — quan tri khong phai lam mot buoc "khoi tao
  -- ky" rieng ma khong ai hieu de lam gi.
  insert into periods (company_id, start_date, end_date, status)
  values (p_company_id, v_start, v_end, 'open')
  on conflict (company_id, start_date) do nothing;

  select * into v_period
  from periods
  where company_id = p_company_id and start_date = v_start;

  if not found then
    -- Khong doc lai duoc dong vua chen nghia la RLS da chan: nguoi goi khong
    -- phai thanh vien cua doanh nghiep nay.
    raise exception 'Không tìm thấy kỳ công của doanh nghiệp này.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_period.status = 'closed' then
    raise exception
      'Kỳ công tháng % đã được chốt trước đó rồi.',
      to_char(v_start, 'MM/YYYY')
      using errcode = 'restrict_violation';
  end if;

  update periods
  set status = 'closed',
      -- Dau thoi gian tu dong ho DATABASE (D-19), khong tu tang ung dung.
      closed_at = now(),
      -- `auth.uid()` THANG khi co — xem khoi comment tren ham.
      closed_by = coalesce((select auth.uid()), p_closed_by)
  where company_id = p_company_id and start_date = v_start
  returning * into v_period;

  return v_period;
end;
$$;

comment on function public.tf_close_period(text, date, uuid) is
  'Chot mot ky cong (mot thang duong lich — D-09). Tu tao dong ky neu chua co, '
  'tu choi ky chua ket thuc va ky da chot. KHONG co ham nguoc lai: chua co '
  'duong mo lai ky da chot trong V2 (D-32b, co chu dich).';
