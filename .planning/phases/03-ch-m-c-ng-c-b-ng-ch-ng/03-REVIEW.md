---
phase: 03-ch-m-c-ng-c-b-ng-ch-ng
reviewed: 2026-08-02T00:00:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - next.config.ts
  - package.json
  - scripts/check-pgtap-assertions.mjs
  - scripts/e2e-photo.mjs
  - scripts/storage-bucket.mjs
  - src/__tests__/no-signed-url.test.ts
  - src/app/admin/attendance/review/attendance-review-view.tsx
  - src/app/admin/attendance/review/page.tsx
  - src/app/admin/employees/[id]/employee-detail-view.tsx
  - src/app/admin/work-sites/page.tsx
  - src/app/admin/work-sites/work-sites-view.tsx
  - src/app/api/attendance-photos/[id]/__tests__/route.test.ts
  - src/app/api/attendance-photos/[id]/route.ts
  - src/app/api/attendance-photos/route.ts
  - src/app/api/attendance/review/route.ts
  - src/app/api/work-sites/route.ts
  - src/app/employee/employee-home-view.tsx
  - src/components/attendance/attendance-photo-dialog.tsx
  - src/components/employee-app/__tests__/camera-sheet.test.tsx
  - src/components/employee-app/attendance-status-card.tsx
  - src/components/employee-app/camera-sheet.tsx
  - src/components/employee-app/demo-state-switcher.tsx
  - src/components/work-sites/work-site-card.tsx
  - src/components/work-sites/work-site-dialog.tsx
  - src/lib/attendance/__tests__/camera.test.ts
  - src/lib/attendance/__tests__/suspicious.test.ts
  - src/lib/attendance/camera.ts
  - src/lib/attendance/rejection.ts
  - src/lib/attendance/suspicious.ts
  - src/lib/auth/session-context.ts
  - src/lib/constants.ts
  - src/lib/data/__tests__/attendance-evidence.test.ts
  - src/lib/data/__tests__/attendance-photos.test.ts
  - src/lib/data/__tests__/attendance-review.test.ts
  - src/lib/data/__tests__/work-sites.test.ts
  - src/lib/data/attendance-photos.ts
  - src/lib/data/attendance-review.ts
  - src/lib/data/attendance.ts
  - src/lib/data/fetch-json.ts
  - src/lib/data/mutations/attendance-photos.ts
  - src/lib/data/mutations/attendance.ts
  - src/lib/data/mutations/work-sites.ts
  - src/lib/data/work-sites.ts
  - src/lib/nav.ts
  - src/lib/storage/attendance-photos.ts
  - src/lib/types/domain.ts
  - src/lib/validation/api/attendance-photos.ts
  - src/lib/validation/api/attendance-review.ts
  - src/lib/validation/api/work-sites.ts
  - src/lib/validation/schemas.ts
  - supabase/migrations/0011_attendance_evidence.sql
  - supabase/migrations/0012_attendance_photo_storage_rls.sql
  - supabase/seed.sql
  - supabase/tests/09_attendance_evidence.sql
  - supabase/tests/run-all.sql
  - vitest.config.mts
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 44 (from the supplied `<required_reading>` list; two extra files read for necessary context — `src/lib/auth/session-context.ts` and `src/components/employee-app/demo-state-switcher.tsx` — are included above since findings depend on them)
**Status:** issues_found

## Summary

The cross-tenant isolation work in this phase is careful and consistently defended: every Route Handler and Server Action scopes reads/writes with `.eq("company_id", ...)` sourced exclusively from `getSessionContext()`, never from a client parameter, and the broker photo route/RLS storage fix (migration 0012) closes the one gap this phase itself found. Tests genuinely exercise the app-layer scoping logic (`attendance-photos.test.ts`, `attendance-review.test.ts`, `work-sites.test.ts` assert the literal `.eq("company_id", <session value>)` calls against fully mocked query chains — no real DB, nothing to bypass). Server-authoritative time (`tf_server_now()`) and distance (`tf_distance_meters()`) are used throughout `mutations/attendance.ts`; no client-supplied timestamp or distance value is ever trusted.

However, two real defects were found, both independent of cross-tenant isolation:

1. `checkIn()` silently **destroys a completed shift's checkout data** (`check_out_at`, `worked_minutes`, `early_leave_minutes`) whenever it is invoked a second time for a (employee, work_date, shift) that has already been checked out — there is no guard against re-checking-in over a finished record.
2. That defect is live-reachable in production today through `DemoStateSwitcher`, a V1 mock-era component that is still imported and rendered unconditionally in the real `employee-home-view.tsx`, despite its own comment stating it must be deleted once the backend is connected (which this milestone explicitly is). Any signed-in employee can use it to force the displayed state to "Chưa vào ca" and tap the real "Vào ca" button, triggering defect (1) against their own genuine attendance row.

