import { fetchJson } from "@/lib/data/fetch-json";
import {
  attendanceReviewListResponseSchema,
  type attendanceReviewItemSchema,
} from "@/lib/validation/api/attendance-review";
import type { z } from "zod";

export type AttendanceReviewItem = z.infer<typeof attendanceReviewItemSchema>;

export interface AttendanceReviewQuery {
  from?: string;
  to?: string;
  reviewStatus?: "pending" | "approved" | "rejected";
}

/**
 * Dung boi `AttendanceReviewView` (03-06 Task 3) — doc danh sach ban ghi
 * cham cong DANG NGO (D-21/ATT-07) qua `GET /api/attendance/review`. Tham
 * so TUY CHON, khong tham so nao khai dinh danh doanh nghiep (pham vi luon
 * den tu phien server).
 */
export async function listAttendanceReview(
  query: AttendanceReviewQuery = {},
): Promise<AttendanceReviewItem[]> {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.reviewStatus) params.set("reviewStatus", query.reviewStatus);

  const search = params.toString();
  return fetchJson(
    `/api/attendance/review${search ? `?${search}` : ""}`,
    attendanceReviewListResponseSchema,
  );
}
