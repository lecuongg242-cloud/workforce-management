---
phase: 03-ch-m-c-ng-c-b-ng-ch-ng
plan: 03
subsystem: attendance-evidence
tags: [getUserMedia, geolocation, browser-image-compression, react, vitest, testing-library, nextjs-server-actions]

requires:
  - phase: 03-ch-m-c-ng-c-b-ng-ch-ng (03-01)
    provides: "camera.ts (bon lop loi dinh nghia san), camera-sheet.tsx (may trang thai tracer), ATTENDANCE_EVIDENCE_LABEL/ATTENDANCE_REJECTION_LABEL, checkIn() nhan PunchEvidence + tinh khoang cach qua tf_distance_meters()"
provides:
  - "camera.ts day du: NoCameraDeviceError (gop NotFoundError+OverconstrainedError), CameraInUseError, LocationPermissionDeniedError, LocationTimeoutError, compressPhoto() qua browser-image-compression@2.0.2 (pinned)"
  - "Camera Sheet day du trang thai: bon khoi loi camera, khoi tu choi vi tri rieng, chip GPS-timeout, ba khoi tu choi D-20b (missing_photo/outside_shift/network_error) phan biet duoc, banner 'da ghi nhan nhung o xa' (D-20) dong bang mot lan cham"
  - "checkIn() tra them distanceMeters/workSiteName/isOutsideRadius (CheckInResult) — nguong D-21 mac dinh 5x ban kinh, tinh ngay tai check-in de Camera Sheet quyet dinh banner tuc thi"
  - "Bai kiem component dau tien cua du an (camera-sheet.test.tsx, 18 test voi @testing-library/react)"
affects: [03-04, 03-06, 03-07]

actuals:
  tokens: 17057
  tasks: 3
  commits: 4

tech-stack:
  added: ["browser-image-compression@2.0.2 (pinned, qua cong xac minh nguoi nhin)"]
  patterns:
    - "@testing-library/react + navigator gia lap bang Object.defineProperty (RESEARCH §Testing) — mo hinh test component dau tien cua du an, tai su dung duoc cho moi component client khac sau nay"
    - "Vá HTMLCanvasElement.prototype.getContext/toBlob trong test de captureFrame() THAT chay duoc trong jsdom (khong Canvas 2D that) — tranh mock nguyen module camera.ts"
    - "Phan loai loi qua ranh gioi Server Action bang KIEM HINH DANG (co truong `reason` hop le), khong dung `instanceof` — chuan bi truoc cho 03-04 se chinh thuc hoa bang isAttendanceRejection()"
    - "Nguong dang ngo (D-21, 5x ban kinh) tinh HAI LAN doc lap o hai noi: tuc thi trong checkIn() cho banner nhan vien (plan nay), va se duoc 03-06 tinh lai tai thoi diem truy van cho danh sach quan tri — cung cong thuc, hai nguoi xem"

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - src/lib/attendance/camera.ts
    - src/lib/attendance/__tests__/camera.test.ts
    - src/components/employee-app/camera-sheet.tsx
    - src/components/employee-app/__tests__/camera-sheet.test.tsx
    - src/lib/constants.ts
    - src/lib/data/mutations/attendance.ts
    - src/app/employee/employee-home-view.tsx

key-decisions:
  - "checkpoint:human-verify (gate blocking-human) — chu du an xac nhan browser-image-compression@2.0.2 hop le: repo github.com/Donaldcwl/browser-image-compression, khong postinstall, ~1.43M luot tai/tuan, ten khong bi tro chu"
  - "[Rule 2] onSubmit doi tu Promise<void> sang Promise<PunchSubmitResult> — khong co kenh nao khac de checkIn() tra khoang cach/ten diem lam viec THAT cho banner D-20; mo rong ngoai <files> goc cua Task 3 sang attendance.ts va employee-home-view.tsx"
  - "Nguong dang ngo D-21 (5x ban kinh) khai MOT lan trong attendance.ts (SUSPICIOUS_DISTANCE_MULTIPLIER) chi de quyet dinh banner tuc thi — 03-06 la noi so huu chinh thuc hang so nay cho danh sach can xem lai cua quan tri, se hop nhat sau"
  - "[Rule 1] Sua loi authoring cua constants.ts (03-01): outsideRadiusBodySuffix lam trung chu 'khoang cach nay' khien cau ghep sai ngu phap — tach rieng outsideRadiusDistanceLabel"
  - "[Rule 1] Don sach 9 chuoi tieng Viet viet thang con sot tu tracer 03-01 (aria-label/alt/toast/console.error) ve khoi hang so, dap ung dung acceptance criteria cua chinh Task 2"
  - "Phan loai loi Server Action bang kiem hinh dang (truong `reason`), khong dung `instanceof` — chuan bi cho 03-04 se dinh nghia isAttendanceRejection() chinh thuc; network_error la mac dinh khi khong co truong reason hop le"

