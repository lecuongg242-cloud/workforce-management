import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Cong co hoc cua D-52 (Phase 6).
 *
 * Bay cho tinh `isAdminRole` inline duoi `src/app/api/` la moi nguy THAT cua
 * phase nay, va no hong theo kieu kho tim nhat: bo sot mot cho thi phien ho
 * tro bi thu pham vi ve `sessionEmployeeId` — ma gia tri do la `null` cho mot
 * phien ho tro — nen man hinh se RONG chu khong bao loi. Khong co ngoai le
 * nao no, khong co dong log nao, chi la mot bang khong co dong nao.
 *
 * Cong nay bao ve cac phase SAU chu khong chi phase nay: mot Route Handler
 * moi viet theo thoi quen cu se do o day truoc khi kip len san pham.
 *
 * Cung ho voi `route-handlers-get-only.test.ts` va `admin-client-scope.test.ts`:
 * khang dinh TINH tren ma nguon, khong chay ma.
 */

const API_DIR = join(process.cwd(), "src", "app", "api");

/**
 * Bat ca `role === "owner"` lan `context.role === 'admin'`. KHONG bat
 * `requireRole(role, ["owner", "admin"])` — do la duong GHI va no phai o lai
 * nguyen ven, day chinh la co che chan phien ho tro.
 */
const FORBIDDEN = /\brole\s*===\s*["'](owner|admin)["']/;

function collectRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectRouteFiles(full));
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("khong tinh vai tro quan tri inline duoi src/app/api/ (D-52)", () => {
  it("moi Route Handler di qua canReadCompanyData(), khong so chuoi truc tiep", () => {
    const offenders = collectRouteFiles(API_DIR)
      .filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(process.cwd(), "").replace(/\\/g, "/"));

    expect(offenders).toEqual([]);
  });

  it("cong nay quet duoc mot so luong file dang ke — 0 file la mot cong hong", () => {
    // Neu duong dan doi (vi du repo tai cau truc), cong tren se quet 0 file va
    // xanh vinh vien ma khong ai biet. Khang dinh nay la cai chan cua no.
    expect(collectRouteFiles(API_DIR).length).toBeGreaterThan(20);
  });
});
