---
phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh
plan: 06
subsystem: phase-gate
tags: [vitest, ci-gate, e2e, uat, planning]

requires:
  - phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh (05-2-01..05-2-05)
    provides: "toan bo phan tinh luong: muc luong, ba che do, danh muc khoan, phep tinh, ban chot"
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-06)
    provides: "khuon cong quet (work-rule-scan.ts) + stripCommentsAndStrings"
  - phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng (05-06)
    provides: "khuon kich ban e2e (e2e-approval.mjs) + khuon bien ban UAT"
provides:
  - "src/__tests__/no-hardcoded-money.test.ts — cong chan con so tien / mau so quy doi nhung cung, chay trong `npm test`"
  - "scripts/e2e-payroll.mjs + `npm run test:e2e-payroll` — mot ky luong dau-cuoi qua HTTP that"
  - "05-2-UAT.md — bien ban nghiem thu kem phep tinh tay doi chieu va tam gioi han da biet"
affects: []

actuals:
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Cong quet thu ba cua du an, dung lai `stripCommentsAndStrings()` cua 04-06 thay vi viet lai — mot bo tach comment thu hai se lech voi bo dau o mot truong hop bien nao do"
    - "Danh sach mien tru CO Y de RONG: mien tru duong dan lam mu toan bo file do ve sau; sua bang NGU NGHIA (`requiresAny`/`forbidsAny`) va ghi ly do trong ma"
    - "Pham vi quet HEP hon 04-06 (chi cac module thuc su ra tien) — mot cong quet ca `src/` se bat nham hang loat con so dinh dang, va ap luc noi long no se lam chinh quy tac bi bao mon"

key-files:
  created:
    - src/__tests__/lib/money-scan.ts
    - src/__tests__/no-hardcoded-money.test.ts
    - scripts/e2e-payroll.mjs
    - .planning/phases/05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh/05-2-UAT.md
  modified:
    - package.json
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md

key-decisions:
  - "`MONEY_SCAN_EXEMPTIONS` de RONG (0 muc, tran cho phep la 3). Khong file nao trong pham vi quet can mien tru — va mot danh sach rong la trang thai TOT NHAT co the co, vi moi muc them vao la mot vung mu vinh vien."
  - "Pham vi quet la mot danh sach duong dan TUONG MINH (7 muc) chu khong phai ca `src/`. Quet rong hon se bat nham con so dinh dang o tang giao dien, va moi lan noi long mot quy tac de dap ung mot truong hop nham la mot lan quy tac do yeu di."
  - "Kich ban e2e go nhan vien chua khai luong ra TRUOC khi chot ky cong, khong phai sau — tu luc ky dong lai, trigger `attendance_period_guard` (0021) chan ca `DELETE` tren `attendance_records`, dung nhu no phai lam. Phat hien nay chinh la mot bang chung phu rang bao ve cua 05-05 con hieu luc."
  - "Bien ban UAT ghi RO la CHUA CO CHU KY. Task 3 la checkpoint chan voi `autonomous: false`; danh dau phase hoan thanh ma khong noi ra dieu do se lam mat dung thu ma checkpoint ton tai de giu."

requirements-completed: [PAY-01, PAY-04, PAY-06]
---

# 05-2-06: Cong cuoi phase, e2e mot ky luong, va nghiem thu

## Da lam

**Task 1 — cong chan con so tien nhung cung.** `money-scan.ts` + `no-hardcoded-money.test.ts`,
ba quy tac: mau so quy doi du phong, so tien nhung cung, ti le phan tram nhung cung. Danh sach
mien tru **rong** (tran cho phep 3). Quet **13 file** (yeu cau >= 6).

**Task 2 — mot ky luong dau-cuoi qua HTTP that.** `scripts/e2e-payroll.mjs` + `npm run
test:e2e-payroll`. Muoi buoc, chay tren dev server that (`localhost:3009`) voi cookie phien
that. Buoc 8 va 9 nam lien nhau va cho **hai ket qua nguoc nhau**.

**Task 3 — bien ban nghiem thu va cap nhat ke hoach.** `05-2-UAT.md` voi nam tieu chi, moi
tieu chi kem quan sat cu the (con so that, thong diep that), **mot phep tinh tay doi chieu**,
va **tam** gioi han da biet (sau muc plan yeu cau + hai muc phat hien khi thuc thi).
`ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md` cap nhat.

## Ba buoc kiem rang cua cong (bat buoc)

| Buoc | Thao tac | Ket qua |
|---|---|---|
| 1 | Them `standardDaysPerMonth ?? 22` vao `rate.ts` dong 73 | **DO** — `1 failed \| 9 passed` |
| 2 | Hoan tac | **XANH** — `3 file / 28 test pass` (ca ba cong cua du an) |
| 3 | `grep -c '?? 22' src/lib/payroll/rate.ts` | **0** — khong con dau vet |

Thong diep cong in ra o buoc 1, nguyen van:

```
src\lib\payroll\rate.ts:73 [mau-so-quy-doi-du-phong] return { value: amount / (standardDaysPerMonth ?? 22), missing: null };
  -> Mau so quy doi phai den tu `company_settings` (D-38). Thieu mau so thi tra `null` kem khoa thieu, khong lui ve mot con so.
```

