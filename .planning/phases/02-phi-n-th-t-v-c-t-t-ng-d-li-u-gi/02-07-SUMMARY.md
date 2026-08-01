---
phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
plan: 07
subsystem: api
tags: [supabase, postgrest, rpc, zod, nextjs-route-handler, server-action, audit-log, pgtap, rls]

requires:
  - phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi (plan 02-05, plan 02-06)
    provides: >
      Khuon Route Handler doc + Server Action ghi + audit da chung minh hai
      lan (employees/departments o 02-05, shifts o 02-06) — plan nay nhan
      rong khuon do lan thu ba len nhom du lieu nhieu rang buoc nghiep vu
      nhat (ma duy nhat trong doanh nghiep, thao tac hang loat, quyen sua ho
      so cua chinh minh).
provides:
  - "GET /api/employees/[id]: doc mot ho so nhan vien, id thuc the loc lai theo company_id session, tra null (khong phai 404) khi khong tim thay hoac thuoc doanh nghiep khac"
  - "Server Action createEmployee/updateEmployee/bulkMoveDepartment voi audit_log day du (AUTH-03, DATA-06); bulkMoveDepartment ghi MOT dong audit cho MOI nhan vien bi anh huong, khong gop"
  - "Migration 0009: RPC public.tf_employee_code_taken dung lai tf_normalize (0007) de kiem ma nhan vien trung khong phan biet hoa thuong o tang ung dung — lop mot; unique(company_id, code) la lop hai cho truong hop dua request"
  - "pgTAP 08_role_write_scope.sql: pham vi ghi theo doanh nghiep tren employees, va mot assertion ghi nhan gioi han 'RLS khong phan biet vai tro' (D-11 tinh than tuong tu)"
affects: [02-08, 02-09, 02-10, 02-11]

actuals:
  tokens: 10674
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "RPC tra ve boolean (khong phai setof) cho phep kiem tra 'trung khop chuan hoa' ma khong pha vo hinh dang builder .from() cua Route Handler/Server Action — cung tinh than voi tf_search_employee_ids cua 0008 nhung don gian hon vi chi can true/false, khong can danh sach id."
    - "Quyen 'sua ho so cua chinh minh' la mot nhanh if thuan (role kiem tra + so sanh id voi session.employeeId) dat NGAY DAU ham, TRUOC ca createServerSupabase() — cho phep truong hop tu choi tra ve tuc thi, khong cham DB/mang, va de test bang mock ma khong can gia lap Supabase client."
    - "bulkMoveDepartment kiem ids.length === 0 VA return 0 TRUOC khi goi getSessionContext() — day la dieu kien BAT BUOC (khong phai toi uu) de dam bao thao tac rong khong cham mang/DB, kiem chung duoc bang cach dem so lan goi fetch trong test (0 lan)."
    - "Test Server Action ('use server') trong Vitest dung vi.mock voi importOriginal de giu nguyen requireRole/ForbiddenError THAT nhung thay getSessionContext bang mock co dieu khien — khac han duong doc (listXxx) dung vi.stubGlobal('fetch', ...) vi Server Action khong di qua fetch khi goi truc tiep trong Node."

key-files:
  created:
    - supabase/migrations/0009_employee_code_duplicate_check.sql
    - src/lib/data/mutations/employees.ts
    - src/app/api/employees/[id]/route.ts
    - src/lib/data/__tests__/employees.test.ts
    - supabase/tests/08_role_write_scope.sql
  modified:
    - src/lib/validation/api/employees.ts
    - src/lib/data/employees.ts
    - src/app/admin/employees/employees-view.tsx
    - src/app/admin/employees/new/new-employee-view.tsx
    - src/components/employees/employee-form.tsx
    - src/app/employee/profile/profile-view.tsx
    - src/components/layout/employee-shell.tsx
    - src/app/admin/employees/[id]/employee-detail-view.tsx
    - supabase/tests/run-all.sql

