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
/** Ca QUA DEM — dung cho phep kiem moc bat dau ca lui ve hom qua. */
const NIGHT_SHIFT_ID = "sft-04-02-night";
const EMP_NIGHT = "emp-04-02-night";
const TEST_EMPLOYEE_IDS = [EMP_A, EMP_B, EMP_NIGHT];

/**
 * So phut nhan vien den muon so voi gio bat dau ca theo ke hoach — gia tri
 * MONG MUON. Con so THAT duoc chot o `beforeAll` qua `resolveTiming()`, vi no
 * con phu thuoc gio chay test (xem giai thich o do).
 */
const LATE_BY_MINUTES = 20;

/**
 * Chot ba con so thoi gian cua ca test tu "so phut da troi qua ke tu nua dem".
 *
 * VI SAO KHONG DUNG THANG `now - 20 phut`:
 * `checkIn()` do muon bang `now` tru `tf_local_instant(tf_work_date(now),
 * shift.start_time)`, ma `tf_work_date` chi la NGAY LICH theo mui gio VN
 * (`0003_enums_time.sql:67-73`) — no khong lui ngay cho ca qua dem. Nen khi
 * test chay trong ~20 phut dau sau nua dem, `now - 20` am, `minutesToHms`
 * cuon vong thanh 23:4x, va `end_time < start_time` lam cot sinh `overnight`
 * bat true. Luc do gio bat dau ca theo ke hoach duoc giai ra la 23:4x TOI NAY
 * — mot moc trong TUONG LAI — nen so phut muon am, bi kep ve 0, va ban ghi ra
 * `on_time` thay vi `late`.
 *
 * Do la mot loi cua chinh fixture nay, khong phai cua san pham: no do TAT
 * DINH trong khoang 00:00-00:19 moi dem. Sua bang cach lay do muon KHONG BAO
 * GIO vuot qua so phut da troi qua trong ngay, de ca luon nam gon trong mot
 * ngay lich.
 */
