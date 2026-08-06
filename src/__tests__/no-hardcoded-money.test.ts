import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  MONEY_SCAN_EXEMPTIONS,
  isMoneyScanExempt,
  moneyRuleFix,
  scanMoneySource,
} from "@/__tests__/lib/money-scan";

/**
 * CONG CHAN "KHONG CON SO TIEN NAO NHUNG CUNG" (Phase 5.2, plan 05-2-06).
 *
 * Nam plan truoc moi plan co grep gate rieng trong acceptance criteria, nhung
 * acceptance criteria chi chay MOT LAN luc thuc thi plan do. Cong nay la thu
 * DUY NHAT cua Phase 5.2 con song sau khi phase ket thuc.
 *
 * Dieu de mat nhat cua phase la MOT MAU SO DU PHONG TIEN TAY — mot `?? 22` o
 * dau do trong mot plan tuong lai, va tu do moi doanh nghiep chua khai mau so
 * bong co luong tinh bang mot con so khong ai chon.
 *
 * Ba dieu bi chan:
 *   1. mau so quy doi du phong (`?? 8`, `|| 26` tren dong noi ve mau so/don gia);
 *   2. mot so tien nhung cung (>= 1000 trong mot phep tinh voi `amount`/`pay`/…);
 *   3. mot ti le phan tram nhung cung tren dong noi ve phu cap/khau tru.
 */

const ROOT = process.cwd();

/**
 * Pham vi quet: cac module THUC SU RA TIEN.
 *
 * Hep hon `no-hardcoded-work-rules` co chu dich — mot cong quet ca `src/` se
 * bat nham hang loat con so dinh dang o tang giao dien, va ap luc noi long no
 * se lam chinh quy tac bi bao mon. O day quet dung nhung noi ma mot con so
 * nhung cung se di THANG vao mot bang luong.
 */
const SCAN_TARGETS = [
  path.join("src", "lib", "payroll"),
  path.join("src", "lib", "attendance", "work-mode.ts"),
  path.join("src", "lib", "attendance", "classification-context.ts"),
  path.join("src", "lib", "data", "mutations", "payroll.ts"),
  path.join("src", "lib", "data", "mutations", "pay-rates.ts"),
  path.join("src", "lib", "data", "mutations", "pay-adjustments.ts"),
  path.join("src", "app", "api", "payroll"),
];

const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

function collectFiles(target: string): string[] {
  const full = path.join(ROOT, target);
  const stats = statSync(full);
  if (stats.isFile()) return [target];

  const results: string[] = [];
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const relative = path.join(target, entry.name);
    if (entry.isDirectory()) {
      // Test cua chinh du an duoc phep chua mau vi pham: chung la du lieu doi
      // chieu (mot phep tinh tay ghi san), khong phai quy tac chay that.
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      results.push(...collectFiles(relative));
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(relative);
    }
  }
  return results;
}

const files = SCAN_TARGETS.flatMap(collectFiles).filter(
  (file) => !isMoneyScanExempt(file),
);

describe("no-hardcoded-money (Phase 5.2)", () => {
  it("quet duoc it nhat 6 file — mot cong dem 0 file khong phai bang chung khong vi pham", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it("danh sach mien tru toi da 3 muc, va moi muc co ly do", () => {
    expect(MONEY_SCAN_EXEMPTIONS.length).toBeLessThanOrEqual(3);
    for (const item of MONEY_SCAN_EXEMPTIONS) {
      expect(item.reason.length).toBeGreaterThan(20);
    }
  });

  it("khong file nao mang con so tien hay mau so quy doi nhung cung", () => {
    const failures: string[] = [];

    for (const file of files) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      for (const violation of scanMoneySource(source)) {
        failures.push(
          `${file}:${violation.line} [${violation.rule}] ${violation.text}\n` +
            `  -> ${moneyRuleFix(violation.rule)}`,
        );
      }
    }

    expect(failures.join("\n")).toBe("");
  });

  /* ---------------------------------------------------------------------- */
  /* CONG CO RANG: ba mau vi pham gia lap phai bi bat                        */
  /* ---------------------------------------------------------------------- */

  it("CO RANG 1: mau so quy doi du phong bi bat", () => {
    // Day la CHINH XAC dong ma buoc kiem rang cua plan them tam vao `rate.ts`.
    const violating = `
      const daily = amount / (standardDaysPerMonth ?? 22);
    `;
    expect(scanMoneySource(violating)).not.toHaveLength(0);
  });

  it("CO RANG 2: mot so tien nhung cung bi bat", () => {
    const violating = `
      const netPay = basePay + 500000;
    `;
    expect(scanMoneySource(violating)).not.toHaveLength(0);
  });

  it("CO RANG 3: mot ti le khau tru nhung cung bi bat", () => {
    const violating = `
      const deductionAmount = dailyRate * 0.105;
    `;
    expect(scanMoneySource(violating)).not.toHaveLength(0);
  });

  it("CO RANG 4: `|| 8` cho so gio chuan cung bi bat", () => {
    const violating = `
      const hoursPerDay = standardHoursPerDay || 8;
    `;
    expect(scanMoneySource(violating)).not.toHaveLength(0);
  });

  /* ---------------------------------------------------------------------- */
  /* KHONG BAT NHAM                                                          */
  /* ---------------------------------------------------------------------- */

  it("KHONG BAT NHAM: comment giai thich quy tac va chuoi hien thi khong bi coi la vi pham", () => {
    const legitimate = `
      // Khong duoc lui ve 8 gio hay 22 ngay o day — mau so phai den tu cau hinh.
      /* Vi du: standardDaysPerMonth ?? 26 la dieu CAM. */
      const label = "Vi du: 26 ngay cong chuan";
      const step = "1000";
    `;
    expect(scanMoneySource(legitimate)).toHaveLength(0);
  });

  it("KHONG BAT NHAM: phep lam tron hai chu so va quy doi phan tram cua NGUOI DUNG khai", () => {
    const legitimate = `
      const hours = Math.round((weighted / 60) * 100) / 100;
      const unitValue = (adjustment.value / 100) * dailyRate;
    `;
    expect(scanMoneySource(legitimate)).toHaveLength(0);
  });

  it("KHONG BAT NHAM: `?? null` va `?? 0` cho mot so PHUT la hop le", () => {
    const legitimate = `
      const standardHoursPerDay = settings.standardHoursPerDay ?? null;
      const hourDeltaMinutes = summary.hourDeltaMinutes ?? 0;
    `;
    expect(scanMoneySource(legitimate)).toHaveLength(0);
  });
});
