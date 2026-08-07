import { z } from "zod";

import {
  payrollAdjustmentItemSchema,
  payrollDayLineSchema,
} from "@/lib/validation/api/payroll";

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

/**
 * Mot ky trong danh sach phieu cua nguoi dang nhap.
 *
 * `status` KHONG suy duoc tu `closedAt`: mot man hinh doc `closedAt === null`
 * roi tu ket luan "tam tinh" la mot suy dien, va suy dien thi hong im lang khi
 * hinh dang doi. Co ro rang thi khong.
 */
export const payslipSummarySchema = z.object({
  status: z.enum(["closed", "provisional"]),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  /** `null` o ky TAM TINH — chua ai chot thi chua co thoi diem chot. */
  closedAt: z.string().nullable(),
  /** `null` khi chua khai muc luong — KHONG duoc hien thanh 0. */
  netPay: z.number().nullable(),
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

/**
 * PHIEU DA CHOT — moi truong tien KHONG nullable, dung nhu `payslipSchema`.
 *
 * Bat bien do KHONG duoc noi long de phuc vu phieu tam tinh: mot ky chi chot
 * duoc khi khong dong nao thieu du kien (`closePayroll`), nen `null` o day la
 * khong the xay ra, va hop dong phai noi dung nhu vay. Noi long no de dung
 * chung mot kieu se XOA MAT mot bat bien that cua ban chot.
 */
export const closedPayslipSchema = payslipSchema.extend({
  status: z.literal("closed"),
  days: z.array(payrollDayLineSchema),
});

/**
 * PHIEU TAM TINH cua ky CHUA CHOT.
 *
 * Tien CO THE `null` (chua khai muc luong), va `missing` noi ro thieu gi — day
 * la ly do no khong dung chung kieu voi phieu da chot.
 */
export const provisionalPayslipSchema = z.object({
  status: z.literal("provisional"),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  /** Luon `null` — ky nay chua duoc chot. */
  closedAt: z.null(),

  employeeCode: z.string(),
  employeeName: z.string(),
  departmentName: z.string().nullable(),

  payUnit: z.enum(["month", "day", "hour"]).nullable(),
  payAmount: z.number().nullable(),

  workedDays: z.number().int(),
  totalMinutes: z.number().int(),
  leaveDays: z.number().int(),
  lateCount: z.number().int(),
  overtimeMinutes: z.number().int(),
  convertedOvertimeHours: z.number().nullable(),

  basePay: z.number().nullable(),
  overtimePay: z.number().nullable(),
  hourAdjustment: z.number().nullable(),
  allowanceItems: z.array(payrollAdjustmentItemSchema),
  deductionItems: z.array(payrollAdjustmentItemSchema),
  allowanceTotal: z.number().nullable(),
  deductionTotal: z.number().nullable(),
  netPay: z.number().nullable(),
  missing: z.array(z.string()),

  days: z.array(payrollDayLineSchema),
});

/**
 * Phan hoi cua `GET /api/payslips/[month]` — mot trong hai hinh dang, phan
 * biet bang `status`. Man hinh phai xu ly ca hai; kieu khong cho phep quen.
 */
export const payslipResponseSchema = z.discriminatedUnion("status", [
  closedPayslipSchema,
  provisionalPayslipSchema,
]);

/** Tham so duong dan cua `GET /api/payslips/[month]`. */
export const payslipMonthParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Định dạng tháng không hợp lệ.");
