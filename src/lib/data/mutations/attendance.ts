"use server";

import { randomUUID } from "node:crypto";

import {
  ForbiddenError,
  getSessionContext,
  requireRole,
} from "@/lib/auth/session-context";
import { periodGuardError } from "@/lib/attendance/period-guard";
import { AttendanceRejectedError } from "@/lib/attendance/rejection";
import { requiresPunchPhoto } from "@/lib/attendance/suspicious";
import { logMutation } from "@/lib/data/audit";
import { loadCompanySettings } from "@/lib/settings/company-settings";
import { addDays } from "@/lib/format";
import { scheduledStartDayOffset } from "@/lib/shifts/overnight-anchor";
import { ATTENDANCE_PHOTO_BUCKET, buildAttendancePhotoPath } from "@/lib/storage/attendance-photos";
import { createServerSupabase } from "@/lib/supabase/server";
import { attendanceRecordSchema } from "@/lib/validation/api/attendance";
import {
  punchEvidenceSchema,
  punchLocationSchema,
} from "@/lib/validation/api/attendance-photos";
import type {
  AttendanceRecord,
  PunchEvidence,
  PunchLocation,
  PunchLocationEvaluation,
} from "@/lib/types/domain";

const ATTENDANCE_COLUMNS =
  "id, company_id, employee_id, work_date, shift_id, check_in_at, check_out_at, worked_minutes, late_minutes, early_leave_minutes, status, location, needs_supplement, note, edited_at, edited_by";

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
  /**
   * Cot SINH cua bang `shifts` (`end_time < start_time`, 0004:44). Doc lai
   * chu KHONG BAO GIO tinh lai o tang ung dung — quyet dinh 02-06.
   */
  overnight: boolean;
}

const SHIFT_PUNCH_COLUMNS =
  "id, kind, start_time, end_time, duration_minutes, break_minutes, late_tolerance_minutes, overnight";

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

interface MeasurePunchLocationInput {
  supabase: ServerSupabaseClient;
  companyId: string;
  employeeId: string;
  location: PunchLocation;
}

/**
 * Ket qua phep do, giau hon `PunchEvidenceResult` hai truong chi co nghia o
 * PHIA SERVER: dinh danh diem lam viec gan nhat (de ghi vao dong bang chung)
 * va cau tra loi cho "lan nay co phai chup anh khong".
 */
interface PunchMeasurement extends PunchEvidenceResult {
  workSiteId: string | null;
  requiresPhoto: boolean;
}

/**
 * DO khoang cach cua MOT lan cham toi diem lam viec gan nhat, va tra loi hai
 * cau hoi khac nhau ve no: co bi DANH DAU dang ngo khong (`isOutsideRadius`,
 * D-21) va co phai KEM ANH khong (`requiresPhoto`).
 *
 * Tach khoi phan ghi (truoc day cung nam trong `writePunchEvidence`) vi thu tu
 * bat buoc doi nguoc lai: `checkIn`/`checkOut` phai biet CO CAN ANH KHONG
 * *truoc khi* ghi dong `attendance_records`. Do sau khi ghi thi mot lan cham
 * thieu anh se de lai mot dong cham cong roi moi bi tu choi.
 *
 * Doc `can_check_in_remotely` NGAY TAI DAY thay vi nhan qua tham so: ca hai
 * noi goi deu can no, va mot trong hai (`checkOut`) khong doc bang `employees`
 * cho viec gi khac — truyen tay se la mot co hoi de mot ngay nao do truyen
 * sai.
 *
 * KHONG CO NHANH NAO NEM LOI THEO KHOANG CACH. Ngoai ban kinh la mot ghi chu
 * duoc chap nhan (D-20/D-20a), khong phai dieu kien chan.
 */
async function measurePunchLocation({
  supabase,
  companyId,
  employeeId,
  location,
}: MeasurePunchLocationInput): Promise<PunchMeasurement> {
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
        p_lat1: location.latitude,
        p_lng1: location.longitude,
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

  const { data: employeeFlagRow, error: employeeFlagError } = await supabase
    .from("employees")
    .select("can_check_in_remotely")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (employeeFlagError) {
    throw new Error("Không thể đọc cấu hình chấm công của nhân viên.");
  }
  const canCheckInRemotely =
    (employeeFlagRow as { can_check_in_remotely: boolean } | null)
      ?.can_check_in_remotely ?? false;

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

  return {
    workSiteId: nearestWorkSiteId,
    workSiteName: nearestWorkSiteName,
    distanceMeters: nearestDistanceMeters,
    isOutsideRadius,
    // CUNG nguong voi isOutsideRadius, KHAC o mot cho: thieu phep do thi ham
    // nay tra `true` (bat anh) trong khi isOutsideRadius la `false` (khong ket
    // luan dang ngo). Xem khoi chu thich cua `requiresPunchPhoto()`.
    requiresPhoto: requiresPunchPhoto({
      distanceMeters: nearestDistanceMeters,
      radiusMeters: nearestWorkSiteRadiusMeters,
      canCheckInRemotely,
      multiplier: settings.suspiciousDistanceMultiplier,
    }),
  };
}

