---
phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh
plan: 02
subsystem: work-mode
tags: [attendance, classification, pure-module, nextjs, route-handler, zod, vitest, react, ui, admin, payroll]

requires:
  - phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh (05-2-01)
    provides: "company_settings.work_mode + standard_hours_per_day + standard_days_per_month"
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-05)
    provides: "classification.ts (overtimeMinutes, classifyWorkDay) + classification-context.ts (nguon duy nhat cua phep phan loai)"
  - phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng (05-1)
    provides: "month-context.ts — loadMonthContext/summarizeMonth, nguon duy nhat cua moi con so cong"
provides:
  - "src/lib/attendance/work-mode.ts — resolveDayCredit / effectiveScheduledMinutes / sumCreditedDays (mo-dun thuan)"
  - "MonthlySummary + PayrollPrepRow mang creditedDays / regularMinutes / hourDeltaMinutes / missingWorkModeInputs"
  - "PayrollPrep.workMode — che do dang ap cua ca bang"
  - "/admin/payroll hien che do dang ap, cot 'Ngay cong quy doi', va canh bao khi thieu mau so"
affects: ["05-2-04", "05-2-05", "05-2-06"]

actuals:
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "`effectiveScheduledMinutes()` la NGUON DUY NHAT cua mau so tinh phan vuot; `classifyDay()` goi no thay vi tu chon do dai ca — hai noi tu chon mau so se lam man hinh phan loai va phep tinh luong lech nhau"
    - "`null` tu `effectiveScheduledMinutes()` (che do daily_hours chua khai mau so) duoc xu ly bang 'khong tinh gi', KHONG bang mot gia tri du phong — mot `?? 0` o do chinh la cai bay D-36a"
    - "`workedDays` (dem ngay) va `creditedDays` (ngay cong de tinh tien) song song, khong thay the nhau: o `daily_hours` chung khac nhau that"
    - "Cot 'Lech gio so voi ca' chi hien o che do `shift_hourly` — o hai che do kia no luon 0 va mot cot toan so 0 lam bang dai ra ma khong noi gi"

key-files:
  created:
    - src/lib/attendance/work-mode.ts
    - src/lib/attendance/__tests__/work-mode.test.ts
    - src/lib/data/__tests__/work-mode-effect.test.ts
  modified:
    - src/lib/attendance/classification-context.ts
    - src/lib/attendance/month-context.ts
    - src/lib/types/domain.ts
    - src/lib/validation/api/attendance.ts
    - src/lib/validation/api/payroll.ts
    - src/app/api/payroll/summary/route.ts
    - src/app/admin/payroll/payroll-view.tsx
    - src/lib/constants.ts
    - src/lib/payroll/__tests__/csv.test.ts

key-decisions:
  - "`resolveDayCredit()` nhan `dayType` lam THAM SO thay vi tu tinh lai: loai ngay do `classifyWorkDay()` quyet dinh va da co san o `summarizeMonth()`. Tinh lai la mo mot duong thu hai cho cung mot cau hoi."
  - "Ngay le / ngoai lich lam viec: `creditedDays = 0` va toan bo gio la tang ca, o CA BA che do. Cong them mot ngay cong nua la tra hai lan cho cung mot ngay."
  - "`leave_paid` = 1 ngay cong o ca ba che do, KE CA khi chua khai mau so — no khong phu thuoc vao mau so nao. `leave_unpaid` = 0 o ca ba (D-43)."
  - "`shift_hourly` KHONG lam `creditedDays` thanh thap phan: phan thieu/thua gio di qua `hourDelta` rieng. Neu ca hai cung phan anh so gio thieu, 05-2-04 se tru HAI LAN cho cung mot thu."
  - "Truong hop 'khong xac dinh duoc ca' o `shift` (mau so 0, toan bo gio la tang ca) duoc viet TUONG MINH bang `if (shift === undefined) return 0` thay vi mot toan tu du phong — hai truong hop 'khong biet' o hai che do doi hoi hai cau tra loi nguoc nhau, va gop chung lai la cach de nhat de sau nay sua nham mot cai va lam doi cai kia."
  - "`DayClassification` them `workModeInputMissing` de noi goi phan biet duoc 'khong co tang ca' voi 'khong tinh duoc tang ca'."
  - "`PayrollPrep.workMode` nam o cap BANG chu khong cap dong: no la mot lua chon cua doanh nghiep, va de o cap dong se goi y sai rang no khai rieng theo nguoi duoc."

requirements-completed: [PAY-06]
---

# 05-2-02: Ba che do tinh cong

## Da lam

**Task 1 — mo-dun thuan `work-mode.ts`.** `resolveDayCredit({day, dayType, mode, shift,
standardHoursPerDay})` tra `creditedDays` / `regularMinutes` / `overtimeMinutes` / `hourDelta` /
`missing`. Kem `effectiveScheduledMinutes()` — **mau so** cua phep tinh phan vuot, va la nguon
duy nhat cua con so do — va `sumCreditedDays()` cho phep cong ca thang.

Khoi comment dau file viet ra **cai bay D-36a** bang dung phep tinh cua no: che do
`daily_hours` di qua nhanh cu voi `scheduledMinutes = 0` cho
`overtimeMinutes = max(worked - 0, 0)` = **toan bo gio lam**, va khong mot test nao cua Phase 4
hay 5.1 phat hien ra vi tat ca chung chay o che do `shift`.