requirements-completed: [ATT-01, ATT-08]

coverage:
  - id: D1
    description: "camera.ts day du bon nhanh loi getUserMedia (gop NotFound/Overconstrained thanh NoCameraDeviceError), hai nhanh loi geolocation, va compressPhoto() khong bao gio chan lan cham cong khi nen hong"
    requirement: ATT-01
    verification:
      - kind: unit
        ref: "src/lib/attendance/__tests__/camera.test.ts (12 test, npx vitest run)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Camera Sheet day du may trang thai UI: bon khoi loi camera phan biet duoc (icon+tieu de+than), khoi tu choi vi tri rieng biet (khong bia them ly do tu choi thu tu), chip GPS-timeout khong thay ca khung hinh, khong co phan tu chon tep nao"
    requirement: ATT-01
    verification:
      - kind: unit
        ref: "src/components/employee-app/__tests__/camera-sheet.test.tsx test 1-8 (npx vitest run)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ba ly do tu choi D-20b (missing_photo/outside_shift/network_error) phan biet duoc bang icon+tieu de+than+hanh dong tiep theo; gui lai giu dung anh/toa do, khong mo lai camera, khong hen gio tu dong, khong ghi bo nho lau ben"
    requirement: ATT-08
    verification:
      - kind: unit
        ref: "src/components/employee-app/__tests__/camera-sheet.test.tsx test 9-14 (npx vitest run)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Banner 'da ghi nhan nhung o xa' (D-20): tong ho phach, mo dau 'Da ghi nhan', chua ten diem+khoang cach that tu server, dong bang mot lan cham 'Da hieu' (khong tu bien mat), khong hien do chinh xac GPS"
    requirement: ATT-08
    verification:
      - kind: unit
        ref: "src/components/employee-app/__tests__/camera-sheet.test.tsx test 15-18 (npx vitest run)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cong xac minh tinh hop le cua goi npm browser-image-compression truoc khi cai (T-03-03-SC)"
    verification:
      - kind: manual_procedural
        ref: "checkpoint:human-verify resolved: approved — repo github.com/Donaldcwl/browser-image-compression xac nhan boi chu du an"
        status: pass
    human_judgment: true
    rationale: "Cong bat buoc co nguoi nhin theo protocol package-legitimacy — khong bao giờ tu dong phe duyet du o che do auto."
  - id: D6
    description: "Tu choi quyen camera tren thiet bi that (cai dat trinh duyet) va khoi giai thich + nut Thu lai hoat dong sau khi cap lai quyen ma khong tai lai trang; banner o xa hien dung ten diem/khoang cach voi GPS that gan mot diem lam viec that"
    verification: []
    human_judgment: true
    rationale: "Can trinh duyet that tren thiet bi that co camera/GPS — moi truong thuc thi nay khong co; deferred sang human_verify_mode: end-of-phase cua du an, cung tien le voi 03-01-SUMMARY.md/03-05-SUMMARY.md."

duration: ~60min
completed: 2026-08-02
status: complete
---

# Phase 3 Plan 3: Camera Sheet đủ mọi nhánh lỗi + ba lý do từ chối + banner ngoài bán kính Summary

**Camera Sheet đi từ đường hạnh phúc của lát cắt tracer lên đủ bốn nhánh lỗi camera, tách vị trí, hết giờ chờ GPS, ba lý do từ chối D-20b phân biệt được, và banner "đã ghi nhận nhưng ở xa" (D-20) đóng bằng một lần chạm — kèm nén ảnh phía client qua `browser-image-compression` sau cổng xác minh có người nhìn.**

## Performance

- **Duration:** ~60 phút (bao gồm một checkpoint:human-verify chờ chủ dự án xác nhận gói npm)
- **Started:** 2026-08-02T11:00:00Z (ước lượng)
- **Completed:** 2026-08-02T12:25:32Z
- **Tasks:** 3/3
- **Files modified:** 9 (0 tạo mới, 9 sửa)

