---
phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
plan: 09
subsystem: api
tags: [supabase, postgrest, zod, nextjs-route-handler, server-action, audit-log, timezone]

requires:
  - phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi (plan 02-04..02-08)
    provides: >
      Khuon Route Handler doc (GET-only, force-dynamic, session-scoped) +
      Server Action ghi + audit da chung minh nam lan (companies/departments/
      shifts/employees/attendance-dashboard) va src/lib/today.ts
      (getServerToday()/getServerMonth(), D-19) — plan nay nhan rong khuon do
      len nhom du lieu cuoi cung (work_requests) va ap dung "hom nay"/"thang
      nay" do server cap cho hai man hinh cuoi cung con dung tang gia lap.
provides:
  - "GET /api/requests: doc yeu cau that, loc theo company session, 403 khi employee/manager hoi employeeId khac, mac dinh gioi han ve chinh minh khi khong truyen tham so, quan tri thay toan bo doanh nghiep (AUTH-03)"
  - "createRequest (Server Action): employee_id/company_id tu session (khong tu tham so client), trang thai/nguoi duyet/ghi chu duyet LUON dat pending/rong bat ke input, kiem toDate>=fromDate o tang ung dung + bat rieng loi check constraint 23514, ghi audit_log (DATA-06)"
  - "request-form-sheet.tsx nhan prop `today` (khong con REFERENCE_DATE) cho ca bon cho dung ngay mac dinh cua bieu mau (D-19)"
  - "employee-detail-view.tsx: TAM hAM cuoi cung chuyen sang @/lib/data/* (getMonthlySummary/listAttendance tu attendance.ts, listRequests tu requests.ts), nhan prop `month` thay REFERENCE_MONTH — khong con file nao duoi src/app/ hay src/components/ import @/lib/mock/service"
affects: [02-10, 02-11]

actuals:
  tokens: 6747
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "createRequest doi chieu employeeId voi bang employees (.eq('id', employeeId).eq('company_id', activeCompanyId)) TRUOC khi ghi -- cung khuon voi checkIn/bulkMoveDepartment: xac nhan thuc the dich thuoc DUNG doanh nghiep truoc khi tao mot dong tham chieu no, khong dua vao FK don thuan (FK khong kiem tra company_id)."
    - "GET /api/requests ap dung 'mac dinh gioi han ve chinh minh khi khong truyen tham so' cho vai tro khong phai quan tri -- khac voi GET /api/attendance (chi chan khi TRUYEN employeeId khac minh, khong tu dong gioi han khi thieu tham so). Diem khac biet co chu dich: yeu cau la loi khai ca nhan nhay cam hon cham cong thuong, nen mac dinh an toan hon (chi thay cua chinh minh) thay vi mac dinh mo (thay het cua doanh nghiep) khi client quen truyen employeeId."
    - "workRequestInputSchema/workRequestSchema tach doi (row schema transform vs plain schema hai dau, D-12d) tiep tuc mo hinh cua employeeRowSchema/shiftRowSchema — from_time/to_time (Postgres time) cat con giay giong start_time/end_time cua shiftRowSchema, khong viet lai logic o noi thu hai."

key-files:
  created:
    - src/lib/validation/api/requests.ts
    - src/lib/data/requests.ts
    - src/lib/data/mutations/requests.ts
    - src/app/api/requests/route.ts
    - src/lib/data/__tests__/requests.test.ts
  modified:
    - src/app/employee/requests/page.tsx
    - src/app/employee/requests/requests-view.tsx
    - src/components/employee-app/request-form-sheet.tsx
    - src/app/admin/employees/[id]/page.tsx
    - src/app/admin/employees/[id]/employee-detail-view.tsx

