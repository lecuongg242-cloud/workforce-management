---
phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai
plan: 03
subsystem: holidays
tags: [nextjs, route-handler, server-action, zod, vitest, integration-test, react, ui, admin]

requires:
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-01)
    provides: "khung bon tab cua /admin/settings"
  - phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p (01-05)
    provides: "bang holidays + RLS + unique(company_id, holiday_date), co y de rong"
provides:
  - "GET /api/holidays?year= — ngay le theo nam cua doanh nghiep trong phien"
  - "createHoliday/updateHoliday/deleteHoliday/countAffectedAttendance (Server Action + audit)"
  - "Tab 'Ngay le' trong /admin/settings, kem canh bao khi cham vao qua khu (D-25b)"
affects: ["04-05"]

actuals:
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Nam mac dinh cua GET /api/holidays lay qua `tf_server_now()` + `tf_work_date()` chu khong cat chuoi ISO: chuoi ISO la UTC nen cat tay se sai nam trong 7 tieng dau nam moi"
    - "`audit_log.reason` mang con so ban ghi bi anh huong TAI THOI DIEM GHI (dem lai trong chinh ham ghi), khong dung con so ma giao dien doc truoc do vai phut"

key-files:
  created:
    - src/lib/validation/api/holidays.ts
    - src/app/api/holidays/route.ts
    - src/lib/data/holidays.ts
    - src/lib/data/mutations/holidays.ts
    - src/components/settings/holidays-tab.tsx
    - src/components/settings/holiday-dialog.tsx
    - src/lib/data/__tests__/holidays.test.ts
    - src/lib/data/__tests__/holidays-mutations.test.ts
  modified:
    - src/lib/types/domain.ts
    - src/app/admin/settings/settings-view.tsx
    - src/app/admin/settings/page.tsx
    - src/lib/constants.ts

key-decisions:
  - "Task 2 lam TEST TICH HOP tren database that thay vi mock: hai hanh vi quan trong nhat (id doanh nghiep khac khong sua/xoa duoc; `countAffectedAttendance` dem dung) chi co y nghia khi chay tren rang buoc that va RLS that."
  - "`countAffectedAttendance` doi vai tro owner/admin — no lo so ban ghi cham cong cua mot ngay, la thong tin quan tri, khong phai thong tin cong khai."
  - "Canh bao qua khu KHONG hien khi so ban ghi bang 0: hoi thua lam nguoi dung bam qua ma khong doc, va lam mat gia tri cua chinh canh bao khi no THAT SU can duoc doc."
  - "Sua mot ngay le doi CA ngay -> audit ghi con so bi anh huong cua CA ngay cu lan ngay moi; giao dien cung dem ca hai roi cong lai truoc khi hoi."
  - "Placeholder cua o ten ngay le co y KHONG phai mot ngay le quoc gia — goi y 'Quoc khanh'/'Tet' la mot cach ngam de xuat rang he thong biet truoc lich nghi, trai voi D-26."
  - "`page.tsx` lay `getServerToday()` roi truyen xuong lam prop: tab can biet ngay nao thuoc qua khu ma khong duoc dung `new Date()` (rule ESLint `timeflow/no-date-in-client`)."

requirements-completed: [SET-02]
---

# 04-03: Ngay nghi le do doanh nghiep tu khai (SET-02)

## Da lam

**Task 1 — duong doc.** `GET /api/holidays?year=` tra ngay le cua doanh nghiep trong phien,
sap xep theo ngay tang dan; khong truyen `year` thi lay nam hien tai theo dong ho SERVER
(`tf_server_now` -> `tf_work_date`, khong cat chuoi ISO). Moi vai tro dang nhap deu doc duoc.
8 test don vi (schema + `listHolidays`).

**Task 2 — ba duong ghi.** `createHoliday` / `updateHoliday` / `deleteHoliday` theo khuon
`mutations/work-sites.ts`, cong `countAffectedAttendance(date)`. Trung ngay tra thong diep
tieng Viet (bat rieng ma `23505`), khong phai loi Postgres tho. 7 test tich hop tren database
that.

**Task 3 — tab "Ngay le".** Bo chon nam (3 nam truoc + 1 nam sau), bang ngay/ten/hanh dong,
ngay da qua co nhan chu "da qua" (khong phan biet bang mau don thuan), trang thai rong noi
dung tinh than D-26. Sua hoac xoa mot ngay THUOC QUA KHU va ngay do co ban ghi cham cong thi
mo `ConfirmDialog` mang con so THAT do server dem.

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` / `lint` / `build` | thoat 0 |
| `npx vitest run` | 29 file, 289 test xanh (truoc plan: 272) |
| Test tich hop `holidays-mutations.test.ts` | 7/7 tren DB that |
| `grep new Date()` trong `src/components/settings/` | chi 2 dong COMMENT giai thich vi sao khong dung |
| Ngay le cai san o bat ky tang nao | khong co — `seed.sql` giu nguyen khoi comment "CO Y de rong" |

Bang chung dang chu y tu test tich hop:
- `countAffectedAttendance(PAST_DATE)` tra dung `2` (hai ban ghi cua hai nhan vien), `0` cho
  ngay chua co ban ghi;
- `updateHoliday`/`deleteHoliday` voi `id` cua cty-02: nem "Khong tim thay ngay nghi le" va
  dong do **van con nguyen** trong database — khong im lang thanh cong;
- vai tro `manager` bi tu choi o ca ba duong ghi **lan** o phep dem;
- audit cua thao tac tren ngay qua khu mang `reason` chua "2 ban ghi cham cong".

## Khong lam duoc trong moi truong nay

- Quan sat tay tren trinh duyet (bam Xoa mot ngay qua khu, doc chu trong hop canh bao): chua
  lam — hanh vi tuong duong da duoc phu bang test tich hop.
