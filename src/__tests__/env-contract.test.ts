import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

/**
 * Khang dinh HINH DANG hop dong bien moi truong sau khi doi ten
 * SUPABASE_PUBLISHABLE_KEY -> NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (Task 3,
 * plan 02-01). Test nay KHONG duoc so sanh hay in ra GIA TRI cua bat ky bien
 * nao — chi so sanh TEN bien va do dai > 0, dung phong cach
 * `scripts/check-bundle-secrets.mjs` (T-02-01-04, xem threat_model).
 */

const ENV_LOCAL_PATH = path.resolve(process.cwd(), ".env.local");

const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "POSTGRES_URL_NON_POOLING",
] as const;

const ALLOWED_PUBLIC_VARS = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]);

const LEGACY_PUBLISHABLE_KEY_NAME = "SUPABASE_PUBLISHABLE_KEY";

function loadDefinedKeys(): string[] {
  process.loadEnvFile(ENV_LOCAL_PATH);
  const raw = readFileSync(ENV_LOCAL_PATH, "utf8");
  return [...raw.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)=/gm)].map((m) => m[1]);
}

describe("hop dong bien moi truong .env.local", () => {
  const definedKeys = loadDefinedKeys();

  it("co du bon bien bat buoc, gia tri khac rong", () => {
    for (const key of REQUIRED_VARS) {
      expect(definedKeys).toContain(key);
      const value = process.env[key];
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  it("khong con ten bien publishable key cu", () => {
    expect(definedKeys).not.toContain(LEGACY_PUBLISHABLE_KEY_NAME);
  });

  it("dung hai bien mang tien to cong khai, ca hai deu nam trong danh sach cho phep", () => {
    const publicKeys = definedKeys.filter((k) => k.startsWith("NEXT_PUBLIC_"));
    expect(publicKeys).toHaveLength(2);
    for (const key of publicKeys) {
      expect(ALLOWED_PUBLIC_VARS.has(key)).toBe(true);
    }
  });

  it("SUPABASE_SECRET_KEY khong mang tien to cong khai", () => {
    expect(definedKeys).toContain("SUPABASE_SECRET_KEY");
    expect("SUPABASE_SECRET_KEY".startsWith("NEXT_PUBLIC_")).toBe(false);
  });
});
