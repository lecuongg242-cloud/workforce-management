---
phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh
plan: 01
subsystem: pay-rates
tags: [postgres, trigger, append-only, nextjs, route-handler, server-action, zod, vitest, react, ui, admin, settings, employees]

requires:
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-01, 04-04)
    provides: "company_settings + updateCompanySettings (duong ghi duy nhat); khuon trigger append-only + tf_overtime_multiplier cua migration 0016 (D-25a)"
  - phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng (05-03)
    provides: "khuon them cot vao company_settings KHONG co mac dinh (migration 0019)"
provides:
  - "employee_pay_rates (migration 0022) — muc luong tung nhan vien, APPEND-ONLY co trigger cuong che (D-37/D-37a)"
  - "tf_pay_rate_at(employee_id, date) — muc luong DANG HIEU LUC tai mot ngay, NULL khi truoc moi phien ban"
  - "company_settings.work_mode (mac dinh shift) + standard_hours_per_day + standard_days_per_month (KHONG mac dinh, D-36/D-38)"
  - "GET /api/pay-rates?employeeId= + getPayRateHistory() (chi owner/admin, D-44)"
  - "createPayRate() — Server Action ghi mot phien ban muc luong, kem mot dong audit_log"
  - "PayRatePanel — tab 'Thong tin luong' o /admin/employees/[id] chay that"
affects: ["05-2-02", "05-2-03", "05-2-04", "05-2-05", "05-2-06"]

actuals:
  tasks: 4
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Trigger append-only nhan lai nguyen khuon 0016, kem thu tuc go trigger CO Y THUC ghi trong comment dau file — o day hau qua nang hon mot bac vi no la TIEN DA TRA"
    - "`tf_pay_rate_at()` tra `returns employee_pay_rates` (ca dong) thay vi mot cot: phep tinh luong o 05-2-04 can CA don vi lan so tien, va hai loi goi rieng se co the doc hai phien ban khac nhau"
    - "Migration chay-lai-duoc: `drop trigger` boc trong `do $$ ... to_regclass(...) is not null ... $$` de lan chay dau (chua co bang) khong phai mot ngoai le"
    - "Route Handler `/api/pay-rates` KHONG tra ve mot hinh dang 'rong an toan' khi phien khong hop le (khac /api/overtime-rules): mot lich su rong doc ra thanh 'nguoi nay chua duoc khai luong' — mot cau tra loi ve du lieu ma nguoi hoi khong duoc phep hoi"
    - "`emptyToNull` dung chung cho ca ba o so de trong duoc cua tab Chung (tran tang ca + hai mau so)"

key-files:
  created:
    - supabase/migrations/0022_employee_pay_rates.sql
    - supabase/tests/16_employee_pay_rates.sql
    - src/lib/validation/api/pay-rates.ts
    - src/lib/data/pay-rates.ts
    - src/lib/data/mutations/pay-rates.ts
    - src/app/api/pay-rates/route.ts
    - src/components/employees/pay-rate-panel.tsx
    - src/lib/data/__tests__/pay-rates.test.ts
  modified:
    - supabase/tests/run-all.sql
    - scripts/check-pgtap-assertions.mjs
    - src/lib/types/domain.ts
    - src/lib/validation/api/settings.ts
    - src/lib/settings/company-settings.ts
    - src/lib/data/mutations/settings.ts
    - src/components/settings/general-settings-form.tsx
    - src/app/admin/employees/[id]/employee-detail-view.tsx
    - src/lib/constants.ts
    - src/lib/data/__tests__/settings.test.ts
    - src/lib/data/__tests__/attendance-review.test.ts