key-decisions:
  - "createRequest them mot buoc doc bang employees (.eq('id', employeeId).eq('company_id', activeCompanyId)) khong nam trong <action> chi tiet cua plan nhung can thiet de giu ranh gioi doanh nghiep — cung tinh than voi checkIn (02-08) va bulkMoveDepartment (02-07) da xac nhan thuc the lien quan truoc khi ghi, khong dua het vao FK (work_requests.employee_id chi tham chieu employees(id), khong kiem company_id)."
  - "GET /api/requests mac dinh gioi han employeeId ve chinh phien khi vai tro khong phai quan tri VA khong truyen tham so — khac voi khuon GET /api/attendance (chi chan khi employeeId TRUYEN VAO khac minh). Day la yeu cau tuong minh cua chinh <action> plan nay ('khong truyen employeeId thi mac dinh gioi han ve employeeId cua chinh phien'), ghi lai vi no la mot su khac biet co chu dich so voi tien le gan nhat, khong phai mot loi khong nhat quan."
  - "Loi check constraint 23514 (to_date >= from_date) duoc bat rieng va doi thanh CUNG thong diep tieng Viet voi kiem tra o tang ung dung — dung khuon 23505 cua createEmployee (02-07), khong de loi Postgres tho lot len giao dien."

requirements-completed: []

coverage:
  - id: D1
    description: "GET /api/requests doc yeu cau that: loc theo company_id tu session, 403 khi vai tro employee/manager hoi employeeId khac cua chinh minh, mac dinh gioi han ve chinh minh khi khong truyen tham so (quan tri thay toan bo doanh nghiep), sap xep created_at giam dan + id tang dan on dinh giua hai lan goi (AUTH-03, T-02-09-06)"
    requirement: "DATA-05"
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/requests.test.ts (5/5 test: danh sach rong tra [], giu nguyen thu tu server, cung thu tu hai lan goi, 403 nem Error tieng Viet, khang dinh tinh route.ts sap xep hai cot)"
        status: pass
      - kind: other
        ref: "Doc lai code: route.ts doi chieu queryParams.employeeId voi sessionEmployeeId TRUOC khi truy van khi role khong phai owner/admin, dung khuon GET /api/attendance (02-08); mac dinh gioi han khi thieu tham so la diem khac biet co chu dich (xem key-decisions)"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria doi hoi curl + cookie owner that (Ngoc Phat: 9 phan tu; Binh Minh: 3 phan tu) va cookie nhan vien thuong hoi employeeId nguoi khac (403) -- mat khau tam cua 10 tai khoan seed khong con luu duoc trong moi truong nay (ke thua tu 02-04..02-08). Logic loc/quyen da duoc unit-test (mock fetch) + code review khop dung khuon da chung minh, nhung duong HTTP+Session that chua duoc mot nguoi xac nhan."

  - id: D2
    description: "createRequest gan yeu cau vao company_id/employee_id tu phien (khong tu tham so client); employee/manager chi tao duoc cho chinh minh, owner/admin tao duoc cho moi nhan vien trong doanh nghiep (doi chieu qua bang employees); trang thai/nguoi duyet/ghi chu duyet LUON pending/rong; toDate < fromDate bi tu choi voi thong diep tieng Viet o ca hai lop (ung dung + check constraint); moi yeu cau de lai dung mot dong audit_log (AUTH-03, T-02-09-01, T-02-09-02, DATA-06)"
    requirement: "DATA-06"
    verification:
      - kind: other
        ref: "Doc lai code: createRequest goi getSessionContext() truoc moi thao tac I/O, so employeeId tham so voi employeeId/role cua phien TRUOC khi cham DB (khuon giong updateEmployee/checkIn), doi chieu employeeId voi bang employees theo company_id truoc khi insert, workRequestInputSchema khong khai status/reviewerId/reviewNote/createdAt nen client khong the gui len duoc bon gia tri do, logMutation goi dung MOT lan sau insert voi before=null"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run build thoat 0 -- xac nhan writeRow/insert khop dung cot that cua work_requests (supabase/migrations/0004_core_entities.sql), khong lech kieu"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria doi hoi tao mot yeu cau qua giao dien that roi doc audit_log tang dung 1 dong (before=NULL) va doc status cua dong moi qua psql -- can mot phien dang nhap that ma moi truong nay khong the tao (cung ly do voi 02-04..02-08 D2). Logic Server Action da duoc code review khop dung cac rang buoc va cac cot that cua bang, nhung chua co bang chung tu dong (test hoac phien that) cho duong Server Action + DB day du."

  - id: D3
    description: "request-form-sheet.tsx lay ngay mac dinh tu prop `today` (getServerToday(), D-19), khong con REFERENCE_DATE va khong tu doc dong ho thiet bi cho lan ve dau"
    requirement: "DATA-08"
    verification:
      - kind: unit
        ref: "npm run build (thoat 0) + npm run typecheck + npm run lint (thoat 0)"
        status: pass
      - kind: other
        ref: "grep -rEc 'REFERENCE_DATE|REFERENCE_MONTH' src/components/employee-app/request-form-sheet.tsx src/app/employee/requests/*.tsx -> 0 cho moi file; grep -rc '@/lib/mock/service' src/app/employee/requests/*.tsx -> 0 cho moi file"
        status: pass
    human_judgment: false

  - id: D4
    description: "employee-detail-view.tsx la man hinh cuoi cung con dung tang gia lap: tam ham chuyen ve nam module @/lib/data/*, thang lay tu prop `month` (getServerMonth(), D-19) thay REFERENCE_MONTH o ca ba cho dung. Sau plan nay, khong file nao duoi src/app/ hay src/components/ con import @/lib/mock/service"
    requirement: "DATA-08"
    verification:
      - kind: unit
        ref: "npm run typecheck && npm run lint && npm run test && npm run build thoat 0"
        status: pass
      - kind: other
        ref: "git grep -l '@/lib/mock/service' -- src/app src/components -> khong tra ve file nao; grep -rEc 'REFERENCE_DATE|REFERENCE_MONTH' src/app/admin/employees/ -> 0 cho moi file; git grep -lE 'REFERENCE_DATE|REFERENCE_MONTH' -- src/app src/components -> chi con src/components/employees/employee-form.tsx (dung du kien, xem Next Phase Readiness)"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria doi hoi mo /admin/employees/nv-01a trong trinh duyet that voi cookie owner Ngoc Phat, xac nhan nam tab render du du lieu that va Console khong loi -- khong the mo trinh duyet that trong moi truong nay. Cau truc (Server Component await getServerMonth() truoc khi render, khong client component nao tu tinh lai thang) da duoc code review va build/typecheck/test xac nhan khong loi; cac grep tinh (mock layer, hang so ngay) da chay va dung ket qua ky vong."

