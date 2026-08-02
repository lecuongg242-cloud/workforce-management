---
phase: 03-ch-m-c-ng-c-b-ng-ch-ng
plan: 06
subsystem: attendance-suspicious-review
tags: [nextjs, route-handler, zod, vitest, react, ui, admin]

requires:
  - phase: 03-ch-m-c-ng-c-b-ng-ch-ng (03-01, 03-02, 03-04, 03-05)
    provides: "attendance_photos.distance_meters/work_site_id (03-01), work_sites.radiusMeters (03-02), AttendanceRejectedError/checkIn-checkOut chu ky sach (03-04), listAttendancePhotos/markPhotoReviewed/AttendancePhotoDialog day du (03-05)"
provides:
  - "src/lib/attendance/suspicious.ts — SUSPICIOUS_DISTANCE_MULTIPLIER (5)/isSuspiciousPunch()/suspiciousMultiplier(): nguon DUY NHAT cho nguong dang ngo D-21 trong toan repo"
  - "GET /api/attendance/review — danh sach ban ghi cham cong dang ngo, co tinh TAI THOI DIEM TRUY VAN, khong doc tu cot boolean"
  - "/admin/attendance/review — man hinh quan tri, tai su dung AttendancePhotoDialog cua 03-05"
  - "ADMIN_NAV_ITEMS/BREADCRUMB_LABELS them muc /admin/attendance/review"
affects: []

actuals:
  tokens: 11900
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Truy van hai buoc thay vi mot embed PostgREST ba tang: buoc 1 doc attendance_photos join work_sites (khuon da chung minh o GET /api/attendance-photos, 03-05), buoc 2 doc attendance_records join employees CHI cho cac attendance_record_id con lai sau buoc 1 — giam rui ro suy dien quan he lien ket sai qua nhieu tang, van kiem duoc bang mot chuoi gia lap don gian trong test"
    - "Co dang ngo TINH TAI THOI DIEM TRUY VAN qua isSuspiciousPunch(), khong doc tu mot cot boolean da luu — khi Phase 4 doi nguong tu hang so sang cau hinh doanh nghiep, danh sach tu cap nhat ma khong can ghi de hang loat len du lieu lich su (comment tai migration 0011 dong 56-60 da du bao dieu nay tu 03-01)"

key-files:
  created:
    - src/lib/attendance/suspicious.ts
    - src/lib/attendance/__tests__/suspicious.test.ts
    - src/lib/validation/api/attendance-review.ts
    - src/lib/data/attendance-review.ts
    - src/app/api/attendance/review/route.ts
    - src/lib/data/__tests__/attendance-review.test.ts
    - src/app/admin/attendance/review/page.tsx
    - src/app/admin/attendance/review/attendance-review-view.tsx
  modified:
    - src/lib/data/mutations/attendance.ts
    - src/lib/nav.ts
    - src/lib/constants.ts

key-decisions:
  - "[Rule 1] mutations/attendance.ts xoa ban sao cuc bo cua SUSPICIOUS_DISTANCE_MULTIPLIER (03-01/03-03 tam khai cho banner tuc thi), chuyen sang import tu src/lib/attendance/suspicious.ts — bat buoc de dat duoc acceptance criteria 'khai dung mot cho trong toan repo' cua Task 1; isOutsideRadius (banner nhan vien) GIU NGUYEN cong thuc cu (khong nhan them canCheckInRemotely), vi day la pham vi cua 03-04 khong phai cua plan nay"
  - "Truy van GET /api/attendance/review chia hai buoc (khong mot embed ba tang attendance_photos->attendance_records->employees) — giam rui ro PostgREST khong suy dien duoc quan he lien ket qua nhieu tang lien tiep, danh doi mot vong round-trip them nhung chap nhan duoc o quy mo 1-2 doanh nghiep cua du an (CLAUDE.md)"
  - "isSuspiciousPunch() lam LOP PHONG THU THU HAI ngay ca khi truy van SQL da loc distance_meters null qua .not() — test 4 mo phong truong hop DB khong loc duoc de chung minh tang ung dung van tu loai dung, khong phu thuoc hoan toan vao dieu kien SQL"
  - "[Rule 2] ATTENDANCE_REVIEW_LABEL mo rong tu 3 truong (emptyTitle/emptyBody/reviewAction, da co tu 03-01) len day du nhan cot/tieu de/hanh dong cho man hinh — constants.ts khong nam trong files_modified goc cua plan nhung can thiet dung quy uoc 'toan bo chu lay tu khoi hang so' cua CLAUDE.md, giong tien le 03-02 mo rong WORK_SITE_LABEL"

