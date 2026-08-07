"use server";

import { randomUUID } from "node:crypto";

import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { periodGuardError } from "@/lib/attendance/period-guard";
import { AttendanceRejectedError } from "@/lib/attendance/rejection";
import { logMutation } from "@/lib/data/audit";
import { loadCompanySettings } from "@/lib/settings/company-settings";
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
  kind: string;
  /** `null` o ca linh hoat (migration 0027) */
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  break_minutes: number;
  late_tolerance_minutes: number;
}

const SHIFT_PUNCH_COLUMNS =
  "id, kind, start_time, end_time, duration_minutes, break_minutes, late_tolerance_minutes";

/**
 * CA LINH HOAT (migration 0027) KHONG CO GIO MOC, nen ba dai luong do tu mot
 * gio moc deu khong ton tai o day: di muon, ve som, va "ngoai khung gio ca".
 *
 * Day khong phai mot ngoai le duoc bo qua cho tien — no la dinh nghia cua loai
 * ca do. Nhan vien duoc phep vao luc nao cung duoc; do "muon" so voi mot gio
 * ma khong ai hua se cho ra mot con so vo nghia, va con so do se chay thang
 * vao `status = "late"` roi len bao cao di muon cua ca doanh nghiep.
 */
function isHoursShift(shift: RawShiftRow): boolean {
  return shift.kind === "hours";
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
 * D-21/03-06 va D-29/04-01: nguong danh dau dang ngo gio den tu CAU HINH cua
 * chinh doanh nghiep (`company_settings.suspicious_distance_multiplier`, doc
 * qua `loadCompanySettings()`), khong con tu mot hang so trong ma. File nay
 * dung no de tinh banner tuc thi (`isOutsideRadius`) ngay sau khi cham cong,
 * va danh sach "Can xem lai" cua quan tri doc CUNG mot nguon — neu mot ben
 * doc hang so con ben kia doc cau hinh thi hai man hinh se bat dong ve cung
 * mot lan cham cong. `SUSPICIOUS_DISTANCE_MULTIPLIER` o
 * `src/lib/attendance/suspicious.ts` chi con la GIA TRI MAC DINH.
 */

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

  // D-21: danh dau dang ngo khi khoang cach vuot NGUONG, khong phai vuot ban
  // kinh tran (D-20a: "trong ban kinh" tu dieu kien bat buoc thanh ghi chu).
  // CHI dung de quyet dinh banner tuc thi o day — KHONG chan cham cong o bat
  // ky nhanh nao (D-20).
  //
  // Nguong doc tu cau hinh cua CHINH doanh nghiep (D-29, plan 04-01): banner
  // ma nhan vien nhin thay va danh sach "Can xem lai" ma quan tri nhin thay
  // phai noi CUNG mot nguong — neu mot ben doc hang so con ben kia doc cau
  // hinh thi hai man hinh se bat dong ve cung mot lan cham cong.
  const settings = await loadCompanySettings(companyId);
  const isOutsideRadius =
    nearestWorkSiteId !== null &&
    nearestDistanceMeters !== null &&
    nearestWorkSiteRadiusMeters !== null &&
    nearestDistanceMeters >
      nearestWorkSiteRadiusMeters * settings.suspiciousDistanceMultiplier;

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
    .select(SHIFT_PUNCH_COLUMNS)
    .eq("id", employeeRow.shift_id as string)
    .eq("company_id", activeCompanyId)
    .maybeSingle();
  if (shiftError || !shiftRow) {
    throw new Error("Nhân viên chưa được gán ca làm việc.");
  }
  const shift = shiftRow as RawShiftRow;

  // CHAM CONG NGOAI KHUNG GIO CA KHONG CON BI TU CHOI.
  //
  // Truoc day day la mot cua chan (T-03-04-01): ngoai khung gio ca cong bien
  // do hai tieng thi nem `outside_shift`. Bo di vi hai ly do:
  //
  //   1. Tu migration 0013 mot ngay co nhieu luot, nen "lam ca sang xong,
  //      chieu duoc goi quay lai hai tieng" la tinh huong THAT — va cua chan
  //      nay khoa dung nguoi dang lam viec that.
  //   2. No khong dong bo voi chinh nguyen tac cua he thong. D-20 da bien
  //      "trong ban kinh" tu dieu kien CHAN thanh mot GHI CHU: cham cong o xa
  //      van duoc ghi, chi bi danh dau de quan ly xem lai. Gio giac ngoai ca
  //      la cung mot loai tin hieu — dang de hoi, khong du de ket luan.
  //
  // Su kien "ngoai khung gio ca" KHONG mat di: no duoc tinh LAI TAI THOI DIEM
  // TRUY VAN tu `check_in_at` + gio ca (xem `isOutsideShiftWindow()` trong
  // `src/lib/attendance/suspicious.ts`, dung o danh sach "Can xem lai"). Day
  // la cung khuon voi co dang ngo theo khoang cach — khong luu mot cot
  // boolean nao, nen khi bien do doi thi danh sach tu cap nhat, khong can ghi
  // de hang loat len du lieu lich su (migration 0011 dong 56-60).

  // Cac luot DA cham cua chinh ngay/ca nay, som nhat truoc. Loc bo dong
  // khong co gio vao (nghi phep/nghi khong luong) — nhung dong do khong phai
  // mot luot cham cong va khong duoc tinh vao thu tu luot.
  const { data: punchesTodayData, error: punchesTodayError } = await supabase
    .from("attendance_records")
    .select(ATTENDANCE_COLUMNS)
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .eq("shift_id", shift.id)
    .eq("company_id", activeCompanyId)
    .not("check_in_at", "is", null)
    .order("check_in_at", { ascending: true });
  if (punchesTodayError) {
    throw new Error("Không thể kiểm tra bản ghi chấm công.");
  }
  const punchesToday = (punchesTodayData ?? []) as RawAttendanceRow[];

  // Bat bien "khong ai o trong hai luot cung luc" — cung dieu kien voi partial
  // unique index `attendance_records_open_punch_uidx` (migration 0013), day
  // chi la lop kiem tra som de tra ve mot thong diep doc duoc thay vi loi
  // rang buoc cua database. KHONG dung AttendanceRejectedError: D-20b khoa
  // dung ba ly do va day khong phai mot trong ba (cung khong phai mot lan
  // cham cong bi TU CHOI — no la mot thao tac sai trinh tu).
  if (punchesToday.some((row) => !row.check_out_at)) {
    throw new Error(
      "Bạn đang trong một lượt chấm công chưa tan ca. Hãy tan ca trước khi vào lại.",
    );
  }

  // Do muon CHI tinh cho LUOT DAU TIEN cua ngay: cac luot sau la quay lai
  // sau khi ra ngoai giua ca, so voi gio bat dau ca thi luon "muon" — tinh
  // do muon cho chung se bien moi lan di an trua ve thanh mot lan di muon.
  const isFirstPunchOfDay = punchesToday.length === 0;

  let lateMinutes = 0;
  // Ca linh hoat khong co gio bat dau de do muon SO VOI — xem `isHoursShift`.
  // Bo qua CA phep goi `tf_local_instant` o day: goi no voi `p_time = null` se
  // tra null va roi vao nhanh nem loi ben duoi, tuc mot nhan vien ca linh hoat
  // se khong cham cong duoc.
  if (isFirstPunchOfDay && !isHoursShift(shift)) {
    const { data: scheduledStart, error: scheduledStartError } = await supabase.rpc(
      "tf_local_instant",
      { p_date: workDate, p_time: shift.start_time },
    );
    if (scheduledStartError || !scheduledStart) {
      throw new Error("Không thể tính thời gian bắt đầu ca.");
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
    lateMinutes = Math.max((lateRaw as number) - shift.late_tolerance_minutes, 0);
  }
  const status: AttendanceRecord["status"] = lateMinutes > 0 ? "late" : "on_time";

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

  // Moi luot vao ca la mot DONG MOI (khong con nhanh cap nhat dong cu): mot
  // ngay co the co nhieu luot, va moi luot phai giu duoc bang chung rieng
  // (anh vao/ra, toa do, khoang cach) cua chinh no.
  const { data: inserted, error: insertError } = await supabase
    .from("attendance_records")
    .insert({
      id: randomUUID(),
      company_id: activeCompanyId,
      employee_id: employeeId,
      work_date: workDate,
      shift_id: shift.id,
      ...writeRow,
    })
    .select(ATTENDANCE_COLUMNS)
    .single();
  if (insertError || !inserted) {
    throw periodGuardError(insertError, "Không thể ghi nhận giờ vào ca.");
  }
  const resultRow = inserted as RawAttendanceRow;

  await logMutation({
    companyId: activeCompanyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "attendance_records",
    entityId: resultRow.id,
    before: null,
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
    .select(SHIFT_PUNCH_COLUMNS)
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

  // `p_break_minutes: 0` CO CHU DICH (migration 0014): cot `worked_minutes`
  // luu THOI LUONG THO cua rieng luot nay. Gio nghi thuoc ve CA NGAY, khong
  // thuoc ve mot luot — tru no o day se tru lap lai o moi luot cua ngay, va
  // se lam mot luot ngan hon gio nghi ra 0 phut. Phep tru dung mot lan cho
  // ca ngay nam o `src/lib/attendance/day.ts`.
  const { data: workedMinutes, error: workedError } = await supabase.rpc(
    "tf_worked_minutes",
    {
      p_check_in: beforeRow.check_in_at,
      p_check_out: nowIso,
      p_break_minutes: 0,
    },
  );
  if (workedError || workedMinutes === null) {
    throw new Error("Không thể tính số phút làm việc.");
  }

  // Ca linh hoat khong co gio ket thuc theo ke hoach, nen khong co moc nao de
  // "ve som" so voi (xem `isHoursShift`). Ba loi goi RPC duoi day deu nhan
  // `shift.start_time`/`shift.end_time` — voi ca linh hoat chung deu null, nen
  // day cung la nhanh giu cho `checkOut` khong nem loi giua chung.
  let earlyLeaveMinutes = 0;
  if (!isHoursShift(shift)) {
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

    const { data: earlyRaw, error: earlyError } = await supabase.rpc(
      "tf_worked_minutes",
      { p_check_in: nowIso, p_check_out: scheduledEnd, p_break_minutes: 0 },
    );
    if (earlyError || earlyRaw === null) {
      throw new Error("Không thể tính số phút về sớm.");
    }
    earlyLeaveMinutes = earlyRaw as number;
  }

  const status: AttendanceRecord["status"] =
    beforeRow.status === "late"
      ? "late"
      : earlyLeaveMinutes > 0
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
    throw periodGuardError(updateError, "Không thể ghi nhận giờ tan ca.");
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
