---
phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p
plan: 02
subsystem: database
tags: [postgres, supabase, pgtap, timezone, enum, multi-tenant]

# Dependency graph
requires:
  - phase: 01-01
    provides: "supabase/ project (config.toml, linked to ujvgagujfsdrlmjdhooi), scripts/db.mjs runner, pgTAP harness (helpers.sql, run-all.sql), companies/memberships tables"
provides:
  - "9 remaining business enum types matching src/lib/types/domain.ts verbatim (employee_status, contract_type, gender, attendance_status, request_type, request_status, system_role, department_status, shift_status) — 13 total with the 4 from 0002_tenancy.sql"
  - "public.tf_tz() — the single hardcoded timezone constant (Asia/Ho_Chi_Minh) for the whole system"
  - "public.tf_work_date(timestamptz) — D-08 overnight-shift-to-start-date convention, timezone-session-independent"
  - "public.tf_overnight(time, time) — start/end shift-time overnight predicate"
  - "public.tf_shift_minutes(time, time, int) — SQL port of src/lib/format.ts minutesBetween, equal-times returns 0 not 1440"
  - "public.tf_worked_minutes(timestamptz, timestamptz, int) — actual worked-minutes from check-in/check-out, NULL-safe (returns 0, never errors)"
  - "supabase/tests/02_time_overnight.sql — 53-assertion pgTAP suite, 51 of which run identically under 3 session timezones"
affects: [01-04, 01-05, 01-06]

actuals:
  tokens: 4310
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Single timezone constant pattern: tf_tz() is the only place Asia/Ho_Chi_Minh is hardcoded; every other function/query calls it instead of writing an offset"
    - "NULL-safe time-math functions: tf_worked_minutes returns 0 on NULL inputs instead of raising, matching real attendance data (missing checkout) vs. in-memory V1 seed which never had NULLs"
    - "pgTAP repeat-under-session-timezone pattern: same assertion list run 3x after `set timezone to X`, tz named literally in every assertion description so a red run identifies which timezone broke it"

key-files:
  created:
    - supabase/migrations/0003_enums_time.sql
    - supabase/tests/02_time_overnight.sql
  modified:
    - supabase/tests/run-all.sql

key-decisions:
  - "D-08 checkpoint answered: confirm-start-date. An overnight shift (22:00 D -> 06:00 D+1) is credited entirely to work_date = D. end-date and split-by-day were explicitly rejected by the user, who saw the one-way cost (migration to recompute every historical work_date, prior exports becoming unreconcilable, downstream periods/dashboard aggregates needing re-validation) and chose to proceed."
  - "Scoped the 'no enum value is a Vietnamese label' pgTAP assertion to schema public after discovering Supabase's own storage.buckettype (STANDARD/ANALYTICS/VECTOR) and audit action (INSERT/UPDATE/DELETE/TRUNCATE/ERROR) enums live in this shared dev project and tripped an unscoped catalog-wide regex scan — those are Supabase system types, not TimeFlow domain enums, and are outside this plan's scope to touch."
  - "tf_shift_minutes computes minute-of-day via extract(hour)*60 + extract(minute) rather than `time + interval '24 hours'` for the overnight branch, because Postgres wraps time+interval arithmetic modulo 24h, which would silently defeat the +1440 adjustment needed for the qua-dem case."

patterns-established:
  - "Five tf_* time functions are now the ONLY place shift/attendance time math happens in Postgres; attendance_records (01-04) and periods (01-05) call these rather than re-deriving offsets."

requirements-completed: [DATA-01, DATA-07]

