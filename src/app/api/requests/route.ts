import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  requestQuerySchema,
  workRequestListResponseSchema,
  workRequestSchema,
} from "@/lib/validation/api/requests";

/**
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. Sap xep theo `created_at`
 * GIAM DAN roi `id` TANG DAN — tiebreaker la BAT BUOC vi seed tao nhieu yeu
 * cau trong cung mot lan chay nen thoi diem tao trung nhau la chuyen thuong
 * (T-02-09-06).
 *
 * Lop quyen (AUTH-03): vai tro `employee`/`manager` hoi `employeeId` khac
 * `employeeId` cua chinh phien bi tu choi (403). Khong truyen `employeeId`
 * thi mac dinh gioi han ve `employeeId` cua chinh phien cho hai vai tro do;
 * `owner`/`admin` thay toan bo doanh nghiep khi khong truyen `employeeId`.
 *
 * NGU CANH NGUOI GUI (plan 05-01): moi phan tu mang them ten nhan vien, ma
 * nhan vien va ten phong ban. Doc bang MOT truy van thu hai tren `employees`
 * chu KHONG bang embed `employees(...)` truc tiep tu `work_requests`: bang do
 * co HAI khoa ngoai tro toi `employees` (`employee_id` va `reviewer_id`) nen
 * PostgREST khong tu suy dien duoc quan he nao duoc nhung — cung ly do da dan
 * toi truy van hai buoc o `GET /api/attendance/review` (03-06).
 */
export const dynamic = "force-dynamic";

const WORK_REQUEST_COLUMNS =
  "id, company_id, employee_id, type, status, from_date, to_date, from_time, to_time, reason, created_at, reviewer_id, review_note";

interface RawDepartmentJoin {
  name: string;
}

interface RawEmployeeContextRow {
  id: string;
  full_name: string;
  code: string;
  departments: RawDepartmentJoin | RawDepartmentJoin[] | null;
}

function firstOrSelf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { companyId, role, employeeId: sessionEmployeeId } =
      await getSessionContext();

    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const queryParams = requestQuerySchema.parse(rawQuery);

    const isAdminRole = role === "owner" || role === "admin";
    if (
      !isAdminRole &&
      queryParams.employeeId &&
      queryParams.employeeId !== sessionEmployeeId
    ) {
      throw new ForbiddenError();
    }

    // Khong truyen employeeId: quan tri thay toan bo doanh nghiep, hai vai
    // tro con lai mac dinh gioi han ve chinh minh (khong phai bo qua loc).
    const effectiveEmployeeId =
      queryParams.employeeId ?? (isAdminRole ? undefined : (sessionEmployeeId ?? undefined));

    const supabase = await createServerSupabase();
    let query = supabase
      .from("work_requests")
      .select(WORK_REQUEST_COLUMNS)
      .eq("company_id", companyId);

    if (effectiveEmployeeId) {
      query = query.eq("employee_id", effectiveEmployeeId);
    }
    if (queryParams.status && queryParams.status !== "all") {
      query = query.eq("status", queryParams.status);
    }

    // Thu tu XAC DINH o ca hai nhanh, tiebreaker `id` la BAT BUOC
    // (T-02-09-06). Chieu sap xep khac nhau vi hai danh sach tra loi hai cau
    // hoi khac nhau:
    //   - `status=pending` la HANG DOI DUYET: nguoi cho lau nhat len truoc,
    //     nen `created_at` TANG DAN. Danh sach duyet xep moi-nhat-truoc se day
    //     nguoi cho lau nhat xuong day va ho se cho tiep.
    //   - moi nhanh con lai la LICH SU (man hinh nhan vien): moi nhat truoc.
    const oldestFirst = queryParams.status === "pending";
    query = query
      .order("created_at", { ascending: oldestFirst })
      .order("id", { ascending: true });

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "Không thể tải danh sách yêu cầu." },
        { status: 500 },
      );
    }

    const items = ((data ?? []) as unknown[]).map((row) =>
      workRequestSchema.parse(row),
    );

    if (items.length === 0) {
      return NextResponse.json(workRequestListResponseSchema.parse([]));
    }

    // Buoc 2: ngu canh nguoi gui. Van dieu kien `company_id` tu phien (khong
    // bao gio tu ket qua buoc 1) — cung khuon phong thu voi 03-06.
    const employeeIds = Array.from(new Set(items.map((item) => item.employeeId)));
    // Goi TEN KHOA NGOAI tuong minh (`departments!employees_department_id_fkey`):
    // giua `employees` va `departments` co HAI quan he — `employees.department_id`
    // (nhieu-mot) va `departments.manager_id` (mot-nhieu) — nen PostgREST khong
    // tu suy dien duoc va tra loi cho ca truy van. Thieu goi ten nay, ngu canh
    // nguoi gui ve `null` HANG LOAT ma khong mot cong nao bao do:
    // `employeeName` la truong `.default(null)`, va man hinh lui ve hien
    // `employeeId`. Kich ban e2e cua 05-06 la thu bat duoc.
    const { data: employeeRows, error: employeeError } = await supabase
      .from("employees")
      .select("id, full_name, code, departments!employees_department_id_fkey(name)")
      .eq("company_id", companyId)
      .in("id", employeeIds);

    if (employeeError) {
      return NextResponse.json(
        { error: "Không thể tải thông tin nhân viên." },
        { status: 500 },
      );
    }

    const contextById = new Map<
      string,
      { employeeName: string; employeeCode: string; departmentName: string | null }
    >();
    for (const row of (employeeRows ?? []) as unknown as RawEmployeeContextRow[]) {
      contextById.set(row.id, {
        employeeName: row.full_name,
        employeeCode: row.code,
        departmentName: firstOrSelf(row.departments)?.name ?? null,
      });
    }

    const enriched = items.map((item) => ({
      ...item,
      // Thieu ngu canh (du lieu khong dong bo) -> null, KHONG bo dong yeu cau
      // ra khoi danh sach: mot yeu cau cho xu ly khong duoc bien mat chi vi
      // ho so nhan vien co van de.
      employeeName: contextById.get(item.employeeId)?.employeeName ?? null,
      employeeCode: contextById.get(item.employeeId)?.employeeCode ?? null,
      departmentName: contextById.get(item.employeeId)?.departmentName ?? null,
    }));

    return NextResponse.json(workRequestListResponseSchema.parse(enriched));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon duoc doanh nghiep nao -- danh sach rong la du
      // lieu hop le, khong phai loi (dong bo voi GET /api/attendance).
      return NextResponse.json(workRequestListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/requests:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách yêu cầu." },
      { status: 500 },
    );
  }
}
