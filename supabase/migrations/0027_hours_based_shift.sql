-- 0027_hours_based_shift.sql
--
-- CA LINH HOAT: mot ca chi khai DO DAI (vi du 10 gio/ngay), khong khai gio
-- vao va gio ra.
--
-- Vi sao khong lam bang mot cot `daily_hours` tren `employees` va cho
-- `employees.shift_id` de trong: `attendance_records.shift_id` la NOT NULL va
-- la mot phan cua CA BA rang buoc giu tinh dung dan cua cham cong nhieu luot
-- (`attendance_records_open_punch_uidx` cua 0013, index sap luot theo ngay, va
-- khoa ngoai sang `shifts`). Cho no null se pha ca ba cung luc — Postgres coi
-- moi NULL la khac nhau nen index "mot luot dang mo" khong con chan duoc gi.
--
-- Nen ca linh hoat van la MOT DONG `shifts`, chi khac o cho no khai
-- `duration_minutes` thay vi `start_time`/`end_time`. Nho vay:
--
--   * `employees.shift_id` va `attendance_records.shift_id` giu NGUYEN NOT
--     NULL — khong mot rang buoc nao cua 0004/0013/0014 phai doi.
--   * Moi phep tinh can DO DAI CA THEO KE HOACH (mau so cua tang ca o
--     `work-mode.ts`, ty le tru gio nghi o `day.ts`) van co mot con so that de
--     dung. Day chinh la cai bay D-36a ma `work-mode.ts` canh bao: mot che do
--     khong co do dai ca se lam `scheduledMinutes = 0`, va khi ay TOAN BO gio
--     lam bien thanh tang ca — luong gap ruoi ma khong mot dong loi nao.
--
-- Cai KHONG con nghia o ca linh hoat: di muon, ve som, va co "ngoai khung gio
-- ca". Ba thu do deu do tu mot gio moc co dinh; khong co gio moc thi chung
-- luon bang 0 / false, do tang ung dung bao dam (xem `checkIn`/`checkOut`
-- trong `src/lib/data/mutations/attendance.ts`).

/* -------------------------------------------------------------------------- */
/* Hai cot moi                                                                 */
/* -------------------------------------------------------------------------- */

alter table shifts
  add column if not exists kind text not null default 'fixed',
  add column if not exists duration_minutes int;

alter table shifts
  drop constraint if exists shifts_kind_check;

alter table shifts
  add constraint shifts_kind_check check (kind in ('fixed', 'hours'));

comment on column shifts.kind is
  'fixed = ca co gio vao/gio ra cu the (hanh vi tu 0004). hours = ca linh '
  'hoat: chi khai do dai `duration_minutes`, nhan vien vao ra luc nao cung '
  'duoc. Ca `hours` KHONG tinh di muon, ve som hay "ngoai khung gio ca".';

comment on column shifts.duration_minutes is
  'Do dai mot ngay lam viec cua ca linh hoat, tinh bang phut va la so gio '
  'LAM VIEC THAT (da tru gio nghi — nen `break_minutes` cua ca nay luon 0). '
  '`null` o ca `fixed`, noi do dai duoc suy tu start_time/end_time.';

/* -------------------------------------------------------------------------- */
/* Gio vao/gio ra thoi con bat buoc                                            */
/* -------------------------------------------------------------------------- */

alter table shifts
  alter column start_time drop not null,
  alter column end_time drop not null;

-- Rang buoc `check (start_time <> end_time)` cua 0004 la mot CHECK cap bang
-- KHONG DAT TEN, nen ten that do Postgres sinh ra. Tim theo dinh nghia thay vi
-- doan ten: dieu kien moi (`shifts_shape_check` ben duoi) da bao ham no cho ca
-- `fixed`, con ca `hours` co hai cot deu null nen dieu kien cu se cho ra NULL
-- — mot CHECK cho NULL duoc coi la DAT, nhung de lai mot rang buoc khong con
-- dung y nghia ban dau la de mot cai bay cho lan sua sau.
do $$
declare
  target text;
begin
  for target in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where rel.relname = 'shifts'
      and nsp.nspname = 'public'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) = 'CHECK ((start_time <> end_time))'
  loop
    execute format('alter table shifts drop constraint %I', target);
  end loop;
