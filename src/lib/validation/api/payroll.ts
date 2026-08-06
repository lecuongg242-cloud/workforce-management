import { z } from "zod";

import { periodStatusSchema } from "@/lib/validation/api/periods";

/**
 * Hop dong cua `GET /api/payroll/summary` — bang CHUAN BI luong.
 *
 * Khong truong tien nao, co y: xem khoi chu thich cua `PayrollPrepRow` trong
 * `domain.ts`. Neu mot ngay nao do nhom PAY duoc keo tu V3 ve, cot tien se
 * duoc them o mot schema RIENG chu khong nhet vao day — de mot man hinh doc
 * bang nay khong bao gio vo tinh hien mot con so tien chua duoc kiem chung.
 */

const overtimeRuleKeySchema = z.enum(["weekday", "weekend", "holiday", "night"]);

/** Mot khoan da quy ra tien trong mot dong luong (PAY-01). */
export const payrollAdjustmentItemSchema = z.object({
  adjustmentId: z.string(),
  name: z.string(),
  amount: z.number(),
  multiplier: z.number(),
});

export const payrollPrepRowSchema = z.object({
  employeeId: z.string(),
  employeeCode: z.string(),
  employeeName: z.string(),
  departmentName: z.string().nullable(),
  workedDays: z.number().int(),
  totalMinutes: z.number().int(),
  lateCount: z.number().int(),
  leaveDays: z.number().int(),
  overtimeMinutes: z.number().int(),
  overtimeNightMinutes: z.number().int(),
  convertedOvertimeHours: z.number().nullable(),
  missingMultiplierKeys: z.array(overtimeRuleKeySchema),
  /* D-36/D-39 (plan 05-2-02). `creditedDays` KHONG `int()`: o che do
   * `daily_hours` no la so thap phan. `null` = thieu mau so quy doi. */
  creditedDays: z.number().nullable(),
  regularMinutes: z.number().nullable(),
  hourDeltaMinutes: z.number(),
  missingWorkModeInputs: z.array(z.enum(["standard_hours_per_day"])),

  /* PAY-01 (plan 05-2-04) — phan tien. Moi truong `nullable()`: `null` la
   * "chua du du kien", va no PHAI di duoc qua hop dong JSON de giao dien noi
   * dung dieu do thay vi hien 0. */
  payUnit: z.enum(["month", "day", "hour"]).nullable(),
  payAmount: z.number().nullable(),
  basePay: z.number().nullable(),
  overtimePay: z.number().nullable(),
  hourAdjustment: z.number().nullable(),
  allowanceItems: z.array(payrollAdjustmentItemSchema),
  deductionItems: z.array(payrollAdjustmentItemSchema),
  allowanceTotal: z.number().nullable(),
  deductionTotal: z.number().nullable(),
  netPay: z.number().nullable(),
  // Chuoi tu do co chu dich: khoa thieu gom ca dang `overtime_rule:<key>`, va
  // mot enum o day se phai duoc sua moi lan them mot loai thieu — trong khi
  // giao dien chi dung no de tra cuu mot nhan.
  missing: z.array(z.string()),
});

export const payrollPrepSchema = z.object({
  month: z.string(),
  periodStatus: periodStatusSchema.nullable(),
  /**
   * Che do tinh cong DANG AP cho ca bang. Nam o cap bang chu khong o tung
   * dong: no la mot lua chon cua doanh nghiep, khong cua tung nguoi — va de
   * o cap dong se gioi thieu mot cach hieu sai rang no khai rieng duoc.
   */
  workMode: z.enum(["daily_hours", "shift", "shift_hourly"]),
  /**
   * D-42: trang thai CHOT LUONG, khac `periodStatus` (chot ky cong). Hai
   * truong nam canh nhau co chu dich — chung tra loi hai cau hoi khac nhau, va
   * mot ky co the da chot cong ma chua chot luong.
   */
  payrollStatus: z.enum(["open", "closed"]),
  payrollClosedAt: z.string().nullable(),
  payrollClosedBy: z.string().nullable(),
  rows: z.array(payrollPrepRowSchema),
});

/**
 * Tham so truy van — CHI mot thang. Khong truong dinh danh doanh nghiep nao
 * (D-12b): pham vi luon den tu `getSessionContext()`.
 */
export const payrollQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Tháng phải theo định dạng YYYY-MM."),
});
