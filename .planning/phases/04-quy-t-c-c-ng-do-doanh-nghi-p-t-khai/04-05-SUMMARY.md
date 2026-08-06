---
phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai
plan: 05
subsystem: attendance-classification
tags: [nextjs, route-handler, zod, vitest, integration-test, react, ui]

requires:
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-01, 04-03, 04-04)
    provides: "company_settings (khung gio dem), holidays, overtime_rules + tf_overtime_multiplier"
provides:
  - "src/lib/attendance/classification.ts — mo-dun thuan: loai ngay, phut dem, phut tang ca, quy doi cong don (D-28a)"
  - "src/lib/attendance/classification-context.ts — nguon DUY NHAT ghep quy tac doanh nghiep vao ngay cong o phia server"
  - "GET /api/attendance/classification — phan loai tung ngay theo thang"
  - "GET /api/attendance/summary mo rong: overtimeMinutes, overtimeNightMinutes, convertedOvertimeHours, missingMultiplierKeys"
  - "MonthSummary (dung o CA man nhan vien lan man quan tri) va dong ngay o lich su hien gio tho + gio quy doi"
affects: ["04-06"]

actuals:
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "`isoWeekday()` tinh thu trong tuan bang cong thuc lich (Sakamoto) thay vi `new Date('YYYY-MM-DD')` — chuoi do duoc dien giai la UTC nen o mui gio am se lui mot ngay va thu trong tuan lech"
    - "Tang ca duoc coi la phan CUOI cua thoi gian lam trong ngay: `overtimeNightMinutes` cat lay N phut cuoi roi moi giao voi khung dem, thay vi `min(nightMinutes, overtimeMinutes)` — phep min sai nang o ca dem (ca 22:00-06:00 lam toi 08:00 co 480 phut dem nhung phan tang ca thi khong co phut dem nao)"
    - "He so phan giai o tang ung dung (`resolveMultiplier`) de tranh N+1 RPC cho ca mot thang; su trung lap voi `tf_overtime_multiplier` duoc canh bang mot test DOI CHIEU chay ca hai tren cung du lieu that"

key-files:
  created:
    - src/lib/attendance/classification.ts
    - src/lib/attendance/classification-context.ts
    - src/lib/attendance/__tests__/classification.test.ts
    - src/app/api/attendance/classification/route.ts
    - src/lib/data/__tests__/attendance-classification.test.ts
  modified:
    - src/lib/validation/api/attendance.ts
    - src/app/api/attendance/summary/route.ts
    - src/lib/data/attendance.ts
    - src/lib/types/domain.ts
    - src/components/employee-app/month-summary.tsx
    - src/app/employee/history/history-view.tsx
    - src/lib/constants.ts
    - src/lib/data/__tests__/attendance-evidence.test.ts

key-decisions:
  - "[Sua pham vi so voi plan] Man hinh dich KHONG phai `/admin/attendance/attendance-view.tsx` — duong dan do KHONG TON TAI (`/admin/attendance` van la muc nav `comingSoon`, chi co `/admin/attendance/review`). Cho quan tri doc so lieu thang la `MonthSummary` trong `employee-detail-view.tsx`, va do la component DUNG CHUNG voi man hinh nhan vien — nen mo rong `MonthSummary` phu ca hai dau cung mot luc."
  - "Them `GET /api/attendance/classification` thay vi nhoi phan loai vao `GET /api/attendance`: phan loai la khai niem cua MOT NGAY, con `/api/attendance` tra tung LUOT cham cong (mot ngay co nhieu luot tu migration 0013). Gan mot gia tri ngay vao tung luot se lam no bi cong nhieu lan o bat ky noi nao tong hop lai."
  - "Truong tang ca trong `monthlySummarySchema` khai TUY CHON de moi noi dang doc schema nay khong vo; nhung Route Handler luon dien du. `convertedOvertimeHours: null` va `undefined` mang hai nghia khac nhau va giao dien phan biet duoc."
  - "`classifyDay` mac dinh `workingDays` la ca bay ngay khi khong biet ca: mot ngay khong xac dinh duoc ca KHONG duoc mac nhien thanh 'ngay nghi' roi bong nhien toan bo gio lam thanh tang ca."
  - "Sua mot test LAC HAU cua 03-04 (`attendance-evidence.test.ts` #10): no dem audit_log theo dieu kien TOAN CUC (entity_table + created_at) nen bat ky file test song song nao co ghi anh cham cong deu lam no do. Da siet ve `actor_user_id` cua chinh file do. Day la sua mot khang dinh SAI PHAM VI, khong phai noi long test."