key-decisions:
  - "Kiem tra ma trung dung MOT RPC rieng (tf_employee_code_taken) thay vi fetch toan bo danh sach employees.code roi so sanh o JS — dung lai CHINH XAC public.tf_normalize() da co, tranh viet lai logic chuan hoa (khong dau, ha chu thuong) o hai noi. RPC nay khong nam trong files_modified goc cua plan (giong tien le 0008_employee_search.sql cua 02-05 cung khong nam trong files_modified goc) — day la mot Rule 2 tu nhien: kiem tra trung khong phan biet hoa thuong la mot yeu cau dung dan/bao mat can co, khong phai tinh nang tuy chon."
  - "updateEmployee dat kiem tra quyen 'ho so cua chinh minh' TRUOC ca lenh goi createServerSupabase() — vai tro con lai (manager/employee) sua id khac employeeId cua phien bi tu choi tuc thi, khong cham DB. Day la sy khac biet co chu dich so voi khuon requireRole()-don-gian cua departments/shifts (chi mot muc quyen): employees co HAI nhanh quyen (quan tri sua duoc moi nguoi; con lai chi sua duoc chinh minh)."
  - "bulkMoveDepartment tra 0 VA khong cham session/DB khi ids rong — khong phai toi uu hieu nang ma la yeu cau chuc nang: mot thao tac khong lam gi thi khong nen doi hoi quyen hay ghi audit cho 'khong lam gi ca' (T-02-07-05)."
  - "audit_log cua bulkMoveDepartment/updateEmployee luu NGUYEN DONG THO (snake_case, chua qua employeeRowSchema transform), khong phai doi tuong domain da anh xa — dung khuon da thiet lap o mutations/departments.ts va mutations/shifts.ts (D-18: nguyen dong, khong delta), khong tao them mot dinh dang thu ba cho audit."
  - "08_role_write_scope.sql tam mutate bang memberships (doi status thanh 'inactive' cho 0003 tai cty-02, roi doi lai 'active'; them mot membership vai tro 'employee' cho 0004 tai cty-01) NGAY TRONG giao dich begin/rollback — fixture co san (00_fixture_users.sql) chi co hai doanh nghiep va khong co san mot user vai tro 'employee', nen day la cach DUY NHAT tao ra dung hai tinh huong ma cac assertion 2 va 5 can, ma khong anh huong file test nao chay sau (rollback hoan tac toan bo)."
  - "Cau truc SQL: WITH chua UPDATE...RETURNING phai la CAP CAO NHAT cua ca cau lenh (khong duoc long trong subquery vo huong lam tham so cho ham is() cua pgTAP) — Postgres tu choi voi loi 'WITH clause containing a data-modifying statement must be at the top level'. Sua bang cach dat WITH bao trum CA cau lenh select is(...), thay vi long no vao trong tham so dau tien cua is()."

patterns-established:
  - "Kiem tra 'trung khop khong phan biet hoa thuong/dau' o tang ung dung nen di qua mot RPC scalar boolean rieng dung lai ham chuan hoa da co (tf_normalize), khong bao gio viet lai logic chuan hoa o JS hay fetch toan bang de so sanh tay."
  - "Khi mot thuc the co nhieu muc quyen sua (khong chi 'quan tri hay khong' ma con 'chinh minh hay khong'), dat nhanh kiem tra do o dau ham, TRUOC moi thao tac I/O, de truong hop tu choi khong ton phi tai nguyen va de kiem thu doc lap voi mock Supabase."

requirements-completed: []