requirements-completed: [ATT-07]

coverage:
  - id: D1
    description: "isSuspiciousPunch()/suspiciousMultiplier() dung DUNG chin hanh vi cua <behavior> (canCheckInRemotely loai vo dieu kien, distance/radius null tra false, bien dung nguong tra false, ngoai ban kinh nhung chua toi nguong tra false); khong ham nao trong module nhan hai lan cham lien tiep"
    requirement: ATT-07
    verification:
      - kind: unit
        ref: "src/lib/attendance/__tests__/suspicious.test.ts (11 test, npx vitest run)"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run lint; grep -rn 'SUSPICIOUS_DISTANCE_MULTIPLIER *=' src/ | wc -l -> 1; grep -c canCheckInRemotely suspicious.ts -> 5"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /api/attendance/review: 403 cho vai tro khong phai owner/admin, co lap theo company_id tu session (ca hai buoc truy van), sap xep xac dinh (khoang cach giam dan -> thoi diem giam dan -> id tang dan), tham so truy van tuy chon khong khai dinh danh doanh nghiep"
    requirement: ATT-07
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/attendance-review.test.ts (11 test) + src/__tests__/route-handlers-get-only.test.ts (npx vitest run)"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run build; grep -rEc 'export (async )?function (POST|PUT|PATCH|DELETE|HEAD|OPTIONS)' src/app/api/attendance/review/ -> 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ba truong hop loc quan trong nhat: distance_meters null bi loai (ca khi mo phong DB khong loc duoc), canCheckInRemotely=true bi loai du khoang cach rat lon, khoang cach ngoai ban kinh nhung chua toi nguong bi loai — khong mot truong hop nao lam nhieu danh sach"
    requirement: ATT-07
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/attendance-review.test.ts test 3, 4, 5"
        status: pass
    human_judgment: false
  - id: D4
    description: "Hai doanh nghiep thay hai tap dinh danh khong giao nhau qua GET /api/attendance/review bang cookie phien that; nhan vien thuong nhan 403 that"
    requirement: ATT-07
    verification: []
    human_judgment: true
    rationale: "Can trinh duyet that voi phien dang nhap that (Ngoc Phat/Binh Minh) va du lieu vuot nguong that trong Postgres dev — moi truong thuc thi nay khong co trinh duyet/luong dang nhap that de lay cookie song, cung ly do da ghi o 03-01/03-02/03-04/03-05-SUMMARY.md. Logic co lap da doc ma xac nhan (.eq('company_id', companyId) tu getSessionContext() o CA HAI buoc truy van, cung khuon da kiem chung o GET /api/attendance-photos) va 11 test mock DB da chung minh dung dieu kien goi — deferred sang UAT cuoi phase (human_verify_mode: end-of-phase)."
  - id: D5
    description: "Man hinh /admin/attendance/review: bang 6 cot dung khuon skeleton/rong/loi cua admin, khoang cach LUON di kem boi so va do chinh xac, StatusBadge co bieu tuong+chu, hanh dong Xem chi tiet mo dung AttendancePhotoDialog cua 03-05, chu khong ket luan thay nguoi doc"
    requirement: ATT-07
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run build (thoat 0); npx vitest run toan repo (203 test xanh); 8 lenh grep cua acceptance criteria Task 3 (nav/AttendancePhotoDialog/Skeleton/EmptyState/accuracy/StatusBadge/truncate/tu-ngu-buoc-toi=0)"
        status: pass
    human_judgment: true
    rationale: "Chua mo trang that trong trinh duyet voi phien owner va du lieu vuot nguong that (tam ha radius_meters cua mot work_site de tao du lieu dang ngo, quan sat dong bang + boi so + Dialog mo dung), cung chua quan sat trang thai rong that voi mot doanh nghiep khong co ban ghi nao vuot nguong — moi truong thuc thi nay khong co trinh duyet that. Build/typecheck/lint/grep xac nhan ma dung hinh dang, render/tuong tac runtime deferred sang UAT cuoi phase."

