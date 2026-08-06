import {
  classifyWorkDay,
  convertedOvertimeHours,
  nightMinutes as nightMinutesOf,
  overtimeMinutes,
  overtimeNightMinutes,
  resolveMultiplier,
  toWorkSegments,
  type WorkDayType,
} from "@/lib/attendance/classification";
import type { AttendanceDay } from "@/lib/attendance/day";
import { effectiveScheduledMinutes } from "@/lib/attendance/work-mode";
import { loadCompanySettings } from "@/lib/settings/company-settings";
import { createServerSupabase } from "@/lib/supabase/server";
import type { OvertimeRuleKey, WeekdayNumber, WorkMode } from "@/lib/types/domain";

/**
 * Ghep quy tac cua doanh nghiep (ngay le, khung gio dem, he so tang ca) vao
 * cac ngay cong da gop — NGUON DUY NHAT cua phep phan loai o phia server, dung
 * chung boi `GET /api/attendance` va `GET /api/attendance/summary`.
 *
 * VI SAO PHAI DUNG CHUNG: hai man hinh doc hai duong khac nhau nhung noi ve
 * cung mot thang cong. Neu moi duong tu ghep quy tac rieng, mot ngay se hien
 * "ngay le" o cho nay va "ngay thuong" o cho kia, va khong ai biet ben nao
 * dung.
 *
 * MOI THU TINH TAI THOI DIEM TRUY VAN — khong cot nao cua `attendance_records`
 * luu loai ngay, phut dem hay gio quy doi (cung khuon D-21 cua 03-06).
 *
 * HE SO TRA THEO `work_date` CUA CHINH BAN GHI, khong theo hom nay. Day la
 * dieu lam cho tieu chi 4 cua Phase 4 dung — va cung la cho de sai nhat: mot
 * dong ma tra theo "hom nay" se lam moi so lieu lich su doi theo moi lan doanh
 * nghiep sua he so, trong khi khong test nao o cac plan truoc phat hien ra.
 */

export interface DayClassification {
  dayType: WorkDayType;
  /** Phut lam viec trong khung gio dem (ca ngay, khong chi phan tang ca). */
  nightMinutes: number;
  overtimeMinutes: number;
  overtimeNightMinutes: number;
  /** `null` khi thieu he so can thiet (D-26) — KHONG BAO GIO la 0 hay 1.0. */
  convertedOvertimeHours: number | null;
  /** Cac khoa he so con thieu ma phut tuong ung lai lon hon 0. */
  missingMultiplierKeys: OvertimeRuleKey[];
  /**
   * D-36a: `true` khi che do tinh cong dang ap KHONG xac dinh duoc mau so
   * (che do `daily_hours` ma doanh nghiep chua khai `standard_hours_per_day`).
   * Khi ay `overtimeMinutes` la 0 vi khong tinh duoc — KHONG phai vi khong co
   * tang ca. Noi goi phai phan biet duoc hai dieu do.
   */
  workModeInputMissing: boolean;
}

export interface ShiftRuleInfo {
  workingDays: WeekdayNumber[];
  /** Do dai ca theo ke hoach da tru gio nghi, phut. */
  scheduledMinutes: number;
}

interface OvertimeVersion {
  ruleKey: OvertimeRuleKey;
  effectiveFrom: string;
  multiplier: number;
}

/**
 * Doc quy tac cua doanh nghiep MOT LAN cho ca khoang thoi gian dang xet:
 * ngay le trong khoang, khung gio dem, va TOAN BO phien ban he so.
 *
 * He so duoc doc het roi phan giai o tang ung dung qua `resolveMultiplier()`
 * thay vi goi `tf_overtime_multiplier` cho tung (ngay x khoa) — mot thang cua
 * mot nhan vien se la vai chuc round-trip. Hai ban cua cung mot quy tac duoc
 * canh bang test doi chieu `overtime-multiplier-parity.test.ts`.
 */
export async function loadCompanyRules({
  companyId,
  fromDate,
  toDate,
}: {
  companyId: string;
  /** "YYYY-MM-DD" */
  fromDate: string;
  toDate: string;
}): Promise<{
  holidayDates: Set<string>;
  nightStartTime: string;
  nightEndTime: string;
  versionsByKey: Map<OvertimeRuleKey, OvertimeVersion[]>;
  /** D-36: cach doanh nghiep dinh nghia mot ngay cong. */
  workMode: WorkMode;
  /** D-38: `null` = CHUA KHAI. Khong duoc thay bang mot con so doan. */
  standardHoursPerDay: number | null;
  standardDaysPerMonth: number | null;
}> {
  const supabase = await createServerSupabase();

  const [settings, holidaysResult, rulesResult] = await Promise.all([
    loadCompanySettings(companyId),
    supabase
      .from("holidays")
      .select("holiday_date")
      .eq("company_id", companyId)
      .gte("holiday_date", fromDate)
      .lte("holiday_date", toDate),
    supabase
      .from("overtime_rules")
      .select("rule_key, multiplier, effective_from")
      .eq("company_id", companyId),
  ]);

  if (holidaysResult.error || rulesResult.error) {
    throw new Error("Không thể tải quy tắc công của doanh nghiệp.");
  }

  const holidayDates = new Set(
    ((holidaysResult.data ?? []) as Array<{ holiday_date: string }>).map(
      (row) => row.holiday_date,
    ),
  );

  const versionsByKey = new Map<OvertimeRuleKey, OvertimeVersion[]>();
  for (const row of (rulesResult.data ?? []) as Array<{
    rule_key: OvertimeRuleKey;
    multiplier: number | string;
    effective_from: string;
  }>) {
    const list = versionsByKey.get(row.rule_key) ?? [];
    list.push({
      ruleKey: row.rule_key,
      effectiveFrom: row.effective_from,
      multiplier: Number(row.multiplier),
    });
    versionsByKey.set(row.rule_key, list);
  }

  return {
    holidayDates,
    nightStartTime: settings.nightStartTime,
    nightEndTime: settings.nightEndTime,
    versionsByKey,
    // Ba gia tri nay den tu CHINH loi doc `loadCompanySettings()` o tren —
    // khong mot truy van thu hai nao duoc mo cho chung.
    workMode: settings.workMode,
    standardHoursPerDay: settings.standardHoursPerDay,
    standardDaysPerMonth: settings.standardDaysPerMonth,
  };
}