/**
 * BUOC DO TRUOC cua man hinh nhan vien: gui LEN toa do, nhan VE cau tra loi
 * "lan cham nay co phai chup anh khong" — truoc khi bat camera, va truoc khi
 * ghi bat ky dong nao.
 *
 * Day la mot phep DOC thuan tuy: khong ghi dong nao, khong cham Storage. Cau
 * tra loi cua no la mot GOI Y cho giao dien, KHONG PHAI mot giay thong hanh —
 * `checkIn`/`checkOut` do LAI tu dau bang chinh `measurePunchLocation()` va
 * van tu choi neu can anh ma thieu anh. Mot client sua tay de bo qua buoc nay
 * khong di xa hon duoc mot buoc nao.
 */
export async function evaluatePunchLocation(
  location: PunchLocation,
): Promise<PunchLocationEvaluation> {
  const {
    companyId,
    role,
    employeeId: sessionEmployeeId,
  } = await getSessionContext();

  // Loi THUONG, khong phai `AttendanceRejectedError`: ba ly do tu choi cua
  // D-20b noi ve mot lan CHAM CONG bi tu choi, con day moi la buoc do truoc —
  // chua co lan cham nao de tu choi. Giao dien doi xu voi no nhu "chua lay
  // duoc vi tri" (chay lai ca luot), khong dan nguoi dung vao mot khoi "thieu
  // anh" ma nut duy nhat cua no lai la chup lai khi camera con chua bat.
  const parsed = punchLocationSchema.safeParse(location);
  if (!parsed.success) {
    throw new Error("Toạ độ không hợp lệ.");
  }

  // AUTH-03: chi do duoc cho CHINH MINH. Vai tro quan tri khong co ho so nhan
  // vien gan kem thi khong co `can_check_in_remotely` nao de doc — do la mot
  // phien khong cham cong duoc, khong phai mot phien duoc mien anh.
  const isAdminRole = role === "owner" || role === "admin";
  if (!sessionEmployeeId && !isAdminRole) {
    throw new ForbiddenError();
  }

  const supabase = await createServerSupabase();
  const measurement = await measurePunchLocation({
    supabase,
    companyId,
    employeeId: sessionEmployeeId ?? "",
    location: parsed.data,
  });

  return {
    requiresPhoto: measurement.requiresPhoto,
    distanceMeters: measurement.distanceMeters,
    workSiteName: measurement.workSiteName,
  };
}

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
  /** Ket qua `measurePunchLocation()` cua CHINH lan goi nay — do lai o day se la phep do thu hai cua cung mot lan cham. */
  measurement: PunchMeasurement;
}

