// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT (cung khuon `attendance-evidence.test.ts`
// cua 03-04): `createServerSupabase` duoc mock de tra ve mot client that dung
// `SUPABASE_SECRET_KEY`, `getSessionContext` duoc mock de dong vai phien owner.
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/attendance/review/route";
import { getSessionContext } from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * VONG DONG CUA D-29 (plan 04-01) — day la ly do ton tai cua ca plan.
 *
 * Cau hoi ma file nay tra loi: doi mot con so o `/admin/settings` co THAT SU
 * lam danh sach "Can xem lai" doi khong, hay trang cai dat chi la mot form ghi
 * vao database roi khong noi nao doc? Test o tang unit
 * (`attendance-review.test.ts` 12/13) da chung minh Route Handler DUNG nguong
 * duoc truyen vao; file nay chung minh not doan con lai: nguong that di tu
 * BANG `company_settings` cua chinh doanh nghiep, qua `loadCompanySettings`,
 * toi ket qua cuoi cung — tren database that, khong mock mot mat cat nao.
 *
 * Fixture do chinh file nay tao (tien to `*-04-01-*`) va xoa het trong
 * `afterAll`; gia tri cau hinh cua `cty-01` duoc doc ra truoc, doi, roi TRA
 * LAI nguyen ban.
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
const SHIFT_ID = "sft-01-day";

const WORK_SITE_ID = "ws-04-01-effect";
const EMPLOYEE_ID = "emp-04-01-effect";
const RECORD_ID = "att-04-01-effect";

/** 300m so voi ban kinh 100m = 3 lan: duoi nguong mac dinh 5, tren nguong 1.2. */
const DISTANCE_METERS = 300;
const RADIUS_METERS = 100;