coverage:
  - id: D1
    description: "GET /api/employees/[id] doc mot ho so nhan vien that: id thuc the loc lai theo company_id tu session, tra null (ma 200, khong phai 404) khi khong tim thay hoac id thuoc doanh nghiep khac — khong ro ri su ton tai (T-02-07-01)"
    requirement: "DATA-05"
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/employees.test.ts (nhom C, muc 8: getEmployee tra null khong nem khi server tra than null)"
        status: pass
      - kind: other
        ref: "psql truc tiep tren live DB: public.tf_employee_code_taken('cty-01','NV001')=true, ('cty-01','nv001')=true (khong phan biet hoa thuong), ('cty-02','NV001')=false (khong vuot ranh gioi doanh nghiep), ('cty-01','NOPE999')=false"
        status: pass
      - kind: unit
        ref: "src/__tests__/route-handlers-get-only.test.ts (D-12c GET-only + force-dynamic gate, ap dung cho route.ts moi cua employees/[id])"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria doi hoi curl voi cookie owner that (Ngoc Phat: GET /api/employees/nv-01a tra 200 id=nv-01a; GET /api/employees/nv-02a — thuoc Binh Minh — tra 200 voi than null) — mat khau tam cua 10 tai khoan seed khong con luu duoc trong moi truong nay (ke thua tu 02-04/02-05/02-06, xem huong dan orchestrator). Logic loc theo company_id va tra null khi khong khop da duoc kiem chung qua code review khop dung khuon GET /api/employees/route.ts (02-05) va GET /api/shifts/route.ts (02-06), nhung duong HTTP+Session that chua duoc mot nguoi xac nhan."

  - id: D2
    description: "createEmployee/updateEmployee/bulkMoveDepartment chay tren Postgres that voi audit_log day du: requireRole(['owner','admin']) chan employee/manager tao moi va chuyen hang loat (AUTH-03); updateEmployee co hai nhanh quyen (quan tri sua moi nguoi, con lai chi sua chinh minh, T-02-07-02); bulkMoveDepartment ghi MOT dong audit cho MOI nhan vien bi anh huong, khong gop (T-02-07-05, DATA-06)"
    requirement: "DATA-06"
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/employees.test.ts (11/11 test: nhom A 1-3 kiem trung khop ma qua mock supabase/session-context; nhom D bonus kiem hai nhanh quyen updateEmployee)"
        status: pass
      - kind: other
        ref: "Doc lai code (code review): ca ba ham deu goi getSessionContext() truoc moi thao tac I/O; createEmployee/bulkMoveDepartment goi requireRole(['owner','admin']); updateEmployee kiem 'id === employeeId cua phien' cho vai tro con lai TRUOC ca createServerSupabase(); bulkMoveDepartment doc/ghi deu kem .eq('company_id', companyId) tu session, id la thuoc doanh nghiep khac tu bi loai; logMutation goi mot lan MOI nhan vien trong vong lap, before/after la nguyen dong tho — khop dung khuon da chung minh o 02-04/02-05/02-06"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria doi hoi thao tac ghi qua giao dien that (thanh vien owner/admin dang nhap) roi doc audit_log tang dung 1 dong (create) hoac dung N dong (bulk move N nguoi, khong phai 1) qua psql — can mot phien dang nhap that ma moi truong nay khong the tao (cung ly do voi 02-05/02-06 D2). Da xac nhan baseline audit_log hien co (2 dong insert/employees tu truoc, khong co dong update/employees nao) qua psql, va logic Server Action da duoc unit-test (mock) + doc lai code khop dung cac rang buoc, nhung chua co bang chung tu dong (test hoac phien that) cho duong ghi qua HTTP+Session day du."

  - id: D3
    description: "Ba bien ma bo do canh neu cho DATA-05 co test cu the: trung khop ma nhan vien (adjacency, ca lop ung dung lan lop database), thu tu phan trang khi trung ten (ordering, da chung minh co rang bang sabotage-and-revert), ranh gioi doanh nghiep (getEmployee null, bulkMoveDepartment rong)"
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/employees.test.ts (11/11 test)"
        status: pass
      - kind: other
        ref: "sabotage-and-revert tren src/app/api/employees/route.ts: bo ca hai .order('id', ...) (mode=all va mode=paged) -> npx vitest run tu 11/11 xanh xuong 1 that bai (nhom B muc 7, exit code 1); hoan tac -> git diff --stat rong (byte-identical), 11/11 xanh (exit code 0)"
        status: pass
    human_judgment: false

  - id: D4
    description: "pgTAP xac nhan pham vi ghi theo doanh nghiep tren employees, va ghi lai gioi han da biet 'RLS khong phan biet vai tro' bang mot assertion se do neu RLS thay doi ma khong doc ghi chu"
    verification:
      - kind: integration
        ref: "supabase/tests/08_role_write_scope.sql (7/7 assertion qua npm run test:db, 0 dong 'not ok')"
        status: pass
      - kind: other
        ref: "npm run check:assertions: tong tang tu 184 (baseline truoc plan nay) len 191 (moc toi thieu van la 170, khong ha xuong theo D-15a)"
        status: pass
    human_judgment: false

