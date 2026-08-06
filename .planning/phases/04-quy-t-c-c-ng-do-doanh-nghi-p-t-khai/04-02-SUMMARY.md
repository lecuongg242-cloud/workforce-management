---
phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai
plan: 02
subsystem: shift-rules-settings
tags: [react, ui, admin, vitest, integration-test]

requires:
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-01)
    provides: "khung bon tab cua /admin/settings"
  - phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi (02-06)
    provides: "ShiftDialog, updateShift(), GET /api/shifts"
provides:
  - "Tab 'Ca lam viec' trong /admin/settings — gio lam chuan + an han di muon theo tung ca"
  - "src/lib/data/__tests__/shift-rules-effect.test.ts — bang chung hai chieu cho tieu chi 1 va 4 cua phase"
affects: []

actuals:
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Tab cai dat KHONG mo duong ghi rieng: dung lai nguyen `ShiftDialog` + Server Action `updateShift()` cua /admin/shifts — so nơi ghi bang `shifts` trong mutations/ giu nguyen 8"

key-files:
  created:
    - src/components/settings/shift-rules-tab.tsx
    - src/lib/data/__tests__/shift-rules-effect.test.ts
  modified:
    - src/app/admin/settings/settings-view.tsx
    - src/lib/constants.ts
    - src/lib/data/mutations/attendance.ts

key-decisions:
  - "Task 1 lam TEST TICH HOP tren database that thay vi test mock: quy tac di muon nam o duong `checkIn` -> `tf_worked_minutes` -> `late_tolerance_minutes`, mot chuoi ma mock se chi kiem lai chinh gia dinh cua nguoi viet test. Tren DB that, ca test 2 (siet an han -> lan cham ke tiep tinh muon) lan test 3/4 (ban ghi cu bat dong) deu la quan sat that."
  - "Test 2 khang dinh `lateMinutes` trong khoang +-1 phut thay vi bang chinh xac: `tf_worked_minutes` lam tron epoch va hai lan cham cach nhau vai giay. Cac khang dinh cua tieu chi 4 (test 3/4) van la BANG TUYET DOI — so sanh nguyen ban chup dong truoc/sau."
  - "Ca da luu tru (`status='archived'`) khong hien trong tab: quy tac cua mot ca khong con dung khong phai thu can khai lai."

requirements-completed: [SET-01]
---

# 04-02: Gio lam chuan va an han di muon (SET-01)

## Phat hien quan trong nhat

Vế đi muộn của tiêu chí 1 và tiêu chí 4 **đã đúng sẵn** trước plan này — `late_minutes` được
tính lúc chấm rồi lưu vào dòng (`mutations/attendance.ts`), nên sửa ân hạn không thể chạm vào
lịch sử. Việc của plan là **chứng minh** điều đó và cho chủ doanh nghiệp một chỗ để chạm tới,
chứ không phải xây lại. Test tích hợp không tìm thấy chênh lệch nào so với mô tả trong plan.

## Da lam

**Task 1 — bang chung hai chieu** (`shift-rules-effect.test.ts`, 5 test tren Postgres dev
that): tao mot ca bat dau 20 phut TRUOC hien tai (nen moi lan cham deu muon dung 20 phut, bat
ke test chay vao gio nao), hai nhan vien thuoc ca do.

| # | Kiem | Ket qua |
|---|---|---|
| 1 | an han 30 phut, den muon 20 phut | `late_minutes = 0`, `on_time` |
| 2 | siet an han xuong 5 -> lan cham KE TIEP | `late`, `late_minutes ≈ 15` — khong buoc ap dung nao o giua |
| 3 | doc lai ban ghi cu | `0` / `on_time`, nguyen dong bang ban chup truoc do |
| 4 | doi ca GIO BAT DAU ca (-30 phut) | ban ghi cu van nguyen dong |
| 5 | luot cham THU HAI trong ngay | `late_minutes = 0` — quy tac cua migration 0013 khong bi pha |

**Task 2 — tab "Ca lam viec".** Bang gon: ten/ma ca, gio lam (kem nhan "qua dem" doc tu cot
sinh), an han (0 hien "Khong an han"), so nhan vien, nut Sua mo `ShiftDialog`. Ca da luu tru
khong hien. Trang thai tai/loi/rong day du; rong thi dan sang `/admin/shifts`.

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` / `lint` / `build` | thoat 0 |
| `npx vitest run` | 27 file, 272 test xanh (truoc plan: 263) |
| `grep from("shifts") src/lib/data/mutations/ \| wc -l` | 8 — khong tang, khong duong ghi thu hai |
| `grep late_minutes src/lib/data/mutations/shifts.ts` | 0 dong — sua ca khong cham ban ghi cham cong |

## Ngoai le so voi plan

- Comment cu o `mutations/attendance.ts` (noi rang file do import hang so nguong tu
  `suspicious.ts`) da lac hau sau 04-01 — sua lai cho dung: nguong den tu `company_settings`.
