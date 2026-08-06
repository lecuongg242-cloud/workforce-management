// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as GET_SUMMARY } from "@/app/api/attendance/summary/route";
import { getSessionContext } from "@/lib/auth/session-context";
import { reviewRequest } from "@/lib/data/mutations/requests";
import { createServerSupabase } from "@/lib/supabase/server";
import type { MonthlySummary } from "@/lib/types/domain";

/**
 * APRV-03 tren du lieu that: duyet xong thi SO LIEU KY co doi dung khong.
 *
 * Day la bo test lam ca Phase 5 co nghia. Khong co no, man hinh duyet cua
 * 05-01 la mot cai nut doi mot cot trang thai. Moi bai deu doi chieu TRUOC va
 * SAU tren cung mot phep doc that (`GET /api/attendance/summary`), khong phai
 * doc lai chinh gia tri ma ham vua tra ve.
 *
 * Hai bai quan trong nhat:
 *   - XUNG DOT: don nghi cham vao ngay da co cham cong that -> dong cu NGUYEN
 *     VEN, ngay do vao `skippedDates`. Nhan vien da di lam hom do; mot don
 *     nghi duoc duyet muon khong xoa duoc su that do.
 *   - TANG CA: duyet KHONG doi `convertedOvertimeHours` cua thang (D-31). Con
 *     so do van den tu cham cong that, khong tu so gio ghi trong don.
 *
 * Fixture dung mot doanh nghiep RIENG mang dinh danh ngau nhien (khuon
 * `attendance-classification.test.ts` cua 04-05) de so lieu khong lan voi du
 * lieu demo, va vi `overtime_rules` la append-only nen doanh nghiep do khong
 * xoa duoc o cuoi.
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

/**
 * Thang lam viec co dinh trong qua khu — khong dung chung voi fixture khac.
 * Ca test: Thu Hai–Thu Sau, 08:00–16:00, khong nghi giua ca (480 phut ke hoach).
 *
 * Lich cua thang 2019-09:
 *   02 Thu Hai | 03 Thu Ba | 04 Thu Tu | 05 Thu Nam | 06 Thu Sau
 *   07 Thu Bay | 08 Chu Nhat
 */
const MONTH = "2019-09";
/** Don nghi 04 -> 08: Thu Tu, Thu Nam, Thu Sau, Thu Bay, Chu Nhat. */
const LEAVE_FROM = "2019-09-04";
const LEAVE_TO = "2019-09-08";
/** Trong khoang tren, ngay nay duoc khai la NGAY LE -> phai bo qua (D-35). */
const LEAVE_HOLIDAY = "2019-09-05";
/** Trong khoang tren, ngay nay DA co cham cong that -> phai bo qua, khong ghi de. */
const LEAVE_CONFLICT = "2019-09-06";
/** Ngay duy nhat con lai -> dung MOT ban ghi nghi phep duoc sinh. */
const LEAVE_EXPECTED = "2019-09-04";

const SUPPLEMENT_DATE = "2019-09-11"; // Thu Tu
const ADJUST_DATE = "2019-09-12"; // Thu Nam
const OVERTIME_DATE = "2019-09-13"; // Thu Sau
const REJECT_DATE = "2019-09-18"; // Thu Tu

