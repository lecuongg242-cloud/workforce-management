import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Cong co hoc chan lien ket ky (signed URL) va URL mien luu tru cua nha cung
 * cap quay lai ma nguon (T-03-07-02, plan 03-07).
 *
 * Vi sao cong nay ton tai: mot lien ket ky, mot khi da phat hanh, dung duoc
 * cho BAT KY AI cam no cho toi luc het han va KHONG tai kiem quyen lan nao
 * nua (Pitfall 2, RESEARCH.md). Kien truc broker Route Handler (plan 03-01)
 * loai bo hoan toan rui ro do bang cach doc byte anh o SERVER tren MOI lan
 * goi (`.download()`), khong bao gio phat hanh mot URL dung lai duoc. Day la
 * phase dau tien va duy nhat phat anh cham cong cho quan tri xem, nen neu bo
 * sot mot lan sua trong tuong lai lang le thay broker route bang mot lien
 * ket ky cho "tien" thi khong co "phase sau sua lai" — va kieu ro ri nay im
 * lang, vi mot demo bang tay van trong nhu dat (khong ai cam lien ket do di
 * qua bien gioi doanh nghiep de thu trong luc demo).
 *
 * Cach kiem: quet toan bo file duoi `src/` ma git dang theo doi (khuon giong
 * `no-mock-layer.test.ts`), bo qua thu muc `__tests__` va file `*.test.ts*`.
 * Chinh file nay nam trong `__tests__` nen tu dong duoc loai khoi danh sach
 * quet — day KHONG phai mot ngoai le lam yeu cong, vi noi dung file nay (ke
 * ca chinh docstring nay) buoc phai nhac lai nguyen van cac chuoi bi cam de
 * mo ta dieu no dang tim, giong tien le cua `no-mock-layer.test.ts`.
 */

const PROJECT_ROOT = process.cwd();

const FORBIDDEN_PATTERNS: { label: string; pattern: RegExp }[] = [
  // Bat ca createSignedUrl va createSignedUrls (mot pattern, vi ten ham thu
  // hai chua nguyen ten ham thu nhat lam tien to).
  { label: "createSignedUrl(s)", pattern: /createSignedUrl/ },
  { label: "getPublicUrl", pattern: /getPublicUrl/ },
  // Mot chuoi tro thang toi mien luu tru cua nha cung cap trong mã nguon —
  // khong co ly do hop le nao de mot file (ngoai test) can biet ten mien
  // nay, vi TOAN BO truy cap Storage phai di qua server (createServerSupabase()).
  { label: "mien luu tru cua nha cung cap (supabase.co)", pattern: /supabase\.co/i },
];

function isTestPath(file: string): boolean {
  const normalized = file.split(path.sep).join("/");
  if (normalized.split("/").includes("__tests__")) return true;
  if (/\.test\.tsx?$/.test(normalized)) return true;
  return false;
}

function listScannableSrcFiles(): string[] {
  const output = execSync("git ls-files -- src", {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // `git ls-files` doc CHI MUC, nen mot file da xoa khoi thu muc lam viec
    // ma chua commit van con trong danh sach. Bo qua chung: file khong con
    // ton tai thi khong co noi dung nao de vi pham, va de cong nay nem
    // ENOENT thi mot lan xoa file binh thuong cung lam do toan bo cong.
    .filter((line) => existsSync(path.join(PROJECT_ROOT, line)))
    .filter((line) => !isTestPath(line));
}

const scannedFiles = listScannableSrcFiles();

describe("no-signed-url (T-03-07-02)", () => {
  it("quet duoc it nhat mot file -- cong khong duoc pass vi quet rong (T-03-07-03)", () => {
    // Mot cong quet 0 file khong duoc coi la xanh -- day la bai kiem chong do
    // luong so khong, theo dung khuon route-handlers-get-only.test.ts.
    expect(scannedFiles.length).toBeGreaterThan(0);
  });

  for (const { label, pattern } of FORBIDDEN_PATTERNS) {
    it(`khong file nao (ngoai __tests__) chua "${label}"`, () => {
      const offenders = scannedFiles.filter((file) => {
        const content = readFileSync(path.join(PROJECT_ROOT, file), "utf8");
        return pattern.test(content);
      });
      expect(offenders).toEqual([]);
    });
  }
});
