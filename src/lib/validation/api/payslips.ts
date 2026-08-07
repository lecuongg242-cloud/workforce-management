import { z } from "zod";

import { payrollAdjustmentItemSchema } from "@/lib/validation/api/payroll";

/**
 * Hop dong cua `GET /api/payslips` va `GET /api/payslips/[month]` — phieu
 * luong cua CHINH nguoi dang nhap (PAY-05).
 *
 * ======================================================================
 * KHONG MOT TRUONG NAO KHAI DANH TINH
 * ======================================================================
 *
 * Khong co `employeeId`, khong co `companyId` — ke ca o hinh dang PHAN HOI.
 * Pham vi den tu phien (D-12b), va mot truong danh tinh trong phan hoi la mot
 * loi moi cho man hinh sau nay "cho phep truyen vao de xem nguoi khac". Ten
 * va ma nhan vien VAN co, nhung la ANH CHUP de in len phieu, khong phai khoa
 * de tra cuu.
 *
 * Moi truong tien la `z.number()` KHONG nullable — nguoc voi
 * `payrollPrepRowSchema`, noi `null` mang nghia "chua du du kien". Mot phieu
 * luong chi ton tai khi ky DA CHOT, va mot ky chi chot duoc khi khong dong
 * nao thieu du kien (`closePayroll`). `null` o day la khong the xay ra, nen
 * hop dong noi dung nhu vay.
 */

/** Mot ky da chot luong ma nguoi dang nhap co phieu. */
export const payslipSummarySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  closedAt: z.string(),
  netPay: z.number(),
});

export const payslipListResponseSchema = z.array(payslipSummarySchema);

export const payslipSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  closedAt: z.string(),

  employeeCode: z.string(),
  employeeName: z.string(),
  departmentName: z.string().nullable(),

  payUnit: z.enum(["month", "day", "hour"]),
  payAmount: z.number(),

  workedDays: z.number().int(),
  totalMinutes: z.number().int(),
  leaveDays: z.number().int(),
  lateCount: z.number().int(),
  overtimeMinutes: z.number().int(),
  // KHONG `int()`: gio quy doi la so thap phan (1.5 gio x he so 2.0).
  convertedOvertimeHours: z.number(),

  basePay: z.number(),
  overtimePay: z.number(),
  hourAdjustment: z.number(),
  allowanceItems: z.array(payrollAdjustmentItemSchema),
  deductionItems: z.array(payrollAdjustmentItemSchema),
  allowanceTotal: z.number(),
  deductionTotal: z.number(),
  netPay: z.number(),
});

/** Tham so duong dan cua `GET /api/payslips/[month]`. */
export const payslipMonthParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Định dạng tháng không hợp lệ.");
