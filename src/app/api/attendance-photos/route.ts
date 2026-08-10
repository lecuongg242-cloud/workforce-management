import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
  requireRole,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  attendancePhotoListResponseSchema,
  attendancePhotoQuerySchema,
  attendancePhotoRowSchema,
} from "@/lib/validation/api/attendance-photos";

/**
 * Route Handler nay CHI tra sieu du lieu (JSON) cua anh cham cong — toa do,
 * khoang cach, do chinh xac, trang thai xem xet. Route co tham so dong nam
 * CUNG thu muc (`[id]/route.ts`) tra byte anh; hai duong nay TUYET DOI khong
 * lam thay nhiem vu cua nhau: route nay khong bao gio tra mot chuoi dan
 * chieu toi mien luu tru nao (T-03-05-04). Khuon 02-04 (D-12c): chi xuat
 * `dynamic` va `GET`.
 */
export const dynamic = "force-dynamic";

/**
 * `storage_path` co mat o day CHI de `attendancePhotoRowSchema` suy ra
 * `hasPhoto` — chinh schema do bo no khoi dau ra, nen no khong di tiep vao
 * phan hoi JSON (T-03-05-04 van nguyen ven).
 */
const PHOTO_COLUMNS =
  "id, company_id, attendance_record_id, kind, captured_at, latitude, longitude, accuracy_meters, work_site_id, distance_meters, review_status, storage_path, work_sites(name)";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { companyId, role } = await getSessionContext();

    // ATT-04: chi quan tri (owner/admin) doc sieu du lieu anh cham cong.
    requireRole(role, ["owner", "admin"]);

    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const parsedQuery = attendancePhotoQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Thiếu tham số bản ghi chấm công." },
        { status: 400 },
      );
    }
    const { attendanceRecordId } = parsedQuery.data;

    const supabase = await createServerSupabase();

    // Kiem tuong minh o TANG UNG DUNG (khuon cu D-12b): .eq("company_id", ...)
    // tu session, khong bao gio tu tham so client. Mot dinh danh ban ghi cua
    // doanh nghiep khac se khong khop dieu kien nay -> mang rong, KHONG PHAI
    // 403 (khong tiet lo id do co ton tai o doanh nghiep khac hay khong).
    const { data, error } = await supabase
      .from("attendance_photos")
      .select(PHOTO_COLUMNS)
      .eq("company_id", companyId)
      .eq("attendance_record_id", attendanceRecordId)
      // 'check_in' < 'check_out' theo thu tu chu cai -- dung de sap xep
      // lan vao truoc lan ra ma khong can mot cot thu tu rieng.
      .order("kind", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Không thể tải siêu dữ liệu ảnh chấm công." },
        { status: 500 },
      );
    }

    const items = ((data ?? []) as unknown[]).map((row) => {
      // Supabase-js khong biet truoc mot-doi-mot hay mot-doi-nhieu cho quan
      // he nen PostgREST embed suy dien kieu mang; work_site_id la khoa
      // ngoai don, thuc te luon la mot dong hoac khong co (giong khuon
      // `getAttendancePhotoForRecord`).
      const record = row as Record<string, unknown> & {
        work_sites?: { name: string }[] | { name: string } | null;
      };
      const workSite = Array.isArray(record.work_sites)
        ? (record.work_sites[0] ?? null)
        : (record.work_sites ?? null);
      return attendancePhotoRowSchema.parse({
        ...record,
        work_site_name: workSite?.name ?? null,
      });
    });

    return NextResponse.json(attendancePhotoListResponseSchema.parse(items));
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
      return NextResponse.json(attendancePhotoListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/attendance-photos:", cause);
    return NextResponse.json(
      { error: "Không thể tải siêu dữ liệu ảnh chấm công." },
      { status: 500 },
    );
  }
}
