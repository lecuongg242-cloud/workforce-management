---
phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai
plan: 04
subsystem: overtime-rules
tags: [postgres, trigger, pgtap, nextjs, route-handler, server-action, zod, vitest, integration-test, react, ui, admin]

requires:
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-01)
    provides: "khung bon tab cua /admin/settings, ngay server truyen xuong lam prop"
  - phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p (01-05)
    provides: "bang overtime_rules + cot effective_from + unique(company_id, rule_key, effective_from)"
provides:
  - "Trigger overtime_rules_append_only (migration 0016) — UPDATE/DELETE bi database tu choi"
  - "tf_overtime_multiplier(company, rule_key, date) — he so DANG HIEU LUC tai mot ngay, NULL khi chua khai"
  - "GET /api/overtime-rules — bon loai ngay kem he so hien hanh va lich su phien ban"
  - "createOvertimeRuleVersion() (Server Action, chi INSERT) + audit"
  - "Tab 'Tang ca' trong /admin/settings"
  - "D-28a: mo hinh CONG DON hai lop, `night` doi nghia thanh PHU CAP CONG THEM"
affects: ["04-05"]

actuals:
  tasks: 4
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Cuong che quy uoc du lieu bang TRIGGER o database chu khong bang thoa thuan trong ma ung dung (D-25a) — kem thu tuc go trigger co y thuc ghi ngay trong migration cho truong hop phai sua du lieu hong"
    - "Fixture cua test tich hop KHONG don dep duoc (chinh trigger chan DELETE) nen duoc thiet ke IDEMPOTENT: lan chay dau tao, cac lan sau dung lai — khong tich luy"

key-files:
  created:
    - supabase/migrations/0016_overtime_rules_append_only.sql
    - supabase/tests/11_overtime_rules_append_only.sql
    - src/lib/validation/api/overtime-rules.ts
    - src/app/api/overtime-rules/route.ts
    - src/lib/data/overtime-rules.ts
    - src/lib/data/mutations/overtime-rules.ts
    - src/components/settings/overtime-rules-tab.tsx
    - src/components/settings/overtime-rule-dialog.tsx
    - src/lib/data/__tests__/overtime-rules.test.ts
  modified:
    - supabase/tests/run-all.sql
    - scripts/check-pgtap-assertions.mjs
    - src/lib/types/domain.ts
    - src/app/admin/settings/settings-view.tsx
    - src/lib/constants.ts
    - .planning/phases/04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai/04-CONTEXT.md
    - .planning/phases/04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai/04-05-PLAN.md

key-decisions:
  - "[CHECKPOINT D-28, chot 2026-08-06] Chu du an chon CONG DON thay vi mo hinh mot-loai-mot-phut cua ban ke hoach goc. `rule_key='night'` doi nghia tu HE SO NHAN thanh PHU CAP CONG THEM: he so cua mot phut = he so loai ngay + phu cap dem (neu phut do trong khung dem). Vi du da chot: le 3.0 + dem 0.3 -> mot gio tang ca dem ngay le quy doi x3.3."
  - "Lua chon do KHONG can migration moi (cot `multiplier` giu nguyen, chi ngu nghia doi) nen 04-05 duoc lap lai pham vi tai cho thay vi dung han — khac voi nhanh (B) 'ba lop day du theo Dieu 98' ma plan goc du lieu se phai dung."
  - "Nhan va o nhap cua khoa `night` doi theo: hien '+0.3' chu khong bao gio 'x0.3', nhan la 'Phu cap ca dem', chu tro giup noi ro 'nhap phan cong them, khong phai he so nhan'. Mot nguoi dien 1.3 vao o do theo thoi quen se lam con so quy doi sai gap boi."
  - "Gioi han con lai ghi ro trong CONTEXT: Dieu 98.3 con mot lop thu ba (tang ca ban dem duoc cong them 20% tien luong ban ngay cua chinh ngay do) — V2 KHONG lam, no can mot rule_key thu nam va mot migration."
  - "Trigger chan ca UPDATE lan DELETE nen `on delete cascade` tu `companies` cung bi chan — duong xoa doanh nghiep chua ton tai trong ung dung, ghi lai trong migration de nguoi sau khong vap."

requirements-completed: [SET-03]
---

# 04-04: He so tang ca append-only (SET-03)

## Da lam

