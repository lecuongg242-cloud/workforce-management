---
phase: 03-ch-m-c-ng-c-b-ng-ch-ng
plan: 02
subsystem: work-sites-admin
tags: [nextjs-server-actions, route-handler, zod, react-hook-form, rls, audit-log]

requires:
  - phase: 03-ch-m-c-ng-c-b-ng-ch-ng
    provides: "Migration 0005 work_sites table (D-12b/RLS 4 policy đã có sẵn từ Phase 1); tf_distance_meters()/attendance_photos.work_site_id từ plan 03-01"
provides:
  - "GET /api/work-sites — Route Handler GET-only, sắp xếp name→id, trả rỗng khi chưa có doanh nghiệp hiện hành"
  - "createWorkSite/updateWorkSite/archiveWorkSite — Server Action theo khuôn mutations/shifts.ts, requireRole owner/admin, logMutation mỗi lần ghi"
  - "archiveWorkSite chỉ hạ is_active — không có lệnh xoá dòng nào trong module ghi (T-03-02-05)"
  - "/admin/work-sites — màn hình khai báo/sửa/ngừng sử dụng điểm làm việc, cùng bộ ba skeleton/rỗng/lỗi của ShiftsView"
  - "ADMIN_NAV_ITEMS + BREADCRUMB_LABELS wiring cho /admin/work-sites"
affects: [03-03, 03-04, 03-05, 03-06, 03-07]

actuals:
  tokens: 9517
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "workSiteFormSchema (form, 4 trường) tách khỏi workSiteInputSchema (write, 5 trường gồm isActive) — form không có ô isActive, hành động bật/tắt là archiveWorkSite riêng trên card, không phải một field trong dialog"
    - "BREADCRUMB_LABELS phải khai tường minh cho mọi segment route có dấu '-' (vd 'work-sites') — thiếu entry khiến fallback trong admin-topbar.tsx (dòng 43-44) hiển thị nhầm thành 'Chi tiết'"

key-files:
  created:
    - src/lib/validation/api/work-sites.ts
    - src/lib/data/work-sites.ts
    - src/lib/data/mutations/work-sites.ts
    - src/app/api/work-sites/route.ts
    - src/lib/data/__tests__/work-sites.test.ts
    - src/app/admin/work-sites/page.tsx
    - src/app/admin/work-sites/work-sites-view.tsx
    - src/components/work-sites/work-site-card.tsx
    - src/components/work-sites/work-site-dialog.tsx
  modified:
    - src/lib/validation/schemas.ts
    - src/lib/constants.ts
    - src/lib/nav.ts

key-decisions:
  - "workSiteFormSchema (dialog) chỉ có 4 trường (tên/vĩ độ/kinh độ/bán kính) — isActive không phải ô nhập, view tự ghép isActive: editing ? editing.isActive : true trước khi gọi Server Action, giữ hành vi bật/tắt tách biệt khỏi form giống UI-SPEC mô tả (chỉ có nút Ngừng sử dụng, không có toggle isActive trong dialog)"
  - "WORK_SITE_LABEL (constants.ts, không nằm trong files_modified gốc của plan) mở rộng thêm statusActive/statusInactive/radiusLabel/radiusHelp — Rule 2, cần thiết để card không viết chuỗi tiếng Việt rải rác, đúng chỉ dẫn action (c)/(d) của Task 2 và quy ước constants.ts của CLAUDE.md"
  - "BREADCRUMB_LABELS thêm 'work-sites': 'Điểm làm việc' — Rule 1 (bug), vì đoạn route có dấu '-' mà thiếu entry sẽ rơi vào fallback 'Chi tiết' (admin-topbar.tsx dòng 43-44), không phải do plan yêu cầu nhưng cần thiết để breadcrumb đúng"

requirements-completed: [ATT-03]