duration: 55min
completed: 2026-08-01
status: complete
---

# Phase 2 Plan 09: Trọn lát cắt yêu cầu + trang chi tiết nhân viên — hai màn hình cuối cùng rời tầng dữ liệu giả Summary

**`GET /api/requests` + Server Action `createRequest` chạy thật trên Postgres (audit_log, ngày mặc định do server cấp qua `getServerToday()`), và `employee-detail-view.tsx` — màn hình dùng nhiều nhóm dữ liệu nhất của V1 — chuyển nốt ba hàm cuối cùng sang `@/lib/data/*`. Sau plan này, không còn file nào dưới `src/app/` hay `src/components/` import `@/lib/mock/service`.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-01 (theo đồng hồ hệ thống trong môi trường thực thi)
- **Completed:** 2026-08-01
- **Tasks:** 2/2
- **Files modified:** 10 (5 tạo mới, 5 sửa)

## Accomplishments

- `GET /api/requests` đọc yêu cầu thật, lọc `.eq("company_id", companyId)` từ
  session, sắp xếp `created_at` giảm dần rồi `id` tăng dần (tiebreaker bắt
  buộc vì seed tạo nhiều yêu cầu cùng lúc, T-02-09-06). Lớp quyền (AUTH-03):
  vai trò `employee`/`manager` hỏi `employeeId` khác của mình bị từ chối
  (403); **không truyền** `employeeId` thì hai vai trò đó tự động giới hạn
  về chính mình (khác `GET /api/attendance` chỉ chặn khi truyền sai — quyết
  định có chủ đích, xem Decisions), `owner`/`admin` luôn thấy toàn bộ doanh
  nghiệp.
