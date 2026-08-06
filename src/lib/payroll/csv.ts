import { PAYROLL_LABEL } from "@/lib/constants";
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
  "Giờ làm",
  "Giờ tăng ca",
  "Giờ tăng ca đêm",
  "Giờ quy đổi",
  PAYROLL_LABEL.leaveColumn,
  PAYROLL_LABEL.lateColumn,
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

/** Noi dung tep CSV (chua gom BOM). */
export function buildPayrollCsv(prep: PayrollPrep): string {
  const lines = [HEADERS.join(DELIMITER)];

  for (const row of prep.rows) {
    lines.push(
      [
        escapeCsvCell(row.employeeCode),
        escapeCsvCell(row.employeeName),
        escapeCsvCell(row.departmentName ?? ""),
        String(row.workedDays),
        toDecimal(toHours(row.totalMinutes)),
        toDecimal(toHours(row.overtimeMinutes)),
        toDecimal(toHours(row.overtimeNightMinutes)),
        // THIEU HE SO KHONG DUOC XUAT THANH 0 (D-26): mot o `0` trong tep gui
        // cho ke toan la mot lo lang khong ai doc ra. O do mang chu, va nguoi
        // nhan buoc phai hoi lai.
        row.convertedOvertimeHours === null
          ? escapeCsvCell(PAYROLL_LABEL.missingMultiplier)
          : toDecimal(row.convertedOvertimeHours),
        String(row.leaveDays),
        String(row.lateCount),
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