coverage:
  - id: D1
    description: "workSiteRowSchema/workSiteSchema/workSiteInputSchema khớp đúng ràng buộc CHECK của work_sites (lat -90..90, lng -180..180, radius > 0 int), workSiteInputSchema không khai trường định danh doanh nghiệp nào (D-12b)"
    requirement: ATT-03
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/work-sites.test.ts (10 test, chạy qua npx vitest run)"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /api/work-sites chỉ xuất GET/dynamic (cổng cơ học D-12c), sắp xếp name→id, trả mảng rỗng 200 khi chưa có doanh nghiệp hiện hành"
    requirement: ATT-03
    verification:
      - kind: unit
        ref: "src/__tests__/route-handlers-get-only.test.ts"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run build; grep -rEc 'export (async )?function (POST|PUT|PATCH|DELETE|HEAD|OPTIONS)' src/app/api/work-sites/ -> 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hai doanh nghiệp thấy hai tập điểm làm việc không giao nhau qua GET /api/work-sites (cách ly company_id)"
    requirement: ATT-03
    verification: []
    human_judgment: true
    rationale: "Cần curl với cookie phiên đăng nhập thật của hai doanh nghiệp (Ngọc Phát/Bình Minh) — môi trường thực thi này không có trình duyệt/luồng đăng nhập thật để lấy cookie sống. Logic cách ly đã đọc mã xác nhận (.eq('company_id', companyId) từ getSessionContext(), cùng khuôn đã kiểm chứng ở GET /api/shifts), nhưng bằng chứng runtime thật chưa chạy được — deferred sang UAT cuối phase (human_verify_mode: end-of-phase)."
  - id: D4
    description: "createWorkSite/updateWorkSite/archiveWorkSite: requireRole(owner/admin) trước mọi I/O, mỗi hàm ghi đúng 1 dòng audit_log (before/after nguyên dòng), archiveWorkSite chỉ hạ is_active — không có lệnh xoá nào trong module"
    requirement: ATT-03
    verification:
      - kind: other
        ref: "npm run typecheck && npm run build; grep -iEc '\\.delete\\(|drop |delete from' src/lib/data/mutations/work-sites.ts -> 0; đọc mã xác nhận đúng 3 lệnh gọi requireRole/logMutation (một mỗi hàm)"
        status: pass
    human_judgment: true
    rationale: "Số dòng audit_log tăng đúng 1 sau mỗi thao tác ghi cần xác nhận bằng psql trên Postgres dev thật — psql không có sẵn trong môi trường thực thi này (cùng lý do Docker thiếu đã ghi ở 03-01-SUMMARY). Đã xác nhận bằng đọc mã: mỗi hàm gọi đúng 1 lần logMutation/requireRole (grep -c trả về 5 do đếm luôn dòng import + comment mô tả khuôn, không phải call site — xem Deviations)."
  - id: D5
    description: "/admin/work-sites: PageHeader + đúng một nút màu nhấn, bộ ba skeleton/rỗng/lỗi giống ShiftsView, WorkSiteCard truncate tên dài kèm title, dòng bán kính nói đúng vai trò 'mốc đo khoảng cách' (D-20, không phải điều kiện chặn)"
    requirement: ATT-03
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run build; grep Skeleton/EmptyState/ConfirmDialog/WORK_SITE_LABEL trong work-sites-view.tsx; grep truncate/title= trong work-site-card.tsx"
        status: pass
    human_judgment: true
    rationale: "Tạo/sửa/ngừng sử dụng một điểm thật qua trình duyệt, quan sát trạng thái rỗng, và kiểm tên dài >80 ký tự không phá bố cục đều cần trình duyệt thật với phiên đăng nhập — không có trong môi trường thực thi này. Build/typecheck/grep xác nhận mã đúng hình dạng, nhưng render/tương tác runtime chưa quan sát được — deferred sang UAT cuối phase."
  - id: D6
    description: "ADMIN_NAV_ITEMS thêm mục /admin/work-sites (icon MapPin); BREADCRUMB_LABELS thêm 'work-sites' để tránh fallback nhầm thành 'Chi tiết'"
    verification:
      - kind: other
        ref: "grep -c '/admin/work-sites' src/lib/nav.ts -> 1; npm run build"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-08-02