duration: ~55min
completed: 2026-08-02
status: complete
---

# Phase 3 Plan 6: Danh sách chấm công cần xem lại (lớp phát hiện D-21) Summary

**`isSuspiciousPunch()` là hàm quyết định duy nhất cho ngưỡng đáng ngờ (mặc định 5 lần bán kính, khai đúng một chỗ trong toàn repo), `GET /api/attendance/review` tính cờ đáng ngờ TẠI THỜI ĐIỂM TRUY VẤN thay vì đọc từ một cột lưu cứng, và `/admin/attendance/review` cho quản trị một danh sách mời kiểm tra chứ không kết luận thay họ.**

## Performance

- **Duration:** ~55 phút (ước lượng)
- **Started:** 2026-08-02T20:30:00Z (ước lượng)
- **Completed:** 2026-08-02T21:25:00Z (ước lượng)
- **Tasks:** 3/3
- **Files modified:** 11 (8 tạo mới, 3 sửa)

## Accomplishments

- `src/lib/attendance/suspicious.ts` (mới): `SUSPICIOUS_DISTANCE_MULTIPLIER = 5` khai đúng MỘT chỗ trong toàn repo, `isSuspiciousPunch()` (chín hành vi: `canCheckInRemotely` loại vô điều kiện, khoảng cách/bán kính `null` trả `false`, biên đúng ngưỡng trả `false`, ngoài bán kính nhưng chưa tới ngưỡng trả `false`) và `suspiciousMultiplier()` — module không có hàm nào nhận hai lần chấm liên tiếp, cách đo theo tốc độ di chuyển đã bị bác bỏ tường minh trong comment và trong `REQUIREMENTS.md §ATT-07`
- `GET /api/attendance/review`: chỉ owner/admin, cờ đáng ngờ tính **tại thời điểm truy vấn** qua `isSuspiciousPunch()` — không đọc từ một cột boolean đã lưu (đúng comment cảnh báo tại `migration 0011` dòng 56-60 do chính 03-01 để lại). Truy vấn hai bước (`attendance_photos` join `work_sites`, rồi `attendance_records` join `employees` chỉ cho các id còn lại) thay vì một embed ba tầng liên tiếp — giảm rủi ro PostgREST suy diễn sai quan hệ liên kết
- `/admin/attendance/review`: bảng sáu cột (nhân viên, điểm làm việc, khoảng cách + bội số + độ chính xác, thời điểm, trạng thái xem xét, hành động), tái sử dụng `DataTableSkeleton`, trạng thái rỗng lành mạnh (`EmptyState`), hành động "Xem chi tiết" mở **chính** `AttendancePhotoDialog` của plan 03-05 (không dựng Dialog thứ hai)
- `[Rule 1]` `mutations/attendance.ts` (03-01/03-03) xoá bản sao cục bộ của `SUSPICIOUS_DISTANCE_MULTIPLIER`, chuyển sang import từ nguồn chính thức mới — dứt điểm việc hằng số này tồn tại ở hai nơi
- 22 test vitest mới (11 cho `suspicious.ts`, 11 cho route+data layer) — toàn bộ 203 test vitest của repo xanh, build/typecheck/lint sạch