/**
 * Ghi bang chung (toa do + khoang cach da do, va anh NEU CO) cho MOT lan cham
 * — dung CHUNG cho ca `checkIn` (`kind: "check_in"`) lan `checkOut`
 * (`kind: "check_out"`, plan 03-04 Task 2) thay vi hai ham gan giong het nhau.
 * Thu tu: tai anh len Storage (bo qua khi khong co anh) ->
 * doc-truoc-insert-hoac-update DUNG MOT dong `attendance_photos` theo
 * (`attendance_record_id`, `kind`) -> `logMutation` rieng cho bang anh.
 *
 * MOT DONG VAN DUOC GHI KHI KHONG CO ANH (migration 0032). Dong nay giu toa
 * do, khoang cach va diem lam viec gan nhat — bo no di thi moi lan cham GAN
 * (tuc da so lan cham) se khong con dau vet vi tri nao de doi chieu ve sau.
 *
 * Phep do den tu ben ngoai (`measurement`) chu khong tinh lai o day, vi noi
 * goi da can chinh no de quyet dinh CO TU CHOI HAY KHONG truoc khi ghi. Moi
 * lan goi van la mot phep do RIENG cua chinh lan cham do — gia tri cua lan vao
 * khong bao gio chep sang lan ra (T-03-04-04).
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
  measurement,
}: WritePunchEvidenceInput): Promise<PunchEvidenceResult> {
  // T-03-06/ATT-01: anh chi den tu khung hinh truc tiep (Blob dung canh
  // duoc kiem boi punchEvidenceSchema) — khong co duong nao khac de doc
  // duoc mot Blob tai day. photoId la uuid, KHONG PHAI so thu tu, de khong
  // ai liet ke duoc anh bang cach doan URL.
  const photo = punchEvidence.photo ?? null;
  // Dung MOT uuid cho ca duong dan Storage lan khoa chinh cua dong (khi la
  // dong moi), de tu mot duong dan trong Storage lan nguoc ve dung dong bang
  // chung ma khong can mot bang tra cuu.
  const photoId = randomUUID();
  let storagePath: string | null = null;

  if (photo) {
    storagePath = buildAttendancePhotoPath({
      companyId,
      employeeId,
      photoId,
      kind,
    });

    const { error: uploadError } = await supabase.storage
      .from(ATTENDANCE_PHOTO_BUCKET)
      .upload(storagePath, photo, {
        contentType: photo.type,
        upsert: false,
      });
    if (uploadError) {
      // Tai len that bai thi KHONG duoc de lai mot dong attendance_photos mo
      // coi — dong do chi duoc ghi SAU buoc nay, nen khong ghi gi ca la dung.
      throw new Error("Không thể tải ảnh chấm công lên máy chủ.");
    }
  }

  // Cham vao lan thu hai trong cung (attendance_record_id, kind) cap nhat
  // dong dang co thay vi tao dong thu hai — rang buoc `unique` cua database
  // la lop hai, cung khuon doc-truoc-insert-hoac-update nhu attendance_records.
  const { data: existingPhoto, error: existingPhotoError } = await supabase
    .from("attendance_photos")
    .select("id, storage_path")
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
    work_site_id: measurement.workSiteId,
    distance_meters: measurement.distanceMeters,
  };

  let photoRow: RawAttendancePhotoRow;
  let photoAuditAction: "insert" | "update";

  if (existingPhoto) {
    photoAuditAction = "update";
    // `storage_path` bi GHI DE bang gia tri cua LAN NAY, ke ca khi lan nay
    // khong co anh (thanh null). Dong bang chung phai mo ta DUNG lan cham dang
    // ghi; giu lai anh cua mot lan thu truoc — chup o mot toa do khac — se
    // bien no thanh mot bang chung noi sai. Tep cu tro thanh mo coi trong
    // Storage, dung nhu khi tai len de (moi lan sinh mot uuid moi): D-22
    // khong co job don, day la ranh gioi da biet chu khong phai mot ro ri moi.
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
    distanceMeters: measurement.distanceMeters,
    workSiteName: measurement.workSiteName,
    isOutsideRadius: measurement.isOutsideRadius,
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
 * `evidence` (TOA DO) la BAT BUOC ve hanh vi du optional ve kieu: thieu no
 * (`undefined`, hoac khong qua duoc `punchEvidenceSchema`) nem
 * `AttendanceRejectedError("missing_photo")` TRUOC KHI cham Storage hay ghi
 * bat ky dong nao.
 *
 * ANH BEN TRONG `evidence` THI KHONG PHAI LUC NAO CUNG BAT BUOC. Cau hoi "lan
 * nay co phai chup anh khong" la mot cau hoi ve KHOANG CACH, va no chi tra loi
 * duoc sau khi server do lai (`measurePunchLocation`) — nen thu tu o day la:
 * do TRUOC, tu choi neu can anh ma thieu anh, ROI MOI ghi dong nao. Do sau khi
 * ghi se de lai mot dong cham cong roi moi tu choi chinh lan cham do.
 *
 * D-20b: dung DUNG BA ly do tu choi ma server tu quyet duoc — `missing_photo`
 * (thieu bang chung), `outside_shift` (cham cong ngoai khung gio ca duoc
 * phan, xem `SHIFT_WINDOW_GRACE_MINUTES`; `checkOut` con dung lai phan loai
 * nay cho truong hop "chua co gio vao") — cong `network_error` la phan loai
 * DUY NHAT client tu quyet khi loi vang KHONG mang truong `reason` hop le.
 * KHONG CO LY DO THU TU: khoang cach vuot ban kinh KHONG BAO GIO la mot ly
 * do tu choi (D-20/D-20a) o bat ky nhanh nao trong file nay.
 */
type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

export interface DerivedAttendance {
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: AttendanceRecord["status"];
}

