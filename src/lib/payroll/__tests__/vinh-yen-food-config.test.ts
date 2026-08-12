import { describe, expect, it } from "vitest";

import { resolveDayCredit } from "@/lib/attendance/work-mode";
import { computePayrollLine } from "@/lib/payroll/compute";

/**
 * GHIM PHEP TINH TIEN CUA MOT DOANH NGHIEP THAT.
 *
 * Vinh Yen Food (`cty-vinhyen`) chay tren mot to hop cau hinh ma khong bo test
 * nao khac cham toi ca ba manh cung luc:
 *
 *   work_mode = 'daily_hours'  +  muc luong unit = 'day'  +  tang ca
 *   value_type = 'fixed_hourly'  +  overtime_rules CUA DOANH NGHIEP BO TRONG
 *
 * Manh thu tu la thu de vo nhat: he so tang ca theo loai ngay bo trong la HOP
 * LE o day, vi muc tang ca rieng cua tung nguoi thay cho toan bo he so do
 * (`compute-daily.ts`). Mot thay doi lam `missing` co them phan tu se khong
 * lam sai con so nao — no chi lam bang luong hien "chua khai" ben canh nhung
 * con so hoan toan dung, va khong ai o day biet do la bao dong gia.
 *
 * Cac con so duoi day den tu ban thiet ke da duoc chu doanh nghiep duyet:
 * docs/superpowers/specs/2026-08-13-du-lieu-vinh-yen-food-design.md
 *
 * Module thuan — khong cham database. Du lieu that nam o
 * `scripts/seed-vinh-yen-food.mjs`.
 */

const STANDARD_HOURS = 9.5;

function dayOf(workedMinutes: number) {
  const credit = resolveDayCredit({
    day: { workedMinutes, status: "on_time" },
    dayType: "weekday",
    mode: "daily_hours",
    shift: { scheduledMinutes: 570 },
    standardHoursPerDay: STANDARD_HOURS,
  });
  return {
    date: "2026-08-10",
    status: "on_time" as const,
    hasOpenPunch: false,
    credit,
    classification: {
      dayType: "weekday" as const,
      nightMinutes: 0,
      overtimeMinutes: credit.overtimeMinutes ?? 0,
      overtimeNightMinutes: 0,
      // `null` va khoa `weekday` con thieu — dung trang thai that cua doanh
      // nghiep nay: `overtime_rules` bo trong (D-26). Day chinh la dieu kien
      // ma muc tang ca rieng phai vuot qua duoc.
      convertedOvertimeHours: null,
      missingMultiplierKeys: ["weekday" as const],
      punches: [],
      workModeInputMissing: false,
    },
  };
}

function payFor(dayRate: number, workedMinutes: number) {
  return computePayrollLine({
    summary: { lateCount: 0 },
    days: [dayOf(workedMinutes)],
    payRate: { unit: "day", amount: dayRate },
    overtimeRate: { valueType: "fixed_hourly", value: 40000 },
    workMode: "daily_hours",
    standardDaysPerMonth: null,
    standardHoursPerDay: STANDARD_HOURS,
    adjustments: [],
    employee: { id: "nv-vinhyen-nv001", departmentId: null, position: null },
  });
}

describe("Vinh Yen Food — cau hinh that", () => {
  it("Nguyen Thi Hien 250k: 9,5 tieng = 250.000, khong tang ca", () => {
    const line = payFor(250000, 570);
    expect(line.missing).toEqual([]);
    expect(line.basePay).toBe(250000);
    expect(line.overtimePay).toBe(0);
    expect(line.netPay).toBe(250000);
  });

  it("Nguyen Thi Hien 250k: 11 tieng = 250.000 + 60.000 tang ca", () => {
    const line = payFor(250000, 660);
    expect(line.basePay).toBe(250000);
    expect(line.overtimePay).toBe(60000);
    expect(line.netPay).toBe(310000);
  });

  it("Nguyen Thi Hien 250k: 8 tieng = 210.526 (tru theo ti le gio)", () => {
    const line = payFor(250000, 480);
    expect(line.basePay).toBe(210526);
    expect(line.overtimePay).toBe(0);
  });

  it("Duong Van Hung 200k: 9,5 tieng = 200.000", () => {
    expect(payFor(200000, 570).basePay).toBe(200000);
  });

  it("Nguyen Van Thai 300k: 12 tieng = 300.000 + 100.000", () => {
    const line = payFor(300000, 720);
    expect(line.basePay).toBe(300000);
    expect(line.overtimePay).toBe(100000);
    expect(line.netPay).toBe(400000);
  });

  it("he so tang ca doanh nghiep con trong KHONG chan tien cua nguoi co muc rieng", () => {
    expect(payFor(250000, 660).missing).toEqual([]);
  });
});
