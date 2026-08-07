import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Cong co hoc chan tang du lieu gia lap quay lai (plan 02-11, T-02-11-03).
 *
 * Bon khang dinh, dua tren danh sach file ma git dang theo doi duoi `src/`
 * (khong phai quet dia — file da xoa/gitignore khong duoc tinh):
 * 1. Khong file nao nam duoi mot thu muc "mock" (`src/**\/mock/**`).
 * 2. Khong file nao chua chuoi duong dan import cua thu muc do (`@/lib/mock/`).
 * 3. Khong file nao chua ten hai hang so ngay/thang co dinh da xoa
 *    (`REFERENCE_DATE`, `REFERENCE_MONTH`).
 * 4. So file duoc quet LON HON 0 -- mot cong quet 0 file khong duoc coi la
 *    xanh (neu `git ls-files` tra ve rong vi mot ly do nao do, cong nay phai
 *    do, khong duoc im lang pass).
 */

const PROJECT_ROOT = process.cwd();

// File nay LA cong kiem tra -- noi dung cua no (ke ca chinh docstring/khang
// dinh o tren) buoc phai nhac lai nguyen van cac chuoi bi cam de mo ta dieu
// no dang tim, nen tu no se luon "vi pham". Loai chinh no khoi danh sach
// quet -- day KHONG phai mot ngoai le lam yeu cong, vi day la cong, khong
// phai ma nguon ung dung dang duoc cong kiem tra.
const SELF_PATH = "src/__tests__/no-mock-layer.test.ts";

function listTrackedSrcFiles(): string[] {
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
    .filter((line) => line !== SELF_PATH);
}

const trackedFiles = listTrackedSrcFiles();

describe("khong con tang du lieu gia lap trong src/ (T-02-11-03)", () => {
  it("quet duoc it nhat mot file -- cong khong duoc pass vi quet rong", () => {
    expect(trackedFiles.length).toBeGreaterThan(0);
  });

  it("khong file nao nam duoi mot thu muc 'mock'", () => {
    const offenders = trackedFiles.filter((file) =>
      file.split(path.sep).join("/").split("/").includes("mock"),
    );

    expect(offenders).toEqual([]);
  });

  it("khong file nao chua chuoi duong dan import '@/lib/mock/'", () => {
    const offenders = trackedFiles.filter((file) => {
      const content = readFileSync(path.join(PROJECT_ROOT, file), "utf8");
      return content.includes("@/lib/mock/");
    });

    expect(offenders).toEqual([]);
  });

  it("khong file nao chua ten hang so ngay/thang co dinh da xoa (REFERENCE_DATE/REFERENCE_MONTH)", () => {
    const offenders = trackedFiles.filter((file) => {
      const content = readFileSync(path.join(PROJECT_ROOT, file), "utf8");
      return (
        content.includes("REFERENCE_DATE") || content.includes("REFERENCE_MONTH")
      );
    });

    expect(offenders).toEqual([]);
  });
});
