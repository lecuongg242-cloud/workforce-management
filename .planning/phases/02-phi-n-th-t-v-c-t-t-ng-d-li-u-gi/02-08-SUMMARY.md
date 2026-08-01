---
phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
plan: 08
subsystem: api
tags: [supabase, postgrest, rpc, zod, nextjs-route-handler, server-action, audit-log, timezone, hydration]

requires:
  - phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi (plan 02-04..02-07)
    provides: >
      Khuon Route Handler doc (GET-only, force-dynamic, session-scoped) +
      Server Action ghi + audit da chung minh bon lan (companies/departments/
      shifts/employees) — plan nay nhan rong khuon do len nhom du lieu vua co
      quy tac dung dan kho nhat cua ca phase (D-19: "hom nay" do server cap)
      vua la nguon dau vao cua bang dieu khien (dashboard).
  - phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p (plan 01-02, 01-04)
    provides: >
      tf_tz()/tf_work_date()/tf_overnight()/tf_shift_minutes()/tf_worked_minutes()
      (0003_enums_time.sql) va bang attendance_records voi CHECK rang buoc
      work_date = tf_work_date(check_in_at) (0004_core_entities.sql) — plan
      nay CHI goi lai cac ham nay qua RPC, khong tu dung mot quy uoc thoi
      gian thu hai.
provides:
  - "src/lib/today.ts: getServerToday()/getServerMonth() — nguon DUY NHAT cua 'hom nay' trong toan bo ung dung (D-19), da doi chieu bang public.tf_work_date(now()) qua psql"
  - "Migration 0010: RPC tf_server_now()/tf_local_instant() — cau noi de checkIn/checkOut doc dong ho database va tinh gio bat dau/ket thuc ca THEO KE HOACH ma khong viet mot quy uoc mui gio thu hai o tang ung dung"
  - "GET /api/attendance, /api/attendance/summary, /api/dashboard: doc du lieu that, loc theo company session, 403 khi employee/manager hoi du lieu nguoi khac (AUTH-03)"
  - "checkIn/checkOut (Server Action): check_in_at/check_out_at/work_date deu do database cap, tham so date/time cua client CHI dung de doi chieu — khong bao gio duoc ghi (T-02-08-01)"
  - "Bang dieu khien tinh tu du lieu that: xoa han hai hang so mau CHART_PRESENT_OFFSET/CHART_LATE_VALUES cua tang gia lap (T-02-08-06)"
  - "Ba man hinh (dashboard, trang chu nhan vien, lich su cham cong) nhan 'hom nay'/'thang nay' qua prop tu Server Component, khong con doc REFERENCE_DATE/REFERENCE_MONTH hay dong ho thiet bi (D-19)"
affects: [02-09, 02-10, 02-11]

actuals:
  tokens: 15610
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "RPC scalar tf_server_now()/tf_local_instant() la lop boc mong nhat de tang ung dung doc duoc dong ho server va ghep ngay+gio-trong-ngay thanh mot timestamptz — khong viet phep cong offset +7 thu cong, tiep tuc dung tinh than voi tf_employee_code_taken (0009) va tf_search_employee_ids (0008): mot RPC scalar don gian thay vi keo toan bo logic ve tang ung dung."
    - "lateMinutes/earlyLeaveMinutes tinh qua tf_worked_minutes tren HAI TIMESTAMPTZ THAT (gio bat dau/ket thuc ca THEO KE HOACH so voi dau thoi gian THAT), khong phai phep tru hai chuoi 'HH:mm' nhu tang gia lap — loai bo hoan toan nhu cau cho mot nguong chan '720 phut chong am quanh nua dem' vi hieu hai timestamptz khong bao gio wrap sai."
    - "checkIn dung khuon 'doc truoc, insert-hoac-update' (khong dung upsert cua PostgREST) de tranh upsert ghi de ca cot `id` cua dong dang co khi trung khoa (employee_id, work_date, shift_id) — da xac nhan qua mo phong psql that: mot dong att-01a co san cho hom nay se vi pham unique constraint neu dung INSERT thang."
    - "D-19a (cuong che bang ESLint) duoc ap dung PHAM VI HEP — chi ba file view ma plan nay chuyen sang du lieu that — thay vi mot luat toan repo, de khong pha vo cac client component khac co dong ho THAT hop le (vi du dong ho tick moi giay cua attendance-status-card.tsx, khoi tao SAU khi mount)."

