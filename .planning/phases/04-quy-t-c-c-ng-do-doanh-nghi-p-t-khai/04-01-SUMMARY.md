---
phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai
plan: 01
subsystem: company-settings
tags: [postgres, rls, pgtap, nextjs, route-handler, server-action, zod, vitest, react, ui, admin]

requires:
  - phase: 03-ch-m-c-ng-c-b-ng-ch-ng (03-02, 03-06)
    provides: "khuon Route Handler doc / Server Action ghi + audit (03-02), suspicious.ts va GET /api/attendance/review (03-06)"
provides:
  - "company_settings (migration 0015) — mot dong cho mot doanh nghiep, 4 policy RLS, backfill, trigger updated_at"
  - "loadCompanySettings() — nguon DUY NHAT doc cau hinh o phia server (Route Handler + Server Action)"
  - "GET /api/settings, updateCompanySettings() (Server Action + audit)"
  - "/admin/settings — khung BON tab co dinh (Chung / Ca lam viec / Ngay le / Tang ca), tab Chung chay day du"
  - "isSuspiciousPunch({..., multiplier}) — nguong nhan qua tham so, hang so chi con la mac dinh (D-29 dong D-21a)"
affects: ["04-02", "04-03", "04-04", "04-05"]

actuals:
  tasks: 4
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Module server-only rieng (`src/lib/settings/company-settings.ts`) cho phep doc dung chung giua Route Handler va Server Action: `src/lib/data/settings.ts` bi component client import nen khong the chua `createServerSupabase()` (doc `next/headers`)"
    - "`updated_at` do TRIGGER cua database dat (`company_settings_touch_updated_at`), khong do tang ung dung gui len — DEFAULT chi ap luc INSERT, va gui dau thoi gian tu client la mo duong cho dong ho client di vao du lieu (D-19)"
    - "Hop nhat patch bang kiem `!== undefined` thay vi `??` de gia tri 0 (bien do khung gio ca) khong bi coi la 'khong gui'"

key-files:
  created:
    - supabase/migrations/0015_company_settings.sql
    - supabase/tests/10_company_settings.sql
    - src/lib/validation/api/settings.ts
    - src/lib/settings/company-settings.ts
    - src/lib/data/settings.ts
    - src/lib/data/mutations/settings.ts
    - src/app/api/settings/route.ts
    - src/app/admin/settings/page.tsx
    - src/app/admin/settings/settings-view.tsx
    - src/components/settings/general-settings-form.tsx
    - src/lib/data/__tests__/settings.test.ts
    - src/lib/data/__tests__/settings-effect.test.ts
  modified:
    - supabase/seed.sql
    - supabase/tests/run-all.sql
    - scripts/check-pgtap-assertions.mjs
    - src/lib/types/domain.ts
    - src/lib/attendance/suspicious.ts
    - src/app/api/attendance/review/route.ts
    - src/lib/data/mutations/attendance.ts
    - src/lib/data/mutations/companies.ts
    - src/lib/data/__tests__/attendance-review.test.ts
    - src/lib/attendance/__tests__/suspicious.test.ts
    - src/lib/nav.ts
    - src/lib/constants.ts

key-decisions:
  - "Vong dong D-29 duoc chung minh bang TEST TICH HOP tren database that (`settings-effect.test.ts`) thay vi chi bang quan sat tay: cung mot ban ghi, nguong 5 -> khong trong danh sach, 1.2 -> co, 10 -> khong; cty-02 khong doi. Manh hon acceptance criteria goc (quan sat tay ghi vao SUMMARY) vi no chay lai duoc o moi lan `npm test`."
  - "Chan theo vai tro cho `/admin/settings` KHONG lam rieng o trang: `src/app/admin/layout.tsx` da redirect `manager`/`employee` sang `/employee` truoc khi trang render. Acceptance criteria goc viet 'hien thong bao khong co quyen' — lam vay se la khuon THU HAI cho cung mot ranh gioi, nen theo khuon dang co cua repo."
  - "`GET /api/settings` mo cho MOI vai tro dang nhap (khong chi owner/admin): khung gio dem va bien do khung gio ca la thu nhan vien can biet de hieu ban ghi cua chinh minh. Gioi han owner/admin nam o duong GHI."
  - "`loadCompanySettings()` TU TAO dong mac dinh khi thieu thay vi tra null — de khong noi goi nao tu nghi ra gia tri thay the (prohibition cua plan)."
  - "`isSuspiciousPunch` tra `false` khi `multiplier <= 0` — du lieu cau hinh hong khong duoc bien MOI lan cham thanh dang ngo."

