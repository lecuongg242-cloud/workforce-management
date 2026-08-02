---
phase: 03-ch-m-c-ng-c-b-ng-ch-ng
plan: 04
subsystem: attendance-evidence
tags: [server-actions, postgres, rls, zod, vitest, react, next-server-actions]

requires:
  - phase: 03-ch-m-c-ng-c-b-ng-ch-ng (03-01, 03-03)
    provides: "checkIn() nhan PunchEvidence + tinh khoang cach qua tf_distance_meters(), Camera Sheet day du nhanh loi camera/vi tri, ATTENDANCE_REJECTION_LABEL/ATTENDANCE_EVIDENCE_LABEL, phan loai loi qua kiem hinh dang tam thoi (classifyRejection)"
provides:
  - "AttendanceRejectedError/isAttendanceRejection (src/lib/attendance/rejection.ts) — lop loi chinh thuc mang phan loai D-20b, dung chung Server Action + giao dien"
  - "checkOut() mang bang chung day du: anh + toa do rieng cho lan tan ca, ghi dong attendance_photos thu hai kind=check_out"
  - "checkIn/checkOut chu ky cuoi cung sau ATT-06: khong con tham so ngay/gio nao, moi dau thoi gian tu tf_server_now()"
  - "Hai ly do tu choi server tu quyet duoc: missing_photo (thieu bang chung) va outside_shift (ngoai khung gio ca + bien do SHIFT_WINDOW_GRACE_MINUTES=120)"
  - "Nut Tan ca di qua CUNG Camera Sheet voi nut Vao ca (mot Sheet, hai che do qua state pendingCheckOutRecordId)"
affects: [03-06, 03-07]

actuals:
  tokens: 19462
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Ham dung chung writePunchEvidence() (tach tu code trung lap checkIn cua 03-01) — do khoang cach + tai anh + ghi/cap nhat attendance_photos + audit, dung cho ca checkIn(kind=check_in) va checkOut(kind=check_out), moi lan goi do lai DOC LAP khong chep gia tri tu lan truoc"
    - "addMinutesToInstant() — mot ham epoch-add DUY NHAT dung chung cho ca tinh gio ket thuc ca (checkOut, tinh ve som) lan noi bien do khung gio ca (checkIn, kiem ngoai ca), giu dung MOT dong new Date( trong toan file mutations/attendance.ts"
    - "isAttendanceRejection() kiem THEO HINH DANG (chi truong reason, KHONG doi hoi name) — name la mot custom property khac co the mat qua ranh gioi Server Action giong moi truong tuy bien khac, chi message la chac chan"
    - "evidence optional O MUC KIEU (bat buoc o hanh vi) cho CA checkIn LAN checkOut — tiep tuc dung decision cua 03-01 de tung task giua chung compile duoc doc lap"
    - "Test tich hop tren Postgres dev THAT ep moi truong ve node (@vitest-environment node) khi can Storage.upload() that — Blob toan cuc cua jsdom (moi truong mac dinh du an) khong tuong thich voi than request cua undici/fetch, gay 'fetch failed'/ECONNRESET sau ~15s"

key-files:
  created:
    - src/lib/attendance/rejection.ts
    - src/lib/data/__tests__/attendance-evidence.test.ts
  modified:
    - src/lib/data/mutations/attendance.ts
    - src/lib/data/attendance.ts
    - src/app/employee/employee-home-view.tsx
    - src/components/employee-app/camera-sheet.tsx
    - src/components/employee-app/attendance-status-card.tsx
    - src/components/employee-app/__tests__/camera-sheet.test.tsx
    - src/lib/constants.ts
    - vitest.config.mts
  deleted:
    - src/lib/data/mutations/attendance-errors.ts

