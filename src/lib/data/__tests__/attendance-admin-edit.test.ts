// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT (spec 2026-09-06 — quan tri chinh cham
// cong). Muc nay la muc DUY NHAT co nghia cho lat cat nay: gia tri cua no nam
// o ba rang buoc cua database (trigger ky da chot, CHECK `work_date`, partial
// unique index luot dang mo) va o bon cot dan xuat duoc tinh qua RPC. Mot bo
// mock se khang dinh code goi dung ham, khong khang dinh duoc rang database
// chap nhan ket qua.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import {
  createAttendanceRecord,
  deleteAttendanceRecord,
  updateAttendanceRecord,
} from "@/lib/data/mutations/attendance";
import { createServerSupabase } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

vi.mock("@/lib/auth/session-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session-context")>();
  return {
    ...actual,
    getSessionContext: vi.fn(),
  };
});

/** Thang co dinh trong qua khu, khong dung chung voi fixture khac. */
const WORK_DATE = "2019-03-06"; // Thu Tu
const CLOSED_DATE = "2019-02-06"; // Thu Tu, thuoc ky se duoc chot

describe("Quản trị chỉnh chấm công (spec 2026-09-06)", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SECRET_KEY — test này chạy trên Postgres dev thật, cần .env.local.",
    );
  }
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const suffix = randomUUID().slice(0, 8);
  const COMPANY_ID = `cty-edit-${suffix}`;
  const OTHER_COMPANY_ID = `cty-edit2-${suffix}`;
  const DEPARTMENT_ID = `dept-edit-${suffix}`;
  const SHIFT_ID = `sft-edit-${suffix}`;
  const EMPLOYEE_ID = `emp-edit-${suffix}`;

  let actorUserId = "";

  function session(role: "owner" | "admin" | "manager" | "employee" = "admin") {
    return {
      userId: actorUserId,
      email: `test-edit-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role,
      employeeId: EMPLOYEE_ID,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  async function localInstant(date: string, time: string): Promise<string> {
    const { data } = await admin.rpc("tf_local_instant", {
      p_date: date,
      p_time: time,
    });
    return data as string;
  }

  /** Mot luot 08:00-16:00 dung gio, tra ve id. */
  async function seedPunch(date: string, id: string): Promise<string> {
    const checkInAt = await localInstant(date, "08:00:00");
    const checkOutAt = await localInstant(date, "16:00:00");
    const { error } = await admin.from("attendance_records").insert({
      id,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      work_date: date,
      shift_id: SHIFT_ID,
      check_in_at: checkInAt,
      check_out_at: checkOutAt,
      worked_minutes: 480,
      late_minutes: 0,
      early_leave_minutes: 0,
      status: "on_time",
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    });
    if (error) throw new Error(`Không tạo được bản ghi: ${error.message}`);
    return id;
  }

  async function readRow(id: string) {
    const { data } = await admin
      .from("attendance_records")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data as Record<string, unknown> | null;
  }

  beforeAll(async () => {
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: `test-edit-${suffix}@timeflow.test`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (createUserError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${createUserError?.message}`);
    }
    actorUserId = createdUser.user.id;

    for (const [id, name] of [
      [COMPANY_ID, "A"],
      [OTHER_COMPANY_ID, "B"],
    ] as const) {
      await admin.from("companies").insert({
        id,
        name: `Doanh nghiệp test sửa công ${name} ${suffix}`,
        code: `TE${name}${suffix.slice(0, 4).toUpperCase()}`,
        industry: "services",
        size: "1-10",
        phone: "0900000000",
        address: "Test",
        accent: "indigo",
      });
      await admin.from("company_settings").insert({ company_id: id });
    }

    await admin.from("departments").insert({
      id: DEPARTMENT_ID,
      company_id: COMPANY_ID,
      name: "Phòng test",
      description: "Test sửa công",
      manager_id: null,
      status: "active",
    });

    // Ca hanh chinh 08:00-16:00, dung gio tuyet doi (tolerance 0) de so phut
    // muon tinh ra doc duoc thang.
    await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca test sửa công",
      code: "TEDIT",
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
      code: "TEDITNV",
      full_name: "Nhân viên test sửa công",
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

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
  });

  beforeEach(async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session("admin"));
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
  });

  afterAll(async () => {
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
    await admin.from("audit_log").delete().eq("company_id", COMPANY_ID);
    await admin.from("periods").delete().eq("company_id", COMPANY_ID);
    await admin.from("employees").delete().eq("company_id", COMPANY_ID);
    await admin.from("shifts").delete().eq("company_id", COMPANY_ID);
    await admin.from("departments").delete().eq("company_id", COMPANY_ID);
    await admin.from("companies").delete().eq("id", OTHER_COMPANY_ID);
    await admin.from("companies").delete().eq("id", COMPANY_ID);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  /* ---------------------------------------------------------------------- */
  /* Quyen va ranh gioi doanh nghiep                                         */
  /* ---------------------------------------------------------------------- */

  it("1. manager và employee bị từ chối, VÀ dữ liệu không đổi một chữ", async () => {
    const id = await seedPunch(WORK_DATE, `att-role-${suffix}`);

    for (const role of ["manager", "employee"] as const) {
      vi.mocked(getSessionContext).mockResolvedValue(session(role));

      await expect(
        updateAttendanceRecord(id, { checkIn: "09:00", checkOut: "17:00" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(deleteAttendanceRecord(id)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(
        createAttendanceRecord({
          employeeId: EMPLOYEE_ID,
          date: WORK_DATE,
          shiftId: SHIFT_ID,
          checkIn: "08:00",
          checkOut: "16:00",
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }

    // Khang dinh quan trong hon ca viec nem loi: ban ghi con Y NGUYEN.
    const row = await readRow(id);
    expect(row?.worked_minutes).toBe(480);
    expect(row?.edited_at).toBeNull();
  });

  it("2. bản ghi của doanh nghiệp khác: không tìm thấy, không ghi gì", async () => {
    const id = await seedPunch(WORK_DATE, `att-scope-${suffix}`);

    // Cung mot ban ghi, nhung phien thuoc doanh nghiep KHAC.
    vi.mocked(getSessionContext).mockResolvedValue({
      ...session("owner"),
      companyId: OTHER_COMPANY_ID,
    });

    await expect(
      updateAttendanceRecord(id, { checkIn: "09:00", checkOut: "17:00" }),
    ).rejects.toThrow("Không tìm thấy bản ghi chấm công.");
    await expect(deleteAttendanceRecord(id)).rejects.toThrow(
      "Không tìm thấy bản ghi chấm công.",
    );

    expect(await readRow(id)).not.toBeNull();
  });

  /* ---------------------------------------------------------------------- */
  /* Tinh lai bon cot dan xuat                                               */
  /* ---------------------------------------------------------------------- */

  it("3. sửa giờ vào muộn: CẢ BỐN cột dẫn xuất được tính lại, không cột nào ôm số cũ", async () => {
    const id = await seedPunch(WORK_DATE, `att-derive-${suffix}`);

    // 08:00-16:00 (đúng giờ, 480 phút) -> 09:30-15:00 (muộn 90, về sớm 60).
    await updateAttendanceRecord(id, { checkIn: "09:30", checkOut: "15:00" });

    const row = await readRow(id);
    expect(row?.late_minutes).toBe(90);
    expect(row?.worked_minutes).toBe(330);
    expect(row?.early_leave_minutes).toBe(60);
    // Di muon uu tien hon ve som — cung thu tu voi `computeDerivedAttendance`.
    expect(row?.status).toBe("late");
  });

  it("4. sửa về đúng giờ: trạng thái quay lại on_time, số phút muộn về 0", async () => {
    const id = await seedPunch(WORK_DATE, `att-back-${suffix}`);
    await updateAttendanceRecord(id, { checkIn: "09:30", checkOut: "15:00" });
    await updateAttendanceRecord(id, { checkIn: "08:00", checkOut: "16:00" });

    const row = await readRow(id);
    expect(row?.late_minutes).toBe(0);
    expect(row?.early_leave_minutes).toBe(0);
    expect(row?.worked_minutes).toBe(480);
    expect(row?.status).toBe("on_time");
  });

  it("5. giờ ra sớm hơn giờ vào = ca qua đêm, không ra thời lượng âm hay 0", async () => {
    const id = await seedPunch(WORK_DATE, `att-night-${suffix}`);

    // 18:00 -> 02:00 hom sau = 8 tieng.
    await updateAttendanceRecord(id, { checkIn: "18:00", checkOut: "02:00" });

    const row = await readRow(id);
    expect(row?.worked_minutes).toBe(480);
  });

  it("6. để trống giờ ra: lượt quay về trạng thái đang mở, thời lượng 0", async () => {
    const id = await seedPunch(WORK_DATE, `att-open-${suffix}`);

    await updateAttendanceRecord(id, { checkIn: "08:00", checkOut: null });

    const row = await readRow(id);
    expect(row?.check_out_at).toBeNull();
    expect(row?.worked_minutes).toBe(0);
  });

  /* ---------------------------------------------------------------------- */
  /* Them va xoa                                                             */
  /* ---------------------------------------------------------------------- */

  it("7. thêm bản ghi cho ngày quên chấm: ngày công suy từ tf_work_date, có dấu đã chỉnh", async () => {
    const created = await createAttendanceRecord({
      employeeId: EMPLOYEE_ID,
      date: WORK_DATE,
      shiftId: SHIFT_ID,
      checkIn: "08:00",
      checkOut: "16:00",
    });

    const row = await readRow(created.id);
    expect(row?.work_date).toBe(WORK_DATE);
    expect(row?.worked_minutes).toBe(480);
    expect(row?.status).toBe("on_time");
    expect(row?.edited_at).not.toBeNull();
    expect(row?.edited_by).toBe(actorUserId);
  });

  it("8. thêm lượt thứ hai đang mở khi đã có một lượt đang mở: báo lỗi tiếng Việt, không phải lỗi Postgres thô", async () => {
    await createAttendanceRecord({
      employeeId: EMPLOYEE_ID,
      date: WORK_DATE,
      shiftId: SHIFT_ID,
      checkIn: "08:00",
      checkOut: null,
    });

    await expect(
      createAttendanceRecord({
        employeeId: EMPLOYEE_ID,
        date: WORK_DATE,
        shiftId: SHIFT_ID,
        checkIn: "13:00",
        checkOut: null,
      }),
    ).rejects.toThrow(/lượt chưa có giờ ra/);
  });

  it("9. xoá bản ghi: biến mất khỏi bảng công, nhưng ảnh chụp nguyên dòng còn trong audit_log", async () => {
    const id = await seedPunch(WORK_DATE, `att-del-${suffix}`);

    await deleteAttendanceRecord(id);

    expect(await readRow(id)).toBeNull();

    const { data: logs } = await admin
      .from("audit_log")
      .select("action, entity_table, entity_id, before")
      .eq("company_id", COMPANY_ID)
      .eq("entity_id", id)
      .eq("action", "delete");

    expect(logs).toHaveLength(1);
    // Khoi phuc duoc neu xoa nham — do la ly do `before` phai nguyen dong.
    expect((logs?.[0]?.before as Record<string, unknown>)?.worked_minutes).toBe(480);
  });

  it("10. mỗi lần sửa đều để lại dấu edited_at/edited_by và một dòng audit", async () => {
    const id = await seedPunch(WORK_DATE, `att-audit-${suffix}`);

    await updateAttendanceRecord(id, { checkIn: "08:30", checkOut: "16:00" });

    const row = await readRow(id);
    expect(row?.edited_at).not.toBeNull();
    expect(row?.edited_by).toBe(actorUserId);

    const { data: logs } = await admin
      .from("audit_log")
      .select("action, before, after")
      .eq("company_id", COMPANY_ID)
      .eq("entity_id", id)
      .eq("action", "update");

    expect(logs).toHaveLength(1);
    expect((logs?.[0]?.before as Record<string, unknown>)?.late_minutes).toBe(0);
    expect((logs?.[0]?.after as Record<string, unknown>)?.late_minutes).toBe(30);
  });

  /* ---------------------------------------------------------------------- */
  /* Ky da chot                                                              */
  /* ---------------------------------------------------------------------- */

  it("11. kỳ đã chốt: cả ba thao tác bị chặn, và thông điệp chỉ đúng đường đi tiếp", async () => {
    const id = await seedPunch(CLOSED_DATE, `att-closed-${suffix}`);

    // Chot ky thang 02/2019 — tu day tro di trigger 0021 chan moi thao tac ghi.
    const { error: closeError } = await admin.from("periods").insert({
      company_id: COMPANY_ID,
      start_date: "2019-02-01",
      end_date: "2019-02-28",
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: actorUserId,
    });
    if (closeError) throw new Error(`Không chốt được kỳ: ${closeError.message}`);

    const nextStep = /yêu cầu bổ sung công/;

    await expect(
      updateAttendanceRecord(id, { checkIn: "09:00", checkOut: "17:00" }),
    ).rejects.toThrow(nextStep);

    await expect(deleteAttendanceRecord(id)).rejects.toThrow(nextStep);

    await expect(
      createAttendanceRecord({
        employeeId: EMPLOYEE_ID,
        date: CLOSED_DATE,
        shiftId: SHIFT_ID,
        checkIn: "08:00",
        checkOut: "16:00",
      }),
    ).rejects.toThrow(nextStep);

    // Ban ghi cua ky da chot khong suy suyen.
    const row = await readRow(id);
    expect(row?.worked_minutes).toBe(480);
    expect(row?.edited_at).toBeNull();

    await admin.from("periods").delete().eq("company_id", COMPANY_ID);
  });
});