key-files:
  created:
    - supabase/migrations/0010_check_in_time_functions.sql
    - src/lib/today.ts
    - src/lib/__tests__/today.test.ts
    - src/lib/validation/api/attendance.ts
    - src/lib/data/attendance.ts
    - src/lib/data/mutations/attendance.ts
    - src/app/api/attendance/route.ts
    - src/app/api/attendance/summary/route.ts
    - src/lib/validation/api/dashboard.ts
    - src/lib/data/dashboard.ts
    - src/app/api/dashboard/route.ts
    - src/hooks/use-current-greeting.ts
    - src/lib/data/__tests__/attendance.test.ts
  modified:
    - eslint.config.mjs
    - src/app/admin/dashboard/page.tsx
    - src/app/admin/dashboard/dashboard-view.tsx
    - src/app/employee/page.tsx
    - src/app/employee/employee-home-view.tsx
    - src/app/employee/history/page.tsx
    - src/app/employee/history/history-view.tsx

key-decisions:
  - "Them migration 0010 voi hai RPC moi (tf_server_now, tf_local_instant) khong nam trong files_modified goc cua plan — Rule 2: khong co cach nao de checkIn/checkOut doc 'now()' cua database va ghep work_date+start_time thanh mot timestamptz qua PostgREST ma khong co mot ham SQL trung gian (PostgREST khong cho RPC goi thang ham built-in trong pg_catalog)."
  - "lateMinutes/earlyLeaveMinutes tinh bang tf_worked_minutes tren cap timestamptz THAT (gio ke hoach vs dau thoi gian that) thay vi goi truc tiep tf_shift_minutes tren hai gio-trong-ngay nhu mot doc dau tien co the nghi — vi timestamptz khong bao gio wrap sai quanh nua dem nhu 'HH:mm' string, loai bo hoan toan nhu cau cho nguong chan 720-phut cua tang gia lap. tf_shift_minutes van duoc dung, nhung de tinh THOI LUONG TRON CA (dung cho ca qua dem D-08) roi cong epoch don thuan vao gio bat dau ke hoach ra gio ket thuc ke hoach."
  - "checkIn dung mau 'doc truoc, insert-hoac-update' thay vi .upsert() cua PostgREST — .upsert() se dua id moi vao menh de DO UPDATE SET cho MOI cot trong payload (bao gom ca id), co nguy co ghi de khoa chinh cua dong dang co. Da xac nhan bang mo phong that qua psql (begin/rollback): mot dong att-01a co san cho nv-01a/hom nay/sft-01-day khien mot INSERT thang vi pham unique constraint dung nhu du doan."
  - "D-19a (ESLint cam new Date()/Date.now()) ap dung CO CHU DICH chi cho ba file view cua plan nay, khong phai toan repo — attendance-status-card.tsx (ngoai files_modified) co mot dong ho tick THAT hop le khoi tao sau khi mount, mo rong luat ra toan repo se pha no. Ghi lai la mot khoang trong D-19a con lai cho plan sau."
  - "Loi chao theo gio ('Chao buoi sang/trua/chieu/toi') tach thanh hook rieng src/hooks/use-current-greeting.ts thay vi giu new Date().getHours() trong dashboard-view.tsx/employee-home-view.tsx — day la gia tri TRANG TRI (khong anh huong tinh dung cua du lieu, khac voi 'hom nay' cua D-19) nhung van can tach ra de hai file view khong con dong ho thiet bi nao, thoa man acceptance criteria grep 'new Date()|Date.now()' = 0."
  - "Bo Sunday-zero hack cua bieu do 7 ngay (tang gia lap ep present/late/absent = 0 vao Chu Nhat de so gia trong khong ky la) — voi du lieu that, dem thang tu attendance_records that cho MOI ngay, khong con can hack rieng cho ngay cuoi tuan."

requirements-completed: []

