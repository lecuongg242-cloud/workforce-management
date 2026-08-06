import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  OVERTIME_RULE_KEYS,
  overtimeRuleListResponseSchema,
  overtimeRuleRowSchema,
} from "@/lib/validation/api/overtime-rules";

/**
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. Duong GHI la Server Action
 * `createOvertimeRuleVersion` (`src/lib/data/mutations/overtime-rules.ts`).
 *
 * Tra ve DU BON khoa, ke ca khoa chua duoc khai lan nao — voi
 * `currentMultiplier: null` va `versions: []`. Doanh nghiep moi vi vay thay
 * bon the "Chua khai he so" thay vi mot man hinh rong khong noi len dieu gi
 * (D-26).
 */
export const dynamic = "force-dynamic";

const OVERTIME_RULE_COLUMNS = "id, company_id, rule_key, multiplier, effective_from";

export async function GET(): Promise<NextResponse> {
  try {
    const { companyId } = await getSessionContext();
    const supabase = await createServerSupabase();

    // "Hom nay" theo dong ho SERVER (D-19) — he so DANG HIEU LUC phai duoc
    // xac dinh theo ngay cua may chu, khong theo dong ho may nguoi dung.
    const { data: serverNow, error: nowError } = await supabase.rpc("tf_server_now");
    if (nowError || !serverNow) {
      throw new Error("Không đọc được thời gian máy chủ.");
    }
    const { data: today, error: todayError } = await supabase.rpc("tf_work_date", {
      p_instant: serverNow as string,
    });
    if (todayError || !today) {
      throw new Error("Không xác định được ngày hiện tại.");
    }

    const { data, error } = await supabase
      .from("overtime_rules")
      .select(OVERTIME_RULE_COLUMNS)
      .eq("company_id", companyId)
      .order("effective_from", { ascending: false })
      .order("id", { ascending: true });

    if (error) {
      throw new Error("Không thể tải hệ số tăng ca.");
    }

    const versions = ((data ?? []) as unknown[]).map((row) =>
      overtimeRuleRowSchema.parse(row),
    );

    const groups = OVERTIME_RULE_KEYS.map((ruleKey) => {
      const ofKey = versions.filter((version) => version.ruleKey === ruleKey);
      // Phien ban DANG HIEU LUC: effective_from lon nhat ma van <= hom nay.
      // Ngay hom nay nam TRUOC moi phien ban -> khong co he so nao hieu luc,
      // tra `null` chu KHONG lui ve phien ban gan nhat (D-26 — cung dung mot
      // quy tac voi `tf_overtime_multiplier` cua migration 0016).
      const current = ofKey.find((version) => version.effectiveFrom <= (today as string));
      return {
        ruleKey,
        currentMultiplier: current?.multiplier ?? null,
        currentEffectiveFrom: current?.effectiveFrom ?? null,
        versions: ofKey,
      };
    });

    return NextResponse.json(overtimeRuleListResponseSchema.parse(groups));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      return NextResponse.json(
        overtimeRuleListResponseSchema.parse(
          OVERTIME_RULE_KEYS.map((ruleKey) => ({
            ruleKey,
            currentMultiplier: null,
            currentEffectiveFrom: null,
            versions: [],
          })),
        ),
      );
    }
    console.error("Lỗi không xác định ở GET /api/overtime-rules:", cause);
    return NextResponse.json(
      { error: "Không thể tải hệ số tăng ca." },
      { status: 500 },
    );
  }
}