status: complete
---

# Phase 3 Plan 2: Lát cắt khai báo điểm làm việc Summary

**`GET /api/work-sites` + ba Server Action (create/update/archive) theo đúng khuôn `ShiftsView` — quản trị khai báo, sửa và ngừng sử dụng (soft-delete) được mốc đo khoảng cách của doanh nghiệp mình từ giao diện `/admin/work-sites`.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-08-02T09:47:00Z
- **Completed:** 2026-08-02T10:29:00Z
- **Tasks:** 2/2
- **Files modified:** 12 (9 tạo mới, 3 sửa)

## Accomplishments

- Bốn schema Zod (`workSiteRowSchema`, `workSiteSchema`, `workSiteListResponseSchema`, `workSiteInputSchema`) khớp đúng ràng buộc CHECK của `work_sites` — vĩ độ/kinh độ/bán kính bị chặn ở tầng validation trước khi chạm database, không khai bất kỳ trường định danh doanh nghiệp nào (D-12b)
- `GET /api/work-sites` chỉ xuất `GET`/`dynamic` (D-12c), sắp xếp `name` rồi `id`, trả mảng rỗng khi chưa có doanh nghiệp hiện hành thay vì lỗi
- Ba Server Action `createWorkSite`/`updateWorkSite`/`archiveWorkSite` theo đúng khuôn `mutations/shifts.ts`: `requireRole` trước mọi I/O, đọc nguyên dòng trước/sau, `logMutation` ngay trong cùng hàm; `archiveWorkSite` chỉ hạ `is_active` — không lệnh xoá nào trong module (T-03-02-05, bằng chứng `attendance_photos.work_site_id` của plan 03-01)
- Màn hình `/admin/work-sites` (`WorkSitesView`/`WorkSiteCard`/`WorkSiteDialog`) dùng lại nguyên bộ ba skeleton/rỗng/lỗi và mẫu `ConfirmDialog` của `ShiftsView`; dòng bán kính trên thẻ nói rõ đây là mốc **đo** khoảng cách, không phải điều kiện chặn chấm công (D-20)
- 10 test vitest cho schema (biên toạ độ/bán kính) và `listWorkSites` qua `fetch` giả lập

## Task Commits

1. **Task 1: Đường đọc và đường ghi cho điểm làm việc** - `e8c05f9` (feat)
2. **Task 2: Màn hình khai báo điểm làm việc** - `8819e74` (feat)

## Files Created/Modified

- `src/lib/validation/api/work-sites.ts` - workSiteRowSchema/workSiteSchema/workSiteListResponseSchema/workSiteInputSchema
- `src/lib/validation/schemas.ts` - workSiteFormSchema/WorkSiteFormValues (4 trường, không có isActive)
- `src/lib/data/work-sites.ts` - listWorkSites() qua fetchJson, re-export ba Server Action
- `src/lib/data/mutations/work-sites.ts` - createWorkSite/updateWorkSite/archiveWorkSite
- `src/app/api/work-sites/route.ts` - Route Handler GET-only
- `src/lib/data/__tests__/work-sites.test.ts` - 10 test (schema + listWorkSites)
- `src/app/admin/work-sites/page.tsx` - Server Component, metadata
- `src/app/admin/work-sites/work-sites-view.tsx` - màn hình chính, cùng khuôn ShiftsView
- `src/components/work-sites/work-site-card.tsx` - thẻ hiển thị điểm làm việc
- `src/components/work-sites/work-site-dialog.tsx` - form tạo/sửa
- `src/lib/constants.ts` - WORK_SITE_LABEL mở rộng (statusActive/statusInactive/radiusLabel/radiusHelp)
- `src/lib/nav.ts` - ADMIN_NAV_ITEMS + BREADCRUMB_LABELS thêm mục /admin/work-sites