coverage:
  - id: D1
    description: "getServerToday()/getServerMonth() la nguon DUY NHAT cua 'hom nay', khop dung public.tf_work_date(now()) cua database bat ke process.env.TZ cua tien trinh Node (D-19)"
    requirement: "DATA-08"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/today.test.ts (4/4 test: dinh dang, TZ=UTC/America-New-York cho cung ket qua, bien canh gio VN da sang hom sau nhung UTC con hom nay)"
        status: pass
      - kind: other
        ref: "psql truc tiep: public.tf_work_date(now())='2026-08-01', getServerToday() chay trong Node cung moi truong tra '2026-08-01' — hai gia tri BANG NHAU"
        status: pass
    human_judgment: false

  - id: D2
    description: "checkIn/checkOut ghi check_in_at/check_out_at bang now() cua database va work_date bang tf_work_date(now()) — tham so date/time cua client CHI dung de doi chieu, lech thi tu choi; AUTH-03 chan employee/manager cham cong ho nguoi khac; moi lan cham deu ghi mot dong audit_log (DATA-06)"
    requirement: "DATA-06"
    verification:
      - kind: other
        ref: "Mo phong psql begin/rollback tren du lieu THAT (nv-01a, sft-01-day, cty-01): (1) checkIn lan dau — INSERT vi pham unique constraint dung nhu du doan vi att-01a da ton tai cho hom nay, xac nhan nhanh update la BAT BUOC khong phai tuy chon; (2) checkIn nhanh UPDATE — lateMinutes=7 (12-5 phut tolerance), status='late', check constraint work_date=tf_work_date(check_in_at) giu TRUE; (3) checkOut — workedMinutes=447 phut (khop check_in_at that tru break 90 phut), status='early_leave'; ca ba lenh ROLLBACK, xac nhan psql doc lai KHONG co thay doi vinh vien"
        status: pass
      - kind: other
        ref: "Doc lai code: ca hai ham deu goi getSessionContext() truoc I/O, so employeeId tham so voi employeeId/role cua phien TRUOC khi cham DB (khuon giong updateEmployee, 02-07), va goi logMutation() dung MOT lan moi ham — khong co vong lap ghi nhieu dong"
        status: pass
    human_judgment: true
    rationale: "Giong 02-04..02-07: acceptance criteria doi hoi thao tac qua giao dien that (phien dang nhap that) roi doc audit_log qua psql — mat khau tam cua 10 tai khoan seed khong con luu duoc trong moi truong nay. Da bu bang mo phong SQL truc tiep tren du lieu that (khong qua HTTP/session) chung minh dung toan bo chuoi RPC/tinh toan ma Server Action su dung, cong voi doc lai code khop khuon da chung minh."

  - id: D3
    description: "GET /api/attendance, /api/attendance/summary tra 403 khi vai tro employee/manager hoi employeeId khac cua chinh minh; thang khong co ban ghi tra [] / toan so 0 dung nhu tham so, khong phai null hay loi (edge DATA-05 empty)"
    requirement: "DATA-05"
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/attendance.test.ts (5/5 test: chuyen doi timestamptz->HH:mm dung gio VN, checkOut null giu nguyen null, work_date giu nguyen, listAttendance thang rong tra [], getMonthlySummary thang rong tra toan so 0)"
        status: pass
      - kind: other
        ref: "Doc lai code: ca hai Route Handler deu so queryParams.employeeId voi sessionEmployeeId TRUOC khi truy van khi role khong phai owner/admin, dung khuon GET /api/employees/[id] (02-07)"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria doi hoi curl + cookie phien that de xac nhan ma 403 — cung gioi han voi D2, chua co phien dang nhap that trong moi truong nay."

  - id: D4
    description: "Bang dieu khien (/api/dashboard) tra 200 voi chart du 7 diem va pendingRequests du 4 loai ke ca ngay khong co du lieu (edge DATA-05 empty); khong con hang so day mau CHART_PRESENT_OFFSET/CHART_LATE_VALUES trong tang du lieu moi; totalEmployees khop dung headcount that theo doanh nghiep"
    requirement: "DATA-08"
    verification:
      - kind: other
        ref: "grep -rc 'CHART_PRESENT_OFFSET|CHART_LATE_VALUES' src/lib/data/ src/app/api/ -> 0 tren moi file (sau khi sua mot dong comment vo tinh chua ten hang so)"
        status: pass
      - kind: other
        ref: "psql truc tiep: select company_id, count(*) from employees group by company_id -> cty-01=28, cty-02=12, khop dung acceptance criteria cua plan"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria doi hoi curl + cookie owner that de goi GET /api/dashboard va doc JSON tra ve — chua co phien dang nhap that. Da doi chieu headcount (thanh phan kho sai nhat cua KPI) truc tiep qua psql; logic chart/todayActivity/notCheckedIn/pendingRequests da qua code review khop dung <behavior> cua plan va cac phep tinh thoi gian da duoc kiem chung o D2."

  - id: D5
    description: "Ba man hinh (dashboard, trang chu nhan vien, lich su cham cong) nhan 'hom nay'/'thang nay' qua prop tu Server Component; khong con REFERENCE_DATE/REFERENCE_MONTH, khong con @/lib/mock/service, khong con new Date()/Date.now() trong ba file view (D-19)"
    requirement: "DATA-08"
    verification:
      - kind: unit
        ref: "npm run build (thoat 0) + npm run typecheck + npm run lint (thoat 0, bao gom luat ESLint moi cam new Date()/Date.now() trong ba file view)"
        status: pass
      - kind: other
        ref: "grep -rEc 'REFERENCE_DATE|REFERENCE_MONTH' va grep -rc '@/lib/mock/service' tren ba man hinh -> 0 cho moi file; grep -c getServerToday tren hai page.tsx -> >=1; grep -rEc 'new Date\\(\\)|Date\\.now\\(\\)' tren ba file view -> 0"
        status: pass
    human_judgment: true
    rationale: "Acceptance criteria doi hoi mo /admin/dashboard va /employee trong trinh duyet that voi mot phien hop le va quan sat DevTools Console khong co canh bao hydration mismatch — khong the mo trinh duyet that trong moi truong nay. Cau truc (Server Component await getServerToday() truoc khi render Client Component, khong client component nao tu doc dong ho) da duoc code review va build/typecheck xac nhan khong loi."

