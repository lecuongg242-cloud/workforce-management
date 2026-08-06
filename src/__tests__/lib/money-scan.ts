import { stripCommentsAndStrings } from "@/__tests__/lib/work-rule-scan";

/**
 * Bo quet "KHONG CON SO TIEN NAO NHUNG CUNG" (Phase 5.2, plan 05-2-06).
 *
 * Tach ra khoi file test de chinh no kiem duoc BANG MOT MAU VI PHAM GIA LAP —
 * cung khuon `work-rule-scan.ts` (04-06) va `period-write-scan.ts` (05-06).
 *
 * ======================================================================
 * VI SAO CONG NAY TON TAI RIENG, KHI DA CO `no-hardcoded-work-rules`
 * ======================================================================
 *
 * Cong 04-06 canh he so tang ca va nguong van hanh. No khong nhin thay dieu de
 * mat nhat cua Phase 5.2: MOT MAU SO DU PHONG TIEN TAY.
 *
 * `standardDaysPerMonth ?? 22` la mot dong ma khong ai doc lai se thay co gi
 * sai — 22 la mot con so hop ly, va no lam mot bug bien mat ("sao doanh nghiep
 * nay khong ra luong?"). Nhung tu do tro di, MOI doanh nghiep chua khai mau so
 * co luong tinh bang mot con so ma khong ai chon — va bang luong khong bao
 * loi, no chi don gian la khac di.
 *
 * Do la dung loai sai lang le ma D-26 ton tai de chan, va o day no ra TIEN.
 *
 * QUET TREN MA DA BO COMMENT VA NOI DUNG CHUOI: toan bo Phase 5.2 giai thich
 * quy tac bang comment tieng Viet, trong do co CA nhung con so bi cam
 * ("khong duoc lui ve 8 gio o day"). Quet ca comment se bao do chinh nhung
 * dong dang bao ve quy tac.
 */

export interface MoneyViolation {
  line: number;
  text: string;
  rule: string;
}

interface MoneyRule {
  name: string;
  pattern: RegExp;
  /** Dong phai chua it nhat mot trong cac tu nay (khong phan biet hoa thuong). */
  requiresAny?: string[];
  /** Dong CO chua mot trong cac tu nay thi bo qua. */
  forbidsAny?: string[];
  /** Cau noi CACH SUA DUNG, in ra kem dong vi pham. */
  fix: string;
}

/**
 * Ba quy tac. Moi mau deu doi mot NGU CANH TINH TOAN, khong chi mot con so:
 * `100` trong `Math.round(x * 100) / 100` la mot phep lam tron hai chu so, va
 * `1000` trong `step="1000"` la buoc nhay cua mot o nhap lieu.
 */
const RULES: MoneyRule[] = [
  {
    name: "mau-so-quy-doi-du-phong",
    // `?? 8` / `|| 26` tren mot dong dang noi ve MAU SO hoac DON GIA.
    pattern: /(?:\?\?|\|\|)\s*(?:\d+(?:\.\d+)?)\b/,
    requiresAny: [
      "standarddays",
      "standardhours",
      "dailyrate",
      "hourlyrate",
      "perday",
      "permonth",
    ],
    // `?? null` khong khop mau (mau doi mot CHU SO), nhung `?? 0` cho mot so
    // PHUT thi co — va mot so phut mac dinh 0 la hop le. Danh sach nay tach
    // dai luong khac loai ra khoi mau, cung ky thuat voi `forbidsAny` cua
    // 04-06.
    forbidsAny: ["minutes", "hours ", "count"],
    fix:
      "Mau so quy doi phai den tu `company_settings` (D-38). Thieu mau so thi tra `null` kem khoa thieu, khong lui ve mot con so.",
  },
  {
    name: "so-tien-nhung-cung",
    // Mot so >= 1000 nhan/cong/tru voi mot dai luong mang ten tien.
    pattern:
      /(?:amount|pay|salary|wage|Amount|Pay|Salary|Wage)\w*\s*(?:\*|\+|-)\s*\d{4,}\b|(?:\*|\+|-)\s*\d{4,}\s*(?![\w.])(?=[^\n]*(?:amount|pay|salary|wage|Amount|Pay|Salary|Wage))/,
    fix:
      "So tien phai den tu `employee_pay_rates` hoac `pay_adjustments` — doanh nghiep tu khai, he thong khong dat gia.",
  },
  {
    name: "ti-le-khau-tru-nhung-cung",
    // Mot phep chia cho 100 hoac nhan voi mot ti le, tren dong noi ve khoan.
    pattern: /\d+(?:\.\d+)?\s*\/\s*100\b|\*\s*0\.\d+/,
    requiresAny: [
      "allowance",
      "deduction",
      "adjustment",
      "penalty",
      "percent",
    ],
    // `adjustment.value / 100` la phep quy doi mot ti le NGUOI DUNG KHAI —
    // con so `100` o do la don vi cua phan tram, khong phai mot ti le cai san.
    forbidsAny: [".value", "value /"],
    fix:
      "Ti le phu cap/khau tru phai den tu `pay_adjustments.value` — khong nhung mot ti le vao ma.",
  },
];

/**
 * Duong dan duoc mien, kem LY DO — toi da 3 muc (acceptance criteria 05-2-06).
 *
 * Danh sach nay CO Y de rong. Mot mien tru duong dan lam MU TOAN BO file do ve
 * sau: mot mau so du phong them vao file duoc mien nam sau se khong ai thay.
 * Khi cong bat nham mot dong hop le, cach sua dung la thu hep quy tac bang
 * NGU NGHIA (`requiresAny`/`forbidsAny`) va ghi ly do ngay trong ma — khong
 * phai mien tru ca file.
 */
export const MONEY_SCAN_EXEMPTIONS: Array<{ prefix: string; reason: string }> = [];

export function isMoneyScanExempt(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return MONEY_SCAN_EXEMPTIONS.some((item) => normalized.startsWith(item.prefix));
}

/** Cau "cach sua dung" cua mot quy tac — in ra kem dong vi pham. */
export function moneyRuleFix(ruleName: string): string {
  return RULES.find((rule) => rule.name === ruleName)?.fix ?? "";
}

/** Quet mot file; tra ve cac dong vi pham (da bo comment va noi dung chuoi). */
export function scanMoneySource(source: string): MoneyViolation[] {
  const lines = stripCommentsAndStrings(source);
  const violations: MoneyViolation[] = [];

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    for (const rule of RULES) {
      if (rule.requiresAny && !rule.requiresAny.some((word) => lower.includes(word))) {
        continue;
      }
      if (rule.forbidsAny && rule.forbidsAny.some((word) => lower.includes(word))) {
        continue;
      }
      if (rule.pattern.test(line)) {
        violations.push({ line: index + 1, text: line.trim(), rule: rule.name });
      }
    }
  });

  return violations;
}
