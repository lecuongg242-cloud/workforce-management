import { minutesBetween } from "@/lib/format";
import {
  shiftGrossMinutes,
  type ShiftScheduleInfo,
} from "@/lib/shifts/schedule";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/types/domain";

/**
 * Gop cac LUOT cham cong cua cung mot ngay thanh mot ban tom tat NGAY.
 *
 * Tu migration 0013, mot ngay co the co nhieu dong `attendance_records` —
 * moi cap vao/ra la mot luot (ra ngoai giua ca roi quay lai). Cac man hinh
 * hien thi theo NGAY (trang chu nhan vien, lich su) phai gop lai, khong duoc
 * liet ke tung dong nhu the do la nhung ngay khac nhau.
 *
 * Tu migration 0014, day cung la noi TRU GIO NGHI — `record.workedMinutes`
 * la thoi luong THO cua tung luot, gio nghi cua ca duoc tru dung mot lan cho
 * ca ngay o day.
 *
 * Day la NGUON DUY NHAT cua ca hai phep tren — dung viet lai o tung man hinh.
 */

/**
 * Mot khoang trong giua hai luot dai bang hoac hon nua ngay khong phai gio
 * nghi ma la du lieu bat thuong (vi du gio vao/ra bi ghi lech ngay). Coi nhu
 * khong co khoang nghi thay vi tin vao no.
 */
const MAX_CREDITABLE_GAP_MINUTES = 12 * 60;

/** Gio nghi va do dai tron ca — du de tinh phan gio nghi phai tru cua mot ngay. */
export interface ShiftBreakInfo {
  breakMinutes: number;
  /** Do dai TRON CA ke ca gio nghi, phut (vd 06:00-14:00 -> 480). */
  shiftMinutes: number;
}

/**
 * So phut gio nghi phai tru khoi tong cua MOT NGAY. Hai hieu chinh, theo thu
 * tu:
 *
 * 1. BU TRU KHOANG NGHI GIUA CAC LUOT. Nguoi da tu cham RA de di an trua thi
 *    khoang trong do da la thoi gian khong duoc tinh cong roi — tru them gio
 *    nghi cua ca lan nua la tru hai lan cho cung mot lan nghi.
 *
 * 2. TINH THEO TY LE THOI GIAN CO MAT. Co mat duoc bao nhieu phan ca thi tru
 *    bay nhieu phan gio nghi. Truoc day gio nghi luon bi tru tron, nen mot
 *    luot ngan hon chinh gio nghi ra 0 phut — nguoi lam that 28 phut duoc ghi
 *    la khong lam gi. Lam DU ca thi ty le bang 1 va tru tron gio nghi, dung y
 *    nhu hanh vi cu, nen du lieu cu khong lech.
 *
 * Khong co nguong tuy tien va khong co buoc nhay: ham tang deu theo thoi
 * gian co mat.
 */
export function breakToDeductMinutes({
  shift,
  rawMinutes,
  gapMinutes,
}: {
  shift: ShiftBreakInfo | undefined;
  rawMinutes: number;
  gapMinutes: number;
}): number {
  // Khong biet ca thi KHONG tru gi — thieu du lieu khong duoc bien thanh mot
  // phep tru bia ra.
  if (!shift || shift.shiftMinutes <= 0) return 0;

  const creditable = Math.max(shift.breakMinutes - gapMinutes, 0);
  if (creditable === 0) return 0;

  const coverage = Math.min(rawMinutes / shift.shiftMinutes, 1);
  // Kep tran o `rawMinutes` de so gio duoc tinh cong khong bao gio am.
  return Math.min(Math.round(creditable * coverage), rawMinutes);
}

export interface AttendanceDay {
  /** "YYYY-MM-DD" */
  date: string;
  shiftId: string;
  /** Cac luot theo THU TU THOI GIAN; dong nghi phep khong nam trong day. */
  punches: AttendanceRecord[];
  /** Gio vao cua luot DAU TIEN, "HH:mm". */
  firstCheckIn: string | null;
  /** Gio ra cua luot CUOI CUNG — null khi luot cuoi chua tan ca. */
  lastCheckOut: string | null;
  /** Tong so phut DUOC TINH CONG: cong don cac luot roi tru gio nghi. */
  workedMinutes: number;
  /** Tong thoi luong tho cac luot, CHUA tru gio nghi. */
  rawMinutes: number;
  /** So phut gio nghi da bi tru khoi ngay — 0 khi cac khoang nghi giua luot da du bu. */
  breakMinutes: number;
  /** Do muon cua luot dau (cac luot sau khong tinh do muon). */
  lateMinutes: number;
  /** Ve som cua luot cuoi — 0 khi con luot dang mo. */
  earlyLeaveMinutes: number;
  /** Trang thai cua CA NGAY, khong phai cua mot luot. */
  status: AttendanceStatus;
  /** Con mot luot da vao nhung chua tan ca. */
  hasOpenPunch: boolean;
  /** Bat khi BAT KY luot nao trong ngay can bo sung thong tin. */
  needsSupplement: boolean;
  location: string;
}

/** Dong khong co gio vao la nghi phep / nghi khong luong, khong phai mot luot. */
function isPunch(record: AttendanceRecord): boolean {
  return record.checkIn !== null;
}

/**
 * Trang thai NGAY suy tu cac luot, khong phai tu mot dong don le:
 * - con luot dang mo  -> `missing_checkout` neu ngay da qua thi noi goi tu
 *   quyet; o day tra `on_time` vi "dang lam viec" khong phai mot loi
 * - luot dau di muon  -> `late` (dau hieu manh nhat, giu nguyen ca ngay)
 * - luot cuoi ve som  -> `early_leave`
 */