key-decisions:
  - "`tf_pay_rate_at()` tra ve CA DONG (`returns employee_pay_rates`) chu khong chi `amount`: don vi va so tien phai den cung mot luot doc, vi mot muc luong 45000 co nghia hoan toan khac nhau o don vi `hour` va `month`."
  - "`unique (employee_id, effective_from)` chu khong `(company_id, employee_id, effective_from)`: `employee_id` da la khoa ngoai duy nhat toi mot doanh nghiep, them `company_id` vao chi lam index to hon ma khong chan them truong hop nao."
  - "`work_mode` CO mac dinh `shift` con hai mau so thi KHONG — hai lua chon nguoc nhau trong cung mot migration, va ly do khac nhau: mac dinh `shift` giu nguyen HANH VI cua doanh nghiep dang chay, con mot mau so mac dinh se BIA RA mot con so nghiep vu chua ai khai (D-26)."
  - "Bon policy RLS day du ke ca `update`/`delete` (da bi trigger chan): policy va trigger tra loi hai cau hoi khac nhau, va bo hai policy do di se doi thong diep loi tu cau giai thich cua trigger thanh mot loi RLS chung chung."
  - "Vai tro khac `owner`/`admin` nhan 403 o duong doc KE CA khi hoi chinh minh — mot ngoai le 'tru khi hoi chinh minh' se la duong tat dau tien cho man hinh phieu luong chua duoc thiet ke (PAY-05 van o V3)."
  - "Tab luong voi vai tro khong phai owner/admin hien mot khoi noi thang 'ban khong co quyen' thay vi de duong doc nem 403 va lam vo tab."
  - "Form tab Chung KHONG chan luu khi chon `daily_hours` ma chua khai `standard_hours_per_day` — chi canh bao tai cho. Chan luu se lam nguoi dung khong luu duoc ca bon truong con lai cua form."

requirements-completed: [PAY-06]
---

# 05-2-01: Cho de khai luong — muc luong co phien ban va ba che do tinh cong

## Da lam

**Task 1 — bang muc luong append-only (migration 0022).** `employee_pay_rates` voi
`unit` (`month`/`day`/`hour`), `amount numeric(14,2) > 0`, `effective_from`, `created_at`,
`created_by`, `unique (employee_id, effective_from)`. Trigger
`employee_pay_rates_append_only` tu choi `UPDATE`/`DELETE` voi SQLSTATE `23001`, thong diep
noi **cach lam dung** ("khai mot phien ban moi") chu khong chi noi "cam" — dung giong 0016.

Khoi comment dau file noi ro **vi sao append-only o day nang hon o 0016**: sua de mot he so
tang ca lam *so lieu* cua ky da qua doi; sua de mot muc luong lam **tien da tra cho nguoi lao
dong** tinh lai ra mot con so khac, va sai ve qua khu. Kem thu tuc go trigger co y thuc va hai
he qua da biet (`truncate` khong bi chan; xoa doanh nghiep se bi chan) — cung khuon 0016.

`tf_pay_rate_at(p_employee_id, p_date)` `security invoker`, tra **ca dong** co
`effective_from` lon nhat ma van `<= p_date`. Tra `NULL` khi ngay do truoc moi phien ban hoac
nhan vien chua khai lan nao — khong lui ve dong gan nhat, khong bia ra 0.

`company_settings` them ba cot: `work_mode` (`daily_hours`/`shift`/`shift_hourly`, **mac dinh
`shift`**), `standard_hours_per_day` va `standard_days_per_month` (**null, khong mac dinh**,
`check (... is null or ... > 0)`).

Test pgTAP `16_employee_pay_rates.sql`, **12 khang dinh**: UPDATE bi chan, DELETE bi chan,
INSERT chay binh thuong, tra dung phien ban tai ngay sau moc moi, tra phien ban **cu** tai ngay
truoc moc moi, `null` khi truoc moi phien ban, `null` khi chua khai lan nao, co lap doc cheo,
co lap ghi cheo, va ba khang dinh ve mac dinh cua cot (`standard_hours_per_day` va
`standard_days_per_month` co `column_default` **rong**, `work_mode` bang `shift`).
Sàn `check:assertions` nang **250 -> 262**.

**Task 2 — duong doc va duong ghi.** `payRateInputSchema` / `payRateRowSchema` /
`payRateHistorySchema` (D-12d), khong truong nao khai dinh danh doanh nghiep.
`GET /api/pay-rates?employeeId=` tra **toan bo lich su** `effective_from` giam dan kem phien
ban dang hieu luc hom nay (ngay lay tu `tf_server_now`/`tf_work_date`, D-19), chi
`owner`/`admin`. `createPayRate()` doi chieu `employees` theo `company_id` cua **phien** truoc
khi ghi, chan `amount <= 0` o schema truoc khi cham database, doi loi trung `23505` thanh mot
cau tieng Viet, va de lai mot dong `audit_log`.

**Task 3 — cach tinh cong vao tab Chung.** Ghi van di qua dung `updateCompanySettings()` —
khong duong ghi thu hai. Tab Chung them mot khoi "Cach tinh cong": mot `Select` ba lua chon
(nhan noi **he qua**, khong chi ten), cau giai thich he qua cua lua chon dang chon hien ngay
duoi o chon, va hai o mau so quy doi **de trong hop le**. Chon `daily_hours` ma chua khai
`standard_hours_per_day` -> canh bao ngay tai cho, **khong chan luu**.

