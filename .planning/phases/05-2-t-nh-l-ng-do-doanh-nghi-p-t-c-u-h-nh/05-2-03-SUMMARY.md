---
phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh
plan: 03
subsystem: pay-adjustments
tags: [postgres, rls, nextjs, route-handler, server-action, zod, vitest, react, ui, admin, settings, pure-module]

requires:
  - phase: 05-2-t-nh-l-ng-do-doanh-nghi-p-t-c-u-h-nh (05-2-01)
    provides: "khuon bang moi + RLS 4 policy, khuon duong doc/ghi kem logMutation, san check:assertions 262"
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-01, 04-03)
    provides: "khung 4 tab cua /admin/settings; khuon tab co bang + dialog (holidays-tab)"
provides:
  - "pay_adjustments + pay_adjustment_scopes (migration 0023) — danh muc khoan va pham vi hai chieu"
  - "src/lib/payroll/scope.ts — isTargeted / resolveTargets / describeScopes (mo-dun thuan)"
  - "GET /api/pay-adjustments + listPayAdjustments()"
  - "createPayAdjustment / updatePayAdjustment / deactivatePayAdjustment (KHONG co duong xoa)"
  - "Tab thu nam 'Phu cap & khau tru' o /admin/settings, kem khoi xem truoc nguoi bi ap"
affects: ["05-2-04", "05-2-05", "05-2-06"]

actuals:
  tasks: 4
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Pham vi va loai tru la HAI CHIEU (`mode` include/exclude) tren cung mot bang, khong phai hai gia tri cua mot danh sach — do la thu duy nhat dien dat duoc 'toan cong ty tru may nguoi'"
    - "`exclude` LUON thang `include`, ke ca khi `include` cu the hon: quy tac doan duoc quan trong hon quy tac thong minh khi nguoi khai khong co cach kiem lai ngoai khoi xem truoc"
    - "Pham vi la mot TAP, khong phai chuoi lich su -> duong ghi nhan ca tap moi lan va `replaceScopes()` xoa het roi chen lai"
    - "`.superRefine()` cua Zod nhan lai dung hai rang buoc CHECK lien truong cua migration (per_late + allowance, percent > 100) de tra ve cau tieng Viet doc duoc"
    - "Mo-dun thuan nhan NHAN qua tham so (`describeScopes({labels})`) thay vi import `constants.ts` — khong keo cay phu thuoc giao dien vao mot phep tinh"

key-files:
  created:
    - supabase/migrations/0023_pay_adjustments.sql
    - supabase/tests/17_pay_adjustments.sql
    - src/lib/payroll/scope.ts
    - src/lib/payroll/__tests__/scope.test.ts
    - src/lib/validation/api/pay-adjustments.ts
    - src/lib/data/pay-adjustments.ts
    - src/lib/data/mutations/pay-adjustments.ts
    - src/app/api/pay-adjustments/route.ts
    - src/components/settings/pay-adjustments-tab.tsx
    - src/components/settings/pay-adjustment-dialog.tsx
    - src/lib/data/__tests__/pay-adjustments.test.ts
  modified:
    - supabase/tests/run-all.sql
    - scripts/check-pgtap-assertions.mjs
    - src/lib/types/domain.ts
    - src/app/admin/settings/settings-view.tsx
    - src/lib/constants.ts

