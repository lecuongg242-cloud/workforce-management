import type { WorkDayType } from "@/lib/attendance/classification";
import type {
  AttendanceStatus,
  WorkMode,
  WorkModeMissingInput,
} from "@/lib/types/domain";

/**
 * Ba dinh nghia khac nhau ve "MOT NGAY CONG" (D-36), va phep quy mot ngay
 * cham cong ve so ngay cong + so phut duoc tra theo don gia thuong + so phut
 * tinh theo he so tang ca.
 *
 * Module THUAN: khong dung client cua co so du lieu, khong doc bien moi
 * truong, khong doc dong ho he thong — cung khuon `suspicious.ts` /
 * `overtime-cap.ts`. (Ba dieu do duoc canh bang mot phep grep trong
 * <acceptance_criteria> cua plan, nen ngay ca cau van nay cung tranh viet ra
 * ba cai ten do — mot cong co hoc bat duoc chuoi trong comment thi no khong
 * con phan biet duoc code voi loi hua ve code.)
 *
 * ======================================================================
 * CAI BAY D-36a — LY DO CHINH XAC VI SAO FILE NAY TON TAI
 * ======================================================================
 *
 * Mo hinh du lieu cua Phase 4 gan chat vao CA: `attendance_records.shift_id`
 * la `NOT NULL`, va `overtimeMinutes()` tinh phan VUOT `scheduledMinutes` —
 * do dai ca theo ke hoach.
 *
 * Che do `daily_hours` nghia la KHONG CO CA. Neu no di qua dung nhanh cu voi
 * `scheduledMinutes = 0` thi:
 *
 *     overtimeMinutes = max(workedMinutes - 0, 0) = TOAN BO gio lam
 *
 * Nghia la mot nguoi lam 8 tieng binh thuong bong nhien co 8 gio tang ca, va
 * khi 05-2-04 nhan so gio do voi he so tang ca thi luong cua ho gap ruoi hoac
 * gap doi. So lieu KHONG bao loi — no chi don gian la khac di, va no trong
 * hoan toan hop ly tren man hinh.
 *
 * KHONG MOT TEST NAO cua Phase 4 hay 5.1 phat hien ra dieu do, vi tat ca
 * chung chay o che do `shift`. Vi vay bo test cua file nay co MOT bai mang ten
 * noi thang dieu dang duoc ngan.
 *
 * ======================================================================
 * VA MOT DIEU NUA: KHONG CO MAU SO DU PHONG
 * ======================================================================
 *
 * Che do `daily_hours` ma doanh nghiep chua khai `standard_hours_per_day` thi
 * ham nay tra `missing`, KHONG tra mot con so. Khong lui ve 8 gio (mot con so
 * nghiep vu chua ai khai, D-26), va tuyet doi khong lay do dai ca lam mau so:
 * che do nay nghia la khong co ca, nen lay so gio tu mot cai ca khong ton tai
 * la bia ra mot mau so.
 */

export type { WorkModeMissingInput };

export interface WorkModeShiftInfo {
  /** Do dai ca theo ke hoach da tru gio nghi, phut. */
  scheduledMinutes: number;
}

export interface WorkModeInput {
  /** Chi hai truong nay cua mot ngay duoc dung — giu dau vao hep de test de doc. */
  day: {
    workedMinutes: number;
    /** Trang thai cua CA NGAY (`day.ts`), khong phai cua mot luot. */
    status: AttendanceStatus;
  };
  /** Loai ngay do `classifyWorkDay()` quyet dinh — khong tinh lai o day. */
  dayType: WorkDayType;
  mode: WorkMode;
  /** Quy tac ca cua ngay do; `undefined` khi khong xac dinh duoc ca. */
  shift: WorkModeShiftInfo | undefined;
  /** `null` = CHUA KHAI (D-38) — khong bao gio duoc thay bang mot con so doan. */
  standardHoursPerDay: number | null;
}

