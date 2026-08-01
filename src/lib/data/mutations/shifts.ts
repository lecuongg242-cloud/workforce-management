"use server";

import { randomUUID } from "node:crypto";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import { shiftInputSchema, shiftRowSchema } from "@/lib/validation/api/shifts";
import type { Shift, ShiftInput } from "@/lib/types/domain";

const SHIFT_COLUMNS =
  "id, company_id, name, code, start_time, end_time, break_minutes, late_tolerance_minutes, overnight, working_days, status";

/**
 * Ba ham nay giu NGUYEN chu ky cu tu `mock/service.ts` (call site khong
 * phai sua). Moi ham: `getSessionContext()` -> `requireRole(role,
 * ["owner","admin"])` -> doc nguyen dong TRUOC (khi co) -> ghi voi
 * `.eq("company_id", companyId)` (companyId luon tu session, khong tu tham
 * so client — D-12b, T-02-06-01) -> doc nguyen dong SAU -> `logMutation`
 * NGAY TRONG cung ham (D-17), before/after la nguyen dong (D-18).
 *
 * `overnight` KHONG BAO GIO duoc dua vao cau lenh ghi: no la cot sinh
 * (`generated always as (end_time < start_time) stored`). `shiftInputSchema`
 * khong khai bao truong nay nen Zod tu bo qua neu `input`/`patch` con mang
 * theo gia tri do (T-02-06-04).
 */
export async function createShift(
  companyId: string,
  input: ShiftInput,
): Promise<Shift> {
  void companyId;
  const { companyId: activeCompanyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();
  const id = randomUUID();
  const writeRow = shiftInputSchema.parse(input);

  const { data: inserted, error } = await supabase
    .from("shifts")
    .insert({ id, company_id: activeCompanyId, ...writeRow })
    .select(SHIFT_COLUMNS)
    .single();

  if (error || !inserted) {
    throw new Error("Không thể tạo ca làm việc.");
  }

  await logMutation({
    companyId: activeCompanyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "shifts",
    entityId: id,
    before: null,
    after: inserted,
    reason: null,
  });

  return shiftRowSchema.parse(inserted);
}

export async function updateShift(
  id: string,
  patch: Partial<ShiftInput>,
): Promise<Shift> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const { data: beforeRow, error: beforeError } = await supabase
    .from("shifts")
    .select(SHIFT_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeRow) {
    throw new Error("Không tìm thấy ca làm việc.");
  }
  const before = shiftRowSchema.parse(beforeRow);

  // Hop nhat giong `{...current, ...patch}` cua mock/service.ts. Dung "in"
  // (khong phai "??") de truong CO mat trong patch (ke ca gia tri falsy nhu
  // 0) luon duoc ap dung, truong khong co mat giu nguyen gia tri cu.
  // `overnight` (neu co trong patch) khong nam trong danh sach duoi day —
  // bi bo qua tuyet doi, khong bao gio chuyen vao `writeRow`.
  const merged = {
    name: "name" in patch ? (patch.name as string) : before.name,
    code: "code" in patch ? (patch.code as string) : before.code,
    startTime: "startTime" in patch ? (patch.startTime as string) : before.startTime,
    endTime: "endTime" in patch ? (patch.endTime as string) : before.endTime,
    breakMinutes:
      "breakMinutes" in patch ? (patch.breakMinutes as number) : before.breakMinutes,
    lateToleranceMinutes:
      "lateToleranceMinutes" in patch
        ? (patch.lateToleranceMinutes as number)
        : before.lateToleranceMinutes,
    workingDays:
      "workingDays" in patch
        ? (patch.workingDays as Shift["workingDays"])
        : before.workingDays,
    status: "status" in patch ? (patch.status as Shift["status"]) : before.status,
  };
  const writeRow = shiftInputSchema.parse(merged);

  // KHONG co nhanh "khong doi gi thi bo qua" (D-18, cam trong
  // 02-06-PLAN.md <behavior>): du `merged` bang het gia tri cu, van thuc
  // hien UPDATE va ghi audit voi before = after.
  const { data: afterRow, error: updateError } = await supabase
    .from("shifts")
    .update(writeRow)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(SHIFT_COLUMNS)
    .single();

  if (updateError || !afterRow) {
    throw new Error("Không thể cập nhật ca làm việc.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "shifts",
    entityId: id,
    before: beforeRow,
    after: afterRow,
    reason: null,
  });

  return shiftRowSchema.parse(afterRow);
}

export async function duplicateShift(id: string): Promise<Shift> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  // Doc ca goc LUON kem dieu kien company_id tu session -- neu id thuoc
  // doanh nghiep khac thi khong tim thay gi va nem loi, khong bao gio nhan
  // ban duoc ca cua doanh nghiep khac (T-02-06-01).
  const { data: sourceRow, error: sourceError } = await supabase
    .from("shifts")
    .select(SHIFT_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (sourceError || !sourceRow) {
    throw new Error("Không tìm thấy ca làm việc.");
  }
  const source = shiftRowSchema.parse(sourceRow);

  const newId = randomUUID();
  // Ten/ma ban sao dan xuat dung quy tac V1 (mock/service.ts dong 211-216).
  const writeRow = shiftInputSchema.parse({
    name: `${source.name} (bản sao)`,
    code: `${source.code}2`,
    startTime: source.startTime,
    endTime: source.endTime,
    breakMinutes: source.breakMinutes,
    lateToleranceMinutes: source.lateToleranceMinutes,
    workingDays: source.workingDays,
    status: source.status,
  });

  const { data: inserted, error: insertError } = await supabase
    .from("shifts")
    // company_id luon tu session, KHONG tu ca goc -- hai gia tri luon bang
    // nhau nho dieu kien doc o tren, nhung lay tu session la bat bien an
    // toan hon (xem 02-06-PLAN.md action (d)).
    .insert({ id: newId, company_id: companyId, ...writeRow })
    .select(SHIFT_COLUMNS)
    .single();

  if (insertError || !inserted) {
    throw new Error("Không thể nhân bản ca làm việc.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "shifts",
    entityId: newId,
    before: null,
    after: inserted,
    reason: null,
  });

  return shiftRowSchema.parse(inserted);
}