key-decisions:
  - "SHIFT_WINDOW_GRACE_MINUTES = 120 phut (hai gio) moi dau khung gio ca — gia tri o muc Claude's Discretion (CONTEXT.md khong chi dinh so), chon du rong de khong chan nham nguoi den chuan bi som/nan lai xu ly viec cuoi ca"
  - "checkOut cho ban ghi CHUA co gio vao tai su dung phan loai outside_shift (khong bia them ly do thu tu, dung theo D-20b)"
  - "[Rule 3 - Blocking] evidence optional O MUC KIEU cho checkOut (nhu checkIn cua 03-01) — call site cu (employee-home-view.tsx) truyen sai kieu (string thay vi PunchEvidence) ngay khi chu ky checkOut doi o Task 2; patch toi thieu (bo tham so time bi xoa) de typecheck xanh ngay sau Task 2 ma khong phai noi day Camera Sheet vao duong tan ca truoc thoi han (viec do la cua Task 3)"
  - "[Rule 1] Bo dieu kien name === 'AttendanceRejectedError' khoi isAttendanceRejection() — mot phien ban dau cua ham nay yeu cau ca name lan reason, vo tinh tu choi dung chinh hinh dang loi thuc te qua ranh gioi Server Action (chi message chac chan con); phat hien qua 2 test co san cua camera-sheet.test.tsx (03-03) mo phong dung hinh dang {message, reason} khong co name"
  - "[Rule 3 - Blocking] Test tich hop moi ep moi truong ve node (@vitest-environment node) va vitest.config.mts them testTimeout 20s — Blob cua jsdom (moi truong mac dinh) khong tai len duoc that qua Storage that trong test tich hop, va nhieu vong RPC/Storage qua mang that vuot testTimeout mac dinh 5s cua vitest"
  - "Xoa src/lib/data/mutations/attendance-errors.ts (03-01) — AttendanceEvidenceError khong con noi nao dung sau khi checkIn doi sang AttendanceRejectedError, giu lai la ma chet gay nham lan voi lop loi chinh thuc moi"

requirements-completed: [ATT-01, ATT-02, ATT-06, ATT-08]

coverage:
  - id: D1
    description: "AttendanceRejectedError/isAttendanceRejection (rejection.ts) — lop loi mang phan loai D-20b dung chung Server Action + giao dien, ve si kieu theo hinh dang khong dung instanceof"
    requirement: ATT-08
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/attendance-evidence.test.ts test 1 (npx vitest run)"
        status: pass
      - kind: other
        ref: "grep -oE distinct reason strings; npm run typecheck && npm run lint"
        status: pass
    human_judgment: false
  - id: D2
    description: "checkIn/checkOut nem AttendanceRejectedError(missing_photo) khi thieu bang chung, va AttendanceRejectedError(outside_shift) khi ngoai khung gio ca (checkIn) hoac chua co gio vao (checkOut) — khoang cach khong bao gio la ly do tu choi"
    requirement: ATT-08
    verification:
      - kind: integration
        ref: "src/lib/data/__tests__/attendance-evidence.test.ts test 2, 3, 5, 6, 11, 15 (Postgres dev that, npx vitest run)"
        status: pass
      - kind: other
        ref: "grep -cE distance_?[Mm]eters *[<>] attendance.ts == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "checkOut(recordId, evidence) ghi dong attendance_photos thu hai kind=check_out, do khoang cach DOC LAP (khong chep tu lan vao); mot ca day du co dung hai dong attendance_photos va hai dong audit_log moi"
    requirement: ATT-02
    verification:
      - kind: integration
        ref: "src/lib/data/__tests__/attendance-evidence.test.ts test 4, 7, 8, 9, 10 (Postgres dev that)"
        status: pass
    human_judgment: false
  - id: D4
    description: "checkIn/checkOut khong con tham so ngay/gio nao trong chu ky (ATT-06) — moi dau thoi gian tu tf_server_now() cua chinh lan goi"
    requirement: ATT-06
    verification:
      - kind: other
        ref: "grep -icE date|time trong chu ky ham == 0; npm run typecheck && npm run build"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nut Tan ca mo Camera Sheet (khong con gui thang voi gio dong ho client); ca hai nut deu qua camera, D-19a mien tru giu nguyen"
    requirement: ATT-01
    verification:
      - kind: unit
        ref: "npx vitest run (179 test, bao gom camera-sheet.test.tsx); grep -cE onCheckOut\\(clock\\) attendance-status-card.tsx == 0"
        status: pass
      - kind: other
        ref: "npm run build (thoat 0)"
        status: pass
    human_judgment: true
    rationale: "Chua co thiet bi that voi camera/GPS trong moi truong thuc thi nay de lai duong tan ca that qua giao dien va xac nhan gio ghi khong doi khi lech dong ho thiet bi — deferred sang human_verify_mode: end-of-phase cua du an, cung tien le voi 03-01-SUMMARY.md/03-03-SUMMARY.md."
  - id: D6
    description: "Doi dong ho thiet bi khong doi duoc gio da ghi (ATT-06) — bai kiem truc tiep tren thiet bi that"
    verification: []
    human_judgment: true
    rationale: "Can trinh duyet that tren thiet bi that de doi dong ho he thong va quan sat gio ghi qua giao dien — moi truong thuc thi nay khong co thiet bi vat ly; deferred sang UAT cuoi phase (human_verify_mode: end-of-phase)."