## Accomplishments

- `camera.ts` đủ bốn lớp lỗi camera (gộp `NotFoundError`/`OverconstrainedError` thành `NoCameraDeviceError` — cùng một lối thoát) và hai lớp lỗi vị trí (`LocationPermissionDeniedError`/`LocationTimeoutError`), cộng `compressPhoto()` bọc `browser-image-compression@2.0.2` (pinned, qua cổng xác minh có người nhìn) — nén hỏng thì trả lại ảnh gốc chứ không chặn lần chấm công
- Camera Sheet đủ trạng thái: bốn khối lỗi camera phân biệt được (chung icon `CameraOff` theo đúng UI-SPEC nhưng tiêu đề/thân khác nhau), khối từ chối quyền vị trí riêng biệt (cổng client-side, không bịa thêm lý do từ chối thứ tư), chip GPS-timeout không thay cả khung hình
- Ba lý do từ chối D-20b (`missing_photo`/`outside_shift`/`network_error`) mỗi lý do một icon/tiêu đề/thân/hành động tiếp theo riêng — `network_error` là phân loại **duy nhất** client tự quyết (kiểm theo hình dạng trường `reason`, không dùng `instanceof`, vì lỗi qua ranh giới Server Action có thể mất nguyên mẫu)
- Banner "đã ghi nhận nhưng ở xa" (D-20): tông hổ phách, mở đầu "Đã ghi nhận", chứa tên điểm làm việc + khoảng cách **thật** do server trả về, đóng bằng một lần chạm "Đã hiểu" — không tự biến mất, không hiện độ chính xác GPS
- 30 test Vitest mới (12 unit cho `camera.ts`, 18 component cho `camera-sheet.tsx` — bài kiểm component đầu tiên của dự án dùng `@testing-library/react`)

## Task Commits

1. **Checkpoint:human-verify — Xác minh gói `browser-image-compression`** — resolved: approved (không có commit riêng, xác nhận qua tin nhắn điều phối viên)
2. **Task 1: Bốn nhánh lỗi camera, hết giờ chờ GPS, nén ảnh phía client** - `ce23dad` (feat)
3. **Task 2: Camera Sheet đủ trạng thái** - `fe0889c` (feat)
4. **Task 3: Ba lý do từ chối + banner ngoài bán kính** - `894671a` (feat)
5. **Sửa lỗi kiểu TypeScript trong test 13** - `a53d8fb` (fix)

_Cả ba task đều `tdd="true"`/hành vi-trước theo đúng cách 03-01 đã làm: viết `<behavior>` trước rồi code thoả hành vi đó, commit atomic theo task — không tách RED/GREEN riêng vì hành vi phân tán trên các nhánh liên quan chặt trong cùng một module/component._

## Files Created/Modified

- `src/lib/attendance/camera.ts` - `NoCameraDeviceError`/`CameraInUseError`/`LocationPermissionDeniedError`/`LocationTimeoutError`, `PHOTO_MAX_SIZE_MB`/`PHOTO_MAX_DIMENSION`, `compressPhoto()`
- `src/lib/attendance/__tests__/camera.test.ts` - 12 test: 5 nhánh getUserMedia (4 phân loại + 1 lạ), ràng buộc `ideal`, 2 nhánh geolocation, 3 tuỳ chọn geolocation, `closeCamera` 2 track, nén thành công/nén hỏng
- `src/components/employee-app/camera-sheet.tsx` - máy trạng thái đầy đủ: `overlay` (loading/4 lỗi camera/vị trí/rejection/flagged), `classifyRejection()`, `PunchSubmitResult`
- `src/components/employee-app/__tests__/camera-sheet.test.tsx` - 18 test component (`@testing-library/react`, navigator giả lập, patch `HTMLCanvasElement` cho `captureFrame()` thật chạy trong jsdom)
- `src/lib/constants.ts` - thêm nhãn Camera Sheet còn thiếu (đóng/chụp/alt/toast), sửa `outsideRadiusBodySuffix` (bug authoring của 03-01)
- `src/lib/data/mutations/attendance.ts` - `checkIn()` trả thêm `distanceMeters`/`workSiteName`/`isOutsideRadius` (`CheckInResult`), `SUSPICIOUS_DISTANCE_MULTIPLIER` (D-21, mặc định 5)
- `src/app/employee/employee-home-view.tsx` - `handlePunchSubmit` trả `PunchSubmitResult`, bỏ toast khi bị đánh dấu (Camera Sheet tự hiện banner)

