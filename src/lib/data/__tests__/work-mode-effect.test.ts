// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as GET_PAYROLL } from "@/app/api/payroll/summary/route";
import { getSessionContext } from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PayrollPrep, PayrollPrepRow, WorkMode } from "@/lib/types/domain";

/**
 * BAI KIEM CHINH CUA PLAN 05-2-02: **mot** tap cham cong, **ba** che do,
 * **ba** ket qua khac nhau — va ca ba dung theo dinh nghia cua chinh che do do.
 *
 * Neu ba che do ra cung mot bo so thi che do chua duoc noi vao dau ca, va moi
 * con so tien cua 05-2-04 se duoc tinh tren mot dinh nghia ngay cong sai —
 * trong khi khong mot test nao cua Phase 4 hay 5.1 phat hien ra, vi tat ca
 * chung chay o che do `shift`.
 *
 * Tap cham cong co dinh (ca 08:00-16:00, ngay chuan 10 tieng):
 *   - mot ngay 8 tieng   (dung ca)
 *   - mot ngay 12 tieng  (vuot ca 4 tieng, vuot ngay chuan 2 tieng)
 *   - mot ngay 6 tieng   (thieu ca 2 tieng, thieu ngay chuan 4 tieng)
 *   - mot ngay `leave_paid`
 *   - mot ngay `leave_unpaid`
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

/** Thang co dinh trong qua khu. Ca: Thu Hai-Thu Sau, 08:00-16:00, khong nghi giua ca. */
const MONTH = "2014-04";
const DAY_FULL = "2014-04-07"; // Thu Hai — 8 tieng
const DAY_LONG = "2014-04-08"; // Thu Ba — 12 tieng
const DAY_SHORT = "2014-04-09"; // Thu Tu — 6 tieng
const DAY_LEAVE_PAID = "2014-04-10"; // Thu Nam
const DAY_LEAVE_UNPAID = "2014-04-11"; // Thu Sau

/** Ngay chuan cua che do `daily_hours` — 10 tieng, dung vi du cua D-36. */
const STANDARD_HOURS_PER_DAY = 10;

