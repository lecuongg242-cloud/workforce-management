import type { PayRateUnit } from "@/lib/types/domain";

/**
 * Quy doi MUC LUONG cua mot nguoi (thang / ngay / gio) sang DON GIA NGAY va
 * DON GIA GIO, qua hai mau so ma doanh nghiep tu khai (D-38).
 *
 * Module THUAN: khong dung client co so du lieu, khong doc bien moi truong,
 * khong doc dong ho he thong.
 *
 * ======================================================================
 * HAI DIEU QUAN TRONG
 * ======================================================================
 *
 * (1) KHONG LAM TRON O DAY. Don gia la mot buoc TRUNG GIAN (D-42a): lam tron
 * don gia gio roi nhan voi so gio se lech vai dong so voi nhan roi moi lam
 * tron, va ke toan se phat hien ra. Phep lam tron duy nhat cua ca chuoi nam o
 * cuoi `compute.ts`.
 *
 * (2) CHI DOI MAU SO THUC SU DUNG TOI. Nguoi an luong GIO khong can
 * `standardDaysPerMonth` de ra don gia gio — no la mot con so vo can voi ho.
 * Neu ham nay doi du ca hai mau so trong moi truong hop, mot doanh nghiep tra
 * luong gio se bi chan boi mot con so ho khong bao gio dung den, va ho se dien
 * bua mot gia tri vao do de di tiep. Mot mau so dien bua thi khong con la mau
 * so cua ai ca.
 *
 * Thieu mau so CAN THIET thi tra `null` kem khoa thieu — khong bao gio tra mot
 * con so doan (D-26). O day hau qua cua mot con so doan la TIEN SAI.
 */

/** Mau so doanh nghiep chua khai, lam phep quy doi khong chay duoc. */
export type RateMissingInput =
  | "standard_days_per_month"
  | "standard_hours_per_day";

export interface RateInput {
  unit: PayRateUnit;
  amount: number;
  /** `null` = CHUA KHAI (D-38). */
  standardDaysPerMonth: number | null;
  /** `null` = CHUA KHAI (D-38). */
  standardHoursPerDay: number | null;
}

export interface RateResult {
  /** `null` khi thieu mau so can thiet — xem `missing`. */
  value: number | null;
  missing: RateMissingInput | null;
}

/**
 * DON GIA MOT NGAY CONG.
 *
 *   month -> amount / standardDaysPerMonth
 *   day   -> amount                          (khong can mau so nao)
 *   hour  -> amount * standardHoursPerDay
 */
export function toDailyRate({
  unit,
  amount,
  standardDaysPerMonth,
  standardHoursPerDay,
}: RateInput): RateResult {
  if (unit === "day") {
    // Khong mau so nao tham gia — nguoi khai luong ngay khong bi chan boi mot
    // con so ho chua khai.
    return { value: amount, missing: null };
  }

  if (unit === "month") {
    if (standardDaysPerMonth === null) {
      return { value: null, missing: "standard_days_per_month" };
    }
    return { value: amount / standardDaysPerMonth, missing: null };
  }

  if (standardHoursPerDay === null) {
    return { value: null, missing: "standard_hours_per_day" };
  }
  return { value: amount * standardHoursPerDay, missing: null };
}

/**
 * DON GIA MOT GIO.
 *
 *   hour  -> amount                                          (khong can mau so)
 *   day   -> amount / standardHoursPerDay
 *   month -> amount / (standardDaysPerMonth * standardHoursPerDay)
 *
 * Truong hop `month` can CA HAI mau so. Khoa thieu tra ve la khoa DAU TIEN
 * theo thu tu tren — mot ham tra mot khoa, va noi goi gom cac khoa lai; tra
 * ca hai o day se bat noi goi xu ly mot truong hop chi xay ra o dung mot
 * nhanh.
 */
export function toHourlyRate({
  unit,
  amount,
  standardDaysPerMonth,
  standardHoursPerDay,
}: RateInput): RateResult {
  if (unit === "hour") {
    return { value: amount, missing: null };
  }

  if (unit === "day") {
    if (standardHoursPerDay === null) {
      return { value: null, missing: "standard_hours_per_day" };
    }
    return { value: amount / standardHoursPerDay, missing: null };
  }

  if (standardDaysPerMonth === null) {
    return { value: null, missing: "standard_days_per_month" };
  }
  if (standardHoursPerDay === null) {
    return { value: null, missing: "standard_hours_per_day" };
  }
  return {
    value: amount / (standardDaysPerMonth * standardHoursPerDay),
    missing: null,
  };
}