## Decisions Made

Xem `key-decisions` ở frontmatter. Quan trọng nhất:

1. **Checkpoint xác minh gói npm đã được chủ dự án phê duyệt** — `browser-image-compression@2.0.2`, repo `github.com/Donaldcwl/browser-image-compression` xác nhận thật, không `postinstall`, không phải tên tráo chữ. Ghim cứng phiên bản (không dấu `^`/`~`).
2. **`onSubmit` đổi từ `Promise<void>` sang `Promise<PunchSubmitResult>`** (Rule 2, xem Deviations) — banner D-20 cần dữ liệu khoảng cách/tên điểm THẬT từ server, và không có kênh nào khác trong `<files>` gốc của Task 3 để mang dữ liệu đó tới Camera Sheet.
3. **Ngưỡng đáng ngờ D-21 (5x bán kính) khai một lần trong `attendance.ts`** chỉ để quyết định banner tức thì của nhân viên — plan 03-06 (chưa chạy, phụ thuộc 03-03) là nơi sở hữu chính thức hằng số này cho danh sách "cần xem lại" của quản trị; hai nơi tính cùng công thức cho hai người xem khác nhau, không phải hai quyết định mâu thuẫn nhau.
4. **Phân loại lỗi qua ranh giới Server Action bằng kiểm hình dạng (`reason` field), không dùng `instanceof`** — tài liệu Next.js: chỉ `message` chắc chắn được chuyển tiếp qua Server Action, các trường tuỳ biến khác của lớp lỗi có thể mất khi tới client. Cùng hướng tiếp cận với `isAttendanceRejection()` mà 03-04 sẽ định nghĩa chính thức.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Không có kênh dữ liệu nào để banner "đã ghi nhận nhưng ở xa" hiển thị khoảng cách/tên điểm THẬT**
- **Found during:** Task 3, khi thiết kế banner theo `<behavior>`/`<must_haves>` (yêu cầu dữ liệu thật, không phải giả định client)
- **Issue:** `checkIn()` (Server Action) tính `distanceMeters`/chọn `work_site` gần nhất nội bộ nhưng chỉ trả về `AttendanceRecord` — không có trường nào mang thông tin đó ra ngoài. Ngưỡng "đáng ngờ" (D-21, so khoảng cách với bán kính × hệ số) cũng chưa được tính ở bất kỳ đâu — đó là công việc của plan 03-06 (chưa chạy, phụ thuộc 03-03) nhưng cho **danh sách quản trị tại thời điểm truy vấn**, không phải cho banner tức thì của nhân viên tại thời điểm chấm công.
- **Fix:** Mở rộng `checkIn()` trả `CheckInResult` (= `AttendanceRecord` + `distanceMeters`/`workSiteName`/`isOutsideRadius`), thêm `SUSPICIOUS_DISTANCE_MULTIPLIER = 5` cục bộ trong `attendance.ts` kèm comment rõ ràng đây là bản dùng riêng cho banner tức thì, 03-06 sẽ hợp nhất thành cấu hình doanh nghiệp sau. Đổi `onSubmit` của `CameraSheet` từ `Promise<void>` sang `Promise<PunchSubmitResult>`, cập nhật `employee-home-view.tsx` để truyền dữ liệu qua.
- **Files modified:** src/lib/data/mutations/attendance.ts, src/components/employee-app/camera-sheet.tsx, src/app/employee/employee-home-view.tsx
- **Verification:** `npm run typecheck && npm run lint && npm run build` thoát 0; test 15-18 của `camera-sheet.test.tsx` khẳng định banner hiện đúng tên điểm + khoảng cách được truyền qua `onSubmit`; toàn bộ 164 test của dự án vẫn xanh (không callsite nào khác gọi `checkIn()` trực tiếp bị vỡ)
- **Committed in:** 894671a (Task 3 commit)

