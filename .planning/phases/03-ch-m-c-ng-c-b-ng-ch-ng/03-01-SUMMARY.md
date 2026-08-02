---
phase: 03-ch-m-c-ng-c-b-ng-ch-ng
plan: 01
subsystem: attendance-evidence
tags: [supabase-storage, getUserMedia, geolocation, postgres, pgtap, nextjs-server-actions, route-handler, rls]

requires:
  - phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
    provides: "checkIn/checkOut Server Actions, tf_server_now()/tf_local_instant() RPC, getSessionContext()/requireRole() auth gate, audit_log logMutation()"
provides:
  - "Migration 0011: accuracy_meters/work_site_id/distance_meters trên attendance_photos + tf_distance_meters() haversine"
  - "Bucket Storage riêng tư attendance-photos, đường dẫn {company_id}/{employee_id}/{photo_id}.jpg (checkpoint option-a)"
  - "Broker Route Handler GET /api/attendance-photos/[id] — kiểm company_id mỗi lần gọi, .download(), không signed URL"
  - "checkIn() mở rộng: nhận PunchEvidence, tự đo khoảng cách qua tf_distance_meters(), không chặn theo khoảng cách (D-20)"
  - "Camera Sheet: viewfinder trực tiếp → chụp → xem lại → gửi, không có input file nào trong cây nhân viên"
  - "AttendancePhotoDialog: quản trị xem ảnh qua broker route, xử lý trường hợp không có ảnh"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07]

actuals:
  tokens: 22288
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Bucket Storage riêng tư + broker Route Handler tự kiểm company_id trên MỖI lần gọi thay vì signed URL (Pitfall 2, RESEARCH.md)"
    - "Đường dẫn Storage {company_id}/{employee_id}/{photo_id}.jpg — checkpoint:decision option-a, khoá D-22/PRIV V3"
    - "Toàn bộ chữ tiếng Việt của một phase gom vào constants.ts ở plan tracer đầu tiên để các plan wave sau chạy song song"
    - "Bốn lớp lỗi camera định nghĩa sẵn ở lib thuần (camera.ts), chỉ một lớp được phân loại/dùng ở UI trong plan tracer"

key-files:
  created:
    - supabase/migrations/0011_attendance_evidence.sql
    - supabase/tests/09_attendance_evidence.sql
    - scripts/storage-bucket.mjs
    - src/lib/storage/attendance-photos.ts
    - src/lib/validation/api/attendance-photos.ts
    - src/app/api/attendance-photos/[id]/route.ts
    - src/app/api/attendance-photos/[id]/__tests__/route.test.ts
    - src/lib/attendance/camera.ts
    - src/components/employee-app/camera-sheet.tsx
    - src/components/attendance/attendance-photo-dialog.tsx
    - src/lib/data/attendance-photos.ts
    - src/lib/data/mutations/attendance-errors.ts
  modified:
    - supabase/tests/run-all.sql
    - scripts/check-pgtap-assertions.mjs
    - next.config.ts
    - package.json
    - src/lib/constants.ts
    - src/lib/types/domain.ts
    - src/lib/data/mutations/attendance.ts
    - vitest.config.mts
    - src/app/employee/employee-home-view.tsx
    - src/components/employee-app/attendance-status-card.tsx
    - src/app/admin/employees/[id]/employee-detail-view.tsx

key-decisions:
  - "checkpoint:decision — bucket attendance-photos, đường dẫn {company_id}/{employee_id}/{photo_id}.jpg (option-a), chọn bởi chủ dự án: ưu tiên xoá-theo-nhân-viên cho PRIV V3 thay vì xoá-theo-tuổi"
  - "evidence là tham số optional Ở MỨC KIỂU (không phải ở mức hành vi) trong checkIn() — giữ call site 4-tham-số cũ của Task 3 compile được ngay sau Task 2, tránh phải sửa employee-home-view.tsx hai lần trong hai task khác nhau"
  - "AttendanceEvidenceError tách khỏi attendance.ts sang file riêng (attendance-errors.ts) — Next.js chỉ cho export hàm async từ file mang chỉ thị \"use server\""
  - "getAttendancePhotoForRecord (Server Action, không phải Route Handler) bổ sung ngoài <files> của Task 3 — không có đường nào khác trả lời câu hỏi \"bản ghi này có ảnh không\" mà AttendancePhotoDialog cần"
  - "npm run test:db chạy qua escape hatch TF_ALLOW_CLOUD_TESTS=1 nhắm thẳng project Supabase dev thật (Docker không có sẵn trong môi trường thực thi này để dựng Postgres tạm như CI) — 4 dòng fixture pgTAP đã được dọn sạch khỏi auth.users ngay sau khi chạy xong, xác nhận lại bằng db:seed một mình"
  - "vitest.config.mts nạp .env.local qua loadEnv() để test tích hợp route.test.ts (chạy trên Postgres dev thật, không mock DB) có biến môi trường khi gọi npx vitest run trực tiếp, không cần --env-file"

