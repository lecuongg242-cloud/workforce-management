---
phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng
plan: 06
subsystem: phase-gate
tags: [vitest, e2e, gate, docs]

requires:
  - phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng (05-03, 05-04, 05-05)
    provides: "toan bo hanh vi cua phase can duoc nghiem thu"
provides:
  - "src/__tests__/no-silent-period-write.test.ts + lib/period-write-scan.ts — cong chan duong ghi thang vao attendance_records"
  - "scripts/e2e-approval.mjs + npm run test:e2e-approval — vong doi yeu cau dau-cuoi qua HTTP that"
  - "05-UAT.md — bien ban nghiem thu nam tieu chi kem sau gioi han da biet"
affects: ["phase-06"]

actuals:
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "`stripComments()` tach ra khoi `stripCommentsAndStrings()`: cong moi phai NHIN THAY noi dung chuoi (ten bang nam trong `from(\"attendance_records\")`) nhung van phai bo comment"
    - "Cong quet theo CUA SO NHIEU DONG (5 dong) thay vi tung dong: chuoi lenh PostgREST thuong xuong dong sau moi `.method()`"

key-files:
  created:
    - src/__tests__/lib/period-write-scan.ts
    - src/__tests__/no-silent-period-write.test.ts
    - scripts/e2e-approval.mjs
    - .planning/phases/05-duy-t-y-u-c-u-v-ch-t-k-c-ng/05-UAT.md
  modified:
    - src/__tests__/lib/work-rule-scan.ts
    - src/app/api/requests/route.ts
    - src/app/api/periods/route.ts
    - package.json
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md

key-decisions:
  - "Cong chi quet `src/lib/data/mutations/` — do la noi DUY NHAT duoc phep ghi (D-12c); mot lenh ghi o cho khac da bi cong `route-handlers-get-only` cua 02-04 bat truoc. Quet rong hon se lam cong cham va bat nham chinh cac file test."
  - "Danh sach mien tru co DUNG MOT muc (`mutations/attendance.ts`). Duong yeu cau duoc duyet KHONG nam trong danh sach — no khong ghi thang, toan bo phan ghi nam trong `tf_apply_approved_request()` (D-32a), va do chinh la dieu lam no di qua duoc trigger cua ky da chot."
  - "Kich ban e2e noi RO no khong chung minh duong ghi cua tang ung dung (Server Action khong goi duoc tu script ngoai — gioi han da ghi tu 04-06); cac buoc ghi duoc danh dau `[mo phong ghi]`."
  - "Task 3 la checkpoint chan (autonomous: false). Da chuan bi day du bien ban va cap nhat ba file ke hoach, nhung **chua co chu ky cua chu du an** — muc do duoc ghi tuong minh trong `05-UAT.md` §Chu ky thay vi bi lam mo."

requirements-completed: [APRV-01, APRV-02, APRV-03, APRV-04, APRV-05, SET-05, PERD-01, PERD-02]
---

# 05-06: Cong cuoi phase, e2e vong doi, va nghiem thu

## Da lam

**Task 1 — cong chan duong ghi thang.** `period-write-scan.ts` (bo quet tach roi de chinh no
kiem duoc) + `no-silent-period-write.test.ts` (9 test). Cong bao do khi mot file duoi
`src/lib/data/mutations/` ngoai danh sach mien tru co lenh `insert`/`update`/`upsert`/`delete`
tren `attendance_records`. Mau doi CA HAI thu tren cung mot cua so: ten bang VA mot dong tu ghi
— `from("attendance_records").select(...)` la mot phep DOC va moi duong doc cua Phase 3/4 deu
dung no.

Phai tach `stripComments()` ra khoi `stripCommentsAndStrings()` cua 04-06: cong nay **phai nhin
thay noi dung chuoi** (ten bang nam trong chuoi) nhung van phai bo comment. Cong cu cua Phase 4
goi ham moi va van xanh 11/11.

**KIEM RANG (ba buoc, da chay):**

| Buoc | Ket qua |
|---|---|
| Them `await supabase.from("attendance_records").insert({ id: "sabotage" });` vao `mutations/requests.ts` | **DO** — 2 test that bai ("khong file mutation nao … ghi thang", "duong yeu cau duoc duyet KHONG ghi thang") |
| Hoan tac dong do | **XANH** — 9/9 |
| `grep -n "sabotage" src/lib/data/mutations/requests.ts` | **khong dong nao** — khong con dau vet |

