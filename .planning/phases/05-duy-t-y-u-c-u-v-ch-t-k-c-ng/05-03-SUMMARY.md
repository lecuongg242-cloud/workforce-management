---
phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng
plan: 03
subsystem: overtime-cap
tags: [postgres, nextjs, route-handler, server-action, zod, vitest, react, ui, admin, settings]

requires:
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-01, 04-05)
    provides: "company_settings + updateCompanySettings (duong ghi duy nhat), classification-context.ts (nguon duy nhat cua gio tang ca)"
  - phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng (05-01, 05-02)
    provides: "man hinh duyet + ReviewDialog (05-01), khoi xem truoc tac dong trong dialog (05-02)"
provides:
  - "company_settings.overtime_cap_hours_per_month (migration 0019) — tran tang ca doanh nghiep tu dat, NULL = khong gioi han"
  - "src/lib/attendance/overtime-cap.ts — isOverCap / capUsageSummary / requestedOvertimeHours (mo-dun thuan)"
  - "GET /api/requests/overtime-usage + getOvertimeUsage()"
  - "Canh bao vuot tran trong hop thoai duyet, kem dau vet trong lich su xu ly"
affects: ["05-06"]

actuals:
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "`nullable()` va `optional()` trong schema dau vao la HAI dieu khac nhau va deu can: `null` = xoa tran (mot gia tri co nghia), khong gui truong = giu nguyen. Phep hop nhat dung `!== undefined`, khong dung `??`"
    - "`z.preprocess` doi `NaN` cua `valueAsNumber` (o so rong) thanh `null` TRUOC khi kiem — neu khong, 'de trong' se thanh mot loi nhap lieu thay vi mot cau tra loi hop le"
    - "Tran doi chieu voi `overtimeMinutes` (gio tang ca THAT) chu khong `convertedOvertimeHours` (gio quy doi theo he so): tran la gioi han ve THOI GIAN LAM VIEC, khong phai ve tien cong"

key-files:
  created:
    - supabase/migrations/0019_overtime_cap.sql
    - src/lib/attendance/overtime-cap.ts
    - src/lib/attendance/__tests__/overtime-cap.test.ts
    - src/app/api/requests/overtime-usage/route.ts
    - src/lib/data/__tests__/overtime-cap.test.ts
  modified:
    - src/lib/types/domain.ts
    - src/lib/validation/api/settings.ts
    - src/lib/validation/api/requests.ts
    - src/lib/settings/company-settings.ts
    - src/lib/data/mutations/settings.ts
    - src/lib/data/requests.ts
    - src/components/settings/general-settings-form.tsx
    - src/components/requests/review-dialog.tsx
    - src/app/admin/requests/requests-review-view.tsx
    - src/lib/constants.ts
    - src/lib/data/__tests__/settings.test.ts
    - src/lib/data/__tests__/attendance-review.test.ts

key-decisions:
  - "'Gio da dung' tach thanh HAI dai luong tra ve rieng: `actualHours` (tu cham cong that, mo-dun Phase 4) va `registeredHours` (cac yeu cau tang ca KHAC da duoc duyet trong thang — phan da cho phep nhung chua lam). Bo `registeredHours` se lam nguoi duyet ky bon yeu cau lien tiep ma khong lan nao thay canh bao."
  - "`excludeRequestId` loai chinh yeu cau dang xet khoi phan 'da dung' — no la phan 'yeu cau nay them', cong ca hai ve se bao vuot gap doi."
  - "Yeu cau tang ca KHONG goi `tf_preview_request_effect` nua (no luon tra 0 theo D-31); thay vao do goi duong doc gio da dung. Hai loai yeu cau, hai cau hoi khac nhau, mot cho hien thi."
  - "Duyet khi da vuot tran tu dong them mot ghi chu vao `note` cua lan xu ly (T-05-03-03): dong `request_reviews` la append-only nen dau vet do khong sua duoc — sau nay doc lai biet quyet dinh duoc dua ra khi canh bao dang hien."
  - "Chu tren nut duyet doi thanh 'Vẫn duyệt (vượt trần)' khi vuot — nut van bam duoc, chi la cai bam tro thanh mot quyet dinh chu khong phai mot phan xa."

requirements-completed: [SET-05]
---

# 05-03: Tran tang ca cua doanh nghiep va canh bao vuot tran

## Da lam

**Task 1 — tran trong cau hinh (migration 0019).** Mot cot them vao
`company_settings`: `overtime_cap_hours_per_month numeric(6,2) null` kem
`check (... is null or ... > 0)`. **Khong co mac dinh** — khoi comment cua migration ghi ro
ranh gioi: bon cot cung bang la nguong van hanh + dinh nghia phap ly (D-27/D-29, co diem khoi
dau dung duoc), con tran tang ca la con so nghiep vu doanh nghiep tu quyet (D-26). Rang buoc
`> 0` chinh la de "chua dat gioi han" chi co MOT cach viet (`null`).