Test **19 khang dinh** (yeu cau: >= 12), gom ba bai bat buoc:
- *"CAI BAY D-36a: 6 gio lam KHONG sinh 360 phut tang ca"*;
- `leave_unpaid` ra `creditedDays = 0` o ca ba che do (va `leave_paid` ra 1 o ca ba);
- thieu mau so tra `missing`, khong tra mot con so — kem mot bai doi chieu khang dinh ket qua
  "thieu mau so" **khac** ket qua "mau so bang 8", tuc la khong co gia tri du phong nao.

**Task 2 — phep tong hop thang di qua che do.** `loadCompanyRules()` tra them `workMode` +
hai mau so, lay tu **chinh** loi doc `loadCompanySettings()` da co — khong truy van thu hai.
`classifyDay()` lay mau so tu `effectiveScheduledMinutes()`; o che do `shift` no tra dung
`shift?.scheduledMinutes` nhu truoc nen **khong mot con so lich su nao doi**.
`summarizeMonth()` goi `resolveDayCredit()` cho tung ngay va tra them bon truong.

**Task 3 — bang chung ba che do ra ba ket qua.** `work-mode-effect.test.ts`: mot doanh nghiep,
mot tap cham cong co dinh (8 tieng / 12 tieng / 6 tieng / `leave_paid` / `leave_unpaid`), doi
`work_mode` qua ba gia tri va doc lai `GET /api/payroll/summary` moi lan. **8 test** (yeu cau:
>= 6), trong do bai 5 la mot phep so sanh **tuong minh giua ba ket qua** (doi mot khac nhau),
kem mot khang dinh nguoc: `totalMinutes` phai **giong nhau** o ca ba — che do doi cach QUY DOI,
khong doi du lieu cham cong.

`/admin/payroll` them: dong "Cach tinh cong: …" canh trang thai ky, cot **"Ngay cong quy doi"**
(cot RIENG, khong thay the "Ngay cong"), cot "Lech gio so voi ca" chi hien o `shift_hourly`, va
mot bang canh bao chi duong sang `/admin/settings` khi thieu mau so.

## Ba bo so do duoc, tren database that

Cung mot tap cham cong (ca 08:00-16:00, ngay chuan 10 tieng):

| | `shift` | `daily_hours` | `shift_hourly` |
|---|---|---|---|
| Ngay cong quy doi | 4 | **3,4** | 4 |
| Phut tang ca | **240** | **120** | 240 |
| Lech gio so voi ca | 0 | 0 | **+120** |
| Tong phut lam | 1560 | 1560 | 1560 |

Ngay 6 tieng o `daily_hours` cho **0,6** ngay cong va **0** phut tang ca — khong phai 360
(D-36a). Tong tang ca cua ca thang o che do do la 120 phut, khong phai 1560.

## Nghiem thu

| Kiem | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0 |
| `npx vitest run` (toan bo) | **46 file / 487 test pass** — moi test cua Phase 4 va 5.1 van xanh |
| `npx vitest run src/lib/attendance/__tests__/work-mode.test.ts` | **19/19** (yeu cau >= 12) |
| `npx vitest run src/lib/data/__tests__/work-mode-effect.test.ts` | **8/8** (yeu cau >= 6) |
| `npx vitest run src/lib/data/__tests__/payroll-summary.test.ts` | **8/8** — bai doi chieu hai duong doc cua 5.1 khong vo |
| `grep -nE "\?\? 8\|\?\? 480\|scheduledMinutes \?\?" src/lib/attendance/work-mode.ts` | **khong dong nao** |
| `grep -c "supabase\|process.env\|new Date" src/lib/attendance/work-mode.ts` | **0** |
| `grep -c "resolveDayCredit" src/lib/attendance/month-context.ts` | `2` (import + loi goi) |
| `grep -rc "resolveDayCredit" src/app/api/` | **0 cho moi file** — logic khong ro ra Route Handler |

## Ghi chu cho nguoi sau

- **Hai phep grep cua plan bat duoc ca chuoi trong comment.** Khoi comment dau
  `work-mode.ts` da duoc viet lai de tranh ba cai ten `supabase` / `process.env` /
  `new Date` — va tranh ca `?? 0` sau `scheduledMinutes`. Ghi lai o day vi do la mot rang
  buoc THAT ve cach viet file do, khong phai mot su tuy tien: mot cong co hoc bat duoc chuoi
  trong comment thi no khong con phan biet duoc code voi loi hua ve code.
- `csv.ts` **chua** xuat cot "Ngay cong quy doi". Doi tep CSV la mot hop dong voi may ke toan
  o dau ben kia; 05-2-04/05-2-05 se dung lai tep do khi da co con so tien, va doi hai lan la
  hai lan nguoi nhan phai sua cong thuc cua ho.
- Suite day du van co timeout ngau nhien tren database dev tu xa (`Hook timed out in 10000ms`,
  trung binh 1-2 file moi lan chay, khac file moi lan). Da biet tu 05-2-01 va da doi chieu la
  co truoc plan nay. Mot lan chay sach cho **46/46 file, 487/487 test**.
