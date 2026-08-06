-- 0018_apply_approved_request.sql
--
-- Tac dong cua mot yeu cau DA DUOC DUYET len du lieu cong (APRV-03, plan
-- 05-02). Truoc file nay, duyet mot yeu cau chi doi mot cot trang thai.
--
-- (1) VI SAO PHAN GHI NAM O SQL CHU KHONG O JAVASCRIPT (D-32a)
--
-- Plan 05-05 bao ve ky da chot bang mot TRIGGER tren `attendance_records`, va
-- duong ghi hop le duy nhat di qua duoc trigger do la ham nay — nho mot co
-- `set_config('tf.applying_approved_request', 'on', true)` ma ham tu dat.
-- Tham so `true` nghia la TRANSACTION-LOCAL: co song dung trong transaction
-- dang chay va bien mat khi transaction ket thuc.
--
-- Do la ly do ky thuat bat buoc, khong phai mot so thich: PostgREST chay MOI
-- lenh trong MOT transaction rieng. Neu tang ung dung tu chen tung dong bang
-- vai loi goi PostgREST roi roi, thi khong loi goi nao trong so do nam cung
-- transaction voi lan dat co — va tat ca deu se bi trigger cua 05-05 chan.
-- Viet phan ghi o JavaScript roi hen "chuyen sang SQL sau" la lam lai tu dau.
--
-- Day la NGOAI LE CO CHU DICH dau tien voi khuon "logic o tang ung dung" cua
-- du an, va ly do la co bao ve khong ton tai ngoai transaction.
--
-- (2) VI SAO NGHI PHEP BO QUA NGAY NGHI VA NGAY LE (D-35)
--
-- Sinh ban ghi cho MOI ngay trong khoang se dem ca ngay nghi cuoi tuan va
-- ngay le vao so ngay nghi phep — nhan vien mat phep cho nhung ngay ho von da
-- duoc nghi. Chi nhung ngay thuoc `working_days` cua ca VA khong nam trong
-- `holidays` cua doanh nghiep moi sinh ban ghi.
--
-- Quy tac "ngay nao la ngay lam viec" o day phai cho CUNG ket qua voi
-- `classifyWorkDay()` trong `src/lib/attendance/classification.ts` (04-05):
-- ngay le uu tien, roi den `working_days` cua ca. `extract(isodow)` cua
-- Postgres dung cung quy uoc voi `isoWeekday()` (1 = Thu Hai … 7 = Chu Nhat).
--
-- (3) VI SAO `overtime` KHONG GHI GI (D-31)
--
-- Duyet mot yeu cau tang ca nghia la CHO PHEP LAM THEM. So gio tang ca van do
-- du lieu cham cong that quyet dinh, qua mo-dun phan loai cua Phase 4. Ghi so
-- gio khai trong don vao du lieu cong la tao NGUON SU THAT THU HAI cho cung
-- mot con so — va khi hai nguon lech nhau thi khong ai biet tin cai nao.
--
-- (4) NGAY DA CO DU LIEU KHONG BI GHI DE
--
-- Nhan vien da cham cong hom do nghia la ho da di lam. Mot don nghi duoc duyet
-- muon khong xoa duoc su that do — no chi neu ra mot mau thuan can nguoi xem.
-- Nhung ngay nhu vay duoc BO QUA va tra ve trong `skipped_dates` de man hinh
-- duyet noi ro cho nguoi bam biet.

-- (5) VI SAO FILE NAY CHAY LAI DUOC MA VO HAI
--
-- Bon lenh `drop ... if exists` + `add column if not exists` o duoi lam
-- migration nay ap lai duoc len mot database da co no. Cung ly do voi
-- `on conflict do nothing` cua backfill trong 0015: mot migration chay lai
-- duoc la mot migration sua duoc khi phat hien loi, thay vi phai de lai mot
-- file 0019 chi de vá mot dong.

/* -------------------------------------------------------------------------- */
/* Bat bien chong ap dung hai lan                                              */
/* -------------------------------------------------------------------------- */
-- Nam tren CHINH dong yeu cau, khong o mot bang phu: dieu kien kiem phai nam
-- ngay canh du lieu ma no bao ve. Ap dung hai lan la tru cong hai lan, va loi
-- do hien ra duoi dang SO LIEU SAI chu khong phai mot thong bao loi.

alter table work_requests add column if not exists applied_at timestamptz null;

drop function if exists public.tf_apply_approved_request(text);
drop function if exists public.tf_preview_request_effect(text);
drop function if exists public.tf_leave_target_days(text);
drop type if exists public.tf_request_effect;