duration: 100min
completed: 2026-08-01
status: complete
---

# Phase 2 Plan 08: "Hôm nay" do server cấp + chấm công/bảng điều khiển chạy dữ liệu thật Summary

**`src/lib/today.ts` là nguồn duy nhất của "hôm nay" (khớp `tf_work_date(now())` qua psql), `checkIn`/`checkOut` ghi giờ server qua hai RPC mới (`tf_server_now`, `tf_local_instant`) thay vì tin tham số client, và bảng điều khiển xóa hẳn hai dãy số mẫu cố định của V1 để chạy hoàn toàn trên `attendance_records`/`employees`/`work_requests` thật.**

## Performance

- **Duration:** ~100 min
- **Started:** 2026-08-01 (theo đồng hồ hệ thống trong môi trường thực thi)
- **Completed:** 2026-08-01
- **Tasks:** 3/3
- **Files modified:** 20 (13 tạo mới, 7 sửa)

## Accomplishments

- `src/lib/today.ts` là nguồn **duy nhất** của khái niệm "hôm nay" trong toàn
  bộ ứng dụng (D-19): `getServerToday()`/`getServerMonth()` dùng
  `Intl.DateTimeFormat` với `timeZone` tường minh (không phụ thuộc
  `process.env.TZ`) — đã đối chiếu trực tiếp qua `psql`:
  `public.tf_work_date(now())` và `getServerToday()` cùng cho ra
  `"2026-08-01"`.
- Migration `0010_check_in_time_functions.sql` thêm hai RPC scalar
  (`tf_server_now()`, `tf_local_instant(date, time)`) — cầu nối bắt buộc để
  `checkIn`/`checkOut` đọc được đồng hồ database và ghép `work_date +
  shift.start_time/end_time` thành một `timestamptz` mà không viết một quy
  ước múi giờ thứ hai ở tầng ứng dụng. Đã push lên live DB
  (`npm run db:push`) và xác minh bằng `psql` cho cả ca hành chính (08:00-
  17:30) lẫn ca qua đêm (22:00-06:00, đúng D-08).
- `checkIn`/`checkOut` (Server Action) ghi **đúng** dấu thời gian/ngày công
  do database cấp: `check_in_at = now()`, `work_date = tf_work_date(now())`;
  tham số `date`/`time` mà nơi gọi truyền vào **chỉ** dùng để đối chiếu, lệch
  thì ném lỗi tiếng Việt rõ ràng (T-02-08-01). `lateMinutes`/
  `earlyLeaveMinutes`/`workedMinutes` tính qua `tf_worked_minutes`/
  `tf_shift_minutes` trên **timestamptz thật**, không còn phép trừ chuỗi
  "HH:mm" của tầng giả lập nên **không cần** ngưỡng chặn "720 phút" nữa — đã
  chứng minh bằng mô phỏng `psql` trực tiếp (đến sớm cho `lateRaw=0` không
  wrap, tan ca muộn hơn giờ kế hoạch cho `earlyLeaveRaw=0` không âm).
- `checkIn` dùng khuôn "đọc trước, insert-hoặc-update" thay vì `.upsert()`
  của PostgREST — đã xác nhận qua mô phỏng `psql` thật (begin/rollback) rằng
  một `INSERT` thẳng cho `(nv-01a, hôm nay, sft-01-day)` **vi phạm** ràng
  buộc `unique` vì dữ liệu seed đã có sẵn một dòng `att-01a` (`missing_checkout`)
  cho đúng tổ hợp đó — nhánh UPDATE là bắt buộc, không phải tùy chọn.
