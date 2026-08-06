"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  holidayInputSchema,
  holidayRowSchema,
} from "@/lib/validation/api/holidays";
import type { Holiday, HolidayInput } from "@/lib/types/domain";

/**
 * Ba duong ghi ngay nghi le (SET-02), khuon `mutations/work-sites.ts` (03-02):
 * `getSessionContext()` -> `requireRole` -> doc nguyen dong TRUOC -> ghi voi
 * `.eq("company_id", companyId)` (companyId LUON tu phien — D-12b) -> doc
 * nguyen dong SAU -> `logMutation` ngay trong cung ham (D-17).
 *
 * VI SAO CO `countAffectedAttendance()`:
 * Ngay le KHONG phien ban hoa duoc theo `effective_from` nhu he so tang ca
 * (D-25b) — mot ngay hoac la ngay le hoac khong, khong co "phien ban cua ngay
 * 02/09". Nghia la sua hay xoa mot ngay le TRONG QUA KHU se doi cach phan
 * loai cua nhung ban ghi cham cong da co. Lop bao ve duy nhat cho tieu chi 4
 * cua phase o day la NOI CHO NGUOI BAM BIET ho dang doi bao nhieu ban ghi —
 * va con so do phai do server dem, client khong co cach nao biet dung.
 */

const HOLIDAY_COLUMNS = "id, company_id, holiday_date, name";

/** Ma loi Postgres cho vi pham rang buoc unique. */
const UNIQUE_VIOLATION = "23505";

function duplicateMessage(date: string): string {
  return `Ngày ${date} đã được khai là ngày nghỉ lễ của doanh nghiệp.`;
}

export async function createHoliday(input: HolidayInput): Promise<Holiday> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const writeRow = holidayInputSchema.parse(input);
  const supabase = await createServerSupabase();

  const { data: inserted, error } = await supabase
    .from("holidays")
    .insert({ company_id: companyId, ...writeRow })
    .select(HOLIDAY_COLUMNS)
    .single();

  if (error || !inserted) {
    if (error?.code === UNIQUE_VIOLATION) {
      throw new Error(duplicateMessage(writeRow.holiday_date));
    }
    throw new Error("Không thể thêm ngày nghỉ lễ.");
  }

  const holiday = holidayRowSchema.parse(inserted);

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "holidays",
    entityId: holiday.id,
    before: null,
    after: inserted,
    reason: await affectedReason(writeRow.holiday_date),
  });

  return holiday;
}

export async function updateHoliday(
  id: string,
  patch: Partial<HolidayInput>,
): Promise<Holiday> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const { data: beforeRow, error: beforeError } = await supabase
    .from("holidays")
    .select(HOLIDAY_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeRow) {
    throw new Error("Không tìm thấy ngày nghỉ lễ.");
  }
  const before = holidayRowSchema.parse(beforeRow);

  // Hop nhat bang "in" (khong phai "??") de truong CO mat trong patch luon
  // duoc ap dung, truong khong co mat giu nguyen gia tri cu.
  const merged = holidayInputSchema.parse({
    date: "date" in patch ? (patch.date as string) : before.date,
    name: "name" in patch ? (patch.name as string) : before.name,
  });

  const { data: afterRow, error: updateError } = await supabase
    .from("holidays")
    .update(merged)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(HOLIDAY_COLUMNS)
    .single();

  if (updateError || !afterRow) {
    if (updateError?.code === UNIQUE_VIOLATION) {
      throw new Error(duplicateMessage(merged.holiday_date));
    }
    throw new Error("Không thể cập nhật ngày nghỉ lễ.");
  }

  // Ca ngay CU lan ngay MOI deu co the mang ban ghi cham cong — ghi ca hai con
  // so vao vet, vi nguoi doc audit sau nay can biet thao tac nay cham vao bao
  // nhieu ban ghi o CA HAI dau.
  const reasons = [
    await affectedReason(before.date, "ngày cũ"),
    before.date === merged.holiday_date
      ? null
      : await affectedReason(merged.holiday_date, "ngày mới"),
  ].filter(Boolean);

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "holidays",
    entityId: id,
    before: beforeRow,
    after: afterRow,
    reason: reasons.length > 0 ? reasons.join("; ") : null,
  });

  return holidayRowSchema.parse(afterRow);
}

export async function deleteHoliday(id: string): Promise<void> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const { data: beforeRow, error: beforeError } = await supabase
    .from("holidays")
    .select(HOLIDAY_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeRow) {
    throw new Error("Không tìm thấy ngày nghỉ lễ.");
  }
  const before = holidayRowSchema.parse(beforeRow);

  const { error: deleteError } = await supabase
    .from("holidays")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (deleteError) {
    throw new Error("Không thể xoá ngày nghỉ lễ.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "delete",
    entityTable: "holidays",
    entityId: id,
    before: beforeRow,
    after: null,
    reason: await affectedReason(before.date),
  });
}

/**
 * So ban ghi cham cong cua doanh nghiep trong phien roi vao dung ngay do.
 *
 * Duoc goi TRUOC khi ghi (de man hinh canh bao), va lai duoc goi trong chinh
 * ba ham ghi o tren de dat vao `audit_log.reason` — hai lan doc, nhung con so
 * trong vet audit phai la con so tai thoi diem GHI, khong phai con so ma giao
 * dien tinh co doc duoc truoc do vai phut.
 */
export async function countAffectedAttendance(date: string): Promise<number> {
  const { companyId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const { count, error } = await supabase
    .from("attendance_records")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("work_date", date);

  if (error) {
    throw new Error("Không đếm được số bản ghi chấm công của ngày này.");
  }
  return count ?? 0;
}

/** Chuoi `reason` cho audit — `null` khi ngay do chua co ban ghi nao. */
async function affectedReason(
  date: string,
  label?: string,
): Promise<string | null> {
  const affected = await countAffectedAttendance(date);
  if (affected === 0) return null;
  const prefix = label ? `${label} ${date}` : `ngày ${date}`;
  return `${prefix}: ${affected} bản ghi chấm công đổi cách phân loại`;
}