function resolveTiming(nowTotalMinutes: number): {
  lateBy: number;
  toleranceBefore: number;
  toleranceAfter: number;
} | null {
  // 00:00 va 00:01 — khong ton tai gio bat dau ca nao vua TRUOC hien tai vua
  // CUNG ngay lich, va "muon 1 phut" thi lam tron giay co the ra 0 nen khang
  // dinh se bap benh. Tra null de noi goi bo qua co ly do, thay vi nem loi
  // lam do ca file cho mot kich ban BAT KHA THI chu khong phai that bai.
  if (nowTotalMinutes < 2) return null;
  const lateBy = Math.min(LATE_BY_MINUTES, nowTotalMinutes);
  return {
    lateBy,
    // Luon LON HON do muon -> khong tinh muon.
    toleranceBefore: lateBy + 10,
    // Luon NHO HON do muon -> tinh muon dung (lateBy - toleranceAfter) phut.
    toleranceAfter: Math.max(0, lateBy - 15),
  };
}

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
  /** Chot o `beforeAll` — xem `resolveTiming()`. */
  let timing: NonNullable<ReturnType<typeof resolveTiming>>;
  /** Kich ban chinh dung duoc khong (xem `resolveTiming`). */
  let timingReady = false;
  /** Ca QUA DEM co dung duoc o thoi diem chay khong — xem `beforeAll`. */
  let nightShiftReady = false;

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

    const resolved = resolveTiming(nowTotalMinutes);
    if (resolved === null) {
      // Khong dung fixture nao ca — moi test ben duoi se tu bo qua.
      timingReady = false;
      return;
    }
    timingReady = true;
    timing = resolved;

    // Ca bat dau `timing.lateBy` phut TRUOC hien tai va keo dai 8 tieng: moi
    // lan cham cong trong test nay deu muon dung ngan ay phut so voi ke hoach,
    // bat ke test chay vao gio nao trong ngay — ke ca ngay sau nua dem, noi
    // `lateBy` tu thu nho lai de ca khong wrap sang hom truoc.
    const { error: shiftError } = await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Test ca ân hạn (04-02)",
      code: "T0402LATE",
      start_time: minutesToHms(nowTotalMinutes - timing.lateBy),
      end_time: minutesToHms(nowTotalMinutes - timing.lateBy + 8 * 60),
      break_minutes: 0,
      late_tolerance_minutes: timing.toleranceBefore,
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

    // Ca QUA DEM bao quanh hien tai: ket thuc T+5, bat dau T+10 (gio trong
    // ngay), nen `end_time < start_time` -> cot sinh `overnight` = true, va
    // "bay gio" nam TRUOC gio ket thuc ca. Moc bat dau THAT SU la T+10 HOM
    // QUA, tuc lan cham nay muon gan tron mot ngay.
    // Trong ~10 phut cuoi ngay kich ban nay BAT KHA THI, khong phai kho: no
    // doi `now < gio ket thuc < gio bat dau` (deu la gio trong ngay), ma
    // khong con du cho truoc nua dem cho ca hai moc. Luc do bo qua DUNG MOT
    // test o duoi thay vi lam ca file do — mot test khong dung duoc khac han
    // mot test that bai.
    nightShiftReady = nowTotalMinutes < 1430;

    if (nightShiftReady) {
      const { error: nightShiftError } = await admin.from("shifts").insert({
        id: NIGHT_SHIFT_ID,
        company_id: COMPANY_ID,
        name: "Test ca qua đêm (04-02)",
        code: "T0402NIGHT",
        start_time: minutesToHms(nowTotalMinutes + 10),
        end_time: minutesToHms(nowTotalMinutes + 5),
        break_minutes: 0,
        late_tolerance_minutes: 5,
        working_days: [1, 2, 3, 4, 5, 6, 7],
        status: "active",
      });
      if (nightShiftError) {
        throw new Error(
          `Không tạo được shift ca đêm: ${nightShiftError.message}`,
        );
      }
    }
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
      ...(nightShiftReady
        ? [
            {
              ...baseEmployee,
              id: EMP_NIGHT,
              code: "T0402N",
              full_name: "Nhân viên test 04-02 ca đêm",
              email: `${EMP_NIGHT}@timeflow.test`,
              shift_id: NIGHT_SHIFT_ID,
            },
          ]
        : []),
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
    await admin
      .from("attendance_records")
      .delete()
      .eq("shift_id", NIGHT_SHIFT_ID);
    await admin.from("shifts").delete().eq("id", SHIFT_ID);
    await admin.from("shifts").delete().eq("id", NIGHT_SHIFT_ID);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. [tiêu chí 1] ân hạn 30 phút, đến muộn 20 phút -> late_minutes = 0, trạng thái on_time", async (ctx) => {
    if (!timingReady) {
      // Kich ban khong dung duoc o khung gio nay — bo qua CO LY DO, hien ra
      // trong ket qua chay, khong phai that bai va cung khong im lang.
      ctx.skip();
      return;
    }
    const record = await checkIn(EMP_A, makeEvidence());
    recordAId = record.id;

    expect(record.lateMinutes).toBe(0);
    expect(record.status).toBe("on_time");

    recordASnapshot = await readRecord(recordAId);
  });

  it("2. [tiêu chí 1] siết ân hạn xuống 5 phút -> lần chấm KẾ TIẾP đã tính muộn, không có bước áp dụng nào ở giữa", async (ctx) => {
    if (!timingReady) {
      // Kich ban khong dung duoc o khung gio nay — bo qua CO LY DO, hien ra
      // trong ket qua chay, khong phai that bai va cung khong im lang.
      ctx.skip();
      return;
    }
    await updateShift(SHIFT_ID, { lateToleranceMinutes: timing.toleranceAfter });

    const record = await checkIn(EMP_B, makeEvidence());

    expect(record.status).toBe("late");
    // ~15 phut (20 den muon - 5 an han); cho +-1 phut vi tf_worked_minutes lam
    // tron epoch va hai lan cham cach nhau vai giay.
    expect(record.lateMinutes).toBeGreaterThanOrEqual(
      timing.lateBy - timing.toleranceAfter - 1,
    );
    expect(record.lateMinutes).toBeLessThanOrEqual(
      timing.lateBy - timing.toleranceAfter + 1,
    );
  });

  it("3. [tiêu chí 4] bản ghi của nhân viên A giữ nguyên late_minutes/status sau khi ân hạn đổi", async (ctx) => {
    if (!timingReady) {
      // Kich ban khong dung duoc o khung gio nay — bo qua CO LY DO, hien ra
      // trong ket qua chay, khong phai that bai va cung khong im lang.
      ctx.skip();
      return;
    }
    const after = await readRecord(recordAId);

    expect(after.late_minutes).toBe(0);
    expect(after.status).toBe("on_time");
    expect(after).toEqual(recordASnapshot);
  });

  it("4. [tiêu chí 4] đổi cả GIỜ BẮT ĐẦU ca cũng không chạm vào bản ghi đã có", async (ctx) => {
    if (!timingReady) {
      // Kich ban khong dung duoc o khung gio nay — bo qua CO LY DO, hien ra
      // trong ket qua chay, khong phai that bai va cung khong im lang.
      ctx.skip();
      return;
    }
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

  it("5. lượt chấm THỨ HAI trong cùng ngày không bị tính muộn dù ân hạn đã siết (migration 0013 không bị phá)", async (ctx) => {
    if (!timingReady) {
      // Kich ban khong dung duoc o khung gio nay — bo qua CO LY DO, hien ra
      // trong ket qua chay, khong phai that bai va cung khong im lang.
      ctx.skip();
      return;
    }
    await checkOut(recordAId, makeEvidence());
    const second = await checkIn(EMP_A, makeEvidence());

    expect(second.id).not.toBe(recordAId);
    expect(second.lateMinutes).toBe(0);
    expect(second.status).toBe("on_time");
  });


  it("6. CA QUA ĐÊM: mốc bắt đầu ca lùi về hôm qua, người vào muộn KHÔNG còn được ghi on_time", async (ctx) => {
    if (!nightShiftReady) {
      // Bo qua CO LY DO, hien ra trong ket qua chay — khong phai that bai,
      // va cung khong phai im lang.
      ctx.skip();
      return;
    }
    // HỒI QUY cho lỗi phát hiện 2026-08-11.
    //
    // `work_date` của một khoảnh khắc là ngày lịch của chính nó (D-08, ép
    // bằng CHECK constraint ở 0004:109). Với ca qua đêm, giải giờ bắt đầu ca
    // trên chính ngày đó cho ra một mốc trong TƯƠNG LAI, nên số phút muộn âm,
    // bị kẹp về 0, và người vào muộn được ghi `on_time`.
    //
    // Ca dựng ở `beforeAll` kết thúc T+5 và bắt đầu T+10 (giờ trong ngày), nên
    // mốc bắt đầu THẬT SỰ là T+10 HÔM QUA — lượt chấm này muộn gần trọn một
    // ngày. Trước khi sửa, khẳng định `late` dưới đây đỏ với giá trị `on_time`.
    vi.mocked(getSessionContext).mockResolvedValue(ownerSession(EMP_NIGHT));

    const record = await checkIn(EMP_NIGHT, makeEvidence());

    expect(record.status).toBe("late");
    // ~1440 - 10 - 5 (ân hạn) = 1425 phút; cho ±2 phút vì hai lần gọi cách
    // nhau vài giây và `tf_worked_minutes` làm tròn epoch.
    expect(record.lateMinutes).toBeGreaterThan(1400);
    expect(record.lateMinutes).toBeLessThan(1440);
  });
});

