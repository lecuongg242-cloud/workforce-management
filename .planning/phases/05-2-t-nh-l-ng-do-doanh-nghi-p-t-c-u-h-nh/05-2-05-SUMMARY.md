---
phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh
plan: 05
subsystem: payroll-run
tags: [postgres, trigger, immutable, rls, nextjs, route-handler, server-action, zod, vitest, react, ui, admin, payroll]

requires:
  - phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh (05-2-04)
    provides: "computePayrollLine + payroll-context; bang luong co tien tinh luc truy van"
  - phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng (05-05)
    provides: "periods.status + tf_close_period — dieu kien (1) cua chot luong"
provides:
  - "payroll_runs + payroll_lines + payroll_line_items (migration 0024) — ban chot luong tu chua, bat bien voi UPDATE"
  - "src/lib/payroll/payroll-rows.ts — buildPayrollRows(), nguon DUY NHAT cua nhanh tinh-luc-truy-van"
  - "closePayroll() / reopenPayroll() — Server Action chot va huy chot luong"
  - "GET /api/payroll/summary phan nhanh: ky da chot doc tu ban chot, ky chua chot tinh luc truy van"
  - "/admin/payroll co nut 'Chot luong ky' va 'Huy chot luong' (ly do bat buoc)"
affects: ["05-2-06"]

actuals:
  tasks: 4
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Ban chot TU CHUA: chep lai cach tinh cong, hai mau so, danh tinh nhan vien, muc luong da ap, ten va so tien tung khoan — khong mot con so nao phu thuoc vao viec doc lai bang goc"
    - "Trigger chan `UPDATE` NHUNG KHONG chan `DELETE` — nguoc voi khuon 0017 (`request_reviews`), va ly do nam trong khoi comment: mot ban chot la BAN TUYEN BO ve tien SE tra, khong phai mot hanh dong DA dien ra"
    - "`buildPayrollRows()` dung chung boi ca duong doc lan `closePayroll` — con so duoc chot khong the khac con so nguoi dung vua nhin thay"
    - "Hai nhanh doc tra CUNG mot hinh dang phan hoi; man hinh khong biet minh dang doc nhanh nao"

key-files:
  created:
    - supabase/migrations/0024_payroll_runs.sql
    - supabase/tests/18_payroll_runs.sql
    - src/lib/payroll/payroll-rows.ts
    - src/lib/data/mutations/payroll.ts
    - src/lib/data/__tests__/payroll-run.test.ts
  modified:
    - supabase/tests/run-all.sql
    - scripts/check-pgtap-assertions.mjs
    - src/lib/types/domain.ts
    - src/lib/validation/api/payroll.ts
    - src/lib/data/payroll.ts
    - src/app/api/payroll/summary/route.ts
    - src/app/admin/payroll/payroll-view.tsx
    - src/lib/constants.ts
    - src/lib/payroll/__tests__/csv.test.ts

key-decisions:
  - "LECH CO Y THUC voi `<acceptance_criteria>` Task 3 (`grep -c computePayrollLine` tren route = 1). Phep tinh duoc TACH khoi Route Handler sang `payroll-rows.ts`, nen con so tren route la **0**. Ly do: Task 2 doi hoi con so ghi vao ban chot bang DUNG con so man hinh dang hien, va cach duy nhat bao dam dieu do la MOT ham dung chung cho ca hai. De phep tinh nam trong route buoc `closePayroll` phai co ban lai no — dung thu ma tieu chi ay ton tai de ngan. Kiem tuong duong: route goi `buildPayrollRows()` dung mot lan o nhanh chua-chot, va `computePayrollLine()` duoc goi dung mot lan trong ca du an."
  - "`payroll_lines` chep CA cac cot so lieu cong chi de hien thi (`worked_days`, `total_minutes`, `leave_days`, `overtime_minutes`, `overtime_night_minutes`). Suy lai chung luc doc se lam chung doi theo du lieu cua HOM NAY trong khi cac cot tien thi khong — va mot bang tu mau thuan voi chinh no la thu te hon ca mot bang sai. Day cung la dieu kien de hai nhanh doc tra dung cung mot bo so."
  - "`payroll_runs` KHONG dat khoa ngoai toi `periods`: ban chot la mot ban ghi tai chinh doc lap, phai song duoc ke ca khi dong ky bi xoa."
  - "`payroll_line_items.adjustment_id` la TEXT khong rang buoc: mot khoan bi xoa khong duoc lam hong ban chot. Duong doc lui ve dung `name` lam khoa hien thi khi id rong."
  - "Khong co cot trang thai o `payroll_runs` — dong TON TAI nghia la da chot. Mot cot trang thai se tao ra trang thai thu ba ('dang chot') ma khong ai biet doc the nao, va mot ban nhap thi khong khac gi phep tinh luc truy van da co san."
  - "`closePayroll` xoa dong `payroll_runs` vua tao neu buoc ghi cac dong that bai — mot ban chot RONG doc ra thanh 'ky nay da chot va khong ai duoc tra gi'."
  - "Nut 'Huy chot luong' bi vo hieu ngay tai nut khi o ly do con trong, thay vi de nguoi dung bam roi nhan mot loi."

requirements-completed: [PAY-01]
---

# 05-2-05: Chot luong ky va ban chot tu chua

## Da lam

**Task 1 — ba bang cua ban chot (migration 0024).** `payroll_runs` (ky + cach tinh da ap),
`payroll_lines` (mot dong moi nguoi, kem anh chup danh tinh, muc luong da ap, so lieu cong va
sau con so tien), `payroll_line_items` (tung khoan, ten va so tien **chep lai**).

