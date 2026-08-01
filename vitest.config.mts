import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Cau hinh Vitest dau tien cua du an. Duoi .mts la bat buoc — package.json
 * khong khai bao "type": "module" nen Node se doc .ts nhu CommonJS neu dat
 * ten khac.
 */
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/__tests__/**/*.test.ts",
    ],
    exclude: ["node_modules", ".next"],
  },
});