Three further items are flagged as warnings: a missing role gate on `GET /api/work-sites`, a coverage gap where the exact defect class already found once in this phase (missing `storage.objects` RLS) has no automated regression test, and unbounded orphaned Storage objects on photo re-submission.

## Critical Issues

### CR-01: `checkIn()` wipes an already-completed checkout when called again for the same shift

**File:** `src/lib/data/mutations/attendance.ts:454-515` (specifically the unconditional `writeRow` at lines 466-476 applied via `.update(writeRow)` at lines 482-491)

**Issue:** `checkIn()` looks up an existing `attendance_records` row by `(employee_id, work_date, shift_id, company_id)` and, if found, applies:

```ts
const writeRow = {
  check_in_at: nowIso,
  check_out_at: null,
  worked_minutes: 0,
  late_minutes: lateMinutes,
  early_leave_minutes: 0,
  status,
  location: employeeRow.work_location as string,
  needs_supplement: false,
  note: null,
};
```

unconditionally — there is no check of `existing.check_out_at`. If the employee already completed check-in **and** check-out for the day (a finished shift), calling `checkIn()` again for that same `(employee_id, work_date, shift_id)` overwrites `check_in_at` with a fresh timestamp and resets `check_out_at` to `null`, `worked_minutes` to `0`, and `early_leave_minutes` to `0` — silently destroying the record of a completed shift. The corresponding `check_out` photo row in `attendance_photos` is *not* deleted, so the review UI would show checkout evidence for a record whose `attendance_records` row now claims the shift never ended — an inconsistent, incorrect state that would also undercount hours in `getMonthlySummary` (the payroll-prep data this milestone exists to make trustworthy). No test in `attendance-evidence.test.ts` covers "checkIn called again after checkout already happened."

**Fix:** Reject (or branch away from a destructive update) when the existing row already has a non-null `check_out_at`:

```ts
if (existing && (existing as RawAttendanceRow).check_out_at) {
  throw new Error("Ca làm hôm nay đã kết thúc, không thể vào ca lại.");
  // or: create a fresh audit trail / require an explicit admin override,
  // but never blindly null out check_out_at/worked_minutes.
}
```

### CR-02: V1 demo/test state switcher still live in production employee UI — direct trigger for CR-01

**File:** `src/components/employee-app/demo-state-switcher.tsx:9-14`, wired in `src/app/employee/employee-home-view.tsx:29,57,88,262`

**Issue:** `DemoStateSwitcher`'s own comment says:

```
Day KHONG phai chuc nang danh cho nguoi dung cuoi. Khi ket noi backend that,
chi can xoa component nay va lenh goi no trong `employee-home-view.tsx`.
```

("Not an end-user feature. Once the real backend is connected, just delete this component and its call site.") This milestone (V2) is exactly "connecting the real backend," and Phase 3 built real, server-authoritative check-in/check-out on top of it — yet `EmployeeHomeView` still imports and unconditionally renders `<DemoStateSwitcher value={demoState} onChange={setDemoState} />` for every real employee, with no environment gate (`process.env.NODE_ENV`, a feature flag, a role check — nothing).

Setting `demoState` only changes what is *displayed* (`state`/`displayRecord`), but the "Vào ca" button it exposes is wired to the real `handleOpenCamera` → real `checkInService(employeeId, evidence)` Server Action, using the session's real `employeeId`. Concretely: an employee who has already finished today's shift can tap "Chưa vào ca" in "Chế độ xem thử", which makes the real "Vào ca" button reappear; tapping it opens the real Camera Sheet and submits a real `checkIn()` call — reaching CR-01 and destroying their own completed shift's checkout data. This requires no special privilege, no tooling, and no malicious intent — just curiosity about a visibly-present UI control.

**Fix:** Remove `DemoStateSwitcher` and its call site from `employee-home-view.tsx` now that the real backend is wired up, per the component's own instruction. If a "preview mode" is still wanted for QA, gate it behind a build-time flag (e.g. `process.env.NODE_ENV !== "production"`) so it can never render for real employees, and independently fix CR-01 so that even a forced client display state cannot cause a destructive server write.

## Warnings

### WR-01: `GET /api/work-sites` has no role gate, unlike its own mutations and sibling GET routes

**File:** `src/app/api/work-sites/route.ts:45-49`

**Issue:** Every other admin-configuration GET route reviewed in this phase requires `owner`/`admin` (`GET /api/attendance-photos` line 36, `GET /api/attendance/review` line 86), and `work-sites`' own mutations (`createWorkSite`, `updateWorkSite`, `archiveWorkSite` in `src/lib/data/mutations/work-sites.ts`) all call `requireRole(role, ["owner", "admin"])`. But `GET /api/work-sites` only calls `getSessionContext()` — any authenticated member of the company (including plain `employee`/`manager` roles) can enumerate the full list of configured work sites (id, name, coordinates, radius, active flag, createdAt), including inactive/archived ones, which the admin "Điểm làm việc" screen is otherwise gated to owner/admin via its write operations.

