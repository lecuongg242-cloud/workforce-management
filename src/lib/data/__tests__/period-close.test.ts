// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getSessionContext } from "@/lib/auth/session-context";
import { closePeriod } from "@/lib/data/mutations/periods";
import { reviewRequest } from "@/lib/data/mutations/requests";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * PERD-02 tren du lieu that: cai khoa cua ky da chot co rang khong.
 *
 * BAI KIEM QUAN TRONG NHAT LA HAI BAI LIEN NHAU (test 5 va test 6):
 *   - duyet mot yeu cau bo sung cong cho mot ngay trong ky DA CHOT ->
 *     THANH CONG (duong hop le van di duoc);
 *   - NGAY SAU DO, `insert` thang voi cung du lieu -> VAN BI CHAN.
 *
 * Neu co `tf.applying_approved_request` ro ra ngoai transaction cua ham SQL —
 * hoac neu ai do dat no o mot cho khac — thi bai dau van xanh trong khi cai
 * khoa da hong, va chi bai thu hai phat hien ra (T-05-05-02).
 *
 * Test dung khoa `service_role` (bo qua RLS) de CHUNG MINH manh hon: khoa do
 * khong bo qua trigger. Mot lop bao ve chi chan duoc nguoi dung thuong thi
 * khong phai mot lop bao ve.
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

/** Ky se duoc chot — thang 04/2015, da qua tu lau. */
const CLOSED_MONTH = "2015-04";
const CLOSED_DATE_EXISTING = "2015-04-01"; // Thu Tu
const CLOSED_DATE_NEW = "2015-04-08"; // Thu Tu
const CLOSED_DATE_VIA_REQUEST = "2015-04-15"; // Thu Tu
/** Ky KHAC, khong chot — de kiem trigger khong chan nham. */
const OPEN_DATE = "2015-05-06"; // Thu Tu

