// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as GET_CLASSIFICATION } from "@/app/api/attendance/classification/route";
import { GET as GET_SUMMARY } from "@/app/api/attendance/summary/route";
import { resolveMultiplier } from "@/lib/attendance/classification";
import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AttendanceDayClassification, MonthlySummary } from "@/lib/types/domain";

/**
 * SET-04 tren du lieu that. Bai kiem QUAN TRONG NHAT cua ca phase o day:
 * dung mot phan hoi chua HAI ngay thuoc HAI phien ban he so khac nhau, va sau
 * do khai them mot phien ban moi roi doc lai — con so cua ngay cu KHONG DOI.
 *
 * Neu tang doc lo tra he so theo "hom nay" thay vi theo `work_date` cua ban
 * ghi, chinh file nay la thu duy nhat phat hien ra: moi test khac cua phase
 * van xanh.
 *
 * Fixture dung mot doanh nghiep RIENG (`cty-04-05-*`) de khong dam vao du lieu
 * demo, va vi `overtime_rules` la append-only nen mot doanh nghiep rieng la
 * cach duy nhat co mot bang he so sach cho moi lan chay. Doanh nghiep do KHONG
 * xoa duoc o cuoi (cascade xuong overtime_rules bi trigger chan) nen ten cua
 * no mang dau thoi gian de moi lan chay dung mot doanh nghiep moi.
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

/** Thang lam viec co dinh trong qua khu — khong dung chung voi fixture khac. */
const MONTH = "2019-05";
const WEEKDAY_DATE = "2019-05-02"; // Thu Nam
const HOLIDAY_DATE = "2019-05-16"; // Thu Nam, se duoc khai la ngay le
const WEEKEND_DATE = "2019-05-04"; // Thu Bay, ngoai working_days

