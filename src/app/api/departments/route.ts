import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import { departmentListResponseSchema } from "@/lib/validation/api/departments";
import type { DepartmentStatus } from "@/lib/types/domain";

/** Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. */
export const dynamic = "force-dynamic";

interface DepartmentRow {
  id: string;
  company_id: string;
  name: string;
  description: string;
  manager_id: string | null;
  status: DepartmentStatus;
}

interface EmployeeStatsRow {
  id: string;
  full_name: string;
  department_id: string;
  status: string;
}

/**
 * `employeeCount` chi dem nhan vien chua nghi viec; `managerName` tra theo
 * `manager_id`, `null` neu khong tra duoc (khong loc theo status — mot
 * quan ly da nghi viec van hien thi ten cho toi khi ai do doi lai, dung
 * hanh vi V1 o `mock/service.ts` dong 109-132).
 */
async function loadDepartmentsForCompany(companyId: string) {
  const supabase = await createServerSupabase();

  const [{ data: departments, error: departmentsError }, { data: employees, error: employeesError }] =
    await Promise.all([
      supabase
        .from("departments")
        .select("id, company_id, name, description, manager_id, status")
        .eq("company_id", companyId)
        .order("name", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("employees")
        .select("id, full_name, department_id, status")
        .eq("company_id", companyId),
    ]);

  if (departmentsError || employeesError) {
    throw new Error("Không thể tải danh sách phòng ban.");
  }

  const employeeRows = (employees ?? []) as EmployeeStatsRow[];

  const employeeCountByDepartment = new Map<string, number>();
  const fullNameById = new Map<string, string>();
  for (const employee of employeeRows) {
    fullNameById.set(employee.id, employee.full_name);
    if (employee.status !== "terminated") {
      employeeCountByDepartment.set(
        employee.department_id,
        (employeeCountByDepartment.get(employee.department_id) ?? 0) + 1,
      );
    }
  }

  return ((departments ?? []) as DepartmentRow[]).map((department) => ({
    id: department.id,
    companyId: department.company_id,
    name: department.name,
    description: department.description,
    managerId: department.manager_id,
    status: department.status,
    employeeCount: employeeCountByDepartment.get(department.id) ?? 0,
    managerName: department.manager_id
      ? (fullNameById.get(department.manager_id) ?? null)
      : null,
  }));
}

export async function GET(): Promise<NextResponse> {
  try {
    const { companyId } = await getSessionContext();
    const departments = await loadDepartmentsForCompany(companyId);
    const parsed = departmentListResponseSchema.parse(departments);
    return NextResponse.json(parsed);
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon duoc doanh nghiep nao -- danh sach rong la du
      // lieu hop le, khong phai loi (dong bo voi GET /api/companies).
      return NextResponse.json(departmentListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/departments:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách phòng ban." },
      { status: 500 },
    );
  }
}
