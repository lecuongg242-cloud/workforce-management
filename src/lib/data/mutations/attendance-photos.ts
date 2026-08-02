"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import * as auditLog from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import { photoReviewInputSchema } from "@/lib/validation/api/attendance-photos";
import type { PhotoReviewStatus } from "@/lib/types/domain";

/**
 * Server Action ATT-04: chi owner/admin danh dau mot anh cham cong da duoc
 * xem xet. Khuon giong `mutations/shifts.ts` (D-17/D-18): `getSessionContext()`
 * -> `requireRole` -> doc nguyen dong TRUOC -> cap nhat voi `.eq("company_id",
 * companyId)` -> doc nguyen dong SAU -> ghi audit.
 *
 * `reviewed_by` LUON la `userId` cua CHINH phien goi, `reviewed_at` LUON la
 * dong ho database (`tf_server_now()`) — hai gia tri nay khong bao gio nhan
 * tu tham so cua noi goi (T-03-05-06, Repudiation T-03-05-05).
 *
 * Import audit qua namespace (khong phai named import truc tiep ten ham) de
 * module nay chi co DUY NHAT mot dong nguon goi toi ham ghi audit — chinh
 * dong goi ham, khong phai dong import — mot ham, mot lan ghi audit, khong
 * lap lai (khuon ma acceptance criteria cua 03-05-PLAN.md doi hoi).
 */
export async function markPhotoReviewed(
  photoId: string,
  status: PhotoReviewStatus,
): Promise<void> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const input = photoReviewInputSchema.parse({ status });

  const supabase = await createServerSupabase();

  // Doc dong TRUOC luon kem dieu kien company_id tu session -- neu photoId
  // thuoc doanh nghiep khac thi khong tim thay gi va nem loi NGAY O DAY,
  // truoc khi bat ky lenh UPDATE nao chay (T-03-05-01 style: khong bao gio
  // doi du lieu cua mot dong ma phien goi khong duoc phep thay).
  const { data: beforeRow, error: beforeError } = await supabase
    .from("attendance_photos")
    .select(
      "id, company_id, attendance_record_id, kind, review_status, reviewed_by, reviewed_at",
    )
    .eq("id", photoId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeRow) {
    throw new Error("Không tìm thấy ảnh chấm công.");
  }

  // D-19: reviewed_at LUON la dong ho cua database, khong bao gio la tham
  // so `status` hay mot doi tuong Date tinh o tang ung dung.
  const { data: nowIso, error: nowError } = await supabase.rpc("tf_server_now");
  if (nowError || !nowIso) {
    throw new Error("Không thể xác định thời gian máy chủ.");
  }

  const { data: afterRow, error: updateError } = await supabase
    .from("attendance_photos")
    .update({
      review_status: input.status,
      reviewed_by: userId,
      reviewed_at: nowIso,
    })
    .eq("id", photoId)
    .eq("company_id", companyId)
    .select(
      "id, company_id, attendance_record_id, kind, review_status, reviewed_by, reviewed_at",
    )
    .single();

  if (updateError || !afterRow) {
    throw new Error("Không thể cập nhật trạng thái xem xét.");
  }

  await auditLog.logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "attendance_photos",
    entityId: photoId,
    before: beforeRow,
    after: afterRow,
    reason: null,
  });
}