requirements-completed: [ATT-01, ATT-02, ATT-04, ATT-05, ATT-06]

coverage:
  - id: D1
    description: "Migration 0011 thêm accuracy_meters/work_site_id/distance_meters trên attendance_photos và hàm tf_distance_meters() (kẹp acos() để tránh NaN khi khoảng cách ~0)"
    requirement: ATT-02
    verification:
      - kind: unit
        ref: "supabase/tests/09_attendance_evidence.sql (8 assertions, chạy qua npm run test:db)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Broker Route Handler GET /api/attendance-photos/[id] kiểm company_id trên MỖI lần gọi, dùng .download() thay vì signed URL — phiên doanh nghiệp khác cầm đúng URL nhận 404"
    requirement: ATT-05
    verification:
      - kind: integration
        ref: "src/app/api/attendance-photos/[id]/__tests__/route.test.ts (8 test, chạy trên Postgres dev thật)"
        status: pass
      - kind: unit
        ref: "src/__tests__/route-handlers-get-only.test.ts (cổng D-12c)"
        status: pass
    human_judgment: false
  - id: D3
    description: "checkIn() mở rộng nhận PunchEvidence, tự tính khoảng cách qua tf_distance_meters(), ghi captured_at=tf_server_now(), không có nhánh nào chặn theo khoảng cách (D-20), audit_log chỉ lưu đường dẫn/siêu dữ liệu (D-18a)"
    requirement: ATT-02
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run build; grep tf_distance_meters/distance_meters comparisons trong attendance.ts"
        status: pass
    human_judgment: true
    rationale: "Không có test tự động gọi checkIn() thật với evidence qua getSessionContext() thật (đòi hỏi cookie phiên Next.js sống) — hành vi được chứng minh bằng đọc mã + cổng cơ học (grep/build), nhưng một lần chấm công thật qua giao diện với camera/GPS thật của một thiết bị (human_verify_mode: end-of-phase trong config.json) là bước xác nhận cuối cùng chưa chạy được trong môi trường thực thi này."
  - id: D4
    description: "Camera Sheet: viewfinder trực tiếp → chụp → xem lại → gửi, không có input file nào trong cây nhân viên, khối từ chối quyền camera thay hoàn toàn vùng khung hình"
    requirement: ATT-01
    verification:
      - kind: other
        ref: "grep '<input type=file>'/'accept=image' (0 kết quả); npm run build"
        status: pass
    human_judgment: true
    rationale: "getUserMedia()/geolocation cần trình duyệt thật có camera/GPS — môi trường thực thi này không có thiết bị vật lý để lái UI qua trình duyệt; human_verify_mode: end-of-phase của dự án đã đặt bước này vào UAT cuối phase, không phải per-plan."
  - id: D5
    description: "AttendancePhotoDialog: quản trị mở ảnh của một bản ghi qua broker route; bản ghi không có ảnh hiện đúng dòng chữ thay vì ảnh vỡ"
    requirement: ATT-04
    verification:
      - kind: other
        ref: "npm run typecheck && npm run build; grep /api/attendance-photos/ trong attendance-photo-dialog.tsx"
        status: pass
    human_judgment: true
    rationale: "Chưa mở Dialog thật trong trình duyệt để nhìn ảnh hiển thị — cùng lý do D4, deferred sang UAT cuối phase."
  - id: D6
    description: "Sàn assertion pgTAP nâng từ 170 lên 199 (đo thật), không hạ"
    verification:
      - kind: unit
        ref: "npm run check:assertions"
        status: pass
    human_judgment: false
  - id: D7
    description: "checkpoint:decision (bucket/đường dẫn Storage) được xác nhận bởi chủ dự án trước khi Task 2 chạy"
    verification:
      - kind: manual_procedural
        ref: "Checkpoint resolved: option-a"
        status: pass
    human_judgment: false