coverage:
  - id: D1
    description: "22:00->06:00 shift computes 480 minutes via tf_shift_minutes, and the result is identical under SET timezone to UTC, Asia/Ho_Chi_Minh, and America/New_York"
    requirement: "DATA-07"
    verification:
      - kind: integration
        ref: "npm run test:rls (supabase/tests/02_time_overnight.sql assertions 1, 18, 35 — tz=UTC/Asia-Ho_Chi_Minh/America-New_York) -> pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "An overnight shift is credited to the shift's START date via tf_work_date(timestamptz), independent of server session timezone (D-08)"
    requirement: "DATA-07"
    verification:
      - kind: integration
        ref: "npm run test:rls (assertions 12/29/46 — tf_work_date of 22:00 VN moment across 3 session timezones, all -> 2026-03-15) -> pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "Midnight-boundary and zero-length edge cases are deterministic: 22:00->00:00 = 120min, 00:00->08:00 = 480min, two adjacent shifts sum to 960 with no gap/overlap, equal start=end returns 0 not 1440"
    requirement: "DATA-07"
    verification:
      - kind: integration
        ref: "npm run test:rls (assertions 5-8/22-25/39-42) -> pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "tf_worked_minutes returns 0 (never errors, never negative) for any NULL combination of check_in/check_out"
    requirement: "DATA-07"
    verification:
      - kind: integration
        ref: "npm run test:rls (assertions 14-16/31-33/48-50) -> pass"
        status: pass
    human_judgment: false
  - id: D5
    description: "All 9 remaining domain.ts enum types exist in Postgres with values copied verbatim (English); 13 total enum types in schema public; system_role and company_role kept as two distinct enum types"
    requirement: "DATA-01"
    verification:
      - kind: integration
        ref: "npm run test:rls (assertion 52: count of the 13 named types = 13; assertion 53: 0 public-schema enum labels contain non-ASCII-lowercase/digit/underscore/plus/hyphen chars) -> pass"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-31
status: complete
---

# Phase 1 Plan 2: UTC+7 Time Convention and Business Enums Summary