*(Ghi chu ve `git status`: file van hien `M` vi **toan bo Phase 5 chua commit lan nao**, khong
phai vi con sot cua lan pha hoai. Phep kiem dung o day la `git diff` khong con dong `sabotage`
nao — da xac nhan.)*

**Task 2 — e2e vong doi.** `scripts/e2e-approval.mjs` + `npm run test:e2e-approval`, **20/20
khang dinh xanh** tren server dev that (cong 3008), hai phien dang nhap that (quan tri + nhan
vien), 11 buoc: dung doanh nghiep -> gui yeu cau -> doc danh sach cho -> xem truoc tac dong ->
duyet -> doc thong bao bang cookie nhan vien -> chot ky -> **ghi thang bi chan** -> **yeu cau
duoc duyet van di duoc** -> **ghi thang lai bi chan** -> don sach.

**Task 3 — nghiem thu.** `05-UAT.md` voi nam tieu chi, moi tieu chi la **bang quan sat cu the**
(con so that, thong diep that) chu khong phai chu "dat"; **sau gioi han da biet** duoc viet ra;
`ROADMAP.md` / `REQUIREMENTS.md` / `STATE.md` cap nhat.

## HAI LOI THAT MA KICH BAN E2E BAT DUOC

Ca hai deu **khong** lam do `typecheck`, `lint`, hay bat ky test nao trong 411 test truoc do.
Day la ly do plan nay ton tai:

1. **`GET /api/requests` tra `employeeName`/`departmentName` `null` hang loat.** Embed
   `departments(name)` tu `employees` **nhap nhang**: giua hai bang co HAI quan he
   (`employees.department_id` nhieu-mot va `departments.manager_id` mot-nhieu) nen PostgREST tu
   choi ca truy van. Loi **im lang** vi hai truong do khai `.default(null)` va man hinh lui ve
   hien `employeeId`. Sua: goi ten khoa ngoai tuong minh
   (`departments!employees_department_id_fkey(name)`) **va** khong nuot loi cua truy van thu
   hai nua.
2. **Mot ky DA CHOT cu hon 12 thang bien mat khoi `/admin/periods`.** Cua so 12 thang cua duong
   doc loc mat chinh dong ky. Sua: danh sach thang = 12 thang gan day **hop voi** moi thang da
   co dong ky — mot ky da chot phai luon nhin thay duoc, va khong the "khong nhin thay" mot
   thu ma nguoi ta khong con sua duoc.

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0 |
| `npx vitest run` | 41 file, **420 test xanh** (truoc plan: 411) |
| `npm run check:assertions` | 250 assertion, sang moc 250 |
| `npx vitest run src/__tests__/no-silent-period-write.test.ts` | 9/9 |
| `npx vitest run src/__tests__/no-hardcoded-work-rules.test.ts` | 11/11 — cong cua Phase 4 khong hoi quy sau khi tach `stripComments()` |
| `npm run test:e2e-approval` (server dev cong 3008) | **20/20 khang dinh xanh** |

Buoc 8 (`ghi thang -> bi chan`) va buoc 9 (`yeu cau duoc duyet -> di duoc`) nam **lien nhau**
va khang dinh hai ket qua **nguoc nhau**, buoc 10 chan lai lan nua — bang chung co bao ve
khong ro ra ngoai transaction.

## Chua lam duoc trong phien nay

- **Chu ky nghiem thu cua chu du an.** Task 3 la checkpoint chan (`autonomous: false`): bien ban
  va ba file ke hoach da san sang, nhung mot lan bam tay qua `/admin/requests`,
  `/admin/periods`, `/employee/notifications` van **chua co ai lam**. Muc nay duoc ghi tuong
  minh o `05-UAT.md` §Chu ky va o `STATE.md` §Blockers — khong bi lam mo thanh "da xong".
- `npm run test:db`: khong chay duoc (khong co `psql`). 38 assertion pgTAP moi cua phase chua
  chay that lan nao — can Postgres tam cua CI.
