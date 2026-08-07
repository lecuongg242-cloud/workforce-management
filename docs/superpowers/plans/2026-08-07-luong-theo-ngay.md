# Lương theo ngày — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhân viên và quản trị xem được tiền của từng ngày đã làm, trong khi cơ chế chốt kỳ lương giữ nguyên.

**Architecture:** Ngày trở thành đơn vị nguyên tử của phép tính tiền. Một module thuần mới (`compute-daily.ts`) quy một ngày ra tiền từ `DayCredit` + `DayClassification` đã có sẵn; `computePayrollLine()` không còn nhân từ số tổng mà cộng các dòng ngày lại. Bản chốt lương lưu thêm bảng `payroll_line_days` để phiếu đã chốt vẫn bung ra được theo ngày.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Supabase (Postgres + RLS), Zod, Vitest, Tailwind v4.

## Global Constraints

- **TypeScript strict, không dùng `any`.** Mọi hàm khai báo kiểu trả về tường minh.
- **Import tuyệt đối `@/`** — không dùng đường dẫn tương đối.
- **Module thuần** (`compute-daily.ts`): không dùng client cơ sở dữ liệu, không đọc biến môi trường, không đọc đồng hồ hệ thống.
- **Không bao giờ thay một giá trị thiếu bằng 0.** Thiếu dữ kiện thì `null` kèm lý do (quy tắc (2) của `src/lib/payroll/compute.ts`).
- **Không tính lại giờ tăng ca.** `convertedOvertimeHours` từ `classifyDay()` là nguồn duy nhất (quy tắc (1)).
- **Làm tròn tới đồng, nửa lên** (`Math.round`), đúng một lần cho mỗi con số hiện ra.
- **Giao diện tiếng Việt**, nhãn nằm ở `src/lib/constants.ts`, enum nghiệp vụ tiếng Anh.
- **Lệnh kiểm:** `pnpm vitest run <path>`, `pnpm typecheck`, `pnpm lint`.
- **Bộ số dùng xuyên test:** lương tháng 13.000.000 / 26 ngày chuẩn / 8 giờ/ngày → đơn giá ngày 500.000, đơn giá giờ 62.500.

---

### Task 1: Module thuần `compute-daily.ts`

**Files:**
- Create: `src/lib/payroll/compute-daily.ts`
- Test: `src/lib/payroll/__tests__/compute-daily.test.ts`

**Interfaces:**
- Consumes: `DayCredit` từ `@/lib/attendance/work-mode`, `DayClassification` từ `@/lib/attendance/classification-context`, `PayrollMissingInput` từ `@/lib/payroll/compute`.
- Produces: `computeDailyPay(input: DailyPayInput): DailyPayLine`, `sumDailyPay(lines: readonly DailyPayLine[]): DailyPaySum`, kiểu `DailyPayLine`, `DailyPayInput`, `DailyPayState`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/payroll/__tests__/compute-daily.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  computeDailyPay,
  sumDailyPay,
  type DailyPayInput,
} from "@/lib/payroll/compute-daily";
import type { DayCredit } from "@/lib/attendance/work-mode";
import type { DayClassification } from "@/lib/attendance/classification-context";

/**
 * Tien cua MOT ngay. Moi con so ky vong duoc tinh tay va ghi ra thanh cong
 * thuc ngay tren dong khang dinh — cung khuon `compute.test.ts`.
 *
 * Don gia ngay 500.000, don gia gio 62.500 (luong thang 13.000.000 / 26 / 8).
 */

const DAILY_RATE = 500_000;
const HOURLY_RATE = 62_500;

function credit(overrides: Partial<DayCredit> = {}): DayCredit {
  return {
    creditedDays: 1,
    regularMinutes: 480,
    overtimeMinutes: 0,
    hourDelta: 0,
    missing: null,
    ...overrides,
  };
}

function classification(
  overrides: Partial<DayClassification> = {},
): DayClassification {
  return {
    dayType: "weekday",
    nightMinutes: 0,
    overtimeMinutes: 0,
    overtimeNightMinutes: 0,
    convertedOvertimeHours: 0,
    missingMultiplierKeys: [],
    workModeInputMissing: false,
    ...overrides,
  };
}

function day(overrides: Partial<DailyPayInput> = {}) {
  return computeDailyPay({
    date: "2026-08-03",
    credit: credit(),
    classification: classification(),
    status: "on_time",
    hasOpenPunch: false,
    dailyRate: DAILY_RATE,
    hourlyRate: HOURLY_RATE,
    overtimeRate: null,
    workMode: "shift",
    paysByActualHours: false,
    ...overrides,
  });
}

describe("computeDailyPay", () => {
  it("1. ngay thuong du ca -> luong ngay bang dung don gia ngay", () => {
    const result = day();

    // 500.000 x 1 ngay cong = 500.000
    expect(result.basePay).toBe(500_000);
    expect(result.overtimePay).toBe(0);
    expect(result.hourAdjustment).toBe(0);
    expect(result.dayTotal).toBe(500_000);
    expect(result.state).toBe("counted");
    expect(result.missing).toEqual([]);
  });

  it("2. tang ca 2 gio quy doi -> nhan don gia gio, KHONG tinh lai he so", () => {
    const result = day({
      classification: classification({
        overtimeMinutes: 90,
        convertedOvertimeHours: 2.25, // 1,5 gio x he so 1,5 — da quy doi san
      }),
    });

    // 62.500 x 2,25 = 140.625
    expect(result.overtimePay).toBe(140_625);
    // 500.000 + 140.625 = 640.625
    expect(result.dayTotal).toBe(640_625);
  });

  it("3. luong theo gio thuc te -> luong ngay bam theo regularMinutes", () => {
    const result = day({
      credit: credit({ creditedDays: 0.75, regularMinutes: 360 }),
      paysByActualHours: true,
    });

    // 62.500 x (360 / 60) = 375.000
    expect(result.basePay).toBe(375_000);
  });

  it("4. shift_hourly thieu 30 phut -> hourAdjustment AM", () => {
    const result = day({
      credit: credit({ regularMinutes: 450, hourDelta: -30 }),
      workMode: "shift_hourly",
    });

    // 62.500 x (-30 / 60) = -31.250
    expect(result.hourAdjustment).toBe(-31_250);
    // 500.000 + 0 + (-31.250) = 468.750
    expect(result.dayTotal).toBe(468_750);
  });

  it("5. nghi CO phep -> tron mot ngay cong, khong gio lam", () => {
    const result = day({
      credit: credit({ creditedDays: 1, regularMinutes: 0 }),
      status: "leave_paid",
    });

    expect(result.state).toBe("leave_paid");
    expect(result.basePay).toBe(500_000);
    expect(result.dayTotal).toBe(500_000);
  });

  it("6. nghi KHONG phep -> khong dong nao, nhung van la mot dong that", () => {
    const result = day({
      credit: credit({ creditedDays: 0, regularMinutes: 0 }),
      status: "leave_unpaid",
    });

    expect(result.state).toBe("leave_unpaid");
    expect(result.basePay).toBe(0);
    expect(result.dayTotal).toBe(0);
  });

  it("7. ngay dang do -> KHONG co so, khong phai so 0", () => {
    const result = day({
      credit: credit({ creditedDays: 0, regularMinutes: 0 }),
      hasOpenPunch: true,
    });

    expect(result.state).toBe("in_progress");
    expect(result.basePay).toBeNull();
    expect(result.dayTotal).toBeNull();
    // KHONG co `missing`: ngay nay khong thieu du kien, no chua ket thuc.
    expect(result.missing).toEqual([]);
  });

  it("8. thieu mau so quy doi -> dayTotal null kem ly do", () => {
    const result = day({
      credit: credit({
        creditedDays: null,
        regularMinutes: null,
        missing: "standard_hours_per_day",
      }),
    });

    expect(result.basePay).toBeNull();
    expect(result.dayTotal).toBeNull();
    expect(result.missing).toContain("standard_hours_per_day");
  });

  it("9. thieu he so tang ca -> chan, TRU KHI nguoi do co muc tang ca rieng", () => {
    const chan = day({
      classification: classification({
        overtimeMinutes: 60,
        convertedOvertimeHours: null,
        missingMultiplierKeys: ["weekday"],
      }),
    });
    expect(chan.overtimePay).toBeNull();
    expect(chan.missing).toContain("overtime_rule:weekday");

    const rieng = day({
      classification: classification({
        overtimeMinutes: 60,
        convertedOvertimeHours: null,
        missingMultiplierKeys: ["weekday"],
      }),
      overtimeRate: { valueType: "fixed_hourly", value: 80_000 },
    });
    // 1 gio x 80.000 = 80.000. He so doanh nghiep khong tham gia.
    expect(rieng.overtimePay).toBe(80_000);
    expect(rieng.missing).toEqual([]);
  });

  it("10. muc tang ca rieng dang he so -> nhan don gia gio", () => {
    const result = day({
      classification: classification({
        overtimeMinutes: 120,
        convertedOvertimeHours: 3,
      }),
      overtimeRate: { valueType: "multiplier", value: 2 },
    });

    // 62.500 x 2 gio x 2,0 = 250.000 (KHONG dung convertedOvertimeHours = 3)
    expect(result.overtimePay).toBe(250_000);
  });

  it("11. chua khai muc luong -> khong con so nao", () => {
    const result = day({ dailyRate: null, hourlyRate: null });

    expect(result.basePay).toBeNull();
    expect(result.overtimePay).toBeNull();
    expect(result.dayTotal).toBeNull();
  });
});

