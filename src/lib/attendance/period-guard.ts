/**
 * Doi loi cua trigger "ky da chot" thanh mot cau NOI DUOC PHAI LAM GI TIEP
 * (PERD-02, plan 05-05). Module THUAN — khong import Supabase, khong doc
 * `process.env` — de kiem duoc tung nhanh bang Vitest, cung khuon
 * `src/lib/attendance/suspicious.ts`.
 *
 * VI SAO "KY DA CHOT" KHONG PHAI LY DO TU CHOI THU TU CUA D-20b
 *
 * `AttendanceRejectedError` (03-04) khoa DUNG BA ly do, va ca ba deu la phan
 * xet ve MOT LAN CHAM CONG cu the: thieu bang chung, ngoai khung gio ca, loi
 * mang. Ky da chot khong thuoc loai do — no la mot trang thai cua KY, no chan
 * ca nhung duong ghi khong phai cham cong (sua ban ghi tu man hinh quan tri),
 * va no khong sinh ra tu viec nguoi lao dong lam gi sai. Nhet no vao enum ba
 * gia tri kia se lam moi noi dang phan nhanh theo `reason` phai xu ly mot
 * truong hop khong cung loai voi ba truong hop con lai.
 *
 * Nen no la mot `Error` thuong mang thong diep cua chinh trigger — thong diep
 * do da noi dung thang cua ky, va o day chi noi them duong di tiep.
 */

/**
 * SQLSTATE RIENG cua trigger `attendance_period_guard` (migration 0021). Mot
 * ma rieng — khong dung chung '23001' voi cac trigger append-only — chinh la
 * de cho nay bat duoc DUNG truong hop nay.
 */
export const PERIOD_CLOSED_SQLSTATE = "TF001";

/** Duong di tiep cho nguoi bi chan; noi sau thong diep cua trigger. */
export const PERIOD_CLOSED_NEXT_STEP =
  "Hãy gửi yêu cầu bổ sung công để quản trị xem xét.";

export interface PostgresErrorLike {
  code?: string;
  message?: string;
}

/** Loi nay co phai do trigger ky da chot khong. */
export function isPeriodClosedError(
  cause: PostgresErrorLike | null | undefined,
): boolean {
  return cause?.code === PERIOD_CLOSED_SQLSTATE;
}

/**
 * `Error` de nem cho noi goi.
 *
 * Voi loi cua trigger: giu NGUYEN VAN thong diep tieng Viet cua trigger (no
 * mang thang cua ky) va noi them duong di tiep. Voi moi loi khac: dung thong
 * diep mac dinh cua noi goi — khong bao gio de mot chuoi loi Postgres tho lot
 * len giao dien.
 */
export function periodGuardError(
  cause: PostgresErrorLike | null | undefined,
  fallbackMessage: string,
): Error {
  if (isPeriodClosedError(cause) && cause?.message) {
    return new Error(`${cause.message} ${PERIOD_CLOSED_NEXT_STEP}`);
  }
  return new Error(fallbackMessage);
}
