---
phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng
plan: 02
subsystem: request-effect
tags: [postgres, plpgsql, rpc, pgtap, nextjs, route-handler, server-action, zod, vitest, react, ui, admin]

requires:
  - phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng (05-01)
    provides: "reviewRequest() + man hinh /admin/requests + request_reviews"
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-05)
    provides: "mo-dun phan loai cong (nguon DUY NHAT cua gio tang ca) + GET /api/attendance/summary"
provides:
  - "tf_apply_approved_request(text) — toan bo phan ghi cua mot yeu cau da duyet, trong MOT transaction (D-32a)"
  - "tf_preview_request_effect(text) — cung phep dem, khong ghi gi"
  - "tf_leave_target_days(text) — cac ngay mot don nghi thuc su nham toi (D-35)"
  - "work_requests.applied_at — bat bien chong ap dung hai lan"
  - "kieu tf_request_effect + GET /api/requests/[id]/effect + previewRequestEffect()"
  - "reviewRequest() tra {request, effect}; hop thoai duyet hien truoc tac dong"
affects: ["05-03", "05-04", "05-05", "05-06"]

actuals:
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Phan ghi nam TRON trong mot ham SQL, tang ung dung goi DUNG MOT RPC — bat buoc boi D-32a: co `tf.applying_approved_request` la transaction-local va PostgREST chay moi lenh trong mot transaction rieng"
    - "Ham tra kieu composite (`tf_request_effect`) thay vi `returns table`: PostgREST tra ve MOT object thay vi mang mot phan tu, nen hinh dang o TypeScript khong phai bo mot lop `[0]`"
    - "`tf_preview_request_effect` CO Y khong kiem trang thai — no duoc goi khi yeu cau con `pending`, tuc la truoc khi duyet"
    - "Migration 0018 chay lai duoc (`add column if not exists` + `drop ... if exists` o dau): mot migration chua phat hanh ma sua duoc tai cho thi khong phai de lai mot file 0019 chi de va mot dong"

key-files:
  created:
    - supabase/migrations/0018_apply_approved_request.sql
    - supabase/tests/13_apply_approved_request.sql
    - src/app/api/requests/[id]/effect/route.ts
    - src/lib/data/__tests__/request-effect.test.ts
  modified:
    - supabase/tests/run-all.sql
    - scripts/check-pgtap-assertions.mjs
    - src/lib/types/domain.ts
    - src/lib/validation/api/requests.ts
    - src/lib/data/requests.ts
    - src/lib/data/mutations/requests.ts
    - src/app/admin/requests/requests-review-view.tsx
    - src/components/requests/review-dialog.tsx
    - src/lib/data/__tests__/request-review.test.ts

key-decisions:
  - "`conflicted` cua `tf_leave_target_days` la 'ngay do da co BAT KY dong attendance_records nao', khong chi 'da co cham cong that'. Mot dong nghi phep sinh tu mot yeu cau truoc do cung la du lieu cua ngay do, va cung khong duoc chong len."
  - "`attendance_supplement` va `time_adjustment` tinh LAI `late_minutes` + `status` tu gio cua yeu cau va gio bat dau ca. Giu nguyen do muon cu sau khi doi gio vao la de lai mot con so noi ve mot gio vao khong con ton tai."
  - "`worked_minutes` truyen `p_break_minutes = 0`: tu migration 0014, con so tren mot DONG la thoi luong THO; gio nghi duoc tru mot lan cho ca ngay o tang doc."
  - "Tran 366 ngay cho khoang ngay cua yeu cau (T-05-02-05) dat trong ham SQL chu khong o schema dau vao — no phai chan ca duong goi RPC truc tiep, khong chi duong di qua bieu mau."
  - "Hop thoai duyet KHONG goi xem truoc cho yeu cau tang ca; thay vao do hien mot cau noi ro duyet la CHO PHEP LAM THEM (D-31). Mot o '0 ngày công' cho tang ca se doc nhu mot loi chu khong phai mot cau tra loi."
  - "Loi khi lay xem truoc KHONG chan viec duyet: thieu con so la mat mot tro giup, khong phai mat quyen quyet dinh."

