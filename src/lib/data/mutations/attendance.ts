"use server";

import { randomUUID } from "node:crypto";

import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { AttendanceEvidenceError } from "@/lib/data/mutations/attendance-errors";
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
  latitude: number;
  longitude: number;
}

interface RawAttendancePhotoRow {
  id: string;
  attendance_record_id: string;
  kind: string;
  [key: string]: unknown;
}


/**
 * `checkIn`/`checkOut` giu NGUYEN chu ky cu tu `mock/service.ts` (call site
 * o Task 3 khong phai sua). Diem khac biet CAN BAT BUOC voi khuon
 * `mutations/employees.ts`/`shifts.ts`/`departments.ts` (D-19, T-02-08-01):
 * DAU THOI GIAN VA NGAY CONG DEU DO SERVER CAP, khong bao gio den tu tham so
 * client. `date`/`time` con trong chu ky CHI de call site (Phase 2) khong
 * phai sua — `date` chi dung de DOI CHIEU voi ngay server (lech thi tu choi),
 * `time` KHONG duoc doc o dau ca. ATT-06 (Phase 3) se bo hoan toan hai tham
 * so nay khoi chu ky.
 *
 * Moi phep tinh thoi gian (do muon, ve som, so phut lam viec) di qua RPC cua
 * Phase 1 (`tf_work_date`, `tf_worked_minutes`, `tf_shift_minutes`) va RPC
 * moi cua migration 0010 (`tf_server_now`, `tf_local_instant`) — KHONG bao
 * gio tu tinh gio-tru-gio o tang ung dung, vi do la dung lai chinh dieu ma
 * <prohibitions> cua 02-08-PLAN.md cam (mot quy uoc mui gio/thoi gian thu
 * hai) va se lech voi database mot ngay nao do.
 *
 * ATT-01/ATT-02/ATT-04/ATT-06 (Phase 3, plan 03-01): them tham so `evidence`
 * (anh + toa do). `evidence` la OPTIONAL O MUC KIEU (khong phai o muc hanh
 * vi) chi vi mot ly do co chu dich, khong phai so xot: Task 2 cua plan nay
 * KHONG duoc phep sua `src/app/employee/employee-home-view.tsx` (file do
 * thuoc pham vi Task 3 — noi Camera Sheet duoc noi day), nhung call site cu
 * cua Task 3 (`checkInService(companyId, employeeId, today, time)`, 4 tham
 * so) van con nguyen cho toi khi Task 3 chay. Giu `evidence` optional o kieu
 * la cach DUY NHAT de `npm run typecheck` xanh cho CA HAI task ma khong phai
 * sua truoc mot file ngoai pham vi Task 2. VE HANH VI, `evidence` la BAT
 * BUOC: thieu no (undefined hoac khong qua duoc `punchEvidenceSchema`) nem
 * `AttendanceEvidenceError("missing_photo", ...)` TRUOC KHI cham Storage hay
 * ghi bat ky dong nao — khong co nhanh nao coi "khong co anh" la hop le.
 */
export async function checkIn(
  companyId: string,
  employeeId: string,
  date: string,
  time: string,
  evidence?: PunchEvidence,
): Promise<AttendanceRecord> {
  void companyId;
  void time;

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
    throw new AttendanceEvidenceError(
      "missing_photo",
      "Thiếu ảnh chấm công. Vui lòng chụp lại và gửi.",
    );
  }
  const punchEvidence = evidenceResult.data;

  const supabase = await createServerSupabase();

  // D-19: check_in_at LUON la dong ho cua database (tf_server_now()), khong
  // bao gio la tham so `time` ma noi goi truyen vao.
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

  // Tham so `date` do noi goi truyen vao CHI dung de doi chieu — lech thi tu
  // choi thay vi ghi mot ngay sai (T-02-08-01).
  if (date !== workDate) {
    throw new Error(
      "Ngày trên thiết bị của bạn không khớp với ngày của hệ thống. Vui lòng tải lại trang và thử lại.",
    );
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

  // ATT-02/ATT-07/D-20/D-20a: khoang cach do SERVER tinh qua tf_distance_meters(),
  // khong bao gio nhan tu tham so client. Doc moi work_sites dang is_active
  // cua doanh nghiep, giu diem GAN NHAT. Doanh nghiep chua khai diem lam
  // viec nao van cham cong duoc — ca hai gia tri de null va di tiep.
  // KHONG CO NHANH NAO so sanh khoang cach roi nem loi o duoi day: ngoai ban
  // kinh la mot ghi chu duoc chap nhan (D-20), khong phai dieu kien chan.
  const { data: workSiteRows, error: workSitesError } = await supabase
    .from("work_sites")
    .select("id, latitude, longitude")
    .eq("company_id", activeCompanyId)
    .eq("is_active", true);
  if (workSitesError) {
    throw new Error("Không thể tải danh sách điểm làm việc.");
  }

  let nearestWorkSiteId: string | null = null;
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
    }
  }

  // T-03-06/ATT-01: anh chi den tu khung hinh truc tiep (Blob dung canh
  // duoc kiem boi punchEvidenceSchema) — khong co duong nao khac de doc
  // duoc mot Blob tai day. photoId la uuid, KHONG PHAI so thu tu, de khong
  // ai liet ke duoc anh bang cach doan URL.
  const photoId = randomUUID();
  const storagePath = buildAttendancePhotoPath({
    companyId: activeCompanyId,
    employeeId,
    photoId,
    kind: "check_in",
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
  // la lop hai, cung khuon doc-truoc-insert-hoac-update nhu attendance_records
  // o tren.
  const { data: existingPhoto, error: existingPhotoError } = await supabase
    .from("attendance_photos")
    .select("id")
    .eq("attendance_record_id", resultRow.id)
    .eq("kind", "check_in")
    .eq("company_id", activeCompanyId)
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
      .eq("company_id", activeCompanyId)
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
        company_id: activeCompanyId,
        attendance_record_id: resultRow.id,
        kind: "check_in",
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
    companyId: activeCompanyId,
    actorUserId: userId,
    action: photoAuditAction,
    entityTable: "attendance_photos",
    entityId: photoRow.id,
    before: null,
    after: photoRow,
    reason: null,
  });

  return attendanceRecordSchema.parse(resultRow);
}

export async function checkOut(
  recordId: string,
  time: string,
): Promise<AttendanceRecord> {
  void time;

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
  // khong nhan `employeeId` lam tham so (giu nguyen chu ky cu) nen chu the
  // duoc suy tu chinh ban ghi vua doc.
  const isAdminRole = role === "owner" || role === "admin";
  if (!isAdminRole && beforeRow.employee_id !== sessionEmployeeId) {
    throw new ForbiddenError();
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
  // la mot phep cong EPOCH DON THUAN (khong phai mot quy uoc mui gio thu
  // hai) de ra thoi diem KET THUC CA THEO KE HOACH.
  const { data: rawShiftMinutes, error: shiftMinutesError } = await supabase.rpc(
    "tf_shift_minutes",
    { p_start: shift.start_time, p_end: shift.end_time, p_break_minutes: 0 },
  );
  if (shiftMinutesError || rawShiftMinutes === null) {
    throw new Error("Không thể tính thời lượng ca.");
  }
  const scheduledEnd = new Date(
    new Date(scheduledStart as string).getTime() + (rawShiftMinutes as number) * 60_000,
  ).toISOString();

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

  return attendanceRecordSchema.parse(afterRow);
}