duration: ~50min
completed: 2026-08-02
status: complete
---

# Phase 3 Plan 4: Tan ca mang bằng chứng, chữ ký chấm công sạch mọi tham số thời gian Summary

**`checkOut` lên cùng mức bằng chứng với `checkIn` (ảnh + toạ độ riêng, đo độc lập), chữ ký cả hai hàm sạch hoàn toàn tham số ngày/giờ (ATT-06), và `AttendanceRejectedError` chính thức hoá hai lý do từ chối mà server thật sự quyết được — 15 test tích hợp mới chạy trên Postgres dev thật.**

## Performance

- **Duration:** ~50 phút (ước lượng)
- **Started:** 2026-08-02T19:35:00Z (ước lượng)
- **Completed:** 2026-08-02T20:20:14Z
- **Tasks:** 3/3
- **Files modified:** 10 (2 tạo mới, 8 sửa, 1 xoá)

## Accomplishments

- `src/lib/attendance/rejection.ts` (mới): `AttendanceRejectedError` mang trường `reason` chỉ đọc, `isAttendanceRejection()` kiểm theo hình dạng — thay thế hoàn toàn `AttendanceEvidenceError` (03-01) và `classifyRejection`/`isRejectionReason` tự viết lại (03-03)
- `checkIn` từ chối `outside_shift` khi chấm công ngoài khung giờ ca được phân (cộng biên độ `SHIFT_WINDOW_GRACE_MINUTES=120` hai đầu, tôn trọng quy ước ca qua đêm D-08 qua các hàm thời gian có sẵn); `checkOut` từ chối `outside_shift` cho một bản ghi chưa có giờ vào
- `checkOut(recordId, evidence)` ghi dòng `attendance_photos` thứ hai (`kind='check_out'`) qua hàm dùng chung `writePunchEvidence()` (tách từ code trùng lặp của `checkIn`) — đo khoảng cách **độc lập**, không chép giá trị của lần vào
- Chữ ký `checkIn(employeeId, evidence)`/`checkOut(recordId, evidence)` — không còn tham số ngày/giờ nào (ATT-06 hoàn tất)
- "Tan ca" đi qua cùng Camera Sheet với "Vào ca" (một Sheet, phân biệt bằng state `pendingCheckOutRecordId`); `employee-home-view.tsx` bắt lỗi bằng `isAttendanceRejection()` để log lỗi hạ tầng thật (không toast trùng, không so khớp chuỗi)
- 15 test tích hợp mới (`attendance-evidence.test.ts`) chạy trên Postgres dev thật — bao gồm hai lý do từ chối, vòng đời check-in→check-out đầy đủ, đếm dòng `attendance_photos`/`audit_log`, độc lập khoảng cách, xuyên doanh nghiệp, phân quyền employee/manager

## Task Commits

1. **Task 1: Lỗi từ chối mang phân loại, và hai lý do mà server thật sự quyết được** - `6187b6a` (feat)
2. **Task 2: Tan ca mang bằng chứng, và chữ ký chấm công sạch mọi tham số thời gian** - `53a9299` (feat)
3. **Task 3: Nút "Tan ca" đi qua Camera Sheet, và lý do từ chối hiển thị đúng khối** - `865cae3` (feat)

_Cả ba task đều `tdd="true"`/hành vi-trước theo đúng cách 03-01/03-03 đã làm: viết `<behavior>` trước rồi code thoả hành vi đó, commit atomic theo task — không tách RED/GREEN riêng vì hành vi phân tán trên các nhánh liên quan chặt trong cùng module._

