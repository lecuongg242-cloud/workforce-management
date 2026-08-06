// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/pay-rates/route";
import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { createPayRate } from "@/lib/data/mutations/pay-rates";
import { createServerSupabase } from "@/lib/supabase/server";
import { payRateInputSchema } from "@/lib/validation/api/pay-rates";
import type { PayRateHistory } from "@/lib/types/domain";

/**
 * PAY-06 tren du lieu that. Bon khang dinh quan trong nhat:
 *   - `UPDATE`/`DELETE` tren `employee_pay_rates` bi DATABASE tu choi KE CA
 *     BANG KHOA `service_role` (D-37a) — day la thu duy nhat lam quy uoc
 *     append-only co rang, va o day hau qua la TIEN DA TRA;
 *   - khai mot phien ban moi KHONG xoa phien ban cu;
 *   - `employeeId` cua doanh nghiep khac khong ghi duoc dong nao;
 *   - vai tro `employee` khong doc duoc muc luong cua ai, KE CA cua chinh minh.
 *
 * FIXTURE KHONG DON DEP DUOC — VA DO LA DUNG Y MUON: chinh trigger append-only
 * chan ca `DELETE`. Vi vay fixture duoc thiet ke IDEMPOTENT (cung khuon
 * `overtime-rules.test.ts` cua 04-04): dung mot bo dong co dinh, lan chay dau
 * tao ra, cac lan sau DUNG LAI — khong tich luy them dong nao.
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

const COMPANY_ID = "cty-02";
/** Nhan vien cua cty-02 (seed). */
const EMPLOYEE_ID = "nv-02a";
/** Nhan vien cua cty-01 — dung lam id CHEO doanh nghiep. */
const FOREIGN_EMPLOYEE_ID = "nv-01a";

/** Bo fixture co dinh — xem khoi comment o tren ve tinh idempotent. */
const RATE_OLD = {
  unit: "month" as const,
  amount: 10000000,
  effectiveFrom: "2019-01-01",
};
const RATE_NEW = {
  unit: "month" as const,
  amount: 12000000,
  effectiveFrom: "2019-06-01",
};

