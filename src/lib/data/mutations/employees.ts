"use server";

import { randomUUID } from "node:crypto";

import { ForbiddenError, getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import {
  resolveHoursShiftId,
  type HoursShiftSelection,
} from "@/lib/shifts/resolve-hours-shift";
import { createServerSupabase } from "@/lib/supabase/server";
import { employeeInputSchema, employeeRowSchema } from "@/lib/validation/api/employees";
import type { Employee, EmployeeInput } from "@/lib/types/domain";

const EMPLOYEE_COLUMNS =
  "id, company_id, code, full_name, email, phone, date_of_birth, gender, avatar_url, department_id, position, contract_type, start_date, manager_id, shift_id, work_location, status, system_role, invitation_sent, can_view_payslip, can_check_in_remotely";

const DUPLICATE_CODE_MESSAGE = (code: string): string =>
  `Mã nhân viên ${code} đã tồn tại.`;

/**
 * Ba ham nay giu NGUYEN chu ky cu tu `mock/service.ts` (call site khong
 * phai sua). Khuon giong `mutations/departments.ts`/`mutations/shifts.ts`:
 * `getSessionContext()` -> kiem quyen -> doc/ghi voi `company_id` tu session
 * (khong tu tham so client — D-12b) -> `logMutation` NGAY TRONG cung ham
 * (D-17), before/after la nguyen dong (D-18).
 */
/**
 * `hoursShift` di KEM loi goi tao/sua nhan vien thay vi de man hinh tu goi mot
 * ham "tao ca" roi moi goi ham nay: hai loi goi tach roi thi mot loi o buoc hai
 * se de lai mot dong `shifts` mo coi ma khong man hinh nao noi den. O day ca
 * hai di chung mot duong, va `shiftId` cua ho so luon tro toi mot ca CO THAT.
 */
export async function createEmployee(
  companyId: string,
  input: EmployeeInput,
  hoursShift?: HoursShiftSelection | null,
): Promise<Employee> {
  void companyId;
  const { companyId: activeCompanyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const shiftId = hoursShift
    ? await resolveHoursShiftId({
        supabase,
        companyId: activeCompanyId,
        actorUserId: userId,
        hours: hoursShift.hours,
        workingDays: hoursShift.workingDays,
      })
    : input.shiftId;

  // Lop MOT: kiem ma trung khong phan biet hoa thuong qua RPC dung lai
  // public.tf_normalize() (migration 0009) -- rang buoc `unique (company_id,
  // code)` cua database la lop HAI, chi bat duoc trung KHOP BYTE CHINH XAC.
  const { data: codeTaken, error: dupError } = await supabase.rpc(
    "tf_employee_code_taken",
    { p_company_id: activeCompanyId, p_code: input.code },
  );
  if (dupError) {
    throw new Error("Không thể kiểm tra mã nhân viên.");
  }
  if (codeTaken) {
    throw new Error(DUPLICATE_CODE_MESSAGE(input.code));
  }

  const id = randomUUID();
  const writeRow = employeeInputSchema.parse({ ...input, shiftId });

  const { data: inserted, error } = await supabase
    .from("employees")
    .insert({ id, company_id: activeCompanyId, ...writeRow })
    .select(EMPLOYEE_COLUMNS)
    .single();

  if (error || !inserted) {
    // Lop HAI: rang buoc `unique (company_id, code)` van co the bi vi pham
    // trong mot cuoc dua giua hai request gui CHINH XAC cung ma cung luc --
    // bat rieng 23505 (unique_violation) va doi thanh CUNG thong diep tieng
    // Viet o tren, khong de loi Postgres tho lot len giao dien (T-02-07-07).
    if (error?.code === "23505") {
      throw new Error(DUPLICATE_CODE_MESSAGE(input.code));
    }
    throw new Error("Không thể tạo nhân viên.");
  }

  await logMutation({
    companyId: activeCompanyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "employees",
    entityId: id,
    before: null,
    after: inserted,
    reason: null,
  });

  return employeeRowSchema.parse(inserted);
}

export async function updateEmployee(
  id: string,
  patch: Partial<EmployeeInput>,
  hoursShift?: HoursShiftSelection | null,
): Promise<Employee> {
  const { companyId, userId, role, employeeId } = await getSessionContext();

  // Nhanh quyen hai lop (T-02-07-02): owner/admin sua duoc moi ho so trong
  // doanh nghiep; vai tro con lai (manager/employee) chi sua duoc ho so co
  // id bang CHINH employeeId cua phien, khong phai vi ca hai cung cong ty.
  const isAdminRole = role === "owner" || role === "admin";
  if (!isAdminRole && id !== employeeId) {
    throw new ForbiddenError();
  }

  const supabase = await createServerSupabase();

  const { data: beforeRow, error: beforeError } = await supabase
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeRow) {
    throw new Error("Không tìm thấy nhân viên.");
  }
  const before = employeeRowSchema.parse(beforeRow);

  // Khai so gio DE LEN TREN `patch.shiftId`: hai thu cung tra loi mot cau hoi
  // ("nguoi nay lam ca nao"), va man hinh chi gui mot trong hai.
  const resolvedShiftId = hoursShift
    ? await resolveHoursShiftId({
        supabase,
        companyId,
        actorUserId: userId,
        hours: hoursShift.hours,
        workingDays: hoursShift.workingDays,
      })
    : null;

  // Hop nhat giong `{...current, ...patch}` cua mock/service.ts. Dung "in"
  // (khong phai "??") de truong CO mat trong patch (ke ca gia tri falsy hoac
  // null tuong minh nhu managerId/avatarUrl) luon duoc ap dung, truong khong
  // co mat giu nguyen gia tri cu.
  const merged = {
    code: "code" in patch ? (patch.code as string) : before.code,
    fullName: "fullName" in patch ? (patch.fullName as string) : before.fullName,
    email: "email" in patch ? (patch.email as string) : before.email,
    phone: "phone" in patch ? (patch.phone as string | null) : before.phone,
    dateOfBirth:
      "dateOfBirth" in patch
        ? (patch.dateOfBirth as string | null)
        : before.dateOfBirth,
    gender: "gender" in patch ? (patch.gender as Employee["gender"]) : before.gender,
    avatarUrl:
      "avatarUrl" in patch ? (patch.avatarUrl as string | null) : before.avatarUrl,
    departmentId:
      "departmentId" in patch
        ? (patch.departmentId as string | null)
        : before.departmentId,
    position:
      "position" in patch ? (patch.position as string | null) : before.position,
    contractType:
      "contractType" in patch
        ? (patch.contractType as Employee["contractType"])
        : before.contractType,
    startDate: "startDate" in patch ? (patch.startDate as string) : before.startDate,
    managerId:
      "managerId" in patch ? (patch.managerId as string | null) : before.managerId,
    shiftId:
      resolvedShiftId ??
      ("shiftId" in patch ? (patch.shiftId as string) : before.shiftId),
    workLocation:
      "workLocation" in patch ? (patch.workLocation as string) : before.workLocation,
    status: "status" in patch ? (patch.status as Employee["status"]) : before.status,
    systemRole:
      "systemRole" in patch
        ? (patch.systemRole as Employee["systemRole"])
        : before.systemRole,
    invitationSent:
      "invitationSent" in patch
        ? (patch.invitationSent as boolean)
        : before.invitationSent,
    canViewPayslip:
      "canViewPayslip" in patch
        ? (patch.canViewPayslip as boolean)
        : before.canViewPayslip,
    canCheckInRemotely:
      "canCheckInRemotely" in patch
        ? (patch.canCheckInRemotely as boolean)
        : before.canCheckInRemotely,
  };
  const writeRow = employeeInputSchema.parse(merged);

  // KHONG co nhanh "khong doi gi thi bo qua" (D-18, cung cam nhu
  // 02-05/02-06): du `merged` bang het gia tri cu, van thuc hien UPDATE va
  // ghi audit voi before = after.
  const { data: afterRow, error: updateError } = await supabase
    .from("employees")
    .update(writeRow)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(EMPLOYEE_COLUMNS)
    .single();

  if (updateError || !afterRow) {
    throw new Error("Không thể cập nhật nhân viên.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "employees",
    entityId: id,
    before: beforeRow,
    after: afterRow,
    reason: null,
  });

  return employeeRowSchema.parse(afterRow);
}

export async function bulkMoveDepartment(
  ids: string[],
  departmentId: string,
): Promise<number> {
  // Danh sach rong tra ve 0 va KHONG cham toi session/database — khong co
  // gi de doi thi khong co gi de kiem quyen hay ghi audit (T-02-07-05: mot
  // thao tac khong lam gi khong duoc ghi thanh mot dong audit).
  if (ids.length === 0) return 0;

  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  // departmentId dich phai thuoc doanh nghiep hien hanh -- khong the chuyen
  // nhan vien sang mot phong ban cua doanh nghiep khac.
  const { data: departmentRow, error: departmentError } = await supabase
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (departmentError || !departmentRow) {
    throw new Error("Không tìm thấy phòng ban.");
  }

  // Doc nguyen cac dong TRUOC (dong tho, KHONG qua transform — audit_log luu
  // nguyen dong nhu shifts.ts/departments.ts) — id la ranh gioi doanh nghiep
  // (T-02-07-04): id la thuoc doanh nghiep khac tu bi loai boi
  // `.eq("company_id", companyId)`, khong lam ca thao tac do.
  interface RawEmployeeRow {
    id: string;
    [key: string]: unknown;
  }

  const { data: beforeRowsData, error: beforeError } = await supabase
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .in("id", ids)
    .eq("company_id", companyId);

  if (beforeError) {
    throw new Error("Không thể chuyển phòng ban.");
  }
  const beforeRows = (beforeRowsData ?? []) as RawEmployeeRow[];
  if (beforeRows.length === 0) return 0;

  const matchedIds = beforeRows.map((row) => row.id);

  const { data: afterRowsData, error: updateError } = await supabase
    .from("employees")
    .update({ department_id: departmentId })
    .in("id", matchedIds)
    .eq("company_id", companyId)
    .select(EMPLOYEE_COLUMNS);

  if (updateError || !afterRowsData) {
    throw new Error("Không thể chuyển phòng ban.");
  }
  const afterRows = afterRowsData as RawEmployeeRow[];
  const afterById = new Map(afterRows.map((row) => [row.id, row]));

  // Mot dong audit CHO MOI nhan vien bi anh huong (T-02-07-05, cam trong
  // <prohibitions> cua 02-07-PLAN.md) — KHONG gop thanh mot dong duy nhat.
  for (const before of beforeRows) {
    const after = afterById.get(before.id);
    if (!after) continue;
    await logMutation({
      companyId,
      actorUserId: userId,
      action: "update",
      entityTable: "employees",
      entityId: before.id,
      before,
      after,
      reason: null,
    });
  }

  return afterRows.length;
}
