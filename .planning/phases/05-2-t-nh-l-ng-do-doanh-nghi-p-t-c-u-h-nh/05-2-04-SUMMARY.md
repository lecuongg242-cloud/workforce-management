---
phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh
plan: 04
subsystem: payroll-compute
tags: [pure-module, nextjs, route-handler, zod, vitest, react, ui, admin, payroll, csv]

requires:
  - phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh (05-2-01)
    provides: "employee_pay_rates + tf_pay_rate_at; work_mode + hai mau so quy doi"
  - phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh (05-2-02)
    provides: "creditedDays / regularMinutes / hourDeltaMinutes / missingWorkModeInputs"
  - phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh (05-2-03)
    provides: "pay_adjustments + pay_adjustment_scopes; scope.ts (isTargeted)"
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-05)
    provides: "convertedOvertimeHours — NGUON DUY NHAT cua gio tang ca (D-31)"
provides:
  - "src/lib/payroll/rate.ts — toDailyRate / toHourlyRate (mo-dun thuan)"
  - "src/lib/payroll/compute.ts — computePayrollLine (mo-dun thuan)"
  - "src/lib/payroll/payroll-context.ts — doc muc luong + danh muc khoan MOT LAN cho ca ky"
  - "GET /api/payroll/summary co du sau truong tien + missing[] cho tung dong"
  - "/admin/payroll hien tien, bam mot dong xem tung khoan; CSV co cot tien"
affects: ["05-2-05", "05-2-06"]

actuals:
  tasks: 4
  commits: 0

tech-stack:
  added: []
  patterns:
    - "`rate.ts` chi doi MAU SO THUC SU DUNG TOI — doanh nghiep tra luong gio khong bi chan boi mot con so ho khong bao gio dung den (neu bi chan, ho se dien bua vao do)"
    - "`missing[]` la mot mang KHOA (`pay_rate`, `standard_days_per_month`, `overtime_rule:<key>`) chu khong phai mot cau — nhan tieng Viet do `describeMissingReason()` tra, dung chung cho ca man hinh lan CSV"
    - "Loi canh bao thue/bao hiem cua CSV nam TRONG TEN COT 'Thuc nhan', khong o mot dong chu thich rieng: no di theo con so khi ai do copy cot"
    - "`payroll-context.ts` doc moi phien ban `effective_from <= periodEnd` roi chon o tang ung dung — cung lap luan da dan toi `resolveMultiplier()` cua 04-05, va cung duoc canh bang mot bai doi chieu"

key-files:
  created:
    - src/lib/payroll/rate.ts
    - src/lib/payroll/__tests__/rate.test.ts
    - src/lib/payroll/compute.ts
    - src/lib/payroll/__tests__/compute.test.ts
    - src/lib/payroll/payroll-context.ts
    - src/lib/data/__tests__/payroll-compute.test.ts
  modified:
    - src/lib/types/domain.ts
    - src/lib/validation/api/payroll.ts
    - src/app/api/payroll/summary/route.ts
    - src/lib/payroll/csv.ts
    - src/lib/payroll/__tests__/csv.test.ts
    - src/app/admin/payroll/payroll-view.tsx
    - src/lib/constants.ts