describe("Mức lương append-only theo effective_from (PAY-06)", () => {
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
  /** Chi cac dong DUOC TAO TRONG LAN CHAY NAY (lan chay sau se rong). */
  const createdThisRun: string[] = [];

  function session(role: "owner" | "admin" | "employee") {
    return {
      userId: actorUserId,
      email: actorEmail,
      companyId: COMPANY_ID,
      role,
      employeeId: EMPLOYEE_ID,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  async function readHistory(employeeId: string): Promise<Response> {
    return GET(
      new Request(
        `http://localhost/api/pay-rates?employeeId=${encodeURIComponent(employeeId)}`,
      ),
    );
  }

  /** Tao phien ban neu chua co; tra ve `true` khi lan goi nay thuc su tao ra no. */
  async function ensureVersion(version: {
    unit: "month" | "day" | "hour";
    amount: number;
    effectiveFrom: string;
  }): Promise<boolean> {
    const { data: existing } = await admin
      .from("employee_pay_rates")
      .select("id")
      .eq("employee_id", EMPLOYEE_ID)
      .eq("effective_from", version.effectiveFrom)
      .maybeSingle();
    if (existing) return false;

    const created = await createPayRate({ employeeId: EMPLOYEE_ID, ...version });
    createdThisRun.push(created.id);
    return true;
  }

  beforeAll(async () => {
    actorEmail = `test-05-2-01-${randomUUID()}@timeflow.test`;
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
    vi.mocked(getSessionContext).mockResolvedValue(session("owner"));

    await ensureVersion(RATE_OLD);
    await ensureVersion(RATE_NEW);
  });

  afterAll(async () => {
    // audit_log xoa duoc (khong co trigger nao chan) — chi cac dong
    // `employee_pay_rates` la o lai, theo dung thiet ke append-only.
    await admin.from("audit_log").delete().eq("actor_user_id", actorUserId);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. UPDATE trên employee_pay_rates bị DATABASE từ chối, kể cả bằng khoá service_role (D-37a)", async () => {
    const { error } = await admin
      .from("employee_pay_rates")
      .update({ amount: 1 })
      .eq("employee_id", EMPLOYEE_ID);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("append-only");
  });

  it("2. DELETE trên employee_pay_rates bị DATABASE từ chối, kể cả bằng khoá service_role (D-37a)", async () => {
    const { error } = await admin
      .from("employee_pay_rates")
      .delete()
      .eq("employee_id", EMPLOYEE_ID);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("append-only");
  });

  it("3. GET /api/pay-rates trả TOÀN BỘ lịch sử, effective_from giảm dần, kèm mức đang hiệu lực", async () => {
    const response = await readHistory(EMPLOYEE_ID);
    expect(response.status).toBe(200);
    const history = (await response.json()) as PayRateHistory;

    expect(history.employeeId).toBe(EMPLOYEE_ID);
    expect(history.versions.length).toBeGreaterThanOrEqual(2);
    // Moi nhat truoc.
    const dates = history.versions.map((version) => version.effectiveFrom);
    expect([...dates].sort((a, b) => (a < b ? 1 : -1))).toEqual(dates);
    // Ca hai phien ban cung ton tai — khai moi KHONG xoa cu.
    expect(dates).toContain(RATE_OLD.effectiveFrom);
    expect(dates).toContain(RATE_NEW.effectiveFrom);

    // `current` phai KHOP voi `tf_pay_rate_at()` cua database. Day la khang
    // dinh dat gia cua bai nay: no doi chieu phep chon phien ban o tang ung
    // dung (Route Handler) voi phep chon o tang SQL (migration 0022). Hai noi
    // le nhau nghia la mot man hinh va mot phep tinh se noi hai con so khac
    // nhau ve cung mot nguoi — va khong ai bao loi.
    const { data: fromDb } = await admin.rpc("tf_pay_rate_at", {
      p_employee_id: EMPLOYEE_ID,
      p_date: new Date().toISOString().slice(0, 10),
    });
    expect(history.current).not.toBeNull();
    expect(history.current?.id).toBe((fromDb as { id: string }).id);
    expect(history.current?.unit).toBe("month");
  });

  it("4. tf_pay_rate_at trả mức lương ĐANG HIỆU LỰC tại ngày được hỏi, và null khi trước mọi phiên bản", async () => {
    const { data: before } = await admin.rpc("tf_pay_rate_at", {
      p_employee_id: EMPLOYEE_ID,
      p_date: "2019-03-01",
    });
    const { data: after } = await admin.rpc("tf_pay_rate_at", {
      p_employee_id: EMPLOYEE_ID,
      p_date: "2019-08-01",
    });
    const { data: tooEarly } = await admin.rpc("tf_pay_rate_at", {
      p_employee_id: EMPLOYEE_ID,
      p_date: "2018-12-31",
    });

    expect(Number((before as { amount: string }).amount)).toBe(RATE_OLD.amount);
    expect(Number((after as { amount: string }).amount)).toBe(RATE_NEW.amount);
    // Truoc MOI phien ban -> khong co dong nao, khong lui ve dong gan nhat va
    // khong bia ra 0 (D-26).
    expect((tooEarly as { amount: string | null } | null)?.amount ?? null).toBeNull();
  });

  it("5. trùng effective_from cho cùng nhân viên -> thông điệp tiếng Việt, không phải lỗi Postgres thô", async () => {
    await expect(
      createPayRate({
        employeeId: EMPLOYEE_ID,
        unit: "month",
        amount: 15000000,
        effectiveFrom: RATE_NEW.effectiveFrom,
      }),
    ).rejects.toThrow(/đã có một mức lương bắt đầu hiệu lực/i);
  });

  it("6. employeeId của doanh nghiệp khác -> 'Không tìm thấy nhân viên' và KHÔNG ghi dòng nào", async () => {
    const { count: countBefore } = await admin
      .from("employee_pay_rates")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", FOREIGN_EMPLOYEE_ID);

    await expect(
      createPayRate({
        employeeId: FOREIGN_EMPLOYEE_ID,
        unit: "month",
        amount: 9000000,
        effectiveFrom: "2019-02-02",
      }),
    ).rejects.toThrow("Không tìm thấy nhân viên.");

    const { count: countAfter } = await admin
      .from("employee_pay_rates")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", FOREIGN_EMPLOYEE_ID);

    expect(countAfter).toBe(countBefore);
  });

  it("7. amount <= 0 bị chặn ở tầng schema, trước khi chạm database", () => {
    expect(() =>
      payRateInputSchema.parse({
        employeeId: EMPLOYEE_ID,
        unit: "month",
        amount: 0,
        effectiveFrom: "2026-01-01",
      }),
    ).toThrow();
    expect(() =>
      payRateInputSchema.parse({
        employeeId: EMPLOYEE_ID,
        unit: "month",
        amount: -1,
        effectiveFrom: "2026-01-01",
      }),
    ).toThrow();
    expect(() =>
      payRateInputSchema.parse({
        employeeId: EMPLOYEE_ID,
        unit: "nam",
        amount: 1000,
        effectiveFrom: "2026-01-01",
      }),
    ).toThrow();
  });

  it("8. vai trò employee bị từ chối ở CẢ hai đường — kể cả khi hỏi chính mình (D-44)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session("employee"));

    await expect(
      createPayRate({
        employeeId: EMPLOYEE_ID,
        unit: "hour",
        amount: 50000,
        effectiveFrom: "2026-01-01",
      }),
    ).rejects.toThrow(ForbiddenError);

    // Hoi CHINH MINH van 403: nhan vien chua xem duoc luong cua minh o phase
    // nay (PAY-05 van o V3).
    const response = await readHistory(EMPLOYEE_ID);
    expect(response.status).toBe(403);

    vi.mocked(getSessionContext).mockResolvedValue(session("owner"));
  });

  // Moc hieu luc cua bai 9 nam GIUA hai moc fixture co chu dich: neu no nam
  // sau `RATE_NEW`, lan chay THU HAI cua file nay se thay muc dang hieu luc la
  // dong do va bai 3 se do — mot fixture khong don dep duoc thi phai khong
  // duoc lam doi ket qua cua bai khac.
  it("9. vai trò admin khai được mức lương (D-44 — không siết riêng về owner)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session("admin"));

    const { data: existing } = await admin
      .from("employee_pay_rates")
      .select("id")
      .eq("employee_id", EMPLOYEE_ID)
      .eq("effective_from", "2019-03-15")
      .maybeSingle();

    if (!existing) {
      const created = await createPayRate({
        employeeId: EMPLOYEE_ID,
        unit: "month",
        amount: 13000000,
        effectiveFrom: "2019-03-15",
      });
      createdThisRun.push(created.id);
      expect(created.amount).toBe(13000000);
    } else {
      // Lan chay lai: dong da co, chi khang dinh no la cua doanh nghiep nay.
      expect(existing.id).toBeTruthy();
    }

    vi.mocked(getSessionContext).mockResolvedValue(session("owner"));
  });

  it("10. mỗi lần khai để lại đúng một dòng audit action=insert", async () => {
    const { data } = await admin
      .from("audit_log")
      .select("action, entity_table")
      .eq("actor_user_id", actorUserId)
      .eq("entity_table", "employee_pay_rates");

    expect((data ?? []).length).toBe(createdThisRun.length);
    expect((data ?? []).every((row) => row.action === "insert")).toBe(true);
  });

  it("11. hai mẫu số quy đổi KHÔNG có mặc định ở database (D-38 — để trống = chưa khai)", async () => {
    // Doanh nghiep nay chua khai gi -> hai cot phai la `null`. Neu migration
    // dat DEFAULT, moi doanh nghiep se bong nhien co mot mau so ma ho khong
    // dat ra — va do la sai don gia gio cua MOI NGUOI.
    const { data } = await admin
      .from("company_settings")
      .select("work_mode, standard_hours_per_day, standard_days_per_month")
      .eq("company_id", COMPANY_ID)
      .maybeSingle();

    expect(data?.standard_hours_per_day).toBeNull();
    expect(data?.standard_days_per_month).toBeNull();
    // `work_mode` thi NGUOC LAI: co mac dinh `shift`, de doanh nghiep dang
    // chay giu nguyen hanh vi tu Phase 4.
    expect(data?.work_mode).toBe("shift");
  });
});