requirements-completed: [SET-01 (phan nen cau hinh; giao dien ca lam viec o 04-02)]
---

# 04-01: Nen cau hinh doanh nghiep + dong lai D-21a

## Da lam

**Task 1 — bang cau hinh.** `company_settings` khoa chinh la `company_id` (bat bien "mot
doanh nghiep mot dong" ep bang khoa chinh, khong bang unique index thu hai), bon cot:
`suspicious_distance_multiplier` (mac dinh 5), `shift_window_grace_minutes` (120),
`night_start_time`/`night_end_time` (22:00-06:00, D-27), cong `updated_at`/`updated_by`.
Bon policy RLS dieu kien duy nhat `tf_is_member(company_id)`. Backfill
`on conflict do nothing`. Trigger `company_settings_touch_updated_at` de dau thoi gian den
tu dong ho database. Test pgTAP `10_company_settings.sql` (6 khang dinh): backfill day du,
gia tri mac dinh dung, doc cheo tra 0 dong, chen cheo bi tu choi 42501, sua cheo khong cham
duoc dong nao, `night_start = night_end` bi CHECK tu choi. San assertion nang 199 -> 205.

**Task 2 — duong doc/ghi.** `CompanySettings`/`CompanySettingsInput` trong domain.ts; cap
schema hai dau + `companySettingsInputSchema` (patch tung phan, khong truong dinh danh doanh
nghiep); `loadCompanySettings()` server-only; `GET /api/settings`; Server Action
`updateCompanySettings()` kem `logMutation` (1 dong audit, before/after nguyen dong);
`createCompanyAction()` chen dong cau hinh cho doanh nghiep moi. 10 test.

**Task 3 — D-29.** Hai hang so o `suspicious.ts` doi vai thanh GIA TRI MAC DINH;
`isSuspiciousPunch()` nhan them `multiplier`. `GET /api/attendance/review` doc
`loadCompanySettings()` roi truyen ca hai nguong vao; `mutations/attendance.ts` doc nguong tu
cau hinh cho banner tuc thi (de banner nhan vien va danh sach quan tri khong bao gio noi hai
nguong khac nhau). 4 test moi o `suspicious.test.ts`, 2 test moi o `attendance-review.test.ts`,
va 4 test tich hop `settings-effect.test.ts` tren database that.

**Task 4 — trang cai dat.** `/admin/settings` voi khung BON tab thu tu co dinh; tab Chung
day du (form 4 truong, mot nut chinh, toast, `invalidate()` + `reload()` sau khi luu); ba tab
sau hien khoi "Dang xay dung". Nav bo `comingSoon`.

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0, `/admin/settings` va `/api/settings` co trong output |
| `npx vitest run` | 25 file, 263 test xanh (truoc plan: 261) |
| `npm run check:assertions` | 205 assertion, sang moc 205 |
| `npm run db:push` | 0015 da ap len database dev (Supabase cloud) |
| `grep SUSPICIOUS_DISTANCE_MULTIPLIER src/ \| grep -v suspicious.ts \| grep -v __tests__` | rong — khong noi nao ngoai module goc con doc thang hang so |

**Vong dong D-29 (bang chung nghiem thu chinh):** `settings-effect.test.ts` tao mot ban ghi
cham cong cach diem lam viec 300m (ban kinh 100m) tren database that, roi:
- nguong 5 (mac dinh) -> ban ghi **khong** trong danh sach "Can xem lai";
- nguong 1.2 -> **chinh ban ghi do** xuat hien, khong mot dong du lieu lich su nao bi sua;
- nguong 10 -> bien khoi danh sach tro lai;
- ca ba lan, nguong cua cty-02 khong doi (van 5).

## Khong lam duoc trong moi truong nay

- `npm run test:db` / `npm run db:seed`: **khong chay duoc** — `psql` khong co tren may va
  database dev la Supabase cloud, ma `scripts/db.mjs` tu choi chay bo test pgTAP len cloud
  (fixture `auth.users` se lam GoTrue Admin API tra 500 — chinh la blocker 03-07 dang treo).
  File `10_company_settings.sql` da duoc viet va dem vao cong `check:assertions`, nhung
  **chua duoc chay that lan nao**. Can chay tren Postgres tam cua CI.
- Quan sat tay tren trinh duyet (mo `/admin/settings`, bam Luu, xem toast): chua lam. Phan
  hanh vi tuong duong da duoc phu bang test tich hop tren database that.