/**
 * Test THUAN (khong cham database) cho chinh `resolveTiming()`.
 *
 * Ton tai vi bo test o tren chi di qua nhanh "sau nua dem" neu tinh co duoc
 * chay trong ~20 phut do — tuc bang chung cho ban sua se KHONG xuat hien o
 * 98,6% cac lan chay. Khoi nay kiem cung mot bat bien o moi phut trong ngay,
 * bat ke dong ho luc chay.
 */
describe("resolveTiming — ca test không bao giờ được wrap qua nửa đêm", () => {
  it("giờ bình thường: giữ nguyên 20 phút muộn, ân hạn 30 rồi 5 như thiết kế gốc", () => {
    for (const nowTotalMinutes of [20, 60, 480, 1439]) {
      const timing = resolveTiming(nowTotalMinutes);
      expect(timing).not.toBeNull();
      if (timing === null) continue;
      expect(timing.lateBy).toBe(20);
      expect(timing.toleranceBefore).toBe(30);
      expect(timing.toleranceAfter).toBe(5);
    }
  });

  it("ngay sau nửa đêm: thu nhỏ độ muộn để giờ bắt đầu ca không âm", () => {
    for (let nowTotalMinutes = 2; nowTotalMinutes < 20; nowTotalMinutes += 1) {
      const timing = resolveTiming(nowTotalMinutes);
      expect(timing).not.toBeNull();
      if (timing === null) continue;
      // Bat bien 1: gio bat dau ca luon cung ngay lich (khong am -> khong wrap
      // -> cot sinh `overnight` khong bat).
      expect(nowTotalMinutes - timing.lateBy).toBeGreaterThanOrEqual(0);
      // Bat bien 2: an han TRUOC luon lon hon do muon -> on_time.
      expect(timing.toleranceBefore).toBeGreaterThan(timing.lateBy);
      // Bat bien 3: an han SAU luon nho hon do muon -> late, va so phut muon
      // ghi nhan duoc phai LON HON 0, neu khong test 2 mat y nghia.
      expect(timing.toleranceAfter).toBeLessThan(timing.lateBy);
      expect(timing.lateBy - timing.toleranceAfter).toBeGreaterThan(0);
    }
  });

  it("hai phút đầu sau nửa đêm: trả null để test tự bỏ qua, không làm đỏ cả file", () => {
    // 00:00 va 00:01 la kich ban BAT KHA THI (khong co gio bat dau ca nao vua
    // truoc hien tai vua cung ngay lich), khac han mot test THAT BAI. Tra null
    // de noi goi `ctx.skip()` co ly do — hien ra trong ket qua chay chu khong
    // im lang, va cung khong lam do mot thu von khong the dung duoc.
    for (const nowTotalMinutes of [0, 1]) {
      expect(resolveTiming(nowTotalMinutes)).toBeNull();
    }
  });
});