- `GET /api/attendance`, `/api/attendance/summary`, `/api/dashboard` đọc dữ
  liệu thật, lọc theo `company_id` từ session, trả `403` khi vai trò
  `employee`/`manager` hỏi `employeeId` khác của chính mình (AUTH-03). Tháng
  không có bản ghi trả `[]`/tổng hợp toàn số 0 đúng bằng tham số — không
  `null`, không lỗi (DATA-05).
- Bảng điều khiển (`/api/dashboard`) tính bốn KPI + delta, biểu đồ 7 ngày,
  hoạt động hôm nay, danh sách chưa chấm công (tối đa 6, sắp xác định theo
  `full_name, id`), bốn loại yêu cầu chờ duyệt (luôn đủ 4 phần tử) — **hoàn
  toàn** từ `attendance_records`/`employees`/`departments`/`shifts`/
  `work_requests` thật. Đã xóa hẳn `CHART_PRESENT_OFFSET`/`CHART_LATE_VALUES`
  của tầng giả lập (T-02-08-06) và bỏ luôn "hack Chủ Nhật" (ép về 0 cho ngày
  không có việc) vì dữ liệu thật không cần giả định đó. Đã đối chiếu
  headcount qua `psql`: `cty-01=28`, `cty-02=12` — khớp đúng acceptance
  criteria của plan.
- Ba màn hình mang tính thời gian nhất (`/admin/dashboard`, `/employee`,
  `/employee/history`) nhận "hôm nay"/"tháng này" qua **prop** từ Server
  Component (`page.tsx` gọi `getServerToday()`/`getServerMonth()`) — không
  client component nào trong ba file này còn đọc `REFERENCE_DATE`/
  `REFERENCE_MONTH` hay tự tính lại bằng đồng hồ thiết bị. Lời chào theo giờ
  ("Chào buổi sáng/trưa/chiều/tối") tách thành `src/hooks/use-current-greeting.ts`
  (tính sau khi mount, không ảnh hưởng hydration) để `new Date()` không còn
  xuất hiện trong ba file view.
- Thêm rule ESLint (`no-restricted-syntax`) cấm `new Date()`/`Date.now()`
  **trong đúng ba file view này** (D-19a) — phạm vi cố ý hẹp để không phá vỡ
  các component khác có đồng hồ thật hợp lệ ngoài phạm vi plan (xem
  Deviations).

## Task Commits

1. **Task 1: "Hôm nay" do server cấp, và đường đọc/ghi chấm công theo giờ server** - `392c9f2` (feat)
2. **Task 2: Bảng điều khiển tính từ dữ liệu thật, bỏ dãy số mẫu cố định** - `47de169` (feat)
3. **Task 3: Ba màn hình nhận "hôm nay" từ Server Component và chuyển sang nguồn dữ liệu thật** - `2ec5f46` (feat)

## Files Created/Modified

- `supabase/migrations/0010_check_in_time_functions.sql` - RPC
  `tf_server_now()`/`tf_local_instant()`, đã push lên live DB
- `src/lib/today.ts` - `getServerToday()`/`getServerMonth()`, nguồn duy nhất
  của "hôm nay" (D-19)
- `src/lib/__tests__/today.test.ts` - 4 test: định dạng, độc lập với
  `process.env.TZ`, biên D-19 (giờ VN đã sang hôm sau, UTC còn hôm nay)
- `src/lib/validation/api/attendance.ts` - `attendanceRecordSchema` (transform
  timestamptz→HH:mm VN), `attendanceQuerySchema`, `attendanceSummaryQuerySchema`,
  `monthlySummarySchema`, xuất `toVnTime()` dùng chung với dashboard
- `src/lib/data/attendance.ts` - `listAttendance`/`getMonthlySummary` qua
  `fetchJson`, re-export `checkIn`/`checkOut`
- `src/lib/data/mutations/attendance.ts` - Server Action `checkIn`/`checkOut`
  ghi giờ server, tính `lateMinutes`/`earlyLeaveMinutes`/`workedMinutes` qua
  RPC thời gian của Phase 1
- `src/app/api/attendance/route.ts`, `src/app/api/attendance/summary/route.ts` -
  `GET`-only, lọc company session, 403 khi hỏi dữ liệu người khác
- `src/lib/validation/api/dashboard.ts` - `dashboardSummarySchema`,
  `dashboardQuerySchema`
