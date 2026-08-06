import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
  requireRole,
} from "@/lib/auth/session-context";
import {
  isOutsideShiftWindow,
  isSuspiciousPunch,
  suspiciousMultiplier,
} from "@/lib/attendance/suspicious";
import { loadCompanySettings } from "@/lib/settings/company-settings";
import { createServerSupabase } from "@/lib/supabase/server";
import { toVnTime } from "@/lib/validation/api/attendance";
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
 * Co dang ngo duoc TINH TAI THOI DIEM TRUY VAN qua `isSuspiciousPunch()` —
 * KHONG doc tu mot cot boolean da luu san
 * (`supabase/migrations/0011_attendance_evidence.sql` dong 56-60 giai thich
 * vi sao). Tu plan 04-01 (D-29, dong D-21a) nguong den tu
 * `company_settings.suspicious_distance_multiplier` cua chinh doanh nghiep,
 * khong con tu hang so trong ma — va vi phep tinh dien ra luc truy van, doi
 * nguong lam danh sach nay TU CAP NHAT ma khong can mot lan ghi de hang loat
 * len du lieu lich su.
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

interface RawShiftJoin {
  name: string;
  start_time: string;
  end_time: string;
}

interface RawOutsideShiftRow {
  id: string;
  employee_id: string;
  check_in_at: string | null;
  employees: RawEmployeeJoin | RawEmployeeJoin[] | null;
  shifts: RawShiftJoin | RawShiftJoin[] | null;
}

/** `time` cua Postgres ve dang "HH:mm:ss" — danh sach nay chi can "HH:mm". */
function toHourMinute(time: string): string {
  return time.slice(0, 5);
}

/**
 * Cac luot cham cong NGOAI khung gio ca duoc phan.
 *
 * Tinh TAI THOI DIEM TRUY VAN tu `check_in_at` + gio ca, KHONG doc mot cot
 * boolean da luu san — cung ly do voi co dang ngo theo khoang cach: khi bien
 * do doi (Phase 4 dua no vao cau hinh doanh nghiep) thi danh sach tu cap
 * nhat, khong can ghi de hang loat len du lieu lich su.
 *
 * Anh cham cong CHI de gan dinh danh cho dong hien thi. Luot khong co anh
 * (du lieu truoc Phase 3) van vao danh sach, dung chinh id ban ghi lam khoa —
 * mot lan cham sai khung gio khong duoc bien mat chi vi thieu anh.
 */