key-decisions:
  - "`scope_value` KHONG dat khoa ngoai: ba loai (`department`/`position`/`employee`) tro toi ba dich khac nhau va mot khoa ngoai chi ap duoc cho mot trong ba. Doi lai, rang buoc CHECK ep 'company thi phai NULL, ba loai kia thi phai co gia tri' — hai ve, chan hai cach khai vo nghia nguoc nhau."
  - "So khop `position` KHONG chuan hoa dau va KHONG bo phan biet hoa thuong. Mot phep so khop 'thong minh' se gom nham hai chuc vu that su khac nhau — va do la loi NANG HON: no CONG tien cho nguoi khong duoc huong, thay vi hien 0 nguoi mot cach de thay."
  - "Nhanh `default` cua `matches()` tra `false` cho mot `scope_type` chua biet: mot loai them vao database ma quen them o day thi KHONG khop ai — chieu an toan la khong ai bong nhien nhan them tien."
  - "Chieu 'loai tru' o giao dien CHI cho chon theo tung nguoi. 'Toan cong ty tru phong Kho' doc ra giong 'chi phong Kho', va chua co yeu cau nao can no."
  - "Doi `kind` ve `allowance` trong dialog tu keo `basis` ve `per_period`: neu khong, nguoi dung se gap mot loi kho hieu ngay luc bam luu thay vi thay lua chon do bien mat."
  - "Bang van giu policy RLS `delete` tren `pay_adjustments`. Quy tac 'khong xoa khoan' nam o TANG UNG DUNG (khong co Server Action xoa); mot lop RLS mang y nghia nghiep vu se lam nguoi sau tuong ranh gioi doanh nghiep va quy tac nghiep vu la cung mot thu."
  - "Khoan DA TAT van tra ve trong `GET /api/pay-adjustments` (xep sau khoan dang bat): no la mot phan cua chinh sach va man hinh phai bat lai duoc."

requirements-completed: [PAY-04]
---

# 05-2-03: Danh muc phu cap / khau tru va pham vi ap dung

## Da lam

**Task 1 — hai bang (migration 0023).** `pay_adjustments` (`kind`, `value_type`, `value`,
`basis`, `is_active`) va `pay_adjustment_scopes` (`mode`, `scope_type`, `scope_value`).
Bon rang buoc CHECK chan bon cach khai vo nghia: `company` kem gia tri, `department` khong gia
tri, `per_late` voi `allowance` (D-41), va `percent_of_daily_wage > 100`.

Khoi comment dau file viet ra **vi sao hai bang chu khong phai mot cot mang**: chinh sach that
co hinh dang "toan cong ty, **tru** may nguoi", va do la hai chieu. Ep thanh mot danh sach thi
cach khai duy nhat con lai la liet ke tay 37 nguoi — va nguoi thu 41 mat phu cap dang co ma
khong ai bao dong. Kem muc (3) ghi ro gioi han D-40a (thuong thang / tam ung / phat mot lan
chua nhap duoc) va muc (4) ghi ro vi sao khong co duong xoa.

Test pgTAP `17_pay_adjustments.sql`, **10 khang dinh**: ba ve `scope_value` khop `scope_type`,
hai ve cach khai vo nghia o bang khoan, ba ve cascade (pham vi bi xoa theo khoan), hai ve co
lap cheo. San `check:assertions` nang **262 -> 272**.

**Task 2 — mo-dun thuan `scope.ts`.** `isTargeted()` / `resolveTargets()` / `describeScopes()`.
Ba quy tac, moi quy tac kem ly do trong khoi comment:
1. **Khong `include` nao -> khong ai bi ap.** Im lang khong phai la "tat ca".
2. **`exclude` luon thang `include`**, ke ca khi `include` cu the hon — quy tac *doan duoc*
   ("bi loai tru thi khong duoc, het") quan trong hon quy tac thong minh.
3. **`position` so khop chuoi**, chi cat khoang trang hai dau.

Test **14 khang dinh** (yeu cau >= 10), gom du bon bai bat buoc: 38/40, **39/41 sau khi them
mot nguoi moi**, `exclude` cu the thang `include` rong **va** `exclude` rong thang `include`
cu the, va khong `include` nao thi khong ai bi ap. Kem mot bai khang dinh **thu tu cac dong
khong lam doi ket qua**.

**Task 3 — duong doc va ba duong ghi.** `GET /api/pay-adjustments` tra moi khoan **kem pham
vi** (khoan dang bat truoc), chi `owner`/`admin`. Ba Server Action: `createPayAdjustment`,
`updatePayAdjustment` (ghi khoan **va** pham vi trong cung thao tac), `deactivatePayAdjustment`.
Moi thao tac de lai mot dong `audit_log` mang **nguyen khoan kem pham vi** truoc va sau — do la
thu duy nhat tra loi duoc "truoc do khoan nay ap cho ai".

Test tich hop **9 test** (yeu cau >= 6) tren database dev that.