- `src/lib/data/dashboard.ts` - `getDashboardSummary` qua `fetchJson`
- `src/app/api/dashboard/route.ts` - tính toàn bộ `DashboardSummary` từ dữ
  liệu thật, xóa hằng số mẫu
- `src/hooks/use-current-greeting.ts` - lời chào theo giờ, tính sau mount
- `src/lib/data/__tests__/attendance.test.ts` - 5 test: chuyển đổi
  timestamptz→HH:mm, null giữ nguyên, edge DATA-05 empty
- `eslint.config.mjs` - rule D-19a phạm vi hẹp (3 file view)
- `src/app/admin/dashboard/page.tsx`, `dashboard-view.tsx` - nhận `today` qua
  prop, đổi import sang `@/lib/data/dashboard`
- `src/app/employee/page.tsx`, `employee-home-view.tsx` - nhận
  `today`/`month` qua prop, đổi import sang `@/lib/data/*`
- `src/app/employee/history/page.tsx`, `history-view.tsx` - nhận `month` qua
  prop, đổi import sang `@/lib/data/*`

## Decisions Made

- **Migration 0010 (RPC `tf_server_now`/`tf_local_instant`) không nằm trong
  `files_modified` gốc.** PostgREST không cho RPC gọi thẳng hàm built-in
  trong `pg_catalog` (như `now()`), nên không có cách nào để tầng ứng dụng
  đọc đồng hồ database mà không có một hàm SQL trung gian trong `public`.
  Đây là Rule 2 tự nhiên, cùng tiền lệ với RPC `tf_employee_code_taken`
  (0009, plan 02-07) và `tf_search_employee_ids` (0008, plan 02-05).
- **`lateMinutes`/`earlyLeaveMinutes` tính trên cặp `timestamptz` thật, không
  phải hai chuỗi "HH:mm".** So với việc chỉ gọi `tf_shift_minutes` trên
  giờ-trong-ngày (đọc đầu tiên có thể nghĩ tới), dùng `tf_worked_minutes`
  trên "giờ kế hoạch (timestamptz) vs dấu thời gian thật" loại bỏ hoàn toàn
  nhu cầu cho ngưỡng chặn "720 phút chống âm quanh nửa đêm" của tầng giả
  lập — timestamptz không bao giờ wrap sai. `tf_shift_minutes` vẫn được
  dùng, nhưng để tính **thời lượng trọn ca** (đã xử lý wrap qua nửa đêm cho
  ca qua đêm D-08 ở chính hàm đó), rồi cộng epoch đơn thuần vào giờ bắt đầu
  kế hoạch ra giờ kết thúc kế hoạch.
- **`checkIn` dùng khuôn "đọc trước, insert-hoặc-update", không dùng
  `.upsert()`.** `.upsert()` của PostgREST đưa MỌI cột trong payload (kể cả
  `id`) vào mệnh đề `DO UPDATE SET`, có nguy cơ ghi đè khóa chính của dòng
  đang có khi trùng ràng buộc `unique(employee_id, work_date, shift_id)`. Đã
  xác nhận rủi ro này là **thật, không phải giả thuyết**: mô phỏng `psql`
  trực tiếp cho thấy dữ liệu seed đã có sẵn một dòng `att-01a` cho
  `(nv-01a, hôm nay, sft-01-day)`.
- **D-19a (rule ESLint) áp dụng phạm vi hẹp, chỉ ba file view của plan
  này.** `src/components/employee-app/attendance-status-card.tsx` (ngoài
  `files_modified`) có một đồng hồ tick-mỗi-giây **hợp lệ**, khởi tạo SAU
  khi mount qua `useEffect` — không gây lệch hydration. Một rule toàn repo
  sẽ phá vỡ pattern hợp lệ này và kéo file ngoài phạm vi vào plan. Ghi lại
  là một khoảng trống D-19a còn lại (xem Next Phase Readiness).
- **Bỏ "hack Chủ Nhật" của biểu đồ 7 ngày.** Tầng giả lập ép
  `present/late/absent = 0` vào Chủ Nhật để dãy số mẫu trông hợp lý; với dữ
  liệu thật, mỗi ngày (kể cả Chủ Nhật) chỉ cần đếm đúng `attendance_records`
  của chính ngày đó — không cần giả định đặc biệt nào cho ngày cuối tuần.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Thêm migration RPC `tf_server_now`/`tf_local_instant` (không nằm trong `files_modified` gốc của plan)**