**Five `tf_*` SQL functions encoding the D-08 overnight-shift-credited-to-start-date convention (a timezone-session-independent SQL port of `src/lib/format.ts`'s `minutesBetween`/`isOvernight`), plus the 9 remaining `domain.ts` enum types — proven by 53 pgTAP assertions, 51 of which repeat identically under three different Postgres session timezones.**

## Performance

- **Duration:** 10 min (Task 2 only — Task 1 was a checkpoint awaiting the user's D-08 decision across a separate session)
- **Started:** 2026-07-31T19:54:00Z (Task 2 resumed after checkpoint answer)
- **Completed:** 2026-07-31T20:04:23Z
- **Tasks:** 2 (Task 1: checkpoint:decision, Task 2: auto/tdd)
- **Files modified:** 3

## Accomplishments
- Confirmed D-08 (checkpoint) — overnight shifts are credited entirely to the shift's start date, one-way, no per-company configuration
- `public.tf_tz()`, `tf_work_date()`, `tf_overnight()`, `tf_shift_minutes()`, `tf_worked_minutes()` — the single, only place time-zone/overnight math happens in the schema going forward
- 9 remaining business enum types landed verbatim from `domain.ts`, bringing the schema to 13 enum types total
- 53-assertion pgTAP suite (`02_time_overnight.sql`), including the exact 8 edge cases named in the plan's `<behavior>` block, each run under `UTC`, `Asia/Ho_Chi_Minh`, and `America/New_York` session timezones with the timezone named in every assertion description

## Task Commits

Each task was committed atomically:

1. **Task 1: Xác nhận cánh cửa một chiều — D-08** - checkpoint:decision, no code commit (decision recorded below)
2. **Task 2: Enum nghiệp vụ + hàm quy ước thời gian** - TDD, two commits:
   - `37001c5` (test) — RED: 51-assertion (later expanded to 53) pgTAP test file, confirmed failing with `function public.tf_shift_minutes(...) does not exist`
   - `12fe556` (feat) — GREEN: migration with 9 enums + 5 `tf_*` functions; `npm run test:rls` and `npm run test:db` both exit 0, 79/79 total suite assertions pass

## TDD Gate Compliance

RED gate (`37001c5`, `test(01-02): ...`) precedes GREEN gate (`12fe556`, `feat(01-02): ...`) in git log — both present, sequence correct. No REFACTOR commit was needed; the migration passed on first implementation attempt with no cleanup required after GREEN.

## Files Created/Modified
- `supabase/migrations/0003_enums_time.sql` - 9 enum types (employee_status, contract_type, gender, attendance_status, request_type, request_status, system_role, department_status, shift_status) + 5 `tf_*` time functions, all `immutable`, all in schema `public`
- `supabase/tests/02_time_overnight.sql` - 53 pgTAP assertions: 17 behavior assertions x 3 session timezones (51) + 2 enum-integrity assertions (13-type count, no-Vietnamese-label scoped to schema public)
- `supabase/tests/run-all.sql` - registered `\ir 02_time_overnight.sql`

## Decisions Made
- **D-08 confirmed via checkpoint:** `confirm-start-date` — overnight shift credited entirely to the shift's start date. Options `end-date` and `split-by-day` were explicitly rejected. The user saw and accepted the one-way cost (a future migration recomputing every historical `work_date`, prior exports becoming unreconcilable against the recomputed data, downstream `periods`/dashboard aggregates needing re-validation) before proceeding.
- **Enum-label assertion scoped to `public` schema** — the plan's literal acceptance-criteria query (`select count(*) from pg_enum e join pg_type t ... where e.enumlabel ~ '[^a-z0-9_+-]'`, unscoped) returned 8 on this real Supabase dev project, not because of a Vietnamese label but because Supabase's own `storage.buckettype` (`STANDARD`/`ANALYTICS`/`VECTOR`) and audit `action` (`INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/`ERROR`) enums live in the same catalog. These are Supabase system types outside `public` and outside this plan's scope — scoping the assertion to `nspname = 'public'` implements the plan's actual intent (no TimeFlow domain enum has a Vietnamese label) without being tripped by pre-existing system types.
- **`tf_shift_minutes` overnight branch uses `extract(hour)*60 + extract(minute)` arithmetic, not `time + interval '24 hours'`** — Postgres wraps `time + interval` arithmetic modulo 24 hours, which would silently cancel the `+1440` adjustment the overnight case needs. Verified against all 8 named edge cases including the two-adjacent-shifts-sum-to-960 case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unscoped enum-label regex assertion false-positived on Supabase system enums**
- **Found during:** Task 2, first GREEN `npm run test:rls` run after the migration landed
- **Issue:** The plan's acceptance-criteria query for "no enum value is a Vietnamese label" scans the entire `pg_enum`/`pg_type` catalog with no schema filter. On this project that catalog also contains Supabase's own `storage.buckettype` and audit `action` enums with UPPERCASE labels, which are not Vietnamese but do contain characters outside `[a-z0-9_+-]`, so the unscoped query returned 8 instead of 0.
- **Fix:** Added a `join pg_namespace n on n.oid = t.typnamespace` and `where n.nspname = 'public'` filter, scoping the assertion to TimeFlow's own domain enums.
- **Files modified:** supabase/tests/02_time_overnight.sql
- **Verification:** Re-ran `npm run test:rls` — assertion now passes (0 violators in `public`), diagnosed via a temporary `diag()` call that printed the actual violator names (`buckettype.STANDARD`, `buckettype.ANALYTICS`, `buckettype.VECTOR`, `action.INSERT`, `action.UPDATE`, `action.DELETE`, `action.TRUNCATE`, `action.ERROR`) before the fix, confirming they were unrelated system types.
- **Committed in:** `12fe556` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug/Rule 1)
**Impact on plan:** The fix makes the assertion test what the plan actually intends (TimeFlow domain enums are English-only) rather than a superset that includes Supabase's own internal system enums; no scope change, no weakening of the check for anything this plan or future plans control.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required. `npm run db:push` applied the migration directly to the existing dev project (`ujvgagujfsdrlmjdhooi`) using the already-configured `.env.local` credentials from plan 01-01.

## Next Phase Readiness
- `attendance_records` (plan 01-04) can now derive `work_date` by calling `tf_work_date(check_in_at)` directly — no need to re-derive the D-08 convention.
- `periods` (plan 01-05) aggregates should `group by tf_work_date(...)` (or the stored `work_date` column once 01-04 exists), never by the calendar day of `check_in_at`.
- Plan 01-04's `shifts` table CHECK constraint forbidding `start_time = end_time` (named in this phase's `must_haves.truths` but not created by this plan, since `shifts` doesn't exist yet) is still pending — `tf_shift_minutes` already returns 0 for the equal case, so once the CHECK lands the two enforcement layers agree.
- All 13 enum types domain.ts requires are now present; plans 01-04/01-05/01-06 can reference them directly by name with no further enum creation needed.
- `supabase/tests/run-all.sql` now runs 4 files (helpers, 00_rls_coverage, 01_isolation_companies, 02_time_overnight) for a combined 79 pgTAP assertions, all green.

## Self-Check: PASSED

Both created files verified present on disk (`supabase/migrations/0003_enums_time.sql`, `supabase/tests/02_time_overnight.sql`); `supabase/tests/run-all.sql` modification verified present; both task commits (`37001c5`, `12fe556`) verified present in git history via `git log`.

---
*Phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p*
*Completed: 2026-07-31*
