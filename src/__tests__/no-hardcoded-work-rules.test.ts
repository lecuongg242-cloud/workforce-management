import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  SCAN_EXEMPTIONS,
  isExempt,
  scanWorkRuleSource,
  stripCommentsAndStrings,
} from "@/__tests__/lib/work-rule-scan";

/**
 * CONG CHAN "KHONG CON SO NGHIEP VU NAO TRONG MA NGUON" (Phase 4, plan 04-06).
 *
 * Bon plan truoc moi plan co grep gate rieng trong acceptance criteria, nhung
 * acceptance criteria chi chay MOT LAN luc thuc thi plan do. Sau nay ai do sua
 * voi se viet `* 1.5` vao mot cho nao do va khong gi bao dong. Cong nay la thu
 * DUY NHAT cua Phase 4 con song sau khi phase ket thuc.
 *
 * Bon dieu bi chan:
 *   1. he so tang ca nhung cung (mot con so nhan/cong voi gio hoac phut);
 *   2. doc thang hai hang so nguong cua Phase 3 ngoai module so huu (D-29);
 *   3. he so mac dinh ngam (`?? 1`, `|| 1.5`) — D-26 cam;
 *   4. chen san ngay le vao seed/migration — bang `holidays` co y de rong.
 */

const ROOT = process.cwd();

const SCAN_TARGETS = [
  path.join("src"),
  path.join("supabase", "seed.sql"),
  path.join("supabase", "migrations"),
];

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".sql"]);

function collectFiles(target: string): string[] {
  const full = path.join(ROOT, target);
  const stats = statSync(full);
  if (stats.isFile()) return [target];

  const results: string[] = [];
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const relative = path.join(target, entry.name);
    if (entry.isDirectory()) {
      // Test cua chinh du an duoc phep chua mau vi pham (chung la du lieu
      // doi chieu, khong phai quy tac chay that).
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      results.push(...collectFiles(relative));
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(relative);
    }
  }
  return results;
}

const files = SCAN_TARGETS.flatMap(collectFiles).filter((file) => !isExempt(file));

describe("no-hardcoded-work-rules (Phase 4)", () => {
  it("quet duoc it nhat 50 file — mot cong dem 0 file khong phai bang chung khong vi pham", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("danh sach mien tru la tuong minh, moi muc co ly do, va khong qua 5 muc", () => {
    expect(SCAN_EXEMPTIONS.length).toBeLessThanOrEqual(5);
    for (const item of SCAN_EXEMPTIONS) {
      expect(item.reason.length).toBeGreaterThan(20);
    }
  });

  it("khong file nao mang con so nghiep vu nhung cung", () => {
    const failures: string[] = [];

    for (const file of files) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      for (const violation of scanWorkRuleSource(source)) {
        failures.push(
          `${file}:${violation.line} [${violation.rule}] ${violation.text}\n` +
            "  -> Cach sua dung: doc gia tri tu cau hinh doanh nghiep " +
            "(company_settings / overtime_rules / holidays), khong nhung con so vao ma.",
        );
      }
    }

    expect(failures.join("\n")).toBe("");
  });

  /* ---------------------------------------------------------------------- */
  /* CONG CO RANG: bon mau vi pham gia lap phai bi bat                       */
  /* ---------------------------------------------------------------------- */

  it("CO RANG 1: he so tang ca nhung cung bi bat", () => {
    const violating = `
      const convertedMinutes = overtimeMinutes * 1.5;
    `;
    expect(scanWorkRuleSource(violating)).not.toHaveLength(0);
  });

  it("CO RANG 2: doc thang hang so nguong ngoai module so huu bi bat", () => {
    const violating = `
      import { SUSPICIOUS_DISTANCE_MULTIPLIER } from "@/lib/attendance/suspicious";
    `;
    expect(scanWorkRuleSource(violating)).not.toHaveLength(0);
  });

  it("CO RANG 3: he so mac dinh ngam bi bat", () => {
    const violating = `
      const dayMultiplier = multipliers.holiday ?? 1;
    `;
    expect(scanWorkRuleSource(violating)).not.toHaveLength(0);
  });

  it("CO RANG 4: chen san ngay le vao seed bi bat", () => {
    const violating = `
      insert into holidays (company_id, holiday_date, name) values ('cty-01', '2026-09-02', 'X');
    `;
    expect(scanWorkRuleSource(violating)).not.toHaveLength(0);
  });

  it("KHONG BAT NHAM: comment giai thich quy tac va chuoi hien thi khong bi coi la vi pham", () => {
    const legitimate = `
      // Khong duoc dien 1.5 / 2.0 / 3.0 vao day — he so phai den tu cau hinh.
      /* Vi du: overtimeMinutes * 1.5 la dieu CAM. */
      const label = "Vi du: he so 1.5 cho ngay thuong";
      const className = "space-y-1.5";
      const step = 0.05;
    `;
    expect(scanWorkRuleSource(legitimate)).toHaveLength(0);
  });

  it("stripCommentsAndStrings giu dung so dong de bao cao chi dung vi tri", () => {
    const source = "const a = 1;\n// comment\nconst b = 2;";
    expect(stripCommentsAndStrings(source)).toHaveLength(3);
  });
});