Trigger `tf_payroll_immutable()` chan `UPDATE` tren **ca ba bang**, nhung **khong chan
`DELETE`**. Khoi comment muc (2) noi ro vi sao khuon nay nguoc voi 0017: mot dong
`request_reviews` la mot **hanh dong da dien ra**, con mot ban chot luong la mot **ban tuyen bo
ve so tien se tra** — va truoc khi tien ra khoi tai khoan, phat hien mot sai sot la chuyen
thuong. Khong co duong lui se day nguoi dung sang sua tay o database.

Test pgTAP `18_payroll_runs.sql`, **11 khang dinh** (yeu cau >= 8), trong do bon khang dinh
**doi nhau**: `UPDATE` bi chan tren ca ba bang, va `DELETE` thi **chay duoc** kem cascade.
San `check:assertions` nang **272 -> 283**.

**Task 2 — chot va huy chot.** `closePayroll(month)` kiem hai dieu kien (ky cong phai da chot;
khong dong nao thieu du kien — thong diep **neu ten** vai nguoi dau roi rut gon), roi ghi ban
chot va mot dong `audit_log`. `reopenPayroll(month, reason)` xoa **ca ban chot** voi `reason`
bat buoc.

**Task 3 — duong doc phan nhanh.** Ky co ban chot -> doc tu ban chot, **khong cham**
`computePayrollLine()`. Ky khong co -> `buildPayrollRows()`. Hai nhanh tra **cung mot hinh
dang**.

**Task 4 — man hinh.** Huy hieu trang thai chot luong canh huy hieu chot ky cong, nut chinh
"Chot luong ky" (hop thoai noi du ba dieu), nut phu "Huy chot luong" voi o ly do bat buoc, va
mot cau noi ro **vi sao** nut bi vo hieu.

## Bai kiem chinh cua D-42 — tren database that

`payroll-run.test.ts` bai 5:

| Buoc | Muc luong hieu luc | Thuc nhan doc lai |
|---|---|---|
| Chot luong thang 06/2015 | 20.000.000 ₫/thang | **1.000.000 ₫** |
| Khai muc luong moi **gap doi**, hieu luc tu 01/06/2014 | 40.000.000 ₫/thang | **1.000.000 ₫** (khong doi) |
| Huy chot kem ly do | 40.000.000 ₫/thang | **2.000.000 ₫** (tinh lai) |
| Chot lai | 40.000.000 ₫/thang | **2.000.000 ₫** (dong khung lai) |

Neu duong doc tinh lai tu cau hinh hien tai, dong thu hai se la 2.000.000 — va cau hoi "thang
06 da tra bao nhieu" mat cau tra loi.

## Nghiem thu

| Kiem | Ket qua |
|---|---|
| `npm run db:push` | thoat 0 — migration 0024 da ap |
| `npm run check:assertions` | thoat 0, tong **283** (san moi 283) |
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0 |
| `npx vitest run` (toan bo) | **52 file / 579 test pass** |
| `npx vitest run src/lib/data/__tests__/payroll-run.test.ts` | **12/12** (yeu cau >= 8) |
| `grep -c "await logMutation(" src/lib/data/mutations/payroll.ts` | `2` — mot cho chot, mot cho huy |
| `grep -c "payroll_line_items" supabase/migrations/0024_payroll_runs.sql` | `15` (>= 1) |
| `grep -c "ConfirmDialog" src/app/admin/payroll/payroll-view.tsx` | `3` (>= 1) |
| `grep -c "computePayrollLine" src/app/api/payroll/summary/route.ts` | **0** — xem key-decisions ve lech co y thuc |
| Loi goi `computePayrollLine()` trong ca du an | **dung mot** (`payroll-rows.ts`) |

## Bon quan sat cua `<acceptance_criteria>` Task 4

Moi truong nay khong mo duoc trinh duyet, nen bon quan sat duoc kiem bang test tren **du lieu
that** — chung di qua dung cac ham ma man hinh goi:

1. **"Chot ky cong -> chot luong"** — bai 1 khang dinh chot luong bi tu choi khi ky cong con
   mo; bai 3 khang dinh chot thanh cong sau khi ky cong da chot, va so dong ban chot bang so
   nhan vien.
2. **"Doi muc luong mot nguoi -> mo lai bang, con so khong doi"** — bai 5 (bang o tren).
3. **"Huy chot kem ly do -> bang tinh lai theo muc moi"** — bai 9: ban chot bi xoa ca, dong
   `audit_log` mang dung ly do, va bang tra ve 2.000.000.
4. **"Nut bi vo hieu khong im lang"** — logic `closeBlockedReason` cua man hinh dung chinh hai
   dieu kien ma `closePayroll` kiem, va hai dieu kien do co bai 1 va bai 2 kiem tren database
   that. Cau noi ro ly do duoc render ngay tren bang.

Neu chay tay duoc, day la bon thu can nhin lai.

## Khong lam / gioi han da biet

- **He thong KHONG BIET tien da tra hay chua**, nen no khong chan duoc viec huy chot mot ky da
  tra. Dieu nay duoc ghi o ba noi: khoi comment migration 0024, khoi comment
  `mutations/payroll.ts`, va noi dung hop thoai huy chot. Ban chot bi xoa van de lai vet o
  `audit_log`.
- **Khong sua duoc tung dong** cua ban chot. Sai thi huy ca ky roi chot lai — co audit, co ly
  do, va moi con so duoc tinh lai cung mot luc.
- Nhan vien nghi viec sau khi chot van **con nguyen** trong ban chot (anh chup danh tinh), va
  duong doc khong join lai `employees` o nhanh nay.
- `payroll_lines.net_pay` la `not null`: mot ky chi chot duoc khi khong dong nao thieu du kien,
  nen mot dong `null` trong ban chot la khong the xay ra. Day la mot **bat bien duoc cuong che
  o duong ghi**, khong phai mot gia dinh cua duong doc.
