import { PAYROLL_LABEL, describeMissingReason } from "@/lib/constants";
import type { PayrollPrep } from "@/lib/types/domain";

/**
 * Xuat bang chuan bi luong ra CSV.
 *
 * BA QUYET DINH VE DINH DANG, deu vi mot ly do: tep nay duoc mo bang Excel
 * tren may ke toan Viet Nam, khong phai bang mot trinh doc CSV chuan.
 *
 *   1. DAU PHAN CACH LA DAU CHAM PHAY. Excel o locale vi-VN tach cot theo
 *      dau `;` chu khong theo `,`. Dung dau phay se lam ca tep do vao MOT cot
 *      va nguoi nhan tuong du lieu hong.
 *   2. CO BOM UTF-8 (`﻿`) o dau tep. Thieu no, Excel doc tep theo bang ma
 *      he thong va moi ten tieng Viet thanh ky tu la.
 *   3. SO THAP PHAN DUNG DAU PHAY (`8,5` chu khong `8.5`), khop voi cach
 *      Excel vi-VN doc so — neu khong, `8.5` se bi hieu la chuoi va moi phep
 *      cong o dau ben kia deu tra 0.
 *
 * Tach khoi component de kiem duoc bang test ma khong can dung DOM.
 */

/** Dau phan cach cot — xem ly do (1) o khoi tren. */
const DELIMITER = ";";

const HEADERS = [
  "Mã nhân viên",
  "Họ tên",
  "Phòng ban",
  PAYROLL_LABEL.workedDaysColumn,
  PAYROLL_LABEL.creditedDaysColumn,
  "Giờ làm",
  "Giờ tăng ca",
  "Giờ tăng ca đêm",
  PAYROLL_LABEL.leaveColumn,
  PAYROLL_LABEL.lateColumn,
  // PAY-01 (plan 05-2-04) — cac cot tien, them vao CUOI de moi cong thuc ma
  // ke toan da dung tren tep cu van tro dung cot.
  PAYROLL_LABEL.basePayColumn,
  PAYROLL_LABEL.overtimePayColumn,
  PAYROLL_LABEL.hourAdjustmentColumn,
  PAYROLL_LABEL.allowanceColumn,
  PAYROLL_LABEL.deductionColumn,
  // LOI CANH BAO NAM TRONG CHINH TEN COT, khong o mot dong chu thich rieng.
  //
  // Mot dong chu thich o DAU tep pha cau truc bang (dong tieu de khong con la
  // dong 1, va moi cong thuc tro theo dong se lech); mot dong o CUOI tep thi
  // bi cat mat ngay lan dau ai do boi vung du lieu sang mot bang khac — ma do
  // dung la viec ke toan se lam.
  //
  // Dat trong ten cot thi loi canh bao DI THEO con so: copy cot nao cung mang
  // no theo, va khong the doc con so ma khong doc no.
  `${PAYROLL_LABEL.netPayColumn} (${PAYROLL_LABEL.taxDisclaimerCsv})`,
] as const;

/** Phut -> gio thap phan, hai chu so. */
function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** So thap phan theo quy uoc vi-VN — xem ly do (3). */
function toDecimal(value: number): string {
  return String(value).replace(".", ",");
}

/**
 * Boc mot o: nhan doi dau nhay kep va boc trong nhay kep khi o chua dau phan
 * cach, dau nhay hoac xuong dong. Ten phong ban co dau `;` la chuyen co that.
 */
export function escapeCsvCell(value: string): string {
  if (!/[";\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Mot o SO TIEN. `null` xuat ra CHU chu khong xuat 0 — cung ly do voi
 * "chua khai he so" cua 5.1, va o day nang hon: mot o `0` trong cot "Thuc
 * nhan" cua tep gui cho ke toan doc nhu MOT SU THAT, va nguoi ky se ky.
 *
 * Chu xuat ra noi THIEU GI (khong phai "khong co du lieu"), de nguoi nhan biet
 * phai hoi ai va hoi cai gi.
 */
function moneyCell(value: number | null, missing: readonly string[]): string {
  if (value !== null) return toDecimal(value);
  const reason =
    missing.length > 0
      ? describeMissingReason(missing[0])
      : PAYROLL_LABEL.missingReasonFallback;
  return escapeCsvCell(reason);
}

/** Noi dung tep CSV (chua gom BOM). */
export function buildPayrollCsv(prep: PayrollPrep): string {
  // Tep giu dung MOT dong tieu de roi den du lieu — mot bang sach. Loi canh
  // bao ve thue va bao hiem nam trong ten cot "Thuc nhan" (xem `HEADERS`).
  const lines = [HEADERS.join(DELIMITER)];

  for (const row of prep.rows) {
    lines.push(
      [
        escapeCsvCell(row.employeeCode),
        escapeCsvCell(row.employeeName),
        escapeCsvCell(row.departmentName ?? ""),
        String(row.workedDays),
        // Ngay cong quy doi co the la so THAP PHAN (D-39) va co the `null`.
        row.creditedDays === null
          ? escapeCsvCell(PAYROLL_LABEL.missingWorkModeInput)
          : toDecimal(row.creditedDays),
        toDecimal(toHours(row.totalMinutes)),
        toDecimal(toHours(row.overtimeMinutes)),
        toDecimal(toHours(row.overtimeNightMinutes)),
        // Khong con cot "Gio quy doi". D-26 van duoc gac o cot "Tien tang ca":
        // thieu he so thi o do mang CHU ("chua khai he so tang ca") chu khong
        // mang so 0 — xem `moneyCell()`.
        String(row.leaveDays),
        String(row.lateCount),
        moneyCell(row.basePay, row.missing),
        moneyCell(row.overtimePay, row.missing),
        moneyCell(row.hourAdjustment, row.missing),
        moneyCell(row.allowanceTotal, row.missing),
        moneyCell(row.deductionTotal, row.missing),
        moneyCell(row.netPay, row.missing),
      ].join(DELIMITER),
    );
  }

  return lines.join("\r\n");
}

export function payrollCsvFileName(month: string): string {
  return `bang-cong-${month}.csv`;
}

/**
 * Tai tep ve may. Chi goi duoc o trinh duyet — phan dung noi dung nam o
 * `buildPayrollCsv()` de kiem duoc rieng.
 */
export function downloadPayrollCsv(prep: PayrollPrep): void {
  // BOM UTF-8 — xem ly do (2) o khoi tren.
  const blob = new Blob([`﻿${buildPayrollCsv(prep)}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = payrollCsvFileName(prep.month);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