requirements-completed: [SET-04]
---

# 04-05: Phan loai cong theo quy tac dang hieu luc (SET-04)

## Da lam

**Task 1 — mo-dun thuan** (`classification.ts`, 22 test): loai ngay (le > ngoai lich lam viec
> thuong), doan thoi gian tuyet doi cho ca qua dem, phut dem, phut tang ca, phan tang ca roi
vao khung dem, va phep quy doi **cong don hai lop** cua D-28a. `resolveMultiplier()` la ban JS
cua `tf_overtime_multiplier`.

**Task 2 — hai duong doc** (11 test tich hop tren DB that): `classification-context.ts` doc
quy tac cua doanh nghiep MOT LAN cho ca khoang thoi gian roi ghep vao tung ngay;
`GET /api/attendance/classification` (moi) va `GET /api/attendance/summary` (mo rong) dung
CHUNG mo-dun do nen tong thang va tung ngay khong the lech nhau.

**Task 3 — hien thi.** `MonthSummary` them hai o ("Giờ tăng ca" tho / "Quy đổi") kem cau gioi
han D-28a; man hinh lich su cua nhan vien them nhan loai ngay (chi hien khi KHAC ngay thuong)
va mot dong gio tang ca kem phan dem va gio quy doi.

## Bang chung nghiem thu (test tich hop, DB that)

| # | Kiem | Ket qua |
|---|---|---|
| 1 | Loai ngay suy tu `holidays` va `working_days` cua ca | le / ngay nghi / ngay thuong dung |
| 2 | Ngay thuong tinh phan vuot ca; le va ngay nghi tinh toan bo | 120 / 240 / 180 phut |
| 3 | Quy doi theo he so cua loai ngay | 3 gio va 12 gio |
| 4 | Loai ngay CHUA khai he so | `null` + khoa thieu, khong phai 1.0 |
| 5 | Tong thang khi thieu mot he so | `null`, khong cong bo phan |
| **6** | **[TIEU CHI 4] hai ngay hai phien ban he so trong CUNG mot phan hoi** | **02/05 giu he so cu (3 gio), 13/05 dung he so moi (4 gio)** |
| 7 | Doi chieu `resolveMultiplier` (JS) voi `tf_overtime_multiplier` (SQL) | trung khop tren 5 moc ngay |
| 8 | Cot luu phan loai trong `attendance_records` | khong co cot nao |
| 9-11 | Phan quyen, thang rong, 403 khong ro du lieu | dung |

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` / `lint` / `build` | thoat 0 |
| `npx vitest run` (chay hai lan) | 32 file, 337 test xanh |
| Module `classification.ts` thuan | khong import Supabase / `process.env` / `new Date()` (2 ket qua grep deu la comment) |
| `?? 1` / `\|\| 1` / `= 1.0` tren duong quy doi | khong co |
| Cuoi tuan suy tu `working_days`, khong nhung Thu Bay/Chu Nhat | khong co `getDay` voi 0/6 |
| Cau gioi han D-28a | mot hang so `OVERTIME_DISCLAIMER` duy nhat, dung o ca tab Tang ca lan MonthSummary |

## Ngoai le / no ky thuat

- Fixture cua `attendance-classification.test.ts` tao mot DOANH NGHIEP RIENG (id mang dau ngau
  nhien) vi `overtime_rules` la append-only nen khong the don sach bang he so giua cac lan
  chay. Doanh nghiep do khong xoa duoc o cuoi (cascade xuong `overtime_rules` bi trigger
  chan); phan xoa duoc (ban ghi cham cong, ngay le, nhan vien, audit) da duoc don.
- Quan sat tay tren trinh duyet chua lam; hanh vi tuong duong da duoc phu bang test tich hop.
