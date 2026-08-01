---
phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
plan: 05
subsystem: api
tags: [supabase, postgrest, rpc, zod, nextjs-route-handler, server-action, audit-log, rls]

requires:
  - phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi (plan 02-04)
    provides: >
      Khuon Route Handler doc + Server Action ghi + audit da chung minh
      (getSessionContext(), createServerSupabase(), fetchJson(), logMutation(),
      cong D-12c GET-only) — plan nay nhan rong khuon do lan dau tien.
provides:
  - "GET /api/employees: phan trang + danh sach rut gon (?mode=all) + tim kiem bo dau qua RPC"
  - "GET /api/departments: doc phong ban kem employeeCount/managerName suy dien"
  - "Server Action createDepartment/updateDepartment/deleteDepartment voi audit_log day du"
  - "RPC public.tf_search_employee_ids — tim kiem bo dau chay o Postgres, khong o client"
  - "Test hop dong loi fetchJson + ranh gioi rong dung chung cho departments/employees"
affects: [02-06, 02-07, 02-08, 02-09, 02-10, 02-11]

actuals:
  tokens: 8500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "employeeRowSchema (transform snake_case->camelCase NGAY TRONG schema) tach khoi employeeSchema (plain, dung o ca hai dau D-12d) khi so truong lon (~20) — khac companies.ts (anh xa tay, 8 truong)"
    - "Tim kiem bo dau qua RPC tra ve DANH SACH id khop, roi .in(\"id\", ids) tren CUNG mot .from(\"employees\") — tranh chain .eq()/.order()/.range() truc tiep len ket qua mot RPC tra ve setof, giu MOT hinh dang builder duy nhat bat ke co tu khoa hay khong"
    - "Server Action ghi: doc dong truoc (select *) -> requireRole truoc do -> ghi voi .eq(\"company_id\", companyId) -> doc dong sau -> logMutation trong CUNG ham, khong nhanh bo qua khi khong doi gi (D-18)"

key-files:
  created:
    - supabase/migrations/0008_employee_search.sql
    - src/lib/validation/api/employees.ts
    - src/lib/validation/api/departments.ts
    - src/lib/data/employees.ts
    - src/lib/data/departments.ts
    - src/lib/data/mutations/departments.ts
    - src/app/api/employees/route.ts
    - src/app/api/departments/route.ts
    - src/lib/data/__tests__/departments.test.ts
  modified:
    - src/components/layout/admin-topbar.tsx
    - src/app/admin/departments/departments-view.tsx

key-decisions:
  - "Tim kiem bo dau di qua RPC public.tf_search_employee_ids tra ve id (khong phai setof employees day du) de Route Handler chi co MOT hinh dang query builder (.from(\"employees\")) bat ke co tu khoa hay khong — tranh rui ro kieu TypeScript cua viec chain filter len hai nhanh khac nhau (RPC vs from())."
  - "employeeSchema tach thanh hai: employeeRowSchema (transform snake->camel, chi dung server-side ngay sau khi doc DB) va employeeSchema (plain, dung o CA HAI dau cho hop dong JSON D-12d) — vi Employee co ~20 truong nen mot schema lam ca hai viec (input snake-case VA validate output camelCase) khong the ton tai dong thoi trong Zod."
  - "deleteDepartment bat rieng loi Postgres 23503 (foreign_key_violation) thanh thong diep tieng Viet ro rang, vi employees.department_id la NOT NULL khong ON DELETE CASCADE — rang buoc that nay khong ton tai trong mock/service.ts (mock xoa vo dieu kien)."

patterns-established:
  - "Khi so truong domain lon (Employee), dat phep anh xa snake_case->camelCase trong mot schema Zod transform rieng (employeeRowSchema) thay vi object literal tay — mot noi duy nhat, it sai sot hon."
  - "RPC lam ham loc/tim kiem tra ve DANH SACH id, khong tra ve du lieu day du — giu Route Handler chi mot hinh dang builder de tiep tuc chain filter/order/range binh thuong."

requirements-completed: []