duration: 67min
completed: 2026-08-02
status: complete
---

# Phase 3 Plan 1: Lát cắt bằng chứng cham công — camera trực tiếp, GPS, Storage riêng tư, broker route Summary

**Camera trực tiếp + GPS → Server Action tự đo khoảng cách qua `tf_distance_meters()` → bucket Storage riêng tư → broker Route Handler tự kiểm `company_id` mỗi lần gọi — toàn bộ hình dạng kiến trúc của phase chạy thật trên đúng một đường "Vào ca".**

## Performance

- **Duration:** 67 min (bao gồm một checkpoint:decision chờ xác nhận của chủ dự án)
- **Started:** 2026-08-02T08:36:00Z (ước lượng, Task 1)
- **Completed:** 2026-08-02T09:43:08Z
- **Tasks:** 3/3
- **Files modified:** 23 (12 tạo mới, 11 sửa)

## Accomplishments

- Migration 0011 đưa `attendance_photos` lên đủ ba cột D-20/D-21/ATT-02/ATT-07 cần và hàm `tf_distance_meters()` haversine (kẹp `acos()` để không trả `NaN` khi khoảng cách ~0 — chính lúc hệ thống hoạt động đúng nhất)
- Bucket Storage riêng tư `attendance-photos`, đường dẫn `{company_id}/{employee_id}/{photo_id}.jpg` (checkpoint:decision option-a) — MIME giới hạn jpeg/png, 4MB, cấu hình phía server
- Broker Route Handler `GET /api/attendance-photos/[id]`: không bao giờ phát hành signed URL, đọc byte ảnh bằng `.download()` và tự đối chiếu `company_id` trên MỖI lần gọi — 8 test tích hợp chạy trên Postgres dev thật xác nhận 200/404/403 đúng chỗ
- `checkIn()` mở rộng nhận bằng chứng (ảnh + toạ độ), tự gọi RPC để đo khoảng cách và chọn điểm làm việc gần nhất, KHÔNG có nhánh nào chặn theo khoảng cách (D-20)
- Camera Sheet toàn màn hình: mở camera → chụp → xem lại → gửi, không có phần tử chọn tệp nào ở bất kỳ đâu trong cây nhân viên (ATT-01), giữ ảnh+GPS trong bộ nhớ để gửi lại khi thất bại (D-23)
- Quản trị mở được ảnh qua `AttendancePhotoDialog` từ bảng lịch sử chấm công, với trạng thái "không có ảnh" xử lý riêng

## Task Commits

1. **Task 1: Nền dữ liệu cho bằng chứng — ba cột thiếu, hàm khoảng cách, và đẩy schema** - `7b11e29` (feat)
2. **Checkpoint:decision — Tên bucket và cấu trúc đường dẫn** - resolved: option-a (không có commit riêng, ghi vào Task 2)
3. **Task 2: Đường ghi và đường đọc phía server** - `8e0097e` (feat)
4. **Task 3: Đường đi của người dùng — camera trực tiếp và quản trị xem ảnh** - `8616b1d` (feat)

_Không có task nào theo TDD RED/GREEN/REFACTOR tách commit — `tdd="true"` của Task 2/3 được thực thi bằng cách viết `<behavior>` trước rồi code thoả hành vi đó trong cùng một commit atomic theo task, khớp cách các plan trước của phase 2 đã làm khi hành vi phân tán trên nhiều file liên quan chặt (route + validation + mutation)._

## Files Created/Modified