- `createRequest` (Server Action) gán `employee_id`/`company_id` từ phiên,
  **không** bao giờ từ tham số client (D-12b): `employee`/`manager` chỉ tạo
  được cho chính mình (T-02-09-01), `owner`/`admin` tạo được cho mọi nhân
  viên **trong doanh nghiệp** — đối chiếu qua một truy vấn `employees`
  trước khi ghi, không dựa vào FK đơn thuần (FK không kiểm `company_id`).
  Trạng thái/người duyệt/ghi chú duyệt luôn được đặt cứng `pending`/rỗng
  ngay trong hàm (T-02-09-02) — `workRequestInputSchema` không khai bốn
  trường đó nên client không gửi lên được. `toDate < fromDate` bị từ chối ở
  cả hai lớp (ứng dụng trước, `check` constraint của database là lớp hai,
  bắt riêng mã `23514` và đổi thành cùng thông điệp tiếng Việt). Mỗi lần tạo
  ghi đúng một dòng `audit_log` với `before = null` (DATA-06).
- `request-form-sheet.tsx` nhận prop `today: string` (từ `getServerToday()`
  ở `page.tsx`, D-19) cho cả bốn chỗ dùng làm giá trị mặc định của biểu mẫu
  — xóa hẳn import `REFERENCE_DATE`. `requests-view.tsx` đổi sang
  `@/lib/data/requests` (`createRequest`, `listRequests`) và
  `@/lib/data/employees` (`listAllEmployees`).
