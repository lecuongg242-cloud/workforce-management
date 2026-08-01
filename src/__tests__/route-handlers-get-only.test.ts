import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeRouteHandlerSource } from "@/__tests__/lib/route-handler-check";

/**
 * Cong co hoc D-12c: Route Handler chi duoc `GET`. Server Action da co kiem
 * tra nguon gui san; Route Handler xac thuc bang cookie thi khong, nen mot
 * `POST` them vao cho tien la mot lo CSRF.
 */

const API_ROOT = path.join(process.cwd(), "src", "app", "api");

function findRouteFiles(dir: string): string[] {
  let results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findRouteFiles(full));
    } else if (entry.isFile() && entry.name === "route.ts") {
      results.push(full);
    }
  }
  return results;
}

const routeFiles = findRouteFiles(API_ROOT);

describe("route-handlers-get-only (D-12c)", () => {
  it("quet duoc it nhat mot file route.ts duoi src/app/api", () => {
    // Mot cong quet 0 file khong duoc coi la xanh -- do la cach do luong so
    // khong, khong phai bang chung "khong co vi pham nao".
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  for (const file of routeFiles) {
    const relative = path.relative(process.cwd(), file);

    it(`${relative} chi xuat dung mot ham HTTP: GET`, () => {
      const source = readFileSync(file, "utf8");
      const { exportedFunctions } = analyzeRouteHandlerSource(source);
      expect(exportedFunctions).toEqual(["GET"]);
    });

    it(`${relative} khai bao dynamic = "force-dynamic"`, () => {
      const source = readFileSync(file, "utf8");
      const { exportedConsts } = analyzeRouteHandlerSource(source);
      expect(exportedConsts).toContain("dynamic");
      expect(source).toContain("force-dynamic");
    });
  }

  it("analyzeRouteHandlerSource CO RANG: phat hien duoc mot ham HTTP gia lap co tinh vi pham", () => {
    const violatingSource = `
      export const dynamic = "force-dynamic";
      export async function GET() {}
      export async function POST() {}
    `;
    const { exportedFunctions } = analyzeRouteHandlerSource(violatingSource);
    // Neu buoc nay xanh VA nhom kiem tra o tren cung xanh, ta biet nhom o
    // tren xanh vi ma dung, khong phai vi ham phan tich bi mu.
    expect(exportedFunctions).toContain("POST");
  });
});