Kieu, cap schema hai dau, `loadCompanySettings`, `updateCompanySettings` (duong ghi **duy
nhat**, khong mo duong thu hai) va form tab Chung deu mo rong. O nhap la truong duy nhat cua
form **khong** `required`, `placeholder="Không giới hạn"`.

**Task 2 — ba con so.** `src/lib/attendance/overtime-cap.ts` (mo-dun thuan):

- `isOverCap()` — `false` khi `capHours === null`; `false` khi tong **bang dung** tran; `true`
  khi lon hon.
- `capUsageSummary()` — bon con so hien thi (da dung / yeu cau nay them / tran / vuot).
- `requestedOvertimeHours()` — gio dang ky cua mot yeu cau tu `fromTime`/`toTime`, 0 khi khong
  khai gio, tinh vong qua nua dem.

`GET /api/requests/overtime-usage?employeeId&month&excludeRequestId` tra `actualHours`
(tu `classification-context.ts` — nguon cua Phase 4, khong cot nao luu san), `registeredHours`,
`usedHours`, `capHours`. Tang quyen giong `GET /api/attendance/classification`.

11 test thuan + 5 test tich hop tren database dev that (doanh nghiep rieng), gom bai doi tran
20 -> 8 -> `null` va khang dinh `usedHours` **khong doi** o ca ba lan.

**Task 3 — canh bao tai dung luc bam.** Hop thoai duyet (cung cho voi khoi xem truoc cua
05-02) hien khoi canh bao ho phach voi **bon con so that** khi vuot tran; nut duyet doi chu
thanh "Vẫn duyệt (vượt trần)" nhung **van bam duoc**. Tran de trong -> khong khoi nao. Duyet
khi vuot tran tu dong them ghi chu vao lich su xu ly.

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0; `/api/requests/overtime-usage` co trong output |
| `npx vitest run` | 37 file, **387 test xanh** (truoc plan: 365) |
| `npm run db:push` | 0019 da ap len database dev |
| `npx vitest run src/lib/attendance/__tests__/overtime-cap.test.ts` | 11 test (yeu cau: >= 6) |
| `npx vitest run src/lib/data/__tests__/overtime-cap.test.ts` | 5 test (yeu cau: >= 4) |
| `npx vitest run src/lib/data/__tests__/settings.test.ts` | 14 test (them 4 test cho truong de trong) |
| `grep -nE "throw\|Forbidden\|block" src/lib/attendance/overtime-cap.ts` | **khong dong nao** — mo-dun nay chi tra loi, khong tu choi ai |
| `grep -c "isOverCap" src/components/requests/review-dialog.tsx` | 2 |
| `grep -c "classification-context" .../overtime-usage/route.ts` | 2 — gio da dung den tu nguon cua Phase 4 |
| `grep -c "await logMutation(" src/lib/data/mutations/settings.ts` | 1 — khong duong ghi thu hai |
| `grep -niE "không thể duyệt\|bị chặn\|không cho phép"` (dialog + constants) | **khong dong nao** — khong nhan nao noi yeu cau bi tu choi vi vuot tran |

**Hai quan sat cua acceptance criteria Task 3** duoc chung minh o tang quyet dinh thay vi bang
mat (duong ghi la Server Action, khong goi duoc tu script ngoai):

- test thuan #6 dung **dung bo so cua acceptance criteria** — da dung 18 gio, yeu cau them 4
  gio, tran 20 gio -> `isOver: true`, `overHours: 2`. Hop thoai render dung bon truong do
  (`capUsage.usedHours` / `requestedHours` / `capHours` / `overHours`), va nut duyet chi doi
  CHU chu khong doi `disabled` — khong nhanh nao trong file lam nut khong bam duoc.
- test thuan #8 (`capHours: null`) tra `isOver: false`, va khoi canh bao trong dialog render
  duoi dieu kien `capUsage?.isOver` — tran de trong thi khong khoi nao xuat hien.

Quan sat tay tren trinh duyet chua lam; e2e vong doi day du thuoc pham vi 05-06.

## Mot sua ngoai pham vi (bat buoc)

`attendance-review.test.ts` (03-06) dung mot client gia lap tra dong `company_settings`; them
mot cot vao bang lam `companySettingsRowSchema` tu choi dong gia lap do va 10 test do. Da them
`overtime_cap_hours_per_month: null` vao fixture. Day chinh la lop bao ve hoat dong dung: cap
schema hai dau bat duoc mot dong du lieu khong con khop hinh dang thuc te.

## Khong lam duoc trong moi truong nay

- Khong them test pgTAP nao o plan nay (plan khong yeu cau; rang buoc `> 0` va tinh chat
  `null` da duoc phu boi test tich hop tren database that qua `updateCompanySettings`).
- `npm run test:db` van **khong chay duoc** (khong co `psql`) — nguyen van blocker cua 04-06.

## Du lieu con sot tren database dev

`overtime-cap.test.ts` dung doanh nghiep rieng `cty-0503-<ngau nhien>`; ban ghi cham cong, yeu
cau va audit cua no da duoc don sach o `afterAll`, nhung ban than doanh nghiep + cau hinh +
phong ban + ca + nhan vien thi o lai (cung ly do voi 04-05 va 05-02).