**Fix:** Add `requireRole(role, ["owner", "admin"])` to `GET` in `src/app/api/work-sites/route.ts`, consistent with the sibling routes and the module's own mutations — unless there's a deliberate product decision that all roles should be able to read (but not write) the work-site list, in which case that should be documented at the route the way `D-12b`/role-scoping decisions are documented elsewhere in this codebase.

### WR-02: The exact defect class already found once in this phase (missing `storage.objects` RLS) has no automated regression test

**File:** `supabase/migrations/0012_attendance_photo_storage_rls.sql`, `src/app/api/attendance-photos/[id]/__tests__/route.test.ts:27-38`, `src/lib/data/__tests__/attendance-evidence.test.ts:29-38`, `scripts/e2e-photo.mjs`

**Issue:** Migration 0012 documents, correctly, that the storage RLS gap it fixes was invisible to every automated test because `route.test.ts` and `attendance-evidence.test.ts` both mock `createServerSupabase()` to return a `SUPABASE_SECRET_KEY` client that bypasses RLS entirely (deliberately, to isolate the app-layer `.eq("company_id", ...)` logic), and pgTAP cannot cover schema `storage` at all in CI (`0001_supabase_compat.sql` only stubs `auth`). The only thing in the repo that actually exercises the `storage.objects` RLS policies added by migration 0012 is `scripts/e2e-photo.mjs`, invoked via `npm run test:e2e-photo` — a manual script requiring a running dev server and human-supplied real admin credentials for two companies, not part of `npm test` (vitest), `check:assertions` (pgTAP), or any automated gate visible in the reviewed files.

This means the same blind spot the task description asked to look for is still present, one layer up: the *fix* for the previously-hidden RLS gap is itself only verified manually. If a future change accidentally reverts/omits migration 0012 (e.g. a fresh environment where `db:bucket`/migrations are applied out of order, or someone "simplifies" the storage policies), no `npm test` or CI-run pgTAP suite would catch it — only a human remembering to run `test:e2e-photo` with two real company accounts would notice.

**Fix:** At minimum, wire `test:e2e-photo` into CI against a real (non-production) Supabase project, or add a lightweight automated check that asserts `storage.objects` policies exist for the `attendance-photos` bucket (e.g. via `pg_policies` introspection) run against the dev Postgres these integration tests already connect to, so a regression is caught by `npm test` rather than relying on manual execution.

### WR-03: Orphaned Storage objects accumulate on every photo re-submission

**File:** `src/lib/data/mutations/attendance.ts:196-273` (`writePunchEvidence`), `src/lib/storage/attendance-photos.ts:49-55`

**Issue:** `writePunchEvidence()` always generates a brand-new `randomUUID()` and a brand-new storage path (`buildAttendancePhotoPath(...)`), then uploads with `upsert: false` (line ~204-209), even in the branch where an `attendance_photos` row already exists for `(attendance_record_id, kind)` and is merely updated to point at the new path (lines 242-254). The object at the *previous* `storage_path` is never deleted. This isn't only the general "no aging-cleanup job in V2" trade-off already documented in `storage/attendance-photos.ts` — it fires on the explicitly-supported "Gửi lại" (retry-after-network-error) UX (D-23, tested in `camera-sheet.test.tsx` #13), and on the tested "tan ca lần thứ hai" re-submit flow (`attendance-evidence.test.ts` #9/#10): each retry/resubmission leaves one more unreferenced JPEG in the bucket forever.

**Fix:** Either reuse the same storage path for an update (`upsert: true` against the *existing* row's stored path) so there is at most one live object per `(record, kind)`, or explicitly delete the previous `storage_path` from Storage after a successful DB update in the `existingPhoto` branch.

## Info

### IN-01: Duplicated `capturedAtFormatter`/`formatCapturedAt` between two components

**File:** `src/components/attendance/attendance-photo-dialog.tsx:54-66` and `src/app/admin/attendance/review/attendance-review-view.tsx:50-62`

**Issue:** Both files independently define an identical `Intl.DateTimeFormat("vi-VN", { timeZone: DEFAULT_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })` and an identical `formatCapturedAt()` wrapper. Per the project's own `formatDate`/`formatTime` convention (`src/lib/format.ts`), this should be a single shared export.

**Fix:** Extract one `formatCapturedAt` (or a more general `formatDateTime`) into `src/lib/format.ts` and import it from both components.

---

_Reviewed: 2026-08-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