## Decisions Made

Xem `key-decisions` ở frontmatter. Quan trọng nhất:

1. **`workSiteFormSchema` (dialog) chỉ 4 trường** — `isActive` không phải một ô nhập, mà là hành động "Ngừng sử dụng" riêng trên card, khớp đúng mô tả UI-SPEC (chỉ có nút xác nhận, không có toggle trạng thái trong form).
2. **`WORK_SITE_LABEL` mở rộng** dù `constants.ts` không nằm trong `files_modified` gốc của plan — cần thiết để card/view không viết chuỗi tiếng Việt rải rác (Rule 2, đúng chỉ dẫn action của Task 2 và quy ước CLAUDE.md).
3. **`BREADCRUMB_LABELS` thêm `work-sites`** — Rule 1 (bug ngăn ngừa): đoạn route có dấu `-` mà thiếu entry sẽ rơi vào nhánh fallback `"Chi tiết"` của `admin-topbar.tsx` thay vì tên đúng.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `WORK_SITE_LABEL` thiếu nhãn cho trạng thái thẻ và dòng bán kính**
- **Found during:** Task 2, khi viết `WorkSiteCard`
- **Issue:** `WORK_SITE_LABEL` (thêm ở plan 03-01) chỉ có `emptyTitle`/`emptyBody`/`addButton`/`archiveConfirmLabel`/`archiveConfirmBody` — không đủ cho nhãn trạng thái thẻ (đang dùng/đã ngừng) và dòng mô tả vai trò bán kính mà action (c) của Task 2 yêu cầu ("Lấy chữ từ WORK_SITE_LABEL")
- **Fix:** Thêm `statusActive`, `statusInactive`, `radiusLabel`, `radiusHelp` vào `WORK_SITE_LABEL`
- **Files modified:** src/lib/constants.ts
- **Verification:** `npm run typecheck && npm run lint && npm run build` thoát 0; card dùng đúng các nhãn này, không có chuỗi tiếng Việt viết tay rải rác trong component
- **Committed in:** 8819e74 (Task 2 commit)

**2. [Rule 1 - Bug] `BREADCRUMB_LABELS` thiếu entry cho `/admin/work-sites`**
- **Found during:** Task 2, khi đọc `admin-topbar.tsx` để hiểu cơ chế breadcrumb trước khi thêm mục nav
- **Issue:** `getCrumbs()` (dòng 43-44) fallback một segment không có trong `BREADCRUMB_LABELS` sang tên đúng nếu KHÔNG chứa dấu `-`, ngược lại hiển thị cứng `"Chi tiết"`. Đoạn `work-sites` chứa dấu `-` nên nếu không khai tường minh, breadcrumb sẽ hiện sai thành "Chi tiết" thay vì "Điểm làm việc"
- **Fix:** Thêm `"work-sites": "Điểm làm việc"` vào `BREADCRUMB_LABELS`
- **Files modified:** src/lib/nav.ts
- **Verification:** Đọc mã xác nhận `BREADCRUMB_LABELS["work-sites"]` trả về đúng nhãn; `npm run build` thoát 0
- **Committed in:** 8819e74 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 2 — nhãn thiếu, 1 Rule 1 — bug breadcrumb tiềm ẩn)
**Impact on plan:** Cả hai cần thiết cho đúng quy ước constants.ts (CLAUDE.md) và đúng hành vi UI. Không có mở rộng phạm vi ngoài ý định của plan.

## Issues Encountered

