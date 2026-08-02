import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
  requireRole,
} from "@/lib/auth/session-context";
import { isSuspiciousPunch, suspiciousMultiplier } from "@/lib/attendance/suspicious";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  attendanceReviewListResponseSchema,
  attendanceReviewQuerySchema,
  attendanceReviewRowSchema,
} from "@/lib/validation/api/attendance-review";

/**
 * Route Handler danh sach "can xem lai" cua quan tri (D-21/ATT-07) — lop
 * PHAT HIEN CHINH cua toan phase sau khi D-20 bien "trong ban kinh" tu dieu
 * kien chan thanh mot ghi chu. Khuon 02-04 (D-12c): chi xuat `dynamic` va
 * `GET`.
 *
 * Co dang ngo duoc TINH TAI THOI DIEM TRUY VAN qua `isSuspiciousPunch()`
 * (doc `SUSPICIOUS_DISTANCE_MULTIPLIER` tu MOT nguon duy nhat,
 * `src/lib/attendance/suspicious.ts`) — KHONG doc tu mot cot boolean da luu
 * san (`supabase/migrations/0011_attendance_evidence.sql` dong 56-60 giai
 * thich vi sao). Khi Phase 4 doi nguong tu hang so sang cau hinh doanh
 * nghiep (D-21a), danh sach nay TU CAP NHAT ma khong can mot lan ghi de hang
 * loat len du lieu lich su.
 *
 * Truy van chia lam HAI buoc thay vi mot embed long ba tang
 * (`attendance_photos -> attendance_records -> employees`): buoc 1 doc
 * `attendance_photos` join `work_sites` (dung khuon da chung minh o
 * `GET /api/attendance-photos`, 03-05); buoc 2 doc `attendance_records` join
 * `employees` CHI cho cac `attendance_record_id` con lai sau buoc 1. Hai
 * embed MOT TANG rieng le it rui ro hon mot embed HAI TANG lien tiep (quan
 * he lien ket phai suy dien dung qua ca hai buoc), va van kiem duoc bang mot
 * chuoi gia lap don gian trong test.
 */
export const dynamic = "force-dynamic";

const REVIEW_PHOTO_COLUMNS =
  "id, attendance_record_id, kind, captured_at, distance_meters, accuracy_meters, review_status, work_sites(name, radius_meters)";

const REVIEW_RECORD_COLUMNS = "id, employee_id, employees(full_name, can_check_in_remotely)";

interface RawWorkSiteJoin {
  name: string;
  radius_meters: number;
}

interface RawReviewPhotoRow {
  id: string;
  attendance_record_id: string;
  kind: "check_in" | "check_out";
  captured_at: string;
  distance_meters: number | null;
  accuracy_meters: number | null;
  review_status: "pending" | "approved" | "rejected";
  work_sites: RawWorkSiteJoin | RawWorkSiteJoin[] | null;
}

interface RawEmployeeJoin {
  full_name: string;
  can_check_in_remotely: boolean;
}

interface RawReviewRecordRow {
  id: string;
  employee_id: string;
  employees: RawEmployeeJoin | RawEmployeeJoin[] | null;
}