coverage:
  - id: D1
    description: "GET /api/employees phuc vu ca phan trang (bon bo loc + tim kiem bo dau qua RPC, kep so trang) lan danh sach rut gon (?mode=all cho admin-topbar)"
    requirement: "DATA-05"
    verification:
      - kind: other
        ref: "psql truc tiep tren live DB: count(*) employees theo company_id (28/12), tf_search_employee_ids('cty-02','ho thi kim chi') khop 'Hồ Thị Kim Chi', tu khoa scoped dung company_id (0 ket qua khi tra sai cong ty), ky tu '%' duoc escape"
        status: pass
      - kind: unit
        ref: "src/__tests__/route-handlers-get-only.test.ts (D-12c GET-only + force-dynamic gate, ap dung cho route.ts moi)"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria cua plan doi hoi curl voi cookie owner that (Ngoc Phat: total=28, Binh Minh: total=12, page=9999 tra ve trang cuoi, tham so cong ty gia mao khong doi ket qua) — mat khau tam cua 10 tai khoan seed khong con luu duoc trong moi truong nay (xem orchestrator note), nen khong the dang nhap that qua curl. RPC va logic loc/phan trang duoc kiem chung truc tiep tren du lieu that qua psql, nhung duong HTTP+session day du (Route Handler + getSessionContext + cookie that) chua duoc mot nguoi that xac nhan."

  - id: D2
    description: "Tron lat cat phong ban: GET /api/departments (employeeCount/managerName suy dien dung) + Server Action ghi (createDepartment/updateDepartment/deleteDepartment) kem audit_log day du va requireRole chan employee/manager"
    requirement: "DATA-06"
    verification:
      - kind: other
        ref: "psql truc tiep tren live DB: count(*) departments theo company_id (5/4), mau 'Ban giám đốc' -> managerName 'Trần Hoàng Nam', employeeCount 2 — khop du lieu seed that"
        status: pass
      - kind: unit
        ref: "src/__tests__/route-handlers-get-only.test.ts (GET-only + force-dynamic gate ap dung cho departments/route.ts)"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria doi hoi thao tac ghi qua giao dien that (thanh vien owner/admin dang nhap) roi doc audit_log tang dung 1 dong/thao tac qua psql, va khang dinh before=after khi sua khong doi gia tri — can mot phien dang nhap that ma moi truong nay khong the tao (cung ly do voi D1). Logic Server Action (requireRole truoc khi cham DB, khong nhanh bo qua khi khong doi gi, doc-truoc/ghi/doc-sau/audit trong cung ham) da duoc doc lai (code review) khop dung khuon 02-04 va cac rang buoc D-17/D-18, nhung chua co bang chung tu dong (test hoac phien that)."

  - id: D3
    description: "Test hop dong loi fetchJson (D-12e) + ranh gioi rong (DATA-05) dung chung cho departments.ts va employees.ts, cong da chung minh co rang bang sabotage-and-revert"
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/departments.test.ts (6/6 tests)"
        status: pass
      - kind: other
        ref: "sabotage-and-revert tren src/lib/data/fetch-json.ts: bo schema.safeParse() -> npm run test tu 33/33 xanh xuong 1 that bai (nhom 6, exit 1); hoan tac (git diff rong) -> 33/33 xanh (exit 0)"
        status: pass
    human_judgment: false

duration: 95min
completed: 2026-08-01
status: complete
---

# Phase 2 Plan 05: Nhan rong khuon sang employees + departments Summary

**GET /api/employees (phan trang + tim kiem bo dau qua RPC Postgres) va tron lat cat phong ban (doc/ghi/audit that) — lan dau nhan rong khuon Route Handler + Server Action + audit cua plan tracer 02-04.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-08-01 (theo dong ho he thong trong moi truong thuc thi)
- **Completed:** 2026-08-01
- **Tasks:** 3/3
- **Files modified:** 11 (9 tao moi, 2 sua)

## Accomplishments

- `GET /api/employees` phuc vu ca hai nhu cau bang mot ham GET duy nhat:
  `?mode=all` (danh sach rut gon cho admin-topbar) va mac dinh `paged` (bon
  bo loc + tim kiem bo dau + phan trang kep an toan, dung khuon V1).
