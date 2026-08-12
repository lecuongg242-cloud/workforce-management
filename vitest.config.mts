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
      // Cung ly do voi `testTimeout` o tren, cho nua con lai bi bo quen: phan
      // NANG NHAT cua cac test tich hop nam o `beforeAll` chu khong phai trong
      // than test — tao tai khoan qua Admin API, chen ca/nhan vien, co file
      // con tai anh len Storage, tat ca qua mang toi Supabase cloud. Mac dinh
      // cua Vitest cho hook la 10s, va do dung la thong diep quan sat duoc:
      // "Hook timed out in 10000ms", 1-3 file moi lan chay day du, KHAC file
      // moi lan, va tat ca deu xanh khi chay rieng (xem STATE.md 05-2-06 —
      // truoc day ghi nhan la "nhieu moi truong").
      hookTimeout: 30000,
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