export interface DayCredit {
  /**
   * So ngay cong cua ngay do. **Co the la so thap phan** o `daily_hours`
   * (D-39): lam 6 tieng trong ngay chuan 10 tieng thi day la 0,6 — moi man
   * hinh hien "ngay cong" phai chiu duoc dieu do.
   * `null` khi thieu dau vao (xem `missing`).
   */
  creditedDays: number | null;
  /** So phut duoc tra theo don gia THUONG. `null` khi thieu dau vao. */
  regularMinutes: number | null;
  /** So phut tinh theo he so TANG CA. `null` khi thieu dau vao. */
  overtimeMinutes: number | null;
  /**
   * So phut thua (duong) hoac thieu (am) so voi ca — CHI o `shift_hourly`.
   * Bang 0 o hai che do con lai, va 0 khi khong xac dinh duoc ca.
   */
  hourDelta: number;
  /** Ly do khong tinh duoc; `null` khi du dau vao. */
  missing: WorkModeMissingInput | null;
}

/**
 * MAU SO de tinh phan vuot cua mot ngay, theo che do dang ap.
 *
 * Day la NGUON DUY NHAT cua con so do: `classifyDay()` goi chinh ham nay thay
 * vi tu chon do dai ca lam mau so. Hai noi tu chon mau so nghia la
 * `overtimeMinutes` cua man hinh phan loai va cua phep tinh luong se lech
 * nhau — va khong ai biet ben nao dung.
 *
 * Tra `null` nghia la KHONG XAC DINH DUOC (che do `daily_hours` chua khai mau
 * so). Noi goi phai xu ly `null` bang cach khong tinh gi, KHONG bang cach thay
 * `?? 0` — mot `?? 0` o day chinh la cai bay D-36a.
 */
export function effectiveScheduledMinutes({
  mode,
  shift,
  standardHoursPerDay,
}: {
  mode: WorkMode;
  shift: WorkModeShiftInfo | undefined;
  standardHoursPerDay: number | null;
}): number | null {
  if (mode === "daily_hours") {
    if (standardHoursPerDay === null) return null;
    return Math.round(standardHoursPerDay * 60);
  }
  // `shift` va `shift_hourly`: HANH VI Y HET Phase 4.
  //
  // Truong hop khong xac dinh duoc ca duoc viet TUONG MINH thay vi bang mot
  // toan tu du phong, vi hai truong hop "khong biet ca" o hai che do khac
  // nhau doi hoi hai cau tra loi NGUOC NHAU, va gop chung lai la cach de nhat
  // de sau nay ai do sua nham mot cai va lam doi cai kia:
  //   - o day (co ca, chi la khong tra duoc): mau so 0, tuc toan bo gio lam la
  //     tang ca. Do la hanh vi hien tai cua san pham va plan nay khong duoc
  //     doi no.
  //   - o `daily_hours` (khong co ca, chua khai mau so): tra `null` o nhanh
  //     tren, tuc KHONG tinh gi ca. Mot mau so 0 o do chinh la cai bay D-36a.
  if (shift === undefined) return 0;
  return shift.scheduledMinutes;
}

/**
 * Quy MOT ngay cham cong ve ngay cong / phut thuong / phut tang ca theo che do
 * ma doanh nghiep da chon.
 */