- `employee-detail-view.tsx` — màn hình dùng **tám hàm thuộc năm nhóm dữ
  liệu khác nhau**, phép thử tổng hợp cuối cùng cho khuôn Route Handler +
  Server Action + audit đã dựng suốt phase — chuyển nốt ba hàm còn sót
  (`getMonthlySummary`/`listAttendance` từ `@/lib/data/attendance`,
  `listRequests` từ `@/lib/data/requests`, cả hai đã tạo ở 02-08/plan này).
  Nhận prop `month: string` (từ `getServerMonth()` ở `page.tsx`) thay
  `REFERENCE_MONTH` ở cả ba chỗ dùng (tham số hàm tổng hợp, nhãn "Công
  tháng...", nhãn bảng chấm công).
- **Chốt sổ:** `git grep -l "@/lib/mock/service" -- src/app src/components`
  không còn trả về file nào — tầng dữ liệu giả không còn người dùng nào
  trong `src/app/` và `src/components/`. Duy nhất
  `src/components/employees/employee-form.tsx` còn dùng `REFERENCE_DATE`
  (giá trị khởi tạo `startDate` của biểu mẫu nhân viên mới) — đúng dự kiến
  của plan này (giao lại cho plan cuối cùng dọn cùng lúc với việc gỡ bản
  thân tầng giả lập).

## Task Commits

1. **Task 1: Trọn lát cắt yêu cầu — đọc, tạo, audit, và ngày mặc định do server cấp** - `35d466e` (feat)
2. **Task 2: Trang chi tiết nhân viên — tám hàm, năm nhóm dữ liệu, một màn hình cuối** - `eefd214` (feat)

## Files Created/Modified

- `src/lib/validation/api/requests.ts` - `workRequestSchema` (row, transform
  snake_case→camelCase, cắt giây `from_time`/`to_time`),
  `workRequestPlainSchema`/`workRequestListResponseSchema` (D-12d, hai đầu),
  `requestQuerySchema`, `workRequestInputSchema` (transform camelCase→snake_case,
  đúng 6 trường nghiệp vụ)
- `src/lib/data/requests.ts` - `listRequests` qua `fetchJson`, re-export
  `createRequest`
- `src/lib/data/mutations/requests.ts` - Server Action `createRequest`:
  quyền hai nhánh, đối chiếu `employeeId` với bảng `employees`, kiểm
  `toDate>=fromDate`, `logMutation`
- `src/app/api/requests/route.ts` - `GET`-only, `force-dynamic`, lọc company
  session, 403 + mặc định giới hạn về chính mình cho vai trò không phải
  quản trị
- `src/lib/data/__tests__/requests.test.ts` - 5 test: edge DATA-05 empty,
  giữ nguyên thứ tự server, ổn định qua hai lần gọi, 403 → Error tiếng
  Việt, khẳng định tĩnh sắp xếp hai cột của `route.ts`
- `src/app/employee/requests/page.tsx` - `await getServerToday()`, truyền
  `today` xuống `RequestsView`
- `src/app/employee/requests/requests-view.tsx` - nhận prop `today`, đổi
  import sang `@/lib/data/requests`/`@/lib/data/employees`
- `src/components/employee-app/request-form-sheet.tsx` - nhận prop `today`,
  xóa `REFERENCE_DATE`
- `src/app/admin/employees/[id]/page.tsx` - `await getServerMonth()`,
  truyền `month` xuống `EmployeeDetailView`
- `src/app/admin/employees/[id]/employee-detail-view.tsx` - nhận prop
  `month`, đổi import 3 hàm cuối sang `@/lib/data/attendance`/`@/lib/data/requests`

## Decisions Made

- **`createRequest` đối chiếu `employeeId` với bảng `employees` theo
  `company_id` trước khi ghi.** Không nằm trong `<action>` chi tiết của
  plan nhưng cần thiết để giữ ranh giới doanh nghiệp — `work_requests.employee_id`
  chỉ tham chiếu `employees(id)`, không kiểm `company_id`, nên không có
  bước này thì `owner`/`admin` của công ty A có thể tạo yêu cầu đứng tên
  một nhân viên của công ty B. Cùng khuôn với `checkIn` (02-08) và
  `bulkMoveDepartment` (02-07).
- **`GET /api/requests` mặc định giới hạn về chính phiên khi thiếu
  `employeeId`, khác khuôn `GET /api/attendance`.** Đây là yêu cầu tường
  minh của chính `<action>` plan này ("không truyền `employeeId` thì mặc
  định giới hạn về `employeeId` của chính phiên cho hai vai trò đó"), khác
  với `/api/attendance` (chỉ chặn khi tham số truyền sai, không tự giới
  hạn khi thiếu). Ghi lại rõ vì đây là khác biệt có chủ đích, không phải
  thiếu nhất quán.
- **Lỗi `check` constraint `23514` bắt riêng, đổi thành cùng thông điệp
  tiếng Việt với kiểm tra ở tầng ứng dụng.** Cùng khuôn với `23505` của
  `createEmployee` (02-07) — không để lỗi Postgres thô lọt lên giao diện.

## Deviations from Plan

None - kế hoạch thực thi đúng như văn bản. Một bước bổ sung (đối chiếu
`employeeId` với bảng `employees`) được ghi rõ ở mục Decisions vì nó không
nằm trong danh sách hành động chi tiết của plan nhưng là hệ quả bắt buộc để
giữ đúng ranh giới doanh nghiệp (Rule 2 — bổ sung yêu cầu đúng đắn/bảo mật,
không phải một tính năng tùy chọn).

## Issues Encountered

- **Không thể xác minh các acceptance criteria dựa trên curl + cookie phiên
  thật hoặc mở trình duyệt thật.** Giống 02-04..02-08, nhiều acceptance
  criteria đòi hỏi đăng nhập thật (curl với cookie owner Ngọc Phát/Bình
  Minh, cookie nhân viên thường, mở `/admin/employees/nv-01a` trong trình
  duyệt) — mật khẩu tạm của 10 tài khoản seed không còn lưu được trong môi
  trường này. Đã bù bằng: 5 unit test cho `listRequests` (edge empty, thứ
  tự ổn định, 403, khẳng định tĩnh sắp xếp hai cột) + code review khớp
  đúng khuôn đã chứng minh ở 02-04..02-08 + `npm run typecheck && npm run
  lint && npm run test && npm run build` đều thoát 0. Ghi trong `coverage:`
  frontmatter với `human_judgment: true` (D1, D2, D4) cho các phần cần một
  phiên đăng nhập thật hoặc trình duyệt thật.
- `gsd-tools windows append` được biết là lỗi CRLF có sẵn trong
  `.planning/WINDOWS.md` (ghi nhận từ 02-05..02-08) — không thử ghi lại ở
  đây; các mục "chưa xác minh qua phiên thật" đã được ghi đầy đủ trong
  `coverage:` frontmatter ở trên.

## User Setup Required

None - không có cấu hình dịch vụ ngoài nào cần thêm (không có migration mới
trong plan này).

## Next Phase Readiness

- **Đây là plan cuối cùng chuyển screen sang dữ liệu thật.** Xác nhận bằng
  `git grep -l "@/lib/mock/service" -- src/app src/components` không trả
  về file nào — khớp đúng success criteria của plan.
- **Danh sách chính xác còn sót lại cho 02-10/02-11** (theo yêu cầu tường
  minh của Task 2 hành động (d)):
  - `src/components/employees/employee-form.tsx` — còn dùng `REFERENCE_DATE`
    làm giá trị khởi tạo `startDate` của biểu mẫu nhân viên mới. Đây là
    file duy nhất còn lại theo `git grep -lE "REFERENCE_DATE|REFERENCE_MONTH"
    -- src/app src/components` — đúng dự kiến của `02-CONTEXT.md`.
  - `src/lib/constants.ts` — vẫn giữ định nghĩa `REFERENCE_DATE`/`REFERENCE_MONTH`
    (không xóa cho tới khi không còn nơi nào dùng).
  - `src/lib/mock/db.ts`, `src/lib/mock/seed.ts`, `src/lib/mock/service.ts` —
    bản thân tầng giả lập, không còn người dùng nào trong `src/app/`/`src/components/`
    nhưng CHƯA bị xóa — việc của 02-11 (phase gate).
  - `src/lib/mock/store.tsx` (`MockDataProvider`, version counter) và
    `src/hooks/use-mock-query.ts` — **giữ nguyên có chủ đích** theo D-12
    (cơ chế invalidation/fetching, không phải nguồn dữ liệu giả) — không
    phải việc của 02-11.
- Khuôn `Route Handler đọc + Server Action ghi + audit` đã nhân rộng thành
  công liên tục qua sáu nhóm dữ liệu (companies/departments/shifts/
  employees/attendance-dashboard/requests) — không phát hiện điểm nào
  trong khuôn không nhân rộng được cho `work_requests`.
- 02-10 (tạo tài khoản) và 02-11 (xóa tầng dữ liệu giả, phase gate) là hai
  plan còn lại của phase. 02-11 cần danh sách trên để xác nhận an toàn khi
  xóa `mock/db.ts`/`mock/seed.ts`/`mock/service.ts`.
- **Chặn trước plan sau:** các acceptance criteria đòi hỏi phiên đăng nhập
  thật/trình duyệt thật vẫn còn treo cho cả 02-04..02-09 (kế thừa, chưa
  đóng). Người dùng nên chạy `npm run reset:passwords` rồi xác nhận thủ
  công ít nhất: (1) tạo một yêu cầu nghỉ phép qua giao diện thật, đối chiếu
  `audit_log` tăng đúng 1 dòng; (2) mở `/admin/employees/nv-01a`, xác nhận
  cả năm tab render đúng dữ liệu thật không lỗi Console; (3) `curl` với
  cookie nhân viên thường hỏi `employeeId` của người khác ở cả hai endpoint
  `/api/requests` và `/api/attendance`, xác nhận mã `403`.

## Self-Check: PASSED

All 5 created files confirmed present on disk; both task commit hashes
(`35d466e`, `eefd214`) confirmed present in `git log`.

---
*Phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi*
*Completed: 2026-08-01*