## Task Commits

1. **Task 1: Quy tắc đáng ngờ — một ngưỡng, một hàm, không cột lưu cứng** - `bf01ef9` (feat)
2. **Task 2: Đường đọc danh sách cần xem lại** - `3a487b6` (feat)
3. **Task 3: Màn hình danh sách cần xem lại** - `653eb54` (feat)

_Cả ba task đều `tdd="true"`/hành vi-trước (Task 1, Task 2) hoặc hành vi-trước không tách RED/GREEN (Task 3, component UI) theo đúng cách các plan trước của phase đã làm — viết `<behavior>` trước rồi code thoả hành vi đó, commit atomic theo task._

## Files Created/Modified

- `src/lib/attendance/suspicious.ts` (mới) - `SUSPICIOUS_DISTANCE_MULTIPLIER`/`isSuspiciousPunch()`/`suspiciousMultiplier()`
- `src/lib/attendance/__tests__/suspicious.test.ts` (mới) - 11 test
- `src/lib/data/mutations/attendance.ts` - xoá bản sao cục bộ của hằng số, import từ `suspicious.ts`
- `src/lib/validation/api/attendance-review.ts` (mới) - `attendanceReviewRowSchema`/`attendanceReviewItemSchema`/`attendanceReviewQuerySchema`
- `src/lib/data/attendance-review.ts` (mới) - `listAttendanceReview()` qua `fetchJson`
- `src/app/api/attendance/review/route.ts` (mới) - Route Handler GET-only, truy vấn hai bước
- `src/lib/data/__tests__/attendance-review.test.ts` (mới) - 11 test tích hợp (mock DB)
- `src/app/admin/attendance/review/page.tsx` (mới) - Server Component, metadata
- `src/app/admin/attendance/review/attendance-review-view.tsx` (mới) - màn hình chính
- `src/lib/nav.ts` - `ADMIN_NAV_ITEMS`/`BREADCRUMB_LABELS` thêm mục `/admin/attendance/review`
- `src/lib/constants.ts` - `ATTENDANCE_REVIEW_LABEL` mở rộng

## Decisions Made

Xem `key-decisions` ở frontmatter. Quan trọng nhất:

1. **Xoá bản sao cục bộ của `SUSPICIOUS_DISTANCE_MULTIPLIER`** (`mutations/attendance.ts`, Rule 1) — bắt buộc để đạt acceptance criteria "khai đúng một chỗ trong toàn repo" của Task 1. `isOutsideRadius` (banner nhân viên, phạm vi của plan 03-04) **giữ nguyên** công thức cũ (không nhận thêm `canCheckInRemotely`) vì mở rộng hành vi đó nằm ngoài phạm vi plan này.
2. **Truy vấn hai bước thay vì một embed PostgREST ba tầng** — `attendance_photos -> attendance_records -> employees` liên tiếp mang rủi ro suy diễn quan hệ liên kết sai cao hơn hai embed một tầng riêng lẻ (mỗi cái đã được chứng minh đúng ở 03-05). Đánh đổi một vòng round-trip thêm, chấp nhận được ở quy mô 1-2 doanh nghiệp của dự án.
3. **`isSuspiciousPunch()` là lớp phòng thủ THỨ HAI** ngay cả sau khi SQL đã lọc `distance_meters is not null` — test 4 mô phỏng trường hợp DB không lọc được để chứng minh tầng ứng dụng vẫn tự loại đúng, không phụ thuộc hoàn toàn vào điều kiện SQL.
4. **`ATTENDANCE_REVIEW_LABEL` mở rộng** (Rule 2) dù `constants.ts` không nằm trong `files_modified` gốc của plan — cần thiết để màn hình không viết chuỗi tiếng Việt rải rác, đúng quy ước CLAUDE.md, cùng tiền lệ 03-02 mở rộng `WORK_SITE_LABEL`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/hygiene] `SUSPICIOUS_DISTANCE_MULTIPLIER` tồn tại ở hai nơi**
- **Found during:** Task 1, ngay khi tạo `suspicious.ts` — comment gốc của `mutations/attendance.ts` (03-01) đã tự ghi "plan 03-06 là nơi sở hữu chính thức" nhưng vẫn còn khai một bản sao cục bộ
- **Issue:** Acceptance criteria của Task 1 đòi `grep -rn "SUSPICIOUS_DISTANCE_MULTIPLIER *=" src/ | wc -l` trả về `1`; hai khai báo song song là đúng loại rủi ro mà chính comment cũ đã cảnh báo (Phase 4 đổi ngưỡng ở một nơi, nơi kia lệch theo)
- **Fix:** Xoá khai báo cục bộ, import hằng số từ `src/lib/attendance/suspicious.ts`
- **Files modified:** src/lib/data/mutations/attendance.ts
- **Verification:** `grep -rn "SUSPICIOUS_DISTANCE_MULTIPLIER *=" src/ | wc -l` → `1`; `npm run typecheck && npm run lint && npm run build` thoát 0
- **Committed in:** bf01ef9 (Task 1 commit)

