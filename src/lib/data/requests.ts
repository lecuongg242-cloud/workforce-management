import { fetchJson } from "@/lib/data/fetch-json";
import {
  overtimeUsageSchema,
  requestEffectPlainSchema,
  requestReviewListResponseSchema,
  workRequestListResponseSchema,
} from "@/lib/validation/api/requests";
import type {
  OvertimeUsage,
  RequestEffect,
  RequestQuery,
  RequestReview,
  WorkRequest,
} from "@/lib/types/domain";

export { createRequest, reviewRequest } from "@/lib/data/mutations/requests";

/**
 * Chu ky giu Y HET `mock/service.ts` — call site chi doi dong import (plan
 * 02-09). `query.companyId` KHONG bao gio gui len server — pham vi luon den
 * tu `getSessionContext()` (D-12b), cung ly do voi `listAttendance`.
 * `status: "all"` van duoc gui len (Route Handler tu dien giai la khong loc).
 */
export async function listRequests(query: RequestQuery): Promise<WorkRequest[]> {
  const params = new URLSearchParams();
  if (query.employeeId) params.set("employeeId", query.employeeId);
  if (query.status) params.set("status", query.status);

  const qs = params.toString();
  return fetchJson(`/api/requests${qs ? `?${qs}` : ""}`, workRequestListResponseSchema);
}

/**
 * Lich su xu ly cua mot yeu cau, moi nhat truoc (APRV-04). Tra mang rong khi
 * yeu cau chua duoc xu ly lan nao — do la du lieu hop le, khong phai loi.
 */
export async function listRequestReviews(
  requestId: string,
): Promise<RequestReview[]> {
  return fetchJson(
    `/api/requests/${encodeURIComponent(requestId)}/reviews`,
    requestReviewListResponseSchema,
  );
}

/**
 * Tac dong ma yeu cau nay SE gay ra neu duoc duyet — do server dem
 * (`tf_preview_request_effect`), khong ghi gi. Man hinh duyet goi truoc khi mo
 * hop thoai: khong ai nen bam duyet ma khong biet minh sap doi bao nhieu ngay
 * cong.
 */
export async function previewRequestEffect(
  requestId: string,
): Promise<RequestEffect> {
  return fetchJson(
    `/api/requests/${encodeURIComponent(requestId)}/effect`,
    requestEffectPlainSchema,
  );
}

/**
 * Gio tang ca da dung cua mot nhan vien trong mot thang, kem tran cua doanh
 * nghiep (SET-05). `excludeRequestId` loai chinh yeu cau dang xet ra khoi phan
 * "da dung" — no la phan "yeu cau nay them", cong ca hai ve se bao vuot gap doi.
 */
export async function getOvertimeUsage({
  employeeId,
  month,
  excludeRequestId,
}: {
  employeeId: string;
  /** "YYYY-MM" */
  month: string;
  excludeRequestId?: string;
}): Promise<OvertimeUsage> {
  const params = new URLSearchParams({ employeeId, month });
  if (excludeRequestId) params.set("excludeRequestId", excludeRequestId);

  return fetchJson(
    `/api/requests/overtime-usage?${params.toString()}`,
    overtimeUsageSchema,
  );
}