describe("Chốt kỳ công và bảo vệ kỳ đã chốt (PERD-01, PERD-02)", () => {
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
  const COMPANY_ID = `cty-0505-${suffix}`;
  const DEPARTMENT_ID = `dept-0505-${suffix}`;
  const SHIFT_ID = `sft-0505-${suffix}`;
  const EMPLOYEE_ID = `emp-0505-${suffix}`;
  const REQUEST_SUPPLEMENT = `wr-0505-${suffix}-supp`;

  let actorUserId = "";

  function session(role: "owner" | "employee" = "owner") {
    return {
      userId: actorUserId,
      email: `test-05-05-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role,
      employeeId: EMPLOYEE_ID,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  /** Chen thang mot ban ghi cham cong — duong ghi ma trigger phai chan. */
  async function insertRecord(id: string, date: string) {
    return admin.from("attendance_records").insert({
      id: `att-0505-${suffix}-${id}`,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      work_date: date,
      shift_id: SHIFT_ID,
      check_in_at: null,
      check_out_at: null,
      worked_minutes: 0,
      late_minutes: 0,
      early_leave_minutes: 0,
      status: "leave_paid",
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    });
  }

  beforeAll(async () => {
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: `test-05-05-${suffix}@timeflow.test`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (createUserError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${createUserError?.message}`);
    }
    actorUserId = createdUser.user.id;

    const { error: companyError } = await admin.from("companies").insert({
      id: COMPANY_ID,
      name: `Doanh nghiệp test 05-05 ${suffix}`,
      code: `T0505${suffix.slice(0, 4).toUpperCase()}`,
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
    await admin.from("memberships").insert({
      user_id: actorUserId,
      company_id: COMPANY_ID,
      role: "owner",
      status: "active",
    });

    await admin.from("departments").insert({
      id: DEPARTMENT_ID,
      company_id: COMPANY_ID,
      name: "Phòng test",
      description: "Test 05-05",
      manager_id: null,
      status: "active",
    });

    await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca test 05-05",
      code: "T0505",
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
      code: "T0505NV",
      full_name: "Nhân viên test 05-05",
      email: `${EMPLOYEE_ID}@timeflow.test`,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male",
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Test",
      contract_type: "full_time",
      start_date: "2014-01-01",
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

    // Yeu cau bo sung cong cho mot ngay trong ky SE BI CHOT — duong hop le duy
    // nhat de cham vao ky da chot.
    await admin.from("work_requests").insert({
      id: REQUEST_SUPPLEMENT,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      type: "attendance_supplement",
      status: "pending",
      from_date: CLOSED_DATE_VIA_REQUEST,
      to_date: CLOSED_DATE_VIA_REQUEST,
      from_time: "08:00",
      to_time: "16:00",
      reason: "[test 05-05] Bổ sung công vào kỳ đã chốt.",
    });

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  afterAll(async () => {
    // Xoa ban ghi cham cong PHAI di qua trigger — ky da chot chan ca DELETE.
    // Mo lai ky khong co duong nao (D-32b) nen dung `update periods` truc tiep
    // bang khoa secret: day la thao tac DON DEP CUA TEST, khong phai mot duong
    // di cua ung dung, va no co y KHONG duoc goi goi thanh mot ham dung chung.
    await admin
      .from("periods")
      .update({ status: "open" })
      .eq("company_id", COMPANY_ID);
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
    await admin.from("audit_log").delete().eq("actor_user_id", actorUserId);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. kỳ chưa chốt: ghi bình thường, trigger không chặn nhầm (T-05-05-03)", async () => {
    const { error } = await insertRecord("existing", CLOSED_DATE_EXISTING);
    expect(error).toBeNull();

    const { error: openError } = await insertRecord("open-month", OPEN_DATE);
    expect(openError).toBeNull();
  });

  it("2. chốt kỳ chưa kết thúc bị từ chối kèm lý do đọc được (T-05-05-05)", async () => {
    // "Hom nay" lay tu DONG HO DATABASE (D-19), khong tu dong ho cua tien
    // trinh chay test — neu hai ben lech mui gio thi bai nay se do nham.
    const { data: serverNow } = await admin.rpc("tf_server_now");
    const { data: today } = await admin.rpc("tf_work_date", {
      p_instant: serverNow as string,
    });
    const currentMonth = (today as string).slice(0, 7);

    await expect(closePeriod(currentMonth)).rejects.toThrow(/chưa kết thúc/);
  });

  it("3. chốt kỳ đã kết thúc: tự tạo dòng kỳ, ghi closed_at/closed_by và một dòng audit", async () => {
    const period = await closePeriod(CLOSED_MONTH);

    expect(period.status).toBe("closed");
    expect(period.startDate).toBe("2015-04-01");
    expect(period.endDate).toBe("2015-04-30");
    expect(period.closedAt).not.toBeNull();
    expect(period.closedBy).toBe(actorUserId);

    const { data: audit } = await admin
      .from("audit_log")
      .select("action, entity_table, entity_id, reason")
      .eq("actor_user_id", actorUserId)
      .eq("entity_table", "periods");
    expect(audit).toHaveLength(1);
    expect(audit?.[0].action).toBe("update");
    expect(audit?.[0].reason).toContain(CLOSED_MONTH);

    // Chot lan hai bi tu choi.
    await expect(closePeriod(CLOSED_MONTH)).rejects.toThrow(/đã được chốt/);
  });

  it("4. sau khi chốt: insert / update / delete thẳng đều BỊ CHẶN, kể cả bằng khoá service_role", async () => {
    const { error: insertError } = await insertRecord("blocked", CLOSED_DATE_NEW);
    expect(insertError).not.toBeNull();
    expect(insertError?.message).toContain("đã chốt");

    const { error: updateError } = await admin
      .from("attendance_records")
      .update({ worked_minutes: 1 })
      .eq("id", `att-0505-${suffix}-existing`);
    expect(updateError).not.toBeNull();
    expect(updateError?.message).toContain("đã chốt");

    const { error: deleteError } = await admin
      .from("attendance_records")
      .delete()
      .eq("id", `att-0505-${suffix}-existing`);
    expect(deleteError).not.toBeNull();

    // Dong cu van con nguyen ven.
    const { data: still } = await admin
      .from("attendance_records")
      .select("worked_minutes")
      .eq("id", `att-0505-${suffix}-existing`)
      .single();
    expect(still?.worked_minutes).toBe(0);
  });

  it("5. ĐƯỜNG HỢP LỆ vẫn đi được: duyệt một yêu cầu bổ sung công tạo bản ghi trong kỳ đã chốt", async () => {
    const result = await reviewRequest(REQUEST_SUPPLEMENT, { decision: "approved" });
    expect(result.effect.insertedCount).toBe(1);

    const { data: rows } = await admin
      .from("attendance_records")
      .select("id, worked_minutes")
      .eq("company_id", COMPANY_ID)
      .eq("work_date", CLOSED_DATE_VIA_REQUEST);
    expect(rows).toHaveLength(1);
    expect(rows?.[0].worked_minutes).toBe(480);
  });

  it("6. NGAY SAU đường hợp lệ đó, insert thẳng VẪN bị chặn — cờ không rò ra ngoài (T-05-05-02)", async () => {
    const { error } = await insertRecord("after-flag", CLOSED_DATE_NEW);
    expect(error).not.toBeNull();
    expect(error?.message).toContain("đã chốt");
  });

  it("7. kỳ tháng KHÁC (chưa chốt) không bị ảnh hưởng", async () => {
    const { error } = await admin
      .from("attendance_records")
      .update({ worked_minutes: 30 })
      .eq("id", `att-0505-${suffix}-open-month`);
    expect(error).toBeNull();

    const { error: insertError } = await insertRecord("open-month-2", "2015-05-07");
    expect(insertError).toBeNull();
  });

  it("8. mọi thay đổi vào kỳ đã chốt đều để lại vết trong audit_log", async () => {
    const { data: audit } = await admin
      .from("audit_log")
      .select("entity_table, entity_id, reason")
      .eq("actor_user_id", actorUserId)
      .eq("entity_id", REQUEST_SUPPLEMENT);

    expect(audit).toHaveLength(1);
    expect(audit?.[0].entity_table).toBe("work_requests");
    // Vet mang CA he qua len du lieu cong, khong chi quyet dinh.
    expect(audit?.[0].reason).toContain("tạo 1 bản ghi công");
  });
});
