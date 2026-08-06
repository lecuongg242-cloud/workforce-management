// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/pay-adjustments/route";
import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import {
  createPayAdjustment,
  deactivatePayAdjustment,
  updatePayAdjustment,
} from "@/lib/data/mutations/pay-adjustments";
import { resolveTargets } from "@/lib/payroll/scope";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PayAdjustment, PayAdjustmentInput } from "@/lib/types/domain";

/**
 * Danh muc phu cap / khau tru tren du lieu that (PAY-04).
 *
 * Bai QUAN TRONG NHAT la bai "toan cong ty tru 2 nguoi, roi tuyen them mot
 * nguoi": phep giai pham vi doc tu DATABASE phai cho ra dung nguoi thu ba moi
 * do — day la ban tren du lieu that cua khang dinh ma `scope.test.ts` giu o
 * tang mo-dun thuan.
 *
 * Bai thu hai: khong co duong XOA nao. Chi `deactivate`.
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

describe("Danh mục phụ cấp và khấu trừ (PAY-04)", () => {
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
  const COMPANY_ID = `cty-adj-${suffix}`;
  const OTHER_COMPANY_ID = `cty-adj2-${suffix}`;
  const DEPARTMENT_ID = `dept-adj-${suffix}`;
  const SHIFT_ID = `sft-adj-${suffix}`;
  const EMPLOYEE_IDS = [1, 2, 3, 4].map((index) => `emp-adj-${suffix}-${index}`);

  let actorUserId = "";
  /** Khoan cua doanh nghiep KHAC — dung lam id cheo. */
  let foreignAdjustmentId = "";

  function session(role: "owner" | "employee" = "owner") {
    return {
      userId: actorUserId,
      email: `test-adj-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role,
      employeeId: EMPLOYEE_IDS[0],
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  function input(overrides: Partial<PayAdjustmentInput> = {}): PayAdjustmentInput {
    return {
      name: "Phụ cấp ăn trưa",
      kind: "allowance",
      valueType: "fixed_amount",
      value: 730000,
      basis: "per_period",
      isActive: true,
      scopes: [{ mode: "include", scopeType: "company", scopeValue: null }],
      ...overrides,
    };
  }

  async function readList(): Promise<PayAdjustment[]> {
    const response = await GET();
    expect(response.status).toBe(200);
    return (await response.json()) as PayAdjustment[];
  }

  /** Nhan vien cua doanh nghiep test, dung hinh dang ma `scope.ts` can. */
  async function loadEmployees() {
    const { data } = await admin
      .from("employees")
      .select("id, department_id, position")
      .eq("company_id", COMPANY_ID);
    return ((data ?? []) as Array<{
      id: string;
      department_id: string | null;
      position: string;
    }>).map((row) => ({
      id: row.id,
      departmentId: row.department_id,
      position: row.position,
    }));
  }

  beforeAll(async () => {
    const { data: createdUser, error: userError } =
      await admin.auth.admin.createUser({
        email: `test-adj-${suffix}@timeflow.test`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (userError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${userError?.message}`);
    }
    actorUserId = createdUser.user.id;

    for (const [id, name] of [
      [COMPANY_ID, "Doanh nghiệp test khoản"],
      [OTHER_COMPANY_ID, "Doanh nghiệp test khoản (khác)"],
    ] as const) {
      const { error } = await admin.from("companies").insert({
        id,
        name: `${name} ${suffix}`,
        code: `${id.slice(-8).toUpperCase()}`,
        industry: "services",
        size: "1-10",
        phone: "0900000000",
        address: "Test",
        accent: "indigo",
      });
      if (error) throw new Error(`Không tạo được doanh nghiệp test: ${error.message}`);
      await admin.from("company_settings").insert({ company_id: id });
    }

    await admin.from("departments").insert({
      id: DEPARTMENT_ID,
      company_id: COMPANY_ID,
      name: "Phòng test khoản",
      description: "Test",
      manager_id: null,
      status: "active",
    });
    await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca test",
      code: "ADJT",
      start_time: "08:00",
      end_time: "16:00",
      break_minutes: 0,
      late_tolerance_minutes: 0,
      working_days: [1, 2, 3, 4, 5],
      status: "active",
    });

    const base = {
      company_id: COMPANY_ID,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male" as const,
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      contract_type: "full_time" as const,
      start_date: "2013-01-01",
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

    // Ba nguoi truoc; nguoi thu tu duoc "tuyen them" o bai 3.
    await admin.from("employees").insert(
      EMPLOYEE_IDS.slice(0, 3).map((id, index) => ({
        ...base,
        id,
        code: `ADJ00${index + 1}`,
        full_name: `Người test khoản ${index + 1}`,
        email: `${id}@timeflow.test`,
        position: index === 0 ? "Nhân viên kho" : "Nhân viên văn phòng",
      })),
    );

    // Mot khoan cua doanh nghiep KHAC, de thu id cheo.
    const { data: foreign } = await admin
      .from("pay_adjustments")
      .insert({
        company_id: OTHER_COMPANY_ID,
        name: "Khoản của doanh nghiệp khác",
        kind: "allowance",
        value_type: "fixed_amount",
        value: 100000,
      })
      .select("id")
      .single();
    foreignAdjustmentId = (foreign as { id: string }).id;

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  afterAll(async () => {
    // Khong co trigger append-only tren hai bang nay, nen fixture don dep duoc.
    await admin.from("audit_log").delete().eq("actor_user_id", actorUserId);
    await admin.from("pay_adjustments").delete().eq("company_id", COMPANY_ID);
    await admin.from("pay_adjustments").delete().eq("company_id", OTHER_COMPANY_ID);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. tạo một khoản ghi CẢ khoản lẫn phạm vi trong cùng thao tác", async () => {
    const created = await createPayAdjustment(input());

    expect(created.name).toBe("Phụ cấp ăn trưa");
    expect(created.value).toBe(730000);
    expect(created.isActive).toBe(true);
    expect(created.scopes.length).toBe(1);
    expect(created.scopes[0].scopeType).toBe("company");
    expect(created.scopes[0].scopeValue).toBeNull();
  });

  it("2. 'toàn công ty trừ 2 người' khai bằng 1 include + 2 exclude, ra đúng 1/3 người", async () => {
    const created = await createPayAdjustment(
      input({
        name: "Phụ cấp xăng xe",
        scopes: [
          { mode: "include", scopeType: "company", scopeValue: null },
          { mode: "exclude", scopeType: "employee", scopeValue: EMPLOYEE_IDS[1] },
          { mode: "exclude", scopeType: "employee", scopeValue: EMPLOYEE_IDS[2] },
        ],
      }),
    );

    const employees = await loadEmployees();
    const targets = resolveTargets({ employees, scopes: created.scopes });

    expect(employees.length).toBe(3);
    expect(targets.length).toBe(1);
    expect(targets[0].id).toBe(EMPLOYEE_IDS[0]);
  });

  it("3. TUYỂN THÊM MỘT NGƯỜI -> họ TỰ ĐỘNG vào phạm vi, không phải sửa cấu hình", async () => {
    const list = await readList();
    const adjustment = list.find((item) => item.name === "Phụ cấp xăng xe");
    if (!adjustment) throw new Error("Không tìm thấy khoản vừa tạo.");

    await admin.from("employees").insert({
      id: EMPLOYEE_IDS[3],
      company_id: COMPANY_ID,
      code: "ADJ004",
      full_name: "Người mới tuyển",
      email: `${EMPLOYEE_IDS[3]}@timeflow.test`,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male",
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Nhân viên kho",
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

    const employees = await loadEmployees();
    const targets = resolveTargets({ employees, scopes: adjustment.scopes });

    // 4 - 2 = 2. Neu pham vi duoc khai bang cach LIET KE TAY, con so nay van
    // la 1 — va nguoi moi tuyen mat phu cap dang co ma khong ai bao dong.
    expect(employees.length).toBe(4);
    expect(targets.length).toBe(2);
    expect(targets.map((employee) => employee.id)).toContain(EMPLOYEE_IDS[3]);
  });

  it("4. sửa khoản GHI LẠI TOÀN BỘ tập phạm vi — phạm vi cũ không sót lại dòng nào", async () => {
    const list = await readList();
    const adjustment = list.find((item) => item.name === "Phụ cấp xăng xe");
    if (!adjustment) throw new Error("Không tìm thấy khoản.");

    const updated = await updatePayAdjustment(
      adjustment.id,
      input({
        name: "Phụ cấp xăng xe",
        scopes: [
          { mode: "include", scopeType: "department", scopeValue: DEPARTMENT_ID },
        ],
      }),
    );

    // Ba dong cu (1 include company + 2 exclude) da bien mat hoan toan.
    expect(updated.scopes.length).toBe(1);
    expect(updated.scopes[0].scopeType).toBe("department");

    const { count } = await admin
      .from("pay_adjustment_scopes")
      .select("id", { count: "exact", head: true })
      .eq("adjustment_id", adjustment.id);
    expect(count).toBe(1);
  });

  it("5. TẮT một khoản không xoá nó — dòng vẫn còn và đọc lại được", async () => {
    const list = await readList();
    const adjustment = list.find((item) => item.name === "Phụ cấp ăn trưa");
    if (!adjustment) throw new Error("Không tìm thấy khoản.");

    const deactivated = await deactivatePayAdjustment(adjustment.id, false);
    expect(deactivated.isActive).toBe(false);

    const after = await readList();
    const still = after.find((item) => item.id === adjustment.id);
    expect(still).toBeDefined();
    expect(still?.isActive).toBe(false);
    // Khoan dang bat xep TRUOC khoan da tat.
    expect(after[after.length - 1].id).toBe(adjustment.id);
  });

  it("6. id của doanh nghiệp khác -> 'Không tìm thấy khoản' và dòng đó KHÔNG đổi", async () => {
    const { data: before } = await admin
      .from("pay_adjustments")
      .select("name, value")
      .eq("id", foreignAdjustmentId)
      .single();

    await expect(
      updatePayAdjustment(foreignAdjustmentId, input({ name: "Bị sửa trộm" })),
    ).rejects.toThrow("Không tìm thấy khoản.");
    await expect(
      deactivatePayAdjustment(foreignAdjustmentId, false),
    ).rejects.toThrow("Không tìm thấy khoản.");

    const { data: after } = await admin
      .from("pay_adjustments")
      .select("name, value")
      .eq("id", foreignAdjustmentId)
      .single();

    expect(after).toEqual(before);
  });

  it("7. cách khai vô nghĩa bị chặn ở tầng schema, trước khi chạm database", async () => {
    // Phat di muon khong the la khoan CONG (D-41).
    await expect(
      createPayAdjustment(
        input({ kind: "allowance", basis: "per_late", name: "Thưởng đi muộn" }),
      ),
    ).rejects.toThrow();
    // 300% luong ngay gan nhu chac chan la go nham.
    await expect(
      createPayAdjustment(
        input({ valueType: "percent_of_daily_wage", value: 300, name: "Trừ 300%" }),
      ),
    ).rejects.toThrow();
    // Pham vi `department` khong co gia tri thi khong biet phong nao.
    await expect(
      createPayAdjustment(
        input({
          name: "Thiếu giá trị phạm vi",
          scopes: [{ mode: "include", scopeType: "department", scopeValue: null }],
        }),
      ),
    ).rejects.toThrow();
  });

  it("8. vai trò employee bị từ chối ở CẢ đường đọc lẫn ba đường ghi", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session("employee"));

    const response = await GET();
    expect(response.status).toBe(403);

    await expect(createPayAdjustment(input())).rejects.toThrow(ForbiddenError);
    await expect(
      updatePayAdjustment("bat-ky", input()),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      deactivatePayAdjustment("bat-ky", false),
    ).rejects.toThrow(ForbiddenError);

    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  it("9. mỗi thao tác để lại một dòng audit mang nguyên khoản trước và sau", async () => {
    const { data } = await admin
      .from("audit_log")
      .select("action, entity_table, before, after")
      .eq("actor_user_id", actorUserId)
      .eq("entity_table", "pay_adjustments")
      .order("created_at", { ascending: true });

    const rows = data ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(4); // 2 insert + 1 update + 1 deactivate
    expect(rows.filter((row) => row.action === "insert").length).toBe(2);

    // `before` cua mot lan sua phai mang NGUYEN khoan cu, ke ca pham vi — do
    // la thu duy nhat tra loi duoc "truoc do khoan nay ap cho ai".
    const update = rows.find((row) => row.action === "update");
    expect(update?.before).not.toBeNull();
    expect(update?.after).not.toBeNull();
  });
});