key-decisions:
  - "CANG THANG THAT giua D-42a ('lam tron tung buoc roi cong lai se lech') va rui ro cua phase ('tong phai bang dung tong cac dong'). O muc mot dong hai yeu cau nay khong the cung dung tuyet doi. Ranh gioi duoc dat nhu sau: BUOC TRUNG GIAN (don gia va cac phep nhan) KHONG BAO GIO lam tron — do dung la thu D-42a mo ta, va lam tron o do lech HANG NGHIN dong; CON SO CUOI (tung o hien ra) lam tron DUNG MOT LAN, va `netPay` la tong cua chinh nhung o do. Sai so con lai duoi mot dong moi thanh phan — nho nhat ma dinh dang tien dong cho phep, va KHONG QUAN SAT DUOC; trong khi mot bang khong doi chieu duoc thi quan sat duoc ngay."
  - "Chua khai muc luong -> KHONG hien ca cac khoan `fixed_amount` (von khong phu thuoc luong). Hien mot phan cua bang luong cho nguoi chua co luong se doc ra thanh 'day la tat ca nhung gi ho duoc tra'."
  - "Muc luong tra tai NGAY CUOI KY, khong phai hom nay. He qua da biet, ghi trong comment: tang luong GIUA ky thi CA KY an muc moi. Tach theo tung khoang hieu luc la mot mo hinh khac han, chua duoc thiet ke; doanh nghiep muon tach dung thi khai muc moi tu ngay dau thang ke tiep."
  - "`missing` trong hop dong JSON la `z.array(z.string())` chu khong phai enum: khoa gom ca dang `overtime_rule:<key>`, va mot enum se phai sua moi lan them mot loai thieu — trong khi giao dien chi dung no de tra cuu mot nhan."
  - "Cot tien them vao CUOI tep CSV: moi cong thuc ma ke toan da dung tren tep cu van tro dung cot."
  - "`hourDeltaMinutes` AM khi thieu gio, nen phep nhan tu ra so am — KHONG co nhanh rieng cho 'thieu gio', vi mot nhanh rieng la mot cho de dau cong bi viet nham thanh dau tru."
  - "Tong 'thuc nhan' o thanh tom tat KHONG coi dong `null` la 0: so nguoi chua du du kien duoc dem rieng va noi ra thanh mot con so, thay vi lang le tut khoi tong."

requirements-completed: [PAY-01]
---

# 05-2-04: Phep tinh ra tien

## Da lam

**Task 1 — quy doi don vi (`rate.ts`).** `toDailyRate()` / `toHourlyRate()` cho ba don vi
theo hai chieu. **Khong lam tron** (don gia la buoc trung gian), va **chi doi mau so thuc su
dung toi**: nguoi an luong gio ra duoc don gia gio ma khong can `standardDaysPerMonth`.
Test **15 khang dinh** (yeu cau >= 10), gom ba bai "thieu mau so khong can toi van tinh duoc"
va mot bai do luong khoang lech giua lam-tron-truoc va lam-tron-sau.

**Task 2 — phep tinh mot dong luong (`compute.ts`).** `computePayrollLine()` tra `basePay`,
`overtimePay`, `hourAdjustment`, `allowanceItems[]`, `deductionItems[]`, hai tong, `netPay`,
`missing[]`. Ba quy tac trong khoi comment dau file: khong tinh lai gio tang ca (D-31), khong
bao gio thay gia tri thieu bang 0 (va thieu MOT phan thi `netPay` cung `null`), va ranh gioi
lam tron (xem key-decisions).

Test **23 khang dinh** (yeu cau >= 14). Moi con so ky vong deu kem cong thuc tinh tay ngay tren
dong khang dinh.

**Task 3 — duong doc co tien.** `payroll-context.ts` doc muc luong hieu luc tai **ngay cuoi ky**
va danh muc khoan **mot lan cho ca ky**. `GET /api/payroll/summary` giu nguyen moi truong cu va
them phan tien; mot dong thieu du kien thi thieu **mot minh no**.

Test tich hop **10 test** (yeu cau >= 8) tren database dev that.

**Task 4 — man hinh va tep xuat.** Nam cot tien tren bang (cot "Thuc nhan" dam hon), bam mot
dong mo khoi chi tiet ba phan, chu thich thue/bao hiem **co dinh tren bang**, va sau cot tien
trong CSV. Test CSV len **18** (yeu cau: co test cho cot tien va cho o thieu du kien).

## Ba che do, ba so tien — tren database that

Cau hinh: ca 08:00–16:00, `standard_days_per_month = 20`, `standard_hours_per_day = 8`,
he so tang ca ngay thuong 1,5, luong **20.000.000 ₫/thang**
(-> don gia ngay **1.000.000**, don gia gio **125.000**).

Tap cham cong thang 05/2014: mot ngay 8 tieng, mot ngay 12 tieng, mot ngay 4 tieng, mot ngay
`leave_paid`, mot ngay `leave_unpaid`.

| | `shift` | `daily_hours` | `shift_hourly` |
|---|---|---|---|
| Ngay cong quy doi | 4 | **3,5** | 4 |
| Luong goc | 4.000.000 | **2.500.000** | 4.000.000 |
| Tien tang ca | 750.000 | 750.000 | 750.000 |
| Cong/tru theo gio | — | — | 0 |
| **Thuc nhan** | **4.750.000** | **3.250.000** | **4.750.000** |

