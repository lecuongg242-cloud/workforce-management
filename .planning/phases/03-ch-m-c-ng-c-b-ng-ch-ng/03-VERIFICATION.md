---
phase: 03-ch-m-c-ng-c-b-ng-ch-ng
verified: 2026-08-02T17:37:42Z
status: human_needed
score: 5/5 roadmap truths verified, 8/8 requirements satisfied
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Camera trực tiếp trên Android thật: bấm Vào ca, xác nhận chỉ mở camera mặt sau, không có đường vào thư viện ảnh (hoặc tuỳ chọn thư viện không xuất hiện dưới bất kỳ hình thức nào)."
    expected: "Chỉ luồng MediaStream trực tiếp; không có input[type=file], không có bộ chọn ảnh nào xuất hiện."
    why_human: "Code không dùng <input type=file> ở bất kỳ đâu (đã xác nhận bằng đọc mã), nhưng hành vi trình duyệt di động thật — đặc biệt Safari iOS, nơi hệ điều hành có thể tự chèn UI chọn ảnh cạnh camera bất kể code — chỉ quan sát được trên thiết bị vật lý thật, không mô phỏng được bằng trình duyệt máy tính (luôn cho chọn webcam ảo)."
  - test: "Camera trực tiếp trên iOS thật, cùng thao tác như trên."
    expected: "Giống Android — chỉ camera mặt sau, không thư viện ảnh."
    why_human: "Cùng lý do — hành vi hệ điều hành thật, không tự động hoá được."
  - test: "Đo thời gian bắt GPS 3 lần tại một văn phòng/nhà xưởng thật, so với mốc chờ 15 giây (giả định RESEARCH.md, chưa từng đo thực địa)."
    expected: "Ghi lại số đo thật; nếu vượt xa 15s cần chỉnh LocationTimeoutError timeout."
    why_human: "Cần GPS chip thật trong môi trường thật (nhà xưởng có thể chặn tín hiệu vệ tinh khác với văn phòng mở); không đo được bằng công cụ tự động."
  - test: "Từ chối quyền camera/vị trí trên thiết bị thật rồi cấp lại qua Cài đặt hệ điều hành."
    expected: "Ứng dụng phục hồi lại được (nút Thử lại hoạt động) mà không cần gỡ/cài lại app."
    why_human: "Luồng cấp quyền hệ điều hành thật (dialog native, Settings app) không mô phỏng được trong môi trường thực thi này."
  - test: "Bật chế độ máy bay trên thiết bị thật ngay giữa lúc gửi bằng chứng chấm công."
    expected: "Báo lỗi network_error đúng, ảnh + toạ độ đã chụp được giữ lại (D-23), gửi lại thành công sau khi có mạng."
    why_human: "Cần điều khiển radio mạng thật của thiết bị; không giả lập được qua HTTP/script."
---

# Phase 3: Chấm công có bằng chứng — Verification Report

**Phase Goal:** Mỗi bản ghi chấm công mang theo bằng chứng kiểm chứng được — ảnh hiện trường chụp tại chỗ, khoảng cách tới điểm làm việc do server đo và ghi lại, giờ do server cấp.
**Verified:** 2026-08-02T17:37:42Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Summary