/**
 * NGUON SU THAT DUY NHAT cho bon cot dan xuat cua mot luot cham cong
 * (spec 2026-09-06). Truoc khi co ham nay, phep tinh nam rai trong `checkIn`
 * (do muon) va `checkOut` (thoi luong, ve som, trang thai).
 *
 * Ly do gom lai: tu luc quan tri sua duoc gio tay, se co BA duong cung ghi
 * bon cot nay. Ba ban sao cua mot quy tac se troi khoi nhau, va hau qua khong
 * hien ra ngay — no hien ra o bang luong cuoi thang duoi dang mot con so sai
 * ma khong ai truy duoc.
 *
 * Moi phep tinh thoi gian deu di qua RPC cua Postgres (`tf_local_instant`,
 * `tf_worked_minutes`, `tf_shift_minutes`), khong tinh o JavaScript — dung
 * mot quy uoc mui gio thu hai chinh la dieu D-19 cam.
 *
 * `knownLateMinutes`: khi da biet so phut muon (duong `checkOut` — do muon
 * thuoc ve LAN VAO, khong duoc tinh lai o lan ra), truyen vao de bo qua nhanh
 * tinh muon. Khong truyen thi tinh lai tu dau (duong `checkIn` va duong quan
 * tri sua gio).
 */
