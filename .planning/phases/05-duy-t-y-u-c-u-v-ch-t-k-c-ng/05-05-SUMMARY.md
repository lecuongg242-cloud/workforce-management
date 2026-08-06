---
phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng
plan: 05
subsystem: period-close
tags: [postgres, plpgsql, trigger, rpc, pgtap, nextjs, route-handler, server-action, zod, vitest, react, ui, admin]

requires:
  - phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng (05-02)
    provides: "tf_apply_approved_request() — noi co tf.applying_approved_request duoc dat (D-32a)"
provides:
  - "tf_attendance_period_guard + trigger attendance_period_guard (migration 0021) — SQLSTATE rieng TF001"
  - "tf_closed_period_start(), tf_close_period() — chot ky, khong co ham nguoc lai (D-32b)"
  - "GET /api/periods + listPeriods(); closePeriod(month) kem audit"
  - "src/lib/attendance/period-guard.ts — lop dich loi trigger thanh cau noi duoc"
  - "/admin/periods — man hinh ky cong va thao tac chot"
affects: ["05-06"]

actuals:
  tasks: 4
  commits: 0

tech-stack:
  added: []
  patterns:
    - "SQLSTATE RIENG (`TF001`) cho mot bat bien, thay vi dung chung `23001` voi cac trigger append-only — de tang ung dung bat duoc DUNG truong hop do va doi thanh mot cau noi duoc"
    - "`tf_closed_period_start()` la `security definer`: mot lop bao ve ma chinh no bi RLS lam mu la mot lop bao ve co lo"
    - "`closed_by = coalesce(auth.uid(), p_closed_by)` — `auth.uid()` LUON thang khi co, nen tham so khong the dung de ghi ten nguoi khac; no chi phuc vu duong dac quyen phia server noi `auth.uid()` rong"
    - "Danh sach ky duoc DUNG RA tu lich (12 thang gan day) va ghep voi dong that neu co; dong `periods` chi duoc tao khi THAT SU chot, khong phai moi lan ai do mo man hinh"

key-files:
  created:
    - supabase/migrations/0021_period_close.sql
    - supabase/tests/15_period_close.sql
    - src/lib/attendance/period-guard.ts
    - src/lib/attendance/__tests__/period-guard.test.ts
    - src/lib/validation/api/periods.ts
    - src/lib/data/periods.ts
    - src/lib/data/mutations/periods.ts
    - src/app/api/periods/route.ts
    - src/app/admin/periods/page.tsx
    - src/app/admin/periods/periods-view.tsx
    - src/lib/data/__tests__/period-close.test.ts
  modified:
    - supabase/tests/run-all.sql
    - scripts/check-pgtap-assertions.mjs
    - src/lib/types/domain.ts
    - src/lib/data/mutations/attendance.ts
    - src/lib/nav.ts
    - src/lib/constants.ts

key-decisions:
  - "**'Ky da chot' KHONG phai ly do tu choi thu tu cua D-20b.** `AttendanceRejectedError` khoa dung ba ly do, va ca ba deu la phan xet ve MOT LAN CHAM CONG cu the (thieu bang chung, ngoai khung gio ca, loi mang). Ky da chot khac loai: no la trang thai cua KY, no chan ca nhung duong ghi khong phai cham cong (sua ban ghi tu man hinh quan tri), va no khong sinh ra tu viec nguoi lao dong lam gi sai. Nhet no vao enum ba gia tri se buoc moi noi dang phan nhanh theo `reason` phai xu ly mot truong hop khong cung loai. Nen no la mot `Error` thuong mang thong diep cua chinh trigger."
  - "Lop dich loi nam o mot MO-DUN THUAN (`period-guard.ts`) chu khong o trong `mutations/attendance.ts`: mot ham trong file `use server` khong xuat duoc (chi async function moi duoc xuat) nen se khong kiem duoc bang unit test. Tach ra doi lay 5 test chay duoc."
  - "`GET /api/periods` dung ra 12 thang gan day tu lich thay vi chi tra cac dong da co trong bang: mot doanh nghiep chua chot ky nao co bang `periods` RONG, va mot man hinh rong thi khong co gi de bam."
  - "Nut 'Chốt kỳ' chi hien voi ky DA KET THUC va DANG MO; ky chua ket thuc hien chu 'Kỳ chưa kết thúc' thay vi mot nut xam khong giai thich gi."
  - "Migration 0021 duoc lam chay-lai-duoc (drop ... if exists o dau), cung khuon 0018 — da dung hai lan trong chinh plan nay khi sua `closed_by` va thong diep cua trigger."