`shift` va `shift_hourly` trung nhau o bo so nay vi the bu tru (thua 240 phut mot ngay, thieu
240 phut mot ngay khac). Bai 6 pha the bu tru do bang mot ngay lam thieu nua, va hai che do
tach ra: **5.750.000** so voi **5.250.000**.

## Nghiem thu

| Kiem | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0 |
| `npx vitest run` (toan bo) | **51 file / 567 test pass** |
| `npx vitest run src/lib/payroll/__tests__/rate.test.ts` | **15/15** (yeu cau >= 10) |
| `npx vitest run src/lib/payroll/__tests__/compute.test.ts` | **23/23** (yeu cau >= 14) |
| `npx vitest run src/lib/data/__tests__/payroll-compute.test.ts` | **10/10** (yeu cau >= 8) |
| `npx vitest run src/lib/payroll/__tests__/csv.test.ts` | **18/18** |
| `grep -cE "\?\? 0\|\?\? 1\|\?\? 8\|\?\? 22\|\?\? 26" src/lib/payroll/rate.ts` | **0** |
| `grep -cE "Math\.round\|toFixed" src/lib/payroll/rate.ts` | **0** |
| `grep -cE "supabase\|process\.env\|new Date" src/lib/payroll/compute.ts` | **0** |
| `grep -c "convertedOvertimeHours" src/lib/payroll/compute.ts` | `5` (>= 1) |
| `grep -cE "overtimeMinutes \*\|scheduledMinutes" src/lib/payroll/compute.ts` | **0** — khong tinh lai gio tang ca |
| `grep -c "computePayrollLine" src/app/api/payroll/summary/route.ts` | `4` (>= 1) |
| File khac duoi `src/app/` goi `computePayrollLine` | **khong co** |
| `grep -ciE "chưa gồm\|chưa bao gồm" src/lib/constants.ts` | `1` (>= 1) |

## Ba quan sat cua `<acceptance_criteria>` Task 4

Moi truong nay khong mo duoc trinh duyet, nen ba quan sat duoc kiem bang test tren **du lieu
that** thay vi bang mat:

1. **"Bang ra so tien"** — bai 7 cua `payroll-compute.test.ts` doc `GET /api/payroll/summary`
   cua mot doanh nghiep da khai du (luong, mau so, he so, mot khoan phu cap, mot khoan khau
   tru) va nhan duoc `netPay = 5.380.000`. Man hinh render dung truong nay.
2. **"Bam mot dong thay tung khoan"** — cung bai do khang dinh `allowanceItems` va
   `deductionItems` mang dung ten va so tien cua tung khoan. Khoi chi tiet render dung hai
   mang nay, khong tinh lai gi.
3. **"Tong cot thuc nhan bang tong cac dong"** — bai 7 khang dinh
   `netPay === basePay + overtimePay + hourAdjustment + allowanceTotal − deductionTotal` va
   `allowanceTotal === tong cac dong khoan`, tren du lieu that. Bai 11 cua `csv.test.ts` khang
   dinh cung dang thuc do tren tep xuat. Thanh tom tat cua man hinh cong `netPay` cua tung
   dong bang mot `reduce` tren chinh nhung gia tri nay.

Neu chay tay duoc, day la ba thu can nhin lai.

## Khong lam / gioi han da biet

- **Thue TNCN va BHXH/BHYT/BHTN khong duoc tinh** (PAY-02/PAY-03 van o V3). Dieu nay duoc noi
  o ba noi: khoi chu thich co dinh tren bang, ten cot "Thuc nhan" trong CSV, va comment cua
  `PAYROLL_LABEL.taxDisclaimer`.
- **Tang luong giua ky thi ca ky an muc moi** — xem key-decisions.
- Con so nay CHUA duoc chot lai o dau ca: moi lan mo man hinh la mot lan tinh lai tu cau hinh
  hien tai. Ban chot tu chua (D-42) la 05-2-05.
- Cot "Cong/tru theo gio" chi hien tren bang o che do `shift_hourly`, nhung **luon co** trong
  CSV (bang 0 o hai che do kia) — tep xuat giu so cot co dinh de cong thuc cua ke toan khong
  lech khi doanh nghiep doi che do.
