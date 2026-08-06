// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/overtime-rules/route";
import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { createOvertimeRuleVersion } from "@/lib/data/mutations/overtime-rules";
import { createServerSupabase } from "@/lib/supabase/server";
import { overtimeRuleInputSchema } from "@/lib/validation/api/overtime-rules";
import type { OvertimeRuleGroup } from "@/lib/types/domain";

/**
 * SET-03 tren du lieu that. Ba khang dinh quan trong nhat:
 *   - `UPDATE`/`DELETE` tren `overtime_rules` bi DATABASE tu choi (D-25a) —
 *     day la thu duy nhat lam quy uoc append-only co rang;
 *   - khai mot phien ban moi KHONG xoa phien ban cu;
 *   - loai ngay chua khai tra `null`, khong bao gio 1.0 (D-26).
 *
 * FIXTURE KHONG DON DEP DUOC — VA DO LA DUNG Y MUON:
 * chinh trigger append-only chan ca `DELETE`, nen file nay khong the xoa dong
 * no tao ra (cach duy nhat la tam go trigger qua psql, xem khoi comment cua
 * migration 0016). Vi vay fixture duoc thiet ke IDEMPOTENT: dung mot bo dong
 * co dinh, lan chay dau tao ra, cac lan sau DUNG LAI — khong tich luy them
 * dong nao. Tien le: 02-02-SUMMARY.md da ghi nhan mot truong hop tuong tu
 * (fixture pgTAP nam lai tren db dev) nhu mot danh doi co gioi han va co y
 * thuc.
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

/** Bo fixture co dinh — xem khoi comment o tren ve tinh idempotent. */
const HOLIDAY_OLD = { effectiveFrom: "2019-01-01", multiplier: 2 };
const HOLIDAY_NEW = { effectiveFrom: "2019-06-01", multiplier: 3 };
const NIGHT_FUTURE = { effectiveFrom: "2099-01-01", multiplier: 1.3 };

