/**
 * Bo quet "khong con so nghiep vu nao trong ma nguon" (Phase 4, plan 04-06).
 *
 * Tach ra khoi file test de chinh no kiem duoc BANG MOT MAU VI PHAM GIA LAP —
 * mot cong chua tung bao do la mot cong chua duoc chung minh la con thuc
 * (cung khuon `route-handler-check.ts` cua 02-04).
 *
 * QUET TREN MA DA BO COMMENT: toan bo Phase 4 giai thich quy tac bang comment
 * tieng Viet, trong do co CA nhung con so bi cam ("khong duoc dien 1.5/2.0/3.0
 * o day"). Quet ca comment se bao do chinh nhung dong dang bao ve quy tac.
 */

export interface WorkRuleViolation {
  line: number;
  text: string;
  rule: string;
}

/** Bo comment (`//`, `/* *\/`) va noi dung chuoi de chi con ma thuc thi. */
export function stripCommentsAndStrings(source: string): string[] {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  let inBlockComment = false;

  for (const raw of lines) {
    let line = raw;

    if (inBlockComment) {
      const end = line.indexOf("*/");
      if (end === -1) {
        output.push("");
        continue;
      }
      line = line.slice(end + 2);
      inBlockComment = false;
    }

    // Khoi comment mo va (co the) dong ngay trong cung dong.
    for (;;) {
      const start = line.indexOf("/*");
      if (start === -1) break;
      const end = line.indexOf("*/", start + 2);
      if (end === -1) {
        line = line.slice(0, start);
        inBlockComment = true;
        break;
      }
      line = line.slice(0, start) + " " + line.slice(end + 2);
    }

    const lineComment = line.indexOf("//");
    if (lineComment !== -1) line = line.slice(0, lineComment);

    // Noi dung chuoi bi thay bang chuoi rong: nhan hien thi khong phai ma
    // (vi du mot vi du trong chu tro giup cua form).
    line = line.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, "''");

    output.push(line);
  }

  return output;
}

interface ScanRule {
  name: string;
  pattern: RegExp;
  /**
   * Dieu kien phu: dong phai chua it nhat mot trong cac tu nay (khong phan
   * biet hoa thuong). Dung khi ban than mau qua chung de dung mot minh — vi du
   * `?? 1` chi dang ngo khi dong do noi ve mot HE SO.
   */
  requiresAny?: string[];
  /**
   * Nguoc lai voi `requiresAny`: dong CO chua mot trong cac tu nay thi bo qua.
   * Dung de tach mot dai luong KHAC LOAI ra khoi mau — vi du `?? 0` cho mot so
   * PHUT la hop le, chi `?? 1` cho mot HE SO moi la sai (D-26).
   */
  forbidsAny?: string[];
}

/**
 * Bon quy tac. Moi mau deu doi mot NGU CANH TINH TOAN, khong chi mot con so:
 * `2.0` trong `space-y-2.0` hay `step="0.05"` khong phai he so tang ca.
 */
const RULES: ScanRule[] = [
  {
    name: "he-so-tang-ca-nhung-cung",
    // Mot con so nhan/cong voi mot dai luong mang ten gio/phut/tang ca.
    pattern:
      /(?:\*|\+)\s*(?:1\.\d+|[23]\.0+|[123])\s*(?![\w.])(?=[^\n]*(?:overtime|Overtime|minutes|Minutes|hours|Hours))|(?:overtime|Overtime|minutes|Minutes|hours|Hours)\w*\s*(?:\*|\+)\s*(?:1\.\d+|[23]\.0+)\b/,
  },
  {
    name: "nguong-dang-ngo-nhung-cung",
    // Doc thang hang so mac dinh o ngoai module so huu.
    pattern: /\bSUSPICIOUS_DISTANCE_MULTIPLIER\b|\bSHIFT_WINDOW_GRACE_MINUTES\b/,
  },
  {
    name: "he-so-mac-dinh-ngam",
    // `?? 1` / `|| 1` / `?? 1.5` tren mot dong dang noi ve HE SO. Kiem theo CA
    // DONG (khong theo bien lien ke) vi `multipliers.holiday ?? 1` co token
    // ngay truoc toan tu la `holiday`, khong phai `multiplier`.
    pattern: /(?:\?\?|\|\|)\s*(?:0|1|1\.\d+|[23]\.0+)\b/,
    // CO Y khong dung tu "multiplier" tran: `suspiciousMultiplier()` cua
    // 03-06 la BOI SO KHOANG CACH de hien thi, khong phai he so tang ca — `?? 0`
    // o do la dung. Danh sach nay chi khoanh vung TANG CA.
    requiresAny: ["overtime", "premium", "multipliers", "daymultiplier"],
    // `overtimeMinutes ?? 0` la mot so PHUT mac dinh, khong phai mot he so —
    // D-26 cam bia ra HE SO khi doanh nghiep chua khai, khong cam mac dinh 0
    // cho mot phep dem.
    forbidsAny: ["minutes", "hours"],
  },
  {
    name: "ngay-le-cai-san",
    // Chen thang mot dong vao bang `holidays` — bang co y de rong (D-26).
    pattern: /insert\s+into\s+holidays\b/i,
  },
];

/** Cac duong dan duoc mien, kem LY DO — toi da 5 muc (acceptance criteria 04-06). */
export const SCAN_EXEMPTIONS: Array<{ prefix: string; reason: string }> = [
  {
    prefix: "src/lib/attendance/suspicious.ts",
    reason:
      "Module SO HUU hai nguong mac dinh cua D-29; day la noi duy nhat duoc phep khai chung.",
  },
  {
    prefix: "supabase/tests/",
    reason:
      "Fixture pgTAP tu chen du lieu doi chieu (ngay le, he so) trong mot transaction roi rollback — khong phai du lieu cai san cho doanh nghiep that.",
  },
];

export function isExempt(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return SCAN_EXEMPTIONS.some((item) => normalized.startsWith(item.prefix));
}

/** Quet mot file; tra ve cac dong vi pham (da bo comment va noi dung chuoi). */
export function scanWorkRuleSource(source: string): WorkRuleViolation[] {
  const lines = stripCommentsAndStrings(source);
  const violations: WorkRuleViolation[] = [];

  lines.forEach((line, index) => {
    for (const rule of RULES) {
      const lower = line.toLowerCase();
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
