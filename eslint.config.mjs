import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

import timeflowNoDateInClient from "./eslint-rules/no-date-in-client.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // File sinh tu dong / cau hinh cong cu (`.claude/**`), khong phai ma nguon
    // app — khong kiem tra bang ESLint cua app vi khong tuan theo quy uoc
    // next/typescript. `eslint-rules/__fixtures__`
    // chua mot fixture CO CHU DICH VI PHAM D-19a (dung de chung minh rule
    // ben duoi co rang) — neu lot vao luot lint thuong thi se do vinh vien;
    // no van lint duoc rieng qua `npx eslint --no-ignore <path>`.
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "next-env.d.ts",
      ".claude/**",
      "eslint-rules/__fixtures__/**",
    ],
  },
  {
    // D-19a: cuong che "hom nay do server cap" tren toan bo src/ — thay the
    // rule pham vi hep cua plan 02-08 (chi ba file view). Rule cuc bo doc
    // chi thi "use client" that o dau file (khong theo danh sach duong dan
    // phai cap nhat tay), xem `eslint-rules/no-date-in-client.mjs`.
    // Bao gom them `eslint-rules/__fixtures__/**/*.tsx` de rule chay duoc
    // khi lint TRUC TIEP fixture (bo qua `ignores` o tren bang `--no-ignore`)
    // — day la cach acceptance criteria cua 02-11 chung minh rule co rang.
    files: ["src/**/*.{ts,tsx}", "eslint-rules/__fixtures__/**/*.tsx"],
    plugins: {
      timeflow: timeflowNoDateInClient,
    },
    rules: {
      "timeflow/no-date-in-client": "error",
    },
  },
];

export default eslintConfig;