requirements-completed: [APRV-03]
---

# 05-02: Tac dong cua yeu cau duoc duyet len du lieu cong

## Da lam

**Task 1 — ham SQL (migration 0018).** `work_requests.applied_at` (bat bien chong ap dung hai
lan, nam ngay canh du lieu no bao ve). Kieu composite `tf_request_effect`
(`inserted_count`, `updated_count`, `skipped_count`, `skipped_dates`). Ba ham:

- `tf_leave_target_days(request_id)` — cac ngay mot don nghi THUC SU nham toi: trong khoang,
  thuoc `working_days` cua ca, khong phai ngay le da khai (D-35); kem co `conflicted` cho ngay
  da co du lieu cham cong.
- `tf_preview_request_effect(request_id)` — cung phep dem, khong ghi gi, khong kiem trang thai.
- `tf_apply_approved_request(request_id)` — dat co `tf.applying_approved_request` o **dau ham**
  (D-32/D-32a), kiem trang thai `approved` + `applied_at is null`, tran 366 ngay, roi re nhanh
  theo bon loai yeu cau: `leave` chen mot dong hai-cot-null (`leave_paid`) cho tung ngay khong
  xung dot; `attendance_supplement` chen mot dong voi gio tu chinh yeu cau; `time_adjustment`
  **sua** dong da co (khong tim thay thi **nem loi**, khong tu tao moi); `overtime` **khong ghi
  gi** (D-31). Cuoi cung dat `applied_at = now()`.

Khoi comment dau file ghi nam viec: vi sao phan ghi o SQL chu khong o JS, vi sao nghi phep bo
qua ngay nghi/ngay le, vi sao `overtime` khong ghi gi, vi sao ngay da co du lieu khong bi ghi
de, va vi sao file nay chay lai duoc.

Test pgTAP `13_apply_approved_request.sql` — 13 khang dinh, bo cuc du lieu mot don nghi 5 ngay
lich ra dung **1** ban ghi (2 ngay ngoai `working_days`, 1 ngay le, 1 ngay da co cham cong).
San assertion 220 -> 233.