**2. [Rule 2 - Missing Critical] `ATTENDANCE_REVIEW_LABEL` thiếu nhãn cho màn hình danh sách**
- **Found during:** Task 3, khi viết `attendance-review-view.tsx`
- **Issue:** `ATTENDANCE_REVIEW_LABEL` (thêm ở 03-01) chỉ có `emptyTitle`/`emptyBody`/`reviewAction` — không đủ cho tiêu đề trang, nhãn cột bảng, hành động "Xem chi tiết", và chữ ghép bội số/độ chính xác mà Task 3 yêu cầu
- **Fix:** Thêm `pageTitle`/`pageDescriptionPrefix`/`pageDescriptionSuffix`/`detailAction`/sáu nhãn cột/`multiplierPrefix`/`multiplierSuffix`/`accuracyPrefix`
- **Files modified:** src/lib/constants.ts
- **Verification:** `grep -icE "gian lận|vi phạm|giả mạo|man khai" src/lib/constants.ts` → `0`; `npm run typecheck && npm run lint && npm run build` thoát 0
- **Committed in:** 653eb54 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 — trùng khai báo hằng số, 1 Rule 2 — nhãn thiếu)
**Impact on plan:** Cả hai đều cần thiết cho đúng acceptance criteria (Rule 1) và đúng quy ước constants.ts của CLAUDE.md (Rule 2). Không có mở rộng phạm vi nghiệp vụ ngoài ý định của plan.

## Issues Encountered

- **`grep -rnE "\* *5\b|\bradius[A-Za-z]* *\* *[0-9]" src/app/api/ src/lib/data/ | grep -v suspicious` (acceptance criteria Task 1, "không nhúng cứng bội số ở nơi khác") trả về một dòng dương tính giả**: `src/lib/data/__tests__/requests.test.ts:16` — một dòng comment JSDoc dạng danh sách có thứ tự (`* 5. Khẳng định...`) khớp mẫu `\* *5\b` vì dấu `*` mở đầu dòng comment cộng khoảng trắng cộng số `5` trùng hình dạng regex, không liên quan gì tới khoảng cách/bán kính. Đọc mã xác nhận không có phép nhân bội số nào bị nhúng cứng ngoài `suspicious.ts` — đây là giới hạn của grep tĩnh trên văn bản (cùng loại hiện tượng đã ghi nhận ở `03-02-SUMMARY.md`), không phải vi phạm.
- **Grep kiểm tra "không nhắc từ tốc độ/km/h" trong `suspicious.ts` trả về 0 khớp** dù comment CÓ giải thích lý do bác bỏ cách đo theo tốc độ di chuyển — vì comment viết bằng tiếng Việt không dấu (quy ước ASCII của các file comment kỹ thuật trong repo này, ví dụ `camera.ts`/`rejection.ts`), nên không khớp chuỗi có dấu `"tốc độ"` mà acceptance criteria tìm. Kiểm bằng mắt xác nhận đoạn comment cuối file (`suspicious.ts` dòng 91-101) giải thích đầy đủ lý do bác bỏ cách đo theo tốc độ, đúng tinh thần acceptance criteria dù không khớp grep theo ký tự — kết luận ghi lại ở đây theo đúng yêu cầu "kiểm bằng mắt và ghi kết luận vào SUMMARY".