**2. [Rule 1 - Bug] `outsideRadiusBodySuffix` của 03-01 làm trùng chữ, câu ghép sai ngữ pháp**
- **Found during:** Task 3, khi ghép chuỗi banner theo đúng khuôn `outsideRadiusBodyPrefix`/`...Suffix` đã có sẵn từ 03-01
- **Issue:** `outsideRadiusBodySuffix` gốc là `"khoảng cách này. Quản trị sẽ xem lại bản ghi này."` — nếu ghép đúng công thức `{prefix} {tênĐiểm} {suffix}` thì câu ra `"Bạn cách Xưởng 2 khoảng cách này. Quản trị..."`, sai ngữ pháp và không chèn được con số khoảng cách thật ở đâu cả
- **Fix:** Thêm `outsideRadiusDistanceLabel: "khoảng"` (đặt giữa tên điểm và con số), sửa `outsideRadiusBodySuffix` còn `"Quản trị sẽ xem lại bản ghi này."` — công thức ghép giờ đúng khuôn UI-SPEC: `"Bạn cách {tên} khoảng {số}m. Quản trị sẽ xem lại bản ghi này."`
- **Files modified:** src/lib/constants.ts
- **Verification:** test 15 của `camera-sheet.test.tsx` khẳng định banner chứa cả tên điểm và `"620 m."` đúng vị trí trong câu
- **Committed in:** fe0889c (Task 2 commit — sửa cùng lúc với các nhãn Task 2 khác vì cùng khối `ATTENDANCE_EVIDENCE_LABEL`)

**3. [Rule 1 - Bug/Hygiene] 9 chuỗi tiếng Việt viết thẳng còn sót từ tracer 03-01 vi phạm chính acceptance criteria của Task 2**
- **Found during:** Task 2, khi chạy grep acceptance criteria `grep -cE "\"[^\"]*[àáảãạăâđêôơư][^\"]*\"" camera-sheet.tsx` (yêu cầu trả về `0`) trên file tracer hiện có
- **Issue:** `aria-label="Đóng"`, `aria-label="Chụp ảnh"`, `alt="Ảnh vừa chụp"`, hai `console.error(...)` và hai `toast.error(...)` với chuỗi tiếng Việt viết thẳng — vi phạm quy ước "toàn bộ chữ tiếng Việt lấy từ khối hằng số" mà chính plan này đòi hỏi, dù các dòng đó do 03-01 viết trước khi quy ước grep-zero này được đặt ra cho plan 03-03
- **Fix:** Chuyển toàn bộ vào `ATTENDANCE_EVIDENCE_LABEL` (`closeButtonLabel`/`captureButtonLabel`/`capturedPhotoAlt`/`cameraOpenErrorToast`/`captureErrorToast`/`submitErrorFallback`); đổi `console.error` message sang tiếng Anh ASCII (log nội bộ, không hiển thị người dùng, không cần tiếng Việt)
- **Files modified:** src/lib/constants.ts, src/components/employee-app/camera-sheet.tsx
- **Verification:** `grep -cE "\"[^\"]*[àáảãạăâđêôơư][^\"]*\"" camera-sheet.tsx` trả về `0`
- **Committed in:** fe0889c (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 2 — kênh dữ liệu thiếu cho banner, 2 Rule 1 — bug chữ/vệ sinh code kế thừa từ tracer)
**Impact on plan:** Deviation #1 (Rule 2) là mở rộng cần thiết ngoài `<files>` gốc của Task 3 — không có cách nào khác để banner D-20 dùng dữ liệu thật thay vì giả định; phạm vi mở rộng tối thiểu (3 trường số liệu, không đổi kiến trúc). Hai deviation Rule 1 là sửa lỗi kế thừa, không mở rộng phạm vi ngoài ý định của plan.

## Issues Encountered

- **`browser-image-compression` dùng `useWebWorker: true` treo vô hạn trong jsdom** (không có `Worker`) khi test component thật gọi `compressPhoto()` — không nem lỗi đồng bộ như dự đoán ban đầu, khiến `handleSubmit()` không bao giờ resolve. Giải quyết bằng `vi.mock("browser-image-compression", ...)` trong `camera-sheet.test.tsx` (chỉ file test component, không ảnh hưởng `camera.test.ts` — hành vi nén thật/nén hỏng của chính thư viện đã được kiểm ở Task 1 qua mock riêng).
- **jsdom không triển khai Canvas 2D thật** — `captureFrame()` (dùng thật, không mock) cần `HTMLCanvasElement.prototype.getContext`/`toBlob` được vá tối thiểu trong `beforeAll()` của bài kiểm component để mô phỏng chụp ảnh mà không cần cài thêm gói polyfill `canvas`.
- **Không tìm được acceptance-criteria conflict nào không giải quyết được**, ngoại trừ mục "Known Acceptance-Criteria Conflict" bên dưới.