**Task 4 — tab thu nam "Phu cap & khau tru".** Bang cac khoan (loai phan biet bang **bieu tuong
cong nhan chu**, khong bang mau don thuan), va dialog bon phan voi **khoi xem truoc** o cuoi
chay `resolveTargets()` — dung mo-dun ma phep tinh luong se dung.

## Bang chung "toan cong ty tru 2 nguoi" tren database that

Test tich hop so 2 va so 3 (`pay-adjustments.test.ts`):

| Buoc | Nhan vien | Pham vi khai | Nguoi bi ap |
|---|---|---|---|
| Khai khoan | 3 | 1 include/company + 2 exclude/employee | **1** (3 − 2) |
| Tuyen them 1 nguoi | 4 | **khong sua gi** | **2** (4 − 2) |

Neu pham vi duoc khai bang cach liet ke tay, con so o dong thu hai van la 1 — va nguoi moi
tuyen mat phu cap dang co ma **khong co gi bao dong**.

## Nghiem thu

| Kiem | Ket qua |
|---|---|
| `npm run db:push` | thoat 0 — migration 0023 da ap |
| `npm run check:assertions` | thoat 0, tong **272** (san moi 272) |
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0 |
| `npx vitest run` (toan bo) | **48 file / 512 test pass** |
| `npx vitest run src/lib/payroll/__tests__/scope.test.ts` | **14/14** (yeu cau >= 10) |
| `npx vitest run src/lib/data/__tests__/pay-adjustments.test.ts` | **9/9** (yeu cau >= 6) |
| `npx vitest run src/__tests__/route-handlers-get-only.test.ts` | pass — `/api/pay-adjustments` chi xuat `GET` |
| `grep -cE "supabase\|process\.env\|new Date" src/lib/payroll/scope.ts` | **0** |
| `grep -c "resolveTargets" src/components/settings/pay-adjustment-dialog.tsx` | `3` (>= 1) |

**Kiem bang mat `.delete()` trong `mutations/pay-adjustments.ts`:** dung **mot** loi goi, o dong
72, ben trong `replaceScopes()` — no xoa `pay_adjustment_scopes` de ghi lai ca tap pham vi.
**Khong** co loi goi `.delete()` nao tren `pay_adjustments`, va khong co ham xoa khoan nao duoc
xuat ra tu file. (Dong 23 la mot lan xuat hien trong khoi comment giai thich chinh dieu do.)

**8 policy tren hai bang moi:** kiem qua `pg_policies` khong chay duoc o may phat trien (khong
co `psql` — da biet tu CONTEXT). Bang chung thay the: migration khai tuong minh 4 policy moi
bang, va cong `00_rls_coverage.sql` (chay trong `run-all.sql`) se do neu bat ky bang nao trong
`public` bat RLS ma khong co policy. Hai khang dinh co lap cheo cua
`17_pay_adjustments.sql` chung minh policy that su co hieu luc, khong chi ton tai.

## Khong lam / gioi han da biet

- **Khong mot con so tien nao duoc tinh o plan nay** — dung nhu prohibition.
  `percent_of_daily_wage` moi chi la mot cach khai gia tri; quy ra tien la 05-2-04.
- **Quan sat giao dien o `<acceptance_criteria>` cua Task 4 chua chay duoc bang tay** (moi
  truong nay khong mo duoc trinh duyet). Bang chung thay the la test tich hop so 2/so 3 o tren:
  chung chay **dung ham** `resolveTargets()` ma khoi xem truoc goi, tren du lieu that, va cho
  dung con so "tong − 2". Cau tom tat "Toan cong ty, tru 2 nguoi" duoc kiem rieng boi bai 13
  cua `scope.test.ts`. Neu chay tay duoc, day la hai thu can nhin lai.
- Loai tru theo phong ban / chuc vu **khai duoc o database** nhung giao dien khong cho chon —
  xem key-decisions. Mot khoan da khai kieu do (qua duong khac) van duoc `scope.ts` giai dung.
- Phat di muon chi dem **so lan**, khong phan bac theo so phut (gioi han cua D-41, da ghi trong
  comment cua cot `basis`).