duration: 80min
completed: 2026-08-01
status: complete
---

# Phase 2 Plan 07: Trọn lát cắt nhân viên — đọc một hồ sơ, ba đường ghi, audit theo từng người Summary

**GET /api/employees/[id] + Server Action createEmployee/updateEmployee/bulkMoveDepartment chạy thật trên Postgres — nhóm dữ liệu có nhiều ràng buộc nghiệp vụ nhất của V1 (mã duy nhất trong doanh nghiệp qua RPC chuẩn hoá, quyền sửa hồ sơ hai lớp, audit từng dòng cho thao tác hàng loạt) đi qua khuôn Route Handler + Server Action + audit đã chứng minh ba lần liên tiếp (02-04/02-05/02-06).**

## Performance

- **Duration:** ~80 min
- **Started:** 2026-08-01 (theo đồng hồ hệ thống trong môi trường thực thi)
- **Completed:** 2026-08-01
- **Tasks:** 3/3
- **Files modified:** 15 (5 tạo mới, 10 sửa — bao gồm một call site plan bỏ sót, xem Deviations)

## Accomplishments

- `GET /api/employees/[id]` đọc một hồ sơ nhân viên thật: `id` thực thể đọc
  từ tham số đường dẫn, luôn kèm `.eq("company_id", companyId)` từ session
  và `.maybeSingle()`; trả `null` với mã 200 (không phải 404) khi không tìm
  thấy hoặc thuộc doanh nghiệp khác — không ai phân biệt được hai trường hợp
  đó với nhau (T-02-07-01), giữ đúng hình dạng `Promise<Employee | null>`
  của chữ ký cũ.
- Migration `0009_employee_code_duplicate_check.sql` thêm RPC
  `public.tf_employee_code_taken(company_id, code)` dùng lại
  `public.tf_normalize()` (0007) để kiểm mã trùng không phân biệt hoa
  thường ở tầng ứng dụng (lớp một) — đã xác minh trực tiếp qua `psql`:
  `('cty-01','NV001')`→true, `('cty-01','nv001')`→true (không phân biệt hoa
  thường), `('cty-02','NV001')`→false (không vượt ranh giới doanh nghiệp).
  Ràng buộc `unique(company_id, code)` của database vẫn là lớp hai, bắt
  riêng mã lỗi `23505` và đổi thành cùng thông điệp tiếng Việt.
- Ba Server Action ghi (`createEmployee`, `updateEmployee`,
  `bulkMoveDepartment`) đều `getSessionContext()` trước mọi thao tác I/O.
  `updateEmployee` có **hai nhánh quyền**: `owner`/`admin` sửa mọi hồ sơ
  trong doanh nghiệp; `manager`/`employee` chỉ sửa được hồ sơ có `id` bằng
  chính `employeeId` của phiên, nhánh từ chối chạy **trước cả**
  `createServerSupabase()` nên không chạm DB khi bị từ chối (AUTH-03,
  T-02-07-02).
- `bulkMoveDepartment` ghi **một dòng `audit_log` cho mỗi nhân viên** bị
  chuyển phòng ban trong vòng lặp, không gộp thành một dòng duy nhất
  (T-02-07-05, DATA-06) — id thuộc doanh nghiệp khác tự bị loại khỏi câu đọc
  lẫn câu ghi, không làm cả thao tác đổ; trả về đúng số dòng thật sự đã đổi.
  Danh sách rỗng trả `0` ngay lập tức, **không chạm session/DB/mạng** — xác
  minh được bằng cách đếm số lần `fetch` được gọi trong test (0 lần).