- **`gsd-tools windows append` báo lỗi parse frontmatter** (`"last_updated: ...\r" is not key: value`) khi thử ghi mục `unrun-verify` (D4) vào `.planning/WINDOWS.md` — cùng nguyên nhân CRLF đã ghi nhận ở `03-01-SUMMARY.md`/`03-02-SUMMARY.md`. Ledger là optional/best-effort theo hướng dẫn, không chặn thực thi; ghi lại ở đây để người vận hành biết mục D4/D5 chưa vào được ledger tự động.

## User Setup Required

None - không có cấu hình dịch vụ ngoài nào mới, không có migration nào thêm (đúng dòng 56-60 của `migration 0011`: cờ đáng ngờ không bao giờ cần một cột lưu cứng).

## Next Phase Readiness

**Sẵn sàng:** Lớp phát hiện CHÍNH của toàn phase (D-21b: kiểu gian lận "nhờ đồng nghiệp chấm hộ" mà ảnh hiện trường và GPS đều không bắt được) đã tồn tại thật và đọc được — một lần chấm công cách mốc quá xa nổi lên đúng chỗ quản trị nhìn, kèm đủ ngữ cảnh (khoảng cách + bội số + độ chính xác GPS) để người đọc quyết định có nên hỏi hay không, và danh sách không bị nhiễu bởi chính những người đã được cho phép ở xa (`canCheckInRemotely`). `SUSPICIOUS_DISTANCE_MULTIPLIER`/`isSuspiciousPunch()` là nguồn duy nhất cho Phase 4 khi chuyển ngưỡng từ hằng số sang cấu hình doanh nghiệp (D-21a) — chỉ cần đổi MỘT hàm, danh sách và banner tự cập nhật.

**Còn chờ (deferred sang UAT cuối phase, đúng `human_verify_mode: "end-of-phase"` của dự án, cùng tiền lệ với 03-01/03-02/03-04/03-05-SUMMARY.md):**
- Hai doanh nghiệp thấy hai tập định danh không giao nhau qua `GET /api/attendance/review` bằng cookie phiên thật (D4).
- Mở `/admin/attendance/review` thật trong trình duyệt với phiên owner và ít nhất một bản ghi vượt ngưỡng (tạm hạ `radius_meters` của một điểm làm việc để tạo dữ liệu đáng ngờ): xác nhận dòng bảng đúng, bội số đúng, bấm "Xem chi tiết" mở đúng Dialog của bản ghi đó, khôi phục bán kính sau khi kiểm (D5).
- Quan sát trạng thái rỗng thật với một doanh nghiệp không có bản ghi nào vượt ngưỡng (D5).

Ba mục này không chặn việc đóng phase (logic đã chứng minh qua 22 test vitest mới trên tổng 203 test toàn repo + build/typecheck/lint xanh, cùng khuôn đã được các plan trước của phase chứng minh đúng trên production thật), nhưng cần một phiên UAT có trình duyệt/cookie phiên thật trước khi đóng phase 3.

---
*Phase: 03-ch-m-c-ng-c-b-ng-ch-ng*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 8 created files verified present on disk; all 3 task commits
(`bf01ef9`, `3a487b6`, `653eb54`) verified present in `git log`.