async function collectOutsideShiftItems({
  supabase,
  companyId,
  from,
  to,
  graceMinutes,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  companyId: string;
  from?: string;
  to?: string;
  /** `company_settings.shift_window_grace_minutes` cua chinh doanh nghiep nay (D-29) */
  graceMinutes: number;
}) {
  let query = supabase
    .from("attendance_records")
    .select(
      "id, employee_id, check_in_at, employees(full_name, can_check_in_remotely), shifts(name, start_time, end_time)",
    )
    .eq("company_id", companyId)
    .not("check_in_at", "is", null);

  if (from) query = query.gte("check_in_at", from);
  if (to) query = query.lte("check_in_at", to);

  const { data, error } = await query;
  if (error) return [];

  const rows = (data ?? []) as unknown as RawOutsideShiftRow[];
  const outsideRows = rows.filter((row) => {
    const shift = firstOrSelf(row.shifts);
    // Dong thieu gio cham hoac thieu ca la du lieu khong dong bo — bo qua
    // dong do thay vi nem loi ca danh sach, cung khuon voi buoc loc o tren.
    // `toVnTime` nem RangeError neu nhan mot gia tri khong phai dau thoi
    // gian, nen phai chan TRUOC khi goi chu khong bat loi sau.
    if (!shift || typeof row.check_in_at !== "string") return false;
    const punchTime = toVnTime(row.check_in_at);
    if (!punchTime) return false;
    return isOutsideShiftWindow({
      punchTime,
      shiftStartTime: toHourMinute(shift.start_time),
      shiftEndTime: toHourMinute(shift.end_time),
      graceMinutes,
    });
  });
  if (outsideRows.length === 0) return [];

  // Anh cua lan VAO cho tung ban ghi con lai — mot truy van duy nhat, khong
  // hoi tung dong mot.
  const { data: photoRows } = await supabase
    .from("attendance_photos")
    .select("id, attendance_record_id, review_status, accuracy_meters")
    .eq("company_id", companyId)
    .eq("kind", "check_in")
    .in(
      "attendance_record_id",
      outsideRows.map((row) => row.id),
    );

  const photoByRecordId = new Map(
    (
      (photoRows ?? []) as Array<{
        id: string;
        attendance_record_id: string;
        review_status: "pending" | "approved" | "rejected";
        accuracy_meters: number | null;
      }>
    ).map((row) => [row.attendance_record_id, row]),
  );

  return outsideRows
    .map((row) => {
      const shift = firstOrSelf(row.shifts);
      const employee = firstOrSelf(row.employees);
      if (!shift || !employee || !row.check_in_at) return null;

      const photo = photoByRecordId.get(row.id);
      return attendanceReviewRowSchema.parse({
        // Khong co anh thi dung id ban ghi lam khoa hien thi — van duy nhat.
        id: photo?.id ?? row.id,
        attendance_record_id: row.id,
        kind: "check_in" as const,
        captured_at: row.check_in_at,
        reason: "outside_shift" as const,
        distance_meters: null,
        accuracy_meters: photo?.accuracy_meters ?? null,
        review_status: photo?.review_status ?? "pending",
        employee_name: employee.full_name,
        work_site_name: null,
        multiplier: null,
        punch_time: toVnTime(row.check_in_at),
        shift_window: `${shift.name} ${toHourMinute(shift.start_time)}–${toHourMinute(shift.end_time)}`,
      });
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
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

    // D-29 (dong D-21a): CA HAI nguong cua danh sach nay den tu cau hinh cua
    // chinh doanh nghiep, khong tu hang so trong ma. Vi ca dang ngo lan ngoai
    // khung gio deu duoc TINH TAI THOI DIEM TRUY VAN (khong luu cot boolean
    // nao — migration 0011 dong 56-60), doi nguong o `/admin/settings` lam
    // danh sach nay tu cap nhat ngay lan tai ke tiep, khong can mot lan ghi
    // de hang loat len du lieu lich su.
    const settings = await loadCompanySettings(companyId);

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
            multiplier: settings.suspiciousDistanceMultiplier,
          })
        ) {
          return null;
        }

        return attendanceReviewRowSchema.parse({
          id: row.id,
          attendance_record_id: row.attendance_record_id,
          kind: row.kind,
          captured_at: row.captured_at,
          reason: "far_from_site",
          distance_meters: row.distance_meters,
          accuracy_meters: row.accuracy_meters,
          review_status: row.review_status,
          employee_name: employee.fullName,
          work_site_name: workSite.name,
          multiplier:
            suspiciousMultiplier(row.distance_meters, workSite.radius_meters) ?? 0,
          punch_time: null,
          shift_window: null,
        });
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const outsideShiftItems = await collectOutsideShiftItems({
      supabase,
      companyId,
      from,
      to,
      graceMinutes: settings.shiftWindowGraceMinutes,
    });

    // Mot luot vua o xa VUA sai khung gio chi hien MOT dong (uu tien khoang
    // cach — tin hieu manh hon), khong nhan doi trong danh sach.
    const seenRecordIds = new Set(items.map((item) => item.attendanceRecordId));
    const allItems = [
      ...items,
      ...outsideShiftItems.filter(
        (item) => !seenRecordIds.has(item.attendanceRecordId),
      ),
    ]
      // Thu tu XAC DINH: khoang cach GIAM DAN (dong khong co khoang cach xep
      // sau) roi thoi diem GIAM DAN roi dinh danh anh TANG DAN -- de hai lan
      // goi lien tiep cho CUNG mot thu tu, du cac truy van phia tren khong tu
      // bao dam thu tu on dinh.
      .sort((a, b) => {
        const distanceA = a.distanceMeters ?? -1;
        const distanceB = b.distanceMeters ?? -1;
        if (distanceB !== distanceA) return distanceB - distanceA;
        if (b.capturedAt !== a.capturedAt) {
          return b.capturedAt.localeCompare(a.capturedAt);
        }
        return a.photoId.localeCompare(b.photoId);
      });

    return NextResponse.json(attendanceReviewListResponseSchema.parse(allItems));
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