function resolveDayStatus(punches: AttendanceRecord[]): AttendanceStatus {
  const first = punches[0];
  const last = punches[punches.length - 1];

  if (first.status === "late" || first.lateMinutes > 0) return "late";
  if (last.checkOut === null) return "on_time";
  if (last.status === "early_leave" || last.earlyLeaveMinutes > 0) {
    return "early_leave";
  }
  return last.status;
}

/** Tong cac khoang trong giua cac luot lien tiep (da sap theo gio vao). */
function sumGapMinutes(punches: AttendanceRecord[]): number {
  let total = 0;
  for (let index = 0; index < punches.length - 1; index += 1) {
    const previousOut = punches[index].checkOut;
    const nextIn = punches[index + 1].checkIn;
    if (!previousOut || !nextIn) continue;
    const gap = minutesBetween(previousOut, nextIn);
    if (gap > 0 && gap < MAX_CREDITABLE_GAP_MINUTES) total += gap;
  }
  return total;
}

/**
 * Gop mot tap ban ghi (co the tu nhieu ngay) thanh danh sach ngay.
 *
 * Thu tu ngay tra ve GIU NGUYEN thu tu xuat hien dau tien trong `records` —
 * API da sap xep san (moi nhat truoc), ham nay khong sap lai de khong dam
 * nhau voi lua chon do. Trong moi ngay, cac luot duoc sap theo gio vao.
 *
 * Ngay CHI co dong nghi phep (khong luot nao) van tra ve mot `AttendanceDay`
 * de lich su khong bi mat ngay do — khi ay `punches` rong va `status` lay
 * thang tu dong nghi phep.
 *
 * `shiftBreaks` tra gio nghi + do dai tron ca theo `shiftId` (dung
 * `shiftBreakInfoById()` de dung tu danh sach ca). Thieu ca nao thi ngay cua
 * ca do khong bi tru gio nghi.
 */
export function groupAttendanceByDay(
  records: AttendanceRecord[],
  shiftBreaks: Record<string, ShiftBreakInfo> = {},
): AttendanceDay[] {
  const byDate = new Map<string, AttendanceRecord[]>();
  for (const record of records) {
    const list = byDate.get(record.date);
    if (list) list.push(record);
    else byDate.set(record.date, [record]);
  }

  return Array.from(byDate.entries()).map(([date, rows]) => {
    const punches = rows
      .filter(isPunch)
      .sort((a, b) => (a.checkIn ?? "").localeCompare(b.checkIn ?? ""));

    if (punches.length === 0) {
      const leaveRow = rows[0];
      return {
        date,
        shiftId: leaveRow.shiftId,
        punches: [],
        firstCheckIn: null,
        lastCheckOut: null,
        workedMinutes: 0,
        rawMinutes: 0,
        breakMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        status: leaveRow.status,
        hasOpenPunch: false,
        needsSupplement: leaveRow.needsSupplement,
        location: leaveRow.location,
      };
    }

    const first = punches[0];
    const last = punches[punches.length - 1];
    const hasOpenPunch = punches.some((punch) => punch.checkOut === null);

    const rawMinutes = punches.reduce((sum, punch) => sum + punch.workedMinutes, 0);
    // Chua khep ngay thi chua tru gio nghi: nguoi dang lam viec co the con
    // cham ra de nghi trua, tru truoc se lam so gio tut xuong roi lai tang
    // len — con so nhay nhu vay khong ai tin duoc.
    const breakMinutes = hasOpenPunch
      ? 0
      : breakToDeductMinutes({
          shift: shiftBreaks[first.shiftId],
          rawMinutes,
          gapMinutes: sumGapMinutes(punches),
        });

    return {
      date,
      shiftId: first.shiftId,
      punches,
      firstCheckIn: first.checkIn,
      lastCheckOut: last.checkOut,
      workedMinutes: Math.max(rawMinutes - breakMinutes, 0),
      rawMinutes,
      breakMinutes,
      lateMinutes: first.lateMinutes,
      // Ve som chi co nghia khi ngay da khep lai — con luot dang mo thi chua
      // biet luot nao la luot cuoi.
      earlyLeaveMinutes: hasOpenPunch ? 0 : last.earlyLeaveMinutes,
      status: resolveDayStatus(punches),
      hasOpenPunch,
      needsSupplement: punches.some((punch) => punch.needsSupplement),
      location: last.location,
    };
  });
}

/** Ban tom tat cua DUNG mot ngay, hoac null khi ngay do khong co ban ghi nao. */
export function getAttendanceDay(
  records: AttendanceRecord[],
  date: string,
  shiftBreaks: Record<string, ShiftBreakInfo> = {},
): AttendanceDay | null {
  const day = groupAttendanceByDay(
    records.filter((record) => record.date === date),
    shiftBreaks,
  );
  return day[0] ?? null;
}

/**
 * Bang tra `shiftId -> ShiftBreakInfo` tu danh sach ca — dung o moi call site.
 *
 * Do dai tron ca do `shiftGrossMinutes()` tinh, khong tu goi `minutesBetween()`
 * o day nua: tu migration 0027 co HAI loai ca, va ca linh hoat khong co
 * `startTime`/`endTime` de tru. Ca QUA DEM (endTime < startTime) van duoc tinh
 * dung, khong ra so am — phep do nam trong chinh ham do.
 */
export function shiftBreakInfoById(
  shifts: Array<ShiftScheduleInfo & { id: string; breakMinutes: number }>,
): Record<string, ShiftBreakInfo> {
  return Object.fromEntries(
    shifts.map((shift) => [
      shift.id,
      {
        breakMinutes: shift.breakMinutes,
        shiftMinutes: shiftGrossMinutes(shift),
      },
    ]),
  );
}
