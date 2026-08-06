---
phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai
plan: 06
subsystem: phase-gate
tags: [vitest, source-scan, e2e, docs]

requires:
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-01..04-05)
    provides: "toan bo tang cau hinh, ngay le, he so, phan loai"
provides:
  - "src/__tests__/no-hardcoded-work-rules.test.ts — cong chan con so nghiep vu nhung cung, chay trong `npm test`"
  - "scripts/e2e-settings.mjs + npm run test:e2e-settings — duong di cua mot doanh nghiep TRANG qua HTTP that"
  - "04-UAT.md — bien ban nghiem thu bon tieu chi kem gioi han da biet"
affects: []

actuals:
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Cong quet ma nguon chay TREN MA DA BO COMMENT VA NOI DUNG CHUOI: toan bo Phase 4 giai thich quy tac bang comment co chua chinh nhung con so bi cam, nen quet tho se bao do dung nhung dong dang bao ve quy tac"
    - "Moi quy tac quet doi mot NGU CANH (requiresAny/forbidsAny), khong chi mot con so — `space-y-1.5`, `step=0.05`, `overtimeMinutes ?? 0` deu hop le"

key-files:
  created:
    - src/__tests__/lib/work-rule-scan.ts
    - src/__tests__/no-hardcoded-work-rules.test.ts
    - scripts/e2e-settings.mjs
    - .planning/phases/04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai/04-UAT.md
  modified:
    - package.json
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md

key-decisions:
  - "Cong duoc THU HEP hai lan vi bat nham, moi lan ghi ly do ngay trong ma: (1) `suspiciousMultiplier(...) ?? 0` cua 03-06 la BOI SO KHOANG CACH de hien thi, khong phai he so tang ca; (2) `overtimeMinutes ?? 0` la mot so PHUT mac dinh, khong phai he so. Thu hep bang NGU NGHIA (requiresAny/forbidsAny) chu khong bang mien tru duong dan — mien tru duong dan lam mu ca file."
  - "Mot lan bat cua cong la DUNG va da sua MA THAT thay vi sua cong: `overtimeNight * (nightPremium ?? 0)` trong `classification.ts` doi thanh nhanh tuong minh `overtimeNight > 0 ? ... : 0`. Gia tri du phong do vo hai hom nay nhung se lang le nuot mat truong hop thieu he so neu dieu kien phia tren doi ve sau."
  - "e2e KHONG the chung minh duong GHI qua HTTP (moi thao tac ghi la Server Action — D-12c, khong goi duoc tu script ngoai). Pham vi that duoc ghi ro ngay trong khoi comment cua script; duong ghi da duoc phu bang test tich hop tren database that."
  - "Phat hien ngoai ke hoach: blocker 03-07 (4 tai khoan fixture pgTAP lam Admin API listUsers tra 500) DA DUOC DON — kiem bang chinh `listUsers` va bang viec e2e tao/xoa duoc tai khoan that."

requirements-completed: [SET-01, SET-02, SET-03, SET-04]
---

# 04-06: Cong cuoi phase

## Da lam

**Task 1 — cong chan con so nghiep vu nhung cung.** `work-rule-scan.ts` (bo quet, tach rieng
de kiem duoc bang mau vi pham gia lap) + `no-hardcoded-work-rules.test.ts` (9 test). Bon quy
tac: he so tang ca nhung cung; doc thang hai nguong cua Phase 3 ngoai module so huu; he so mac
dinh ngam; ngay le cai san trong seed/migration. Quet `src/`, `supabase/seed.sql`,
`supabase/migrations/` — hon 50 file. Hai muc mien tru, moi muc co ly do.

**Kiem rang (sabotage-and-revert):**

| Buoc | Ket qua |
|---|---|
| Them `const sabotage = overtime * 1.5;` vao `classification-context.ts` | cong **DO** — `classification-context.ts:184 [he-so-tang-ca-nhung-cung]` |
| Hoan tac | cong xanh |
| Them `insert into holidays ... values (...)` vao `seed.sql` | cong **DO** — `seed.sql:698 [ngay-le-cai-san]` |
| Hoan tac | cong xanh (9/9) |
| `git status` | khong con dau vet nao cua hai lan pha hoai |

**Task 2 — e2e doanh nghiep trang.** `scripts/e2e-settings.mjs` chay tren server dev that
(cong 3007) voi phien dang nhap that. **17/17 khang dinh xanh**, gom: doanh nghiep moi co dung
1 dong cau hinh / 0 ngay le / 0 he so; `/admin/settings` render 200 voi du bon tab; ngay cong
co 120 phut tang ca hien `null` khi chua khai he so (khong phai 0); khai he so 1.5 -> 3 gio quy
doi; khai them phien ban 3.0 hieu luc thang sau -> ngay cu **van 3 gio**.

**Task 3 — nghiem thu.** `04-UAT.md` ghi quan sat cu the cho bon tieu chi (khong dung chu
"dat" suong) cong sau gioi han da biet. `ROADMAP.md` (Phase 4 -> Complete, 6/6),
`REQUIREMENTS.md` (SET-01..SET-04 -> Complete), `STATE.md` (chuyen sang Phase 5, cap nhat
Blockers).

## Kiem chung cuoi phase

| Cong | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm test` | **33 file, 346 test xanh** |
| `npm run build` | thoat 0, khong loi TS |
| `npm run check:assertions` | 212, sang moc 212 |
| `npm run test:e2e-settings` | 17/17 khang dinh xanh tren HTTP that |

## Ngoai le so voi plan

- Plan viet cong se chan "ten ngay le Viet Nam" trong `src/`. Bo di: chuoi hien thi khong phai
  du lieu, va mot ho ten nhan vien trong seed ("Pham Quoc Khanh") se bao do vinh vien. Thay
  bang mot quy tac chinh xac hon: chan `insert into holidays` trong seed/migration — do moi la
  cach mot ngay le thuc su duoc cai san.
- `supabase/tests/` duoc mien tru: fixture pgTAP tu chen du lieu doi chieu roi `rollback`
  trong cung mot transaction, khong phai du lieu cai san cho doanh nghiep that.