- Tim kiem bo dau chay THAT o Postgres: migration `0008_employee_search.sql`
  them RPC `public.tf_search_employee_ids(company_id, keyword)` dung
  `tf_normalize()` da co tu 0007, escape `%`/`_` truoc khi dua vao LIKE. Da
  push len live DB va xac minh truc tiep bang psql: tim "ho thi kim chi"
  (khong dau) khop dung "Hồ Thị Kim Chi", pham vi doanh nghiep dung, ky tu
  dai dien SQL khong bi loi dung.
- Tron lat cat phong ban chay tren Postgres that: doc (`employeeCount` chi
  dem nhan vien chua nghi viec, `managerName` suy dien dung) va ghi (ba
  Server Action kem `requireRole(["owner","admin"])` truoc khi cham DB —
  AUTH-03 — va `logMutation` ghi dung mot dong audit/thao tac voi nguyen
  dong truoc/sau — DATA-06, D-17, D-18).
- `updateDepartment` KHONG co nhanh "khong doi gi thi bo qua": mot patch
  giu nguyen moi gia tri van UPDATE va ghi audit voi `before = after`, dung
  cam cua `<prohibitions>` trong plan.
- 6 nhom khang dinh cho hop dong loi `fetchJson` + ranh gioi rong, dung
  chung mot file cho ca hai module moi, cong da chung minh co rang bang
  sabotage-and-revert (exit 1 -> 0, file hoan tac byte-identical).

## Task Commits

1. **Task 1: Duong doc nhan vien — GET /api/employees phu ca phan trang lan danh sach rut gon** - `93c655e` (feat)
2. **Task 2: Tron lat cat phong ban — doc, ghi, audit** - `b50bd4b` (feat)
3. **Task 3: Test hinh dang loi va ranh gioi rong cho tang du lieu moi** - `f3ca9cd` (test)

_Ghi chu trinh tu:_ file test `src/lib/data/__tests__/departments.test.ts` duoc
liet ke o ca `<files>` cua Task 2 lan Task 3 trong PLAN.md (Task 2's `<verify>`
tham chieu no truoc khi Task 3 "tao" no theo thu tu doc). Da giai quyet bang
cach dong bo hai commit: file duoc commit trong Task 3 (dung noi dung/action
cua no), con `<verify>` cua ca Task 2 lan Task 3 duoc chay lai o trang thai
CUOI CUNG (sau khi ca ba task hoan tat) — khong phai mot deviation can Rule
4, chi la mot khac biet nho ve thu tu liet ke trong ban than PLAN.md.

## Files Created/Modified

- `supabase/migrations/0008_employee_search.sql` - RPC `tf_search_employee_ids` cho tim kiem bo dau, da push len live DB
- `src/lib/validation/api/employees.ts` - `employeeRowSchema` (transform snake->camel), `employeeSchema`/`paginatedEmployeeSchema`/`employeeListResponseSchema`/`employeeQuerySchema`
- `src/lib/data/employees.ts` - `listEmployees`/`listAllEmployees` qua `fetchJson`, giu nguyen chu ky cu
- `src/app/api/employees/route.ts` - `GET`-only, `force-dynamic`, mode `paged`/`all`
- `src/components/layout/admin-topbar.tsx` - doi import `listAllEmployees` sang `@/lib/data/employees`
- `src/lib/validation/api/departments.ts` - `departmentWithStatsSchema`/`departmentListResponseSchema`/`departmentInputSchema`
- `src/lib/data/departments.ts` - `DepartmentWithStats` chuyen nha tu `mock/service.ts`, `listDepartments` qua `fetchJson`, re-export ba ham ghi
- `src/lib/data/mutations/departments.ts` - Server Action `createDepartment`/`updateDepartment`/`deleteDepartment` kem `requireRole` + `logMutation`
- `src/app/api/departments/route.ts` - `GET`-only, `force-dynamic`, `employeeCount`/`managerName` suy dien
- `src/app/admin/departments/departments-view.tsx` - doi import 4 ham + kieu sang `@/lib/data/departments` va `@/lib/data/employees`
- `src/lib/data/__tests__/departments.test.ts` - 6 nhom khang dinh hop dong loi + ranh gioi rong