The application-layer implementation of Phase 3 is real, substantive, and correctly wired — this is not a rubber-stamp of SUMMARY.md claims. I read the actual mutation code, the broker route, the review-list route, the camera component, and the suspicious-punch module, and every ROADMAP success criterion is backed by code that does what it claims. Two critical defects found by `03-REVIEW.md` (CR-01: `checkIn()` silently destroyed a completed shift's checkout evidence on re-invocation; CR-02: a V1 demo component gave any employee an unguarded path to trigger CR-01 against their own real record) are **fixed in the current codebase** (commits `099b50f`, `5061225`) — CR-01's fix is backed by a genuine regression test (`attendance-evidence.test.ts` #16) that asserts `check_out_at`/`worked_minutes`/`early_leave_minutes` are unchanged after the rejected re-check-in, and CR-02's fix is a full deletion of `demo-state-switcher.tsx` and every call site (confirmed via `grep` — zero references remain in `src/`).

The one item genuinely outstanding is **device UAT (Plan 03-07 Task 2)** — never performed, blocked on physical Android/iOS hardware, and explicitly deferred by the project owner on 2026-08-03 with the instruction to close the phase anyway. This is reported honestly below as unresolved human verification, not silently absorbed into a `passed` status. It is the correct reason the status is `human_needed` rather than `passed`.

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin declares work sites (name, coords, radius); server computes distance and records it. Missing photo or outside-shift → server **rejects** with a clear reason; outside-radius → **still accepted** but flagged with a warning + real distance for admin review. | ✓ VERIFIED | `src/lib/data/mutations/attendance.ts:346-351` rejects `missing_photo` before any I/O; `:432-434` rejects `outside_shift`. `writePunchEvidence()` (`:138-293`) always computes distance server-side via `tf_distance_meters()` RPC and never throws on distance — `isOutsideRadius` (`:186-190`) only sets a flag, matching D-20a. `src/app/api/work-sites/route.ts` + `src/lib/data/mutations/work-sites.ts` implement create/update/archive gated `requireRole(["owner","admin"])`. |
| 2 | Camera-only capture, no file/gallery picker; missing photo blocks submit. | ✓ VERIFIED | `src/components/employee-app/camera-sheet.tsx` — no `<input type="file">` anywhere in `src/` (confirmed via grep across the whole tree); capture is exclusively `captureFrame()` from a live `MediaStream` via canvas. Submit button is `disabled={... || !photoBlob || !coords}` (line 668). |
| 3 | Timestamp on the record is server time — device clock changes cannot change it. | ✓ VERIFIED | `checkIn()`/`checkOut()` both call `supabase.rpc("tf_server_now")` (`:358`, `:623`) and use the returned value as `check_in_at`/`check_out_at`. No `new Date()`/`Date.now()` call anywhere in the write path reads a client-supplied instant (module comment at `:296-317` documents this explicitly; the one `new Date(` in the file is `addMinutesToInstant`, pure epoch arithmetic on server-returned values). |
| 4 | Admin opens any attendance record, sees photo + location; photo only via a broker route that self-checks the company **on every call**; company B holding the exact link still can't view. | ✓ VERIFIED | `src/app/api/attendance-photos/[id]/route.ts` does `.eq("company_id", companyId)` from `getSessionContext()` on every GET (no signed URL, no cache — `cache-control: private, no-store`), returns 404 for cross-company (indistinguishable from "id doesn't exist"), `requireRole(["owner","admin"])` for role. **Independently confirmed by the orchestrator's real HTTP run** (`npm run test:e2e-photo`, 8/8 pass including the literal "company B gets 404" assertion) — not just static code reading. |
| 5 | A punch far from the work-site center (configurable threshold, default 5× radius) is flagged suspicious and shows in the admin review list. | ✓ VERIFIED | `src/lib/attendance/suspicious.ts` — single-owner `isSuspiciousPunch()` (5× multiplier, `canCheckInRemotely` opt-out, null-safe). `src/app/api/attendance/review/route.ts` recomputes suspicion **at query time** (not from a stored boolean) using the same function, scoped `.eq("company_id", companyId)`, `requireRole` gated. `src/app/admin/attendance/review/attendance-review-view.tsx` renders the list wired to this route, opens the same `AttendancePhotoDialog` used for ATT-04. |

**Score:** 5/5 truths verified, 0 present-but-behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/data/mutations/attendance.ts` | `checkIn`/`checkOut` with server-authoritative time, distance, photo evidence | ✓ VERIFIED | Substantive, wired into Camera Sheet flow; CR-01 fix present (`:475-477`) with regression test. |
| `src/components/employee-app/camera-sheet.tsx` | Camera-only capture UI with 4 error branches + rejection/flagged banners | ✓ VERIFIED | All branches present: permission-denied, no-camera, camera-in-use, location-denied, GPS-timeout, 3 rejection reasons, outside-radius acknowledgment banner. |
| `src/app/api/attendance-photos/[id]/route.ts` | Broker route, no signed URL, per-call company check | ✓ VERIFIED | Confirmed by code + real HTTP e2e run (orchestrator). |
| `src/app/api/work-sites/route.ts` + `mutations/work-sites.ts` | Admin CRUD for work sites | ✓ VERIFIED (GET has open WR-01, see Anti-Patterns) | Write paths correctly gated; GET route missing role gate — known, owner-accepted. |
| `src/lib/attendance/suspicious.ts` | Single source of suspicious-punch threshold/logic | ✓ VERIFIED | Pure module, imported by mutation (banner) and review route (list) — one source, matches D-21 intent. |
| `src/app/api/attendance/review/route.ts` + `attendance-review-view.tsx` | Admin "needs review" list (ATT-07) | ✓ VERIFIED | Computed at query time, scoped, gated, wired to UI. |
| `src/components/attendance/attendance-photo-dialog.tsx` | Admin photo + location review dialog (ATT-04) | ✓ VERIFIED | Renders both legs, distance+accuracy paired, map link, mark-reviewed action wired to `markPhotoReviewed`. |
| `src/components/employee-app/demo-state-switcher.tsx` | — (should NOT exist) | ✓ REMOVED | CR-02 fix confirmed: file deleted, zero references anywhere in `src/` (grep). |
| `scripts/e2e-photo.mjs`, `src/__tests__/no-signed-url.test.ts`, `supabase/migrations/0012_attendance_photo_storage_rls.sql` | Phase-closing gates (03-07) | ✓ VERIFIED | All three files exist on disk; `npm run test:e2e-photo` wired in `package.json`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `camera-sheet.tsx` | `checkIn`/`checkOut` Server Actions | `onSubmit` prop → `checkInService`/`checkOutService` | ✓ WIRED | Submit disabled until photo+coords present; result routes to flagged-banner or rejection-overlay based on real server response. |
| `attendance-review-view.tsx` | `GET /api/attendance/review` | `listAttendanceReview()` via `useDataQuery` | ✓ WIRED | Confirmed data fetch + render, empty state handled. |
| `attendance-review-view.tsx` | `AttendancePhotoDialog` | shared component, `attendanceRecordId` state | ✓ WIRED | Same dialog used by both ATT-04 (direct) and ATT-07 (from review list) paths, per plan's own key_links intent. |
| `attendance-photo-dialog.tsx` `<img>` | `GET /api/attendance-photos/[id]` broker route | `src="/api/attendance-photos/{id}"` | ✓ WIRED | No signed URL string anywhere in the component. |
| `work-sites-view.tsx` | `createWorkSite`/`updateWorkSite`/`archiveWorkSite` | direct Server Action calls + `invalidate()` | ✓ WIRED | Confirmed create/edit/archive round-trip with toast + reload. |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| ATT-01 | 03-01, 03-03, 03-04 | Camera-required punch, no gallery picker | ✓ SATISFIED | `camera-sheet.tsx`, no file input anywhere in repo |
| ATT-02 | 03-01, 03-04 | GPS mandatory, server computes distance, out-of-radius not blocking | ✓ SATISFIED | `writePunchEvidence()`, `isOutsideRadius` flag not a rejection branch |
| ATT-03 | 03-02 | Admin declares work sites (name, coords, radius) | ✓ SATISFIED | `work-sites-view.tsx` + Route Handler/Server Actions |
| ATT-04 | 03-01, 03-05 | Admin reviews photo + location of any record | ✓ SATISFIED | `AttendancePhotoDialog`, `requireRole` on broker route |
| ATT-05 | 03-01, 03-05, 03-07 | Private bucket, per-call broker (not signed URL) | ✓ SATISFIED | Broker route + `no-signed-url.test.ts` gate + real HTTP e2e (orchestrator, 8/8 pass) |
| ATT-06 | 03-01, 03-04 | Server-issued timestamp, not device clock | ✓ SATISFIED | `tf_server_now()` RPC used exclusively |
| ATT-07 | 03-06 | Suspicious-distance flagging (5× radius default), admin review list | ✓ SATISFIED | `suspicious.ts`, `attendance/review` route + view |
| ATT-08 | 03-03, 03-04 | Employee sees clear rejection reasons + outside-radius warning with real distance | ✓ SATISFIED | `ATTENDANCE_REJECTION_LABEL`, flagged banner in `camera-sheet.tsx` |

No orphaned requirements — all 8 ATT-* IDs declared across the 7 plans are accounted for and match `REQUIREMENTS.md`'s traceability table (already marked "Complete" there, and independently confirmed here against actual code, not just re-trusted).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/work-sites/route.ts` | 45-49 | `GET` has no `requireRole` gate (WR-01, `03-REVIEW.md`) | ⚠️ Warning (owner-accepted, non-blocking) | Any authenticated member (employee/manager) can enumerate work-site coordinates+radius, not just owner/admin. Confirmed still open in code. |
| `supabase/migrations/0012_attendance_photo_storage_rls.sql` | — | Storage RLS fix (WR-02) has no automated CI gate — only `scripts/e2e-photo.mjs`, a manual script | ⚠️ Warning (owner-accepted, non-blocking) | If migration 0012 is ever reverted/skipped, `npm test`/pgTAP would not catch it — only a human remembering to run `test:e2e-photo`. |
| `src/lib/data/mutations/attendance.ts` | 196-273 (`writePunchEvidence`) | Orphaned Storage objects accumulate on photo retry/resubmit (WR-03) | ⚠️ Warning (owner-accepted, non-blocking) | Every "Gửi lại" retry or checkout-resubmit leaves the previous JPEG in the bucket forever — no cleanup job in V2 (documented trade-off). |
| `src/lib/data/__tests__/attendance-evidence.test.ts` | fixture window ±30 min around wall-clock | Test constructs shift window relative to current time; between 23:30–00:30 local it becomes an overnight shift and 11 tests fail | ℹ️ Info — pre-existing CI time bomb, not introduced by this phase (confirmed via baseline comparison in `03-07-SUMMARY.md`) | A CI job running in that window will go red with no code regression — flagged here so it isn't rediscovered as a false alarm later. |

None of these four items block the phase goal — evidence-of-attendance (photo, GPS distance, server timestamp) works end-to-end and is cross-tenant isolated. All three warnings were explicitly reviewed and knowingly left open by the project owner per `03-07-SUMMARY.md` §"Cập nhật 2026-08-03". They are recorded here rather than silently dropped.

### Human Verification Required

**Device UAT (Plan 03-07, Task 2) — never performed, explicitly deferred by the project owner on 2026-08-03.** This is not a code gap; it requires physical Android and iOS hardware that isn't available in this execution environment. The outstanding scenarios are already numbered and documented in `docs/HUONG-DAN-TEST.md` §3.9.4 (steps 51–55) so they aren't lost. Listed in the frontmatter `human_verification` block above; summarized:

1. **Camera on real Android** — confirm only rear camera opens, no gallery/library access path exists under any circumstance.
2. **Camera on real iOS** — same confirmation; iOS Safari is the higher-risk platform because the OS can inject a photo-library picker next to the camera view regardless of what the web code does (code review already flagged this; only a real device settles it).
3. **GPS acquisition timing** — 3 real-world measurements at an actual workplace against the untested 15-second timeout assumption from RESEARCH.md.
4. **Permission denial + re-grant recovery** — real OS permission dialogs, not simulable.
5. **Airplane-mode-mid-submit** — real network radio control, not simulable via script/HTTP.

None of these are simulable in a browser dev-tools environment (which always offers a virtual webcam and doesn't reproduce OS-level permission or radio behavior), which is exactly why they were scoped out of automation from the start (03-07-PLAN.md Task 2, `checkpoint:human-verify`, `gate=blocking`).

### Gaps Summary

No blocking gaps found. Every ROADMAP success criterion for Phase 3 is backed by real, wired, substantive code — not stubs or placeholders. The two critical defects surfaced by code review (CR-01, CR-02) are genuinely fixed with a regression test, not just claimed fixed. The three warnings (WR-01/02/03) are real, still open, and were knowingly accepted by the project owner rather than silently ignored — they're recorded here as non-blocking technical debt for future attention, not hidden.

The reason this report is **not** `passed` is the outstanding device UAT (Task 2), which was never executed and cannot be executed in this environment. The project owner made an informed decision on 2026-08-03 to close the phase without it and do device UAT independently later — that decision is respected here, but the verifier's job is to report the true state, not paper over it. `human_needed` is the honest status: the automated/code-level portion of the phase goal is fully achieved; the physical-device portion is deferred, tracked, and outstanding.

---

_Verified: 2026-08-02T17:37:42Z_
_Verifier: Claude (gsd-verifier)_