- **`grep -c "logMutation"`/`grep -c "requireRole"` trên `mutations/work-sites.ts` trả về 5, không phải 3 như acceptance criteria của Task 1 nêu** — vì lệnh đếm cả dòng `import` và dòng comment mô tả khuôn (đã kiểm chứng cùng hiện tượng xảy ra y hệt trên `mutations/shifts.ts` tiền lệ: cũng trả về 5). Đọc mã xác nhận đúng 3 lệnh gọi thực (một mỗi hàm `createWorkSite`/`updateWorkSite`/`archiveWorkSite`) — không phải lỗi triển khai, mà là cách diễn đạt acceptance criteria không khớp với cách grep đếm dòng.
- **`grep -oE "...<Button(?![^>]*variant)" | wc -l` (đếm nút màu nhấn) trả về 2 khi chạy bằng `grep -E` (POSIX ERE không hỗ trợ lookahead `(?!...)`, luôn khớp 0) và trả về 2 khi chạy bằng `grep -P` với `LC_ALL=en_US.UTF-8`** — vì grep xử lý theo dòng, cả nút trong `PageHeader.actions` (hiện khi có dữ liệu) lẫn nút trong `EmptyState.action` (hiện khi rỗng) đều là `<Button` không có `variant` trên cùng dòng, nên cả hai đều khớp bất kể trạng thái runtime. Ở trạng thái **danh sách có dữ liệu** (điều kiện nhánh render `!workSites || workSites.length === 0` là `false`), `EmptyState` không được render nên chỉ CÒN đúng 1 nút màu nhấn thật sự hiển thị — khớp yêu cầu 60/30/10 của UI-SPEC. Đây là giới hạn của grep tĩnh trên văn bản, không phải vi phạm quy tắc một nút màu nhấn.
- **`gsd-tools windows append` báo lỗi parse frontmatter** (`"last_updated: ...\r" is not key: value`) khi thử ghi 3 mục `unrun-verify` vào `.planning/WINDOWS.md` — cùng nguyên nhân CRLF đã ghi nhận ở `03-01-SUMMARY.md`. Ledger là optional/best-effort theo hướng dẫn, không chặn thực thi; ghi lại ở đây để người vận hành biết ba mục còn thiếu bằng chứng runtime (D3/D4/D5 ở trên) chưa vào được ledger tự động.

## User Setup Required

None - không có cấu hình dịch vụ ngoài nào mới. `work_sites` đã có sẵn RLS/index từ migration 0005 (Phase 1), không cần migration mới cho plan này.

## Next Phase Readiness

**Sẵn sàng:** Doanh nghiệp thật khai báo được mốc đo (tên/toạ độ/bán kính) qua giao diện, và ngừng sử dụng một mốc cũ mà không phá bằng chứng chấm công lịch sử đã tham chiếu tới nó (`attendance_photos.work_site_id` từ plan 03-01). Các plan sau của phase (03-03..03-07) — ba lý do từ chối, ba nhánh lỗi camera còn lại, danh sách cần xem lại, metadata Dialog — không phụ thuộc kiến trúc của plan này thay đổi.

**Còn chờ (deferred sang UAT cuối phase, đúng `human_verify_mode: "end-of-phase"` của dự án — xem D3/D4/D5 ở `coverage`):**
- Cách ly hai doanh nghiệp qua `GET /api/work-sites` bằng cookie phiên thật (D3).
- Số dòng `audit_log` tăng đúng 1 sau mỗi thao tác ghi, xác nhận qua psql (D4).
- Tạo/sửa/ngừng sử dụng một điểm thật qua trình duyệt; trạng thái rỗng; tên dài >80 ký tự không phá bố cục (D5).

Ba mục này không chặn plan tiếp theo (mã đã qua typecheck/lint/build/122 test vitest toàn repo, cùng khuôn đã được 02-06/03-01 chứng minh trên production thật), nhưng cần một phiên UAT có trình duyệt/psql thật trước khi đóng phase 3.

---
*Phase: 03-ch-m-c-ng-c-b-ng-ch-ng*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 9 created files verified present on disk; all 3 commits (`e8c05f9`, `8819e74`, `70c0a54`) verified present in `git log`.