requirements-completed: [PERD-01, PERD-02]
---

# 05-05: Chot ky cong va bao ve ky da chot

## Da lam

**Task 1 — trigger va ham chot ky (migration 0021).**

- `tf_closed_period_start(company_id, work_date)` — ngay bat dau cua ky DA CHOT chua ngay do,
  `security definer` (mot lop bao ve bi RLS lam mu la mot lop bao ve co lo).
- `tf_attendance_period_guard()` + trigger `attendance_period_guard` (`before insert or update
  or delete` tren `attendance_records`): tu choi voi **SQLSTATE rieng `TF001`** khi ngay cua
  dong thuoc ky da chot, **tru khi** `current_setting('tf.applying_approved_request', true) =
  'on'`. Thong diep noi ro thang cua ky.
- `tf_close_period(company_id, start_date, closed_by default null)` — ep tron thang, tu choi ky
  chua ket thuc va ky da chot, tu tao dong ky neu chua co, dat `closed_at = now()` (dong ho
  database) va `closed_by = coalesce(auth.uid(), p_closed_by)`.
- **Khong co ham nguoc lai** (D-32b).

Khoi comment dau file ghi nam viec: vi sao bao ve o database, co la transaction-local va
**canh bao rang dat no o bat ky cho nao khac la mo mot cua hau**, vi sao khong co duong mo lai,
thu tuc go trigger co y thuc, va vi sao file chay lai duoc.

Test pgTAP `15_period_close.sql` — 11 khang dinh, ket thuc bang **hai khang dinh lien nhau**:
co bat -> ghi duoc vao ky da chot; co tat -> bi chan ngay. San assertion 239 -> 250.

**Task 2 — bang chung cai khoa co rang.** `period-close.test.ts`, 8 test tren database dev
that, **dung khoa `service_role`** (bo qua RLS) de chung minh manh hon: khoa do khong bo qua
trigger.

| # | Bai kiem | Ket qua |
|---|---|---|
| 1 | Ky chua chot: ghi binh thuong (trigger khong chan nham — T-05-05-03) | xanh |
| 2 | Chot ky chua ket thuc bi tu choi kem ly do doc duoc | xanh |
| 3 | Chot ky da ket thuc: tu tao dong ky, `closed_by` dung nguoi, mot dong audit; chot lan hai bi tu choi | xanh |
| 4 | Sau khi chot: insert / update / delete thang **deu bi chan**, dong cu nguyen ven | xanh |
| 5 | **Duong hop le van di duoc**: duyet yeu cau bo sung cong tao ban ghi trong ky da chot | xanh |
| 6 | **Ngay sau do, insert thang VAN bi chan** — co khong ro (T-05-05-02) | xanh |
| 7 | Ky thang khac khong bi anh huong | xanh |
| 8 | Thay doi vao ky da chot de lai vet audit mang ca he qua | xanh |

**Task 3 — duong doc, Server Action, thong diep.** `Period`/`PeriodSummary`/`PeriodStatus` vao
`domain.ts`; cap schema hai dau; `GET /api/periods` (chi `owner`/`admin`) dung ra 12 thang gan
day kem ba con so dem tai thoi diem truy van; `closePeriod(month)` goi RPC va ghi **dung mot**
dong audit; `src/lib/attendance/period-guard.ts` doi loi `TF001` thanh cau noi ro thang cua ky
va duong di tiep, dung o ca `checkIn` lan `checkOut`. 5 unit test cho lop dich loi.

