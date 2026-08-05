// @vitest-environment node
//
// Moi truong mac dinh cua du an la jsdom (vitest.config.mts) — Blob toan cuc
// cua jsdom KHONG tuong thich voi phan than request cua undici/fetch ma
// storage-js dung de tai file len that (nem "fetch failed"/ECONNRESET sau
// ~15s, xac nhan bang debug thu cong: cung mot Blob thanh cong khi chay
// trong Node thuan nhung that bai trong jsdom). File nay ep moi truong ve
// "node" de Blob toan cuc la Blob that cua Node — dung mot Blob duy nhat cho
// CA HAI phia (punchEvidenceSchema.instanceof(Blob) va storage.upload()).
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AttendanceRejectedError, isAttendanceRejection } from "@/lib/attendance/rejection";
import { isOutsideShiftWindow } from "@/lib/attendance/suspicious";
import { toVnTime } from "@/lib/validation/api/attendance";
import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { checkIn, checkOut } from "@/lib/data/mutations/attendance";
import { ATTENDANCE_PHOTO_BUCKET } from "@/lib/storage/attendance-photos";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PunchEvidence } from "@/lib/types/domain";

/**
 * Test TICH HOP cho `checkIn`/`checkOut` (03-04-PLAN.md Task 2), chay TREN
 * POSTGRES DEV THAT DA SEED (khong phai mock in-memory) — cung khuon voi
 * `route.test.ts` cua 03-01: pgTAP khong dung duoc de kiem hanh vi Server
 * Action tang ung dung, va Docker khong co san trong moi truong thuc thi nay
 * de dung Postgres tam nhu CI.
 *
 * `createServerSupabase` duoc mock de tra ve mot client THAT dung
 * `SUPABASE_SECRET_KEY` (bo qua RLS co y: test nay do LOP UNG DUNG —
 * `.eq("company_id", ...)`/kiem quyen trong `mutations/attendance.ts` —
 * khong do lai RLS ma 01-01/01-04 da chung minh). `getSessionContext` duoc
 * mock de dong vai cac phien khac nhau.
 *
 * `audit_log.actor_user_id` co FK toi `auth.users` (xem ghi chu cung van de
 * o `attendance-photos.test.ts`) nen mot userId gia lap se vi pham rang
 * buoc do neu logMutation ghi that — file nay TAO MOT auth user THAT qua
 * Admin API trong `beforeAll` va XOA lai trong `afterAll`, khong insert
 * thang vao `auth.users`.
 *
 * DON DEP: moi fixture (employees/shifts/attendance_records/anh trong
 * Storage/auth user) do CHINH file nay tao ra va deu mang tien to
 * `emp-03-04-*`/`sft-03-04-*` — khong dung id trung voi du lieu seed. Xoa
 * `employees` cascade sang `attendance_records` roi `attendance_photos`
 * (ca hai FK deu `on delete cascade`, xem `0004_core_entities.sql`/
 * `0005_v2_tables.sql`), nen `afterAll` chi can xoa Storage + employees +
 * shift test + auth user, KHONG can xoa tay tung dong `attendance_records`/
 * `attendance_photos`.
 */

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

vi.mock("@/lib/auth/session-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session-context")>();
  return {
    ...actual,
    getSessionContext: vi.fn(),
  };
});

const COMPANY_ID = "cty-01";
const DEPARTMENT_ID = "dept-01";
const NORMAL_SHIFT_ID = "sft-01-day";
const FAR_SHIFT_ID = "sft-03-04-outside";
const NEAR_SHIFT_ID = "sft-03-04-current";

const EMP_EVI = "emp-03-04-evi";
const EMP_OUTSIDE = "emp-03-04-outside";
const EMP_NOCHECKIN = "emp-03-04-nocheckin";
const EMP_ROLE = "emp-03-04-role";
const EMP_FARIN = "emp-03-04-farin";
const TEST_EMPLOYEE_IDS = [EMP_EVI, EMP_OUTSIDE, EMP_NOCHECKIN, EMP_ROLE, EMP_FARIN];
const NOCHECKIN_RECORD_ID = "att-03-04-nocheckin";