- `supabase/migrations/0011_attendance_evidence.sql` - accuracy_meters/work_site_id/distance_meters + tf_distance_meters()
- `supabase/tests/09_attendance_evidence.sql` - 8 assertion pgTAP cho migration 0011
- `supabase/tests/run-all.sql` - thêm `\ir 09_attendance_evidence.sql`
- `scripts/check-pgtap-assertions.mjs` - MIN_ASSERTIONS 170 → 199
- `scripts/storage-bucket.mjs` - tạo/cập nhật bucket Storage riêng tư (npm run db:bucket)
- `src/lib/storage/attendance-photos.ts` - ATTENDANCE_PHOTO_BUCKET, buildAttendancePhotoPath, ALLOWED_PHOTO_MIME_TYPES
- `src/lib/validation/api/attendance-photos.ts` - punchEvidenceSchema/attendancePhotoRowSchema/attendancePhotoSchema
- `src/app/api/attendance-photos/[id]/route.ts` - broker Route Handler GET-only
- `src/app/api/attendance-photos/[id]/__tests__/route.test.ts` - 8 test tích hợp trên Postgres dev thật
- `next.config.ts` - experimental.serverActions.bodySizeLimit "4mb"
- `package.json` - npm script db:bucket
- `src/lib/constants.ts` - toàn bộ chữ tiếng Việt Phase 3 (ATTENDANCE_REJECTION_LABEL, ATTENDANCE_EVIDENCE_LABEL, WORK_SITE_LABEL, ATTENDANCE_REVIEW_LABEL, PHOTO_REVIEW_STATUS_LABEL, ATTENDANCE_PHOTO_DIALOG_LABEL)
- `src/lib/types/domain.ts` - WorkSite/WorkSiteInput/AttendancePhoto/PunchEvidence/PhotoReviewStatus/AttendanceRejectionReason
- `src/lib/data/mutations/attendance.ts` - checkIn() mở rộng: evidence, tf_distance_meters(), ghi attendance_photos
- `src/lib/data/mutations/attendance-errors.ts` - AttendanceEvidenceError (tách khỏi file "use server")
- `vitest.config.mts` - loadEnv() nạp .env.local cho test tích hợp
- `src/lib/attendance/camera.ts` - openCamera/closeCamera/captureFrame/acquireLocation, GPS_TIMEOUT_MS, 4 lớp lỗi camera
- `src/components/employee-app/camera-sheet.tsx` - Sheet toàn màn hình, máy trạng thái 6 bước
- `src/components/attendance/attendance-photo-dialog.tsx` - Dialog xem ảnh của quản trị
- `src/lib/data/attendance-photos.ts` - getAttendancePhotoForRecord (Server Action, [Rule 2])
- `src/app/employee/employee-home-view.tsx` - handleOpenCamera/handlePunchSubmit, mount CameraSheet
- `src/components/employee-app/attendance-status-card.tsx` - onCheckIn đổi thành () => void
- `src/app/admin/employees/[id]/employee-detail-view.tsx` - cột hành động "Ảnh" trong bảng chấm công

## Decisions Made

Xem `key-decisions` ở frontmatter. Quan trọng nhất:

1. **Checkpoint bucket/đường dẫn Storage đã được chủ dự án xác nhận: option-a** — `attendance-photos` · `{company_id}/{employee_id}/{photo_id}.jpg`. Lý do: khớp thẳng ràng buộc `check (storage_path like company_id || '/%')` đã có, và ưu tiên xoá-theo-nhân-viên cho nhóm PRIV (V3) hơn xoá-theo-tuổi — đánh đổi được chấp nhận có ý thức vì D-22 đã khoá "không job dọn nào trong V2".
2. **`evidence` optional ở mức kiểu, bắt buộc ở mức hành vi** trong `checkIn()` — giữ nguyên vẹn ranh giới file giữa Task 2 và Task 3 mà không phải sửa `employee-home-view.tsx` hai lần; thiếu evidence vẫn ném `AttendanceEvidenceError("missing_photo", ...)` ngay từ đầu hàm.
3. **`npm run test:db` chạy qua `TF_ALLOW_CLOUD_TESTS=1`** nhắm thẳng project Supabase dev thật, vì Docker không có sẵn trong môi trường thực thi này để dựng Postgres tạm như CI làm. Bốn dòng fixture pgTAP tạo ra được dọn sạch ngay sau khi chạy (xác nhận lại bằng `npm run db:seed` một mình trả về count=0), theo đúng tiền lệ đã ghi ở `02-02-SUMMARY.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `09_attendance_evidence.sql` khai `select plan(9)` nhưng chỉ viết 8 khẳng định**
- **Found during:** Task 1, khi chạy `npm run test:db` lần đầu và thấy "Looks like you planned 9 tests but ran 8"
- **Fix:** Sửa `plan(9)` thành `plan(8)`, cập nhật lại `MIN_ASSERTIONS` trong `scripts/check-pgtap-assertions.mjs` từ 200 xuống 199 (tổng thật đo được)
- **Files modified:** supabase/tests/09_attendance_evidence.sql, scripts/check-pgtap-assertions.mjs
- **Verification:** `npm run test:db` báo đúng 8/8, không còn cảnh báo lệch số lượng
- **Committed in:** 7b11e29 (Task 1 commit)

**2. [Rule 1 - Bug] Khẳng định cô lập RLS ban đầu viết sai cơ chế Postgres**
- **Found during:** Task 1, khi thiết kế `09_attendance_evidence.sql`
- **Issue:** Bản nháp đầu dùng `throws_ok` cho một `UPDATE ... WHERE company_id = 'cty-02'` từ phiên user 0001 — theo đúng ngữ nghĩa RLS của Postgres, một `UPDATE` nhắm vào dòng không qua được policy `USING` chỉ lặng lẽ cập nhật 0 dòng, KHÔNG ném lỗi (khác hẳn `INSERT`, nơi `WITH CHECK` luôn được đánh giá trên dòng mới)
- **Fix:** Đổi thành cập nhật một dòng CỦA CHÍNH user 0001 (cty-01, nhìn thấy được qua USING) nhưng đồng thời thử đổi `company_id` sang cty-02 — điều này khiến `WITH CHECK` trên dòng MỚI thất bại thật, tạo ra đúng SQLSTATE 42501
- **Files modified:** supabase/tests/09_attendance_evidence.sql
- **Verification:** `npm run test:db` xanh, khẳng định số 8 pass
- **Committed in:** 7b11e29 (Task 1 commit)

**3. [Rule 3 - Blocking] `vitest run` không thấy được `.env.local` khi chạy trực tiếp (không có `--env-file`)**
- **Found during:** Task 2, khi viết test tích hợp `route.test.ts` cần kết nối Postgres dev thật
- **Issue:** `npx vitest run ...` (đúng như acceptance criteria của Task 2 yêu cầu, không có cờ `--env-file`) không nạp `.env.local` vào `process.env` — xác nhận bằng một test thăm dò trước khi sửa
- **Fix:** Thêm `loadEnv(mode, cwd, "")` (từ `vite`) vào `vitest.config.mts`, chỉ gán biến CHƯA có sẵn trong `process.env` (không ghi đè biến do shell/CI truyền vào)
- **Files modified:** vitest.config.mts
- **Verification:** Test thăm dò xác nhận `process.env.NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SECRET_KEY` có giá trị sau khi sửa; `npx vitest run src/app/api/attendance-photos` xanh 8/8
- **Committed in:** 8e0097e (Task 2 commit)

**4. [Rule 1 - Bug] Comment trong route.ts chứa đúng chuỗi `createSignedUrl`/`<input type="file">` mà chính acceptance criteria cấm grep thấy**
- **Found during:** Task 2 và Task 3, khi chạy các lệnh grep chặn của acceptance criteria
- **Issue:** Comment giải thích LÝ DO KHÔNG dùng các API đó vô tình chứa nguyên văn chuỗi bị cấm, khiến grep dương tính giả
- **Fix:** Viết lại comment để diễn đạt cùng ý nghĩa mà không chứa nguyên văn chuỗi bị chặn (ví dụ: "hàm tạo liên kết ký (signed URL) của Supabase Storage" thay vì tên hàm chính xác)
- **Files modified:** src/app/api/attendance-photos/[id]/route.ts, src/components/employee-app/camera-sheet.tsx
- **Verification:** Các lệnh grep của acceptance criteria trả về rỗng
- **Committed in:** 8e0097e, 8616b1d

**5. [Rule 3 - Blocking] `AttendanceEvidenceError` export từ file mang chỉ thị `"use server"` làm `npm run build` thất bại**
- **Found during:** Task 3, khi chạy `npm run build` lần đầu sau khi nối Camera Sheet
- **Issue:** Next.js chỉ cho phép export hàm async từ một file `"use server"` — một `export class` (dù chỉ là lớp lỗi) làm build lỗi ngay ở bước compile
- **Fix:** Tách `AttendanceEvidenceError` sang file riêng `src/lib/data/mutations/attendance-errors.ts` (không mang chỉ thị `"use server"`), `attendance.ts` chỉ import và dùng nội bộ
- **Files modified:** src/lib/data/mutations/attendance.ts, src/lib/data/mutations/attendance-errors.ts (mới)
- **Verification:** `npm run build` thoát 0
- **Committed in:** 8616b1d (Task 3 commit)

**6. [Rule 2 - Missing Critical] Thiếu đường tra cứu "bản ghi này có ảnh không" cho `AttendancePhotoDialog`**
- **Found during:** Task 3, khi thiết kế `AttendancePhotoDialog`
- **Issue:** `<behavior>`/`<acceptance_criteria>` của Task 3 đòi Dialog phân biệt được "có ảnh" với "không có ảnh" cho một `attendanceRecordId`, nhưng broker route (Task 2) chỉ nhận THẲNG id của ảnh, không nhận id của bản ghi chấm công — không có cách nào khác trong `<files>` đã khai của Task 3 để trả lời câu hỏi đó
- **Fix:** Thêm Server Action `getAttendancePhotoForRecord(attendanceRecordId, kind)` trong file mới `src/lib/data/attendance-photos.ts`, cùng khuôn phân quyền owner/admin với broker route
- **Files modified:** src/lib/data/attendance-photos.ts (mới)
- **Verification:** `npm run typecheck && npm run build` thoát 0; Dialog dùng đúng hàm này để quyết định trạng thái hiển thị
- **Committed in:** 8616b1d (Task 3 commit)

---

**Total deviations:** 6 auto-fixed (2 Rule 1 — bug trong test tự viết, 2 Rule 3 — blocking do hạ tầng/build, 1 Rule 1 — comment vi phạm grep, 1 Rule 2 — chức năng thiếu)
**Impact on plan:** Tất cả đều cần thiết cho tính đúng đắn (bug test), khả năng chạy được (build/env), hoặc hành vi mà chính `<behavior>` của Task 3 yêu cầu (lookup ảnh). Không có mở rộng phạm vi ngoài ý định của plan.

## Issues Encountered

- **Docker không có sẵn trong môi trường thực thi này** — `npm run test:db` không dựng được Postgres tạm như CI (`.github/workflows/db-ci.yml`). Dùng escape hatch đã có sẵn trong `scripts/db.mjs` (`TF_ALLOW_CLOUD_TESTS=1`) để chạy thẳng lên project Supabase dev thật, dọn sạch 4 dòng fixture pgTAP ngay sau đó. Đây là hành vi đã có tiền lệ và tài liệu hoá ở `02-02-SUMMARY.md`, không phải một cách né tránh mới.
- **`gsd-tools windows append` báo lỗi parse frontmatter** ("Ledger frontmatter line is not key: value") khi thử ghi một mục `unrun-verify` vào `.planning/WINDOWS.md` — file đó đang có line-ending CRLF, có vẻ công cụ không xử lý được `\r` cuối dòng. Đây là vấn đề tiền tồn tại của tooling/checkout, không phải do plan này gây ra; theo đúng hướng dẫn ("ledger là optional, best-effort"), không chặn thực thi vì lỗi này — ghi lại ở đây để người vận hành biết.

## User Setup Required

None - không có cấu hình dịch vụ ngoài nào mới. Bucket Storage đã được tạo qua `npm run db:bucket` (idempotent, chạy lại an toàn) trong chính phiên thực thi này.

## Next Phase Readiness

**Sẵn sàng:** Toàn bộ hình dạng kiến trúc của phase đã chạy thật trên một đường duy nhất — camera trực tiếp → toạ độ → Server Action → Storage riêng tư → khoảng cách do database đo → giờ do database cấp → broker route có phân quyền → mắt quản trị. Các plan sau (03-02..03-07) có thể lặp lại/mở rộng trên đúng hình dạng này (tan ca, ba lý do từ chối, ba nhánh lỗi camera còn lại, màn hình khai báo điểm làm việc, danh sách cần xem lại, metadata đầy đủ trong Dialog) mà không cần đổi kiến trúc.

**Còn chờ (deferred sang UAT cuối phase, đúng `human_verify_mode: "end-of-phase"` của dự án):**
- Một lần chấm công thật qua giao diện với camera/GPS thật của một thiết bị — xác nhận `attendance_photos` tăng đúng 1 dòng có `distance_meters`/`captured_at` khác NULL.
- Quản trị mở Dialog và nhìn thấy đúng ảnh vừa chụp trong trình duyệt thật.
- Đối chiếu `audit_log` cho `entity_table='attendance_photos'` không chứa base64/dòng quá dài (D-18a) — cần dữ liệu thật từ bước trên để đo.

Ba mục này không chặn plan tiếp theo (kiến trúc đã chứng minh qua test tích hợp trên Postgres dev thật ở Task 2), nhưng cần một phiên UAT có thiết bị thật trước khi đóng phase 3.

---
*Phase: 03-ch-m-c-ng-c-b-ng-ch-ng*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 12 created files verified present on disk; all 3 task commits (`7b11e29`, `8e0097e`, `8616b1d`) verified present in `git log`.
