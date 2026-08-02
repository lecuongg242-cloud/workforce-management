import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Cau hinh Vitest dau tien cua du an. Duoi .mts la bat buoc — package.json
 * khong khai bao "type": "module" nen Node se doc .ts nhu CommonJS neu dat
 * ten khac.
 *
 * `loadEnv(mode, cwd, "")` (plan 03-01, Task 2) nap `.env.local` vao
 * `process.env` cho CHINH tien trinh vitest — tien to rong ("") nghia la
 * nap TAT CA bien, khong chi bien `VITE_*`. Can thiet cho
 * `src/app/api/attendance-photos/[id]/__tests__/route.test.ts`: test do la
 * mot test TICH HOP chay tren Postgres dev THAT (khong mock createServerSupabase),
 * vi pgTAP khong dung duoc schema `storage` tren Postgres tam cua CI — day
 * la lop kiem CHUNG duoc cho co lap anh xuyen doanh nghiep. Cac lenh
 * `node --env-file=.env.local scripts/*.mjs` khac cua du an tu nap env rieng;
 * day la diem nap duy nhat cho `npx vitest run` (khong co --env-file).
 * Chi gan bien CHUA co san trong process.env — khong ghi de bien da duoc
 * shell truyen vao (vi du trong CI).
 */
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [react(), tsconfigPaths()],
    test: {
      environment: "jsdom",
      globals: false,
      // 20s (mac dinh 5s) — test tich hop tren Postgres/Storage dev THAT
      // (route.test.ts, attendance-evidence.test.ts, plan 03-04) goi nhieu
      // vong RPC/Storage tuan tu qua mang that, co the vuot 5s tren ket noi
      // cham; khong anh huong toc do cac test thuan mock (chi la mot tran).
      testTimeout: 20000,
      setupFiles: ["./vitest.setup.ts"],
      include: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/__tests__/**/*.test.ts",
      ],
      exclude: ["node_modules", ".next"],
    },
  };
});