## Files Created/Modified

- `src/lib/attendance/rejection.ts` (mới) - `AttendanceRejectedError`/`isAttendanceRejection()`
- `src/lib/data/mutations/attendance.ts` - `checkOut` mang bằng chứng, `writePunchEvidence()` dùng chung, `addMinutesToInstant()`, `SHIFT_WINDOW_GRACE_MINUTES`, chữ ký sạch thời gian, `CheckOutResult`
- `src/lib/data/attendance.ts` - comment cập nhật chữ ký cuối cùng
- `src/lib/data/mutations/attendance-errors.ts` (xoá) - `AttendanceEvidenceError` không còn nơi nào dùng
- `src/app/employee/employee-home-view.tsx` - `handleOpenCheckOut`/`handleCameraOpenChange`, `handlePunchSubmit` dùng chung cho cả hai loại, bắt lỗi bằng `isAttendanceRejection`
- `src/components/employee-app/camera-sheet.tsx` - prop `punchKind`, `classifyRejection` gọi thẳng `isAttendanceRejection()`
- `src/components/employee-app/attendance-status-card.tsx` - `onCheckOut` không còn tham số
- `src/components/employee-app/__tests__/camera-sheet.test.tsx` - thêm prop `punchKind="check_in"` cho các lần render đã có
- `src/lib/constants.ts` - `sheetTitleCheckIn`/`sheetTitleCheckOut`
- `src/lib/data/__tests__/attendance-evidence.test.ts` (mới) - 15 test tích hợp
- `vitest.config.mts` - `testTimeout: 20000`

## Decisions Made

Xem `key-decisions` ở frontmatter. Quan trọng nhất:

1. **`SHIFT_WINDOW_GRACE_MINUTES = 120`** — không có số cụ thể trong CONTEXT.md (thuộc "Claude's Discretion"), chọn đủ rộng để không chặn nhầm người đến sớm/nán lại theo đúng tinh thần "một hệ thống từ chối người đến sớm mười phút là một hệ thống người ta sẽ tìm cách đi vòng".
2. **`checkOut` cho bản ghi chưa có giờ vào tái dùng phân loại `outside_shift`** thay vì bịa lý do thứ tư — D-20b khoá đúng ba lý do.
3. **`evidence` optional Ở MỨC KIỂU cho `checkOut`** (Rule 3 — blocking), tiếp tục đúng quyết định của 03-01 cho `checkIn`: giữ `employee-home-view.tsx` compile được ngay sau Task 2 mà không phải nối Camera Sheet vào đường tan ca trước thời hạn.
4. **Bỏ điều kiện `name` khỏi `isAttendanceRejection()`** (Rule 1) — phiên bản đầu vô tình từ chối đúng hình dạng lỗi thực tế qua ranh giới Server Action (chỉ `message` chắc chắn còn, `name` có thể mất như mọi trường tuỳ biến khác).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `isAttendanceRejection()` ban đầu đòi cả `name` lẫn `reason`, vô tình từ chối đúng hình dạng lỗi Server Action thật**
- **Found during:** Task 3, khi chạy `npx vitest run` toàn bộ và thấy 2 test có sẵn của `camera-sheet.test.tsx` (03-03, mô phỏng lỗi dạng `{ message, reason }` không có `name`) đỏ
- **Issue:** Comment của `rejection.ts` (Task 1) đã tự ghi đúng lý do (chỉ `message` chắc chắn qua được ranh giới Server Action) nhưng code lại vẫn kiểm `name === "AttendanceRejectedError"` — mâu thuẫn với chính lý do nó nêu ra
- **Fix:** Bỏ điều kiện `name`, chỉ còn kiểm `reason` hợp lệ
- **Files modified:** src/lib/attendance/rejection.ts
- **Verification:** `npx vitest run` — toàn bộ 179 test xanh
- **Committed in:** 865cae3 (Task 3 commit)

