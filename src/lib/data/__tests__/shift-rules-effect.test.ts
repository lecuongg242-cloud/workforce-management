// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT (khuon `attendance-evidence.test.ts` cua
// 03-04): moi truong "node" de Blob toan cuc la Blob that cua Node (jsdom Blob
// khong tai len Storage that duoc), `createServerSupabase` mock ve mot client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getSessionContext } from "@/lib/auth/session-context";
import { checkIn, checkOut } from "@/lib/data/mutations/attendance";
import { updateShift } from "@/lib/data/mutations/shifts";
import { ATTENDANCE_PHOTO_BUCKET } from "@/lib/storage/attendance-photos";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PunchEvidence } from "@/lib/types/domain";

/**
 * BANG CHUNG HAI CHIEU cho SET-01 (plan 04-02 Task 1) — hai ve doi nhau cua
 * cung mot quy tac, va ca hai deu phai dung cung luc:
 *
 *   TIEU CHI 1 cua phase: doi an han di muon xong thi lan cham cong KE TIEP da
 *   phan loai theo nguong moi — khong co buoc "ap dung" nao o giua.
 *
 *   TIEU CHI 4 cua phase: ban ghi DA TON TAI khong doi. `late_minutes` duoc
 *   tinh luc cham roi luu vao dong (`mutations/attendance.ts`), nen lich su
 *   khong bi viet lai khi quy tac doi.
 *
 * Neu file nay do duoc chenh lech nao so voi mo ta tren thi day la phat hien
 * quan trong nhat cua plan, KHONG duoc sua test cho khop ma phai bao cao.
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

const SHIFT_ID = "sft-04-02-late";
const EMP_A = "emp-04-02-a";
const EMP_B = "emp-04-02-b";
const TEST_EMPLOYEE_IDS = [EMP_A, EMP_B];

/** So phut nhan vien den muon so voi gio bat dau ca theo ke hoach. */
const LATE_BY_MINUTES = 20;
const TOLERANCE_BEFORE = 30; // > 20 -> khong tinh muon
const TOLERANCE_AFTER = 5; // < 20 -> tinh muon ~15 phut

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

describe("Ân hạn đi muộn: hiệu lực ngay với lần chấm kế tiếp, bất động với bản ghi cũ (SET-01)", () => {
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
  let recordAId = "";
  /** Ban chup dong cua nhan vien A NGAY SAU khi cham cong, truoc moi thay doi quy tac. */
  let recordASnapshot: Record<string, unknown> | null = null;

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

  async function readRecord(recordId: string): Promise<Record<string, unknown>> {
    const { data, error } = await admin
      .from("attendance_records")
      .select("id, late_minutes, status, check_in_at, shift_id")
      .eq("id", recordId)
      .single();
    if (error || !data) {
      throw new Error(`Không đọc được bản ghi ${recordId}: ${error?.message}`);
    }
    return data as Record<string, unknown>;
  }

  beforeAll(async () => {
    actorEmail = `test-04-02-${randomUUID()}@timeflow.test`;
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

    const { data: nowIsoRaw, error: nowError } = await admin.rpc("tf_server_now");
    if (nowError || !nowIsoRaw) {
      throw new Error(`tf_server_now thất bại: ${nowError?.message}`);
    }
    const { hour, minute } = vnHourMinute(new Date(nowIsoRaw as string));
    const nowTotalMinutes = hour * 60 + minute;

    // Ca bat dau LATE_BY_MINUTES phut TRUOC hien tai va keo dai 8 tieng: moi
    // lan cham cong trong test nay deu muon dung ngan ay phut so voi ke hoach,
    // bat ke test chay vao gio nao trong ngay.
    const { error: shiftError } = await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Test ca ân hạn (04-02)",
      code: "T0402LATE",
      start_time: minutesToHms(nowTotalMinutes - LATE_BY_MINUTES),
      end_time: minutesToHms(nowTotalMinutes - LATE_BY_MINUTES + 8 * 60),
      break_minutes: 0,
      late_tolerance_minutes: TOLERANCE_BEFORE,
      working_days: [1, 2, 3, 4, 5, 6, 7],
      status: "active",
    });
    if (shiftError) {
      throw new Error(`Không tạo được shift test: ${shiftError.message}`);
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
      shift_id: SHIFT_ID,
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
        id: EMP_A,
        code: "T0402A",
        full_name: "Nhân viên test 04-02 A",
        email: `${EMP_A}@timeflow.test`,
      },
      {
        ...baseEmployee,
        id: EMP_B,
        code: "T0402B",
        full_name: "Nhân viên test 04-02 B",
        email: `${EMP_B}@timeflow.test`,
      },
    ]);
    if (employeesError) {
      throw new Error(`Không tạo được employees test: ${employeesError.message}`);
    }

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(ownerSession());
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
    await admin.from("attendance_records").delete().eq("shift_id", SHIFT_ID);
    await admin.from("shifts").delete().eq("id", SHIFT_ID);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. [tiêu chí 1] ân hạn 30 phút, đến muộn 20 phút -> late_minutes = 0, trạng thái on_time", async () => {
    const record = await checkIn(EMP_A, makeEvidence());
    recordAId = record.id;

    expect(record.lateMinutes).toBe(0);
    expect(record.status).toBe("on_time");

    recordASnapshot = await readRecord(recordAId);
  });

  it("2. [tiêu chí 1] siết ân hạn xuống 5 phút -> lần chấm KẾ TIẾP đã tính muộn, không có bước áp dụng nào ở giữa", async () => {
    await updateShift(SHIFT_ID, { lateToleranceMinutes: TOLERANCE_AFTER });

    const record = await checkIn(EMP_B, makeEvidence());

    expect(record.status).toBe("late");
    // ~15 phut (20 den muon - 5 an han); cho +-1 phut vi tf_worked_minutes lam
    // tron epoch va hai lan cham cach nhau vai giay.
    expect(record.lateMinutes).toBeGreaterThanOrEqual(
      LATE_BY_MINUTES - TOLERANCE_AFTER - 1,
    );
    expect(record.lateMinutes).toBeLessThanOrEqual(
      LATE_BY_MINUTES - TOLERANCE_AFTER + 1,
    );
  });

  it("3. [tiêu chí 4] bản ghi của nhân viên A giữ nguyên late_minutes/status sau khi ân hạn đổi", async () => {
    const after = await readRecord(recordAId);

    expect(after.late_minutes).toBe(0);
    expect(after.status).toBe("on_time");
    expect(after).toEqual(recordASnapshot);
  });

  it("4. [tiêu chí 4] đổi cả GIỜ BẮT ĐẦU ca cũng không chạm vào bản ghi đã có", async () => {
    const { data: shiftRow } = await admin
      .from("shifts")
      .select("start_time")
      .eq("id", SHIFT_ID)
      .single();
    const [hour, minute] = String(shiftRow?.start_time ?? "00:00:00")
      .split(":")
      .map(Number);

    await updateShift(SHIFT_ID, {
      startTime: minutesToHms(hour * 60 + minute - 30).slice(0, 5),
    });

    const after = await readRecord(recordAId);

    expect(after).toEqual(recordASnapshot);
  });

  it("5. lượt chấm THỨ HAI trong cùng ngày không bị tính muộn dù ân hạn đã siết (migration 0013 không bị phá)", async () => {
    await checkOut(recordAId, makeEvidence());
    const second = await checkIn(EMP_A, makeEvidence());

    expect(second.id).not.toBe(recordAId);
    expect(second.lateMinutes).toBe(0);
    expect(second.status).toBe("on_time");
  });
});