describe("Ba chế độ tính công trên cùng một tập chấm công (D-36/D-36a/D-39/D-43)", () => {
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
  const COMPANY_ID = `cty-wm-${suffix}`;
  const DEPARTMENT_ID = `dept-wm-${suffix}`;
  const SHIFT_ID = `sft-wm-${suffix}`;
  const EMPLOYEE_ID = `emp-wm-${suffix}`;

  let actorUserId = "";

  function session() {
    return {
      userId: actorUserId,
      email: `test-workmode-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role: "owner" as const,
      employeeId: EMPLOYEE_ID,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  /** Dat che do va hai mau so, roi doc lai bang chuan bi luong. */
  async function readWithMode(
    mode: WorkMode,
    standardHoursPerDay: number | null = STANDARD_HOURS_PER_DAY,
  ): Promise<{ prep: PayrollPrep; row: PayrollPrepRow }> {
    const { error } = await admin
      .from("company_settings")
      .update({
        work_mode: mode,
        standard_hours_per_day: standardHoursPerDay,
      })
      .eq("company_id", COMPANY_ID);
    if (error) throw new Error(`Không đặt được chế độ tính công: ${error.message}`);

    const response = await GET_PAYROLL(
      new Request(`http://localhost/api/payroll/summary?month=${MONTH}`),
    );
    expect(response.status).toBe(200);
    const prep = (await response.json()) as PayrollPrep;
    const row = prep.rows.find((item) => item.employeeId === EMPLOYEE_ID);
    if (!row) throw new Error("Không tìm thấy dòng của nhân viên test.");
    return { prep, row };
  }

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
      id: `att-wm-${suffix}-${date}`,
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

  async function insertLeave(
    date: string,
    status: "leave_paid" | "leave_unpaid",
  ): Promise<void> {
    const { error } = await admin.from("attendance_records").insert({
      id: `att-wm-${suffix}-${date}`,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      work_date: date,
      shift_id: SHIFT_ID,
      check_in_at: null,
      check_out_at: null,
      worked_minutes: 0,
      late_minutes: 0,
      early_leave_minutes: 0,
      status,
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    });
    if (error) throw new Error(`Không tạo được ngày nghỉ ${date}: ${error.message}`);
  }

  beforeAll(async () => {
    const { data: createdUser, error: userError } =
      await admin.auth.admin.createUser({
        email: `test-workmode-${suffix}@timeflow.test`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (userError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${userError?.message}`);
    }
    actorUserId = createdUser.user.id;

    const { error: companyError } = await admin.from("companies").insert({
      id: COMPANY_ID,
      name: `Doanh nghiệp test chế độ công ${suffix}`,
      code: `WM${suffix.slice(0, 6).toUpperCase()}`,
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
      name: "Phòng test chế độ",
      description: "Test",
      manager_id: null,
      status: "active",
    });
    await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca test",
      code: "WMT",
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
      code: "WM001",
      full_name: "Người test chế độ công",
      email: `${EMPLOYEE_ID}@timeflow.test`,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male",
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Test",
      contract_type: "full_time",
      start_date: "2013-01-01",
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

    // He so tang ca de `convertedOvertimeHours` la mot con so, khong phai null.
    await admin.from("overtime_rules").insert({
      company_id: COMPANY_ID,
      rule_key: "weekday",
      multiplier: 1.5,
      effective_from: "2013-01-01",
    });

    await insertDay(DAY_FULL, "16:00:00"); // 480 phut
    await insertDay(DAY_LONG, "20:00:00"); // 720 phut
    await insertDay(DAY_SHORT, "14:00:00"); // 360 phut
    await insertLeave(DAY_LEAVE_PAID, "leave_paid");
    await insertLeave(DAY_LEAVE_UNPAID, "leave_unpaid");

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  afterAll(async () => {
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. chế độ `shift` — hành vi Phase 4 nguyên xi: 3 ngày công, tăng ca chỉ là phần vượt CA", async () => {
    const { prep, row } = await readWithMode("shift");

    expect(prep.workMode).toBe("shift");
    // Ba ngay co gio lam + mot ngay `leave_paid` = 4 ngay cong tron
    // (`leave_unpaid` khong duoc cong — xem bai 6).
    expect(row.creditedDays).toBe(4);
    // `workedDays` chi dem ngay CO GIO LAM, nen no la 3 — hai dai luong tra
    // loi hai cau hoi khac nhau va khong duoc lan voi nhau.
    expect(row.workedDays).toBe(3);
    // Chi ngay 12 tieng vuot ca 8 tieng -> 240 phut tang ca.
    expect(row.overtimeMinutes).toBe(240);
    // Che do nay khong theo doi do lech gio.
    expect(row.hourDeltaMinutes).toBe(0);
    expect(row.missingWorkModeInputs).toEqual([]);
  });

  it("2. CÁI BẪY D-36a: chế độ `daily_hours` với ngày 6 tiếng KHÔNG sinh 360 phút tăng ca", async () => {
    const { row } = await readWithMode("daily_hours");

    // Neu che do nay di qua nhanh cu voi `scheduledMinutes = 0`, tong tang ca
    // se la 480 + 720 + 360 = 1560 phut — toan bo gio lam. Nhan vien CO CA 8
    // tieng, nen mau so la do dai ca (khong phai 10 tieng chuan): chi ngay 12
    // tieng vuot ca, tuc 240 phut.
    expect(row.overtimeMinutes).toBe(240);
    expect(row.overtimeMinutes).not.toBe(1560);
  });

  it("3. chế độ `daily_hours` có ca 8 tiếng — ngày 6 tiếng cho 0,75 ngày công (mẫu số là độ dài ca)", async () => {
    const { prep, row } = await readWithMode("daily_hours");

    expect(prep.workMode).toBe("daily_hours");
    // 480/480 = 1 | 480/480 = 1 (phan vuot ca la tang ca) | 360/480 = 0,75
    // cong mot ngay `leave_paid` = 1  ->  3,75. So gio chuan 10 tieng KHONG
    // duoc dung vi ngay nao cung gan voi ca.
    expect(row.creditedDays).toBe(3.75);
    // `workedDays` GIU NGUYEN nghia cu (dem ngay co gio lam) — khong doi theo
    // che do, va do la co y: hai dai luong tra loi hai cau hoi khac nhau.
    expect(row.workedDays).toBe(3);
  });

  it("4. chế độ `shift_hourly` — ngày công như `shift`, nhưng độ lệch giờ được ghi lại", async () => {
    const { prep, row } = await readWithMode("shift_hourly");

    expect(prep.workMode).toBe("shift_hourly");
    expect(row.creditedDays).toBe(4);
    // (480-480) + (720-480) + (360-480) = +120 phut.
    expect(row.hourDeltaMinutes).toBe(120);
  });

  it("5. BA CHẾ ĐỘ RA BA BỘ SỐ KHÁC NHAU — so sánh tường minh giữa ba kết quả", async () => {
    const shift = (await readWithMode("shift")).row;
    const dailyHours = (await readWithMode("daily_hours")).row;
    const shiftHourly = (await readWithMode("shift_hourly")).row;

    function fingerprint(row: PayrollPrepRow) {
      return {
        creditedDays: row.creditedDays,
        overtimeMinutes: row.overtimeMinutes,
        hourDeltaMinutes: row.hourDeltaMinutes,
      };
    }

    // Doi mot khac nhau. Neu hai trong ba giong het nhau, mot che do chua duoc
    // noi vao dau ca — va do la loai loi khong bao gio bao loi.
    expect(fingerprint(shift)).not.toEqual(fingerprint(dailyHours));
    expect(fingerprint(shift)).not.toEqual(fingerprint(shiftHourly));
    expect(fingerprint(dailyHours)).not.toEqual(fingerprint(shiftHourly));

    // Va TONG GIO LAM thi GIONG NHAU o ca ba — che do doi cach QUY DOI, khong
    // doi du lieu cham cong. Neu con so nay lech, mot che do dang lam mat gio.
    expect(shift.totalMinutes).toBe(dailyHours.totalMinutes);
    expect(shift.totalMinutes).toBe(shiftHourly.totalMinutes);
  });

  it("6. ngày `leave_unpaid` KHÔNG được tính là ngày công ở cả ba chế độ (D-43)", async () => {
    const shift = (await readWithMode("shift")).row;
    const dailyHours = (await readWithMode("daily_hours")).row;
    const shiftHourly = (await readWithMode("shift_hourly")).row;

    // Ba ngay lam + mot ngay `leave_paid` = 4 ngay duoc tra o che do dem ngay;
    // `leave_unpaid` khong duoc cong vao. Neu no duoc tinh, con so se la 5.
    expect(shift.creditedDays).toBe(4);
    expect(shiftHourly.creditedDays).toBe(4);
    // O `daily_hours`: 1 + 1 + 0,75 + 1 (leave_paid) = 3,75 — cung khong co
    // dong gop nao cua `leave_unpaid`.
    expect(dailyHours.creditedDays).toBe(3.75);

    // Hai ngay nghi van duoc DEM o `leaveDays` — chung khong bien mat khoi so
    // lieu, chung chi khong duoc tra.
    expect(shift.leaveDays).toBe(2);
  });

  it("7. bỏ `standard_hours_per_day` -> nhân viên CÓ CA vẫn tính được theo độ dài ca, không báo thiếu", async () => {
    const { row } = await readWithMode("daily_hours", null);

    // Moi ngay deu gan voi ca 8 tieng, nen khong ngay nao can den so gio
    // chuan. Nhanh "thieu mau so" (ngay khong co ca) co bo test rieng o
    // `work-mode.test.ts` — o day `shift_id` la NOT NULL nen khong dung duoc.
    expect(row.missingWorkModeInputs).toEqual([]);
    expect(row.creditedDays).toBe(3.75);
    expect(row.overtimeMinutes).toBe(240);
  });

  it("8. đặt lại mẫu số -> số liệu không đổi vì ca thắng số giờ chuẩn", async () => {
    const { row } = await readWithMode("daily_hours", STANDARD_HOURS_PER_DAY);

    expect(row.missingWorkModeInputs).toEqual([]);
    expect(row.creditedDays).toBe(3.75);
  });
});
