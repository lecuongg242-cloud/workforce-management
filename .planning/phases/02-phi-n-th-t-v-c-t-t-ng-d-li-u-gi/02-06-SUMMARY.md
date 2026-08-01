---
phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
plan: 06
subsystem: api
tags: [supabase, postgrest, zod, nextjs-route-handler, server-action, audit-log, generated-column]

requires:
  - phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi (plan 02-04)
    provides: >
      Khuon Route Handler doc + Server Action ghi + audit da chung minh
      (getSessionContext(), createServerSupabase(), fetchJson(), logMutation(),
      cong D-12c GET-only) — plan nay nhan rong khuon do sang nhom du lieu co
      kieu phuc tap nhat cua V1 (time, smallint[], cot sinh).
provides:
  - "GET /api/shifts: doc ca lam viec that (employeeCount suy dien, gio dang HH:mm, overnight doc tu cot sinh)"
  - "Server Action createShift/updateShift/duplicateShift voi audit_log day du (AUTH-03, DATA-06)"
  - "shiftRowSchema/shiftWithStatsSchema/shiftInputSchema — mot noi duy nhat gom ba phep bien doi kieu (cat/them giay, rang buoc mang, anh xa snake<->camel)"
affects: [02-07, 02-08, 02-09, 02-10, 02-11]

actuals:
  tokens: 4752
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "shiftRowSchema (transform snake_case->camelCase NGAY TRONG schema, dung khi doc raw DB row) tach khoi shiftWithStatsSchema (plain, dung o CA HAI dau D-12d cho hop dong JSON cuoi cung) — giong khuon employeeRowSchema/employeeSchema cua 02-05 khi kieu du lieu phuc tap (time, mang, cot sinh), khac khuon anh-xa-tay cua departments/companies khi truong it va don gian."
    - "shiftInputSchema dung .transform() de tra ve dong snake_case san sang ghi (them lai ':00' cho time), KHONG khai bao truong overnight — Zod tu bo qua truong thua trong input thay vi phai destructure tay truoc khi insert/update."
    - "Cot sinh (generated column) chi duoc DOC LAI, khong bao gio tinh lai o tang ung dung — canh bang mot test rieng (nhom 3) da chung minh co rang qua sabotage-and-revert."

key-files:
  created:
    - src/lib/validation/api/shifts.ts
    - src/lib/data/shifts.ts
    - src/lib/data/mutations/shifts.ts
    - src/app/api/shifts/route.ts
    - src/lib/data/__tests__/shifts.test.ts
  modified:
    - src/app/admin/shifts/shifts-view.tsx
    - src/components/shifts/shift-card.tsx

key-decisions:
  - "Wire contract cua GET /api/shifts la hinh dang CUOI CUNG (camelCase, HH:mm, employeeCount da ghep) — Route Handler dung shiftRowSchema (transform) NGAY SAU khi doc DB de ghep employeeCount, roi parse LAI bang shiftWithStatsSchema (plain) truoc khi tra ve; client (src/lib/data/shifts.ts) parse lai CUNG shiftWithStatsSchema/shiftListResponseSchema (khong transform) sau khi nhan qua fetchJson — dung D-12d (schema chung o hai dau, khong phai HAI schema khac nhau cho hai chieu)."
  - "Test bien kieu (Task 2) chia hai nhom muc tieu khac nhau: 4 nhom (1,4,5,6) kiem shiftRowSchema TRUC TIEP (khong qua fetch) vi day la khuon Route Handler dung de doc raw row; 3 nhom (2,3,7) kiem listShifts() qua fetch gia lap vi day la ranh gioi client thuc su nhan JSON da-transform. Ca hai deu can thiet: nhom dau canh dung phep bien doi tren dong DB tho, nhom sau canh listShifts() khong tu them logic tinh lai overnight sau khi nhan du lieu."
  - "duplicateShift/updateShift doc nguyen dong qua shiftRowSchema.parse() (khong doc raw object) truoc khi hop nhat patch — dam bao gia tri 'before' dung de merge la gia tri domain (camelCase, HH:mm) khop kieu voi ShiftInput, tranh tron lan hai he dinh dang trong cung mot ham."