end $$;

/* -------------------------------------------------------------------------- */
/* Cot sinh `overnight` phai chiu duoc gio null                                 */
/* -------------------------------------------------------------------------- */

-- `generated always as (end_time < start_time)` tra NULL khi mot trong hai gio
-- la null, va `shiftRowSchema` doc cot nay thanh `z.boolean()`. Postgres khong
-- cho sua bieu thuc cua mot cot sinh, nen bo di va tao lai — day la gia tri
-- DAN XUAT, bo di khong mat du lieu goc nao.
--
-- Ca linh hoat khong co khai niem "qua dem": khong co gio ket thuc thi khong
-- co gi vat qua nua dem. `false` la CAU TRA LOI DUNG cho no, khong phai mot
-- gia tri mac dinh dat cho co.
alter table shifts drop column if exists overnight;

alter table shifts
  add column overnight boolean
  generated always as (coalesce(end_time < start_time, false)) stored;

comment on column shifts.overnight is
  'Sinh tu so sanh gio thuc cua ca — khong the lech khoi start_time/end_time '
  'that duoc luu. Ca linh hoat (kind = hours) khong co hai gio do nen luon '
  'false: khong co gio ket thuc thi khong co gi vat qua nua dem.';

/* -------------------------------------------------------------------------- */
/* Hinh dang hop le cua tung loai ca                                           */
/* -------------------------------------------------------------------------- */

-- MOT rang buoc duy nhat mo ta tron ven ca hai hinh dang, thay vi vai CHECK
-- roi rac moi cai bat mot manh: doc mot cho la biet duoc mot dong `shifts`
-- hop le trong nhu the nao.
alter table shifts
  drop constraint if exists shifts_shape_check;

alter table shifts
  add constraint shifts_shape_check check (
    case kind
      when 'fixed' then
        start_time is not null
        and end_time is not null
        and start_time <> end_time
        and duration_minutes is null
      when 'hours' then
        start_time is null
        and end_time is null
        and duration_minutes is not null
        and duration_minutes > 0
        and duration_minutes <= 1440
        -- Gio nghi cua ca linh hoat khong co cho de ton tai: khong co khung
        -- gio ca thi khong dinh vi duoc mot khoang nghi trong do, va
        -- `duration_minutes` von da la so gio LAM VIEC THAT.
        and break_start_time is null
        and break_end_time is null
        and break_minutes = 0
        -- Bien do tre gio chi co nghia khi co mot gio de tre so voi no.
        and late_tolerance_minutes = 0
      else false
    end
  );

/* -------------------------------------------------------------------------- */
/* Ham SQL phai chiu duoc gio null                                             */
/* -------------------------------------------------------------------------- */

-- `tf_shift_minutes` va `tf_overnight` la `immutable` va duoc goi tu
-- `checkOut`. Chung chua bao gio nhan null vi truoc 0027 hai cot do la NOT
-- NULL. Tang ung dung khong goi chung cho ca linh hoat nua, nhung de chung tra
-- NULL thay vi mot con so sai neu co ai goi — im lang tra 0 o day se lam
-- "thoi diem ket thuc ca theo ke hoach" bang dung luc bat dau ca.
create or replace function public.tf_shift_minutes(
  p_start time,
  p_end time,
  p_break_minutes int
)
returns int
language sql
immutable
as $$
  select case
    when p_start is null or p_end is null then null
    when p_end = p_start then 0
    else greatest(
      (
        case
          when p_end < p_start then
            (extract(epoch from (p_end - p_start)) / 60)::int + 1440
          else
            (extract(epoch from (p_end - p_start)) / 60)::int
        end
      ) - coalesce(p_break_minutes, 0),
      0
    )
  end;
$$;

comment on function public.tf_shift_minutes(time, time, int) is
  'Ban SQL cua minutesBetween trong src/lib/format.ts, khac hai diem co chu '
  'dich: p_end = p_start tra 0 thay vi 1440 (mot ca khong the dai dung 24 gio '
  'trong mo hinh nghiep vu nay), va gio null tra NULL thay vi 0 — ca linh hoat '
  '(0027) khong co gio ke hoach, va 0 o day se doc ra thanh "ca dai 0 phut".';
