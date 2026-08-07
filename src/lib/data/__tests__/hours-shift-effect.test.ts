// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT — cung khuon `shift-rules-effect.test.ts`
// (04-02): moi truong "node" de Blob toan cuc la Blob that cua Node,
// `createServerSupabase` mock ve mot client dung `SUPABASE_SECRET_KEY`,
// `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getSessionContext } from "@/lib/auth/session-context";
import { checkIn, checkOut } from "@/lib/data/mutations/attendance";
import { resolveHoursShiftId } from "@/lib/shifts/resolve-hours-shift";
import { ATTENDANCE_PHOTO_BUCKET } from "@/lib/storage/attendance-photos";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PunchEvidence } from "@/lib/types/domain";

/**
 * CA LINH HOAT (migration 0027) tu dau den cuoi: tao ca -> cham cong -> tan ca.
 *
 * Hai khang dinh trung tam, va chung la HAI VE DOI NHAU cua cung mot quy tac:
 *
 *   (1) Ca linh hoat KHONG tinh di muon va KHONG tinh ve som. Khong co gio moc
 *       thi khong co gi de muon so voi — day la dinh nghia cua loai ca do,
 *       khong phai mot ngoai le bo qua cho tien.
 *
 *   (2) Ca CO GIO CU THE dat o dung tinh huong ay VAN tinh muon nhu cu. Neu
 *       thieu ve nay thi bai (1) van xanh ke ca khi ai do vo tinh tat phep tinh
 *       muon cho MOI loai ca — va khi ay bao cao di muon cua ca doanh nghiep
 *       im lang tro thanh rong.
 *
 * Neu file nay do duoc chenh lech nao so voi mo ta tren thi KHONG duoc sua test
 * cho khop ma phai bao cao.
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

const FIXED_SHIFT_ID = "sft-0027-fixed";
const EMP_FLEX = "emp-0027-flex";
const EMP_FIXED = "emp-0027-fixed";
const TEST_EMPLOYEE_IDS = [EMP_FLEX, EMP_FIXED];

/** So phut nhan vien den muon so voi gio bat dau ca CO GIO CU THE. */
const LATE_BY_MINUTES = 40;
const TOLERANCE = 5;

/** Ca linh hoat cua test: 10 tieng — dung vi du trong yeu cau goc. */
const FLEX_HOURS = 10;