patterns-established:
  - "Khi mot bang co cot sinh (generated column), schema doc (Row schema) truyen NGUYEN gia tri cot do, KHONG bao gio tinh lai — va mot test rieng phai canh dieu do bang sabotage-and-revert (them phep tinh lai tam thoi, xac nhan test do, hoan tac, xac nhan test xanh lai)."
  - "Zod .transform() lam ca hai chieu doc (row->domain) va ghi (domain->row) khi kieu du lieu phuc tap — mot schema rieng cho moi chieu (shiftRowSchema doc, shiftInputSchema ghi), khong dung chung mot schema cho ca hai vi hinh dang dau vao khac nhau co ban."

requirements-completed: []

coverage:
  - id: D1
    description: "GET /api/shifts tra ve ca lam viec that: gio dang HH:mm (khong con giay), overnight doc tu cot sinh cua database (khong tinh lai), workingDays giu nguyen thu tu va so phan tu, employeeCount chi dem nhan vien chua nghi viec"
    requirement: "DATA-05"
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/shifts.test.ts (7/7: nhom 1/4/5/6 kiem shiftRowSchema, nhom 2/3/7 kiem listShifts())"
        status: pass
      - kind: other
        ref: "psql truc tiep tren live DB: count(*) shifts theo company_id (4/3, khop acceptance criteria mong doi cho Ngoc Phat/Binh Minh); dung mot ca overnight=true moi doanh nghiep (Ca dem 22:00-06:00, Ca dem 12 tieng 18:00-06:00); tf_shift_minutes()/tf_overnight() tren hai ca do cho gia tri duong (435, 660 phut) va khop cot sinh overnight — xac nhan D-08 khong bi vi pham boi duong doc moi"
        status: pass
      - kind: unit
        ref: "src/__tests__/route-handlers-get-only.test.ts (D-12c GET-only + force-dynamic gate, ap dung cho route.ts moi cua shifts)"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria doi hoi curl voi cookie owner that (Ngoc Phat: mang 4 phan tu, Binh Minh: mang 3 phan tu, moi startTime/endTime khop ^\\d{2}:\\d{2}$) — mat khau tam cua 10 tai khoan seed khong con luu duoc trong moi truong nay (dung huong dan orchestrator, ke thua tu 02-05 D1/D2). Logic va hinh dang du lieu duoc kiem chung truc tiep tren live DB qua psql (dem dung so ca theo doanh nghiep, dung mot ca dem moi ben, gio va cot sinh dung), va toan bo ba phep bien doi kieu (cat giay, mang ngay, khong tinh lai cot sinh) da co test don vi voi canary chung minh co rang, nhung duong HTTP+session day du (Route Handler + getSessionContext + cookie that) chua duoc mot nguoi that xac nhan."

  - id: D2
    description: "Tron lat cat ghi ca lam viec: createShift/updateShift/duplicateShift kem requireRole(['owner','admin']) chan employee/manager (AUTH-03) va logMutation ghi dung mot dong audit_log/thao tac voi nguyen dong before/after (DATA-06, D-17, D-18); duplicateShift khong vuot ranh gioi doanh nghiep (T-02-06-01)"
    requirement: "DATA-06"
    verification:
      - kind: other
        ref: "Doc lai code (code review): ca ba ham deu goi getSessionContext() -> requireRole(['owner','admin']) -> doc nguyen dong TRUOC qua shiftRowSchema -> ghi voi .eq('company_id', companyId tu session) -> doc nguyen dong SAU -> logMutation trong CUNG ham voi before/after la nguyen dong tho (khong qua transform) — khop dung khuon da chung minh o 02-04/02-05. duplicateShift doc ca goc LUON kem .eq('company_id', companyId) nen id thuoc doanh nghiep khac se khong tim thay va nem loi truoc khi tao bat ky dong nao."
        status: pass
      - kind: unit
        ref: "src/__tests__/route-handlers-get-only.test.ts (GET-only + force-dynamic gate ap dung cho shifts/route.ts)"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria doi hoi thao tac ghi qua giao dien that (thanh vien owner/admin dang nhap) roi doc audit_log tang dung 1 dong/thao tac qua psql, va xac nhan so ca cua doanh nghiep con lai khong doi sau mot lan nhan ban — can mot phien dang nhap that ma moi truong nay khong the tao (cung ly do voi 02-05 D2). Da xac nhan bang psql rang audit_log hien co 0 dong entity_table='shifts' (baseline truoc khi co thao tac ghi that), va logic Server Action da duoc doc lai khop dung cac rang buoc D-17/D-18/T-02-06-01/T-02-06-02, nhung chua co bang chung tu dong (test hoac phien that) cho duong ghi qua HTTP."

  - id: D3
    description: "Test bien kieu du lieu ca lam viec: gio HH:MM:SS<->HH:mm, mang working_days (thu tu, do dai 1..7, phan tu ngoai khoang), va canh cam tinh lai cot sinh overnight — da chung minh co rang bang sabotage-and-revert"
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/shifts.test.ts (7/7 tests)"
        status: pass
      - kind: other
        ref: "sabotage-and-revert tren src/lib/data/shifts.ts: them tam mot phep tinh lai overnight tu startTime/endTime trong listShifts() -> npx vitest run tu 7/7 xanh xuong 1 that bai (nhom 3, 6/7 con lai van xanh); hoan tac (git diff rong, byte-identical) -> 7/7 xanh"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-01