describe("sumDailyPay", () => {
  it("12. tong bang dung tong cac dong DA LAM TRON", () => {
    // 10.000.000 / 26 = 384.615,3846... -> moi ngay lam tron thanh 384.615
    const rate = 10_000_000 / 26;
    const lines = Array.from({ length: 26 }, (_, index) =>
      day({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, dailyRate: rate }),
    );

    const total = sumDailyPay(lines);

    // 384.615 x 26 = 9.999.990 — KHONG phai 10.000.000. Day la danh doi da
    // duoc chap nhan co y thuc: tong LUON bang tong cac dong hien ra.
    expect(total.basePay).toBe(9_999_990);
    expect(total.dayTotal).toBe(9_999_990);
  });

  it("13. mot ngay thieu du kien -> ca tong null, khong cong bo phan", () => {
    const total = sumDailyPay([
      day(),
      day({ credit: credit({ creditedDays: null, regularMinutes: null, missing: "standard_hours_per_day" }) }),
    ]);

    expect(total.basePay).toBeNull();
    expect(total.dayTotal).toBeNull();
    expect(total.missing).toContain("standard_hours_per_day");
  });

  it("14. ngay dang do KHONG lam tong thanh null, no chi khong gop gi", () => {
    const total = sumDailyPay([day(), day({ hasOpenPunch: true })]);

    // Chi ngay hoan tat gop vao: 500.000
    expect(total.dayTotal).toBe(500_000);
    expect(total.missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `pnpm vitest run src/lib/payroll/__tests__/compute-daily.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/payroll/compute-daily"`

- [ ] **Step 3: Viết `compute-daily.ts`**

Tạo `src/lib/payroll/compute-daily.ts`:

```ts
import type { DayClassification } from "@/lib/attendance/classification-context";
import type { WorkDayType } from "@/lib/attendance/classification";
import type { DayCredit } from "@/lib/attendance/work-mode";
import type { PayrollMissingInput } from "@/lib/payroll/compute";
import type {
  AttendanceStatus,
  EmployeeOvertimeRate,
  WorkMode,
} from "@/lib/types/domain";

/**
 * TIEN CUA MOT NGAY (plan 06-01).
 *
 * Module THUAN: khong dung client co so du lieu, khong doc bien moi truong,
 * khong doc dong ho he thong.
 *
 * ======================================================================
 * VI SAO FILE NAY TON TAI
 * ======================================================================
 *
 * `compute.ts` tinh tien tu SO TONG cua ca ky. Mot bang luong nhu vay tra loi
 * duoc "thang nay bao nhieu" nhung khong tra loi duoc "ngay 12 toi duoc bao
 * nhieu" — va do la cau hoi nguoi lam cong hoi truoc tien.
 *
 * File nay quy MOT ngay ra tien. Tu day `computePayrollLine()` khong con nhan
 * tu so tong nua ma CONG cac dong ngay lai, nen tong LUON bang dung tong cac
 * dong hien ra.
 *
 * ======================================================================
 * BA RANG BUOC KE THUA TU `compute.ts`, KHONG DUOC NOI LONG
 * ======================================================================
 *
 * (1) KHONG TINH LAI GIO TANG CA. `classification.convertedOvertimeHours` la
 * nguon duy nhat; viec cua file nay la NHAN no voi don gia gio.
 *
 * (2) KHONG THAY MOT GIA TRI THIEU BANG 0. Thieu mot phan thi `dayTotal` cung
 * `null`.
 *
 * (3) LAM TRON DUNG MOT LAN CHO MOI CON SO HIEN RA. Don gia va cac phep nhan
 * la buoc trung gian, khong bao gio duoc lam tron.
 *
 * ======================================================================
 * NGAY DANG DO KHONG PHAI NGAY THIEU DU KIEN
 * ======================================================================
 *
 * Hai trang thai nay TUYET DOI khong duoc gop:
 *
 *   - `in_progress` — nguoi do da cham vao, chua cham ra. Con so CHUA TON TAI.
 *     Ngay nay khong lam tong cua ky thanh `null`; no chi khong gop gi vao.
 *   - thieu du kien — con so LE RA phai co nhung khong tinh duoc. Ngay nay
 *     KEO CA KY thanh `null`, dung nhu `sumCreditedDays()` dang lam.
 *
 * Gop chung lai thi mot nguoi dang lam do se lam ca bang luong bao "thieu du
 * kien", va ke toan se di tim mot loi khong ton tai.
 */

/** Mot ngay o trang thai nao trong bang luong. */
export type DailyPayState =
  | "counted"
  | "in_progress"
  | "leave_paid"
  | "leave_unpaid";

export interface DailyPayInput {
  /** "YYYY-MM-DD" */
  date: string;
  /** Tu `resolveDayCredit()` — KHONG tinh lai o day. */
  credit: DayCredit;
  /** Tu `classifyDay()` — KHONG tinh lai o day. */
  classification: DayClassification;
  /** Trang thai cua CA NGAY (`day.ts`), khong phai cua mot luot. */
  status: AttendanceStatus;
  /** Con mot luot da vao nhung chua tan ca. */
  hasOpenPunch: boolean;
  /** `null` = chua khai muc luong hoac thieu mau so quy doi. */
  dailyRate: number | null;
  hourlyRate: number | null;
  /** Muc tang ca RIENG cua nguoi nay (0026); `null` = an theo he so doanh nghiep. */
  overtimeRate: Pick<EmployeeOvertimeRate, "valueType" | "value"> | null;
  workMode: WorkMode;
  /**
   * `workMode === "daily_hours" || payRate.unit === "hour"` — noi goi tinh MOT
   * LAN cho ca ky roi truyen xuong, de moi ngay khong tu suy lai mot dieu kien
   * von khong doi trong ky.
   */
  paysByActualHours: boolean;
}

export interface DailyPayLine {
  date: string;
  dayType: WorkDayType;
  state: DailyPayState;
  /** So ngay cong cua ngay — co the thap phan o `daily_hours` (D-39). */
  creditedDays: number | null;
  regularMinutes: number | null;
  overtimeMinutes: number;
  convertedOvertimeHours: number | null;
  hourDeltaMinutes: number;
  /** DA LAM TRON. `null` khi chua tinh duoc — xem `state` va `missing`. */
  basePay: number | null;
  overtimePay: number | null;
  hourAdjustment: number | null;
  /** Tong ba con so DA LAM TRON o tren. */
  dayTotal: number | null;
  missing: PayrollMissingInput[];
}

export interface DailyPaySum {
  basePay: number | null;
  overtimePay: number | null;
  hourAdjustment: number | null;
  dayTotal: number | null;
  missing: PayrollMissingInput[];
}

/** Lam tron TOI DONG, nua len — cung phep voi `compute.ts`. */
function roundToDong(value: number): number {
  return Math.round(value);
}

function stateOf({
  status,
  hasOpenPunch,
}: {
  status: AttendanceStatus;
  hasOpenPunch: boolean;
}): DailyPayState {
  // Ngay dang do duoc xet TRUOC hai trang thai nghi: mot dong nghi phep khong
  // bao gio co luot mo, nen thu tu nay khong che khuat gi — nhung neu ve sau
  // no co, thi "dang do" van la su that gan hon voi hien tai.
  if (hasOpenPunch) return "in_progress";
  if (status === "leave_paid") return "leave_paid";
  if (status === "leave_unpaid") return "leave_unpaid";
  return "counted";
}

export function computeDailyPay({
  date,
  credit,
  classification,
  status,
  hasOpenPunch,
  dailyRate,
  hourlyRate,
  overtimeRate,
  workMode,
  paysByActualHours,
}: DailyPayInput): DailyPayLine {
  const state = stateOf({ status, hasOpenPunch });

  const shared = {
    date,
    dayType: classification.dayType,
    state,
    creditedDays: credit.creditedDays,
    regularMinutes: credit.regularMinutes,
    overtimeMinutes: classification.overtimeMinutes,
    convertedOvertimeHours: classification.convertedOvertimeHours,
    hourDeltaMinutes: credit.hourDelta,
  };

  // NGAY DANG DO. Khong con so nao, va `missing` RONG — day khong phai mot
  // dong thieu du kien (xem khoi comment o dau file).
  if (state === "in_progress") {
    return {
      ...shared,
      basePay: null,
      overtimePay: null,
      hourAdjustment: null,
      dayTotal: null,
      missing: [],
    };
  }

  const missing = new Set<PayrollMissingInput>();
  if (credit.missing !== null) missing.add(credit.missing);
  for (const key of classification.missingMultiplierKeys) {
    // Nguoi co muc tang ca RIENG khong an theo he so cua doanh nghiep, nen mot
    // he so doanh nghiep chua khai khong duoc chan tien cua ho.
    if (overtimeRate !== null) continue;
    missing.add(`overtime_rule:${key}`);
  }

  /* ------------------------------------------------------------------ */
  /* Luong goc                                                           */
  /* ------------------------------------------------------------------ */
  const basePayExact = paysByActualHours
    ? hourlyRate !== null && credit.regularMinutes !== null
      ? hourlyRate * (credit.regularMinutes / 60)
      : null
    : dailyRate !== null && credit.creditedDays !== null
      ? dailyRate * credit.creditedDays
      : null;

  /* ------------------------------------------------------------------ */
  /* Lech gio — CHI o `shift_hourly`                                     */
  /* ------------------------------------------------------------------ */
  // `paysByActualHours` bi loai TUYET DOI: luong goc cua ho da bam dung gio
  // thuc te roi, cong them phan lech gio nua la tinh HAI LAN cung so gio do.
  const hourAdjustmentExact =
    workMode === "shift_hourly" && !paysByActualHours
      ? hourlyRate !== null
        ? hourlyRate * (credit.hourDelta / 60)
        : null
      : 0;

  /* ------------------------------------------------------------------ */
  /* Tang ca                                                             */
  /* ------------------------------------------------------------------ */
  const overtimeHours = classification.overtimeMinutes / 60;
  let overtimePayExact: number | null;
  if (overtimeRate === null) {
    overtimePayExact =
      hourlyRate !== null && classification.convertedOvertimeHours !== null
        ? hourlyRate * classification.convertedOvertimeHours
        : null;
  } else if (overtimeRate.valueType === "fixed_hourly") {
    // So TIEN, nen khong nhan voi don gia gio — nguoi khai muc co dinh tinh
    // duoc tien tang ca ngay ca khi doanh nghiep chua khai he so nao.
    overtimePayExact = overtimeHours * overtimeRate.value;
  } else {
    overtimePayExact =
      hourlyRate !== null ? hourlyRate * overtimeHours * overtimeRate.value : null;
  }

  // CON SO CUOI cua ngay — moi o lam tron DUNG MOT LAN tu gia tri chinh xac.
  const basePay = basePayExact === null ? null : roundToDong(basePayExact);
  const overtimePay =
    overtimePayExact === null ? null : roundToDong(overtimePayExact);
  const hourAdjustment =
    hourAdjustmentExact === null ? null : roundToDong(hourAdjustmentExact);

  const dayTotal =
    basePay === null || overtimePay === null || hourAdjustment === null
      ? null
      : basePay + overtimePay + hourAdjustment;

  return {
    ...shared,
    basePay,
    overtimePay,
    hourAdjustment,
    dayTotal,
    missing: Array.from(missing),
  };
}

/**
 * Cong cac dong ngay lai thanh so cua ky.
 *
 * Ngay `in_progress` KHONG gop gi va KHONG lam tong thanh `null` — no chua co
 * con so, chu khong phai thieu con so.
 */
export function sumDailyPay(lines: readonly DailyPayLine[]): DailyPaySum {
  const missing = new Set<PayrollMissingInput>();
  let base = 0;
  let overtime = 0;
  let hour = 0;
  let incomputable = false;

  for (const line of lines) {
    for (const key of line.missing) missing.add(key);
    if (line.state === "in_progress") continue;

    if (
      line.basePay === null ||
      line.overtimePay === null ||
      line.hourAdjustment === null
    ) {
      incomputable = true;
      continue;
    }
    base += line.basePay;
    overtime += line.overtimePay;
    hour += line.hourAdjustment;
  }

  if (incomputable) {
    // KHONG cong bo phan de ra mot tong trong nhu da day du (quy tac (2)).
    return {
      basePay: null,
      overtimePay: null,
      hourAdjustment: null,
      dayTotal: null,
      missing: Array.from(missing),
    };
  }

  return {
    basePay: base,
    overtimePay: overtime,
    hourAdjustment: hour,
    // Tong cua CHINH nhung o hien ra man hinh — bang luong luon doi chieu duoc.
    dayTotal: base + overtime + hour,
    missing: Array.from(missing),
  };
}
```

- [ ] **Step 4: Chạy test để xác nhận nó qua**

Run: `pnpm vitest run src/lib/payroll/__tests__/compute-daily.test.ts`
Expected: PASS — 14 passed

- [ ] **Step 5: Typecheck và commit**

```bash
pnpm typecheck
git add src/lib/payroll/compute-daily.ts src/lib/payroll/__tests__/compute-daily.test.ts
git commit -m "feat(payroll): module thuần tính tiền của một ngày"
```

---

### Task 2: `summarizeMonth()` trả thêm mảng ngày

**Files:**
- Modify: `src/lib/attendance/month-context.ts:94-161`
- Test: `src/lib/attendance/__tests__/month-context-days.test.ts` (tạo mới)

**Interfaces:**
- Consumes: `groupAttendanceByDay()`, `classifyDay()`, `resolveDayCredit()` — đã có.
- Produces: `MonthlyDayDetail` và `MonthSummaryWithDays` xuất từ `@/lib/attendance/month-context`. `summarizeMonth()` đổi kiểu trả về từ `MonthlySummary` sang `MonthSummaryWithDays` (mở rộng, không phá).

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/attendance/__tests__/month-context-days.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { summarizeMonth, type MonthContext } from "@/lib/attendance/month-context";
import type { AttendanceRecord } from "@/lib/types/domain";

/**
 * `summarizeMonth()` tra them mang NGAY. Bai test nay canh MOT dieu: cac
 * truong tong cu KHONG DOI khi mang ngay duoc them vao.
 */

const CONTEXT: MonthContext = {
  start: "2026-08-01",
  end: "2026-09-01",
  breaks: { "shift-1": { breakMinutes: 60, shiftMinutes: 540 } },
  shiftRules: new Map([
    ["shift-1", { workingDays: [1, 2, 3, 4, 5], scheduledMinutes: 480 }],
  ]),
  rules: {
    holidayDates: new Set<string>(),
    nightStartTime: "22:00",
    nightEndTime: "06:00",
    versionsByKey: new Map(),
    workMode: "shift",
    standardHoursPerDay: 8,
    standardDaysPerMonth: 26,
  },
};

function record(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: "att-1",
    companyId: "cty-01",
    employeeId: "nv-1",
    date: "2026-08-03",
    shiftId: "shift-1",
    checkIn: "08:00",
    checkOut: "17:00",
    workedMinutes: 480,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: "on_time",
    location: "Văn phòng chính",
    needsSupplement: false,
    note: null,
    ...overrides,
  };
}

describe("summarizeMonth — mảng ngày", () => {
  it("1. mỗi ngày có bản ghi cho ra đúng một phần tử", () => {
    const summary = summarizeMonth({
      records: [record(), record({ id: "att-2", date: "2026-08-04" })],
      context: CONTEXT,
      month: "2026-08",
    });

    expect(summary.days).toHaveLength(2);
    expect(summary.days.map((day) => day.date).sort()).toEqual([
      "2026-08-03",
      "2026-08-04",
    ]);
  });

  it("2. mỗi phần tử mang credit + classification + trạng thái ngày", () => {
    const summary = summarizeMonth({
      records: [record()],
      context: CONTEXT,
      month: "2026-08",
    });

    const [day] = summary.days;
    expect(day.credit.creditedDays).toBe(1);
    expect(day.credit.regularMinutes).toBe(480);
    expect(day.classification.dayType).toBe("weekday");
    expect(day.status).toBe("on_time");
    expect(day.hasOpenPunch).toBe(false);
  });

  it("3. ngày chưa chấm ra -> hasOpenPunch true", () => {
    const summary = summarizeMonth({
      records: [record({ checkOut: null, workedMinutes: 0 })],
      context: CONTEXT,
      month: "2026-08",
    });

    expect(summary.days[0].hasOpenPunch).toBe(true);
  });

  it("4. các trường tổng CŨ không đổi khi thêm mảng ngày", () => {
    const summary = summarizeMonth({
      records: [record(), record({ id: "att-2", date: "2026-08-04" })],
      context: CONTEXT,
      month: "2026-08",
    });

    expect(summary.month).toBe("2026-08");
    expect(summary.workedDays).toBe(2);
    expect(summary.totalMinutes).toBe(960);
    expect(summary.creditedDays).toBe(2);
    expect(summary.regularMinutes).toBe(960);
  });

  it("5. tháng không có bản ghi -> mảng ngày rỗng, không phải undefined", () => {
    const summary = summarizeMonth({
      records: [],
      context: CONTEXT,
      month: "2026-08",
    });

    expect(summary.days).toEqual([]);
    expect(summary.workedDays).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `pnpm vitest run src/lib/attendance/__tests__/month-context-days.test.ts`
Expected: FAIL — `summary.days` là `undefined`

- [ ] **Step 3: Sửa `month-context.ts`**

Thêm import và hai kiểu mới ngay sau `MonthContext` (sau dòng 43):

```ts
import type { AttendanceStatus, MonthlySummary } from "@/lib/types/domain";
import type { DayClassification } from "@/lib/attendance/classification-context";
import type { DayCredit } from "@/lib/attendance/work-mode";

/**
 * MOT NGAY trong ban tong hop thang — du de `payroll-rows.ts` quy ra tien ma
 * KHONG phai chay lai `classifyDay()` hay `resolveDayCredit()`.
 *
 * Hai truong `credit` va `classification` duoc mang nguyen ven, khong rut gon:
 * rut gon o day nghia la moi lan `compute-daily.ts` can them mot truong thi
 * phai sua ca hai file, va mot trong hai lan sua se bi quen.
 */
export interface MonthlyDayDetail {
  /** "YYYY-MM-DD" */
  date: string;
  status: AttendanceStatus;
  hasOpenPunch: boolean;
  workedMinutes: number;
  credit: DayCredit;
  classification: DayClassification;
}

/**
 * `MonthlySummary` cong them mang ngay.
 *
 * MO RONG, KHONG PHA: moi truong cu giu nguyen ten va y nghia, nen
 * `GET /api/attendance/summary` khong bi anh huong — no khong doc truong moi,
 * va `zod` cua no loai bo khoa la khi `parse`.
 */
export interface MonthSummaryWithDays extends MonthlySummary {
  days: MonthlyDayDetail[];
}
```

Đổi chữ ký `summarizeMonth` (dòng 94-103) từ `: MonthlySummary` sang `: MonthSummaryWithDays`, và thêm mảng `days` vào giá trị trả về (chèn ngay trước `workedDays:` trong khối `return`):

```ts
    // Mang NGAY di kem — dung CHINH `days`, `classifications` va `credits` da
    // tinh o tren. Khong mot phep tinh nao chay lai o day.
    days: days.map((day, index) => ({
      date: day.date,
      status: day.status,
      hasOpenPunch: day.hasOpenPunch,
      workedMinutes: day.workedMinutes,
      credit: credits[index],
      classification: classifications[index],
    })),
```

- [ ] **Step 4: Chạy test mới + toàn bộ test attendance**

Run: `pnpm vitest run src/lib/attendance`
Expected: PASS — test mới qua, **và** mọi test attendance cũ vẫn qua.

Đây là bước kiểm bắt buộc mà spec nêu: `summarizeMonth()` còn được `GET /api/attendance/summary` dùng.

- [ ] **Step 5: Typecheck và commit**

```bash
pnpm typecheck
git add src/lib/attendance/month-context.ts src/lib/attendance/__tests__/month-context-days.test.ts
git commit -m "feat(attendance): summarizeMonth trả thêm chi tiết theo ngày"
```

---

### Task 3: `computePayrollLine()` cộng từ ngày

**Files:**
- Modify: `src/lib/payroll/compute.ts:90-135` (đầu vào), `:201-249` (bỏ ba phép nhân), `:348-373` (tổng)
- Modify: `src/lib/payroll/payroll-rows.ts:140-217`
- Modify: `src/lib/payroll/__tests__/compute.test.ts`

**Interfaces:**
- Consumes: `computeDailyPay()`, `sumDailyPay()`, `DailyPayLine` từ Task 1; `MonthlyDayDetail` từ Task 2.
- Produces: `PayrollComputeInput` nhận thêm `dailyLines: readonly DailyPayLine[]` và **bỏ** `summary.creditedDays`, `summary.regularMinutes`, `summary.hourDeltaMinutes`, `summary.convertedOvertimeHours`, `summary.overtimeMinutes`, `summary.missingMultiplierKeys`, `summary.missingWorkModeInputs`. `summary` chỉ còn `{ lateCount: number }`. `PayrollLine` nhận thêm `days: DailyPayLine[]`.

- [ ] **Step 1: Viết test đối chiếu (bài quan trọng nhất của plan)**

Thêm vào cuối `src/lib/payroll/__tests__/compute.test.ts`, trong một `describe` mới:

```ts
describe("tổng kỳ bằng đúng tổng các dòng ngày", () => {
  it("15. netPay === Σ dayTotal + allowanceTotal − deductionTotal, bằng ĐÚNG", () => {
    const days = Array.from({ length: 22 }, (_, index) =>
      dailyLine({ date: `2026-08-${String(index + 1).padStart(2, "0")}` }),
    );

    const result = computePayrollLine({
      summary: { lateCount: 0 },
      dailyLines: days,
      payRate: { unit: "month", amount: MONTHLY_SALARY },
      overtimeRate: null,
      workMode: "shift",
      standardDaysPerMonth: DAYS_PER_MONTH,
      standardHoursPerDay: HOURS_PER_DAY,
      adjustments: [adjustment()],
      employee: EMPLOYEE,
    });

    const sumOfDays = days.reduce((sum, day) => sum + (day.dayTotal ?? 0), 0);

    // Dang thuc CHINH XAC, khong phai xap xi — day la thu giu cho ke toan doi
    // chieu duoc bang luong voi chi tiet ngay ma khong lech mot dong.
    expect(result.netPay).toBe(
      sumOfDays + (result.allowanceTotal ?? 0) - (result.deductionTotal ?? 0),
    );
    expect(result.basePay).toBe(sumOfDays);
  });

  it("16. ngày đang dở KHÔNG làm đổi tổng kỳ", () => {
    const base = [dailyLine({ date: "2026-08-03" })];
    const withOpen = [...base, openDailyLine({ date: "2026-08-04" })];

    const a = compute(base);
    const b = compute(withOpen);

    expect(b.netPay).toBe(a.netPay);
    expect(b.missing).toEqual([]);
  });
});
```

Thêm ba hàm dựng ngay dưới `adjustment()` trong cùng file:

```ts
import { computeDailyPay, type DailyPayLine } from "@/lib/payroll/compute-daily";

/** Mot ngay thuong du ca, don gia ngay 500.000. */
function dailyLine(overrides: { date?: string } = {}): DailyPayLine {
  return computeDailyPay({
    date: overrides.date ?? "2026-08-03",
    credit: {
      creditedDays: 1,
      regularMinutes: 480,
      overtimeMinutes: 0,
      hourDelta: 0,
      missing: null,
    },
    classification: {
      dayType: "weekday",
      nightMinutes: 0,
      overtimeMinutes: 0,
      overtimeNightMinutes: 0,
      convertedOvertimeHours: 0,
      missingMultiplierKeys: [],
      workModeInputMissing: false,
    },
    status: "on_time",
    hasOpenPunch: false,
    dailyRate: DAILY_RATE,
    hourlyRate: HOURLY_RATE,
    overtimeRate: null,
    workMode: "shift",
    paysByActualHours: false,
  });
}

/** Mot ngay da cham vao, chua cham ra. */
function openDailyLine(overrides: { date?: string } = {}): DailyPayLine {
  return computeDailyPay({
    date: overrides.date ?? "2026-08-04",
    credit: {
      creditedDays: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      hourDelta: 0,
      missing: null,
    },
    classification: {
      dayType: "weekday",
      nightMinutes: 0,
      overtimeMinutes: 0,
      overtimeNightMinutes: 0,
      convertedOvertimeHours: 0,
      missingMultiplierKeys: [],
      workModeInputMissing: false,
    },
    status: "on_time",
    hasOpenPunch: true,
    dailyRate: DAILY_RATE,
    hourlyRate: HOURLY_RATE,
    overtimeRate: null,
    workMode: "shift",
    paysByActualHours: false,
  });
}

function compute(dailyLines: DailyPayLine[]) {
  return computePayrollLine({
    summary: { lateCount: 0 },
    dailyLines,
    payRate: { unit: "month", amount: MONTHLY_SALARY },
    overtimeRate: null,
    workMode: "shift",
    standardDaysPerMonth: DAYS_PER_MONTH,
    standardHoursPerDay: HOURS_PER_DAY,
    adjustments: [],
    employee: EMPLOYEE,
  });
}
```

Cập nhật hàm `line()` sẵn có: bỏ `summary` cũ, thay bằng `summary: { lateCount: overrides.lateCount ?? 0 }` và `dailyLines: overrides.dailyLines ?? [dailyLine()]`. Mọi bài test cũ trong file phải được sửa theo — con số kỳ vọng đổi từ "26 ngày công" sang số ngày mà `dailyLines` mô tả.

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `pnpm vitest run src/lib/payroll/__tests__/compute.test.ts`
Expected: FAIL — `computePayrollLine` chưa nhận `dailyLines`

- [ ] **Step 3: Sửa `compute.ts`**

Trong `PayrollComputeInput`, thay khối `summary` bằng:

```ts
  /**
   * So lieu cua ky KHONG suy duoc tu tung ngay. Hien chi con mot truong: so
   * lan di muon, dung lam he so cho khoan `per_late`.
   *
   * Moi thu khac da chuyen xuong `dailyLines` — day la thay doi lam cho tong
   * cua ky LUON bang tong cac dong ngay.
   */
  summary: { lateCount: number };
  /** Cac dong ngay da quy ra tien (`compute-daily.ts`). Nguon cua ba con so tien. */
  dailyLines: readonly DailyPayLine[];
```

Thay khối tính `basePay` / `hourAdjustment` / `overtimePay` (dòng 201-283) bằng:

```ts
  /* ------------------------------------------------------------------ */
  /* Ba con so tien — CONG tu cac dong ngay, khong nhan tu so tong        */
  /* ------------------------------------------------------------------ */
  // Ba phep nhan cu (don gia x ngay cong, don gia gio x gio quy doi, don gia
  // gio x lech gio) da chuyen xuong `compute-daily.ts` va chay MOT LAN CHO
  // MOI NGAY. O day chi con phep cong so nguyen.
  const daily = sumDailyPay(dailyLines);
  for (const key of daily.missing) missing.add(key);
```

Thêm import ở đầu file:

```ts
import { sumDailyPay, type DailyPayLine } from "@/lib/payroll/compute-daily";
```

Ở khối tổng cuối, thay ba biến `basePayFinal` / `overtimePayFinal` / `hourAdjustmentFinal` bằng `daily.basePay` / `daily.overtimePay` / `daily.hourAdjustment` (chúng đã làm tròn ở mức ngày, không làm tròn lại). Thêm `days: [...dailyLines]` vào giá trị trả về, và thêm `days: DailyPayLine[]` vào `PayrollLine`.

Cập nhật khối comment quy tắc (3) ở đầu file: ranh giới "CON SO CUOI" nay nằm ở **mức ngày**, và số của kỳ là tổng các số đó.

- [ ] **Step 4: Sửa `payroll-rows.ts` để dựng `dailyLines`**

Trong `.map((employee) => {...})`, sau khi có `payRate` và `overtimeRate`, chèn trước lời gọi `computePayrollLine`:

```ts
      const rateInput = {
        unit: payRate?.unit ?? "month",
        amount: payRate?.amount ?? 0,
        standardDaysPerMonth: context.rules.standardDaysPerMonth,
        standardHoursPerDay: context.rules.standardHoursPerDay,
      };
      // Chua khai muc luong thi KHONG co don gia — `null` chu khong phai 0.
      const dailyRate = payRate === null ? null : toDailyRate(rateInput).value;
      const hourlyRate = payRate === null ? null : toHourlyRate(rateInput).value;
      const paysByActualHours =
        context.rules.workMode === "daily_hours" || payRate?.unit === "hour";

      const dailyLines = summary.days.map((day) =>
        computeDailyPay({
          date: day.date,
          credit: day.credit,
          classification: day.classification,
          status: day.status,
          hasOpenPunch: day.hasOpenPunch,
          dailyRate,
          hourlyRate,
          overtimeRate,
          workMode: context.rules.workMode,
          paysByActualHours,
        }),
      );
```

Thay khối `summary: {...}` trong lời gọi `computePayrollLine` bằng `summary: { lateCount: summary.lateCount }, dailyLines,`.

Thêm `days: money.days` vào đối tượng `PayrollPrepRow` trả về, và thêm `days: DailyPayLine[]` vào `PayrollPrepRow` trong `src/lib/types/domain.ts`.

Import cần thêm ở `payroll-rows.ts`:

```ts
import { computeDailyPay } from "@/lib/payroll/compute-daily";
import { toDailyRate, toHourlyRate } from "@/lib/payroll/rate";
```

- [ ] **Step 5: Chạy toàn bộ test payroll**

Run: `pnpm vitest run src/lib/payroll src/lib/data`
Expected: PASS. Nếu một bài cũ đỏ vì con số lệch vài chục đồng, **đó là kết quả đúng** — sửa con số kỳ vọng và ghi công thức mới ngay trên dòng khẳng định.

- [ ] **Step 6: Typecheck và commit**

```bash
pnpm typecheck
git add src/lib/payroll src/lib/types/domain.ts
git commit -m "feat(payroll): kỳ lương cộng từ các dòng ngày thay vì nhân từ số tổng"
```

---

### Task 4: Migration `0030_payroll_line_days.sql`

**Files:**
- Create: `supabase/migrations/0030_payroll_line_days.sql`

**Interfaces:**
- Consumes: `payroll_lines` (0024), `tf_payroll_immutable()` (0024), khuôn RLS của 0029.
- Produces: bảng `payroll_line_days` với RLS + trigger bất biến.

- [ ] **Step 1: Viết migration**

```sql
-- 0030_payroll_line_days.sql
--
-- CHI TIET THEO NGAY cua mot dong luong da chot (plan 06, PAY-01).
--
-- ======================================================================
-- (1) VI SAO BAN CHOT PHAI TU CHUA CA CHI TIET NGAY
-- ======================================================================
--
-- Tu plan nay, tien cua mot ky la TONG CUA CAC NGAY chu khong con la mot phep
-- nhan tu so tong. Neu ban chot chi luu con so thang, thi mo lai mot ky da
-- chot se phai TINH LAI tung ngay tu du lieu cham cong cua HOM NAY — va khi
-- mot yeu cau duoc duyet ve sau lam doi so lieu cua ky, cac dong ngay se khong
-- con cong lai ra dung con so tien da tra.
--
-- Mot phieu tu mau thuan voi chinh no te hon ca mot phieu sai: nguoi doc thay
-- 22 dong cong lai ra mot so, va o tren cung mot so khac.
--
-- Vi vay bang nay chep lai TIEN cua tung ngay tai thoi diem chot, cung khuon
-- `payroll_lines` va `payroll_line_items` (0024 muc (1)).
--
-- ======================================================================
-- (2) NGAY NAO DUOC GHI
-- ======================================================================
--
-- Chi ngay CO IT NHAT MOT BAN GHI CHAM CONG — ke ca nghi co phep / khong phep
-- (chung la ban ghi trang thai, khong phai khoang trong). Ngay khong co ban
-- ghi nao thi khong sinh dong: bang nay khong phai mot cuon lich.
--
-- He qua CO Y: mot ngay nghi khong phep CO dong voi moi cot bang 0. Do la mot
-- su that ("hom do nghi va khong duoc tra gi"), khac han voi khong co dong
-- ("hom do khong phai ngay lam viec").
--
-- (3) `not null` tren cac cot tien la mot BAT BIEN, khong phai tien nghi: mot
-- ky chi chot duoc khi khong dong nao thieu du kien (`closePayroll`).
--
-- (4) FILE NAY CHAY LAI DUOC MA VO HAI — khuon 0018/0021/0024.

drop table if exists payroll_line_days;

create table payroll_line_days (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  line_id uuid not null references payroll_lines (id) on delete cascade,

  work_date date not null,
  day_type text not null check (day_type in ('weekday', 'weekend', 'holiday')),

  -- SO LIEU CONG cua ngay, chep lai.
  credited_days numeric(8, 4) not null,
  regular_minutes int not null,
  overtime_minutes int not null,
  converted_overtime_hours numeric(8, 2) not null,
  hour_delta_minutes int not null,

  -- TIEN cua ngay. `day_total` = base_pay + overtime_pay + hour_adjustment,
  -- ca ba deu DA LAM TRON o muc ngay — khong lam tron lai o bat ky dau.
  base_pay numeric(14, 2) not null,
  overtime_pay numeric(14, 2) not null,
  hour_adjustment numeric(14, 2) not null,
  day_total numeric(14, 2) not null,

  unique (line_id, work_date)
);

comment on table payroll_line_days is
  'Chi tiet theo ngay cua mot dong luong da chot. Tong cac dong o day bang '
  'DUNG (base_pay + overtime_pay + hour_adjustment) cua payroll_lines — xem '
  'khoi comment migration 0030.';

create index payroll_line_days_company_id_idx on payroll_line_days (company_id);
create index payroll_line_days_line_id_idx on payroll_line_days (line_id);

/* -------------------------------------------------------------------------- */
/* Bat bien: khong sua duoc tung dong (khuon 0024)                             */
/* -------------------------------------------------------------------------- */

create trigger payroll_line_days_immutable
  before update on payroll_line_days
  for each row
  execute function public.tf_payroll_immutable();

/* -------------------------------------------------------------------------- */
/* RLS — chep khuon 0029: quan tri ca cong ty, con lai chi dong cua chinh minh */
/* -------------------------------------------------------------------------- */

alter table payroll_line_days enable row level security;

-- `payroll_line_days` KHONG co `employee_id`. Dieu kien di qua `line_id` —
-- CHEP DUNG khuon `payroll_line_items_select_scoped` cua 0029, vi hai bang o
-- cung mot the: deu treo duoi `payroll_lines` va deu khong tu biet chu cua
-- minh. Hai bang cung the ma dien dat khac nhau la cho de mot lo hong lot qua
-- ma khong ai doi chieu duoc.
create policy payroll_line_days_select_scoped on payroll_line_days
  for select using (
    public.tf_is_company_admin(company_id)
    or exists (
      select 1
      from payroll_lines line
      where line.id = payroll_line_days.line_id
        and public.tf_owns_payroll_line(line.employee_id)
    )
  );

-- Ghi/xoa giu nguyen `tf_is_member` — cung ba ly do voi 0029 muc (3): duong
-- ghi duy nhat o tang ung dung da goi `requireRole(role, ['owner','admin'])`,
-- va `update` da bi trigger chan hoan toan.
create policy payroll_line_days_insert_member on payroll_line_days
  for insert with check (public.tf_is_member(company_id));
create policy payroll_line_days_update_member on payroll_line_days
  for update using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));
create policy payroll_line_days_delete_member on payroll_line_days
  for delete using (public.tf_is_member(company_id));
```

Hai hàm `public.tf_is_company_admin(company_id)` và `public.tf_owns_payroll_line(employee_id)` **đã tồn tại** — chúng do 0029 tạo. Không định nghĩa lại.

- [ ] **Step 2: Chạy migration lên Supabase**

Chạy nội dung file trong SQL Editor của dự án Supabase, hoặc `supabase db push` nếu CLI đã cấu hình.
Expected: không lỗi. Chạy lần hai cũng không lỗi (file chạy lại được).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0030_payroll_line_days.sql
git commit -m "feat(db): bảng payroll_line_days lưu chi tiết ngày của bản chốt lương"
```

---

### Task 5: `closePayroll()` ghi `payroll_line_days`

**Files:**
- Modify: `src/lib/data/mutations/payroll.ts:193-228`
- Test: `src/lib/data/__tests__/payroll-run.test.ts`

**Interfaces:**
- Consumes: `PayrollPrepRow.days` từ Task 3, bảng từ Task 4.
- Produces: không có API mới — `closePayroll()` giữ nguyên chữ ký `(month: string) => Promise<ClosePayrollResult>`.

- [ ] **Step 1: Viết test thất bại**

`src/lib/data/__tests__/payroll-run.test.ts` là **test tích hợp trên Postgres dev thật** (`// @vitest-environment node`, dùng `admin` = client `SUPABASE_SECRET_KEY`, `createServerSupabase` được mock về client đó). Bài mới phải theo đúng khuôn đó — **không** dựng mock kiểu `insertCalls`.

Bộ số của file: ca 08:00-16:00, 20 ngày công chuẩn, 8 giờ/ngày, lương 20.000.000/tháng → đơn giá ngày 1.000.000. `WORK_DAY = "2015-06-01"`, một ngày làm đủ 8 tiếng → thực nhận 1.000.000.

Thêm vào cuối `describe`:

```ts
  it("6. chốt lương ghi payroll_line_days cho ngày có phát sinh", async () => {
    await closePayroll(MONTH);

    const { data: run } = await admin
      .from("payroll_runs")
      .select("id")
      .eq("company_id", companyId)
      .eq("period_start", PERIOD_START)
      .single();

    const { data: line } = await admin
      .from("payroll_lines")
      .select("id, base_pay, overtime_pay, hour_adjustment")
      .eq("run_id", (run as { id: string }).id)
      .eq("employee_id", employeeId)
      .single();

    const { data: days } = await admin
      .from("payroll_line_days")
      .select("work_date, day_type, day_total, base_pay")
      .eq("line_id", (line as { id: string }).id)
      .order("work_date", { ascending: true });

    const dayRows = (days ?? []) as Array<{
      work_date: string;
      day_type: string;
      day_total: string;
      base_pay: string;
    }>;

    // Dung MOT ngay cham cong trong ky (WORK_DAY) -> dung mot dong.
    expect(dayRows).toHaveLength(1);
    expect(dayRows[0].work_date).toBe(WORK_DAY);
    expect(dayRows[0].day_type).toBe("weekday");
    expect(Number(dayRows[0].day_total)).toBe(EXPECTED_NET);

    // BAI DOI CHIEU o tang database: tong cac ngay bang DUNG ba cot tien cua
    // dong luong. Day la loi hua "tong luon khop" duoc kiem tren du lieu that,
    // khong chi trong mot ham thuan.
    const lineRow = line as {
      base_pay: string;
      overtime_pay: string;
      hour_adjustment: string;
    };
    const sumOfDays = dayRows.reduce(
      (sum, row) => sum + Number(row.day_total),
      0,
    );
    expect(sumOfDays).toBe(
      Number(lineRow.base_pay) +
        Number(lineRow.overtime_pay) +
        Number(lineRow.hour_adjustment),
    );
  });

  it("7. huỷ chốt lương xoá sạch payroll_line_days theo cascade", async () => {
    await closePayroll(MONTH);

    const { data: run } = await admin
      .from("payroll_runs")
      .select("id")
      .eq("company_id", companyId)
      .eq("period_start", PERIOD_START)
      .single();
    const runId = (run as { id: string }).id;

    await reopenPayroll(MONTH, "Kiểm thử cascade");

    const { count } = await admin
      .from("payroll_line_days")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

    // Khong con dong nao — `on delete cascade` di qua HAI tang
    // (payroll_runs -> payroll_lines -> payroll_line_days).
    expect(count).toBe(0);
    expect(runId).toBeTruthy();
  });
```

*(`companyId` và `employeeId` là hai biến dựng trong `beforeAll` của file — dùng đúng tên file đang dùng. Nếu mỗi `it` tự chốt lương thì phải dọn `payroll_runs` ở `afterEach` theo đúng cách file đang làm, vì `unique (company_id, period_start)` chặn chốt lần hai.)*

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `pnpm vitest run src/lib/data/__tests__/payroll-run.test.ts`
Expected: FAIL — không có lệnh insert nào vào `payroll_line_days`

- [ ] **Step 3: Thêm bước ghi vào `closePayroll()`**

Chèn ngay sau khối ghi `payroll_line_items` (sau dòng 228):

```ts
  // CHI TIET THEO NGAY (0030). Ghi SAU cac khoan, cung khuon don dep khi loi:
  // mot ban chot khong co chi tiet ngay la mot ban chot khong mo lai duoc, nen
  // that bai o day phai keo ca ban chot di theo.
  const dayRows = rows.flatMap((row) => {
    const lineId = lineIdByEmployee.get(row.employeeId);
    if (!lineId) return [];
    return row.days
      // Ngay dang do khong co con so nao de chep. Ve nguyen tac no khong ton
      // tai o day (ky cong da chot truoc), nhung neu con thi bo qua chu khong
      // ghi mot dong `null` vao mot bang khai `not null`.
      .filter((day) => day.dayTotal !== null)
      .map((day) => ({
        company_id: companyId,
        line_id: lineId,
        work_date: day.date,
        day_type: day.dayType,
        credited_days: day.creditedDays,
        regular_minutes: day.regularMinutes,
        overtime_minutes: day.overtimeMinutes,
        converted_overtime_hours: day.convertedOvertimeHours,
        hour_delta_minutes: day.hourDeltaMinutes,
        base_pay: day.basePay,
        overtime_pay: day.overtimePay,
        hour_adjustment: day.hourAdjustment,
        day_total: day.dayTotal,
      }));
  });

  if (dayRows.length > 0) {
    const { error: dayError } = await supabase
      .from("payroll_line_days")
      .insert(dayRows);
    if (dayError) {
      await supabase.from("payroll_runs").delete().eq("id", runId);
      throw new Error(
        "Không thể ghi chi tiết theo ngày của bảng lương đã chốt.",
      );
    }
  }
```

- [ ] **Step 4: Chạy test để xác nhận nó qua**

Run: `pnpm vitest run src/lib/data/__tests__/payroll-run.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck và commit**

```bash
pnpm typecheck
git add src/lib/data/mutations/payroll.ts src/lib/data/__tests__/payroll-run.test.ts
git commit -m "feat(payroll): chốt lương ghi kèm chi tiết theo ngày"
```

---

### Task 6: `buildPayrollRows()` nhận `employeeId` tuỳ chọn

**Files:**
- Modify: `src/lib/payroll/payroll-rows.ts:73-117`
- Test: `src/lib/payroll/__tests__/payroll-rows-scope.test.ts` (tạo mới)

**Interfaces:**
- Produces: `buildPayrollRows({ companyId, month, employeeId? })`. Có `employeeId` thì `rows` chỉ chứa đúng một dòng (hoặc rỗng nếu người đó không thuộc kỳ).

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/payroll/__tests__/payroll-rows-scope.test.ts` với hai bài:

```ts
import { describe, expect, it, vi } from "vitest";

import { buildPayrollRows } from "@/lib/payroll/payroll-rows";

/**
 * `employeeId` la mot bo LOC, khong phai mot cong quyen. Cong quyen nam o
 * Route Handler (`assertCanViewOwnPayslip`). Hai bai nay canh dieu kien SQL:
 * loc phai duoc day XUONG truy van, khong loc trong JS sau khi da keo ca
 * doanh nghiep ve.
 */

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/attendance/month-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/attendance/month-context")>();
  return { ...actual, loadMonthContext: vi.fn() };
});
vi.mock("@/lib/payroll/payroll-context", () => ({
  loadPayrollContext: vi.fn(),
}));

/** Mot chuoi truy van ghi lai moi `eq` da goi, phan biet theo TEN BANG. */
function chain(result: { data: unknown[]; error: null }) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lt", "order", "in"]) {
    self[method] = vi.fn(() => self);
  }
  // `await chain` tra ket qua — PostgREST tra thenable.
  self.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return self as { eq: ReturnType<typeof vi.fn> } & Record<string, unknown>;
}

function mockClient() {
  const employeeChain = chain({ data: [], error: null });
  const attendanceChain = chain({ data: [], error: null });
  const periodChain = chain({ data: [], error: null });
  (periodChain as Record<string, unknown>).maybeSingle = vi.fn(() =>
    Promise.resolve({ data: null, error: null }),
  );

  const client = {
    from: vi.fn((table: string) => {
      if (table === "employees") return employeeChain;
      if (table === "attendance_records") return attendanceChain;
      return periodChain;
    }),
  };
  return { client, employeeChain, attendanceChain };
}

describe("buildPayrollRows — phạm vi một nhân viên", () => {
  beforeEach(() => {
    vi.mocked(loadMonthContext).mockResolvedValue(MONTH_CONTEXT);
    vi.mocked(loadPayrollContext).mockResolvedValue({
      payRateByEmployee: new Map(),
      overtimeRateByEmployee: new Map(),
      adjustments: [],
    });
  });

  it("1. có employeeId -> eq('id', employeeId) đẩy xuống truy vấn nhân viên", async () => {
    const { client, employeeChain } = mockClient();
    vi.mocked(createServerSupabase).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );

    await buildPayrollRows({
      companyId: "cty-01",
      month: "2026-08",
      employeeId: "nv-1",
    });

    expect(employeeChain.eq).toHaveBeenCalledWith("id", "nv-1");
  });

  it("2. có employeeId -> eq('employee_id') đẩy xuống truy vấn chấm công", async () => {
    const { client, attendanceChain } = mockClient();
    vi.mocked(createServerSupabase).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );

    await buildPayrollRows({
      companyId: "cty-01",
      month: "2026-08",
      employeeId: "nv-1",
    });

    expect(attendanceChain.eq).toHaveBeenCalledWith("employee_id", "nv-1");
  });

  it("3. KHÔNG có employeeId -> không điều kiện nào theo người", async () => {
    const { client, employeeChain } = mockClient();
    vi.mocked(createServerSupabase).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );

    await buildPayrollRows({ companyId: "cty-01", month: "2026-08" });

    expect(employeeChain.eq).not.toHaveBeenCalledWith("id", expect.anything());
  });
});
```

`MONTH_CONTEXT` dùng lại hằng số của `month-context-days.test.ts` (Task 2) — chép sang, đừng import từ file test khác.

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `pnpm vitest run src/lib/payroll/__tests__/payroll-rows-scope.test.ts`
Expected: FAIL — `eq` không được gọi với `"id", "nv-1"`

- [ ] **Step 3: Thêm tham số**

Sửa chữ ký:

```ts
export async function buildPayrollRows({
  companyId,
  month,
  employeeId,
}: {
  companyId: string;
  /** "YYYY-MM" */
  month: string;
  /**
   * Loc ve MOT nguoi. KHONG phai mot cong quyen — cong nam o Route Handler.
   * Ly do co tham so nay: phieu tam tinh cua nhan vien phai di qua CHINH ham
   * nay, chu khong duoc mo mot duong tinh thu hai (xem khoi comment dau file).
   */
  employeeId?: string;
}): Promise<PayrollRowsResult> {
```

Trong `Promise.all`, dựng hai truy vấn có điều kiện thay vì gọi thẳng:

```ts
  let employeeQuery = supabase
    .from("employees")
    .select(
      "id, code, full_name, status, department_id, position, departments!employees_department_id_fkey(name)",
    )
    .eq("company_id", companyId)
    .order("code", { ascending: true });
  if (employeeId) employeeQuery = employeeQuery.eq("id", employeeId);

  let attendanceQuery = supabase
    .from("attendance_records")
    .select(ATTENDANCE_COLUMNS)
    .eq("company_id", companyId)
    .gte("work_date", context.start)
    .lt("work_date", context.end);
  if (employeeId) attendanceQuery = attendanceQuery.eq("employee_id", employeeId);
```

rồi truyền `employeeQuery` / `attendanceQuery` vào `Promise.all`.

- [ ] **Step 4: Chạy test**

Run: `pnpm vitest run src/lib/payroll`
Expected: PASS

- [ ] **Step 5: Typecheck và commit**

```bash
pnpm typecheck
git add src/lib/payroll
git commit -m "feat(payroll): buildPayrollRows lọc được về một nhân viên"
```

---

### Task 7: Hợp đồng dữ liệu + API nhân viên

**Files:**
- Modify: `src/lib/validation/api/payslips.ts`
- Modify: `src/app/api/payslips/route.ts`
- Modify: `src/app/api/payslips/[month]/route.ts`
- Modify: `src/lib/types/domain.ts` (kiểu `Payslip`, `PayslipSummary`)
- Modify: `src/lib/data/payslips.ts`
- Test: `src/lib/data/__tests__/payslips-provisional.test.ts` (tạo mới)

**Interfaces:**
- Produces: `payslipDaySchema`, `provisionalPayslipSchema`, `closedPayslipSchema`, `payslipResponseSchema` (union phân biệt theo `status`). `PayslipSummary` nhận thêm `status: "closed" | "provisional"` và `closedAt: string | null`.

- [ ] **Step 1: Mở rộng hợp đồng**

Thêm vào `src/lib/validation/api/payslips.ts`:

```ts
/** Mot ngay trong phieu luong. */
export const payslipDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayType: z.enum(["weekday", "weekend", "holiday"]),
  state: z.enum(["counted", "in_progress", "leave_paid", "leave_unpaid"]),
  regularMinutes: z.number().nullable(),
  overtimeMinutes: z.number().int(),
  basePay: z.number().nullable(),
  overtimePay: z.number().nullable(),
  hourAdjustment: z.number().nullable(),
  dayTotal: z.number().nullable(),
});

/**
 * PHIEU DA CHOT — moi truong tien KHONG nullable.
 *
 * Bat bien nay KHONG duoc noi long de phuc vu phieu tam tinh: mot ky chi chot
 * duoc khi khong dong nao thieu du kien (`closePayroll`), nen `null` o day la
 * khong the xay ra, va hop dong phai noi dung nhu vay.
 */
export const closedPayslipSchema = payslipSchema.extend({
  status: z.literal("closed"),
  days: z.array(payslipDaySchema),
});

/**
 * PHIEU TAM TINH — tien CO THE `null` (chua khai muc luong), va `missing` noi
 * ro thieu gi. Day la ly do khong dung chung mot kieu voi phieu da chot.
 */
export const provisionalPayslipSchema = z.object({
  status: z.literal("provisional"),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  closedAt: z.null(),

  employeeCode: z.string(),
  employeeName: z.string(),
  departmentName: z.string().nullable(),

  payUnit: z.enum(["month", "day", "hour"]).nullable(),
  payAmount: z.number().nullable(),

  workedDays: z.number().int(),
  totalMinutes: z.number().int(),
  leaveDays: z.number().int(),
  lateCount: z.number().int(),
  overtimeMinutes: z.number().int(),
  convertedOvertimeHours: z.number().nullable(),

  basePay: z.number().nullable(),
  overtimePay: z.number().nullable(),
  hourAdjustment: z.number().nullable(),
  allowanceItems: z.array(payrollAdjustmentItemSchema),
  deductionItems: z.array(payrollAdjustmentItemSchema),
  allowanceTotal: z.number().nullable(),
  deductionTotal: z.number().nullable(),
  netPay: z.number().nullable(),
  missing: z.array(z.string()),

  days: z.array(payslipDaySchema),
});

export const payslipResponseSchema = z.discriminatedUnion("status", [
  closedPayslipSchema,
  provisionalPayslipSchema,
]);
```

Sửa `payslipSummarySchema`: thêm `status: z.enum(["closed", "provisional"])`, đổi `closedAt` thành `z.string().nullable()`, đổi `netPay` thành `z.number().nullable()`.

- [ ] **Step 2: Viết lại khối comment mục (2)**

Trong `src/app/api/payslips/route.ts`, thay khối mục (2) (dòng 27-37) bằng:

```
 * ======================================================================
 * (2) DANH SACH GOM CA KY DANG MO — VA DIEU KIEN DI KEM
 * ======================================================================
 *
 * Truoc plan 06, route nay CHI doc ban chot, voi ly do: mot con so chua ai
 * duyet phat cho nhan vien thi thang sau no khac di ma khong ai giai thich
 * duoc.
 *
 * Quyet dinh do da duoc DAO CO Y THUC. Ly do: nguoi lam cong hoi "hom nay toi
 * duoc bao nhieu", va bat ho doi den cuoi ky de biet la bat ho tin ma khong
 * kiem duoc. Rui ro cu khong bien mat — no duoc XU LY:
 *
 *   - Moi muc mang `status`, va kỳ dang mo LUON la `provisional`.
 *   - Man hinh BAT BUOC hien nhan "tam tinh" tren muc do (khong phai trang
 *     tri — do la dieu kien de quyet dinh nay dung).
 *   - So cua ky dang mo den tu CHINH `buildPayrollRows()` ma man hinh quan
 *     tri va `closePayroll()` dung. Khong co duong tinh thu hai, nen con so
 *     nhan vien thay hom nay la con so se duoc chot neu khong gi thay doi.
 *
 * Ky DA CHOT van doc tu ban chot va khong bao gio tinh lai.
```

- [ ] **Step 3: Sửa `GET /api/payslips`**

Sau khi đọc xong danh sách kỳ đã chốt, thêm kỳ đang mở:

```ts
    const closed = ((data ?? []) as unknown as RawRow[])
      .filter((row) => row.payroll_runs !== null)
      .map((row) => ({
        status: "closed" as const,
        month: row.payroll_runs!.period_start.slice(0, 7),
        closedAt: row.payroll_runs!.closed_at,
        netPay: Number(row.net_pay),
      }));

    // KY DANG MO — thang hien tai neu no chua co ban chot. `toIsoDate` doc
    // dong ho MAY CHU (khong phai client), cung nguon voi moi cho khac.
    const currentMonth = toIsoDate(new Date()).slice(0, 7);
    const hasClosed = closed.some((item) => item.month === currentMonth);

    const provisional = hasClosed
      ? []
      : await (async () => {
          const { rows } = await buildPayrollRows({
            companyId,
            month: currentMonth,
            employeeId,
          });
          const row = rows[0];
          if (!row) return [];
          return [
            {
              status: "provisional" as const,
              month: currentMonth,
              closedAt: null,
              netPay: row.netPay,
            },
          ];
        })();

    return NextResponse.json(
      payslipListResponseSchema.parse([...provisional, ...closed]),
    );
```

Import thêm: `import { buildPayrollRows } from "@/lib/payroll/payroll-rows";` và `import { toIsoDate } from "@/lib/format";`.

- [ ] **Step 4: Sửa `GET /api/payslips/[month]`**

Sau khi `if (!run)` — thay `return NextResponse.json(null)` bằng nhánh tạm tính:

```ts
    // KY CHUA CHOT -> tinh live qua CHINH ham ma man hinh quan tri dung.
    if (!run) {
      const { rows } = await buildPayrollRows({ companyId, month, employeeId });
      const row = rows[0];
      // Nguoi nay khong co dong nao trong ky (vao lam sau ky do) — cung mot
      // cau tra loi voi "ky khong ton tai", de khong do duoc lich su.
      if (!row) return NextResponse.json(null);

      return NextResponse.json(
        provisionalPayslipSchema.parse({
          status: "provisional",
          month,
          closedAt: null,
          employeeCode: row.employeeCode,
          employeeName: row.employeeName,
          departmentName: row.departmentName,
          payUnit: row.payUnit,
          payAmount: row.payAmount,
          workedDays: row.workedDays,
          totalMinutes: row.totalMinutes,
          leaveDays: row.leaveDays,
          lateCount: row.lateCount,
          overtimeMinutes: row.overtimeMinutes,
          convertedOvertimeHours: row.convertedOvertimeHours,
          basePay: row.basePay,
          overtimePay: row.overtimePay,
          hourAdjustment: row.hourAdjustment,
          allowanceItems: row.allowanceItems,
          deductionItems: row.deductionItems,
          allowanceTotal: row.allowanceTotal,
          deductionTotal: row.deductionTotal,
          netPay: row.netPay,
          missing: row.missing,
          days: row.days.map(toPayslipDay),
        }),
      );
    }
```

Nhánh đã chốt: đọc thêm `payroll_line_days` theo `line_id`, thêm `status: "closed"` và `days` vào `closedPayslipSchema.parse(...)`.

Hàm chuyển đổi dùng chung, đặt cạnh `toItem()`:

```ts
function toPayslipDay(day: DailyPayLine) {
  return {
    date: day.date,
    dayType: day.dayType,
    state: day.state,
    regularMinutes: day.regularMinutes,
    overtimeMinutes: day.overtimeMinutes,
    basePay: day.basePay,
    overtimePay: day.overtimePay,
    hourAdjustment: day.hourAdjustment,
    dayTotal: day.dayTotal,
  };
}
```

`assertCanViewOwnPayslip()` **không di chuyển** — nó đã đứng trước cả hai nhánh.

- [ ] **Step 5: Viết test route**

Tạo `src/lib/data/__tests__/payslips-provisional.test.ts`. Mock ba thứ: phiên, `assertCanViewOwnPayslip`, và `buildPayrollRows` (để bài 3 chứng minh được nó **không** bị gọi).

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/payslips/[month]/route";
import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { assertCanViewOwnPayslip } from "@/lib/payroll/payslip-access";
import { buildPayrollRows } from "@/lib/payroll/payroll-rows";
import { createServerSupabase } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/payroll/payroll-rows", () => ({ buildPayrollRows: vi.fn() }));
vi.mock("@/lib/payroll/payslip-access", () => ({
  assertCanViewOwnPayslip: vi.fn(),
}));
vi.mock("@/lib/auth/session-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session-context")>();
  return { ...actual, getSessionContext: vi.fn() };
});

const SESSION = { companyId: "cty-01", employeeId: "nv-1", role: "employee" };

const PROVISIONAL_ROW = {
  employeeId: "nv-1",
  employeeCode: "NV001",
  employeeName: "Nguyễn Minh Anh",
  departmentName: "Kinh doanh",
  payUnit: "month" as const,
  payAmount: 13_000_000,
  workedDays: 1,
  totalMinutes: 480,
  leaveDays: 0,
  lateCount: 0,
  overtimeMinutes: 0,
  overtimeNightMinutes: 0,
  convertedOvertimeHours: 0,
  missingMultiplierKeys: [],
  creditedDays: 1,
  regularMinutes: 480,
  hourDeltaMinutes: 0,
  missingWorkModeInputs: [],
  basePay: 500_000,
  overtimePay: 0,
  hourAdjustment: 0,
  allowanceItems: [],
  deductionItems: [],
  allowanceTotal: 0,
  deductionTotal: 0,
  netPay: 500_000,
  missing: [],
  days: [
    {
      date: "2026-08-03",
      dayType: "weekday" as const,
      state: "counted" as const,
      creditedDays: 1,
      regularMinutes: 480,
      overtimeMinutes: 0,
      convertedOvertimeHours: 0,
      hourDeltaMinutes: 0,
      basePay: 500_000,
      overtimePay: 0,
      hourAdjustment: 0,
      dayTotal: 500_000,
      missing: [],
    },
  ],
};

/** Ky CHUA chot: truy van `payroll_runs` tra `null`. */
function clientWithoutRun() {
  const runChain = {
    select: vi.fn(() => runChain),
    eq: vi.fn(() => runChain),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
  return { from: vi.fn(() => runChain) };
}

function request(): Request {
  return new Request("http://localhost/api/payslips/2026-08");
}

function params() {
  return { params: Promise.resolve({ month: "2026-08" }) };
}

describe("GET /api/payslips/[month]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionContext).mockResolvedValue(
      SESSION as unknown as Awaited<ReturnType<typeof getSessionContext>>,
    );
    vi.mocked(assertCanViewOwnPayslip).mockResolvedValue(undefined);
  });

  it("1. can_view_payslip=false -> 403 ở CẢ nhánh tạm tính", async () => {
    vi.mocked(assertCanViewOwnPayslip).mockRejectedValue(new ForbiddenError());
    vi.mocked(createServerSupabase).mockResolvedValue(
      clientWithoutRun() as unknown as Awaited<
        ReturnType<typeof createServerSupabase>
      >,
    );

    const response = await GET(request(), params());

    expect(response.status).toBe(403);
    // Cong quyen dung TRUOC moi phep tinh — khong duoc tinh xong roi moi tu choi.
    expect(buildPayrollRows).not.toHaveBeenCalled();
  });

  it("2. kỳ chưa chốt -> status provisional, kèm mảng days", async () => {
    vi.mocked(createServerSupabase).mockResolvedValue(
      clientWithoutRun() as unknown as Awaited<
        ReturnType<typeof createServerSupabase>
      >,
    );
    vi.mocked(buildPayrollRows).mockResolvedValue({
      workMode: "shift",
      periodStatus: "open",
      rows: [PROVISIONAL_ROW],
    } as unknown as Awaited<ReturnType<typeof buildPayrollRows>>);

    const response = await GET(request(), params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("provisional");
    expect(body.closedAt).toBeNull();
    expect(body.days).toHaveLength(1);
    expect(body.days[0].dayTotal).toBe(500_000);
  });

  it("3. phạm vi employeeId LUÔN lấy từ phiên, không từ tham số", async () => {
    vi.mocked(createServerSupabase).mockResolvedValue(
      clientWithoutRun() as unknown as Awaited<
        ReturnType<typeof createServerSupabase>
      >,
    );
    vi.mocked(buildPayrollRows).mockResolvedValue({
      workMode: "shift",
      periodStatus: "open",
      rows: [PROVISIONAL_ROW],
    } as unknown as Awaited<ReturnType<typeof buildPayrollRows>>);

    await GET(request(), params());

    expect(buildPayrollRows).toHaveBeenCalledWith({
      companyId: "cty-01",
      month: "2026-08",
      employeeId: "nv-1",
    });
  });

  it("4. người chưa có dòng nào trong kỳ -> null, KHÔNG dò được lịch sử", async () => {
    vi.mocked(createServerSupabase).mockResolvedValue(
      clientWithoutRun() as unknown as Awaited<
        ReturnType<typeof createServerSupabase>
      >,
    );
    vi.mocked(buildPayrollRows).mockResolvedValue({
      workMode: "shift",
      periodStatus: "open",
      rows: [],
    } as unknown as Awaited<ReturnType<typeof buildPayrollRows>>);

    const response = await GET(request(), params());

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });
});
```

Bài "kỳ đã chốt đọc snapshot, không gọi `buildPayrollRows`" cần một client giả trả về `payroll_runs` có dòng — dựng thêm `clientWithRun()` theo đúng khuôn `clientWithoutRun()` (phân biệt bảng theo **tên bảng**, giống `twoTableClient()` trong `attendance-review.test.ts`), rồi khẳng định `expect(buildPayrollRows).not.toHaveBeenCalled()`.

- [ ] **Step 6: Chạy test, typecheck, commit**

```bash
pnpm vitest run src/lib/data
pnpm typecheck
git add src/lib/validation/api/payslips.ts src/app/api/payslips src/lib/types/domain.ts src/lib/data/payslips.ts src/lib/data/__tests__/payslips-provisional.test.ts
git commit -m "feat(payslip): API phiếu lương trả kỳ tạm tính kèm chi tiết ngày"
```

---

### Task 8: Màn hình phiếu lương của nhân viên

**Files:**
- Modify: `src/app/employee/payslips/payslips-view.tsx`
- Modify: `src/app/employee/payslips/[month]/payslip-detail-view.tsx`
- Create: `src/components/payroll/daily-pay-list.tsx`
- Modify: `src/lib/constants.ts` (nhãn)

**Interfaces:**
- Consumes: `payslipResponseSchema` từ Task 7.
- Produces: `DailyPayList` — dùng lại được ở màn hình quản trị (Task 10).

- [ ] **Step 1: Thêm nhãn vào `constants.ts`**

```ts
export const PAYSLIP_DAILY_LABEL = {
  sectionTitle: "Chi tiết theo ngày",
  sectionHint: "Tiền phát sinh của từng ngày. Phụ cấp và khấu trừ theo kỳ nằm ở phần trên.",
  provisionalBadge: "Tạm tính",
  provisionalBanner:
    "Số tạm tính. Con số có thể thay đổi cho tới khi doanh nghiệp chốt lương.",
  currentPeriodTitle: "Tháng này",
  inProgress: "Đang diễn ra",
  columnDate: "NGÀY",
  columnType: "LOẠI NGÀY",
  columnWorked: "GIỜ LÀM",
  columnOvertime: "TĂNG CA",
  columnAmount: "THÀNH TIỀN",
  totalRow: "Tổng các ngày",
  emptyTitle: "Chưa có ngày nào",
  emptyBody: "Ngày sẽ xuất hiện sau lần chấm công đầu tiên của kỳ.",
} as const;

export const DAY_TYPE_LABEL: Record<"weekday" | "weekend" | "holiday", string> = {
  weekday: "Ngày thường",
  weekend: "Cuối tuần",
  holiday: "Ngày lễ",
};
```

- [ ] **Step 2: Tạo `daily-pay-list.tsx`**

Component thuần trình bày, không tự nạp dữ liệu:

```tsx
"use client";

import * as React from "react";

import { DAY_TYPE_LABEL, PAYSLIP_DAILY_LABEL } from "@/lib/constants";
import { formatDate, formatNumber, formatVnd } from "@/lib/format";

/**
 * Danh sach tien theo NGAY. Dung o CA hai man hinh (nhan vien va quan tri) —
 * mot cach trinh bay duy nhat cho mot khai niem duy nhat.
 *
 * Component THUAN TRINH BAY: khong tu nap du lieu, khong tinh lai con so nao.
 */
export interface DailyPayListItem {
  date: string;
  dayType: "weekday" | "weekend" | "holiday";
  state: "counted" | "in_progress" | "leave_paid" | "leave_unpaid";
  regularMinutes: number | null;
  overtimeMinutes: number;
  dayTotal: number | null;
}

export function DailyPayList({
  days,
}: {
  days: readonly DailyPayListItem[];
}): React.ReactElement {
  // Ngay dang do KHONG gop vao tong — cung quy tac voi `sumDailyPay()`.
  const total = days.reduce((sum, day) => sum + (day.dayTotal ?? 0), 0);

  return (
    <section className="surface-card overflow-hidden">
      <header className="border-b border-hairline px-4 py-3">
        <h2 className="text-[14px] font-medium text-ink">
          {PAYSLIP_DAILY_LABEL.sectionTitle}
        </h2>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          {PAYSLIP_DAILY_LABEL.sectionHint}
        </p>
      </header>

      <ul className="divide-y divide-hairline">
        {days.map((day) => (
          <li key={day.date} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="num text-[13px] text-ink">{formatDate(day.date)}</p>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                {DAY_TYPE_LABEL[day.dayType]}
                {day.regularMinutes !== null && day.regularMinutes > 0
                  ? ` · ${formatNumber(day.regularMinutes / 60)} giờ`
                  : ""}
                {day.overtimeMinutes > 0
                  ? ` · TC ${formatNumber(day.overtimeMinutes / 60)} giờ`
                  : ""}
              </p>
            </div>
            <span className="num shrink-0 text-[14px] font-medium text-ink">
              {day.state === "in_progress" ? (
                <span className="text-[12px] font-normal text-ink-muted">
                  {PAYSLIP_DAILY_LABEL.inProgress}
                </span>
              ) : day.dayTotal === null ? (
                "—"
              ) : (
                formatVnd(day.dayTotal)
              )}
            </span>
          </li>
        ))}
      </ul>

      <footer className="flex items-center justify-between border-t border-hairline bg-canvas-soft px-4 py-2.5">
        <span className="text-[13px] font-medium text-ink">
          {PAYSLIP_DAILY_LABEL.totalRow}
        </span>
        <span className="num text-[14px] font-semibold text-ink">
          {formatVnd(total)}
        </span>
      </footer>
    </section>
  );
}
```

- [ ] **Step 3: Gắn vào trang chi tiết**

Trong `payslip-detail-view.tsx`, thêm dải cảnh báo ngay dưới tiêu đề trang:

```tsx
      {data.status === "provisional" ? (
        <div
          role="status"
          className="rounded-card border border-warning-border bg-warning-wash px-4 py-3 text-[13px] text-ink-secondary"
        >
          {PAYSLIP_DAILY_LABEL.provisionalBanner}
        </div>
      ) : null}
```

và bảng ngày ngay dưới khối tiền:

```tsx
      <DailyPayList days={data.days} />
```

*(Tên token màu cảnh báo phải lấy từ `src/app/globals.css` — dùng đúng tên đang có, đừng chế token mới. Nếu chưa có bộ `warning-*`, dùng bộ token mà `AttendanceReviewView` đang dùng cho dòng "Chờ xem xét".)*

- [ ] **Step 4: Gắn mục "Tháng này" vào danh sách**

Trong `payslips-view.tsx`, thay khối bên trong `<Link>`:

```tsx
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-medium text-ink">
                        {payslip.status === "provisional"
                          ? PAYSLIP_DAILY_LABEL.currentPeriodTitle
                          : formatMonthLabel(payslip.month)}
                      </p>
                      {payslip.status === "provisional" ? (
                        <span className="rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-medium text-brand">
                          {PAYSLIP_DAILY_LABEL.provisionalBadge}
                        </span>
                      ) : null}
                    </div>
                    <p className="num mt-0.5 text-[12px] text-ink-muted">
                      {payslip.closedAt === null
                        ? formatMonthLabel(payslip.month)
                        : `Chốt ${formatDateTime(payslip.closedAt)}`}
                    </p>
                  </div>
                  <span className="num shrink-0 text-[15px] font-semibold text-ink">
                    {/* Chua khai muc luong -> khong hien mot so 0 nao. */}
                    {payslip.netPay === null ? "—" : formatVnd(payslip.netPay)}
                  </span>
```

Cập nhật `EmptyState`: khi danh sách rỗng thì cả kỳ tạm tính cũng không có, nên giữ nguyên nội dung hiện tại.

- [ ] **Step 5: Kiểm bằng trình duyệt**

Đăng nhập tài khoản nhân viên, mở `/employee/payslips`.
Expected: mục "Tháng này · Tạm tính" ở đầu; bấm vào thấy dải cảnh báo + danh sách ngày; ngày chưa chấm ra hiện "Đang diễn ra".

- [ ] **Step 6: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/app/employee/payslips src/components/payroll/daily-pay-list.tsx src/lib/constants.ts
git commit -m "feat(employee): phiếu lương hiện tạm tính kỳ này và chi tiết theo ngày"
```

---

### Task 9: `/api/payroll/summary` mang mảng ngày

**Files:**
- Modify: `src/app/api/payroll/summary/route.ts:186-235`
- Modify: `src/lib/validation/api/payroll.ts` (`payrollPrepRowSchema`)

**Interfaces:**
- Produces: mỗi phần tử `rows` có thêm `days: PayslipDay[]` ở **cả hai** nhánh.

- [ ] **Step 1: Thêm `days` vào `payrollPrepRowSchema`**

```ts
  /**
   * CHI TIET THEO NGAY. Co mat o CA HAI nhanh — ky da chot doc tu
   * `payroll_line_days`, ky chua chot lay tu ket qua tinh. Mot hop dong cho ca
   * hai, de man hinh khong phai biet minh dang xem ky nao.
   */
  days: z.array(payslipDaySchema),
```

- [ ] **Step 2: Nhánh đã chốt đọc `payroll_line_days`**

Sau khi đọc xong `payroll_lines` (biến `lines`), thêm:

```ts
      // MOT truy van cho ca ban chot, loc theo `line_id` — KHONG keo ca doanh
      // nghiep ve roi loc trong JS, va KHONG hoi tung dong mot. Ban chot lon
      // dan theo tung ky.
      const lineIds = lines.map((line) => line.id);
      const { data: dayData, error: dayError } = await supabase
        .from("payroll_line_days")
        .select(
          "line_id, work_date, day_type, regular_minutes, overtime_minutes, " +
            "base_pay, overtime_pay, hour_adjustment, day_total",
        )
        .eq("company_id", companyId)
        .in("line_id", lineIds)
        .order("work_date", { ascending: true });

      if (dayError) {
        return NextResponse.json(
          { error: "Không thể tải chi tiết theo ngày." },
          { status: 500 },
        );
      }

      const daysByLineId = new Map<string, PayslipDay[]>();
      for (const raw of (dayData ?? []) as unknown as RawDayRow[]) {
        const list = daysByLineId.get(raw.line_id) ?? [];
        list.push({
          date: raw.work_date,
          dayType: raw.day_type,
          // Ban chot chi ghi ngay DA CO CON SO — ngay dang do khong bao gio
          // toi duoc day (xem `closePayroll`). Nen `state` luon la `counted`.
          state: "counted",
          regularMinutes: raw.regular_minutes,
          overtimeMinutes: raw.overtime_minutes,
          basePay: Number(raw.base_pay),
          overtimePay: Number(raw.overtime_pay),
          hourAdjustment: Number(raw.hour_adjustment),
          dayTotal: Number(raw.day_total),
        });
        daysByLineId.set(raw.line_id, list);
      }
```

rồi gắn `days: daysByLineId.get(line.id) ?? []` vào mỗi hàng khi dựng `rows`.

Kiểu thô đi kèm:

```ts
interface RawDayRow {
  line_id: string;
  work_date: string;
  day_type: "weekday" | "weekend" | "holiday";
  regular_minutes: number;
  overtime_minutes: number;
  base_pay: string | number;
  overtime_pay: string | number;
  hour_adjustment: string | number;
  day_total: string | number;
}
```

- [ ] **Step 3: Nhánh chưa chốt**

`buildPayrollRows()` đã trả `days` từ Task 3 — không cần làm gì thêm ngoài việc để nó đi qua schema.

- [ ] **Step 4: Chạy test + kiểm trình duyệt**

Run: `pnpm vitest run src/lib/data && pnpm typecheck`
Mở `/admin/payroll` — phản hồi phải có `days`, màn hình chưa dùng tới nên không được vỡ.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/payroll/summary/route.ts src/lib/validation/api/payroll.ts
git commit -m "feat(payroll): API bảng lương mang theo chi tiết ngày ở cả hai nhánh"
```

---

### Task 10: Bảng ngày ở màn hình quản trị + tách file

**Files:**
- Create: `src/app/admin/payroll/payroll-row-detail.tsx`
- Modify: `src/app/admin/payroll/payroll-view.tsx` (bỏ `PayrollRowDetail` và `DetailRow`, import từ file mới)

**Interfaces:**
- Consumes: `DailyPayList` từ Task 8, `PayrollPrepRow.days` từ Task 3.
- Produces: `PayrollRowDetail` xuất từ `@/app/admin/payroll/payroll-row-detail`.

- [ ] **Step 1: Tách `PayrollRowDetail` sang file mới**

Chuyển **nguyên văn** `PayrollRowDetail`, `DetailRow`, `describeBasis` (dòng 240-430 của `payroll-view.tsx`) sang `payroll-row-detail.tsx`, kèm khối comment của chúng. Thêm `export` cho `PayrollRowDetail`.

**Chỉ di chuyển, không sửa logic ở bước này** — để bước sau chỉ còn đúng một thay đổi cần đọc.

- [ ] **Step 2: Chạy typecheck để xác nhận việc tách không đổi hành vi**

Run: `pnpm typecheck && pnpm lint`
Expected: sạch. Mở `/admin/payroll`, mở một dòng — hiển thị y hệt trước.

- [ ] **Step 3: Commit riêng bước tách**

```bash
git add src/app/admin/payroll
git commit -m "refactor(payroll): tách PayrollRowDetail khỏi payroll-view"
```

- [ ] **Step 4: Thêm bảng ngày**

Trong `payroll-row-detail.tsx`, sau lưới 3 cột, thêm:

```tsx
      {/* CHI TIET THEO NGAY — trai het chieu ngang duoi ba cot.
          Tong o day phai khop DUNG (Luong goc + Tang ca + Lech gio) o cot ben
          tren; neu hai con so lech nhau thi mot trong hai duong dang sai, va
          bang nay chinh la cho phat hien ra dieu do. */}
      {row.days.length > 0 ? (
        <div className="md:col-span-3">
          <DailyPayList days={row.days} />
        </div>
      ) : null}
```

- [ ] **Step 5: Kiểm bằng trình duyệt**

Mở `/admin/payroll`, mở một dòng có dữ liệu chấm công.
Expected: bảng ngày hiện dưới ba cột; tổng của bảng ngày **bằng đúng** `Lương gốc + Tăng ca + Lệch giờ` ở cột trái. Kiểm cả kỳ đã chốt và kỳ chưa chốt.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
pnpm vitest run
git add src/app/admin/payroll
git commit -m "feat(admin): bảng lương mở rộng hiện chi tiết theo ngày"
```

---

## Kiểm cuối

- [ ] `pnpm vitest run` — toàn bộ xanh
- [ ] `pnpm typecheck` — sạch
- [ ] `pnpm lint` — không lỗi mới
- [ ] Trình duyệt: `/employee/payslips` (kỳ mở + kỳ chốt), `/admin/payroll` (kỳ mở + kỳ chốt)
- [ ] Chốt lương một kỳ thử → kiểm `payroll_line_days` có dòng; huỷ chốt → kiểm đã xoá sạch
- [ ] Tài khoản có `can_view_payslip = false` → `/employee/payslips` trả 403, không lộ số nào