- 11 test đơn vị (`employees.test.ts`) phủ đúng ba biên mà bộ dò cạnh nêu
  cho DATA-05: trùng khớp mã (RPC báo trùng → lỗi rõ ràng; insert vi phạm
  `23505` → cùng thông điệp, không lộ lỗi Postgres thô; mã trùng ở "doanh
  nghiệp khác" → thành công), thứ tự phân trang khi hai nhân viên trùng tên
  (đã chứng minh có răng bằng sabotage-and-revert), ranh giới doanh nghiệp
  (`getEmployee` null, `bulkMoveDepartment` rỗng). Server Action được test
  bằng `vi.mock` giữ nguyên `requireRole`/`ForbiddenError` thật, chỉ thay
  `getSessionContext` — khác cách test đường đọc (`vi.stubGlobal("fetch")`).
- `supabase/tests/08_role_write_scope.sql` (7 assertion): xác nhận phạm vi
  ghi theo doanh nghiệp trên `employees` qua RLS thật, và **ghi lại một giới
  hạn đã biết bằng một assertion cụ thể**: RLS `employees_update_member` chỉ
  kiểm `tf_is_member(company_id)`, KHÔNG kiểm vai trò — một membership vai
  trò `'employee'` (thêm tạm trong giao dịch) vẫn cập nhật được dòng
  `employees` của người khác qua RLS thuần tuý. Phân biệt vai trò nằm ở tầng
  Server Action, không ở RLS. `npm run check:assertions` tăng từ 184 lên 191.

## Task Commits

1. **Task 1: Đọc một hồ sơ nhân viên và ba đường ghi kèm audit** - `6481b57` (feat)
2. **Task 2: Test ba biên mà bộ dò cạnh nêu — trùng khớp, thứ tự, ranh giới doanh nghiệp** - `a165fa6` (test)
3. **Task 3: pgTAP cho quyền ghi theo vai trò trên employees** - `af0ba1c` (test)

## Files Created/Modified

- `supabase/migrations/0009_employee_code_duplicate_check.sql` - RPC
  `tf_employee_code_taken` dùng lại `tf_normalize` (0007), đã push lên live DB
- `src/lib/data/mutations/employees.ts` - Server Action `createEmployee`/
  `updateEmployee`/`bulkMoveDepartment` kèm `requireRole` + hai nhánh quyền
  + `logMutation`
- `src/app/api/employees/[id]/route.ts` - `GET`-only, `force-dynamic`, tra
  `null` khi khong tim thay hoac thuoc doanh nghiep khac
- `src/lib/validation/api/employees.ts` - thêm `employeeInputSchema`
  (transform camelCase→snake_case, loại `user_id`), `employeeDetailResponseSchema`
  (nullable)
- `src/lib/data/employees.ts` - thêm `getEmployee` qua `fetchJson`, re-export
  ba hàm ghi từ `mutations/employees.ts`
- `src/app/admin/employees/employees-view.tsx`,
  `src/app/admin/employees/new/new-employee-view.tsx`,
  `src/components/employees/employee-form.tsx`,
  `src/app/employee/profile/profile-view.tsx`,
  `src/components/layout/employee-shell.tsx` - đổi import 5 call site sang
  `@/lib/data/*`, không đổi gì khác
- `src/app/admin/employees/[id]/employee-detail-view.tsx` - call site plan
  bỏ sót (xem Deviations); chuyển phần liên quan nhân viên/phòng ban/ca sang
  `@/lib/data/*`, giữ `getMonthlySummary`/`listAttendance`/`listRequests`
  trên `@/lib/mock/service` vì chấm công/yêu cầu còn ngoài phạm vi Phase 2
- `src/lib/data/__tests__/employees.test.ts` - 11 test: 3 nhóm bắt buộc (9
  test) + 2 test bonus quyền sửa hồ sơ
- `supabase/tests/08_role_write_scope.sql` - 7 assertion phạm vi ghi +
  assertion ghi nhận giới hạn RLS-không-phân-biệt-vai-trò
- `supabase/tests/run-all.sql` - thêm `\ir 08_role_write_scope.sql`

## Decisions Made

- **RPC `tf_employee_code_taken` trả boolean, không trả setof.** Cùng tinh
  thần với `tf_search_employee_ids` (0008) nhưng đơn giản hơn vì chỉ cần
  true/false, không cần danh sách id — dùng lại `tf_normalize` thay vì viết
  lại logic chuẩn hoá (không dấu, hạ chữ thường) ở JS.
- **Quyền "hồ sơ của chính mình" chạy TRƯỚC mọi I/O.** `updateEmployee` kiểm
  `role`/`employeeId` ngay sau khi có `SessionContext`, trước cả
  `createServerSupabase()` — trường hợp bị từ chối không tốn một round-trip
  DB nào, và dễ test độc lập với mock Supabase (chỉ cần mock
  `getSessionContext`).
- **`bulkMoveDepartment([])` không chạm session/DB/mạng.** Không phải tối ưu
  hiệu năng mà là yêu cầu chức năng: một thao tác không làm gì thì không cần
  quyền hay audit cho "không làm gì cả" (T-02-07-05) — kiểm chứng được bằng
  đếm số lần `fetch` trong test.
- **audit_log lưu nguyên dòng thô, không phải object domain đã map.** Giữ
  đúng khuôn `mutations/departments.ts`/`mutations/shifts.ts` (D-18): dòng
  `before`/`after` truyền cho `logMutation` là kết quả thô từ Supabase
  (snake_case), không qua `employeeRowSchema.parse()`.
- **Test Server Action dùng `vi.mock` với `importOriginal`, không dùng
  `vi.stubGlobal("fetch")`.** `createEmployee`/`updateEmployee`/
  `bulkMoveDepartment` là Server Action gọi trực tiếp trong Node khi chạy
  Vitest (không đi qua `fetch` như đường đọc) — mock `@/lib/auth/session-context`
  (giữ `requireRole`/`ForbiddenError` thật qua `importOriginal`, chỉ thay
  `getSessionContext`) và `@/lib/supabase/server` để kiểm soát chuỗi
  `.from()/.rpc()/.select()/.eq()/.maybeSingle()/.single()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Thêm migration RPC `tf_employee_code_taken` (không nằm trong `files_modified` gốc của plan)**
- **Found during:** Task 1, bước (d) viết `createEmployee`
- **Issue:** Plan yêu cầu kiểm mã trùng "dùng lại `public.tf_normalize()`", nhưng PostgREST không cho phép gọi một hàm tuỳ ý trên cột thường trong `.filter()` (cùng giới hạn đã ghi trong `0008_employee_search.sql` của plan 02-05). Không có cách nào thoả cả hai yêu cầu ("dùng lại tf_normalize" và "không viết lại logic chuẩn hoá ở JS") mà không thêm một RPC.
- **Fix:** Thêm migration `0009_employee_code_duplicate_check.sql` với RPC scalar `tf_employee_code_taken(company_id, code)` — `security invoker` (không bypass RLS), đã push lên live DB và xác minh qua `psql`.
- **Files modified:** `supabase/migrations/0009_employee_code_duplicate_check.sql`, `src/lib/data/mutations/employees.ts`
- **Verification:** `npm run db:push` thành công; `psql` xác nhận 4 trường hợp (case-insensitive, cross-company, not-found) đều đúng.
- **Committed in:** `6481b57` (Task 1 commit)

**2. [Rule 1 - Bug trong giả định của plan] `employee-detail-view.tsx` là một call site plan bỏ sót**
- **Found during:** Task 1, chạy grep acceptance criteria `grep -rc "@/lib/mock/service" src/app/admin/employees/ ...`
- **Issue:** Plan liệt kê đúng 5 call site cần đổi import (`employees-view.tsx`, `new-employee-view.tsx`, `employee-form.tsx`, `profile-view.tsx`, `employee-shell.tsx`), nhưng `src/app/admin/employees/[id]/employee-detail-view.tsx` cũng import `getEmployee`/`listAllEmployees`/`listDepartments`/`listShifts`/`updateEmployee` từ `@/lib/mock/service` — một call site thứ sáu plan không biết tới (giống tiền lệ `shift-card.tsx` bị bỏ sót ở 02-06).
- **Fix:** Đổi import các hàm liên quan nhân viên/phòng ban/ca sang `@/lib/data/*` (đã có từ 02-05/02-06/plan này). **Giữ nguyên** `getMonthlySummary`/`listAttendance`/`listRequests` trên `@/lib/mock/service` vì chấm công (Phase 3) và luồng yêu cầu (Phase 5) còn ngoài phạm vi Phase 2 theo `02-CONTEXT.md` — chuyển các hàm đó sang dữ liệu thật là mở rộng phạm vi (Rule 4), không phải việc của plan này.
- **Files modified:** `src/app/admin/employees/[id]/employee-detail-view.tsx`
- **Verification:** `npm run typecheck && npm run lint && npm run build` thoát 0. `grep -rn "@/lib/mock/service" src/app/admin/employees/ ...` giờ chỉ còn đúng 1 dòng trong file này (import ba hàm chấm công/yêu cầu cố ý giữ lại) — đây là kết quả **đúng**, không phải một acceptance criteria còn treo: phạm vi Phase 2 không bao gồm chấm công/yêu cầu.
- **Committed in:** `6481b57` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical — RPC chuẩn hoá mã, 1 bug trong giả định `read_first` của plan — call site bỏ sót)
**Impact on plan:** Cả hai bổ sung cần thiết để giữ đúng mục tiêu "cắt tầng dữ liệu giả" và "mã trùng không phân biệt hoa thường" của plan. Không mở rộng phạm vi sang chấm công/yêu cầu (đã cố ý giữ nguyên mock cho hai nhóm đó).

## Issues Encountered

- **Không thể xác minh các acceptance criteria dựa trên curl + cookie phiên
  thật.** Giống 02-04/02-05/02-06, nhiều acceptance criteria đòi hỏi đăng
  nhập thật (`curl -b <cookie> ...` với cookie owner Ngọc Phát/Bình Minh) và
  đọc `audit_log` sau thao tác ghi qua giao diện thật. Theo đúng hướng dẫn
  orchestrator, KHÔNG thử đăng nhập. Thay vào đó: xác minh RPC mới trực tiếp
  qua `psql` trên live DB, xác nhận baseline `audit_log` hiện có trước khi
  thực thi (2 dòng `insert/employees` sẵn có, 0 dòng `update/employees`), và
  kiểm chứng toàn bộ logic Server Action bằng 11 test đơn vị (mock session/
  Supabase) cộng code review khớp đúng khuôn đã chứng minh ở 02-04/02-05/02-06.
  Đường HTTP+Session+Server-Action đầy đủ chưa được một người thật xác nhận —
  ghi trong `coverage:` frontmatter với `human_judgment: true` (D1, D2).
- **Postgres từ chối `WITH` chứa `UPDATE...RETURNING` lồng trong subquery vô
  hướng.** Lần đầu viết `08_role_write_scope.sql` đặt `with updated as
  (update ... returning id) select count(*) from updated` làm tham số đầu
  tiên của `is(...)` — Postgres báo lỗi "WITH clause containing a
  data-modifying statement must be at the top level". Sửa bằng cách đưa
  `WITH` ra làm cấp cao nhất của cả câu lệnh (bao trùm luôn `select
  is(...)`), thay vì lồng nó bên trong tham số của hàm `is()`. Đã xác nhận
  `npm run test:db` chạy 7/7 assertion không lỗi sau khi sửa.
- `gsd-tools windows append` thất bại với lỗi `Ledger frontmatter line is
  not key: value: "last_updated: ...\r"` — lỗi CRLF có sẵn trong
  `.planning/WINDOWS.md` đã được ghi nhận ở 02-05-SUMMARY.md/02-06-SUMMARY.md,
  tái hiện lại ở đây khi thử ghi mục `unrun-verify` cho các acceptance
  criteria đòi hỏi phiên đăng nhập thật. Ghi lại ở đây thay cho ledger: hai
  mục D1/D2 trong `coverage` frontmatter ở trên (`human_judgment: true`)
  chính là các unrun-verify cần theo dõi cho tới khi ledger sửa được hoặc
  một người ghi tay.
- Fixture pgTAP (`00_fixture_users.sql`) chỉ có hai doanh nghiệp và user 0003
  là thành viên **cả hai** — kịch bản "0003 không cập nhật được dòng của một
  doanh nghiệp họ không thuộc" (mục 2 của plan) không thể tái hiện trực tiếp
  bằng dữ liệu có sẵn. Giải quyết bằng cách tạm đổi `memberships.status`
  thành `'inactive'` cho 0003 tại cty-02 NGAY TRONG giao dịch
  `begin...rollback` của chính file test, rồi đổi lại `'active'` trước khi
  tiếp tục — không ảnh hưởng fixture cho các file test chạy sau trong
  `run-all.sql` (đã xác nhận bằng `psql` sau khi chạy: `nv-01a`/`nv-02a` giữ
  nguyên `position` gốc, không bị các UPDATE thử nghiệm trong pgTAP làm thay
  đổi vĩnh viễn).

## User Setup Required

None - không có cấu hình dịch vụ ngoài nào cần thêm (migration 0009 đã được
push bằng `npm run db:push` trong lúc thực thi).

## Next Phase Readiness

- Khuôn `Route Handler đọc + Server Action ghi + audit` tiếp tục nhân rộng
  thành công lần thứ tư lên nhóm dữ liệu nhiều ràng buộc nhất của V1 (mã duy
  nhất, quyền hai lớp, audit từng dòng cho thao tác hàng loạt) — không phát
  hiện điểm nào trong khuôn không nhân rộng được.
- Mẫu "RPC scalar boolean dùng lại hàm chuẩn hoá có sẵn" là tiền lệ cho các
  plan sau khi cần kiểm tra trùng khớp không phân biệt hoa thường/dấu ở
  tầng ứng dụng mà không muốn viết lại logic chuẩn hoá.
- Mẫu "test Server Action bằng `vi.mock` + `importOriginal`" (giữ nguyên
  logic thật của các hàm helper như `requireRole`/`ForbiddenError`, chỉ thay
  `getSessionContext`) là khuôn có thể tái sử dụng cho các plan sau khi cần
  unit-test Server Action ghi mà không cần phiên đăng nhập thật.
- **Chặn trước plan sau:** các acceptance criteria đòi hỏi phiên đăng nhập
  thật (curl + cookie, đọc `audit_log` qua UI thật) vẫn còn treo cho cả
  02-04, 02-05, 02-06, và plan này. Người dùng nên chạy
  `npm run reset:passwords` rồi xác nhận thủ công ít nhất: (1) một lần đăng
  nhập, (2) tạo một nhân viên mới với mã đã tồn tại → thấy đúng thông báo
  lỗi, (3) chuyển 3 nhân viên sang phòng ban khác → `audit_log` tăng đúng 3
  dòng (không phải 1) — để đóng các `coverage` entry (D1, D2) còn
  `human_judgment: true` ở trên.
- `src/app/admin/employees/[id]/employee-detail-view.tsx` vẫn còn phụ thuộc
  `@/lib/mock/service` cho `getMonthlySummary`/`listAttendance`/
  `listRequests` — đây là điểm neo hợp lệ cho tới khi Phase 3 (chấm công) và
  Phase 5 (luồng yêu cầu) chuyển các hàm đó sang dữ liệu thật.

## Self-Check: PASSED

All 5 created files confirmed present on disk; all 3 task commit hashes
(`6481b57`, `a165fa6`, `af0ba1c`) confirmed present in `git log`.

---
*Phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi*
*Completed: 2026-08-01*