## Known Acceptance-Criteria Conflict

Acceptance criteria của Task 3 yêu cầu `grep -icE "accuracy|độ chính xác" src/components/employee-app/camera-sheet.tsx` trả về `0`. Lệnh này thực tế trả về `3` — cả ba lần đều là chuỗi con `accuracyMeters`, tên trường **bắt buộc** của kiểu `PunchEvidence` (`src/lib/types/domain.ts`, do 03-01 định nghĩa) mà `camera-sheet.tsx` phải gán khi gọi `onSubmit()`. Không có cách nào tránh chuỗi con này xuất hiện trong file mà vẫn giữ đúng hợp đồng kiểu của `PunchEvidence` — đổi tên trường sẽ phải sửa `domain.ts`/`attendance.ts`/`punchEvidenceSchema` (ngoài phạm vi plan này) chỉ để né một grep.

**Ý định thật của acceptance criteria đã được đáp ứng:** con số độ chính xác GPS **không hiển thị** ở bất kỳ đâu trong giao diện nhân viên — test 18 (`camera-sheet.test.tsx`) khẳng định `document.body.textContent` không chứa "độ chính xác" sau khi banner "ở xa" hiện ra. Đây là mục tiêu thật của tiêu chí (D-21b: con số client tự khai không nên trông có thẩm quyền ở màn hình nhân viên), không phải việc tránh xuất hiện tên biến `accuracyMeters` trong mã nguồn.

## User Setup Required

None - không có cấu hình dịch vụ ngoài nào mới. `browser-image-compression` đã cài qua `npm install browser-image-compression@2.0.2 --save-exact` trong chính phiên thực thi này, sau khi cổng xác minh được chủ dự án phê duyệt.

## Next Phase Readiness

**Sẵn sàng:** Camera Sheet chịu được mọi nhánh lỗi camera/vị trí một thiết bị thật sẽ ném vào, và mọi kết quả gửi (thành công/từ chối/đánh dấu) đều có màn hình nói đúng chuyện gì đang xảy ra và hành động tiếp theo. `checkIn()` đã trả đủ dữ liệu khoảng cách/tên điểm cho bất kỳ màn hình nào khác cần dùng.

**Bàn giao cho 03-04 (phụ thuộc 03-03, wave 3):** `SUSPICIOUS_DISTANCE_MULTIPLIER` hiện khai cục bộ trong `attendance.ts` — khi 03-04/03-06 định nghĩa `AttendanceRejectedError`/ngưỡng cấu hình doanh nghiệp chính thức (D-21a), nên hợp nhất thay vì để hai hằng số song song. `classifyRejection()` trong `camera-sheet.tsx` dùng kiểm hình dạng tạm thời — khi 03-04 thêm `isAttendanceRejection()` trong `src/lib/attendance/rejection.ts`, plan sau nên đổi `classifyRejection()` sang gọi thẳng hàm đó thay vì tự viết lại logic tương tự.

**Còn chờ (deferred sang UAT cuối phase, đúng `human_verify_mode: "end-of-phase"` của dự án, cùng tiền lệ với 03-01-SUMMARY.md/03-05-SUMMARY.md):**
- Từ chối quyền camera trong cài đặt trình duyệt trên thiết bị thật rồi mở màn hình: xác nhận khối giải thích hiện ra và nút "Thử lại" hoạt động sau khi cấp lại quyền mà không cần tải lại trang.
- Chấm công thật gần một điểm làm việc đặt cách vài trăm mét: xác nhận banner hổ phách hiện đúng tên điểm + khoảng cách thật và không tự biến mất.
- Điều kiện camera bị ứng dụng khác giữ (`NotReadableError`) là backstop theo UI-SPEC — nhánh mã và chữ đã hiện thực và có test giả lập `DOMException`, nhưng chưa dựng được điều kiện trình duyệt thật hiếm gặp này.

Ba mục này không chặn plan tiếp theo (logic đã chứng minh qua 30 test tự động + build/typecheck/lint xanh), nhưng cần một phiên UAT có thiết bị thật trước khi đóng phase 3.

---
*Phase: 03-ch-m-c-ng-c-b-ng-ch-ng*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 7 modified files verified present on disk; all 4 task commits (`ce23dad`, `fe0889c`, `894671a`, `a53d8fb`) verified present in `git log`.
