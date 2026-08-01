import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeAdminClientUsage } from "@/__tests__/lib/admin-client-scope-check";

/**
 * Cong co hoc T-02-10-01: khoa bi mat (`src/lib/supabase/admin.ts`) tuyet
 * doi khong duoc import tu Client Component hay tu mot file `*-view.tsx` /
 * duoi `src/components/`. Quet TOAN BO `src/` — mot cong chi quet mot thu
 * muc con la mot cong co the bo sot vi tri vi pham thuc.
 */

const SRC_ROOT = path.join(process.cwd(), "src");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const MUTATIONS_PREFIX = path
  .join("src", "lib", "data", "mutations")
  .split(path.sep)
  .join("/");

function findSourceFiles(dir: string): string[] {
  let results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // node_modules: khong phai ma nguon cua du an. __tests__: chinh cong
      // nay (va cac cong tuong tu) chua chuoi "@/lib/supabase/admin" trong
      // CHUOI GIA LAP/BINH LUAN de tu kiem chung "co rang" -- quet ca thu
      // muc do se tao ket qua duong tinh gia voi CHINH FILE TEST NAY.
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      results = results.concat(findSourceFiles(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) continue;
    results.push(full);
  }
  return results;
}

const allSourceFiles = findSourceFiles(SRC_ROOT);

interface ScannedFile {
  relative: string;
  posixRelative: string;
  usage: ReturnType<typeof analyzeAdminClientUsage>;
}

const scanned: ScannedFile[] = allSourceFiles.map((file) => {
  const source = readFileSync(file, "utf8");
  const relative = path.relative(process.cwd(), file);
  return {
    relative,
    posixRelative: relative.split(path.sep).join("/"),
    usage: analyzeAdminClientUsage(source),
  };
});

const importingFiles = scanned.filter((entry) => entry.usage.importsAdminModule);

describe("admin-client-scope (T-02-10-01)", () => {
  it("quet duoc it nhat mot file import @/lib/supabase/admin", () => {
    // Cong quet 0 file khong duoc coi la xanh -- do khong phai bang chung
    // "khong co vi pham nao", ma la bang chung cong chua quet gi ca.
    expect(importingFiles.length).toBeGreaterThan(0);
  });

  for (const entry of importingFiles) {
    it(`${entry.relative} co "use server" hoac nam duoi src/lib/data/mutations/`, () => {
      const underMutations = entry.posixRelative.startsWith(MUTATIONS_PREFIX);
      expect(entry.usage.hasUseServerDirective || underMutations).toBe(true);
    });
  }

  it("khong file nao import module do lai co chi thi \"use client\"", () => {
    const violators = importingFiles.filter((entry) => entry.usage.hasUseClientDirective);
    expect(violators.map((entry) => entry.relative)).toEqual([]);
  });

  it("khong file nao duoi src/components/ hay khop *-view.tsx import module do", () => {
    const violators = importingFiles.filter(
      (entry) =>
        entry.posixRelative.startsWith("src/components/") ||
        entry.posixRelative.endsWith("-view.tsx"),
    );
    expect(violators.map((entry) => entry.relative)).toEqual([]);
  });

  it("analyzeAdminClientUsage CO RANG: phat hien duoc mot Client Component gia lap co import module bi cam", () => {
    const violatingSource = [
      '"use client";',
      "",
      'import { createAdminSupabase } from "@/lib/supabase/admin";',
      "",
      "export function Bad() { return createAdminSupabase(); }",
    ].join("\n");

    const usage = analyzeAdminClientUsage(violatingSource);
    expect(usage.importsAdminModule).toBe(true);
    expect(usage.hasUseClientDirective).toBe(true);
  });
});
