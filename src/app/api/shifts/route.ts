import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import { shiftListResponseSchema, shiftRowSchema } from "@/lib/validation/api/shifts";

/** Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. */
export const dynamic = "force-dynamic";

const SHIFT_COLUMNS =
  "id, company_id, name, code, start_time, end_time, break_start_time, break_end_time, break_minutes, late_tolerance_minutes, overnight, working_days, status";

interface EmployeeShiftRow {
  shift_id: string;
}

/**
 * `employeeCount` chi dem nhan vien CHUA nghi viec, dung khuon
 * `loadDepartmentsForCompany` (02-05). Sap xep xac dinh theo `start_time`
 * tang dan roi `id` tang dan.
 */
async function loadShiftsForCompany(companyId: string) {
  const supabase = await createServerSupabase();

  const [{ data: shifts, error: shiftsError }, { data: employees, error: employeesError }] =
    await Promise.all([
      supabase
        .from("shifts")
        .select(SHIFT_COLUMNS)
        .eq("company_id", companyId)
        .order("start_time", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("employees")
        .select("shift_id")
        .eq("company_id", companyId)
        .neq("status", "terminated"),
    ]);

  if (shiftsError || employeesError) {
    throw new Error("Không thể tải danh sách ca làm việc.");
  }

  const employeeCountByShift = new Map<string, number>();
  for (const employee of (employees ?? []) as EmployeeShiftRow[]) {
    employeeCountByShift.set(
      employee.shift_id,
      (employeeCountByShift.get(employee.shift_id) ?? 0) + 1,
    );
  }

  return ((shifts ?? []) as unknown[]).map((row) => {
    const shift = shiftRowSchema.parse(row);
    return {
      ...shift,
      employeeCount: employeeCountByShift.get(shift.id) ?? 0,
    };
  });
}

export async function GET(): Promise<NextResponse> {
  try {
    const { companyId } = await getSessionContext();
    const shifts = await loadShiftsForCompany(companyId);
    const parsed = shiftListResponseSchema.parse(shifts);
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
      // lieu hop le, khong phai loi (dong bo voi GET /api/departments).
      return NextResponse.json(shiftListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/shifts:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách ca làm việc." },
      { status: 500 },
    );
  }
}