describe("Tác động của yêu cầu được duyệt lên dữ liệu công (APRV-03)", () => {
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

  const suffix = randomUUID().slice(0, 8);
  const COMPANY_ID = `cty-0502-${suffix}`;
  const DEPARTMENT_ID = `dept-0502-${suffix}`;
  const SHIFT_ID = `sft-0502-${suffix}`;
  const EMPLOYEE_ID = `emp-0502-${suffix}`;

  const REQUEST_LEAVE = `wr-0502-${suffix}-leave`;
  const REQUEST_SUPPLEMENT = `wr-0502-${suffix}-supp`;
  const REQUEST_ADJUST = `wr-0502-${suffix}-adjust`;
  const REQUEST_OVERTIME = `wr-0502-${suffix}-ot`;
  const REQUEST_REJECT = `wr-0502-${suffix}-reject`;

  let actorUserId = "";

  function session(role: "owner" | "employee" = "owner") {
    return {
      userId: actorUserId,
      email: `test-05-02-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role,
      employeeId: EMPLOYEE_ID,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  async function readSummary(): Promise<MonthlySummary> {
    const response = await GET_SUMMARY(
      new Request(
        `http://localhost/api/attendance/summary?employeeId=${EMPLOYEE_ID}&month=${MONTH}`,
      ),
    );
    expect(response.status).toBe(200);
    return (await response.json()) as MonthlySummary;
  }

  async function countRecords(date: string): Promise<number> {
    const { count } = await admin
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", EMPLOYEE_ID)
      .eq("work_date", date);
    return count ?? 0;
  }

  /** Mot ngay cong that: vao 08:00, ra `checkOut` (gio VN). */
  async function insertDay(date: string, checkOut: string): Promise<void> {
    const { data: checkInAt } = await admin.rpc("tf_local_instant", {
      p_date: date,
      p_time: "08:00:00",
    });
    const { data: checkOutAt } = await admin.rpc("tf_local_instant", {
      p_date: date,
      p_time: checkOut,
    });
    const { data: worked } = await admin.rpc("tf_worked_minutes", {
      p_check_in: checkInAt as string,
      p_check_out: checkOutAt as string,
      p_break_minutes: 0,
    });

    const { error } = await admin.from("attendance_records").insert({
      id: `att-0502-${suffix}-${date}`,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      work_date: date,
      shift_id: SHIFT_ID,
      check_in_at: checkInAt as string,
      check_out_at: checkOutAt as string,
      worked_minutes: worked as number,
      late_minutes: 0,
      early_leave_minutes: 0,
      status: "on_time",
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    });
    if (error) throw new Error(`Không tạo được bản ghi ${date}: ${error.message}`);
  }

  function approvedRequest(
    id: string,
    type: "leave" | "attendance_supplement" | "time_adjustment" | "overtime",
    fromDate: string,
    toDate: string,
    fromTime: string | null,
    toTime: string | null,
  ) {
    return {
      id,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      type,
      status: "pending" as const,
      from_date: fromDate,
      to_date: toDate,
      from_time: fromTime,
      to_time: toTime,
      reason: "[test 05-02] Yêu cầu dựng cho test tác động.",
    };
  }

  beforeAll(async () => {
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: `test-05-02-${suffix}@timeflow.test`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (createUserError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${createUserError?.message}`);
    }
    actorUserId = createdUser.user.id;

    const { error: companyError } = await admin.from("companies").insert({
      id: COMPANY_ID,
      name: `Doanh nghiệp test 05-02 ${suffix}`,
      code: `T0502${suffix.slice(0, 4).toUpperCase()}`,
      industry: "services",
      size: "1-10",
      phone: "0900000000",
      address: "Test",
      accent: "indigo",
    });
    if (companyError) {
      throw new Error(`Không tạo được doanh nghiệp test: ${companyError.message}`);
    }
    await admin.from("company_settings").insert({ company_id: COMPANY_ID });

    await admin.from("departments").insert({
      id: DEPARTMENT_ID,
      company_id: COMPANY_ID,
      name: "Phòng test",
      description: "Test 05-02",
      manager_id: null,
      status: "active",
    });

    await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca test 05-02",
      code: "T0502",
      start_time: "08:00",
      end_time: "16:00",
      break_minutes: 0,
      late_tolerance_minutes: 0,
      working_days: [1, 2, 3, 4, 5],
      status: "active",
    });

    await admin.from("employees").insert({
      id: EMPLOYEE_ID,
      company_id: COMPANY_ID,
      code: "T0502NV",
      full_name: "Nhân viên test 05-02",
      email: `${EMPLOYEE_ID}@timeflow.test`,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male",
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Test",
      contract_type: "full_time",
      start_date: "2018-01-01",
      manager_id: null,
      shift_id: SHIFT_ID,
      work_location: "Văn phòng chính",
      status: "active",
      system_role: "employee",
      invitation_sent: false,
      can_view_payslip: false,
      can_check_in_remotely: false,
      user_id: null,
    });

    await admin.from("holidays").insert({
      company_id: COMPANY_ID,
      holiday_date: LEAVE_HOLIDAY,
      name: "Ngày lễ test 05-02",
    });

    // He so tang ca de `convertedOvertimeHours` la mot con so (khong phai null
    // vi thieu he so) — bai kiem D-31 can no DOI DUOC de chung minh no KHONG doi.
    await admin.from("overtime_rules").insert([
      { company_id: COMPANY_ID, rule_key: "weekday", multiplier: 1.5, effective_from: "2019-01-01" },
      { company_id: COMPANY_ID, rule_key: "weekend", multiplier: 2, effective_from: "2019-01-01" },
      { company_id: COMPANY_ID, rule_key: "holiday", multiplier: 3, effective_from: "2019-01-01" },
    ]);

    // Ngay xung dot: da di lam that, 08:00-18:00 (600 phut, vuot ke hoach 120).
    await insertDay(LEAVE_CONFLICT, "18:00:00");
    // Ngay se bi dieu chinh gio: hien dang 09:00 -> 17:00 (dat rieng ben duoi).
    await insertDay(ADJUST_DATE, "16:00:00");

    await admin.from("work_requests").insert([
      approvedRequest(REQUEST_LEAVE, "leave", LEAVE_FROM, LEAVE_TO, null, null),
      approvedRequest(
        REQUEST_SUPPLEMENT,
        "attendance_supplement",
        SUPPLEMENT_DATE,
        SUPPLEMENT_DATE,
        "08:00",
        "16:00",
      ),
      approvedRequest(
        REQUEST_ADJUST,
        "time_adjustment",
        ADJUST_DATE,
        ADJUST_DATE,
        "08:30",
        "18:00",
      ),
      approvedRequest(
        REQUEST_OVERTIME,
        "overtime",
        OVERTIME_DATE,
        OVERTIME_DATE,
        null,
        null,
      ),
      approvedRequest(REQUEST_REJECT, "leave", REJECT_DATE, REJECT_DATE, null, null),
    ]);

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  afterAll(async () => {
    // `overtime_rules` khong xoa duoc (trigger append-only) va `request_reviews`
    // cung vay (trigger 0017) — nen ca doanh nghiep test o lai, do la ly do
    // dinh danh cua no mang phan ngau nhien. Don phan xoa duoc.
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
    await admin.from("audit_log").delete().eq("actor_user_id", actorUserId);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. xem trước và duyệt nghỉ phép cho CÙNG một con số: 5 ngày lịch -> 1 bản ghi, 1 ngày xung đột", async () => {
    const { data: preview } = await admin.rpc("tf_preview_request_effect", {
      p_request_id: REQUEST_LEAVE,
    });
    expect(preview).toMatchObject({
      inserted_count: 1,
      updated_count: 0,
      skipped_count: 1,
    });

    const before = await readSummary();

    const result = await reviewRequest(REQUEST_LEAVE, { decision: "approved" });

    expect(result.request.status).toBe("approved");
    expect(result.effect.insertedCount).toBe(1);
    expect(result.effect.skippedCount).toBe(1);
    expect(result.effect.skippedDates).toEqual([LEAVE_CONFLICT]);

    // Thu Bay/Chu Nhat ngoai working_days, va ngay le -> khong ngay nao trong
    // ba ngay do sinh ban ghi (D-35).
    expect(await countRecords("2019-09-07")).toBe(0);
    expect(await countRecords("2019-09-08")).toBe(0);
    expect(await countRecords(LEAVE_HOLIDAY)).toBe(0);

    const after = await readSummary();
    expect(after.leaveDays).toBe(before.leaveDays + 1);
  });

  it("2. bản ghi nghỉ phép có đúng hình dạng: hai cột giờ null, trạng thái leave_paid, mang dấu vết nguồn gốc", async () => {
    const { data: rows } = await admin
      .from("attendance_records")
      .select("work_date, status, check_in_at, check_out_at, worked_minutes, note")
      .eq("employee_id", EMPLOYEE_ID)
      .eq("work_date", LEAVE_EXPECTED);

    expect(rows).toHaveLength(1);
    expect(rows?.[0].status).toBe("leave_paid");
    expect(rows?.[0].check_in_at).toBeNull();
    expect(rows?.[0].check_out_at).toBeNull();
    expect(rows?.[0].worked_minutes).toBe(0);
    expect(rows?.[0].note).toContain(REQUEST_LEAVE);
  });

  it("3. ngày xung đột: bản ghi chấm công thật NGUYÊN VẸN, không dòng nghỉ phép nào chồng lên", async () => {
    const { data: rows } = await admin
      .from("attendance_records")
      .select("id, status, worked_minutes, note")
      .eq("employee_id", EMPLOYEE_ID)
      .eq("work_date", LEAVE_CONFLICT);

    // Dung MOT dong — dong cham cong that, khong co dong nghi phep them vao.
    expect(rows).toHaveLength(1);
    expect(rows?.[0].id).toBe(`att-0502-${suffix}-${LEAVE_CONFLICT}`);
    expect(rows?.[0].status).toBe("on_time");
    expect(rows?.[0].worked_minutes).toBe(600);
    expect(rows?.[0].note).toBeNull();
  });

  it("4. áp dụng lần thứ hai bị chặn ở tầng database, không sinh tác động thứ hai", async () => {
    const { error } = await admin.rpc("tf_apply_approved_request", {
      p_request_id: REQUEST_LEAVE,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("đã được áp dụng");

    expect(await countRecords(LEAVE_EXPECTED)).toBe(1);
  });

  it("5. duyệt bổ sung công: tổng phút của tháng tăng đúng số phút của bản ghi mới", async () => {
    const before = await readSummary();

    const result = await reviewRequest(REQUEST_SUPPLEMENT, { decision: "approved" });
    expect(result.effect.insertedCount).toBe(1);

    const { data: rows } = await admin
      .from("attendance_records")
      .select("worked_minutes, check_in_at, note")
      .eq("employee_id", EMPLOYEE_ID)
      .eq("work_date", SUPPLEMENT_DATE);
    expect(rows).toHaveLength(1);
    // 08:00 -> 16:00 = 480 phut THO (gio nghi tru mot lan o tang doc, 0014).
    expect(rows?.[0].worked_minutes).toBe(480);
    // Dau vet: dong nay KHONG den tu mot lan cham cong that.
    expect(rows?.[0].note).toContain(REQUEST_SUPPLEMENT);

    const after = await readSummary();
    expect(after.totalMinutes).toBe(before.totalMinutes + 480);
    expect(after.workedDays).toBe(before.workedDays + 1);
  });

  it("6. duyệt điều chỉnh giờ: SỬA bản ghi đã có (vẫn một dòng), giá trị trước khi sửa nằm trong audit_log", async () => {
    const { data: beforeRows } = await admin
      .from("attendance_records")
      .select("id, worked_minutes")
      .eq("employee_id", EMPLOYEE_ID)
      .eq("work_date", ADJUST_DATE);
    expect(beforeRows).toHaveLength(1);
    expect(beforeRows?.[0].worked_minutes).toBe(480);

    const result = await reviewRequest(REQUEST_ADJUST, { decision: "approved" });
    expect(result.effect.updatedCount).toBe(1);
    expect(result.effect.insertedCount).toBe(0);

    const { data: afterRows } = await admin
      .from("attendance_records")
      .select("id, worked_minutes, late_minutes, status, note")
      .eq("employee_id", EMPLOYEE_ID)
      .eq("work_date", ADJUST_DATE);

    // Van DUNG MOT dong, dung id cu — sua chu khong tao moi.
    expect(afterRows).toHaveLength(1);
    expect(afterRows?.[0].id).toBe(beforeRows?.[0].id);
    // 08:30 -> 18:00 = 570 phut; di muon 30 phut (an han 0).
    expect(afterRows?.[0].worked_minutes).toBe(570);
    expect(afterRows?.[0].late_minutes).toBe(30);
    expect(afterRows?.[0].status).toBe("late");

    const { data: audit } = await admin
      .from("audit_log")
      .select("before, after, reason")
      .eq("actor_user_id", actorUserId)
      .eq("entity_id", REQUEST_ADJUST)
      .single();
    expect((audit?.before as { status: string }).status).toBe("pending");
    expect(audit?.reason).toContain("sửa 1 bản ghi công");
  });

  it("7. duyệt tăng ca KHÔNG tạo bản ghi và KHÔNG đổi giờ tăng ca quy đổi của tháng (D-31)", async () => {
    const before = await readSummary();
    // Bai kiem chi co nghia khi con so nay THAT SU la mot con so — neu no
    // `null` (thieu he so) thi "khong doi" la mot khang dinh rong.
    expect(typeof before.convertedOvertimeHours).toBe("number");
    expect(before.convertedOvertimeHours).toBeGreaterThan(0);

    const result = await reviewRequest(REQUEST_OVERTIME, { decision: "approved" });
    expect(result.effect.insertedCount).toBe(0);
    expect(result.effect.updatedCount).toBe(0);
    expect(await countRecords(OVERTIME_DATE)).toBe(0);

    const after = await readSummary();
    expect(after.convertedOvertimeHours).toBe(before.convertedOvertimeHours);
    expect(after.overtimeMinutes).toBe(before.overtimeMinutes);
    expect(after.totalMinutes).toBe(before.totalMinutes);
  });

  it("8. từ chối KHÔNG chạm vào dữ liệu công", async () => {
    const before = await readSummary();

    const result = await reviewRequest(REQUEST_REJECT, {
      decision: "rejected",
      note: "Không đủ nhân sự ngày hôm đó.",
    });
    expect(result.request.status).toBe("rejected");
    expect(result.effect.insertedCount).toBe(0);
    expect(await countRecords(REJECT_DATE)).toBe(0);

    const after = await readSummary();
    expect(after).toEqual(before);

    // `applied_at` van null: mot yeu cau bi tu choi khong bao gio duoc ap dung.
    const { data: row } = await admin
      .from("work_requests")
      .select("applied_at")
      .eq("id", REQUEST_REJECT)
      .single();
    expect(row?.applied_at).toBeNull();
  });
});