**2. [Rule 1 - Hygiene] Xoá `attendance-errors.ts` (03-01) đã thành mã chết**
- **Found during:** Task 1, sau khi `checkIn` đổi từ `AttendanceEvidenceError` sang `AttendanceRejectedError`
- **Issue:** `AttendanceEvidenceError` không còn nơi nào import — để lại là một lớp lỗi song song gây nhầm lẫn với `AttendanceRejectedError` mới, đúng loại rủi ro mà prohibition "không thêm lý do từ chối thứ tư" của plan này cảnh báo (hai lớp lỗi tồn tại song song dễ khiến người viết mã sau ném nhầm lớp cũ)
- **Fix:** Xoá file
- **Files modified:** src/lib/data/mutations/attendance-errors.ts (xoá)
- **Verification:** `npm run typecheck && npm run build` thoát 0
- **Committed in:** 6187b6a (Task 1 commit)

**3. [Rule 3 - Blocking] Call site cũ của `checkOutService` không compile sau khi Task 2 đổi chữ ký `checkOut`**
- **Found during:** Task 2, `npm run typecheck` báo lỗi kiểu tại `employee-home-view.tsx` (file KHÔNG nằm trong `<files>` của Task 2)
- **Issue:** `checkOutService(displayRecord.id, time)` truyền `time: string` đúng vị trí tham số thứ hai, nay đổi kiểu thành `PunchEvidence` — không có cách nào tránh sửa call site này mà vẫn giữ `npm run typecheck` xanh cho riêng Task 2
- **Fix:** Bỏ tham số `time` khỏi lời gọi (`checkOutService(displayRecord.id)`), giữ `evidence` optional ở mức kiểu (như `checkIn` của 03-01) — hành vi tan ca thật (qua Camera Sheet) chờ Task 3 nối dây
- **Files modified:** src/app/employee/employee-home-view.tsx
- **Verification:** `npm run typecheck && npm run lint` thoát 0 ngay sau Task 2
- **Committed in:** 53a9299 (Task 2 commit)

**4. [Rule 3 - Blocking] Test tích hợp mới không tải ảnh lên Storage thật được trong môi trường jsdom mặc định**
- **Found during:** Task 2, khi viết `attendance-evidence.test.ts` và thấy `checkIn`/`checkOut` ném "Không thể tải ảnh chấm công lên máy chủ." dù dữ liệu hợp lệ
- **Issue:** Debug xác nhận `Blob` toàn cục của môi trường `jsdom` (mặc định của dự án, `vitest.config.mts`) không tương thích với thân request mà `undici`/`fetch` bên trong `@supabase/storage-js` dựng khi tải file lên THẬT — nem `StorageUnknownError: fetch failed` (nguyên nhân gốc `ECONNRESET`) sau khoảng 15 giây; cùng byte tải lên thành công ngay lập tức khi chạy plain Node hoặc khi ép môi trường Node cho test
- **Fix:** Thêm chỉ thị `// @vitest-environment node` ở đầu file test — `Blob` toàn cục khi đó là `Blob` thật của Node, dùng nhất quán cho cả `punchEvidenceSchema.instanceof(Blob)` (phía kiểm hợp lệ) lẫn `storage.upload()` (phía tải lên thật)
- **Files modified:** src/lib/data/__tests__/attendance-evidence.test.ts
- **Verification:** `npx vitest run src/lib/data/__tests__/attendance-evidence.test.ts` — 15/15 xanh
- **Committed in:** 53a9299 (Task 2 commit)

