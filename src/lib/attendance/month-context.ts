import {
  classifyDay,
  loadCompanyRules,
  sumConvertedOvertimeHours,
  type CompanyRules,
  type ShiftRuleInfo,
} from "@/lib/attendance/classification-context";
import {
  groupAttendanceByDay,
  shiftBreakInfoById,
  type ShiftBreakInfo,
} from "@/lib/attendance/day";
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

const SHIFT_COLUMNS = "id, break_minutes, start_time, end_time, working_days";

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
    .select(SHIFT_COLUMNS)
    .eq("company_id", companyId);

  if (error) {
    throw new Error("Không thể tải ca làm việc của doanh nghiệp.");
  }

  const rawShifts = (shiftRows ?? []) as Array<{
    id: string;
    break_minutes: number;
    start_time: string;
    end_time: string;
    working_days: number[];
  }>;

  const breaks = shiftBreakInfoById(
    rawShifts.map((row) => ({
      id: row.id,
      breakMinutes: row.break_minutes,
      // `time` cua Postgres ve dang "HH:mm:ss" — cat con "HH:mm" cho khop voi
      // `minutesBetween()`.
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
    })),
  );

  const shiftRules = new Map<string, ShiftRuleInfo>(
    rawShifts.map((row) => {
      const info = breaks[row.id];
      return [
        row.id,
        {
          workingDays: row.working_days as ShiftRuleInfo["workingDays"],
          scheduledMinutes: Math.max(
            (info?.shiftMinutes ?? 0) - (info?.breakMinutes ?? 0),
            0,
          ),
        },
      ];
    }),
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

  return {
    month,
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
  };
}