- **Found during:** Task 1, bước (e) viết `checkIn`/`checkOut`
- **Issue:** Plan yêu cầu `check_in_at`/`work_date` do "dấu thời gian của
  database (`now()`)" cấp, nhưng PostgREST không cho phép RPC gọi thẳng hàm
  built-in `now()` trong `pg_catalog`, và cũng không có cách ghép
  `work_date + shift.start_time` (VN local) thành một `timestamptz` mà
  không viết offset thủ công ở tầng ứng dụng — đúng điều `<prohibitions>`
  của plan cấm.
- **Fix:** Thêm migration `0010_check_in_time_functions.sql` với hai RPC
  scalar `tf_server_now()` và `tf_local_instant(date, time)`, cả hai
  `security invoker` (không bypass RLS).
- **Files modified:** `supabase/migrations/0010_check_in_time_functions.sql`,
  `src/lib/data/mutations/attendance.ts`
- **Verification:** `npm run db:push` thành công; `psql` xác nhận cả ca
  hành chính (08:00-17:30) lẫn ca qua đêm (22:00-06:00, khớp D-08) tính đúng
  giờ bắt đầu/kết thúc kế hoạch.
- **Committed in:** `392c9f2` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Rule ESLint D-19a (phạm vi ba file view) — không có trong `files_modified`/task list gốc của plan**
- **Found during:** Task 3, khi soát acceptance criteria yêu cầu `grep`
  `new Date()`/`Date.now()` = 0 trên ba file view
- **Issue:** Orchestrator note liệt kê "D-19 / D-19a" là quyết định LOCKED
  mà plan này sở hữu, nhưng bản thân PLAN.md không có task nào tường minh
  thêm rule ESLint (D-19a yêu cầu "quy ước này phải cưỡng chế được... thêm
  rule ESLint cấm `new Date()` và `Date.now()` trong client component").
- **Fix:** Thêm một mục cấu hình ESLint mới (`no-restricted-syntax`) **phạm
  vi hẹp** — chỉ áp dụng cho đúng ba file view mà plan này chuyển sang dữ
  liệu thật (`dashboard-view.tsx`, `employee-home-view.tsx`,
  `history-view.tsx`), không phải một rule toàn repo. Đồng thời tách lời
  chào theo giờ ra `src/hooks/use-current-greeting.ts` để loại bỏ
  `new Date()` khỏi hai file trong số đó.
- **Files modified:** `eslint.config.mjs`, `src/hooks/use-current-greeting.ts`
- **Verification:** `npm run lint` thoát 0 (rule không trip trên các file
  khác, kể cả `attendance-status-card.tsx` có đồng hồ tick thật hợp lệ nằm
  ngoài phạm vi rule).
- **Committed in:** `2ec5f46` (Task 3 commit)

**3. [Rule 1 - Bug trong giả định của plan] Comment trong `route.ts` vô tình chứa đúng tên hai hằng số bị cấm**
- **Found during:** Task 2, chạy acceptance criteria grep
  `CHART_PRESENT_OFFSET|CHART_LATE_VALUES`
- **Issue:** Docstring giải thích "đã xóa hai hằng số X, Y" nhưng viết literal
  tên hai hằng số đó, khiến grep mù chữ (không phân biệt code vs comment)
  đếm được 1 dòng khớp trong `src/app/api/dashboard/route.ts`.
- **Fix:** Viết lại comment không nhắc tên hằng số literal.
- **Files modified:** `src/app/api/dashboard/route.ts`
- **Verification:** `grep -rc "CHART_PRESENT_OFFSET|CHART_LATE_VALUES" src/lib/data/ src/app/api/` trả về `0` trên mọi file.
- **Committed in:** `47de169` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 missing critical — RPC thời gian server, rule ESLint D-19a phạm vi hẹp; 1 bug nhỏ trong comment vi phạm chính acceptance criteria nó mô tả)
**Impact on plan:** Cả ba đều cần thiết để giữ đúng mục tiêu D-19 (một nguồn "hôm nay", không quy ước mù giờ thứ hai) và T-02-08-06 (không dãy số mẫu). Không mở rộng phạm vi ra ngoài ba màn hình/ba đường dữ liệu mà plan yêu cầu.

## Issues Encountered