describe("Cấu hình doanh nghiệp điều khiển danh sách Cần xem lại (D-29)", () => {
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

  let photoId = "";
  let originalMultiplier = 0;

  async function setMultiplier(value: number): Promise<void> {
    const { error } = await admin
      .from("company_settings")
      .update({ suspicious_distance_multiplier: value })
      .eq("company_id", COMPANY_ID);
    if (error) {
      throw new Error(`Không đổi được ngưỡng đáng ngờ: ${error.message}`);
    }
  }

  /** Ban ghi fixture co xuat hien trong danh sach "Can xem lai" khong? */
  async function fixtureIsListed(): Promise<boolean> {
    const response = await GET(new Request("http://localhost/api/attendance/review"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { attendanceRecordId: string }[];
    return body.some((item) => item.attendanceRecordId === RECORD_ID);
  }

  beforeAll(async () => {
    const { data: settingsRow, error: settingsError } = await admin
      .from("company_settings")
      .select("suspicious_distance_multiplier")
      .eq("company_id", COMPANY_ID)
      .single();
    if (settingsError || !settingsRow) {
      throw new Error(
        `Không đọc được cấu hình cty-01 (migration 0015 đã push chưa?): ${settingsError?.message}`,
      );
    }
    originalMultiplier = Number(settingsRow.suspicious_distance_multiplier);

    const { data: workDateRaw, error: workDateError } = await admin.rpc("tf_work_date", {
      p_instant: new Date().toISOString(),
    });
    if (workDateError || !workDateRaw) {
      throw new Error(`tf_work_date thất bại: ${workDateError?.message}`);
    }
    const workDate = workDateRaw as string;

    const { error: workSiteError } = await admin.from("work_sites").insert({
      id: WORK_SITE_ID,
      company_id: COMPANY_ID,
      name: "Điểm làm việc test 04-01",
      latitude: 10.7823,
      longitude: 106.6958,
      radius_meters: RADIUS_METERS,
      is_active: true,
    });
    if (workSiteError) {
      throw new Error(`Không tạo được work_site test: ${workSiteError.message}`);
    }

    const { error: employeeError } = await admin.from("employees").insert({
      id: EMPLOYEE_ID,
      company_id: COMPANY_ID,
      code: "T0401EFF",
      full_name: "Nhân viên test 04-01",
      email: `${EMPLOYEE_ID}@timeflow.test`,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male",
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Test",
      contract_type: "full_time",
      start_date: "2024-01-01",
      manager_id: null,
      shift_id: SHIFT_ID,
      work_location: "Văn phòng chính",
      status: "active",
      system_role: "employee",
      invitation_sent: false,
      can_view_payslip: false,
      // Quan trong: KHONG duoc phep lam viec tu xa, neu khong `isSuspiciousPunch`
      // loai ban ghi nay khoi danh sach vo dieu kien va test se luon xanh gia.
      can_check_in_remotely: false,
      user_id: null,
    });
    if (employeeError) {
      throw new Error(`Không tạo được employee test: ${employeeError.message}`);
    }

    // Gio vao ca dat DUNG bang gio bat dau ca theo ke hoach, de ban ghi nay
    // khong lot vao nhanh "ngoai khung gio ca" — file nay chi do MOT tin hieu.
    const { data: scheduledStart, error: startError } = await admin.rpc(
      "tf_local_instant",
      { p_date: workDate, p_time: "08:00:00" },
    );
    if (startError || !scheduledStart) {
      throw new Error(`tf_local_instant thất bại: ${startError?.message}`);
    }

    const { error: recordError } = await admin.from("attendance_records").insert({
      id: RECORD_ID,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      work_date: workDate,
      shift_id: SHIFT_ID,
      check_in_at: scheduledStart as string,
      check_out_at: null,
      worked_minutes: 0,
      late_minutes: 0,
      early_leave_minutes: 0,
      status: "on_time",
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    });
    if (recordError) {
      throw new Error(`Không tạo được attendance_record test: ${recordError.message}`);
    }

    const { data: photoRow, error: photoError } = await admin
      .from("attendance_photos")
      .insert({
        company_id: COMPANY_ID,
        attendance_record_id: RECORD_ID,
        kind: "check_in",
        storage_path: `${COMPANY_ID}/${EMPLOYEE_ID}/test-04-01.jpg`,
        captured_at: scheduledStart as string,
        latitude: 10.7853,
        longitude: 106.6958,
        accuracy_meters: 8,
        work_site_id: WORK_SITE_ID,
        distance_meters: DISTANCE_METERS,
      })
      .select("id")
      .single();
    if (photoError || !photoRow) {
      throw new Error(`Không tạo được attendance_photo test: ${photoError?.message}`);
    }
    photoId = photoRow.id as string;

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000001",
      email: "owner1@timeflow.test",
      companyId: COMPANY_ID,
      role: "owner",
      employeeId: null,
      isPlatformAdmin: false,
      mustChangePassword: false,
    });
  });

  afterAll(async () => {
    await setMultiplier(originalMultiplier);
    // employees cascade sang attendance_records roi attendance_photos.
    await admin.from("employees").delete().eq("id", EMPLOYEE_ID);
    await admin.from("work_sites").delete().eq("id", WORK_SITE_ID);
    expect(photoId).not.toBe("");
  });

  it("1. ngưỡng mặc định 5 lần bán kính -> lần chấm cách 3 lần bán kính KHÔNG nằm trong danh sách", async () => {
    await setMultiplier(5);

    expect(await fixtureIsListed()).toBe(false);
  });

  it("2. hạ ngưỡng xuống 1.2 trong company_settings -> CHÍNH bản ghi đó xuất hiện, không đụng tới một dòng dữ liệu lịch sử nào", async () => {
    await setMultiplier(1.2);

    expect(await fixtureIsListed()).toBe(true);
  });

  it("3. nâng ngưỡng lên 10 -> bản ghi biến khỏi danh sách trở lại (cấu hình là thứ duy nhất đã đổi)", async () => {
    await setMultiplier(10);

    expect(await fixtureIsListed()).toBe(false);
  });

  it("4. đổi ngưỡng của cty-01 KHÔNG đổi ngưỡng của cty-02 (ranh giới doanh nghiệp)", async () => {
    await setMultiplier(1.2);

    const { data: other, error } = await admin
      .from("company_settings")
      .select("suspicious_distance_multiplier")
      .eq("company_id", "cty-02")
      .single();

    expect(error).toBeNull();
    expect(Number(other?.suspicious_distance_multiplier)).toBe(5);
  });
});