**Task 2 — Server Action goi RPC.** `reviewRequest()` doi kieu tra ve thanh
`{ request, effect }`. Sau khi cap nhat trang thai, nhanh `approved` goi **dung mot** RPC
`tf_apply_approved_request`; nhanh `rejected` khong goi. Loi RPC lam ca thao tac that bai voi
thong diep tieng Viet. `audit_log.reason` mang **ca ly do ca he qua** ("tạo 1 bản ghi công; bỏ
qua 1 ngày đã có chấm công (2019-09-06)"), va `after` duoc doc lai SAU khi ap dung de mang
`applied_at`.

Test tich hop `request-effect.test.ts` tren database dev that, doanh nghiep rieng — 8 test,
moi bai doi chieu **truoc/sau** qua `GET /api/attendance/summary`:

| # | Bai kiem | Ket qua |
|---|---|---|
| 1 | Xem truoc va duyet cho CUNG con so; 5 ngay lich -> 1 ban ghi, 1 xung dot; `leaveDays` +1 | xanh |
| 2 | Ban ghi nghi phep: hai cot gio null, `leave_paid`, mang dau vet nguon goc | xanh |
| 3 | **Ngay xung dot: dong cham cong that nguyen ven, khong dong nao chong len** | xanh |
| 4 | Ap dung lan hai bi chan o tang database, khong sinh tac dong thu hai | xanh |
| 5 | Bo sung cong: `totalMinutes` +480, `workedDays` +1 | xanh |
| 6 | Dieu chinh gio: SUA dong cu (cung id), gio/do muon/trang thai tinh lai, audit mang before | xanh |
| 7 | **Tang ca: 0 ban ghi, `convertedOvertimeHours` KHONG doi** (D-31) | xanh |
| 8 | Tu choi khong cham du lieu cong; `applied_at` van null | xanh |

**Task 3 — nguoi duyet thay truoc tac dong.** `GET /api/requests/[id]/effect` (chi
`owner`/`admin`) + `previewRequestEffect()`. Man hinh duyet goi truoc khi mo hop thoai; hop
thoai hien "Duyệt xong sẽ tạo N bản ghi công", va khi co xung dot thi hien mot khoi **cảnh báo
nổi bật** liet ke tung ngay bi bo qua kem giai thich. Voi yeu cau tang ca, hop thoai hien mot
khoi thong tin noi ro duyet la **cho phép làm thêm** (D-31). Toast sau khi duyet nhac lai dung
nhung con so do.

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0; `/api/requests/[id]/effect` co trong output |
| `npx vitest run` | 35 file, **365 test xanh** (truoc plan: 355) |
| `npm run check:assertions` | 233 assertion, sang moc 233 |
| `npm run db:push` | 0018 da ap len database dev |
| `grep -c "security definer" .../0018_...sql` | **0** — ham chay `security invoker`, RLS van ap |
| `grep -c "tf.applying_approved_request" .../0018_...sql` | 3 |
| `grep -nE 'from\("attendance_records"\).*(insert\|update)' src/lib/data/mutations/requests.ts` | **khong dong nao** — tang ung dung khong tu ghi vao bang cham cong |
| `grep -c "tf_preview_request_effect\|previewRequestEffect"` (view + data) | 2 + 2 = **4** |

**Hai quan sat cua acceptance criteria Task 3** duoc chung minh o tang du lieu thay vi bang mat
(duong ghi la Server Action, khong goi duoc tu script ngoai — gioi han da ghi o 04-06):
- test 1 khang dinh `tf_preview_request_effect` tra `inserted_count = 1` cho mot don nghi phu 5
  ngay lich, va hop thoai render **dung con so do** (`effect.insertedCount`);
- test 1 cung khang dinh `skipped_count = 1` va `skippedDates = ["2019-09-06"]`, va hop thoai
  render dung mang do trong khoi canh bao.

Quan sat tay tren trinh duyet chua lam; e2e vong doi day du thuoc pham vi 05-06.

## Hai loi da phat hien va sua trong luc thuc thi

Ca hai o nhanh `time_adjustment` cua ham SQL, ca hai do test tich hop bat duoc — khong loi nao
lam `typecheck`/`lint`/`build` do:

1. `status = case ... end` tra `text`, Postgres khong tu ep sang enum `attendance_status` trong
   `UPDATE` -> phai ep tuong minh.
2. Lenh `UPDATE` **quen cot `late_minutes`**: gio vao doi nhung do muon giu nguyen con so cu.
   Trang thai van doi thanh `late` nen loi nay se khong lo ra o giao dien — chi mot phep doi
   chieu so lieu moi thay.

Vi migration 0018 chua phat hanh, ban sua duoc nap lai bang `supabase migration repair
--status reverted 0018` roi `npm run db:push` (file 0018 duoc lam chay-lai-duoc o dau, xem khoi
comment (5)).

## Khong lam duoc trong moi truong nay

- `npm run test:db`: van **khong chay duoc** (khong co `psql`; da kiem lai trong phien nay).
  `13_apply_approved_request.sql` (13 khang dinh) da viet va da vao cong `check:assertions`
  nhung **chua chay that lan nao** — can Postgres tam cua CI. Toan bo hanh vi ma no khang dinh
  **da** duoc phu doc lap boi 8 test tich hop Vitest tren database that.

## Du lieu con sot tren database dev

`request-effect.test.ts` dung mot doanh nghiep rieng `cty-0502-<ngau nhien>`; doanh nghiep do
**khong xoa duoc** o cuoi (cascade xuong `overtime_rules` bi trigger append-only chan, tu plan
nay them ca `request_reviews`), nen moi lan chay de lai mot doanh nghiep test. Cung tinh chat
va cung ly do voi `attendance-classification.test.ts` cua 04-05. Ban ghi cham cong va audit cua
no thi da duoc don sach.