**5. [Rule 3 - Blocking] `testTimeout` mặc định 5s của vitest không đủ cho test tích hợp nhiều vòng RPC/Storage qua mạng thật**
- **Found during:** Task 2, các test gọi `checkIn`/`checkOut` thật (>10 vòng round-trip RPC + một lần upload Storage mỗi lần gọi) timeout ở 5000ms
- **Fix:** `vitest.config.mts` thêm `testTimeout: 20000` — chỉ nới trần, không ảnh hưởng tốc độ các test thuần mock khác
- **Files modified:** vitest.config.mts
- **Verification:** `npx vitest run src/lib/data/__tests__/attendance-evidence.test.ts` xanh trong ~48s cho 15 test
- **Committed in:** 53a9299 (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (2 Rule 1 — bug/hygiene, 3 Rule 3 — blocking do call site/hạ tầng test)
**Impact on plan:** Deviation #3 mở rộng ngoài `<files>` gốc của Task 2 (call site không nằm trong danh sách) nhưng là điều kiện BẮT BUỘC để `npm run typecheck` xanh cho chính Task 2 — không có cách nào khác tránh sửa file đó. Bốn deviation còn lại đều là sửa lỗi/hạ tầng cần thiết cho tính đúng đắn hoặc khả năng chạy test, không mở rộng phạm vi nghiệp vụ ngoài ý định của plan.

## Issues Encountered

- **Ca hành chính có sẵn (08:00-17:30) không nằm trong cửa sổ hợp lệ khi test chạy buổi tối**: `sft-01-day` (ca hành chính, dùng ở dữ liệu seed) không nằm trong `SHIFT_WINDOW_GRACE_MINUTES=120` phút quanh giờ thực tế chạy test tích hợp (19:58 giờ VN). Test tích hợp phải dựng một ca test riêng "chứa hiện tại" (± 30 phút quanh giờ-phút thực khi `beforeAll` chạy, tính bằng RPC `tf_server_now()`) cho mọi kịch bản kỳ vọng THÀNH CÔNG, thay vì dùng thẳng ca hành chính có sẵn — bài học ghi lại để `03-06`/các plan sau không giả định `sft-01-day` luôn nằm trong cửa sổ hợp lệ khi viết test tích hợp mới.
- **`grep -oE ... | sort -u | wc -l` của chính acceptance criteria Task 1** (`đúng ba phân loại, không hơn`) trả về `8` thay vì `3` khi chạy trên nhiều file cùng lúc — `grep` tự thêm tiền tố tên file khi có hơn một đường dẫn, khiến `sort -u` không gộp được các dòng cùng nội dung khác file. Chạy lại với `-h` (ẩn tên file) cho đúng `3` — xác nhận ý định thật của tiêu chí (đúng ba phân loại tồn tại, không có lý do thứ tư) đã được đáp ứng; đây là lỗi soạn acceptance criteria (thiếu `-h`), không phải lỗi hiện thực.

## User Setup Required

None - không có cấu hình dịch vụ ngoài nào mới.

## Next Phase Readiness

**Sẵn sàng:** Cả hai đầu của một ca làm việc đều mang bằng chứng đo tại chỗ (ảnh + toạ độ + khoảng cách riêng), không còn một đường nào cho giá trị thời gian của thiết bị chạm vào bản ghi chấm công. `AttendanceRejectedError`/`isAttendanceRejection()` là nguồn phân loại lỗi tu chối chính thức duy nhất — `03-06` (danh sách "cần xem lại" của quản trị) và các plan sau có thể dùng lại thay vì tự viết logic kiểm hình dạng lần nữa.

**Còn chờ (deferred sang UAT cuối phase, đúng `human_verify_mode: "end-of-phase"` của dự án, cùng tiền lệ với 03-01-SUMMARY.md/03-03-SUMMARY.md):**
- Bấm "Tan ca" trên thiết bị thật: mở camera, chụp, gửi — bản ghi có giờ ra và ảnh loại ra.
- Đổi đồng hồ thiết bị lệch 3 giờ rồi chấm công: giờ ghi trên bản ghi vẫn đúng giờ thật (bài kiểm trực tiếp của ATT-06).
- Tạm sửa ca của một nhân viên thử nghiệm sang khung giờ không chứa thời điểm hiện tại rồi chấm công: màn hình hiện đúng khối "Ngoài giờ ca làm".

Ba mục này không chặn plan tiếp theo (logic đã chứng minh qua 15 test tích hợp mới trên Postgres dev thật cộng 164 test có sẵn, tổng 179 test + build/typecheck/lint xanh), nhưng cần một phiên UAT có thiết bị thật trước khi đóng phase 3.

---
*Phase: 03-ch-m-c-ng-c-b-ng-ch-ng*
*Completed: 2026-08-02*

## Self-Check: PASSED

All created files verified present on disk (`src/lib/attendance/rejection.ts`,
`src/lib/data/__tests__/attendance-evidence.test.ts`), deleted file confirmed
absent (`src/lib/data/mutations/attendance-errors.ts`), and all 3 task commits
(`6187b6a`, `53a9299`, `865cae3`) verified present in `git log`.