comment on column work_requests.applied_at is
  'Thoi diem tac dong cua yeu cau nay da duoc ghi vao du lieu cong '
  '(tf_apply_approved_request). NULL nghia la chua ap dung lan nao.';

/* -------------------------------------------------------------------------- */
/* Hinh dang ban tong ket                                                      */
/* -------------------------------------------------------------------------- */

create type public.tf_request_effect as (
  inserted_count int,
  updated_count int,
  skipped_count int,
  skipped_dates date[]
);

comment on type public.tf_request_effect is
  'Ban tong ket tac dong cua mot yeu cau: da chen bao nhieu dong, da sua bao '
  'nhieu dong, va bo qua bao nhieu ngay vi ngay do da co du lieu cham cong.';

/* -------------------------------------------------------------------------- */
/* Cac ngay ma mot don nghi phep NHAM TOI                                      */
/* -------------------------------------------------------------------------- */
-- `security invoker` (mac dinh) CO Y: day khong phai ham kiem quyen, no phai
-- di qua RLS nhu moi truy van khac.
--
-- `conflicted` dung cho ngay da co BAT KY dong attendance_records nao cua
-- nhan vien do — ca mot lan cham cong that lan mot dong nghi phep da sinh tu
-- truoc. Ca hai deu la "ngay nay da co du lieu", va ca hai deu khong duoc ghi
-- de.

create function public.tf_leave_target_days(p_request_id text)
returns table (target_date date, conflicted boolean)
language sql
stable
as $$
  select
    g.d::date,
    exists (
      select 1
      from attendance_records ar
      where ar.company_id = r.company_id
        and ar.employee_id = r.employee_id
        and ar.work_date = g.d::date
    )
  from work_requests r
  join employees e on e.id = r.employee_id and e.company_id = r.company_id
  join shifts s on s.id = e.shift_id and s.company_id = r.company_id
  cross join lateral generate_series(r.from_date, r.to_date, interval '1 day') as g(d)
  where r.id = p_request_id
    and extract(isodow from g.d)::smallint = any (s.working_days)
    and not exists (
      select 1
      from holidays h
      where h.company_id = r.company_id
        and h.holiday_date = g.d::date
    )
  order by g.d;
$$;

comment on function public.tf_leave_target_days(text) is
  'Cac ngay ma mot don nghi phep thuc su nham toi (D-35): trong khoang cua don, '
  'thuoc working_days cua ca, khong phai ngay le da khai. `conflicted` = ngay do '
  'DA co du lieu cham cong nen se bi bo qua, khong bi ghi de.';

/* -------------------------------------------------------------------------- */
/* Xem truoc tac dong — KHONG ghi gi                                           */
/* -------------------------------------------------------------------------- */
-- Duoc goi TRUOC khi duyet, tuc la khi yeu cau van con `pending` — nen ham nay
-- CO Y khong kiem trang thai. No tra loi mot cau hoi thuan tuy: "neu duyet cai
-- nay thi bao nhieu ngay cong bi dong toi?".

create function public.tf_preview_request_effect(p_request_id text)
returns public.tf_request_effect
language plpgsql
stable
as $$
declare
  v_request work_requests%rowtype;
  v_result public.tf_request_effect;
begin
  v_result := (0, 0, 0, array[]::date[])::public.tf_request_effect;

  select * into v_request from work_requests where id = p_request_id;
  if not found then
    raise exception 'Không tìm thấy yêu cầu.' using errcode = 'no_data_found';
  end if;

  if v_request.type = 'leave' then
    select
      count(*) filter (where not d.conflicted)::int,
      count(*) filter (where d.conflicted)::int,
      coalesce(
        array_agg(d.target_date order by d.target_date) filter (where d.conflicted),
        array[]::date[]
      )
    into v_result.inserted_count, v_result.skipped_count, v_result.skipped_dates
    from public.tf_leave_target_days(p_request_id) d;

  elsif v_request.type = 'attendance_supplement' then
    v_result.inserted_count := 1;

  elsif v_request.type = 'time_adjustment' then
    v_result.updated_count := 1;

  -- `overtime`: khong ghi gi (D-31) — ba con so deu 0, va do la cau tra loi
  -- dung, khong phai mot nhanh bi bo quen.
  end if;

  return v_result;
end;
$$;

comment on function public.tf_preview_request_effect(text) is
  'Cung phep dem voi tf_apply_approved_request nhung KHONG ghi gi. Co y khong '
  'kiem trang thai: no duoc goi khi yeu cau van dang cho duyet, de nguoi duyet '
  'biet minh sap doi bao nhieu ngay cong TRUOC khi bam.';

/* -------------------------------------------------------------------------- */
/* Ap dung tac dong                                                            */
/* -------------------------------------------------------------------------- */

