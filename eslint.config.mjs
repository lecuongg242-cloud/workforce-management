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
  {
    // D-19a: cuong che "hom nay" khong bao gio duoc tu tinh lai bang dong ho
    // thiet bi trong ba man hinh vua chuyen sang du lieu that o plan 02-08
    // (dashboard, trang chu nhan vien, lich su cham cong) — ca ba deu nhan
    // "hom nay" qua prop tu Server Component (`src/lib/today.ts`), D-19.
    // PHAM VI CO CHU DICH: chi ba file NAY, khong phai moi client component
    // trong repo — mot vai component khac (vi du
    // `src/components/employee-app/attendance-status-card.tsx`) co dong ho
    // chay THAT (tick moi giay) khoi tao SAU khi gan vao DOM qua useEffect,
    // day la hoa van hop le KHONG gay lech hydration va nam ngoai pham vi
    // plan nay — mo rong luat nay ra toan repo la viec cua mot plan khac,
    // ghi lai o SUMMARY cua 02-08 nhu mot khoang trong da biet.
    files: [
      "src/app/admin/dashboard/dashboard-view.tsx",
      "src/app/employee/employee-home-view.tsx",
      "src/app/employee/history/history-view.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            "Khong duoc doc dong ho thiet bi bang `new Date()` o day (D-19/D-19a). Nhan 'hom nay' qua prop tu Server Component — xem src/lib/today.ts.",
        },
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            "Khong duoc doc dong ho thiet bi bang `Date.now()` o day (D-19/D-19a). Nhan 'hom nay' qua prop tu Server Component — xem src/lib/today.ts.",
        },
      ],
    },
  },
];

export default eslintConfig;
