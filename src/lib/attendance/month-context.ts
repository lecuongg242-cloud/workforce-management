import {
  classifyDay,
  loadCompanyRules,
  sumConvertedOvertimeHours,
  type CompanyRules,
  type ShiftRuleInfo,
} from "@/lib/attendance/classification-context";
import { groupAttendanceByDay, type ShiftBreakInfo } from "@/lib/attendance/day";
import {
  SHIFT_CONTEXT_COLUMNS,
  buildShiftContext,
  type RawShiftContextRow,
} from "@/lib/attendance/shift-context";
import { resolveDayCredit, sumCreditedDays } from "@/lib/attendance/work-mode";
import { shiftMonth } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AttendanceRecord, MonthlySummary } from "@/lib/types/domain";

/**
 * Ngu canh de tong hop MOT THANG cong, va phep tong hop dung ngu canh do.
 *
 * VI SAO MODULE NAY TON TAI: truoc no, toan bo chuoi "doc ca -> dung
 * shiftBreaks -> dung shiftRules -> gop ngay -> phan loai -> cong lai" nam
 * NGUYEN VAN trong `GET /api/attendance/summary`. Bang chuan bi luong can
 * dung phep do cho TUNG nhan vien cua ca doanh nghiep; chep lai chuoi ay o
 * mot Route Handler thu hai la tao hai duong tinh cung mot con so — dung loai
 * trung lap ma `classification-context.ts` da canh bao (hai noi tu ghep quy
 * tac rieng thi mot ngay se hien "ngay le" o cho nay va "ngay thuong" o cho
 * kia, va khong ai biet ben nao dung).
 *
 * Module SERVER-ONLY: no goi `createServerSupabase()` (doc `next/headers`),
 * cung ly do voi `src/lib/settings/company-settings.ts`.
 */

export interface MonthContext {
  /** "YYYY-MM-DD" — ngay dau thang */
  start: string;
  /** "YYYY-MM-DD" — ngay dau thang KE TIEP (bien tren, khong bao gom) */
  end: string;
  breaks: Record<string, ShiftBreakInfo>;
  shiftRules: Map<string, ShiftRuleInfo>;
  rules: CompanyRules;
}

/**
 * Doc MOT LAN moi thu can de tong hop mot thang: ca lam viec cua doanh nghiep
 * va quy tac cong dang hieu luc trong thang do.
 *
 * Tach khoi phep tong hop de bang chuan bi luong doc ngu canh MOT LAN roi
 * dung lai cho hang chuc nhan vien, thay vi doc lai theo tung nguoi.
 */
export async function loadMonthContext({
  companyId,
  month,
}: {
  companyId: string;
  /** "YYYY-MM" */
  month: string;
}): Promise<MonthContext> {
  const start = `${month}-01`;
  const end = `${shiftMonth(month, 1)}-01`;

  const supabase = await createServerSupabase();
  const { data: shiftRows, error } = await supabase
    .from("shifts")
    .select(SHIFT_CONTEXT_COLUMNS)
    .eq("company_id", companyId);

  if (error) {
    throw new Error("Không thể tải ca làm việc của doanh nghiệp.");
  }

  const { breaks, shiftRules } = buildShiftContext(
    (shiftRows ?? []) as RawShiftContextRow[],
  );

  // SET-04: quy tac DANG HIEU LUC TAI NGAY PHAT SINH, khong phai quy tac hom
  // nay — xem `classification-context.ts`.
  const rules = await loadCompanyRules({ companyId, fromDate: start, toDate: end });

  return { start, end, breaks, shiftRules, rules };
}

/**
 * Tong hop mot thang cong cua MOT nguoi tu tap ban ghi cua chinh nguoi do.
 *
 * Noi goi phai loc san `records` theo nhan vien: `groupAttendanceByDay()` gop
 * theo NGAY, khong theo (nhan vien, ngay) — dua vao ban ghi cua nhieu nguoi se
 * tron cac luot cua ho vao cung mot ngay.
 *
 * Thang khong co ban ghi nao tra ban tong hop TOAN SO 0 voi `month` dung bang
 * tham so — khong `null`, khong loi (edge DATA-05 empty).
 */
export function summarizeMonth({
  records,
  context,
  month,
}: {
  records: AttendanceRecord[];
  context: MonthContext;
  /** "YYYY-MM" */
  month: string;
}): MonthlySummary {
  // Tu migration 0013 mot ngay co the co NHIEU dong, va tu 0014 gio nghi duoc
  // tru mot lan cho moi ngay. Gop ngay roi mo, khong cong thang cac dong.
  const days = groupAttendanceByDay(records, context.breaks);
  const classifications = days.map((day) =>
    classifyDay({
      day,
      shift: context.shiftRules.get(day.shiftId),
      rules: context.rules,
    }),
  );
  const converted = sumConvertedOvertimeHours(classifications);

  // D-36: mot ngay cham cong duoc quy ve NGAY CONG theo che do ma doanh nghiep
  // da chon. Phep quy do nam o `work-mode.ts` va chi duoc goi o DAY — khong
  // Route Handler nao tu goi no, vi khi ay hai duong doc se lech nhau (dung
  // loai trung lap ma module nay ra doi de don).
  const credits = days.map((day, index) =>
    resolveDayCredit({
      day,
      dayType: classifications[index].dayType,
      mode: context.rules.workMode,
      shift: context.shiftRules.get(day.shiftId),
      standardHoursPerDay: context.rules.standardHoursPerDay,
    }),
  );
  const credited = sumCreditedDays(credits);

  return {
    month,
    // `workedDays` GIU NGUYEN y nghia cu (dem ngay co gio lam) de khong man
    // hinh nao dang doc no bi doi so. Con so dung de TINH TIEN la
    // `creditedDays` — hai dai luong khac nhau, va o che do `daily_hours`
    // chung khac nhau that.
    workedDays: days.filter((day) => day.workedMinutes > 0).length,
    totalMinutes: days.reduce((sum, day) => sum + day.workedMinutes, 0),
    // Chi luot DAU TIEN cua ngay mang status "late" (xem `checkIn`), va
    // `day.status` da lay tu luot do — dem ngay o day chinh la so ngay di muon.
    lateCount: days.filter((day) => day.status === "late").length,
    leaveDays: days.filter(
      (day) => day.status === "leave_paid" || day.status === "leave_unpaid",
    ).length,
    overtimeMinutes: classifications.reduce(
      (sum, item) => sum + item.overtimeMinutes,
      0,
    ),
    overtimeNightMinutes: classifications.reduce(
      (sum, item) => sum + item.overtimeNightMinutes,
      0,
    ),
    convertedOvertimeHours: converted.hours,
    missingMultiplierKeys: converted.missingKeys,
    workMode: context.rules.workMode,
    creditedDays: credited.creditedDays,
    regularMinutes: credited.regularMinutes,
    hourDeltaMinutes: credited.hourDeltaMinutes,
    missingWorkModeInputs: credited.missing,
  };
}
