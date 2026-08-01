import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  employeeListResponseSchema,
  employeeQuerySchema,
  employeeRowSchema,
  paginatedEmployeeSchema,
} from "@/lib/validation/api/employees";

/**
 * Khuon 02-04 (D-12): chi xuat `dynamic` va `GET`.
 *
 * Mot ham GET phuc vu ca hai nhu cau (D-12b: khong tham so nao mang dinh
 * danh doanh nghiep, pham vi luon den tu `getSessionContext()`):
 * - `?mode=all` — danh sach rut gon toan bo nhan vien (dung cho o chon
 *   "quan ly truc tiep", thanh tim kiem tren cung).
 * - Mac dinh (`paged`) — phan trang + bon bo loc + tim kiem bo dau.
 *
 * Tim kiem bo dau: PostgREST khong goi duoc bieu thuc tuy y
 * (`tf_normalize(full_name)`) truc tiep trong `.filter()` tren mot cot
 * thuong, nen phep loc nay di qua RPC `public.tf_search_employee_ids`
 * (migration 0008) tra ve DANH SACH id khop tu khoa — sau do Route Handler
 * dung `.in("id", ids)` tren CUNG mot truy van `.from("employees")` nhu khi
 * khong co tu khoa. Chon huong nay (thay vi chain `.eq()/.order()/.range()`
 * truc tiep len ket qua mot RPC tra ve `setof employees`) de chi co MOT
 * hinh dang builder duy nhat bat ke co tu khoa hay khong.
 */
export const dynamic = "force-dynamic";

interface EmployeeFilters {
  departmentId?: string;
  status?: string;
  contractType?: string;
}

function emptyPaginated(pageSize: number): ReturnType<typeof paginatedEmployeeSchema.parse> {
  return paginatedEmployeeSchema.parse({
    items: [],
    total: 0,
    page: 1,
    pageSize,
    totalPages: 1,
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "all" ? "all" : "paged";

  try {
    const { companyId } = await getSessionContext();
    const supabase = await createServerSupabase();

    if (mode === "all") {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", companyId)
        .order("full_name", { ascending: true })
        .order("id", { ascending: true });

      if (error) {
        return NextResponse.json(
          { error: "Không thể tải danh sách nhân viên." },
          { status: 500 },
        );
      }

      const employees = ((data ?? []) as unknown[]).map((row) =>
        employeeRowSchema.parse(row),
      );
      const parsed = employeeListResponseSchema.parse(employees);
      return NextResponse.json(parsed);
    }

    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const queryParams = employeeQuerySchema.parse(rawQuery);
    const pageSize = queryParams.pageSize ?? DEFAULT_PAGE_SIZE;
    const requestedPage = queryParams.page ?? 1;
    const keyword = queryParams.search?.trim() ? queryParams.search.trim() : null;

    const filters: EmployeeFilters = {
      departmentId:
        queryParams.departmentId && queryParams.departmentId !== "all"
          ? queryParams.departmentId
          : undefined,
      status:
        queryParams.status && queryParams.status !== "all"
          ? queryParams.status
          : undefined,
      contractType:
        queryParams.contractType && queryParams.contractType !== "all"
          ? queryParams.contractType
          : undefined,
    };

    let matchingIds: string[] | null = null;
    if (keyword) {
      const { data: idRows, error: searchError } = await supabase.rpc(
        "tf_search_employee_ids",
        { p_company_id: companyId, p_keyword: keyword },
      );
      if (searchError) {
        return NextResponse.json(
          { error: "Không thể tải danh sách nhân viên." },
          { status: 500 },
        );
      }
      matchingIds = ((idRows ?? []) as Array<{ id: string }>).map((row) => row.id);
      if (matchingIds.length === 0) {
        return NextResponse.json(emptyPaginated(pageSize));
      }
    }

    let countQuery = supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    if (matchingIds) countQuery = countQuery.in("id", matchingIds);
    if (filters.departmentId) countQuery = countQuery.eq("department_id", filters.departmentId);
    if (filters.status) countQuery = countQuery.eq("status", filters.status);
    if (filters.contractType) countQuery = countQuery.eq("contract_type", filters.contractType);

    const { count, error: countError } = await countQuery;
    if (countError) {
      return NextResponse.json(
        { error: "Không thể tải danh sách nhân viên." },
        { status: 500 },
      );
    }

    const total = count ?? 0;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const safePage = Math.min(Math.max(requestedPage, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize - 1;

    let dataQuery = supabase.from("employees").select("*").eq("company_id", companyId);
    if (matchingIds) dataQuery = dataQuery.in("id", matchingIds);
    if (filters.departmentId) dataQuery = dataQuery.eq("department_id", filters.departmentId);
    if (filters.status) dataQuery = dataQuery.eq("status", filters.status);
    if (filters.contractType) dataQuery = dataQuery.eq("contract_type", filters.contractType);
    dataQuery = dataQuery
      .order("full_name", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end);

    const { data, error } = await dataQuery;
    if (error) {
      return NextResponse.json(
        { error: "Không thể tải danh sách nhân viên." },
        { status: 500 },
      );
    }

    const items = ((data ?? []) as unknown[]).map((row) => employeeRowSchema.parse(row));
    const parsed = paginatedEmployeeSchema.parse({
      items,
      total,
      page: safePage,
      pageSize,
      totalPages,
    });
    return NextResponse.json(parsed);
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon duoc doanh nghiep nao -- danh sach nhan vien
      // rong la du lieu hop le, khong phai loi (dong bo voi GET /api/companies).
      if (mode === "all") {
        return NextResponse.json(employeeListResponseSchema.parse([]));
      }
      return NextResponse.json(emptyPaginated(DEFAULT_PAGE_SIZE));
    }
    console.error("Lỗi không xác định ở GET /api/employees:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách nhân viên." },
      { status: 500 },
    );
  }
}
