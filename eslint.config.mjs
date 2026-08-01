import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // File sinh tu dong / cong cu GSD framework, khong phai ma nguon app —
    // khong kiem tra bang ESLint cua app (dung require() CommonJS thuan,
    // khong tuan theo quy uoc next/typescript)
    ignores: [".next/**", "node_modules/**", "out/**", "next-env.d.ts", ".claude/**"],
  },
];

export default eslintConfig;