status: complete
---

# Phase 2 Plan 06: Trọn lát cắt ca làm việc — đọc, ghi, audit Summary

**GET /api/shifts + Server Action createShift/updateShift/duplicateShift chạy thật trên Postgres — nhóm dữ liệu có kiểu phức tạp nhất của V1 (`time`, `smallint[]`, cột sinh `overnight`) đi qua khuôn Route Handler + Server Action + audit đã chứng minh ở 02-04/02-05.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-01 (theo đồng hồ hệ thống trong môi trường thực thi)
- **Completed:** 2026-08-01
- **Tasks:** 2/2
- **Files modified:** 7 (5 tạo mới, 2 sửa)

## Accomplishments

- `GET /api/shifts` đọc ca làm việc thật trên Postgres: `employeeCount` chỉ
  đếm nhân viên có `shift_id` khớp và `status <> 'terminated'`, sắp xếp
  `start_time` tăng dần rồi `id` tăng dần, `force-dynamic` tường minh
  (D-12c). Đã xác minh trực tiếp qua `psql` trên live DB: đúng 4 ca cho
  `cty-01` (Ngọc Phát) và 3 ca cho `cty-02` (Bình Minh), đúng một ca
  `overnight = true` mỗi doanh nghiệp.
- Ba phép biến đổi kiểu dữ liệu (cắt/thêm lại giây `HH:MM:SS` ↔ `HH:mm`,
  ràng buộc mảng `working_days` khớp CHECK của database, ánh xạ
  snake_case → camelCase) nằm trong **một schema duy nhất**
  (`shiftRowSchema`), dùng ngay sau khi đọc DB — không nơi thứ hai nào tự
  tính lại các phép biến đổi này.
- `overnight` **không bao giờ được tính lại** ở tầng ứng dụng — luôn đọc
  nguyên giá trị từ cột sinh (`generated always as (end_time < start_time)
  stored`). Cấm này được một test cụ thể canh (nhóm 3) và đã chứng minh có
  răng bằng sabotage-and-revert: thêm tạm một phép tính lại vào
  `listShifts()` làm test đỏ, hoàn tác trở lại xanh, diff rỗng byte-identical.
- Ba Server Action ghi (`createShift`, `updateShift`, `duplicateShift`) đều
  chặn `employee`/`manager` bằng `requireRole(["owner","admin"])` (AUTH-03)
  và ghi đúng một dòng `audit_log`/thao tác với nguyên dòng before/after
  (DATA-06, D-17, D-18). `updateShift` **không có nhánh** "không đổi gì thì
  bỏ qua" — một patch giữ nguyên mọi giá trị vẫn UPDATE và ghi audit với
  `before = after`.
- `duplicateShift` đọc ca gốc **luôn kèm** điều kiện `.eq("company_id",
  companyId)` từ session — một `id` thuộc doanh nghiệp khác sẽ không tìm
  thấy gì và ném lỗi trước khi tạo bất kỳ dòng nào, không bao giờ vượt ranh
  giới doanh nghiệp (T-02-06-01). Tên/mã bản sao dẫn xuất đúng quy tắc V1
  (`"${name} (bản sao)"`, `"${code}2"`).
- `shiftInputSchema` loại bỏ trường `overnight` khỏi đường ghi (Zod tự bỏ
  qua trường không khai báo trong input) — gửi cột sinh lên `insert`/`update`
  sẽ bị Postgres từ chối.

## Task Commits

