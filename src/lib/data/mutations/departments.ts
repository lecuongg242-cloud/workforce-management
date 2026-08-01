"use server";

import { randomUUID } from "node:crypto";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Department, DepartmentInput } from "@/lib/types/domain";

interface DepartmentRow {
  id: string;
  company_id: string;
  name: string;
  description: string;
  manager_id: string | null;
  status: Department["status"];
}

const DEPARTMENT_COLUMNS = "id, company_id, name, description, manager_id, status";

function toDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description,
    managerId: row.manager_id,
    status: row.status,
  };
}

/**
 * Ba ham nay giu NGUYEN chu ky cu tu `mock/service.ts` (call site khong
 * phai sua). `createDepartment` van nhan tham so `companyId` de khop chu
 * ky nhung KHONG dung de quyet dinh pham vi ghi — gia tri that luon den tu
 * `getSessionContext()` (D-12b). Moi ham: doc dong truoc, thuc hien ghi
 * (`.eq("company_id", companyId)` — RLS la lop phong thu thu hai, khong
 * phai lop duy nhat), doc dong sau, roi `logMutation` NGAY TRONG cung ham
 * (D-17). Neu `logMutation` nem loi, ham cung nem theo — khong nuot loi
 * audit (xem `<prohibitions>` cua 02-05-PLAN.md).
 */
export async function createDepartment(
  companyId: string,
  input: DepartmentInput,
): Promise<Department> {
  void companyId;
  const { companyId: activeCompanyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();
  const id = randomUUID();

  const { data: inserted, error } = await supabase
    .from("departments")
    .insert({
      id,
      company_id: activeCompanyId,
      name: input.name,
      description: input.description,
      manager_id: input.managerId,
      status: input.status,
    })
    .select(DEPARTMENT_COLUMNS)
    .single();

  if (error || !inserted) {
    throw new Error("Không thể tạo phòng ban.");
  }

  await logMutation({
    companyId: activeCompanyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "departments",
    entityId: id,
    before: null,
    after: inserted,
    reason: null,
  });

  return toDepartment(inserted as DepartmentRow);
}

export async function updateDepartment(
  id: string,
  patch: Partial<DepartmentInput>,
): Promise<Department> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const { data: beforeData, error: beforeError } = await supabase
    .from("departments")
    .select(DEPARTMENT_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeData) {
    throw new Error("Không tìm thấy phòng ban.");
  }
  const before = beforeData as DepartmentRow;

  // Hop nhat giong `{...current, ...patch}` cua mock/service.ts — truong
  // khong co trong patch giu nguyen gia tri cu, truong CO trong patch (ke ca
  // gia tri `null` tuong minh cho `managerId`) luon duoc ap dung. Dung "in"
  // thay vi "??" de khong nham `managerId: null` (bo phan cong quan ly) voi
  // "khong co truong nay trong patch".
  const updates = {
    name: "name" in patch ? (patch.name as string) : before.name,
    description:
      "description" in patch ? (patch.description as string) : before.description,
    manager_id:
      "managerId" in patch ? (patch.managerId as string | null) : before.manager_id,
    status: "status" in patch ? (patch.status as Department["status"]) : before.status,
  };

  // KHONG co nhanh "khong co gi doi thi bo qua" (D-18, cam trong
  // 02-05-PLAN.md action (d)): du `updates` bang het gia tri cu, van thuc
  // hien UPDATE va ghi audit voi before = after — nguoi dung da thuc hien
  // thao tac.
  const { data: afterData, error: updateError } = await supabase
    .from("departments")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(DEPARTMENT_COLUMNS)
    .single();

  if (updateError || !afterData) {
    throw new Error("Không thể cập nhật phòng ban.");
  }
  const after = afterData as DepartmentRow;

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "departments",
    entityId: id,
    before,
    after,
    reason: null,
  });

  return toDepartment(after);
}

export async function deleteDepartment(id: string): Promise<void> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const { data: beforeData, error: beforeError } = await supabase
    .from("departments")
    .select(DEPARTMENT_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeData) {
    throw new Error("Không tìm thấy phòng ban.");
  }
  const before = beforeData as DepartmentRow;

  const { error: deleteError } = await supabase
    .from("departments")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (deleteError) {
    // 23503 = foreign_key_violation -- phong ban van con nhan vien
    // (employees.department_id la NOT NULL, khong ON DELETE CASCADE),
    // khac hanh vi mock (xoa vo dieu kien, khong rang buoc that).
    if (deleteError.code === "23503") {
      throw new Error(
        "Không thể xóa phòng ban vì vẫn còn nhân viên thuộc phòng ban này.",
      );
    }
    throw new Error("Không thể xóa phòng ban.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "delete",
    entityTable: "departments",
    entityId: id,
    before,
    after: null,
    reason: null,
  });
}