create function public.tf_apply_approved_request(p_request_id text)
returns public.tf_request_effect
language plpgsql
as $$
declare
  v_request work_requests%rowtype;
  v_employee employees%rowtype;
  v_shift shifts%rowtype;
  v_record attendance_records%rowtype;
  v_result public.tf_request_effect;
  v_day record;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_late int;
  v_status attendance_status;
  v_range_days int;
begin
  -- CO BAO VE KY DA CHOT (D-32/D-32a) — phai dat o DAU ham. Tham so `true`
  -- lam co transaction-local: no khong ton tai ngoai lan goi nay, nen khong
  -- co cach nao bien no thanh mot cua hau dung chung.
  perform set_config('tf.applying_approved_request', 'on', true);

  v_result := (0, 0, 0, array[]::date[])::public.tf_request_effect;

  select * into v_request from work_requests where id = p_request_id;
  if not found then
    raise exception 'Không tìm thấy yêu cầu.' using errcode = 'no_data_found';
  end if;

  if v_request.status <> 'approved' then
    raise exception
      'Chỉ yêu cầu đã được duyệt mới áp dụng được vào dữ liệu công.'
      using errcode = 'restrict_violation';
  end if;

  if v_request.applied_at is not null then
    raise exception
      'Yêu cầu này đã được áp dụng vào dữ liệu công rồi — áp dụng lần nữa sẽ tính công hai lần.'
      using errcode = 'restrict_violation';
  end if;

  -- Tran do dai khoang ngay (T-05-02-05). Mot don nghi dai hon mot nam khong
  -- phai nghiep vu that; chan o day de mot gia tri hong khong bien mot lan bam
  -- thanh hang nghin dong.
  v_range_days := (v_request.to_date - v_request.from_date) + 1;
  if v_range_days > 366 then
    raise exception
      'Khoảng ngày của yêu cầu vượt quá 366 ngày (%). Hãy tách thành nhiều yêu cầu.',
      v_range_days
      using errcode = 'restrict_violation';
  end if;

  select * into v_employee
  from employees
  where id = v_request.employee_id and company_id = v_request.company_id;
  if not found then
    raise exception 'Không tìm thấy nhân viên của yêu cầu này.' using errcode = 'no_data_found';
  end if;

  select * into v_shift
  from shifts
  where id = v_employee.shift_id and company_id = v_request.company_id;
  if not found then
    raise exception 'Nhân viên chưa được gán ca làm việc.' using errcode = 'no_data_found';
  end if;

  /* ---------------------------------------------------------------------- */
  /* leave — mot dong cho moi NGAY LAM VIEC thuc su (D-35)                  */
  /* ---------------------------------------------------------------------- */
  if v_request.type = 'leave' then
    for v_day in select * from public.tf_leave_target_days(p_request_id) loop
      if v_day.conflicted then
        v_result.skipped_count := v_result.skipped_count + 1;
        v_result.skipped_dates := v_result.skipped_dates || v_day.target_date;
        continue;
      end if;

      -- Hai cot gio deu NULL: dung hinh dang ma index
      -- `attendance_records_open_punch_uidx` (0013) CO Y loai ra, nen mot dong
      -- nghi phep khong chiem cho cua lan cham cong that.
      insert into attendance_records (
        id, company_id, employee_id, work_date, shift_id,
        check_in_at, check_out_at, worked_minutes, late_minutes,
        early_leave_minutes, status, location, needs_supplement, note
      ) values (
        gen_random_uuid()::text, v_request.company_id, v_request.employee_id,
        v_day.target_date, v_shift.id,
        null, null, 0, 0, 0, 'leave_paid', v_employee.work_location, false,
        'Nghỉ phép theo yêu cầu ' || v_request.id
      );
      v_result.inserted_count := v_result.inserted_count + 1;
    end loop;

  /* ---------------------------------------------------------------------- */
  /* attendance_supplement — mot dong cham cong dung mot ngay                */
  /* ---------------------------------------------------------------------- */
  elsif v_request.type = 'attendance_supplement' then
    if v_request.from_time is null then
      raise exception
        'Yêu cầu bổ sung công thiếu giờ vào — không dựng được bản ghi chấm công.'
        using errcode = 'restrict_violation';
    end if;

    v_check_in := public.tf_local_instant(v_request.from_date, v_request.from_time);
    -- Gio ra nho hon hoac bang gio vao nghia la ca qua dem: ngay lich cua moc
    -- ra la hom sau, nhung `work_date` van la ngay BAT DAU (D-08).
    v_check_out := case
      when v_request.to_time is null then null
      when v_request.to_time <= v_request.from_time
        then public.tf_local_instant(v_request.from_date + 1, v_request.to_time)
      else public.tf_local_instant(v_request.from_date, v_request.to_time)
    end;

    -- Gio nghi KHONG tru o day (tham so 0): tu migration 0014, `worked_minutes`
    -- cua mot dong la thoi luong THO cua luot do; gio nghi duoc tru mot lan cho
    -- ca ngay o tang doc.
    v_late := greatest(
      public.tf_worked_minutes(
        public.tf_local_instant(v_request.from_date, v_shift.start_time),
        v_check_in,
        0
      ) - v_shift.late_tolerance_minutes,
      0
    );
    v_status := case when v_late > 0 then 'late' else 'on_time' end;

    insert into attendance_records (
      id, company_id, employee_id, work_date, shift_id,
      check_in_at, check_out_at, worked_minutes, late_minutes,
      early_leave_minutes, status, location, needs_supplement, note
    ) values (
      gen_random_uuid()::text, v_request.company_id, v_request.employee_id,
      v_request.from_date, v_shift.id,
      v_check_in, v_check_out,
      public.tf_worked_minutes(v_check_in, v_check_out, 0),
      v_late, 0, v_status, v_employee.work_location, false,
      -- Dau vet nguon goc: dong nay KHONG den tu mot lan cham cong that.
      'Bổ sung công theo yêu cầu ' || v_request.id
    );
    v_result.inserted_count := 1;

  /* ---------------------------------------------------------------------- */
  /* time_adjustment — sua dong da co, KHONG tu tao moi                     */
  /* ---------------------------------------------------------------------- */
  elsif v_request.type = 'time_adjustment' then
    -- Luot DAU TIEN cua ngay do (som nhat theo gio vao). `id` la uuid nen
    -- khong phan anh thu tu thoi gian — phai sap theo `check_in_at`.
    select * into v_record
    from attendance_records
    where company_id = v_request.company_id
      and employee_id = v_request.employee_id
      and work_date = v_request.from_date
    order by check_in_at nulls last, id
    limit 1;

    if not found then
      raise exception
        'Không tìm thấy bản ghi chấm công ngày % để điều chỉnh. Yêu cầu điều chỉnh giờ không tự tạo bản ghi mới.',
        v_request.from_date
        using errcode = 'no_data_found';
    end if;

    v_check_in := case
      when v_request.from_time is null then v_record.check_in_at
      else public.tf_local_instant(v_request.from_date, v_request.from_time)
    end;
    v_check_out := case
      when v_request.to_time is null then v_record.check_out_at
      when v_request.from_time is not null and v_request.to_time <= v_request.from_time
        then public.tf_local_instant(v_request.from_date + 1, v_request.to_time)
      else public.tf_local_instant(v_request.from_date, v_request.to_time)
    end;

    v_late := greatest(
      public.tf_worked_minutes(
        public.tf_local_instant(v_request.from_date, v_shift.start_time),
        v_check_in,
        0
      ) - v_shift.late_tolerance_minutes,
      0
    );

    update attendance_records
    set check_in_at = v_check_in,
        check_out_at = v_check_out,
        worked_minutes = public.tf_worked_minutes(v_check_in, v_check_out, 0),
        -- Do muon phai tinh LAI: dieu chinh gio vao ma giu nguyen do muon cu
        -- la de lai mot con so noi ve mot gio vao khong con ton tai.
        late_minutes = v_late,
        -- Ep kieu TUONG MINH: mot `case` tra chuoi la `text`, va Postgres
        -- khong tu ep text -> enum trong lenh UPDATE.
        status = (case when v_late > 0 then 'late' else 'on_time' end)::attendance_status,
        note = 'Điều chỉnh giờ theo yêu cầu ' || v_request.id
    where id = v_record.id;
    v_result.updated_count := 1;

  /* ---------------------------------------------------------------------- */
  /* overtime — KHONG ghi gi (D-31)                                          */
  /* ---------------------------------------------------------------------- */
  -- Khong co nhanh nao o day la DUNG. Duyet tang ca la cho phep lam them; so
  -- gio van do cham cong that quyet dinh.
  end if;

  update work_requests
  set applied_at = now()
  where id = p_request_id;

  return v_result;
end;
$$;

comment on function public.tf_apply_approved_request(text) is
  'Ap dung tac dong cua MOT yeu cau da duyet len attendance_records, trong MOT '
  'transaction (D-32a). Tu dat co transaction-local tf.applying_approved_request '
  'de di qua duoc trigger bao ve ky da chot cua 05-05. Chi chay mot lan cho moi '
  'yeu cau (cot work_requests.applied_at).';