No noi **dong nao**, **quy tac nao**, va **cach sua dung** — mot cong chi bao "co vi pham" thi
nguoi sua se di tim cach lam no im di.

## Ket qua `npm run test:e2e-payroll`

**Tat ca 26 khang dinh deu xanh.** Cac con so that (chi tiet o `05-2-UAT.md`):

| Nhan vien | Luong goc | Tang ca | Phu cap | Khau tru | Thuc nhan |
|---|---|---|---|---|---|
| Nguyen Van An | 3.000.000 | 750.000 | 500.000 | 0 | **4.250.000** |
| Tran Thi Binh (bi loai tru) | 3.000.000 | 750.000 | **0** | 0 | **3.750.000** |
| Le Van Cuong (chua khai luong) | — | — | — | — | **`null`** |

Cap khang dinh nguoc nhau o buoc 8 va 9:

```
8. DOI MUC LUONG cua An (gap doi) -> con so cua ky DA CHOT khong doi
  OK   muc luong da doi nhung thuc nhan cua ky VAN la 4.250.000
  OK   ban chot giu nguyen MUC LUONG DA AP, khong lay muc moi
  OK   neu ban chot bi tinh lai, con so se la 8.000.000 — no KHONG phai vay

9. HUY CHOT LUONG -> con so DOI THEO muc moi (ket qua NGUOC voi buoc 8)
  OK   trang thai quay ve `open`
  OK   thuc nhan DOI THEO muc moi: 8.000.000
  OK   hai buoc 8 va 9 cho HAI KET QUA NGUOC NHAU tren cung mot du lieu — ban chot that su tu chua
```

## Nghiem thu

| Kiem | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm test` | **53 file / 589 test pass** |
| `npm run build` | thoat 0 |
| `npm run check:assertions` | thoat 0, tong **283** |
| `npx vitest run src/__tests__/no-hardcoded-money.test.ts` | **10/10** |
| Ba cong cua du an cung luc (`money` + `work-rules` + `period-write`) | **28/28** — khong cong cu nao hoi quy |
| `npm run test:e2e-payroll` | thoat 0, **26/26 khang dinh** |
| `git status` sau khi chay e2e | sach — khong file tam nao |
| `05-2-UAT.md` | 5 tieu chi + phep tinh tay khop + **8** gioi han da biet |
| `ROADMAP.md` Phase 5.2 | `[x]` du 6 plan, `6/6 plans executed`, bang Progress `Complete 2026-08-06` |
| `REQUIREMENTS.md` | PAY-01 / PAY-04 / PAY-06 -> `[x]` va `Complete` |
| `STATE.md` | `current_phase: 6`, D-36…D-45 + quyet dinh khi thuc thi, 4 blocker moi |

### Phep tinh tay doi chieu (trich `05-2-UAT.md`)

Nguyen Van An, thang 05/2016, luong 20.000.000 ₫/thang, 20 ngay cong chuan, 8 gio/ngay:

```
don gia ngay = 20.000.000 / 20  = 1.000.000 ₫
don gia gio  =  1.000.000 /  8  =   125.000 ₫
luong goc    = 1.000.000 × 3    = 3.000.000 ₫
tien tang ca =   125.000 × 6    =   750.000 ₫
phu cap      =                    500.000 ₫
THUC NHAN                       = 4.250.000 ₫
```

He thong tra `netPay = 4250000`. **Bang nhau.**

## Khong lam / gioi han da biet

- **Bien ban `05-2-UAT.md` CHUA CO CHU KY cua chu du an.** Task 3 la mot
  `checkpoint gate="blocking"` va plan khai `autonomous: false`. Moi quan sat trong bien ban la
  quan sat that tren he thong chay that (HTTP that + database that), nhung **buoi nghiem thu
  cung chu du an chua dien ra**. Day la viec dau tien can lam truoc khi sang Phase 6.
- **Chua ai nhin bang mat tren trinh duyet.** Bon thu can bam tay duoc liet ke o `05-2-UAT.md`
  §"Dieu bien ban nay khong nhan la da lam".
- `e2e-payroll` **khong chung minh duong ghi cua tang ung dung** — moi thao tac ghi la Server
  Action (D-12c) va script ngoai khong goi duoc. Cac buoc ghi duoc danh dau `[mo phong ghi]`
  va goi thang cac lenh ma Server Action goi; ban than cac Server Action duoc phu boi test
  tich hop tren database that.
- Fixture cua `e2e-payroll` **khong don het**: `employee_pay_rates` bi trigger append-only 0022
  chan xoa, nen chuoi cascade dung lai o do va doanh nghiep test o lai. Doanh nghiep mang id
  ngau nhien nen khong dung lai giua cac lan chay. Cach don: mot lan `npm run db:seed`.
- **Pham vi quet cua cong hep hon 04-06** (7 duong dan tuong minh thay vi ca `src/`). Mot mau
  so du phong viet trong mot file NGOAI pham vi do se khong bi bat. Danh doi co y thuc: quet
  rong hon se bat nham hang loat con so dinh dang, va ap luc noi long quy tac se lam chinh no
  bi bao mon.