async function computeDerivedAttendance({
  supabase,
  shift,
  workDate,
  checkInAt,
  checkOutAt,
  isFirstPunchOfDay,
  knownLateMinutes,
}: {
  supabase: SupabaseServerClient;
  shift: RawShiftRow;
  workDate: string;
  checkInAt: string;
  checkOutAt: string | null;
  isFirstPunchOfDay: boolean;
  knownLateMinutes?: number;
}): Promise<DerivedAttendance> {
  /* ---------- Di muon ---------------------------------------------------- */
  let lateMinutes = knownLateMinutes ?? 0;

  // Do muon CHI tinh cho LUOT DAU TIEN cua ngay: cac luot sau la quay lai sau
  // khi ra ngoai giua ca, so voi gio bat dau ca thi luon "muon" — tinh do muon
  // cho chung se bien moi lan di an trua ve thanh mot lan di muon.
  //
  // Ca linh hoat khong co gio bat dau de do muon SO VOI (xem `isHoursShift`).
  if (knownLateMinutes === undefined && isFirstPunchOfDay && !isHoursShift(shift)) {
    // CA QUA DEM: moc bat dau ca co the nam o HOM QUA.
    //
    // Voi ca 22:00-06:00, mot luot cham luc 00:09 co `work_date` la hom nay,
    // nen giai gio bat dau ca tren chinh ngay do se ra 22:00 TOI NAY: mot moc
    // trong TUONG LAI. So phut muon thanh am, bi kep ve 0, va nguoi vao muon
    // hai tieng duoc ghi `on_time`.
    //
    // `scheduledStartDayOffset()` chi doi MOC DUOC DEM MUON SO VOI — mot phep
    // do. No khong dung toi `work_date`, khong dung toi D-08, va khong dung
    // toi bat ky cot nao duoc luu.
    let shiftEndInstantOnWorkDate: string | null = null;
    if (shift.overnight && shift.end_time !== null) {
      const { data: endInstant, error: endInstantError } = await supabase.rpc(
        "tf_local_instant",
        { p_date: workDate, p_time: shift.end_time },
      );
      if (endInstantError || !endInstant) {
        throw new Error("Không thể tính thời gian kết thúc ca.");
      }
      shiftEndInstantOnWorkDate = endInstant as string;
    }

    const dayOffset = scheduledStartDayOffset({
      overnight: shift.overnight,
      punchInstant: checkInAt,
      shiftEndInstantOnWorkDate,
    });
    const scheduledStartDate =
      dayOffset === 0 ? workDate : addDays(workDate, dayOffset);

    const { data: scheduledStart, error: scheduledStartError } = await supabase.rpc(
      "tf_local_instant",
      { p_date: scheduledStartDate, p_time: shift.start_time },
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
      { p_check_in: scheduledStart, p_check_out: checkInAt, p_break_minutes: 0 },
    );
    if (lateError || lateRaw === null) {
      throw new Error("Không thể tính số phút đi muộn.");
    }
    lateMinutes = Math.max((lateRaw as number) - shift.late_tolerance_minutes, 0);
  }

  /* ---------- Thoi luong luot -------------------------------------------- */
  // `p_break_minutes: 0` CO CHU DICH (migration 0014): cot `worked_minutes`
  // luu THOI LUONG THO cua rieng luot nay. Gio nghi thuoc ve CA NGAY, khong
  // thuoc ve mot luot — tru no o day se tru lap lai o moi luot cua ngay, va se
  // lam mot luot ngan hon gio nghi ra 0 phut. Phep tru dung mot lan cho ca
  // ngay nam o `src/lib/attendance/day.ts`.
  let workedMinutes = 0;
  if (checkOutAt !== null) {
    const { data: worked, error: workedError } = await supabase.rpc(
      "tf_worked_minutes",
      { p_check_in: checkInAt, p_check_out: checkOutAt, p_break_minutes: 0 },
    );
    if (workedError || worked === null) {
      throw new Error("Không thể tính số phút làm việc.");
    }
    workedMinutes = worked as number;
  }

  /* ---------- Ve som ------------------------------------------------------ */
  // Ca linh hoat khong co gio ket thuc theo ke hoach, nen khong co moc nao de
  // "ve som" so voi.
  //
  // GIU NGUYEN mot khac biet co san voi nhanh do muon o tren: moc bat dau ca o
  // day dat tren CHINH `work_date`, khong qua `scheduledStartDayOffset`. Do la
  // hanh vi cua `checkOut` truoc lan gom nay; sua no o day se lang le doi cach
  // tinh ve som cua ca qua dem — mot thay doi nghiep vu khong thuoc pham vi
  // spec 2026-09-06.
  let earlyLeaveMinutes = 0;
  if (checkOutAt !== null && !isHoursShift(shift)) {
    const { data: scheduledStart, error: scheduledStartError } = await supabase.rpc(
      "tf_local_instant",
      { p_date: workDate, p_time: shift.start_time },
    );
    if (scheduledStartError || !scheduledStart) {
      throw new Error("Không thể tính thời gian bắt đầu ca.");
    }

    // Thoi luong TRON CA (ke ca gio nghi -- p_break_minutes=0) da xu ly wrap
    // qua nua dem cho ca qua dem (D-08) o CHINH tf_shift_minutes(), khong phai
    // tu viet lai o day.
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
      { p_check_in: checkOutAt, p_check_out: scheduledEnd, p_break_minutes: 0 },
    );
    if (earlyError || earlyRaw === null) {
      throw new Error("Không thể tính số phút về sớm.");
    }
    earlyLeaveMinutes = earlyRaw as number;
  }

  const status: AttendanceRecord["status"] =
    lateMinutes > 0 ? "late" : earlyLeaveMinutes > 0 ? "early_leave" : "on_time";

  return { workedMinutes, lateMinutes, earlyLeaveMinutes, status };
}

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

  // DO TRUOC KHI GHI. Lan cham vuot nguong cho phep ma khong kem anh bi tu
  // choi tai day — TRUOC dong `attendance_records` dau tien, nen mot lan bi tu
  // choi khong de lai dau vet nao phai don. Client da hoi truoc qua
  // `evaluatePunchLocation()`, nhung cau tra loi do la mot goi y cho giao dien:
  // phep do co gia tri phap ly la phep do NAY.
  const measurement = await measurePunchLocation({
    supabase,
    companyId: activeCompanyId,
    employeeId,
    location: punchEvidence,
  });
  if (measurement.requiresPhoto && !punchEvidence.photo) {
    throw new AttendanceRejectedError("missing_photo");
  }

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

  const derived = await computeDerivedAttendance({
    supabase,
    shift,
    workDate: workDate as string,
    checkInAt: nowIso as string,
    checkOutAt: null,
    isFirstPunchOfDay,
  });

  const writeRow = {
    check_in_at: nowIso,
    check_out_at: null,
    worked_minutes: derived.workedMinutes,
    late_minutes: derived.lateMinutes,
    early_leave_minutes: derived.earlyLeaveMinutes,
    status: derived.status,
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
    measurement,
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

  // DO TRUOC KHI GHI — cung ly do voi `checkIn`: mot lan tan ca thieu anh
  // trong khi phai co bi tu choi TRUOC khi `check_out_at` duoc ghi de len ban
  // ghi. Do lai DOC LAP cho lan RA, khong dung lai phep do cua lan vao
  // (T-03-04-04).
  const measurement = await measurePunchLocation({
    supabase,
    companyId,
    employeeId: beforeRow.employee_id,
    location: punchEvidence,
  });
  if (measurement.requiresPhoto && !punchEvidence.photo) {
    throw new AttendanceRejectedError("missing_photo");
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

  // `knownLateMinutes`: do muon thuoc ve LAN VAO, khong duoc tinh lai o lan ra.
  const derived = await computeDerivedAttendance({
    supabase,
    shift,
    workDate: beforeRow.work_date,
    checkInAt: beforeRow.check_in_at,
    checkOutAt: nowIso as string,
    isFirstPunchOfDay: false,
    knownLateMinutes: beforeRow.late_minutes as number,
  });

  const { data: afterRow, error: updateError } = await supabase
    .from("attendance_records")
    .update({
      check_out_at: nowIso,
      worked_minutes: derived.workedMinutes,
      early_leave_minutes: derived.earlyLeaveMinutes,
      status: derived.status,
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
    measurement,
  });

  return {
    ...attendanceRecordSchema.parse(afterRow),
    ...photoResult,
  };
}

/* ========================================================================== */
/* Quan tri chinh cham cong (spec 2026-09-06)                                 */
/* ========================================================================== */

/**
 * Ba ham duoi day la duong SUA TRUC TIEP cua quan tri — khac han `checkIn`/
 * `checkOut` o mot diem can nho: gio o day den TU THAM SO, khong tu
 * `tf_server_now()`. D-19 cam nhan dau thoi gian tu client cho mot LAN CHAM
 * CONG that; mot lan sua tay thi ban chat la nguoi dat so, va viec do duoc ghi
 * lai bang `edited_at`/`edited_by` cong mot dong `audit_log` nguyen dong.
 *
 * KY DA CHOT: khong ham nao o day tu kiem. Trigger `attendance_period_guard`
 * (migration 0021) chan o tang database, va `periodGuardError()` doi loi do
 * thanh cau chi duong tiep ("Hãy gửi yêu cầu bổ sung công..."). Kiem lai o
 * tang ung dung se tao nguon su that thu hai cho cung mot quy tac.
 */

/** Loi cua partial unique index `attendance_records_open_punch_uidx` (0013). */
const UNIQUE_VIOLATION_SQLSTATE = "23505";

const OPEN_PUNCH_MESSAGE =
  "Nhân viên này đã có một lượt chưa có giờ ra trong ngày đó. Hãy điền giờ ra cho lượt đó trước.";

/**
 * Doi loi ghi cua bang cham cong thanh mot cau doc duoc, theo dung THU TU uu
 * tien: ky da chot truoc (no chan ca nhung thao tac ma index kia cho qua), roi
 * moi den trung lap luot dang mo.
 */
function attendanceWriteError(
  cause: { code?: string; message?: string } | null | undefined,
  fallbackMessage: string,
): Error {
  if (cause?.code === UNIQUE_VIOLATION_SQLSTATE) {
    return new Error(OPEN_PUNCH_MESSAGE);
  }
  return periodGuardError(cause, fallbackMessage);
}

/**
 * "HH:mm" tren mot ngay -> TIMESTAMPTZ that, qua RPC cua Postgres.
 *
 * KHONG tu ghep chuoi ISO o JavaScript: do la dung mot quy uoc mui gio thu hai
 * ben canh quy uoc cua database (D-19), va no se lech dung vao nhung ngay it
 * ai thu.
 */
async function localInstant(
  supabase: SupabaseServerClient,
  date: string,
  time: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("tf_local_instant", {
    p_date: date,
    p_time: time,
  });
  if (error || !data) {
    throw new Error("Không thể quy đổi giờ đã nhập.");
  }
  return data as string;
}

/**
 * Ngay cong cua mot khoanh khac, theo dung ham ma CHECK constraint cua bang
 * dung (`work_date = tf_work_date(check_in_at)`, 0004:109). Sua gio vao ma giu
 * nguyen `work_date` cu se bi database tu choi — nen ngay cong luon duoc tinh
 * LAI o day chu khong suy ra o tang ung dung.
 */
async function workDateOf(
  supabase: SupabaseServerClient,
  instant: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("tf_work_date", {
    p_instant: instant,
  });
  if (error || !data) {
    throw new Error("Không thể xác định ngày công của giờ đã nhập.");
  }
  return data as string;
}

/**
 * Giai cap gio vao/ra tren mot ngay cong thanh hai khoanh khac.
 *
 * QUA DEM: gio ra SOM HON hoac BANG gio vao nghia la ca keo sang hom sau
 * (18:00 -> 02:00). Khong xu ly truong hop nay se cho ra thoi luong am, va
 * `tf_worked_minutes` se kep no ve 0 — mot ca dem tron ven bi ghi thanh 0 phut
 * ma khong bao loi gi.
 */
async function resolvePunchInstants({
  supabase,
  date,
  checkIn,
  checkOut,
}: {
  supabase: SupabaseServerClient;
  date: string;
  checkIn: string;
  checkOut: string | null;
}): Promise<{ checkInAt: string; checkOutAt: string | null }> {
  const checkInAt = await localInstant(supabase, date, checkIn);
  if (checkOut === null) {
    return { checkInAt, checkOutAt: null };
  }

  const sameDayOut = await localInstant(supabase, date, checkOut);
  const checkOutAt =
    new Date(sameDayOut).getTime() <= new Date(checkInAt).getTime()
      ? await localInstant(supabase, addDays(date, 1), checkOut)
      : sameDayOut;

  return { checkInAt, checkOutAt };
}

/** Ca cua mot ban ghi — dung de tinh lai bon cot dan xuat. */
async function loadPunchShift(
  supabase: SupabaseServerClient,
  companyId: string,
  shiftId: string,
): Promise<RawShiftRow> {
  const { data, error } = await supabase
    .from("shifts")
    .select(SHIFT_PUNCH_COLUMNS)
    .eq("id", shiftId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Không tìm thấy ca làm việc của bản ghi này.");
  }
  return data as RawShiftRow;
}

/**
 * Luot dang xet co phai luot DAU TIEN cua ngay khong — quyet dinh co tinh di
 * muon hay khong (cac luot sau la quay lai giua ca, xem
 * `computeDerivedAttendance`).
 *
 * `excludeRecordId` de chinh ban ghi dang sua khong tu tinh la "mot luot khac
 * som hon minh".
 */
async function isFirstPunchOfWorkDay({
  supabase,
  companyId,
  employeeId,
  workDate,
  shiftId,
  checkInAt,
  excludeRecordId,
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  employeeId: string;
  workDate: string;
  shiftId: string;
  checkInAt: string;
  excludeRecordId: string | null;
}): Promise<boolean> {
  let query = supabase
    .from("attendance_records")
    .select("id, check_in_at")
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .eq("shift_id", shiftId)
    .not("check_in_at", "is", null)
    .lt("check_in_at", checkInAt);

  if (excludeRecordId !== null) {
    query = query.neq("id", excludeRecordId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Không thể kiểm tra các lượt chấm công trong ngày.");
  }
  return (data ?? []).length === 0;
}

/** Doc mot ban ghi trong PHAM VI doanh nghiep cua phien dang dang nhap. */
async function loadOwnAttendanceRecord(
  supabase: SupabaseServerClient,
  companyId: string,
  recordId: string,
): Promise<RawAttendanceRow> {
  const { data, error } = await supabase
    .from("attendance_records")
    .select(ATTENDANCE_COLUMNS)
    .eq("id", recordId)
    // Ranh gioi doanh nghiep nam O DAY; RLS la lop phong thu thu hai.
    .eq("company_id", companyId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Không tìm thấy bản ghi chấm công.");
  }
  return data as RawAttendanceRow;
}

export interface AttendanceTimesInput {
  /** "HH:mm" theo gio Viet Nam, tren ngay cong cua ban ghi. */
  checkIn: string;
  /** "HH:mm", hoac `null` khi luot con dang mo (chua tan ca). */
  checkOut: string | null;
}

/**
 * Quan tri sua gio vao/ra cua mot luot cham cong da co.
 *
 * KHONG doi duoc ngay cong: muon chuyen mot luot sang ngay khac thi xoa roi
 * them lai. Ranh gioi nay giu cho rang buoc `work_date` khoi bien thanh mot mo
 * truong hop dac biet, va no phan anh dung nghiep vu — doi ngay cua mot luot
 * la mot su that khac, khong phai mot cho go nham.
 *
 * Ngay cong VAN duoc tinh lai tu gio vao moi: voi ca qua dem, sua gio vao tu
 * 23:50 sang 00:10 lam ngay cong doi that, va CHECK constraint cua bang se tu
 * choi neu ta giu nguyen gia tri cu.
 */
export async function updateAttendanceRecord(
  recordId: string,
  times: AttendanceTimesInput,
): Promise<AttendanceRecord> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();
  const beforeRow = await loadOwnAttendanceRecord(supabase, companyId, recordId);

  const shift = await loadPunchShift(supabase, companyId, beforeRow.shift_id);

  const { checkInAt, checkOutAt } = await resolvePunchInstants({
    supabase,
    date: beforeRow.work_date,
    checkIn: times.checkIn,
    checkOut: times.checkOut,
  });

  const workDate = await workDateOf(supabase, checkInAt);

  const isFirstPunchOfDay = await isFirstPunchOfWorkDay({
    supabase,
    companyId,
    employeeId: beforeRow.employee_id,
    workDate,
    shiftId: beforeRow.shift_id,
    checkInAt,
    excludeRecordId: recordId,
  });

  const derived = await computeDerivedAttendance({
    supabase,
    shift,
    workDate,
    checkInAt,
    checkOutAt,
    isFirstPunchOfDay,
  });

  const { data: nowIso, error: nowError } = await supabase.rpc("tf_server_now");
  if (nowError || !nowIso) {
    throw new Error("Không thể xác định thời gian máy chủ.");
  }

  const { data: afterRow, error: updateError } = await supabase
    .from("attendance_records")
    .update({
      work_date: workDate,
      check_in_at: checkInAt,
      check_out_at: checkOutAt,
      worked_minutes: derived.workedMinutes,
      late_minutes: derived.lateMinutes,
      early_leave_minutes: derived.earlyLeaveMinutes,
      status: derived.status,
      // Da co gio ra thi khong con gi de nhan vien bo sung nua.
      needs_supplement: checkOutAt === null ? beforeRow.needs_supplement : false,
      edited_at: nowIso,
      edited_by: userId,
    })
    .eq("id", recordId)
    .eq("company_id", companyId)
    .select(ATTENDANCE_COLUMNS)
    .single();

  if (updateError || !afterRow) {
    throw attendanceWriteError(updateError, "Không thể sửa bản ghi chấm công.");
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

  return attendanceRecordSchema.parse(afterRow);
}

export interface CreateAttendanceInput extends AttendanceTimesInput {
  employeeId: string;
  /** "YYYY-MM-DD" — ngay cong quan tri chon. */
  date: string;
  shiftId: string;
}

/**
 * Quan tri them mot luot cham cong cho ngay nhan vien quen bam han.
 *
 * `location` lay tu `work_location` cua ho so nhan vien — cot nay `not null`,
 * va mot ban ghi do nguoi tao thi khong co toa do do duoc. Khong co bang chung
 * anh/vi tri di kem: day dung la mot ban ghi do nguoi dat, va `edited_at` noi
 * ro dieu do.
 */
export async function createAttendanceRecord(
  input: CreateAttendanceInput,
): Promise<AttendanceRecord> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const { data: employeeRow, error: employeeError } = await supabase
    .from("employees")
    .select("id, work_location")
    .eq("id", input.employeeId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (employeeError || !employeeRow) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const shift = await loadPunchShift(supabase, companyId, input.shiftId);

  const { checkInAt, checkOutAt } = await resolvePunchInstants({
    supabase,
    date: input.date,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
  });

  const workDate = await workDateOf(supabase, checkInAt);

  const isFirstPunchOfDay = await isFirstPunchOfWorkDay({
    supabase,
    companyId,
    employeeId: input.employeeId,
    workDate,
    shiftId: input.shiftId,
    checkInAt,
    excludeRecordId: null,
  });

  const derived = await computeDerivedAttendance({
    supabase,
    shift,
    workDate,
    checkInAt,
    checkOutAt,
    isFirstPunchOfDay,
  });

  const { data: nowIso, error: nowError } = await supabase.rpc("tf_server_now");
  if (nowError || !nowIso) {
    throw new Error("Không thể xác định thời gian máy chủ.");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("attendance_records")
    .insert({
      id: randomUUID(),
      company_id: companyId,
      employee_id: input.employeeId,
      work_date: workDate,
      shift_id: input.shiftId,
      check_in_at: checkInAt,
      check_out_at: checkOutAt,
      worked_minutes: derived.workedMinutes,
      late_minutes: derived.lateMinutes,
      early_leave_minutes: derived.earlyLeaveMinutes,
      status: derived.status,
      location: employeeRow.work_location as string,
      needs_supplement: false,
      note: null,
      edited_at: nowIso,
      edited_by: userId,
    })
    .select(ATTENDANCE_COLUMNS)
    .single();

  if (insertError || !inserted) {
    throw attendanceWriteError(insertError, "Không thể thêm bản ghi chấm công.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "attendance_records",
    entityId: (inserted as RawAttendanceRow).id,
    before: null,
    after: inserted,
    reason: null,
  });

  return attendanceRecordSchema.parse(inserted);
}

/**
 * Quan tri xoa mot luot bam thua (bam nham hai lan lien nhau).
 *
 * Xoa THAT chu khong danh dau: mot luot bam nham khong phai mot su that can
 * giu lai tren bang cong. Dau vet van con nguyen o `audit_log` — anh chup
 * nguyen dong nam o `before`, nen khoi phuc duoc neu xoa nham.
 */
export async function deleteAttendanceRecord(recordId: string): Promise<void> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();
  const beforeRow = await loadOwnAttendanceRecord(supabase, companyId, recordId);

  const { error: deleteError } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", recordId)
    .eq("company_id", companyId);

  if (deleteError) {
    throw attendanceWriteError(deleteError, "Không thể xoá bản ghi chấm công.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "delete",
    entityTable: "attendance_records",
    entityId: recordId,
    before: beforeRow,
    after: null,
    reason: null,
  });
}
