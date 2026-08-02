"use server";

import { randomUUID } from "node:crypto";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import { workSiteInputSchema, workSiteRowSchema } from "@/lib/validation/api/work-sites";
import type { WorkSite, WorkSiteInput } from "@/lib/types/domain";

const WORK_SITE_COLUMNS =
  "id, company_id, name, latitude, longitude, radius_meters, is_active, created_at";

/**
 * Ba ham nay theo dung khuon `mutations/shifts.ts` (02-06): `getSessionContext()`
 * -> `requireRole(role, ["owner","admin"])` -> doc nguyen dong TRUOC (khi co)
 * -> ghi voi `.eq("company_id", companyId)` (companyId luon tu session, khong
 * tu tham so client — D-12b, T-03-02-01/T-03-02-02) -> doc nguyen dong SAU ->
 * `logMutation` NGAY TRONG cung ham (D-17, T-03-02-04), before/after la
 * nguyen dong (D-18).
 */
export async function createWorkSite(
  companyId: string,
  input: WorkSiteInput,
): Promise<WorkSite> {
  void companyId;
  const { companyId: activeCompanyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();
  const id = randomUUID();
  const writeRow = workSiteInputSchema.parse(input);

  const { data: inserted, error } = await supabase
    .from("work_sites")
    .insert({ id, company_id: activeCompanyId, ...writeRow })
    .select(WORK_SITE_COLUMNS)
    .single();

  if (error || !inserted) {
    throw new Error("Không thể tạo điểm làm việc.");
  }

  await logMutation({
    companyId: activeCompanyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "work_sites",
    entityId: id,
    before: null,
    after: inserted,
    reason: null,
  });

  return workSiteRowSchema.parse(inserted);
}

export async function updateWorkSite(
  id: string,
  patch: Partial<WorkSiteInput>,
): Promise<WorkSite> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const { data: beforeRow, error: beforeError } = await supabase
    .from("work_sites")
    .select(WORK_SITE_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeRow) {
    throw new Error("Không tìm thấy điểm làm việc.");
  }
  const before = workSiteRowSchema.parse(beforeRow);

  // Hop nhat giong `{...current, ...patch}` cua khuon `updateShift`. Dung
  // "in" (khong phai "??") de truong CO mat trong patch (ke ca gia tri
  // falsy) luon duoc ap dung, truong khong co mat giu nguyen gia tri cu.
  const merged = {
    name: "name" in patch ? (patch.name as string) : before.name,
    latitude: "latitude" in patch ? (patch.latitude as number) : before.latitude,
    longitude: "longitude" in patch ? (patch.longitude as number) : before.longitude,
    radiusMeters:
      "radiusMeters" in patch ? (patch.radiusMeters as number) : before.radiusMeters,
    isActive: "isActive" in patch ? (patch.isActive as boolean) : before.isActive,
  };
  const writeRow = workSiteInputSchema.parse(merged);

  // KHONG co nhanh "khong doi gi thi bo qua" (D-18, cung khuon `updateShift`):
  // du `merged` bang het gia tri cu, van thuc hien UPDATE va ghi audit voi
  // before = after.
  const { data: afterRow, error: updateError } = await supabase
    .from("work_sites")
    .update(writeRow)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(WORK_SITE_COLUMNS)
    .single();

  if (updateError || !afterRow) {
    throw new Error("Không thể cập nhật điểm làm việc.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "work_sites",
    entityId: id,
    before: beforeRow,
    after: afterRow,
    reason: null,
  });

  return workSiteRowSchema.parse(afterRow);
}

/**
 * CHI ha `is_active` xuong `false` — KHONG co lenh xoa dong nao trong file
 * nay (T-03-02-05). `attendance_photos.work_site_id` (plan 03-01) tro vao
 * `work_sites`; xoa cung mot dong lam moi ban ghi cham cong lich su tham
 * chieu toi no mat mot moc so sanh khoang cach, hong dung bang chung ma
 * phase nay dang xay.
 */
export async function archiveWorkSite(id: string): Promise<WorkSite> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const { data: beforeRow, error: beforeError } = await supabase
    .from("work_sites")
    .select(WORK_SITE_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeRow) {
    throw new Error("Không tìm thấy điểm làm việc.");
  }

  const { data: afterRow, error: updateError } = await supabase
    .from("work_sites")
    .update({ is_active: false })
    .eq("id", id)
    .eq("company_id", companyId)
    .select(WORK_SITE_COLUMNS)
    .single();

  if (updateError || !afterRow) {
    throw new Error("Không thể ngừng sử dụng điểm làm việc.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "work_sites",
    entityId: id,
    before: beforeRow,
    after: afterRow,
    reason: null,
  });

  return workSiteRowSchema.parse(afterRow);
}
