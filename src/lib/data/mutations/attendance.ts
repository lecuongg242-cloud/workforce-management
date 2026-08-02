"use server";

import { randomUUID } from "node:crypto";

import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { AttendanceRejectedError } from "@/lib/attendance/rejection";
import { SUSPICIOUS_DISTANCE_MULTIPLIER } from "@/lib/attendance/suspicious";
import { logMutation } from "@/lib/data/audit";
import { ATTENDANCE_PHOTO_BUCKET, buildAttendancePhotoPath } from "@/lib/storage/attendance-photos";
import { createServerSupabase } from "@/lib/supabase/server";
import { attendanceRecordSchema } from "@/lib/validation/api/attendance";
import { punchEvidenceSchema } from "@/lib/validation/api/attendance-photos";
import type { AttendanceRecord, PunchEvidence } from "@/lib/types/domain";

const ATTENDANCE_COLUMNS =
  "id, company_id, employee_id, work_date, shift_id, check_in_at, check_out_at, worked_minutes, late_minutes, early_leave_minutes, status, location, needs_supplement, note";

interface RawAttendanceRow {
  id: string;
  employee_id: string;
  work_date: string;
  shift_id: string;
  check_in_at: string | null;
  status: string;
  [key: string]: unknown;
}

interface RawShiftRow {
  id: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  late_tolerance_minutes: number;
}

interface RawWorkSiteRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

/**
 * Ket qua bang chung (khoang cach + ten diem lam viec gan nhat + co danh
 * dau dang ngo) dung chung cho CA HAI dau cua mot ca — `CheckInResult` va
 * `CheckOutResult` deu la `AttendanceRecord` cong ba truong nay (plan 03-03
 * Task 3 cho lan vao, 03-04 Task 2 cho lan ra) de man hinh nhan vien dung
 * DUNG du lieu server da tinh cho banner "da ghi nhan nhung o xa" (D-20) —
 * khong tu doan/gia dinh o client.
 */
interface PunchEvidenceResult {
  distanceMeters: number | null;
  workSiteName: string | null;
  isOutsideRadius: boolean;
}

export interface CheckInResult extends AttendanceRecord, PunchEvidenceResult {}

/**
 * Ket qua checkOut (plan 03-04, Task 2) — cung hinh dang voi `CheckInResult`
 * nhung do DOC LAP cho lan RA: khoang cach/diem lam viec cua lan vao KHONG
 * duoc chep sang day, ham dung chung `writePunchEvidence()` ben duoi luon do
 * lai tu toa do cua CHINH lan goi.
 */
export interface CheckOutResult extends AttendanceRecord, PunchEvidenceResult {}

/**
 * D-21/03-06: nguong danh dau dang ngo (mac dinh 5 lan ban kinh work_site)
 * gio DUNG chung mot nguon voi danh sach "can xem lai" cua quan tri —
 * `src/lib/attendance/suspicious.ts` la noi so huu CHINH THUC DUY NHAT cua
 * hang so nay trong toan repo. File nay CHI import lai de tinh banner tuc
 * thi (`isOutsideRadius`) ngay sau khi cham cong; KHONG con tu khai mot ban
 * sao cuc bo nua (ban sao cu cua 03-01/03-03 da bi go — nguon dung chung
 * moi dam bao Phase 4 chi doi nguong o MOT noi khi chuyen sang cau hinh
 * doanh nghiep, xem comment tai dinh nghia hang so).
 */

/**
 * D-20b/T-03-04-01: biên độ nới rộng hai đầu khung giờ ca khi kiểm "ngoài
 * giờ ca làm" — CÓ CHỦ ĐÍCH rộng, không phải một hằng số tuỳ ý: một hệ thống
 * từ chối người đến sớm mười phút là một hệ thống người ta sẽ tìm cách đi
 * vòng. 120 phút (hai giờ) đủ rộng để không chặn nhầm người đến chuẩn bị
 * sớm hay còn nán lại xử lý việc cuối ca, nhưng vẫn từ chối được người chấm
 * công ở một khung giờ hoàn toàn khác ca được phân.
 */
