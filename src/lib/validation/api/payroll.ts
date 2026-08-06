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
});

export const payrollPrepSchema = z.object({
  month: z.string(),
  periodStatus: periodStatusSchema.nullable(),
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