1. **Task 1: Trọn lát cắt ca làm việc — đọc, ghi, audit** - `d6d654c` (feat)
2. **Task 2: Test biên kiểu dữ liệu ca làm việc — giờ, mảng ngày, cột sinh** - `559e9a7` (test)

## Files Created/Modified

- `src/lib/validation/api/shifts.ts` - `shiftRowSchema` (transform dòng thô
  DB → domain, dùng server-side ngay sau khi đọc), `shiftWithStatsSchema`/
  `shiftListResponseSchema` (plain, dùng ở cả hai đầu D-12d),
  `shiftInputSchema` (transform domain → dòng ghi snake_case, loại bỏ
  `overnight`)
- `src/app/api/shifts/route.ts` - `GET`-only, `force-dynamic`,
  `employeeCount` suy diễn từ `employees.shift_id` chưa nghỉ việc, sắp xếp
  `start_time` rồi `id`
- `src/lib/data/shifts.ts` - `ShiftWithStats` chuyển nhà từ `mock/service.ts`,
  `listShifts` qua `fetchJson`, re-export ba hàm ghi
- `src/lib/data/mutations/shifts.ts` - Server Action `createShift`/
  `updateShift`/`duplicateShift` kèm `requireRole` + `logMutation`
- `src/app/admin/shifts/shifts-view.tsx` - đổi import 4 hàm + kiểu sang
  `@/lib/data/shifts`
- `src/components/shifts/shift-card.tsx` - đổi import kiểu `ShiftWithStats`
  sang `@/lib/data/shifts` (xem Deviations — file này thực tế có phụ thuộc
  vào `mock/service`, khác giả định của plan)
- `src/lib/data/__tests__/shifts.test.ts` - 7 nhóm khẳng định cho ba phép
  biến đổi kiểu + cấm tính lại cột sinh, có canary đã chứng minh có răng

## Decisions Made

- **Wire contract là hình dạng cuối cùng, không phải dòng thô.** Route
  Handler dùng `shiftRowSchema` (transform) NGAY SAU khi đọc DB để ghép
  `employeeCount`, rồi parse LẠI bằng `shiftWithStatsSchema` (plain) trước
  khi trả — JSON gửi qua dây đã là camelCase/HH:mm. Client
  (`src/lib/data/shifts.ts`) parse lại CÙNG `shiftListResponseSchema`
  (không transform) sau khi nhận qua `fetchJson`. Đây đúng tinh thần D-12d
  (một schema dùng ở cả hai đầu) — khác với việc dùng schema transform ở cả
  hai đầu (sẽ đòi hỏi client nhận dòng thô, không đúng với JSON đã đóng gói
  sẵn).
- **Test biên chia hai mục tiêu khác nhau trong cùng một file.** 4 nhóm
  (1, 4, 5, 6) kiểm `shiftRowSchema` trực tiếp (không qua `fetch`) vì đây
  là khuôn Route Handler dùng để đọc dòng DB thô; 3 nhóm (2, 3, 7) kiểm
  `listShifts()` qua `fetch` giả lập vì đây là ranh giới client thực sự
  nhận JSON đã biến đổi. Cách chia này khớp đúng nơi mỗi phép biến đổi thực
  sự diễn ra, thay vì ép mọi test đi qua `fetch` một cách máy móc.
- **`updateShift`/`duplicateShift` merge ở tầng domain, không phải tầng
  DB.** Đọc dòng "before"/"source" qua `shiftRowSchema.parse()` (không phải
  object thô) trước khi hợp nhất với `patch` — tránh trộn lẫn hai hệ định
  dạng (snake_case+giây vs camelCase+HH:mm) trong cùng một hàm.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug trong giả định của plan] `shift-card.tsx` thực tế có import từ tầng giả lập**