## Decisions Made

- **Tim kiem RPC tra ve id, khong tra ve setof day du.** PostgREST cho phep
  chain `.eq()/.order()/.range()` len ket qua mot RPC tra ve `setof
  employees`, nhung lam vay tao ra HAI hinh dang builder khac nhau (RPC vs
  `.from("employees")`) tuy co tu khoa tim kiem hay khong, kho dam bao
  TypeScript suy dien dong nhat khi khong dung Database generic. Chon RPC
  tra ve mang `{id}` roi `.in("id", ids)` tren CUNG mot `.from("employees")`
  giu duy nhat mot hinh dang builder, don gian hon va an toan kieu hon.
- **Tach `employeeSchema` thanh hai schema.** Employee co ~20 truong; mot
  schema KHONG THE vua nhan dau vao snake_case (dong DB) vua duoc dung lai
  de validate JSON camelCase da tra ve (client), vi hai hinh dang dau vao
  khac nhau can ban. `employeeRowSchema` (co `.transform()`) lam viec anh xa
  MOT LAN duy nhat, ngay sau khi doc DB; `employeeSchema` (khong transform)
  la schema "hop dong cuoi cung" dung o ca hai dau nhu D-12d yeu cau.
- **`deleteDepartment` bat rieng loi 23503.** `employees.department_id` la
  cot NOT NULL tham chieu `departments(id)` khong co `ON DELETE CASCADE` —
  rang buoc nay khong ton tai trong `mock/service.ts` (mock xoa vo dieu
  kien, khong bao gio that bai). Xoa mot phong ban con nhan vien tren
  Postgres that se nem loi khoa ngoai; bat rieng ma loi Postgres `23503` va
  doi thanh thong diep tieng Viet ro rang thay vi de loi ky thuat tho lot
  len giao dien (Rule 2 — hanh vi dung dan can co, khong co trong mock vi
  mock khong co rang buoc du lieu that).
- **RPC khong can them RLS/grant rieng.** `tf_search_employee_ids` la
  `SECURITY INVOKER` (mac dinh), doc tu bang `employees` da bat RLS
  (`employees_select_member` dieu kien `tf_is_member(company_id)`). Ke ca
  neu mot nguoi goi RPC nay TRUC TIEP (bo qua Route Handler) voi
  `p_company_id` tuy y, RLS van chi tra ve nhung dong ma nguoi goi THAT SU
  la thanh vien — WHERE clause cua ham la loc bo sung (lop 1), RLS van la
  lop phong thu doc lap (lop 2), dung tinh than D-12b/T-02-05-01. Khong can
  `security definer` hay `revoke execute` nhu `tf_is_platform_admin` vi ham
  nay khong can quyen vuot RLS.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `deleteDepartment` bat loi khoa ngoai (23503) thanh thong diep ro rang**