- **Không thể xác minh các acceptance criteria dựa trên curl + cookie phiên
  thật hoặc mở trình duyệt thật.** Giống 02-04..02-07, nhiều acceptance
  criteria đòi hỏi đăng nhập thật (curl với cookie owner Ngọc Phát/Bình
  Minh, mở `/admin/dashboard`/`/employee` trong trình duyệt và đọc DevTools
  Console) — mật khẩu tạm của 10 tài khoản seed không còn lưu được trong
  môi trường này. Đã bù bằng ba cách, mạnh hơn các plan trước:
  1. **Đối chiếu `getServerToday()` với `public.tf_work_date(now())` qua
     `psql`** — hai giá trị bằng nhau (`"2026-08-01"`), thỏa đúng acceptance
     criteria mà không cần một phiên nào.
  2. **Mô phỏng toàn bộ chuỗi tính toán của `checkIn`/`checkOut` bằng `psql`
     begin/rollback trên dữ liệu THẬT** (nhân viên `nv-01a`, ca `sft-01-day`)
     thay vì chỉ test các hàm SQL đơn lẻ — phát hiện được một lỗi thiết kế
     tiềm ẩn thật sự (upsert sẽ vi phạm unique constraint vì `att-01a` đã
     tồn tại cho hôm nay) trước khi nó có thể xảy ra trên môi trường thật.
  3. **Đối chiếu headcount qua `psql`** (`cty-01=28`, `cty-02=12`) khớp đúng
     số acceptance criteria của plan mong đợi cho `totalEmployees.value`.
  Ghi lại trong `coverage:` frontmatter với `human_judgment: true` (D2-D5)
  cho các phần còn lại cần một phiên đăng nhập thật hoặc trình duyệt thật.
- `gsd-tools windows append` được biết là lỗi CRLF có sẵn trong
  `.planning/WINDOWS.md` (ghi nhận từ 02-05/02-06/02-07) — không thử ghi lại
  ở đây; các mục "chưa xác minh qua phiên thật" đã được ghi đầy đủ trong
  `coverage:` frontmatter ở trên.

## User Setup Required

None - không có cấu hình dịch vụ ngoài nào cần thêm (migration 0010 đã được
push bằng `npm run db:push` trong lúc thực thi).

## Next Phase Readiness

- Khuôn "Route Handler đọc + Server Action ghi + audit" tiếp tục nhân rộng
  thành công lên nhóm dữ liệu có quy tắc thời gian khó nhất của cả phase
  (D-19, D-08) — không phát hiện điểm nào trong khuôn không nhân rộng được.
- **D-19a còn một khoảng trống có chủ đích:** rule ESLint mới chỉ phủ đúng
  ba file view của plan này. Nếu một plan sau muốn mở rộng D-19a ra toàn bộ
  client component trong repo, cần khảo sát trước các component có đồng hồ
  THẬT hợp lệ (post-mount, không ảnh hưởng hydration) — ít nhất
  `attendance-status-card.tsx` — để không biến rule thành một false
  positive hàng loạt.
- `src/lib/constants.ts` vẫn còn giữ `REFERENCE_DATE`/`REFERENCE_MONTH` —
  plan này chỉ gỡ chúng khỏi ba file đầu tiên (dashboard, trang chủ nhân
  viên, lịch sử chấm công) theo đúng phạm vi đã định; các file còn lại
  (`request-form-sheet.tsx`, `employee-form.tsx`, `session-provider.tsx`,
  `mock/db.ts`, `mock/seed.ts`, `mock/service.ts`) là việc của plan dọn dẹp
  cuối phase.
- Mẫu "đọc trước, insert-hoặc-update thay vì upsert khi cột `id` không nằm
  trong ràng buộc unique" là tiền lệ đáng lưu ý cho bất kỳ bảng nào khác có
  hình dạng tương tự (khóa chính độc lập + ràng buộc `unique` trên tổ hợp
  cột khác).
- **Chặn trước plan sau:** các acceptance criteria đòi hỏi phiên đăng nhập
  thật/trình duyệt thật vẫn còn treo cho cả 02-04..02-08. Người dùng nên
  chạy `npm run reset:passwords` rồi xác nhận thủ công ít nhất: (1) mở
  `/admin/dashboard` và `/employee`, xác nhận DevTools Console không có
  cảnh báo hydration mismatch; (2) chấm công vào/ra một lần thật, đối chiếu
  `audit_log` tăng đúng 1 dòng mỗi lần qua `psql`; (3) `curl` với cookie
  nhân viên thường hỏi `employeeId` của người khác, xác nhận mã `403`.

## Self-Check: PASSED

All 13 created files confirmed present on disk; all 3 task commit hashes
(`392c9f2`, `47de169`, `2ec5f46`) confirmed present in `git log`.

---
*Phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi*
*Completed: 2026-08-01*