describe("Phân loại công theo quy tắc đang hiệu lực tại ngày phát sinh (SET-04)", () => {
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
  const COMPANY_ID = `cty-0405-${suffix}`;
  const DEPARTMENT_ID = `dept-0405-${suffix}`;
  const SHIFT_ID = `sft-0405-${suffix}`;
  const EMPLOYEE_ID = `emp-0405-${suffix}`;

  let actorUserId = "";

  function session(role: "owner" | "employee" = "owner") {
    return {
      userId: actorUserId,
      email: `test-04-05-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role,
      employeeId: EMPLOYEE_ID,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  async function readClassifications(): Promise<AttendanceDayClassification[]> {
    const response = await GET_CLASSIFICATION(
      new Request(
        `http://localhost/api/attendance/classification?employeeId=${EMPLOYEE_ID}&month=${MONTH}`,
      ),
    );
    expect(response.status).toBe(200);
    return (await response.json()) as AttendanceDayClassification[];
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

  function byDate(
    items: AttendanceDayClassification[],
    date: string,
  ): AttendanceDayClassification {
    const found = items.find((item) => item.date === date);
    if (!found) throw new Error(`Không tìm thấy phân loại của ngày ${date}`);
    return found;
  }

  /** Mot ngay cong: vao 08:00, ra `checkOut` (gio VN). */
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
      id: `att-0405-${suffix}-${date}`,
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

  beforeAll(async () => {
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: `test-04-05-${suffix}@timeflow.test`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (createUserError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${createUserError?.message}`);
    }
    actorUserId = createdUser.user.id;

    const { error: companyError } = await admin.from("companies").insert({
      id: COMPANY_ID,
      name: `Doanh nghiệp test 04-05 ${suffix}`,
      code: `T0405${suffix.slice(0, 4).toUpperCase()}`,
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
      description: "Test 04-05",
      manager_id: null,
      status: "active",
    });

    // Ca hanh chinh 08:00-16:00, khong nghi giua ca -> 480 phut ke hoach.
    await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca test 04-05",
      code: "T0405",
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
      code: "T0405NV",
      full_name: "Nhân viên test 04-05",
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
      holiday_date: HOLIDAY_DATE,
      name: "Ngày lễ test 04-05",
    });

    // Ngay thuong: lam toi 18:00 -> 600 phut, vuot ke hoach 480 -> 120 phut OT,
    // khong co phut dem nao.
    await insertDay(WEEKDAY_DATE, "18:00:00");
    // Ngay le: lam 08:00-12:00 -> toan bo 240 phut la tang ca.
    await insertDay(HOLIDAY_DATE, "12:00:00");
    // Ngay nghi (Thu Bay): lam 08:00-11:00 -> toan bo 180 phut la tang ca.
    await insertDay(WEEKEND_DATE, "11:00:00");

    // He so hieu luc TU DAU THANG: ngay thuong 1.5.
    await admin.from("overtime_rules").insert([
      { company_id: COMPANY_ID, rule_key: "weekday", multiplier: 1.5, effective_from: "2019-05-01" },
      { company_id: COMPANY_ID, rule_key: "holiday", multiplier: 3, effective_from: "2019-05-01" },
    ]);

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  afterAll(async () => {
    // `overtime_rules` khong xoa duoc (trigger append-only) nen ca doanh nghiep
    // test o lai — do la ly do id cua no mang dau ngau nhien. Don sach phan
    // xoa duoc de khong tich luy du lieu nang.
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
    await admin.from("holidays").delete().eq("company_id", COMPANY_ID);
    await admin.from("audit_log").delete().eq("company_id", COMPANY_ID);
    await admin.from("employees").delete().eq("company_id", COMPANY_ID);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. loại ngày suy từ quy tắc của CHÍNH doanh nghiệp: lễ từ bảng holidays, ngày nghỉ từ working_days của ca", async () => {
    const items = await readClassifications();

    expect(byDate(items, WEEKDAY_DATE).dayType).toBe("weekday");
    expect(byDate(items, HOLIDAY_DATE).dayType).toBe("holiday");
    expect(byDate(items, WEEKEND_DATE).dayType).toBe("weekend");
  });

  it("2. ngày thường chỉ tính phần vượt ca; ngày lễ/ngày nghỉ tính toàn bộ giờ làm", async () => {
    const items = await readClassifications();

    expect(byDate(items, WEEKDAY_DATE).overtimeMinutes).toBe(120);
    expect(byDate(items, HOLIDAY_DATE).overtimeMinutes).toBe(240);
    expect(byDate(items, WEEKEND_DATE).overtimeMinutes).toBe(180);
  });

  it("3. giờ quy đổi dùng hệ số của loại ngày tương ứng", async () => {
    const items = await readClassifications();

    // 120 phut x 1.5 = 180 phut = 3 gio
    expect(byDate(items, WEEKDAY_DATE).convertedOvertimeHours).toBe(3);
    // 240 phut x 3 = 720 phut = 12 gio
    expect(byDate(items, HOLIDAY_DATE).convertedOvertimeHours).toBe(12);
  });

  it("4. loại ngày CHƯA khai hệ số -> null + khoá thiếu, KHÔNG BAO GIỜ 1.0 (D-26)", async () => {
    const items = await readClassifications();
    const weekend = byDate(items, WEEKEND_DATE);

    expect(weekend.convertedOvertimeHours).toBeNull();
    expect(weekend.missingMultiplierKeys).toContain("weekend");
  });

  it("5. tổng tháng là null khi BẤT KỲ ngày nào thiếu hệ số — không cộng bộ phận", async () => {
    const summary = await readSummary();

    expect(summary.overtimeMinutes).toBe(120 + 240 + 180);
    expect(summary.convertedOvertimeHours).toBeNull();
    expect(summary.missingMultiplierKeys).toContain("weekend");
  });

  it("6. [TIÊU CHÍ 4] khai hệ số mới hiệu lực từ giữa tháng: ngày TRƯỚC mốc giữ hệ số cũ, ngày SAU mốc dùng hệ số mới — trong CÙNG một phản hồi", async () => {
    // Phien ban moi cua `weekday`: 2.0 tu 2019-05-10.
    const { error } = await admin.from("overtime_rules").insert({
      company_id: COMPANY_ID,
      rule_key: "weekday",
      multiplier: 2,
      effective_from: "2019-05-10",
    });
    expect(error).toBeNull();

    // Them mot ngay thuong SAU moc hieu luc moi (Thu Hai 2019-05-13).
    await insertDay("2019-05-13", "18:00:00");

    const items = await readClassifications();

    // Ngay 02/05 (truoc moc) van dung he so CU 1.5 -> 3 gio.
    expect(byDate(items, WEEKDAY_DATE).convertedOvertimeHours).toBe(3);
    // Ngay 13/05 (sau moc) dung he so MOI 2.0 -> 4 gio.
    expect(byDate(items, "2019-05-13").convertedOvertimeHours).toBe(4);
  });

  it("7. [ĐỐI CHIẾU] resolveMultiplier (JS) và tf_overtime_multiplier (SQL) trả cùng kết quả trên cùng dữ liệu", async () => {
    const { data: rows } = await admin
      .from("overtime_rules")
      .select("rule_key, multiplier, effective_from")
      .eq("company_id", COMPANY_ID)
      .eq("rule_key", "weekday");

    const versions = (rows ?? []).map((row) => ({
      effectiveFrom: row.effective_from as string,
      multiplier: Number(row.multiplier),
    }));

    for (const date of ["2019-04-30", "2019-05-01", "2019-05-09", "2019-05-10", "2019-05-31"]) {
      const { data: sqlValue } = await admin.rpc("tf_overtime_multiplier", {
        p_company_id: COMPANY_ID,
        p_rule_key: "weekday",
        p_date: date,
      });
      const jsValue = resolveMultiplier(versions, date);

      expect(jsValue === null ? null : jsValue).toBe(
        sqlValue === null ? null : Number(sqlValue),
      );
    }
  });

  it("8. KHÔNG cột nào của attendance_records lưu phân loại (tính lúc truy vấn — D-21)", async () => {
    const { data } = await admin
      .from("attendance_records")
      .select("*")
      .eq("company_id", COMPANY_ID)
      .limit(1)
      .single();

    const columns = Object.keys(data ?? {});
    expect(columns).not.toContain("day_type");
    expect(columns).not.toContain("night_minutes");
    expect(columns).not.toContain("overtime_minutes");
    expect(columns).not.toContain("converted_overtime_hours");
  });

  it("9. vai trò employee hỏi employeeId khác của chính mình -> 403", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({
      ...session("employee"),
      employeeId: "emp-khac",
    });

    const response = await GET_CLASSIFICATION(
      new Request(
        `http://localhost/api/attendance/classification?employeeId=${EMPLOYEE_ID}&month=${MONTH}`,
      ),
    );

    expect(response.status).toBe(403);
    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  it("10. tháng không có bản ghi nào -> mảng rỗng với mã 200, không lỗi", async () => {
    const response = await GET_CLASSIFICATION(
      new Request(
        `http://localhost/api/attendance/classification?employeeId=${EMPLOYEE_ID}&month=2018-01`,
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("11. ForbiddenError không rò dữ liệu: phản hồi 403 không mang mảng phân loại", async () => {
    vi.mocked(getSessionContext).mockRejectedValueOnce(new ForbiddenError());

    const response = await GET_CLASSIFICATION(
      new Request(
        `http://localhost/api/attendance/classification?employeeId=${EMPLOYEE_ID}&month=${MONTH}`,
      ),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(Array.isArray(body)).toBe(false);
  });
});