- **Found during:** Task 2 (viet Server Action ghi phong ban)
- **Issue:** `employees.department_id` la NOT NULL tham chieu `departments(id)`, khong `ON DELETE CASCADE`. Xoa mot phong ban con nhan vien se lam Postgres nem loi khoa ngoai tho — hanh vi khac hoan toan `mock/service.ts` (xoa vo dieu kien, luon thanh cong).
- **Fix:** Bat rieng ma loi `23503` tu `PostgrestError.code`, nem `Error("Không thể xóa phòng ban vì vẫn còn nhân viên thuộc phòng ban này.")` thay vi de loi Postgres tho lot len toast.
- **Files modified:** `src/lib/data/mutations/departments.ts`
- **Verification:** Doc lai code, khop `error.code` field cua `PostgrestError` (`node_modules/@supabase/postgrest-js/src/PostgrestError.ts:28`).
- **Committed in:** `b50bd4b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Bo sung can thiet cho tinh dung dan khi rang buoc du lieu that (FK) khong ton tai trong tang gia lap. Khong lam rong pham vi.

## Issues Encountered

- **Khong the xac minh cac acceptance criteria dua tren curl + cookie phien that.** Plan liet ke nhieu acceptance criteria doi hoi dang nhap that (vi du: `curl -b <cookie> ...` voi cookie owner Ngoc Phat/Binh Minh) va doc `audit_log` sau thao tac ghi qua giao dien that. Theo dung huong dan cua orchestrator ("KHONG duoc thu bat ky test nao can mot phien dang nhap that voi mat khau da biet — mat khau tam cua cac tai khoan da seed khong con lay lai duoc"), toi KHONG thu dang nhap. Thay vao do, toi xac minh phan rui ro cao nhat (logic RPC tim kiem bo dau, phan trang, employeeCount/managerName) truc tiep tren live DB bang `psql` (khong qua HTTP/Auth): dem dung 28/12 nhan vien va 5/4 phong ban theo tung doanh nghiep, tim khong dau khop dung ten co dau, pham vi doanh nghiep dung, ky tu dai dien SQL duoc escape dung. Phan con lai cua duong HTTP+Auth+Server-Action (bao gom audit_log tang dung so dong sau moi thao tac ghi qua giao dien that) chua duoc mot nguoi that xac nhan — ghi trong `coverage:` frontmatter voi `human_judgment: true` de verify-work dua ve dung nguoi.
- `gsd-tools windows append` that bai voi loi `Ledger frontmatter line is not key: value` — `.planning/WINDOWS.md` hien co dong ket thuc CRLF (kiem tra bang `file`/kiem byte `\r`), khien parser frontmatter cua cong cu doc sai dong `last_updated`. Day la loi co san trong tep/cong cu (khong phai do plan nay tao ra), va viec ghi so lieu vao ledger la "best-effort, khong bao gio chan thuc thi" theo huong dan — ghi lai o day thay cho ledger: hai muc D1/D2 trong `coverage` frontmatter o tren (`human_judgment: true`) chinh la cac unrun-verify can theo doi (curl+cookie that cho employees/departments) cho toi khi ledger sua duoc hoac mot nguoi ghi tay.
- Khong tim thay `02-04-SUMMARY.md` trong thu muc phase (plan 02-04 co cac commit `feat(02-04)`/`test(02-04)` nhung khong co commit `docs(02-04): complete ...`) — doc truc tiep ma nguon da duoc `feat(02-04)`/`test(02-04)` tao ra (`src/app/api/companies/route.ts`, `src/lib/data/companies.ts`, `src/lib/data/mutations/companies.ts`, `src/lib/data/audit.ts`, `src/lib/auth/session-context.ts`) thay cho SUMMARY de nam khuon. Khong sua STATE.md cua plan 02-04 (ngoai pham vi plan nay).

## User Setup Required

None - khong co cau hinh dich vu ngoai nao can them (migration 0008 da duoc push bang `npm run db:push` trong luc thuc thi).

## Next Phase Readiness

- Khuon `Route Handler doc + Server Action ghi + audit` da duoc nhan rong THANH CONG lan dau tien tren hai nhom du lieu khac nhau (employees, departments) — khong phat hien diem nao trong khuon khong nhan rong duoc, dung muc tieu cua plan nay.
- Mau schema "transform trong Zod khi so truong lon" (employees) vs "anh xa tay khi so truong nho" (departments, companies) da co tien le ro rang cho cac plan sau (`shifts`, `attendance_records`...) chon dung cach theo do phuc tap.
- **Chan truoc plan sau:** Cac acceptance criteria doi hoi phien dang nhap that (curl + cookie, doc `audit_log` qua UI that) van con treo cho ca plan 02-04 (tracer) lan plan nay. Nguoi dung nen chay `npm run reset:passwords` (script da co tu truoc, `chore(02)` commit `4ff1829`) de dat lai mat khau bien truoc cho 10 tai khoan seed, sau do xac nhan thu cong it nhat mot lan dang nhap + mot thao tac ghi phong ban de dong hai `coverage` entry (D1, D2) con `human_judgment: true` o tren.

## Self-Check: PASSED

All 9 created files confirmed present on disk; all 3 task commit hashes (`93c655e`, `b50bd4b`, `f3ca9cd`) confirmed present in `git log`.

---
*Phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi*
*Completed: 2026-08-01*
