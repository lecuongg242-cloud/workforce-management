import { z } from "zod";

import { attendanceStatusSchema } from "@/lib/validation/api/attendance";

/**
 * Schema Zod cho bang dieu khien (plan 02-08). `dashboardSummarySchema` khop
 * `DashboardSummary` cua domain.ts day du bon cau truc con — dung o CA HAI
 * dau cho hop dong JSON (D-12d): Route Handler parse truoc khi tra ve,
 * `src/lib/data/dashboard.ts` parse lai sau khi nhan qua `fetchJson`.
 */

const requestTypeSchema = z.enum([
  "leave",
  "attendance_supplement",
  "time_adjustment",
  "overtime",
]);

const kpiValueSchema = z.object({
  value: z.number(),
  delta: z.number(),
});

const attendanceChartPointSchema = z.object({
  date: z.string(),
  label: z.string(),
  present: z.number(),
  late: z.number(),
  absent: z.number(),
});

const todayActivityItemSchema = z.object({
  employeeId: z.string(),
  employeeName: z.string(),
  departmentName: z.string(),
  avatarUrl: z.string().nullable(),
  checkIn: z.string().nullable(),
  status: attendanceStatusSchema,
  location: z.string(),
});

const pendingRequestSummarySchema = z.object({
  type: requestTypeSchema,
  count: z.number(),
});

const notCheckedInItemSchema = z.object({
  employeeId: z.string(),
  employeeName: z.string(),
  departmentName: z.string(),
  avatarUrl: z.string().nullable(),
  /**
   * `null` = CHUA KHAI so dien thoai (0028). Khong phai chuoi rong.
   *
   * Khai `z.string()` o day tung lam ca `GET /api/dashboard` tra 500 cho ca
   * doanh nghiep chi vi MOT nhan vien de trong o nay — `departmentName` ben
   * tren khong dinh vi no giai qua `Map.get(...) ?? "—"`, con truong nay thi
   * di thang tu database ra.
   */
  phone: z.string().nullable(),
  shiftName: z.string(),
});

export const dashboardSummarySchema = z.object({
  date: z.string(),
  totalEmployees: kpiValueSchema,
  checkedIn: kpiValueSchema,
  late: kpiValueSchema,
  onLeave: kpiValueSchema,
  chart: z.array(attendanceChartPointSchema),
  todayActivity: z.array(todayActivityItemSchema),
  pendingRequests: z.array(pendingRequestSummarySchema),
  notCheckedIn: z.array(notCheckedInItemSchema),
});

/** Tham so truy van cua `GET /api/dashboard` — DUY NHAT `date` (D-12b). */
export const dashboardQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày không hợp lệ."),
});