describe("Hệ số tăng ca append-only theo effective_from (SET-03)", () => {
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

  function session(role: "owner" | "employee") {
    return {
      userId: actorUserId,
      email: actorEmail,
      companyId: COMPANY_ID,
      role,
      employeeId: null,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  async function readGroups(): Promise<OvertimeRuleGroup[]> {
    const response = await GET();
    expect(response.status).toBe(200);
    return (await response.json()) as OvertimeRuleGroup[];
  }

  /** Tao phien ban neu chua co; tra ve `true` khi lan goi nay thuc su tao ra no. */
  async function ensureVersion(
    ruleKey: "weekday" | "weekend" | "holiday" | "night",
    version: { effectiveFrom: string; multiplier: number },
  ): Promise<boolean> {
    const { data: existing } = await admin
      .from("overtime_rules")
      .select("id")
      .eq("company_id", COMPANY_ID)
      .eq("rule_key", ruleKey)
      .eq("effective_from", version.effectiveFrom)
      .maybeSingle();
    if (existing) return false;

    const created = await createOvertimeRuleVersion({ ruleKey, ...version });
    createdThisRun.push(created.id);
    return true;
  }

  beforeAll(async () => {
    actorEmail = `test-04-04-${randomUUID()}@timeflow.test`;
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
  });

  afterAll(async () => {
    // audit_log xoa duoc (khong co trigger nao chan) — chi cac dong `overtime_rules`
    // la o lai, theo dung thiet ke append-only.
    await admin.from("audit_log").delete().eq("actor_user_id", actorUserId);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. UPDATE trên overtime_rules bị DATABASE từ chối (D-25a — trigger có răng)", async () => {
    const { error } = await admin
      .from("overtime_rules")
      .update({ multiplier: 9.99 })
      .eq("company_id", COMPANY_ID);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("append-only");
  });

  it("2. DELETE trên overtime_rules bị DATABASE từ chối (D-25a)", async () => {
    const { error } = await admin
      .from("overtime_rules")
      .delete()
      .eq("company_id", COMPANY_ID)
      .eq("rule_key", "weekday");

    expect(error).not.toBeNull();
    expect(error?.message).toContain("append-only");
  });

  it("3. khai một phiên bản mới KHÔNG xoá phiên bản cũ — cả hai cùng tồn tại", async () => {
    await ensureVersion("holiday", HOLIDAY_OLD);
    await ensureVersion("holiday", HOLIDAY_NEW);

    const { data } = await admin
      .from("overtime_rules")
      .select("effective_from, multiplier")
      .eq("company_id", COMPANY_ID)
      .eq("rule_key", "holiday")
      .order("effective_from", { ascending: true });

    const rows = data ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.some((row) => row.effective_from === HOLIDAY_OLD.effectiveFrom)).toBe(
      true,
    );
    expect(rows.some((row) => row.effective_from === HOLIDAY_NEW.effectiveFrom)).toBe(
      true,
    );
  });

  it("4. tf_overtime_multiplier trả hệ số ĐANG HIỆU LỰC tại ngày được hỏi, không phải hệ số hôm nay (tiêu chí 4)", async () => {
    const { data: before } = await admin.rpc("tf_overtime_multiplier", {
      p_company_id: COMPANY_ID,
      p_rule_key: "holiday",
      p_date: "2019-03-01",
    });
    const { data: after } = await admin.rpc("tf_overtime_multiplier", {
      p_company_id: COMPANY_ID,
      p_rule_key: "holiday",
      p_date: "2019-08-01",
    });

    expect(Number(before)).toBe(HOLIDAY_OLD.multiplier);
    expect(Number(after)).toBe(HOLIDAY_NEW.multiplier);
  });

  it("5. ngày trước MỌI phiên bản -> null, không lùi về dòng gần nhất (D-26)", async () => {
    const { data } = await admin.rpc("tf_overtime_multiplier", {
      p_company_id: COMPANY_ID,
      p_rule_key: "holiday",
      p_date: "2018-12-31",
    });

    expect(data).toBeNull();
  });

  it("6. GET /api/overtime-rules trả đủ BỐN loại ngày; loại chưa khai có currentMultiplier null", async () => {
    const groups = await readGroups();

    expect(groups.map((group) => group.ruleKey)).toEqual([
      "weekday",
      "weekend",
      "holiday",
      "night",
    ]);

    const weekend = groups.find((group) => group.ruleKey === "weekend");
    expect(weekend?.currentMultiplier).toBeNull();
    expect(weekend?.versions).toEqual([]);

    const holiday = groups.find((group) => group.ruleKey === "holiday");
    expect(holiday?.currentMultiplier).toBe(HOLIDAY_NEW.multiplier);
    // Lich su sap xep moi nhat truoc.
    expect(holiday?.versions[0].effectiveFrom).toBe(HOLIDAY_NEW.effectiveFrom);
  });

  it("7. phiên bản có effective_from TƯƠNG LAI chưa được coi là đang hiệu lực", async () => {
    await ensureVersion("night", NIGHT_FUTURE);

    const groups = await readGroups();
    const night = groups.find((group) => group.ruleKey === "night");

    expect(night?.versions.length).toBeGreaterThanOrEqual(1);
    expect(night?.currentMultiplier).toBeNull();
  });

  it("8. trùng (rule_key, effective_from) -> thông điệp tiếng Việt, không phải lỗi Postgres thô", async () => {
    await expect(
      createOvertimeRuleVersion({
        ruleKey: "holiday",
        multiplier: 4,
        effectiveFrom: HOLIDAY_NEW.effectiveFrom,
      }),
    ).rejects.toThrow(/Đã có một phiên bản hệ số/);
  });

  it("9. hệ số <= 0 bị chặn ở tầng schema, trước khi chạm database", () => {
    expect(() =>
      overtimeRuleInputSchema.parse({
        ruleKey: "weekday",
        multiplier: 0,
        effectiveFrom: "2026-01-01",
      }),
    ).toThrow();
    expect(() =>
      overtimeRuleInputSchema.parse({
        ruleKey: "khong-ton-tai",
        multiplier: 1.5,
        effectiveFrom: "2026-01-01",
      }),
    ).toThrow();
  });

  it("10. vai trò employee bị từ chối ở đường ghi", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session("employee"));

    await expect(
      createOvertimeRuleVersion({
        ruleKey: "weekday",
        multiplier: 1.5,
        effectiveFrom: "2026-01-01",
      }),
    ).rejects.toThrow(ForbiddenError);

    vi.mocked(getSessionContext).mockResolvedValue(session("owner"));
  });

  it("11. mỗi lần khai để lại đúng một dòng audit action=insert", async () => {
    const { data } = await admin
      .from("audit_log")
      .select("action, entity_table")
      .eq("actor_user_id", actorUserId)
      .eq("entity_table", "overtime_rules");

    expect((data ?? []).length).toBe(createdThisRun.length);
    expect((data ?? []).every((row) => row.action === "insert")).toBe(true);
  });
});