**Task 4 — tab "Thong tin luong".** `EmptyState` hua *"se duoc thiet lap trong giai doan tiep
theo"* duoc thay bang `PayRatePanel`: muc luong dang hieu luc hom nay noi bat o tren (so tien
`formatVnd` + don vi), lich su phien ban ben duoi (moi nhat truoc), nut "Khai muc luong moi"
mo dialog (don vi / so tien / hieu luc tu ngay), **khong nut sua va khong nut xoa** — kem mot
cau noi ro vi sao ngay tren dau bang lich su. `formatVnd()` (ma chet tu V1) duoc goi lan dau.

## Nghiem thu

| Kiem | Ket qua |
|---|---|
| `npm run db:push` | thoat 0 — migration 0022 da ap |
| `npm run check:assertions` | thoat 0, tong **262** (san moi 262) |
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0 |
| `npx vitest run src/lib/data/__tests__/pay-rates.test.ts` | **11/11 pass** (yeu cau: >= 6) |
| `npx vitest run src/__tests__/route-handlers-get-only.test.ts` | pass — `/api/pay-rates` chi xuat `GET` |
| `npx vitest run src/lib/data/__tests__/settings.test.ts` | pass, kem 6 test moi cho `work_mode` + hai mau so de trong |
| `grep -c "logMutation" src/lib/data/mutations/pay-rates.ts` | `2` (import + loi goi) — >= 1 |
| `grep -c "await logMutation(" src/lib/data/mutations/settings.ts` | `1` — khong duong ghi thu hai |
| `grep -rn "formatVnd" src/components/employees/pay-rate-panel.tsx` | 3 dong |
| `EmptyState` o `employee-detail-view.tsx` | khoi tab luong khong con la `EmptyState` hua hen; mot `EmptyState` moi thay vao **chi cho vai tro khong co quyen** |

**`companyId` trong `src/lib/validation/api/pay-rates.ts`:** kiem bang mat — chuoi `companyId`
**khong xuat hien** trong `payRateInputSchema` lan `payRateQuerySchema`. No chi xuat hien o
`payRateRowSchema`/`payRateSchema` (hinh dang **dong tra ve** tu database), khong o dau vao nao.

**Bang chung `column_default` rong (may phat trien khong co `psql`):** test tich hop so 11 doc
`company_settings` cua `cty-02` qua khoa `service_role` va khang dinh
`standard_hours_per_day === null`, `standard_days_per_month === null`, `work_mode === "shift"`.
Khang dinh pgTAP tuong ung doc thang `information_schema.columns`.

## Khong lam / gioi han da biet

- **Khong mot con so tien nao duoc tinh o plan nay** — dung nhu prohibition. Phep tinh la 05-2-04.
- Cot "Nguoi khai" cua bang lich su hien 8 ky tu dau cua `created_by` (uuid), khong hien ten:
  mot phep noi `auth.users` -> `employees` chua co duong doc nao o phase nay, va tu them mot
  truy van thu hai chi de lam dep mot cot la mo rong pham vi.
- `npm run test:db` van khong chay duoc o may phat trien (khong co `psql`) — da biet tu CONTEXT.
- **Suite day du co timeout ngau nhien**: `payroll-summary.test.ts`, `period-close.test.ts`,
  `shift-rules-effect.test.ts` thinh thoang bao `Hook timed out in 10000ms` khi chay ca 44 file
  song song tren database dev tu xa. Da doi chieu tren cay **truoc** thay doi cua plan nay
  (`git stash`): ba file do cung do y het, va do nhieu hon (3 file do / 3 test do so voi 2/0).
  Day la nhieu cua moi truong, khong phai hoi quy cua plan nay. Mot lan chay day du da cho
  **460/460 test pass**.
- Mot dong `employee_pay_rates` thua nam lai tren database dev (`nv-02a`, `2019-09-01`,
  13.000.000) tu mot lan chay test truoc khi fixture duoc sua — **khong xoa duoc** vi chinh
  trigger append-only chan `DELETE`. Test da duoc viet lai de khong phu thuoc vao dong nao la
  moi nhat (bai 3 doi chieu `current` voi `tf_pay_rate_at()` cua database thay vi voi mot hang
  so), nen dong do vo hai. Day dung la loai danh doi ma `overtime-rules.test.ts` cua 04-04 da
  ghi nhan.