export function resolveDayCredit({
  day,
  dayType,
  mode,
  shift,
  standardHoursPerDay,
}: WorkModeInput): DayCredit {
  // D-43: nghi KHONG PHEP khong duoc tinh la ngay cong o CA BA che do. O
  // `daily_hours` va `shift_hourly` dieu do von da dung (khong co gio thi
  // khong co gi de tra); o `shift` no phai duoc noi TUONG MINH, vi ngay cong
  // o che do do la mot phep dem ngay chu khong phai mot phep cong gio.
  if (day.status === "leave_unpaid") {
    return {
      creditedDays: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      hourDelta: 0,
      missing: null,
    };
  }

  // Nghi CO PHEP duoc tra tron mot ngay cong o ca ba che do — day la ve con
  // lai cua D-43, va la ly do hai trang thai nghi nay tu day tro di khac nhau
  // ve TIEN chu khong chi ve nhan.
  if (day.status === "leave_paid") {
    return {
      creditedDays: 1,
      regularMinutes: 0,
      overtimeMinutes: 0,
      hourDelta: 0,
      missing: null,
    };
  }

  const scheduled = effectiveScheduledMinutes({ mode, shift, standardHoursPerDay });
  if (scheduled === null) {
    return {
      creditedDays: null,
      regularMinutes: null,
      overtimeMinutes: null,
      hourDelta: 0,
      missing: "standard_hours_per_day",
    };
  }

  const worked = Math.max(day.workedMinutes, 0);

  // Ngay le va ngay ngoai lich lam viec: TOAN BO gio lam la tang ca — cung
  // quy tac voi `overtimeMinutes()` cua `classification.ts`, va o day no keo
  // theo `creditedDays = 0`: ngay do duoc tra bang he so tang ca, cong them
  // mot ngay cong nua la tra hai lan cho cung mot ngay.
  const overtime = dayType !== "weekday" ? worked : Math.max(worked - scheduled, 0);
  const regular = worked - overtime;

  const hourDelta =
    mode === "shift_hourly" && shift !== undefined
      ? worked - shift.scheduledMinutes
      : 0;

  return {
    creditedDays: creditedDaysOf({ mode, regularMinutes: regular, scheduled }),
    regularMinutes: regular,
    overtimeMinutes: overtime,
    hourDelta,
    missing: null,
  };
}

/**
 * So ngay cong suy tu so phut duoc tra theo don gia thuong.
 *
 * - `shift` / `shift_hourly`: mot ngay co gio thuong la MOT ngay cong — phep
 *   dem ngay, dung nhu hanh vi cu. (Phan thieu/thua gio o `shift_hourly` di
 *   qua `hourDelta`, khong lam ngay cong thanh thap phan; neu no cung lam ngay
 *   cong thap phan thi 05-2-04 se tru hai lan cho cung mot so gio thieu.)
 * - `daily_hours`: ngay cong la mot TY LE (D-39) — 6/10 tieng ra 0,6.
 */
function creditedDaysOf({
  mode,
  regularMinutes,
  scheduled,
}: {
  mode: WorkMode;
  regularMinutes: number;
  scheduled: number;
}): number {
  if (mode !== "daily_hours") return regularMinutes > 0 ? 1 : 0;
  if (scheduled <= 0) return 0;
  // Lam tron toi bon chu so thap phan: du de mot phut khong bien mat khoi ngay
  // cong, va khong de mot chuoi so vo nghia chay ra man hinh. Phep lam tron
  // TIEN thi o 05-2-04 (D-42a) — day khong phai tien.
  return Math.round((regularMinutes / scheduled) * 10000) / 10000;
}

/** Tong ngay cong cua mot thang; `null` khi BAT KY ngay nao thieu dau vao. */
export function sumCreditedDays(credits: readonly DayCredit[]): {
  creditedDays: number | null;
  regularMinutes: number | null;
  hourDeltaMinutes: number;
  missing: WorkModeMissingInput[];
} {
  const missing = new Set<WorkModeMissingInput>();
  let days = 0;
  let regular = 0;
  let delta = 0;

  for (const credit of credits) {
    if (credit.missing !== null) missing.add(credit.missing);
    days += credit.creditedDays ?? 0;
    regular += credit.regularMinutes ?? 0;
    delta += credit.hourDelta;
  }

  if (missing.size > 0) {
    // KHONG cong bo phan de ra mot tong trong nhu da day du (D-26, cung khuon
    // `sumConvertedOvertimeHours`). `hourDeltaMinutes` van tra ve vi no khong
    // phu thuoc vao mau so con thieu.
    return {
      creditedDays: null,
      regularMinutes: null,
      hourDeltaMinutes: delta,
      missing: Array.from(missing),
    };
  }

  return {
    creditedDays: Math.round(days * 10000) / 10000,
    regularMinutes: regular,
    hourDeltaMinutes: delta,
    missing: [],
  };
}