**Task 1 — cuong che append-only.** Migration 0016: trigger `overtime_rules_append_only`
(before update or delete, for each row) nem `restrict_violation` voi thong diep noi CACH LAM
DUNG; ham `tf_overtime_multiplier(company, rule_key, date)` tra he so co `effective_from` lon
nhat ma van `<= date`, `security invoker`, tra NULL khi chua khai. Test pgTAP
`11_overtime_rules_append_only.sql` (7 khang dinh). San assertion 205 -> 212. Migration da
push len database dev.

**Task 2 — duong doc/ghi.** `GET /api/overtime-rules` tra DU BON khoa (khoa chua khai co
`currentMultiplier: null`, `versions: []`), he so hien hanh xac dinh theo NGAY SERVER.
`createOvertimeRuleVersion()` CHI insert; trung `(rule_key, effective_from)` tra thong diep
tieng Viet. 11 test tich hop tren database that.

**Task 3 — tab "Tang ca".** Bon the, moi the: nhan loai ngay, mo ta loai gio roi vao nhom,
he so hien hanh hoac "Chua khai he so" (bieu tuong + nhan chu, khong phan biet bang mau),
nut khai phien ban moi, lich su phien ban mo ra duoc. Hop thoai khai co canh bao khi ngay
hieu luc lui vao qua khu; o he so **khong dien san gia tri nao**.

**Task 4 — checkpoint D-28.** Chu du an chon **cong don**; quyet dinh ghi vao `04-CONTEXT.md`
thanh D-28a, `04-05-PLAN.md` duoc lap lai pham vi theo mo hinh moi, va nhan/o nhap cua khoa
`night` da doi theo ngay trong plan nay.

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` / `lint` / `build` | thoat 0 |
| `npx vitest run` | 30 file, 302 test xanh (truoc plan: 289) |
| `npm run check:assertions` | 212, sang moc 212 |
| `npm run db:push` | 0016 da ap len database dev |
| He so nhung cung (`1.5`/`2.0`/`3.0`/`150%`...) trong `src/components/settings/` va schema | khong co dong nao (2 ket qua grep deu la comment giai thich va mot class Tailwind `space-y-1.5`) |
| `.update(`/`.delete(`/`.upsert(` trong `mutations/overtime-rules.ts` | khong co (1 ket qua grep la comment) |
| `default(`/`??`/`\|\|` tren duong du lieu he so | khong co (1 ket qua grep la comment) |

Bang chung dang chu y tu test tich hop (tren DB that):
- `UPDATE overtime_rules ...` -> loi tu database, thong diep chua "append-only";
- `DELETE FROM overtime_rules ...` -> loi tuong tu;
- khai phien ban moi khong xoa phien ban cu (ca hai dong cung ton tai);
- `tf_overtime_multiplier` cho 2019-03-01 tra 2, cho 2019-08-01 tra 3 — **cung mot khoa, hai
  ngay khac nhau, hai he so khac nhau**: day la co che tieu chi 4 cua phase dua vao;
- ngay truoc moi phien ban tra `null`, khong lui ve dong gan nhat;
- phien ban `effective_from` tuong lai chua duoc coi la dang hieu luc;
- vai tro `employee` bi tu choi o duong ghi.

## Ngoai le / no ky thuat

- **Fixture cua `overtime-rules.test.ts` o lai tren database dev** va khong xoa duoc — chinh
  trigger append-only chan DELETE. Test duoc lam idempotent nen khong tich luy qua cac lan
  chay. Cac dong do thuoc `cty-02`: `holiday` 2019-01-01 (=2), `holiday` 2019-06-01 (=3),
  `night` 2099-01-01 (=1.3). **Luu y ve D-28a:** dong `night` do duoc tao TRUOC khi `night`
  doi nghia thanh phu cap, nen gia tri 1.3 doc theo nghia moi la "cong them 130%" — no co
  `effective_from` nam 2099 nen khong bao gio ap vao du lieu that, nhung neu ai do doc bang
  du lieu dev thi day la ly do con so trong ky.
- `npm run test:db` van chua chay duoc trong moi truong nay (khong co `psql`, database dev la
  cloud) — `11_overtime_rules_append_only.sql` da viet va da vao cong dem, nhung chua chay
  that lan nao. Bu lai, hai khang dinh quan trong nhat cua no (UPDATE/DELETE bi chan) **da
  duoc kiem tren database that** qua test tich hop Vitest.