function firstOrSelf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { companyId, role } = await getSessionContext();

    // ATT-07: chi quan tri (owner/admin) doc duoc danh sach nay — no gop toa
    // do va khoang cach cua nhieu nhan vien trong mot phan hoi.
    requireRole(role, ["owner", "admin"]);

    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const parsedQuery = attendanceReviewQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Tham số truy vấn không hợp lệ." },
        { status: 400 },
      );
    }
    const { from, to, reviewStatus } = parsedQuery.data;

    const supabase = await createServerSupabase();

    // Buoc 1: doc anh cham cong cua DUNG doanh nghiep phien, bo qua ngay
    // nhung dong chua co khoang cach (distance_meters null nghia la CHUA do
    // duoc — thieu phep do khong phai bang chung cua bat thuong).
    let photoQuery = supabase
      .from("attendance_photos")
      .select(REVIEW_PHOTO_COLUMNS)
      .eq("company_id", companyId)
      .not("distance_meters", "is", null);

    if (from) photoQuery = photoQuery.gte("captured_at", from);
    if (to) photoQuery = photoQuery.lte("captured_at", to);
    if (reviewStatus) photoQuery = photoQuery.eq("review_status", reviewStatus);

    const { data: photoRows, error: photoError } = await photoQuery;
    if (photoError) {
      return NextResponse.json(
        { error: "Không thể tải danh sách cần xem lại." },
        { status: 500 },
      );
    }

    const candidates = (photoRows ?? []) as unknown as RawReviewPhotoRow[];
    if (candidates.length === 0) {
      return NextResponse.json(attendanceReviewListResponseSchema.parse([]));
    }

    // Buoc 2: doc ten nhan vien + canCheckInRemotely CHI cho cac ban ghi cham
    // cong con lai sau buoc 1 -- van dieu kien company_id tu session (khong
    // bao gio tu ket qua buoc 1), phong khi mot lo hong o buoc 1 lot mot
    // attendance_record_id cua doanh nghiep khac.
    const recordIds = Array.from(
      new Set(candidates.map((row) => row.attendance_record_id)),
    );

    const { data: recordRows, error: recordError } = await supabase
      .from("attendance_records")
      .select(REVIEW_RECORD_COLUMNS)
      .eq("company_id", companyId)
      .in("id", recordIds);

    if (recordError) {
      return NextResponse.json(
        { error: "Không thể tải thông tin nhân viên." },
        { status: 500 },
      );
    }

    const employeeByRecordId = new Map<
      string,
      { fullName: string; canCheckInRemotely: boolean }
    >();
    for (const row of (recordRows ?? []) as unknown as RawReviewRecordRow[]) {
      const employee = firstOrSelf(row.employees);
      if (!employee) continue;
      employeeByRecordId.set(row.id, {
        fullName: employee.full_name,
        canCheckInRemotely: employee.can_check_in_remotely,
      });
    }

    const items = candidates
      .map((row) => {
        const workSite = firstOrSelf(row.work_sites);
        const employee = employeeByRecordId.get(row.attendance_record_id);
        // Thieu diem lam viec hoac thieu nhan vien (du lieu khong dong bo) —
        // khong the tinh dang ngo, bo qua dong nay thay vi nem loi ca danh
        // sach.
        if (!workSite || !employee) return null;

        if (
          !isSuspiciousPunch({
            distanceMeters: row.distance_meters,
            radiusMeters: workSite.radius_meters,
            canCheckInRemotely: employee.canCheckInRemotely,
          })
        ) {
          return null;
        }

        return attendanceReviewRowSchema.parse({
          id: row.id,
          attendance_record_id: row.attendance_record_id,
          kind: row.kind,
          captured_at: row.captured_at,
          distance_meters: row.distance_meters,
          accuracy_meters: row.accuracy_meters,
          review_status: row.review_status,
          employee_name: employee.fullName,
          work_site_name: workSite.name,
          multiplier: suspiciousMultiplier(row.distance_meters, workSite.radius_meters) ?? 0,
        });
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      // Thu tu XAC DINH: khoang cach GIAM DAN roi thoi diem GIAM DAN roi
      // dinh danh anh TANG DAN -- de hai lan goi lien tiep cho CUNG mot thu
      // tu, du hai truy van phia tren khong tu bao dam thu tu on dinh.
      .sort((a, b) => {
        if (b.distanceMeters !== a.distanceMeters) {
          return b.distanceMeters - a.distanceMeters;
        }
        if (b.capturedAt !== a.capturedAt) {
          return b.capturedAt.localeCompare(a.capturedAt);
        }
        return a.photoId.localeCompare(b.photoId);
      });

    return NextResponse.json(attendanceReviewListResponseSchema.parse(items));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon duoc doanh nghiep nao -- danh sach rong la du
      // lieu hop le, khong phai loi (dong bo voi GET /api/attendance-photos).
      return NextResponse.json(attendanceReviewListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/attendance/review:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách cần xem lại." },
      { status: 500 },
    );
  }
}