**Task 4 — man hinh ky cong.** `/admin/periods`: bang theo thang, trang thai phan biet bang
**bieu tuong + nhan chu**, so nhan vien co cong / so ban ghi / so yeu cau con cho, va voi ky da
chot thi thoi diem chot. Nut "Chốt kỳ" chi hien voi ky da ket thuc va dang mo; `ConfirmDialog`
noi du **ba dieu**: sau khi chot chi doi duoc qua yeu cau duoc duyet, **khong co duong mo lai**,
va so yeu cau con cho neu co. `nav.ts` them muc "Kỳ công" + breadcrumb.

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0; `/admin/periods` va `/api/periods` co trong output |
| `npx vitest run` | 40 file, **411 test xanh** (truoc plan: 396) — khong test nao cua Phase 3/4 vo vi trigger moi (T-05-05-03) |
| `npm run check:assertions` | 250 assertion, sang moc 250 |
| `npm run db:push` | 0021 da ap len database dev |
| `grep -c "tf.applying_approved_request" .../0021_period_close.sql` | 3 |
| `grep -niE "reopen\|mo lai" .../0021_period_close.sql` | 3 dong, **ca ba** nam trong cau noi rang KHONG CO duong do (muc (3) cua comment dau file + comment cua ham) |
| `grep -c "ConfirmDialog" .../periods-view.tsx` | 2 |
| `grep -c "await logMutation(" src/lib/data/mutations/periods.ts` | 1 |
| `grep -niE "mở lại\|hoàn tác\|undo"` (view + constants) | 2 dong, **ca hai** o `constants.ts` va deu la cau noi rang KHONG CO duong mo lai; `periods-view.tsx` khong co dong nao |

**Hai quan sat cua acceptance criteria Task 4** duoc chung minh o tang du lieu thay vi bang mat:
- test 3 — chot mot ky da ket thuc doi `status` sang `closed` va ghi `closed_at`/`closed_by`
  dung nguoi; man hinh doc dung hai truong do;
- test 4 va unit test 3 — ghi vao ngay thuoc ky da chot bi tu choi voi thong diep chua **"đã
  chốt"** va thang cua ky, **khong** chua chuoi loi Postgres tho.

Quan sat tay tren trinh duyet chua lam; e2e vong doi day du thuoc pham vi 05-06.

## Hai sua trong luc thuc thi (bat duoc boi test tich hop)

1. `closed_by` ra `null` khi chay bang khoa `service_role` (khong co `auth.uid()`). Sua thanh
   `coalesce(auth.uid(), p_closed_by)` — `auth.uid()` **luon thang** nen mot nguoi dung dang
   nhap khong the ghi ten nguoi khac vao vet (T-05-05-04), con duong dac quyen phia server thi
   khong con ghi `null`.
2. Thong diep trigger doi tu "đã được chốt" thanh **"đã chốt"** de khop chinh xac acceptance
   criteria cua Task 3 (loi phai chua chu "đã chốt").

Ca hai lan deu nap lai bang `supabase migration repair --status reverted 0021` roi
`npm run db:push` — 0021 duoc lam chay-lai-duoc ngay tu dau, cung khuon 0018.

## Khong lam duoc trong moi truong nay

- `npm run test:db` van **khong chay duoc** (khong co `psql`). `15_period_close.sql` (11 khang
  dinh) da viet va da vao cong `check:assertions` nhung **chua chay that lan nao**. Toan bo
  hanh vi ma no khang dinh **da** duoc phu doc lap boi 8 test tich hop Vitest tren database
  that — ke ca cap khang dinh co-bat/co-tat.

## Du lieu con sot tren database dev

`period-close.test.ts` mo lai ky cua chinh no o `afterAll` (bang khoa secret — mot thao tac
**don dep cua test**, co y khong duoc goi thanh mot ham dung chung, vi khong co duong mo lai
trong ung dung) roi xoa ban ghi cham cong va audit. Doanh nghiep test `cty-0505-<ngau nhien>`
cung dong `periods` cua no o lai, cung tinh chat voi 05-02/05-03/05-04.
