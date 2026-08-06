import { fetchJson } from "@/lib/data/fetch-json";
import {
  attendanceClassificationListResponseSchema,
  attendanceListResponseSchema,
  monthlySummarySchema,
} from "@/lib/validation/api/attendance";
import type {
  AttendanceDayClassification,
  AttendanceQuery,
  AttendanceRecord,
  MonthlySummary,
} from "@/lib/types/domain";

/**
 * checkIn(employeeId, evidence) / checkOut(recordId, evidence) — chu ky cuoi
 * cung sau ATT-06 (plan 03-04): khong con tham so ngay hay gio nao. Moi dau
 * thoi gian den tu tf_server_now() cua database, khong bao gio tu tham so
 * client (D-19).
 */
export { checkIn, checkOut } from "@/lib/data/mutations/attendance";

/**
 * Chu ky giu Y HET `src/lib/mock/service.ts` — call site chi doi dong import
 * (plan 02-08). `query.companyId` KHONG bao gio gui len server — pham vi
 * luon den tu `getSessionContext()` (D-12b).
 */
export async function listAttendance(
  query: AttendanceQuery,
): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams();
  if (query.employeeId) params.set("employeeId", query.employeeId);
  if (query.month) params.set("month", query.month);
  if (query.date) params.set("date", query.date);

  const qs = params.toString();
  return fetchJson(`/api/attendance${qs ? `?${qs}` : ""}`, attendanceListResponseSchema);
}

/**
 * Tham so `companyId` giu NGUYEN trong chu ky de call site khong phai sua,
 * nhung KHONG gui len server (D-12b, cung ly do voi `listShifts`).
 */
export async function getMonthlySummary(
  companyId: string,
  employeeId: string,
  month: string,
): Promise<MonthlySummary> {
  void companyId;
  const params = new URLSearchParams({ employeeId, month });
  return fetchJson(`/api/attendance/summary?${params.toString()}`, monthlySummarySchema);
}

/**
 * Phan loai tung ngay cong cua mot nhan vien trong mot thang (SET-04, plan
 * 04-05): loai ngay, phut dem, phut tang ca, gio quy doi. `companyId` giu lai
 * cho nhat quan voi cac ham chi em nhung KHONG gui len server (D-12b).
 */
export async function listAttendanceClassification(
  companyId: string,
  employeeId: string,
  month: string,
): Promise<AttendanceDayClassification[]> {
  void companyId;
  const params = new URLSearchParams({ employeeId, month });
  return fetchJson(
    `/api/attendance/classification?${params.toString()}`,
    attendanceClassificationListResponseSchema,
  );
}
