"use server";

import { randomUUID } from "node:crypto";

import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import { workRequestInputSchema, workRequestSchema } from "@/lib/validation/api/requests";
import type { WorkRequest, WorkRequestInput } from "@/lib/types/domain";

const WORK_REQUEST_COLUMNS =
  "id, company_id, employee_id, type, status, from_date, to_date, from_time, to_time, reason, created_at, reviewer_id, review_note";

const DATE_RANGE_MESSAGE = "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.";

/**
 * Giu NGUYEN chu ky cu tu `mock/service.ts` (call site khong phai sua).
 * Khuon giong `mutations/attendance.ts`/`mutations/employees.ts`:
 * `getSessionContext()` -> kiem quyen -> doc/ghi voi `company_id` tu session
 * (khong tu tham so client — D-12b) -> `logMutation` NGAY TRONG cung ham
 * (D-17), before/after la nguyen dong (D-18).
 *
 * T-02-09-02: trang thai/nguoi duyet/ghi chu duyet LUON duoc dat cung dinh
 * o day (cho vao pending, rong), KHONG BAO GIO doc tu `input` — schema dau
 * vao (`workRequestInputSchema`) da khong khai bon truong nay nen client
 * khong the gui len duoc.
 */
export async function createRequest(
  companyId: string,
  employeeId: string,
  input: WorkRequestInput,
): Promise<WorkRequest> {
  void companyId;

  const {
    companyId: activeCompanyId,
    userId,
    role,
    employeeId: sessionEmployeeId,
  } = await getSessionContext();

  // T-02-09-01: employee/manager chi tao duoc yeu cau cho CHINH MINH;
  // owner/admin tao duoc cho moi nhan vien trong doanh nghiep. Tham so
  // `employeeId` ma noi goi truyen vao chi duoc DOI CHIEU, khong duoc tin.
  const isAdminRole = role === "owner" || role === "admin";
  if (!isAdminRole && employeeId !== sessionEmployeeId) {
    throw new ForbiddenError();
  }

  // Kiem `toDate >= fromDate` o tang ung dung TRUOC — rang buoc `check` cua
  // database la lop hai, bat rieng ma loi va doi thanh CUNG thong diep nay.
  if (input.toDate < input.fromDate) {
    throw new Error(DATE_RANGE_MESSAGE);
  }

  const supabase = await createServerSupabase();

  // employeeId phai thuoc doanh nghiep hien hanh — khong the tao yeu cau
  // dung ten mot nhan vien cua doanh nghiep khac (cung khuon voi
  // `bulkMoveDepartment`/`checkIn` doi chieu department/employee truoc khi ghi).
  const { data: employeeRow, error: employeeError } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("company_id", activeCompanyId)
    .maybeSingle();
  if (employeeError || !employeeRow) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const id = randomUUID();
  const writeRow = workRequestInputSchema.parse(input);

  const { data: inserted, error } = await supabase
    .from("work_requests")
    .insert({
      id,
      company_id: activeCompanyId,
      employee_id: employeeId,
      ...writeRow,
      status: "pending",
      reviewer_id: null,
      review_note: null,
    })
    .select(WORK_REQUEST_COLUMNS)
    .single();

  if (error || !inserted) {
    // Lop HAI: rang buoc `check (to_date >= from_date)` cua database
    // (23514 — check_violation) van co the bi cham trong mot truong hop
    // rieng (race hoac du lieu khong qua duong client) — doi thanh CUNG
    // thong diep tieng Viet o tren, khong de loi Postgres tho lot len giao dien.
    if (error?.code === "23514") {
      throw new Error(DATE_RANGE_MESSAGE);
    }
    throw new Error("Không thể tạo yêu cầu.");
  }

  await logMutation({
    companyId: activeCompanyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "work_requests",
    entityId: id,
    before: null,
    after: inserted,
    reason: null,
  });

  return workRequestSchema.parse(inserted);
}