/**
 * Toa do "GAN" dung o moi lan cham cong hop le trong file nay, va mot diem
 * lam viec DO CHINH FILE NAY TAO ra ngay tai toa do do.
 *
 * Truoc day cac test "khoang cach GAN" dua vao diem lam viec SEED cua
 * `cty-01` — mot dong du lieu ai dung app cung sua duoc. Khi diem seed bi
 * doi toa do, `isOutsideRadius` lat thanh true va bay test 4 cung toan bo
 * chuoi test phu thuoc no. Diem lam viec rieng nay lam cac khang dinh do
 * TAT DINH: khoang cach toi no luon bang 0 nen no luon la diem gan nhat,
 * bat ke du lieu seed thay doi ra sao. Dung tien to `ws-03-04-*` giong moi
 * fixture khac cua file va bi xoa trong afterAll.
 */
const NEAR_LAT = 10.7823;
const NEAR_LNG = 106.6958;
const TEST_WORK_SITE_ID = "ws-03-04-near";

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

/** Gio-phut theo gio VN cua mot khoanh khac — dung de dung mot ca "doi lap"
 * voi hien tai (cach 12 gio), bao dam test outside_shift luon nam ngoai bat
 * ky bien do an han nao du chay vao gio nao trong ngay. */
function vnHourMinute(instant: Date): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(instant);
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"),
  };
}

// Anh JPEG toi thieu hop le (SOI + EOI marker) — du de punchEvidenceSchema
// chap nhan MIME/kich thuoc va de Storage that nhan upload that.
const FAKE_JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function makeEvidence(latitude: number, longitude: number): PunchEvidence {
  return {
    photo: new Blob([FAKE_JPEG_BYTES], { type: "image/jpeg" }),
    latitude,
    longitude,
    accuracyMeters: 8,
  };
}

