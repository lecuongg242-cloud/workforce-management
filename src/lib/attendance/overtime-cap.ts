/**
 * Tran tang ca cua doanh nghiep (SET-05, plan 05-03). Module THUAN: khong
 * import Supabase, khong doc `process.env`, khong goi `new Date()` — cung khuon
 * `src/lib/attendance/suspicious.ts` va `classification.ts`.
 *
 * BA DIEU CAN BIET TRUOC KHI SUA FILE NAY
 *
 * (1) O DAY KHONG CO NHANH NAO TU CHOI MOT LAN DUYET, VA DO LA CO Y.
 *     SET-05 noi ro: vuot tran thi CANH BAO, van cho duyet tiep. Mot gioi han
 *     cung se bi vuot qua bang cach nang tran — tuc la doanh nghiep mat luon
 *     nguong, va lan sau khong con gi de canh bao. Module nay chi TRA LOI mot
 *     cau hoi ("co vuot khong, vuot bao nhieu"); quyet dinh thuoc ve nguoi
 *     duyet.
 *
 * (2) `capHours === null` NGHIA LA KHONG GIOI HAN, KHONG PHAI BANG 0.
 *     Doanh nghiep chua khai tran nghia la ho chua dat gioi han, khong phai ho
 *     cam tang ca. Hieu nham nay bien MOI lan duyet thanh mot canh bao, va
 *     nguoi duyet se ngung doc canh bao — ke ca canh bao that (T-05-03-01).
 *
 * (3) BANG DUNG TRAN KHONG PHAI LA VUOT. "Tran 40 gio" nghia la 40 gio con
 *     dung duoc; canh bao o dung con so 40 se lam nguoi duyet thay he thong
 *     dem sai.
 */

/** Don vi hien thi cua moi con so trong module nay la GIO. */
export interface CapUsage {
  /** Gio tang ca da dung trong thang (thuc te + da dang ky duoc duyet). */
  usedHours: number;
  /** So gio ma chinh yeu cau dang xet them vao. */
  requestedHours: number;
  /** Tran cua doanh nghiep; `null` la khong gioi han. */
  capHours: number | null;
}

export interface CapUsageSummary extends CapUsage {
  /** `usedHours + requestedHours`. */
  totalHours: number;
  /** So gio vuot tran; 0 khi khong vuot hoac khong co tran. */
  overHours: number;
  isOver: boolean;
}

/** Lam tron toi hai chu so thap phan — don vi hien thi la GIO, khong phai tien. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Lan duyet nay co dua nhan vien vuot tran khong.
 *
 * Tra `false` khi khong co tran (`null`), va `false` khi tong BANG DUNG tran —
 * vuot la lon hon, khong phai bang.
 */
export function isOverCap({
  usedHours,
  requestedHours,
  capHours,
}: CapUsage): boolean {
  if (capHours === null) return false;
  return round2(usedHours + requestedHours) > capHours;
}

/** Ba con so cua canh bao, cong phan vuot. */
export function capUsageSummary({
  usedHours,
  requestedHours,
  capHours,
}: CapUsage): CapUsageSummary {
  const totalHours = round2(usedHours + requestedHours);
  const isOver = isOverCap({ usedHours, requestedHours, capHours });
  return {
    usedHours: round2(usedHours),
    requestedHours: round2(requestedHours),
    capHours,
    totalHours,
    overHours: isOver && capHours !== null ? round2(totalHours - capHours) : 0,
    isOver,
  };
}

/**
 * So gio ma mot yeu cau tang ca DANG KY, tinh tu `fromTime`/`toTime` dang
 * "HH:mm".
 *
 * Tra 0 khi yeu cau khong khai gio — va do la con so dung: seed lan bieu mau
 * hien tai deu de `fromTime`/`toTime` `null` cho loai `overtime`, nghia la
 * doanh nghiep dang ky "co lam them" ma khong khai so gio. D-31 da noi so gio
 * that den tu cham cong, nen 0 o day khong lam mat thong tin nao.
 *
 * Gio ket thuc nho hon hoac bang gio bat dau duoc hieu la qua nua dem.
 */
export function requestedOvertimeHours(
  fromTime: string | null,
  toTime: string | null,
): number {
  if (!fromTime || !toTime) return 0;

  const [fromHour, fromMinute] = fromTime.split(":").map(Number);
  const [toHour, toMinute] = toTime.split(":").map(Number);
  if (
    !Number.isFinite(fromHour) ||
    !Number.isFinite(fromMinute) ||
    !Number.isFinite(toHour) ||
    !Number.isFinite(toMinute)
  ) {
    return 0;
  }

  const fromMinutes = fromHour * 60 + fromMinute;
  const toMinutes = toHour * 60 + toMinute;
  const span = toMinutes > fromMinutes ? toMinutes - fromMinutes : toMinutes + 1440 - fromMinutes;
  return round2(span / 60);
}