const SHIFT_WINDOW_GRACE_MINUTES = 120;

/**
 * Cộng một số phút (có thể âm) vào một khoảnh khắc ISO để ra một khoảnh khắc
 * mới — phép cộng EPOCH ĐƠN THUẦN (không phải một quy ước múi giờ thứ hai).
 * Dùng CHUNG cho mọi nơi trong file này cần tính THỜI ĐIỂM KẾT THÚC CA THEO
 * KẾ HOẠCH (checkOut, tính về sớm) hoặc NỚI BIÊN ĐỘ khung giờ ca (checkIn,
 * kiểm ngoài ca) — CHỈ một dòng `new Date(` duy nhất trong toàn file, xem
 * acceptance criteria của 03-04-PLAN.md Task 1.
 */
function addMinutesToInstant(instantIso: string, minutes: number): string {
  return new Date(new Date(instantIso).getTime() + minutes * 60_000).toISOString();
}

interface RawAttendancePhotoRow {
  id: string;
  attendance_record_id: string;
  kind: string;
  [key: string]: unknown;
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>;

interface WritePunchEvidenceInput {
  supabase: ServerSupabaseClient;
  companyId: string;
  employeeId: string;
  actorUserId: string;
  attendanceRecordId: string;
  kind: "check_in" | "check_out";
  /** tf_server_now() cua CHINH lan goi nay -- KHONG dung lai gia tri cua lan cham truoc. */
  nowIso: string;
  punchEvidence: PunchEvidence;
}

/**
 * Ghi bang chung (anh + toa do + khoang cach do TAI CHO) cho MOT lan cham —
 * dung CHUNG cho ca `checkIn` (`kind: "check_in"`) lan `checkOut`
 * (`kind: "check_out"`, plan 03-04 Task 2) thay vi hai ham gan giong het
 * nhau (03-01 chi dung cho lan vao). Thu tu: doc `work_sites` dang hoat
 * dong -> do khoang cach TOI TUNG diem qua `tf_distance_meters()` -> giu
 * diem GAN NHAT -> tai anh len Storage -> doc-truoc-insert-hoac-update DUNG
 * MOT dong `attendance_photos` theo (`attendance_record_id`, `kind`) ->
 * `logMutation` rieng cho bang anh. KHONG CO NHANH NAO so sanh khoang cach
 * roi nem loi — ngoai ban kinh la mot ghi chu duoc chap nhan (D-20/D-20a),
 * khong phai dieu kien chan, o CA HAI phia goi ham nay.
 *
 * Goi ham nay tinh khoang cach DOC LAP moi lan — khong nhan mot gia tri
 * khoang cach da tinh san tu ben ngoai, nen gia tri cua lan vao khong bao
 * gio chep duoc sang lan ra (T-03-04-04).
 */
async function writePunchEvidence({
  supabase,
  companyId,
  employeeId,
  actorUserId,
  attendanceRecordId,
  kind,
  nowIso,
  punchEvidence,
}: WritePunchEvidenceInput): Promise<PunchEvidenceResult> {
  const { data: workSiteRows, error: workSitesError } = await supabase
    .from("work_sites")
    .select("id, name, latitude, longitude, radius_meters")
    .eq("company_id", companyId)
    .eq("is_active", true);
  if (workSitesError) {
    throw new Error("Không thể tải danh sách điểm làm việc.");
  }

  let nearestWorkSiteId: string | null = null;
  let nearestWorkSiteName: string | null = null;
  let nearestWorkSiteRadiusMeters: number | null = null;
  let nearestDistanceMeters: number | null = null;
  for (const site of (workSiteRows ?? []) as RawWorkSiteRow[]) {
    const { data: distance, error: distanceError } = await supabase.rpc(
      "tf_distance_meters",
      {
        p_lat1: punchEvidence.latitude,
        p_lng1: punchEvidence.longitude,
        p_lat2: site.latitude,
        p_lng2: site.longitude,
      },
    );
    if (distanceError || distance === null) {
      throw new Error("Không thể tính khoảng cách tới điểm làm việc.");
    }
    if (nearestDistanceMeters === null || (distance as number) < nearestDistanceMeters) {
      nearestDistanceMeters = distance as number;
      nearestWorkSiteId = site.id;
      nearestWorkSiteName = site.name;
      nearestWorkSiteRadiusMeters = site.radius_meters;
    }
  }

  // D-21: danh dau dang ngo khi khoang cach vuot NGUONG (5 lan ban kinh mac
  // dinh), khong phai vuot ban kinh tran (D-20a: "trong ban kinh" tu dieu
  // kien bat buoc thanh ghi chu). CHI dung de quyet dinh banner tuc thi o
  // day — KHONG chan cham cong o bat ky nhanh nao (D-20).
  const isOutsideRadius =
    nearestWorkSiteId !== null &&
    nearestDistanceMeters !== null &&
    nearestWorkSiteRadiusMeters !== null &&
    nearestDistanceMeters > nearestWorkSiteRadiusMeters * SUSPICIOUS_DISTANCE_MULTIPLIER;

  // T-03-06/ATT-01: anh chi den tu khung hinh truc tiep (Blob dung canh
  // duoc kiem boi punchEvidenceSchema) — khong co duong nao khac de doc
  // duoc mot Blob tai day. photoId la uuid, KHONG PHAI so thu tu, de khong
  // ai liet ke duoc anh bang cach doan URL.
  const photoId = randomUUID();
  const storagePath = buildAttendancePhotoPath({
    companyId,
    employeeId,
    photoId,
    kind,
  });

  const { error: uploadError } = await supabase.storage
    .from(ATTENDANCE_PHOTO_BUCKET)
    .upload(storagePath, punchEvidence.photo, {
      contentType: punchEvidence.photo.type,
      upsert: false,
    });
  if (uploadError) {
    // Tai len that bai thi KHONG duoc de lai mot dong attendance_photos mo
    // coi — dong do chi duoc ghi SAU buoc nay, nen khong ghi gi ca la dung.
    throw new Error("Không thể tải ảnh chấm công lên máy chủ.");
  }

  // Cham vao lan thu hai trong cung (attendance_record_id, kind) cap nhat
  // dong dang co thay vi tao dong thu hai — rang buoc `unique` cua database
  // la lop hai, cung khuon doc-truoc-insert-hoac-update nhu attendance_records.
  const { data: existingPhoto, error: existingPhotoError } = await supabase
    .from("attendance_photos")
    .select("id")
    .eq("attendance_record_id", attendanceRecordId)
    .eq("kind", kind)
    .eq("company_id", companyId)
    .maybeSingle();
  if (existingPhotoError) {
    throw new Error("Không thể kiểm tra ảnh chấm công.");
  }

  const photoWriteRow = {
    captured_at: nowIso,
    latitude: punchEvidence.latitude,
    longitude: punchEvidence.longitude,
    accuracy_meters: punchEvidence.accuracyMeters,
    work_site_id: nearestWorkSiteId,
    distance_meters: nearestDistanceMeters,
  };

  let photoRow: RawAttendancePhotoRow;
  let photoAuditAction: "insert" | "update";

  if (existingPhoto) {
    photoAuditAction = "update";
    const { data: updatedPhoto, error: updatePhotoError } = await supabase
      .from("attendance_photos")
      .update({ storage_path: storagePath, ...photoWriteRow })
      .eq("id", (existingPhoto as { id: string }).id)
      .eq("company_id", companyId)
      .select()
      .single();
    if (updatePhotoError || !updatedPhoto) {
      throw new Error("Không thể ghi nhận ảnh chấm công.");
    }
    photoRow = updatedPhoto as RawAttendancePhotoRow;
  } else {
    photoAuditAction = "insert";
    const { data: insertedPhoto, error: insertPhotoError } = await supabase
      .from("attendance_photos")
      .insert({
        id: photoId,
        company_id: companyId,
        attendance_record_id: attendanceRecordId,
        kind,
        storage_path: storagePath,
        ...photoWriteRow,
      })
      .select()
      .single();
    if (insertPhotoError || !insertedPhoto) {
      throw new Error("Không thể ghi nhận ảnh chấm công.");
    }
    photoRow = insertedPhoto as RawAttendancePhotoRow;
  }

  // D-18a: `after` chi la duong dan va sieu du lieu cua dong attendance_photos
  // vua ghi — TUYET DOI khong phai byte anh hay chuoi base64 cua anh.
  await logMutation({
    companyId,
    actorUserId,
    action: photoAuditAction,
    entityTable: "attendance_photos",
    entityId: photoRow.id,
    before: null,
    after: photoRow,
    reason: null,
  });

  return {
    distanceMeters: nearestDistanceMeters,
    workSiteName: nearestWorkSiteName,
    isOutsideRadius,
  };
}

/**
 * ATT-06 (plan 03-04, Task 2) HOAN TAT: chu ky khong con tham so thoi gian
 * nao. Phase 2 (02-08) va Phase 3 (03-01) tam giu `companyId`/`date`/`time`
 * de call site cu khong phai sua truoc khi task lien quan chay — khoi comment
 * do da bi xoa cung voi cac tham so; xem lich su git neu can doi chieu.
 *
 * DAU THOI GIAN VA NGAY CONG DEU DO SERVER CAP, khong bao gio den tu tham so
 * client (D-19). Moi phep tinh thoi gian (do muon, ve som, so phut lam viec)
 * di qua RPC cua Phase 1 (`tf_work_date`, `tf_worked_minutes`,
 * `tf_shift_minutes`) va RPC cua migration 0010 (`tf_server_now`,
 * `tf_local_instant`) — KHONG bao gio tu tinh gio-tru-gio o tang ung dung.
 *
 * `evidence` la OPTIONAL O MUC KIEU (khong phai o muc hanh vi), tiep tuc ke
 * thua chinh xac quyet dinh cua 03-01 cho `checkIn` va ap dung lai cho
 * `checkOut`: `attendance-status-card.tsx`/`employee-home-view.tsx` (Task 3,
 * chua chay o thoi diem Task 2) van con goi `checkOutService(recordId, time)`
 * voi mot chuoi o vi tri tham so thu hai — Task 2 sua RIENG loi goi do thanh
 * `checkOutService(recordId)` (bo tham so `time` da bi xoa, KHONG truyen gia
 * tri sai kieu) de `npm run typecheck` xanh ngay sau Task 2 ma khong phai
 * noi day Camera Sheet vao luong tan ca truoc thoi han (viec do la cua
 * Task 3). VE HANH VI, `evidence` la BAT BUOC: thieu no (undefined hoac
 * khong qua duoc `punchEvidenceSchema`) nem `AttendanceRejectedError`
 * ("missing_photo") TRUOC KHI cham Storage hay ghi bat ky dong nao.
 *
 * D-20b: dung DUNG BA ly do tu choi ma server tu quyet duoc — `missing_photo`
 * (thieu bang chung), `outside_shift` (cham cong ngoai khung gio ca duoc
 * phan, xem `SHIFT_WINDOW_GRACE_MINUTES`; `checkOut` con dung lai phan loai
 * nay cho truong hop "chua co gio vao") — cong `network_error` la phan loai
 * DUY NHAT client tu quyet khi loi vang KHONG mang truong `reason` hop le.
 * KHONG CO LY DO THU TU: khoang cach vuot ban kinh KHONG BAO GIO la mot ly
 * do tu choi (D-20/D-20a) o bat ky nhanh nao trong file nay.
 */
export async function checkIn(
  employeeId: string,
  evidence?: PunchEvidence,
): Promise<CheckInResult> {
  const {
    companyId: activeCompanyId,
    userId,
    role,
    employeeId: sessionEmployeeId,
  } = await getSessionContext();

  // AUTH-03: employee/manager chi cham cong duoc cho CHINH MINH; owner/admin
  // cham duoc cho moi nhan vien trong doanh nghiep. Chay TRUOC moi thao tac
  // I/O (khuon da chung minh o updateEmployee, 02-07).
  const isAdminRole = role === "owner" || role === "admin";
  if (!isAdminRole && employeeId !== sessionEmployeeId) {
    throw new ForbiddenError();
  }

  // ATT-01/T-03-06: khong co bang chung hop le thi tu choi NGAY, TRUOC khi
  // cham Storage hay ghi bat ky dong nao (kiem tra re nhat, chay som nhat).
  const evidenceResult = punchEvidenceSchema.safeParse(evidence);
  if (!evidenceResult.success) {
    throw new AttendanceRejectedError("missing_photo");
  }
  const punchEvidence = evidenceResult.data;

  const supabase = await createServerSupabase();

  // D-19: check_in_at LUON la dong ho cua database (tf_server_now()), khong
  // bao gio la mot tham so tu client.
  const { data: nowIso, error: nowError } = await supabase.rpc("tf_server_now");
  if (nowError || !nowIso) {
    throw new Error("Không thể xác định thời gian máy chủ.");
  }

  const { data: workDate, error: workDateError } = await supabase.rpc(
    "tf_work_date",
    { p_instant: nowIso },
  );
  if (workDateError || !workDate) {
    throw new Error("Không thể xác định ngày công.");
  }

  const { data: employeeRow, error: employeeError } = await supabase
    .from("employees")
    .select("id, shift_id, work_location")
    .eq("id", employeeId)
    .eq("company_id", activeCompanyId)
    .maybeSingle();
  if (employeeError || !employeeRow) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const { data: shiftRow, error: shiftError } = await supabase
    .from("shifts")
    .select("id, start_time, end_time, break_minutes, late_tolerance_minutes")
    .eq("id", employeeRow.shift_id as string)
    .eq("company_id", activeCompanyId)
    .maybeSingle();
  if (shiftError || !shiftRow) {
    throw new Error("Nhân viên chưa được gán ca làm việc.");
  }
  const shift = shiftRow as RawShiftRow;

  const { data: scheduledStart, error: scheduledStartError } = await supabase.rpc(
    "tf_local_instant",
    { p_date: workDate, p_time: shift.start_time },
  );
  if (scheduledStartError || !scheduledStart) {
    throw new Error("Không thể tính thời gian bắt đầu ca.");
  }

  // T-03-04-01/D-20b: cham cong NGOAI khung gio ca duoc phan (cong bien do
  // SHIFT_WINDOW_GRACE_MINUTES hai dau) bi tu choi. Dung LAI dung khuon
  // checkOut hien co dang dung de tinh ve som: tf_shift_minutes() cho so
  // phut TRON CA (da xu ly wrap qua nua dem cho ca qua dem, D-08 — khong tu
  // tinh lai phep tru gio o day), cong vao scheduledStart bang
  // addMinutesToInstant() de ra thoi diem KET THUC CA THEO KE HOACH.
  const { data: rawShiftMinutesForWindow, error: shiftMinutesForWindowError } =
    await supabase.rpc("tf_shift_minutes", {
      p_start: shift.start_time,
      p_end: shift.end_time,
      p_break_minutes: 0,
    });
  if (shiftMinutesForWindowError || rawShiftMinutesForWindow === null) {
    throw new Error("Không thể tính thời lượng ca.");
  }
  const scheduledEndForWindow = addMinutesToInstant(
    scheduledStart as string,
    rawShiftMinutesForWindow as number,
  );
  const windowStart = addMinutesToInstant(
    scheduledStart as string,
    -SHIFT_WINDOW_GRACE_MINUTES,
  );
  const windowEnd = addMinutesToInstant(
    scheduledEndForWindow,
    SHIFT_WINDOW_GRACE_MINUTES,
  );
  // So sanh chuoi ISO8601 (khong phai so sanh Date) — hop le vi ca ba gia
  // tri deu la timestamptz cung mot dinh dang tu Postgres/PostgREST (cung do
  // rong truong nam-thang-ngay-gio-phut-giay, phan phan-so-giay neu co chi
  // lam chuoi DAI HON chu khong lam sai thu tu). Tranh them mot dong
  // `new Date(` moi ngoai `addMinutesToInstant()` (xem acceptance criteria).
  if ((nowIso as string) < windowStart || (nowIso as string) > windowEnd) {
    throw new AttendanceRejectedError("outside_shift");
  }

  // Do muon = hieu (check_in_at - gio bat dau ca THEO KE HOACH), tinh tren
  // TIMESTAMPTZ THAT qua tf_worked_minutes — den som tu dong ve 0 (khong can
  // nguong chan 720 phut nhu tang gia lap, vi day la hieu tuyet doi giua hai
  // khoanh khac, khong phai phep tru gio-trong-ngay co the wrap quanh nua
  // dem).
  const { data: lateRaw, error: lateError } = await supabase.rpc(
    "tf_worked_minutes",
    { p_check_in: scheduledStart, p_check_out: nowIso, p_break_minutes: 0 },
  );
  if (lateError || lateRaw === null) {
    throw new Error("Không thể tính số phút đi muộn.");
  }
  const lateMinutes = Math.max((lateRaw as number) - shift.late_tolerance_minutes, 0);
  const status: AttendanceRecord["status"] = lateMinutes > 0 ? "late" : "on_time";

  // Cham vao lan thu hai trong cung (employee_id, work_date, shift_id) cap
  // nhat ban ghi dang co thay vi tao dong thu hai — rang buoc `unique` cua
  // database la lop hai.
  const { data: existing, error: existingError } = await supabase
    .from("attendance_records")
    .select(ATTENDANCE_COLUMNS)
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .eq("shift_id", shift.id)
    .eq("company_id", activeCompanyId)
    .maybeSingle();
  if (existingError) {
    throw new Error("Không thể kiểm tra bản ghi chấm công.");
  }

  // CR-01 (03-REVIEW.md): mot ca DA hoan tat (check_out_at khac null) khong
  // duoc phep "vao lai" — writeRow ben duoi luon dat check_out_at/worked_minutes/
  // early_leave_minutes ve gia tri rong, nen ap dung no len mot ban ghi da
  // tan ca se XOA bang chung tan ca da ghi (anh, so phut lam viec, ve som).
  // Day khong phai mot ly do tu choi thu tu (D-20b khoa dung BA ly do) ma la
  // AP DUNG LAI `outside_shift`, cung khuon voi checkOut tai su dung
  // `outside_shift` cho ban ghi chua co gio vao (xem nhanh `!beforeRow.check_in_at`
  // trong checkOut ben duoi): mot ca da ket thuc cung la mot dang "ngoai
  // khung gio ca" theo nghia rong.
  if (existing && (existing as RawAttendanceRow).check_out_at) {
    throw new AttendanceRejectedError("outside_shift");
  }

  const writeRow = {
    check_in_at: nowIso,
    check_out_at: null,
    worked_minutes: 0,
    late_minutes: lateMinutes,
    early_leave_minutes: 0,
    status,
    location: employeeRow.work_location as string,
    needs_supplement: false,
    note: null,
  };

  let resultRow: RawAttendanceRow;
  let auditAction: "insert" | "update";
  let before: unknown = null;

  if (existing) {
    auditAction = "update";
    before = existing;
    const { data: updated, error: updateError } = await supabase
      .from("attendance_records")
      .update(writeRow)
      .eq("id", (existing as RawAttendanceRow).id)
      .eq("company_id", activeCompanyId)
      .select(ATTENDANCE_COLUMNS)
      .single();
    if (updateError || !updated) {
      throw new Error("Không thể ghi nhận giờ vào ca.");
    }
    resultRow = updated as RawAttendanceRow;
  } else {
    auditAction = "insert";
    const id = randomUUID();
    const { data: inserted, error: insertError } = await supabase
      .from("attendance_records")
      .insert({
        id,
        company_id: activeCompanyId,
        employee_id: employeeId,
        work_date: workDate,
        shift_id: shift.id,
        ...writeRow,
      })
      .select(ATTENDANCE_COLUMNS)
      .single();
    if (insertError || !inserted) {
      throw new Error("Không thể ghi nhận giờ vào ca.");
    }
    resultRow = inserted as RawAttendanceRow;
  }

  await logMutation({
    companyId: activeCompanyId,
    actorUserId: userId,
    action: auditAction,
    entityTable: "attendance_records",
    entityId: resultRow.id,
    before,
    after: resultRow,
    reason: null,
  });

  // ATT-02/ATT-07/D-20/D-20a: khoang cach do SERVER tinh qua
  // writePunchEvidence() (goi tf_distance_meters() ben trong), khong bao gio
  // nhan tu tham so client. Doanh nghiep chua khai diem lam viec nao van cham
  // cong duoc — writePunchEvidence() tra ca ba gia tri de null va di tiep.
  const photoResult = await writePunchEvidence({
    supabase,
    companyId: activeCompanyId,
    employeeId,
    actorUserId: userId,
    attendanceRecordId: resultRow.id,
    kind: "check_in",
    nowIso: nowIso as string,
    punchEvidence,
  });

  return {
    ...attendanceRecordSchema.parse(resultRow),
    ...photoResult,
  };
}

export async function checkOut(
  recordId: string,
  evidence?: PunchEvidence,
): Promise<CheckOutResult> {
  const { companyId, userId, role, employeeId: sessionEmployeeId } =
    await getSessionContext();

  const supabase = await createServerSupabase();

  const { data: beforeRowData, error: beforeError } = await supabase
    .from("attendance_records")
    .select(ATTENDANCE_COLUMNS)
    .eq("id", recordId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeRowData) {
    throw new Error("Không tìm thấy bản ghi chấm công.");
  }
  const beforeRow = beforeRowData as RawAttendanceRow;

  // AUTH-03: employee/manager chi tan ca duoc cho CHINH MINH -- `checkOut`
  // khong nhan `employeeId` lam tham so, chu the duoc suy tu chinh ban ghi
  // vua doc. Chay TRUOC moi thao tac Storage (T-03-04-03: mot lan tai anh
  // len roi moi phat hien khong co quyen la mot tep rac vinh vien, D-22
  // khong co job don).
  const isAdminRole = role === "owner" || role === "admin";
  if (!isAdminRole && beforeRow.employee_id !== sessionEmployeeId) {
    throw new ForbiddenError();
  }

  // ATT-01/T-03-06: khong co bang chung hop le thi tu choi NGAY, TRUOC khi
  // cham Storage hay ghi bat ky dong nao — cung khuon voi checkIn.
  const evidenceResult = punchEvidenceSchema.safeParse(evidence);
  if (!evidenceResult.success) {
    throw new AttendanceRejectedError("missing_photo");
  }
  const punchEvidence = evidenceResult.data;

  // D-20b/T-03-04: tan ca cho mot ban ghi CHUA co gio vao khong phai mot
  // trang thai du lieu hop le de tinh tiep — day khong phai mot ly do tu
  // choi thu tu, ma la ap dung LAI `outside_shift` (D-20b chi cho dung ba ly
  // do, khong duoc bia them): "chua bat dau ca" cung la mot dang "ngoai
  // khung gio ca" theo nghia rong.
  if (!beforeRow.check_in_at) {
    throw new AttendanceRejectedError("outside_shift");
  }

  const { data: shiftRow, error: shiftError } = await supabase
    .from("shifts")
    .select("id, start_time, end_time, break_minutes, late_tolerance_minutes")
    .eq("id", beforeRow.shift_id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (shiftError || !shiftRow) {
    throw new Error("Nhân viên chưa được gán ca làm việc.");
  }
  const shift = shiftRow as RawShiftRow;

  // D-19/ATT-06: check_out_at LUON la dong ho cua database (tf_server_now()
  // cua CHINH lan goi nay), khong bao gio mot tham so tu client.
  const { data: nowIso, error: nowError } = await supabase.rpc("tf_server_now");
  if (nowError || !nowIso) {
    throw new Error("Không thể xác định thời gian máy chủ.");
  }

  const { data: workedMinutes, error: workedError } = await supabase.rpc(
    "tf_worked_minutes",
    {
      p_check_in: beforeRow.check_in_at,
      p_check_out: nowIso,
      p_break_minutes: shift.break_minutes,
    },
  );
  if (workedError || workedMinutes === null) {
    throw new Error("Không thể tính số phút làm việc.");
  }

  const { data: scheduledStart, error: scheduledStartError } = await supabase.rpc(
    "tf_local_instant",
    { p_date: beforeRow.work_date, p_time: shift.start_time },
  );
  if (scheduledStartError || !scheduledStart) {
    throw new Error("Không thể tính thời gian bắt đầu ca.");
  }

  // Thoi luong TRON CA (ke ca gio nghi -- p_break_minutes=0) da xu ly wrap
  // qua nua dem cho ca qua dem (D-08) o CHINH tf_shift_minutes(), khong phai
  // tu viet lai o day. Cong so phut nay vao thoi diem bat dau THEO KE HOACH
  // qua addMinutesToInstant() (phep cong EPOCH DON THUAN, khong phai mot quy
  // uoc mui gio thu hai) de ra thoi diem KET THUC CA THEO KE HOACH.
  const { data: rawShiftMinutes, error: shiftMinutesError } = await supabase.rpc(
    "tf_shift_minutes",
    { p_start: shift.start_time, p_end: shift.end_time, p_break_minutes: 0 },
  );
  if (shiftMinutesError || rawShiftMinutes === null) {
    throw new Error("Không thể tính thời lượng ca.");
  }
  const scheduledEnd = addMinutesToInstant(
    scheduledStart as string,
    rawShiftMinutes as number,
  );

  const { data: earlyLeaveMinutes, error: earlyError } = await supabase.rpc(
    "tf_worked_minutes",
    { p_check_in: nowIso, p_check_out: scheduledEnd, p_break_minutes: 0 },
  );
  if (earlyError || earlyLeaveMinutes === null) {
    throw new Error("Không thể tính số phút về sớm.");
  }

  const status: AttendanceRecord["status"] =
    beforeRow.status === "late"
      ? "late"
      : (earlyLeaveMinutes as number) > 0
        ? "early_leave"
        : "on_time";

  const { data: afterRow, error: updateError } = await supabase
    .from("attendance_records")
    .update({
      check_out_at: nowIso,
      worked_minutes: workedMinutes,
      early_leave_minutes: earlyLeaveMinutes,
      status,
    })
    .eq("id", recordId)
    .eq("company_id", companyId)
    .select(ATTENDANCE_COLUMNS)
    .single();

  if (updateError || !afterRow) {
    throw new Error("Không thể ghi nhận giờ tan ca.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "attendance_records",
    entityId: recordId,
    before: beforeRow,
    after: afterRow,
    reason: null,
  });

  // ATT-02/ATT-07 (plan 03-04, Task 2): lan RA cung mang anh + toa do, do
  // KHOANG CACH DOC LAP qua writePunchEvidence() — khong chep gia tri cua
  // lan vao sang day (T-03-04-04). kind="check_out" nen ghi/cap nhat DUNG
  // dong attendance_photos thu hai cua ban ghi nay (unique(attendance_record_id, kind)).
  const photoResult = await writePunchEvidence({
    supabase,
    companyId,
    employeeId: beforeRow.employee_id,
    actorUserId: userId,
    attendanceRecordId: recordId,
    kind: "check_out",
    nowIso: nowIso as string,
    punchEvidence,
  });

  return {
    ...attendanceRecordSchema.parse(afterRow),
    ...photoResult,
  };
}