describe("checkIn/checkOut — bang chung ca hai dau ca, hai ly do tu choi server tu quyet (03-04)", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SECRET_KEY — test này chạy trên Postgres dev thật đã seed, cần .env.local.",
    );
  }
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let actorUserId = "";
  let actorEmail = "";
  let workDate = "";
  let lifecycleRecordId = "";
  let roleRecordId = "";

  function ownerSession(employeeId: string | null = null) {
    return {
      userId: actorUserId,
      email: actorEmail,
      companyId: COMPANY_ID,
      role: "owner" as const,
      employeeId,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  function employeeSession(employeeId: string) {
    return {
      userId: actorUserId,
      email: actorEmail,
      companyId: COMPANY_ID,
      role: "employee" as const,
      employeeId,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  beforeAll(async () => {
    actorEmail = `test-03-04-${randomUUID()}@timeflow.test`;
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email: actorEmail,
      password: randomUUID(),
      email_confirm: true,
    });
    if (createUserError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${createUserError?.message}`);
    }
    actorUserId = createdUser.user.id;

    const { data: nowIsoRaw, error: nowError } = await admin.rpc("tf_server_now");
    if (nowError || !nowIsoRaw) {
      throw new Error(`tf_server_now thất bại: ${nowError?.message}`);
    }
    const nowIso = nowIsoRaw as string;

    const { data: workDateRaw, error: workDateError } = await admin.rpc("tf_work_date", {
      p_instant: nowIso,
    });
    if (workDateError || !workDateRaw) {
      throw new Error(`tf_work_date thất bại: ${workDateError?.message}`);
    }
    workDate = workDateRaw as string;

    // Ca "doi lap" voi hien tai (cach 12 gio, rong 1 phut) — cach 12 gio
    // luon vuot xa SHIFT_WINDOW_GRACE_MINUTES (120 phut) o ca hai huong, bat
    // ke test chay vao thoi diem nao trong ngay. Dung cho test outside_shift.
    //
    // Ca "chua hien tai" (± 30 phut quanh gio-phut hien tai) — KHONG the
    // dung san sft-01-day (08:00-17:30): test tich hop nay co the chay vao
    // buoi toi/dem, luc do sft-01-day + 120 phut an han van khong chua "bay
    // gio". Dung cho moi test ky vong checkIn/checkOut THANH CONG.
    const { hour, minute } = vnHourMinute(new Date(nowIso));
    const nowTotalMinutes = hour * 60 + minute;

    function minutesToHms(totalMinutesFromMidnight: number): string {
      const wrapped = ((totalMinutesFromMidnight % 1440) + 1440) % 1440;
      return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}:00`;
    }

    const farShiftStart = minutesToHms(nowTotalMinutes + 12 * 60);
    const farShiftEnd = minutesToHms(nowTotalMinutes + 12 * 60 + 1);
    const nearShiftStart = minutesToHms(nowTotalMinutes - 30);
    const nearShiftEnd = minutesToHms(nowTotalMinutes + 30);

    const { error: farShiftError } = await admin.from("shifts").insert([
      {
        id: FAR_SHIFT_ID,
        company_id: COMPANY_ID,
        name: "Test ca đối lập hiện tại (03-04)",
        code: "T0304FAR",
        start_time: farShiftStart,
        end_time: farShiftEnd,
        break_minutes: 0,
        late_tolerance_minutes: 0,
        working_days: [1, 2, 3, 4, 5, 6, 7],
        status: "active",
      },
      {
        id: NEAR_SHIFT_ID,
        company_id: COMPANY_ID,
        name: "Test ca chứa hiện tại (03-04)",
        code: "T0304NOW",
        start_time: nearShiftStart,
        end_time: nearShiftEnd,
        break_minutes: 0,
        late_tolerance_minutes: 0,
        working_days: [1, 2, 3, 4, 5, 6, 7],
        status: "active",
      },
    ]);
    if (farShiftError) {
      throw new Error(`Không tạo được shift test: ${farShiftError.message}`);
    }

    const baseEmployee = {
      company_id: COMPANY_ID,
      full_name: "Nhân viên test 03-04",
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male" as const,
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Test",
      contract_type: "full_time" as const,
      start_date: "2024-01-01",
      manager_id: null,
      work_location: "Văn phòng chính",
      status: "active" as const,
      system_role: "employee" as const,
      invitation_sent: false,
      can_view_payslip: false,
      can_check_in_remotely: false,
      user_id: null,
    };

    const employeeRows = [
      { id: EMP_EVI, code: "T0304EVI", shift_id: NEAR_SHIFT_ID },
      { id: EMP_OUTSIDE, code: "T0304OUT", shift_id: FAR_SHIFT_ID },
      { id: EMP_NOCHECKIN, code: "T0304NOK", shift_id: NORMAL_SHIFT_ID },
      { id: EMP_ROLE, code: "T0304ROLE", shift_id: NEAR_SHIFT_ID },
      { id: EMP_FARIN, code: "T0304FARIN", shift_id: NEAR_SHIFT_ID },
    ].map((row) => ({
      ...baseEmployee,
      id: row.id,
      code: row.code,
      shift_id: row.shift_id,
      email: `${row.id}@timeflow.test`,
    }));

    const { error: employeesError } = await admin.from("employees").insert(employeeRows);
    if (employeesError) {
      throw new Error(`Không tạo được employees test: ${employeesError.message}`);
    }

    // Diem lam viec RIENG cua file test, dat dung tai toa do "GAN" — xem ghi
    // chu tai TEST_WORK_SITE_ID.
    const { error: workSiteError } = await admin.from("work_sites").insert({
      id: TEST_WORK_SITE_ID,
      company_id: COMPANY_ID,
      name: "Điểm làm việc test 03-04",
      latitude: NEAR_LAT,
      longitude: NEAR_LNG,
      radius_meters: 150,
      is_active: true,
    });
    if (workSiteError) {
      throw new Error(`Không tạo được work_site test: ${workSiteError.message}`);
    }

    // Ban ghi "chua vao ca" dung THANG (khong qua checkIn) — cho test
    // checkOut cho mot ban ghi khong co check_in_at.
    const { error: nocheckinError } = await admin.from("attendance_records").insert({
      id: NOCHECKIN_RECORD_ID,
      company_id: COMPANY_ID,
      employee_id: EMP_NOCHECKIN,
      work_date: workDate,
      shift_id: NORMAL_SHIFT_ID,
      check_in_at: null,
      check_out_at: null,
      worked_minutes: 0,
      late_minutes: 0,
      early_leave_minutes: 0,
      status: "on_time",
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    });
    if (nocheckinError) {
      throw new Error(`Không tạo được bản ghi chưa vào ca: ${nocheckinError.message}`);
    }

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
  });

  afterAll(async () => {
    for (const employeeId of TEST_EMPLOYEE_IDS) {
      const { data: files } = await admin.storage
        .from(ATTENDANCE_PHOTO_BUCKET)
        .list(`${COMPANY_ID}/${employeeId}`);
      if (files && files.length > 0) {
        await admin.storage
          .from(ATTENDANCE_PHOTO_BUCKET)
          .remove(files.map((file) => `${COMPANY_ID}/${employeeId}/${file.name}`));
      }
    }
    // employees cascade sang attendance_records roi attendance_photos.
    await admin.from("employees").delete().in("id", TEST_EMPLOYEE_IDS);
    await admin.from("shifts").delete().in("id", [FAR_SHIFT_ID, NEAR_SHIFT_ID]);
    await admin.from("work_sites").delete().eq("id", TEST_WORK_SITE_ID);
    if (actorUserId) {
      await admin.auth.admin.deleteUser(actorUserId);
    }
  });

  afterEach(() => {
    vi.mocked(getSessionContext).mockReset();
  });

  describe("AttendanceRejectedError / isAttendanceRejection", () => {
    it("1. isAttendanceRejection trả true cho AttendanceRejectedError, false cho Error thường", () => {
      const rejected = new AttendanceRejectedError("missing_photo");
      expect(isAttendanceRejection(rejected)).toBe(true);
      expect(isAttendanceRejection(new Error("lỗi thường"))).toBe(false);
    });
  });

  describe("checkIn — missing_photo (D-20b)", () => {
    it("2. Không có evidence hợp lệ -> AttendanceRejectedError(missing_photo), không ghi dòng nào", async () => {
      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      let caught: unknown;
      try {
        await checkIn(EMP_EVI, undefined);
      } catch (cause) {
        caught = cause;
      }
      expect(caught).toBeInstanceOf(AttendanceRejectedError);
      expect((caught as AttendanceRejectedError).reason).toBe("missing_photo");

      const { count } = await admin
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", EMP_EVI)
        .eq("work_date", workDate);
      expect(count).toBe(0);
    });
  });

  /**
   * Thay cho nhom "outside_shift chan cham cong" cu (T-03-04-01). Cham cong
   * ngoai khung gio ca KHONG con bi tu choi — no duoc GHI NHAN roi danh dau
   * de quan ly xem lai, cung nguyen tac ma D-20 da ap cho khoang cach.
   */
  describe("checkIn — ngoài khung giờ ca được ghi nhận rồi đánh dấu, KHÔNG chặn", () => {
    it("3. Chấm công ở ca đối lập 12 giờ với hiện tại -> ghi nhận thành công, KHÔNG ném lỗi", async () => {
      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      const result = await checkIn(EMP_OUTSIDE, makeEvidence(10.7823, 106.6958));

      expect(result.checkIn).not.toBeNull();

      const { count } = await admin
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", EMP_OUTSIDE);
      expect(count).toBe(1);
    });

    it("3b. Lượt đó bị nhận diện là ngoài khung giờ ca khi truy vấn (tính lại từ giờ chấm + giờ ca, không đọc cột nào)", async () => {
      const { data } = await admin
        .from("attendance_records")
        .select("check_in_at, shifts(start_time, end_time)")
        .eq("employee_id", EMP_OUTSIDE)
        .single();
      const row = data as unknown as {
        check_in_at: string;
        shifts: { start_time: string; end_time: string };
      };

      expect(
        isOutsideShiftWindow({
          punchTime: toVnTime(row.check_in_at) as string,
          shiftStartTime: row.shifts.start_time.slice(0, 5),
          shiftEndTime: row.shifts.end_time.slice(0, 5),
        }),
      ).toBe(true);
    });
  });

  describe("Vòng đời một ca: checkIn -> checkOut, cả hai mang bằng chứng riêng", () => {
    it("4. checkIn với evidence hợp lệ ghi nhận thành công, khoảng cách GẦN (không bị đánh dấu)", async () => {
      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      const result = await checkIn(EMP_EVI, makeEvidence(10.7823, 106.6958));
      expect(result.checkIn).not.toBeNull();
      expect(result.isOutsideRadius).toBe(false);
      expect(result.distanceMeters).not.toBeNull();
      lifecycleRecordId = result.id;
    });

    it("5. checkOut không có evidence hợp lệ -> AttendanceRejectedError(missing_photo)", async () => {
      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      let caught: unknown;
      try {
        await checkOut(lifecycleRecordId, undefined);
      } catch (cause) {
        caught = cause;
      }
      expect(caught).toBeInstanceOf(AttendanceRejectedError);
      expect((caught as AttendanceRejectedError).reason).toBe("missing_photo");
    });

    it("6. checkOut với evidence hợp lệ (toạ độ XA — Hà Nội) vẫn thành công, đánh dấu isOutsideRadius=true — không nhánh nào chặn theo khoảng cách", async () => {
      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      const result = await checkOut(lifecycleRecordId, makeEvidence(21.0285, 105.8542));
      expect(result.checkOut).not.toBeNull();
      expect(result.isOutsideRadius).toBe(true);
      expect(result.distanceMeters).not.toBeNull();
      expect(result.distanceMeters as number).toBeGreaterThan(1000);
    });

    it("7. Sau một lần vào rồi ra đầy đủ, bản ghi có đúng HAI dòng attendance_photos, một mỗi loại", async () => {
      const { data, error } = await admin
        .from("attendance_photos")
        .select("kind")
        .eq("attendance_record_id", lifecycleRecordId);
      expect(error).toBeNull();
      const kinds = (data ?? []).map((row) => (row as { kind: string }).kind).sort();
      expect(kinds).toEqual(["check_in", "check_out"]);
    });

    it("8. checkOut đo khoảng cách ĐỘC LẬP — toạ độ/khoảng cách của lần vào không bị chép sang lần ra", async () => {
      const { data, error } = await admin
        .from("attendance_photos")
        .select("kind, latitude, longitude, distance_meters")
        .eq("attendance_record_id", lifecycleRecordId);
      expect(error).toBeNull();
      const rows = (data ?? []) as {
        kind: string;
        latitude: number;
        longitude: number;
        distance_meters: number | null;
      }[];
      const checkInRow = rows.find((row) => row.kind === "check_in");
      const checkOutRow = rows.find((row) => row.kind === "check_out");
      expect(checkInRow).toBeDefined();
      expect(checkOutRow).toBeDefined();
      expect(checkOutRow?.latitude).not.toBe(checkInRow?.latitude);
      expect(checkOutRow?.distance_meters).not.toBe(checkInRow?.distance_meters);
    });

    it("9. Tan ca lần thứ hai trên cùng bản ghi CẬP NHẬT dòng ảnh check_out đang có, không tạo dòng thứ ba", async () => {
      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      await checkOut(lifecycleRecordId, makeEvidence(21.03, 105.85));

      const { count } = await admin
        .from("attendance_photos")
        .select("id", { count: "exact", head: true })
        .eq("attendance_record_id", lifecycleRecordId);
      expect(count).toBe(2);
    });

    it("10. Một lần tan ca để lại đúng hai dòng audit_log mới: một cho attendance_records, một cho attendance_photos", async () => {
      const { data: checkpointRaw } = await admin.rpc("tf_server_now");
      const checkpoint = checkpointRaw as string;

      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      await checkOut(lifecycleRecordId, makeEvidence(21.05, 105.87));

      const { count: recordAuditCount } = await admin
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("entity_table", "attendance_records")
        .eq("entity_id", lifecycleRecordId)
        .gt("created_at", checkpoint);
      const { count: photoAuditCount } = await admin
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("entity_table", "attendance_photos")
        .gt("created_at", checkpoint);

      expect(recordAuditCount).toBe(1);
      expect(photoAuditCount).toBe(1);
    });
  });

  describe("checkOut — outside_shift khi bản ghi chưa có giờ vào", () => {
    it("11. checkOut cho bản ghi check_in_at = null -> AttendanceRejectedError(outside_shift)", async () => {
      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      let caught: unknown;
      try {
        await checkOut(NOCHECKIN_RECORD_ID, makeEvidence(10.7823, 106.6958));
      } catch (cause) {
        caught = cause;
      }
      expect(caught).toBeInstanceOf(AttendanceRejectedError);
      expect((caught as AttendanceRejectedError).reason).toBe("outside_shift");
    });
  });

  describe("checkOut — xuyên doanh nghiệp", () => {
    it("12. checkOut cho recordId thuộc doanh nghiệp khác (att-02a, session cty-01) -> ném lỗi thường (KHÔNG PHẢI AttendanceRejectedError), không đổi dữ liệu", async () => {
      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      let caught: unknown;
      try {
        await checkOut("att-02a", makeEvidence(10.7823, 106.6958));
      } catch (cause) {
        caught = cause;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(isAttendanceRejection(caught)).toBe(false);

      const { data } = await admin
        .from("attendance_records")
        .select("check_out_at")
        .eq("id", "att-02a")
        .maybeSingle();
      expect((data as { check_out_at: string | null } | null)?.check_out_at ?? null).toBeNull();
    });
  });

  describe("checkOut — phân quyền: employee/manager chỉ tan ca cho chính mình", () => {
    it("13. Chuẩn bị: checkIn cho EMP_ROLE (session owner) để có bản ghi đã vào ca", async () => {
      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      const result = await checkIn(EMP_ROLE, makeEvidence(10.7823, 106.6958));
      roleRecordId = result.id;
      expect(result.checkIn).not.toBeNull();
    });

    it("14. Vai trò employee với employeeId KHÁC chủ bản ghi -> ForbiddenError, kiểm tra chạy TRƯỚC mọi thao tác Storage (không tạo dòng ảnh check_out)", async () => {
      vi.mocked(getSessionContext).mockResolvedValue(employeeSession(EMP_EVI));
      let caught: unknown;
      try {
        await checkOut(roleRecordId, makeEvidence(10.7823, 106.6958));
      } catch (cause) {
        caught = cause;
      }
      expect(caught).toBeInstanceOf(ForbiddenError);

      const { count } = await admin
        .from("attendance_photos")
        .select("id", { count: "exact", head: true })
        .eq("attendance_record_id", roleRecordId)
        .eq("kind", "check_out");
      expect(count).toBe(0);
    });
  });

  describe("checkIn — không nhánh nào chặn theo khoảng cách", () => {
    it("15. checkIn với toạ độ XA (Hà Nội) vẫn thành công, đánh dấu isOutsideRadius=true", async () => {
      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      const result = await checkIn(EMP_FARIN, makeEvidence(21.0285, 105.8542));
      expect(result.checkIn).not.toBeNull();
      expect(result.isOutsideRadius).toBe(true);
    });
  });

  /**
   * Thay cho nhom CR-01 cu (03-REVIEW.md), da bi thay the boi migration 0013:
   * mot ngay duoc phep co NHIEU luot vao/ra. Y DINH GOC cua CR-01 van duoc
   * giu nguyen va la dieu ba test duoi day khoa lai — "vao lai" TUYET DOI
   * khong duoc ghi de bang chung tan ca da co; no phai tao mot dong MOI.
   */
  describe("checkIn — vào lại sau khi đã tan ca tạo LƯỢT MỚI, không ghi đè lượt cũ (migration 0013)", () => {
    let secondPunchId = "";

    it("16. checkIn lại trên ngày ĐÃ có một lượt tan ca xong -> tạo dòng MỚI, dòng cũ giữ nguyên check_out_at/worked_minutes/early_leave_minutes", async () => {
      const { data: beforeRow, error: beforeError } = await admin
        .from("attendance_records")
        .select("check_out_at, worked_minutes, early_leave_minutes")
        .eq("id", lifecycleRecordId)
        .single();
      expect(beforeError).toBeNull();
      const before = beforeRow as {
        check_out_at: string | null;
        worked_minutes: number;
        early_leave_minutes: number;
      };
      // Vòng đời test 4→10 đã tan ca cho lifecycleRecordId — bản ghi PHẢI
      // đã có check_out_at trước khi test này chạy, nếu không phép so sánh
      // "giữ nguyên" bên dưới sẽ vô nghĩa (so 2 giá trị null với nhau).
      expect(before.check_out_at).not.toBeNull();

      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      const result = await checkIn(EMP_EVI, makeEvidence(10.7823, 106.6958));
      secondPunchId = result.id;

      expect(result.id).not.toBe(lifecycleRecordId);
      expect(result.checkIn).not.toBeNull();
      expect(result.checkOut).toBeNull();

      const { data: afterRow, error: afterError } = await admin
        .from("attendance_records")
        .select("check_out_at, worked_minutes, early_leave_minutes")
        .eq("id", lifecycleRecordId)
        .single();
      expect(afterError).toBeNull();
      const after = afterRow as {
        check_out_at: string | null;
        worked_minutes: number;
        early_leave_minutes: number;
      };
      expect(after.check_out_at).toBe(before.check_out_at);
      expect(after.worked_minutes).toBe(before.worked_minutes);
      expect(after.early_leave_minutes).toBe(before.early_leave_minutes);
    });

    it("17. lượt thứ hai KHÔNG tính đi muộn — chỉ lượt đầu tiên của ngày mới tính", async () => {
      const { data, error } = await admin
        .from("attendance_records")
        .select("late_minutes, status")
        .eq("id", secondPunchId)
        .single();
      expect(error).toBeNull();
      const row = data as { late_minutes: number; status: string };

      expect(row.late_minutes).toBe(0);
      expect(row.status).toBe("on_time");
    });

    it("18. đang còn một lượt chưa tan ca -> checkIn lần nữa bị chặn, KHÔNG tạo dòng thứ ba", async () => {
      const { count: countBefore } = await admin
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", EMP_EVI);

      vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
      let caught: unknown;
      try {
        await checkIn(EMP_EVI, makeEvidence(10.7823, 106.6958));
      } catch (cause) {
        caught = cause;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toContain("chưa tan ca");

      const { count: countAfter } = await admin
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", EMP_EVI);
      expect(countAfter).toBe(countBefore);
    });
  });
});