- **Found during:** Task 1, bước (e) "Xác nhận `src/components/shifts/shift-card.tsx` không cần sửa"
- **Issue:** Plan giả định file này "không import gì từ tầng giả lập". Đọc trực tiếp file cho thấy dòng `import type { ShiftWithStats } from "@/lib/mock/service";` — giả định của plan sai.
- **Fix:** Đổi import sang `@/lib/data/shifts` (cùng kiểu `ShiftWithStats`, hình dạng giống hệt nên không ảnh hưởng typecheck). Đây là thay đổi một dòng, rủi ro thấp, và giữ đúng mục tiêu chung của Phase 2 (cắt phụ thuộc vào `mock/service.ts`) thay vì để lại một điểm neo cũ không cần thiết.
- **Files modified:** `src/components/shifts/shift-card.tsx`
- **Verification:** `npm run typecheck && npm run lint` thoát 0 sau khi sửa; `grep mock/service` trên file này giờ trả về 0.
- **Committed in:** `d6d654c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug trong giả định `read_first` của plan)
**Impact on plan:** Bổ sung cần thiết để giữ đúng mục tiêu "cắt tầng dữ liệu giả" của Phase 2; không mở rộng phạm vi ra ngoài các file liên quan trực tiếp đến ca làm việc.

## Issues Encountered

- **Không thể xác minh các acceptance criteria dựa trên curl + cookie phiên
  thật.** Giống 02-05, plan liệt kê nhiều acceptance criteria đòi hỏi đăng
  nhập thật (`curl -b <cookie> ...`) và đọc `audit_log` sau thao tác ghi qua
  giao diện thật. Theo đúng hướng dẫn orchestrator, KHÔNG thử đăng nhập.
  Thay vào đó: xác minh dữ liệu thô qua `psql` trực tiếp trên live DB (đếm
  đúng 4/3 ca theo doanh nghiệp, đúng một ca đêm mỗi bên, `tf_shift_minutes`/
  `tf_overnight` cho giá trị đúng trên cả hai ca đêm — 435 và 660 phút,
  đều dương, khớp cột sinh), và kiểm chứng toàn bộ logic biến đổi kiểu qua
  test đơn vị có canary. Đường HTTP+Auth+Server-Action đầy đủ (bao gồm
  `audit_log` tăng đúng số dòng sau thao tác ghi qua giao diện thật) chưa
  được một người thật xác nhận — ghi trong `coverage:` frontmatter với
  `human_judgment: true` (D1, D2) để verify-work đưa về đúng người.
- `gsd-tools windows append` — chưa thử ghi vì không có stub/skip nào cần
  ghi cho plan này (không có test bị skip, không có `<verify>` không chạy
  được — mọi `<verify>` trong PLAN.md đều đã chạy). Lỗi CRLF đã biết của
  `.planning/WINDOWS.md` (ghi nhận ở 02-05-SUMMARY.md) không phát sinh lại
  ở đây vì không cần dùng ledger.
- Không tìm được `psql` trên PATH mặc định của shell hiện tại — script
  `scripts/db.mjs` đã có sẵn logic dò tìm `C:\Program Files\PostgreSQL\<ver>\bin\psql.exe`
  trên Windows; dùng đúng đường dẫn đó (version 17) để chạy các câu lệnh
  xác minh trực tiếp, không cần thay đổi gì trong repo.

## User Setup Required

None - không có cấu hình dịch vụ ngoài nào cần thêm (không có migration mới
trong plan này, `shifts` đã tồn tại từ `0004_core_entities.sql`).

## Next Phase Readiness

- Khuôn `Route Handler đọc + Server Action ghi + audit` tiếp tục nhân rộng
  thành công lên nhóm dữ liệu phức tạp nhất của V1 (thời gian, mảng, cột
  sinh) — không phát hiện điểm nào trong khuôn không nhân rộng được.
- Mẫu "hai schema riêng cho hai chiều" (`shiftRowSchema` đọc,
  `shiftInputSchema` ghi) là tiền lệ rõ cho các plan sau khi cần xử lý
  `attendance_records` (cũng có `timestamptz`, GPS, và các hàm `tf_*`
  tương tự).
- **Chặn trước plan sau:** các acceptance criteria đòi hỏi phiên đăng nhập
  thật (curl + cookie, đọc `audit_log` qua UI thật) vẫn còn treo cho cả
  02-04, 02-05, và plan này. Người dùng nên chạy `npm run reset:passwords`
  (đã có từ trước, xem 02-05-SUMMARY.md) rồi xác nhận thủ công ít nhất một
  lần đăng nhập + một thao tác ghi ca làm việc để đóng các `coverage` entry
  (D1, D2) còn `human_judgment: true` ở trên.

## Self-Check: PASSED

All 5 created files confirmed present on disk; both task commit hashes
(`d6d654c`, `559e9a7`) confirmed present in `git log`.

---
*Phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi*
*Completed: 2026-08-01*