export type CompanyRules = Awaited<ReturnType<typeof loadCompanyRules>>;

/** Phan loai MOT ngay cong theo quy tac dang hieu luc TAI NGAY DO. */
export function classifyDay({
  day,
  shift,
  rules,
}: {
  day: AttendanceDay;
  /** Quy tac cua ca ma ngay nay thuoc ve; thieu ca thi khong suy dien gi. */
  shift: ShiftRuleInfo | undefined;
  rules: CompanyRules;
}): DayClassification {
  const dayType = classifyWorkDay({
    workDate: day.date,
    holidayDates: rules.holidayDates,
    // Khong biet ca thi coi nhu ngay do thuoc lich lam viec: mot ngay khong
    // xac dinh duoc ca KHONG duoc mac nhien thanh "ngay nghi" roi bong nhien
    // toan bo gio lam thanh tang ca.
    workingDays: shift?.workingDays ?? [1, 2, 3, 4, 5, 6, 7],
  });

  const segments = toWorkSegments(
    day.punches.map((punch) => ({
      checkIn: punch.checkIn as string,
      checkOut: punch.checkOut,
    })),
  );

  // MAU SO cua phep tinh phan vuot den tu che do tinh cong (D-36), khong tu
  // do dai ca mot cach vo dieu kien. O che do `shift` — che do ma moi doanh
  // nghiep dang chay — ham nay tra dung `shift?.scheduledMinutes` nhu truoc,
  // nen khong mot con so lich su nao doi.
  //
  // `null` nghia la che do `daily_hours` ma chua khai mau so: khi ay KHONG
  // tinh tang ca (0), chu KHONG lay mau so 0 roi bien toan bo gio lam thanh
  // tang ca — do dung la cai bay D-36a.
  const scheduled = effectiveScheduledMinutes({
    mode: rules.workMode,
    shift,
    standardHoursPerDay: rules.standardHoursPerDay,
  });

  const overtime =
    scheduled === null
      ? 0
      : overtimeMinutes({
          workedMinutes: day.workedMinutes,
          scheduledMinutes: scheduled,
          dayType,
        });

  const overtimeNight = overtimeNightMinutes({
    segments,
    overtimeMinutes: overtime,
    nightStart: rules.nightStartTime,
    nightEnd: rules.nightEndTime,
  });

  // HE SO TRA THEO `day.date` — ngay PHAT SINH cua ban ghi, khong phai hom nay.
  const dayMultiplier = resolveMultiplier(
    rules.versionsByKey.get(dayType) ?? [],
    day.date,
  );
  const nightPremium = resolveMultiplier(
    rules.versionsByKey.get("night") ?? [],
    day.date,
  );

  const converted = convertedOvertimeHours({
    dayType,
    overtimeMinutes: overtime,
    overtimeNightMinutes: overtimeNight,
    multipliers: { [dayType]: dayMultiplier, night: nightPremium },
  });

  return {
    dayType,
    // Phut dem cua CA NGAY (khong chi phan tang ca) — hien thi de nguoi doc
    // hieu vi sao mot ngay co phu cap dem trong khi mot ngay khac thi khong.
    nightMinutes: nightMinutesOf({
      segments,
      nightStart: rules.nightStartTime,
      nightEnd: rules.nightEndTime,
    }),
    overtimeMinutes: overtime,
    overtimeNightMinutes: overtimeNight,
    convertedOvertimeHours: converted.hours,
    missingMultiplierKeys: converted.missingKeys,
    workModeInputMissing: scheduled === null,
  };
}

/**
 * Tong gio quy doi cua mot tap ngay. Tra `null` neu BAT KY ngay nao thieu he
 * so — khong cong bo phan de ra mot con so trong nhu da day du (D-26).
 */
export function sumConvertedOvertimeHours(
  classifications: readonly DayClassification[],
): { hours: number | null; missingKeys: OvertimeRuleKey[] } {
  const missing = new Set<OvertimeRuleKey>();
  let total = 0;
  for (const item of classifications) {
    for (const key of item.missingMultiplierKeys) missing.add(key);
    if (item.convertedOvertimeHours !== null) {
      total += item.convertedOvertimeHours;
    }
  }
  if (missing.size > 0) {
    return { hours: null, missingKeys: Array.from(missing) };
  }
  return { hours: Math.round(total * 100) / 100, missingKeys: [] };
}