const FAKE_JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function makeEvidence(): PunchEvidence {
  return {
    photo: new Blob([FAKE_JPEG_BYTES], { type: "image/jpeg" }),
    latitude: 10.7823,
    longitude: 106.6958,
    accuracyMeters: 8,
  };
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

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

function minutesToHms(totalMinutesFromMidnight: number): string {
  const wrapped = ((totalMinutesFromMidnight % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}:00`;
}

describe("Ca linh hoạt (0027): không tính đi muộn, không tính về sớm, và dùng chung một dòng shifts", () => {
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
  let flexShiftId = "";
  let flexRecordId = "";
  /** So phut di muon ma ca doi chung thuc su dung duoc — xem `beforeAll`. */
  let expectedLateMinutes = 0;

  /**
   * So phut tinh tu nua dem theo gio VN, doc tu DONG HO MAY CHU.
   *
   * Phai la dong ho may chu chu khong phai dong ho may chay test: production
   * lay `tf_server_now()`, va hai dong ho lech nhau vai phut se lam moc ca
   * lech theo.
   *
   * DUNG LUC 00:00 khong co moc nao trong qua khu de di muon so voi, nen ham
   * cho sang phut ke tiep. Toi da mot phut, va chi mot lan trong ngay.
   */
  async function vnMinutesFromMidnight(): Promise<number> {
    for (;;) {
      const { data: nowIso, error } = await admin.rpc("tf_server_now");
      if (error || !nowIso) {
        throw new Error(`tf_server_now thất bại: ${error?.message}`);
      }
      const { hour, minute } = vnHourMinute(new Date(nowIso as string));
      const total = hour * 60 + minute;
      if (total > 0) return total;
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }

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

  beforeAll(async () => {
    actorEmail = `test-0027-${randomUUID()}@timeflow.test`;
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: actorEmail,
        password: randomUUID(),
        email_confirm: true,
      });
    if (createUserError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${createUserError?.message}`);
    }
    actorUserId = createdUser.user.id;

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(ownerSession());

    flexShiftId = await resolveHoursShiftId({
      supabase: admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
      companyId: COMPANY_ID,
      actorUserId,
      hours: FLEX_HOURS,
      workingDays: [1, 2, 3, 4, 5, 6, 7],
    });

    const nowTotalMinutes = await vnMinutesFromMidnight();

    /**
     * MOC CA PHAI NAM TRONG QUA KHU CUA CHINH NGAY HOM NAY.
     *
     * `shifts.start_time` chi luu GIO TRONG NGAY. Production ghep no voi NGAY
     * CONG cua chinh luot cham (`tf_work_date`, quy uoc D-08 o migration
     * 0003) — tuc HOM NAY. Nen mot gio "40 phut truoc" ma tru qua nua dem se
     * bi `minutesToHms()` cuon thanh 23:xx CUA CHINH HOM NAY: gan 24 tieng
     * trong TUONG LAI. Khi ay `tf_worked_minutes` tra 0 va nguoi cham cong
     * luc 00:19 duoc ghi la dung gio — bai test do vi mot ly do khong lien
     * quan gi den dieu no muon kiem.
     *
     * Kep o 00:00 lam moc som nhat co the: khoang di muon dung duoc luon la
     * `nowTotalMinutes`, khong bao gio vuot qua no.
     */
    const startMinutes = Math.max(nowTotalMinutes - LATE_BY_MINUTES, 0);
    const availableLateMinutes = nowTotalMinutes - startMinutes;
    // An han chi giu duoc khi con du khoang de tru no ra. Sat nua dem thi
    // khong con — bo an han o do de ve doi chung van dung duoc, thay vi mat
    // han bai kiem trong 45 phut dau moi ngay.
    const tolerance = availableLateMinutes > TOLERANCE ? TOLERANCE : 0;
    expectedLateMinutes = availableLateMinutes - tolerance;

    const { error: shiftError } = await admin.from("shifts").insert({
      id: FIXED_SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Test ca có giờ (0027)",
      code: "T0027FIX",
      kind: "fixed",
      start_time: minutesToHms(startMinutes),
      end_time: minutesToHms(startMinutes + 8 * 60),
      duration_minutes: null,
      break_minutes: 0,
      late_tolerance_minutes: tolerance,
      working_days: [1, 2, 3, 4, 5, 6, 7],
      status: "active",
    });
    if (shiftError) {
      throw new Error(`Không tạo được shift đối chứng: ${shiftError.message}`);
    }

    const baseEmployee = {
      company_id: COMPANY_ID,
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

    const { error: employeesError } = await admin.from("employees").insert([
      {
        ...baseEmployee,
        id: EMP_FLEX,
        code: "T0027FLEX",
        full_name: "Nhân viên ca linh hoạt",
        email: `${EMP_FLEX}@timeflow.test`,
        shift_id: flexShiftId,
      },
      {
        ...baseEmployee,
        id: EMP_FIXED,
        code: "T0027FIX",
        full_name: "Nhân viên ca có giờ",
        email: `${EMP_FIXED}@timeflow.test`,
        shift_id: FIXED_SHIFT_ID,
      },
    ]);
    if (employeesError) {
      throw new Error(`Không tạo được employees test: ${employeesError.message}`);
    }
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
    await admin.from("attendance_records").delete().eq("shift_id", FIXED_SHIFT_ID);
    await admin.from("attendance_records").delete().eq("shift_id", flexShiftId);
    await admin.from("shifts").delete().eq("id", FIXED_SHIFT_ID);
    await admin.from("shifts").delete().eq("id", flexShiftId);
    await admin.from("audit_log").delete().eq("entity_id", flexShiftId);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. ca linh hoạt lưu đúng hình dạng: không giờ vào/ra, có độ dài, không giờ nghỉ", async () => {
    const { data, error } = await admin
      .from("shifts")
      .select("kind, start_time, end_time, duration_minutes, break_minutes, late_tolerance_minutes, overnight")
      .eq("id", flexShiftId)
      .single();
    if (error || !data) throw new Error(`Không đọc được ca linh hoạt: ${error?.message}`);

    expect(data.kind).toBe("hours");
    expect(data.start_time).toBeNull();
    expect(data.end_time).toBeNull();
    expect(data.duration_minutes).toBe(FLEX_HOURS * 60);
    expect(data.break_minutes).toBe(0);
    expect(data.late_tolerance_minutes).toBe(0);
    // Khong co gio ket thuc thi khong co gi vat qua nua dem — `false`, khong
    // phai `null` (cot sinh cua 0027 boc qua `coalesce`).
    expect(data.overnight).toBe(false);
  });

  it("2. chấm công ca linh hoạt -> late_minutes = 0, trạng thái on_time", async () => {
    const record = await checkIn(EMP_FLEX, makeEvidence());
    flexRecordId = record.id;

    expect(record.lateMinutes).toBe(0);
    expect(record.status).toBe("on_time");
  });

  it("3. tan ca ngay sau đó -> early_leave_minutes = 0, KHÔNG bị coi là về sớm", async () => {
    const record = await checkOut(flexRecordId, makeEvidence());

    expect(record.earlyLeaveMinutes).toBe(0);
    expect(record.status).toBe("on_time");
  });

  it("4. [vế đối chứng] ca CÓ GIỜ ở đúng tình huống ấy VẪN tính muộn — phép tính muộn không bị tắt cho mọi loại ca", async () => {
    const record = await checkIn(EMP_FIXED, makeEvidence());

    expect(record.status).toBe("late");
    // Con so ky vong duoc SUY TU moc ca that (xem `beforeAll`) chu khong viet
    // cung 35: sat nua dem, khoang di muon dung duoc bi kep lai va mot con so
    // viet cung se sai.
    //
    // Bien do: −1 phut vi `tf_worked_minutes` lam tron epoch; +2 phut vi cac
    // bai 1-3 chay truoc bai nay va thoi gian troi qua lam nguoi cham cong
    // muon THEM vai chuc giay so voi luc dung ca.
    expect(record.lateMinutes).toBeGreaterThanOrEqual(expectedLateMinutes - 1);
    expect(record.lateMinutes).toBeLessThanOrEqual(expectedLateMinutes + 2);
  });

  it("5. khai lại ĐÚNG số giờ đó -> DÙNG LẠI ca cũ, không sinh dòng shifts thứ hai", async () => {
    const again = await resolveHoursShiftId({
      supabase: admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
      companyId: COMPANY_ID,
      actorUserId,
      hours: FLEX_HOURS,
      workingDays: [1, 2, 3],
    });

    expect(again).toBe(flexShiftId);

    // Va lich cua ca da co san KHONG bi loi goi thu hai sua — doi no se doi
    // cach tinh cong cua MOI nguoi dang dung ca do.
    const { data } = await admin
      .from("shifts")
      .select("working_days")
      .eq("id", flexShiftId)
      .single();

    expect(data?.working_days).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("6. database từ chối ca linh hoạt khai kèm giờ vào (shifts_shape_check)", async () => {
    const { error } = await admin.from("shifts").insert({
      id: "sft-0027-invalid",
      company_id: COMPANY_ID,
      name: "Ca sai hình dạng",
      code: "T0027BAD",
      kind: "hours",
      start_time: "08:00:00",
      end_time: "18:00:00",
      duration_minutes: 600,
      break_minutes: 0,
      late_tolerance_minutes: 0,
      working_days: [1, 2, 3, 4, 5],
      status: "active",
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("shifts_shape_check");
  });
});
