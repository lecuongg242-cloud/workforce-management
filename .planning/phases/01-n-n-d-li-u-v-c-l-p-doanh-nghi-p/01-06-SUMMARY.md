---
phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p
plan: 06
subsystem: database
tags: [postgres, supabase, seed, pgtap, multi-tenant, sliding-dates]

# Dependency graph
requires:
  - phase: 01-05
    provides: "Full 13-table schema (7 domain.ts entities + 6 V2 tables), 52 RLS policies, tf_tz()/tf_work_date()/tf_shift_minutes()/tf_worked_minutes() time helpers, pgTAP harness (helpers.sql, run-all.sql through 04_isolation_v2.sql)"
  - phase: 01-04
    provides: "attendance_records table with work_date/check_in_at/check_out_at, D-08 CHECK constraint (work_date = tf_work_date(check_in_at))"
provides:
  - "Full two-company V1 seed dataset in supabase/seed.sql: 2 companies, 9 departments, 7 shifts (1 overnight per company), 40 employees (28 Ngoc Phat + 12 Binh Minh), ~30 days of attendance history per employee (1202 rows), 12 work requests (8 pending), 4 periods (current + previous month per company)"
  - "Sliding-date convention (D-07): every operational date/timestamp in seed.sql derives from public.tf_work_date(now()) via day-offset arithmetic — zero hardcoded absolute dates for attendance/requests/periods"
  - "supabase/tests/05_seed_fixture.sql — 35-assertion pgTAP suite proving dataset completeness (T-01-27), date-sliding invariants, and the overnight-shift work_date/ordering/worked_minutes invariants under two session timezones"
affects: [phase-02, phase-03, phase-04, phase-05, phase-06]

actuals:
  tokens: 11000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Anchor-id preservation across a full data-model rewrite: when replacing a minimal fixture with a full dataset, grep every existing pgTAP test file FIRST for hardcoded ids/FK targets (dept-01/dept-02, sft-01-day/sft-02-day, nv-01a/nv-02a, att-02a) and keep those exact strings alive in the new dataset, even when the surrounding id scheme changes — cheaper than touching every downstream test."
    - "Sliding seed dates via a single anchor expression: public.tf_work_date(now()) computed once per statement (now() is frozen for the whole transaction) and referenced via day-offset arithmetic (anchor + N / anchor - N) instead of literal dates — makes seed.sql immune to going stale after the milestone's reference dates pass."
    - "SQL-side bulk history generation via generate_series + a VALUES-based pattern CTE, joined on day_offset % 8, instead of one INSERT row per historical day — keeps the 8-day HISTORY_PATTERN cycle from src/lib/mock/db.ts in SQL as data (not per-row literals) so it recomputes correctly on every seed run."
    - "Correctness invariant overriding realism for overnight shifts: when a phase's acceptance criterion demands an exact equality (worked_minutes = tf_shift_minutes(...)) for a subset of generated rows, special-case that subset (force offset 0 / status on_time for overnight-shift + both-timestamps-present rows) rather than relaxing the assertion — the two non-conforming statuses (missing_checkout, leave) fall outside the assertion's own scope by construction."

key-files:
  created:
    - supabase/tests/05_seed_fixture.sql
  modified:
    - supabase/seed.sql
    - supabase/tests/03_isolation_core.sql
    - supabase/tests/run-all.sql

key-decisions:
  - "Employee/department/shift ids renamed away from V1's seed.ts convention (pb-XX/ca-XX/nv-XX) to preserve six literal ids that 01-04/01-05's pgTAP tests hardcode as FK targets: departments dept-01 (cty-01) / dept-02 (cty-02), shifts sft-01-day / sft-02-day, employees nv-01a / nv-02a, attendance att-02a. Departments use a company-alternating global sequence (dept-01=cty1, dept-02=cty2, dept-03=cty1, ...) specifically so dept-01/dept-02 land on the two companies the old tests expect."
  - "Monthly attendance history (D-06's must_have 'lich su ca thang cho tung nhan vien') generated for ALL 40 employees via a single generate_series(1,30) x employees x an 8-slot VALUES pattern CTE, not just the one demo employee V1's buildMonthlyHistory covered — ~1200 rows, matching the phase's own threat-register estimate (T-01-31)."
  - "Check-in/check-out offsets are expressed as minutes relative to each employee's OWN shift start_time/end_time (not V1's literal absolute clock times, which were tuned only for one 08:00-17:30 shift) — the only way to reuse one 8-slot pattern across 7 different shifts including two overnight ones without producing nonsensical timestamps."
  - "work_requests: from_time/to_time set NULL for 'leave' and 'overtime' types even though V1's seed.ts populated times on two overtime requests — followed the PLAN's explicit instruction (from_time/to_time only for attendance_supplement/time_adjustment) over the raw V1 data, since the plan is the contract."
  - "Two attendance rows (att-01a, att-02a) inserted outside the bulk generate_series specifically at the anchor date with status='missing_checkout', check_out_at=null, satisfying Task 1's explicit 'at least one such row per company' instruction deterministically rather than relying on the bulk pattern's probabilistic coverage, and reusing the att-02a id 04_isolation_v2.sql already hardcodes as an attendance_photos FK target."
  - "[Rule 3 - blocking fix] 03_isolation_core.sql's null-checkout test hardcoded work_date '2026-07-29' (a literal ~2 days before today, 2026-07-31) — once the full 30-day history landed, that date already had a row for nv-01a/sft-01-day, so the test's own insert hit the unique(employee_id, work_date, shift_id) constraint. Rewrote it to use (public.tf_work_date(now()) + 5), a relative future date that can never collide with the backward-only historical window — this also makes the test permanently immune to future collisions as 'today' keeps moving under D-07."
  - "Per speed_directive: skipped the two controlled-sabotage teeth checks in Task 2's acceptance criteria (delete an overnight shift row / mutate a work_date, expect npm run test:rls to fail) and did not attempt git push to origin (pre-existing 403, WINDOWS.md entry 3). Logged the skipped teeth checks as a new WINDOWS.md entry (id 4)."

patterns-established:
  - "supabase/seed.sql is now the canonical full-fidelity dataset for both companies — Phase 2+ can open any V1 screen against real Supabase data without manual entry, and every operational date stays fresh indefinitely because nothing is pinned to an absolute date."

requirements-completed: [DATA-01, DATA-07]

coverage:
  - id: D1
    description: "supabase/seed.sql holds the full two-company V1 dataset: 2 companies, 9 departments, 7 shifts (1 overnight each), 40 employees (28+12), 12 work requests (8 pending), 0 holidays (intentional), ~30 days of attendance history per employee"
    requirement: "DATA-01"
    verification:
      - kind: integration
        ref: "psql counts via npm run db:seed twice in a row: companies=2, departments=9, shifts=7, employees=40 (28+12), work_requests=12 (8 pending), holidays=0, overnight shifts=2 (1 per company) -> identical on both runs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seed dates slide with the run date (D-07): every operational timestamp derives from public.tf_work_date(now()); max(work_date) is within 1 day of today; >=28 distinct work_dates in the last 35 days; no future work_date; seed.sql contains no literal 2026-07-27 (V1's REFERENCE_DATE)"
    requirement: "DATA-07"
    verification:
      - kind: integration
        ref: "psql: tf_work_date(now()) - max(work_date) = 0; count(distinct work_date) in last 35 days = 31; future work_date count = 0; node fs.readFileSync check for '2026-07-27' exits 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Overnight-shift attendance records (D-08, phase acceptance criterion 5) have work_date = tf_work_date(check_in_at), check_out_at > check_in_at, and worked_minutes = tf_shift_minutes(shift.start_time, shift.end_time, shift.break_minutes) for every row with both timestamps present, verified on real seeded data (113 such rows) and unchanged under a different session timezone (America/New_York)"
    requirement: "DATA-01"
    verification:
      - kind: integration
        ref: "supabase/tests/05_seed_fixture.sql groups 3 (10 assertions, 2 rounds); npm run test:db -> 170/170 assertions pass, exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "supabase/tests/05_seed_fixture.sql proves fixture completeness (every company-scoped table except holidays has rows for both cty-01 and cty-02, preventing vacuously-true isolation assertions per T-01-27) and is registered in run-all.sql after 04_isolation_v2.sql; prior plans' isolation tests (00-04) remain green after the full seed lands"
    requirement: "DATA-01"
    verification:
      - kind: integration
        ref: "npm run test:db: 170/170 assertions (135 prior + 35 new), exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Seed is idempotent: running npm run db:seed twice in a row produces identical row counts on every table (truncate ... restart identity cascade at the top of the transaction)"
    requirement: "DATA-01"
    verification:
      - kind: integration
        ref: "manual: npm run db:seed run twice consecutively, INSERT row counts identical both times (40 employees, 1200+2 attendance rows, 12 work_requests, ...)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-07-31
status: complete
---

# Phase 1 Plan 6: Full V1 Seed Dataset with Sliding Dates Summary

**Ports the complete V1 mock dataset (40 employees across two companies, 7 shifts, ~1200 attendance rows) into `supabase/seed.sql`, with every operational date computed relative to the seed run date instead of pinned to V1's `REFERENCE_DATE`.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-31T14:05Z (approx, right after loading 01-05's SUMMARY)
- **Completed:** 2026-07-31T14:35Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `supabase/seed.sql` now carries the full two-company V1 dataset: 2 companies, 9 departments, 7 shifts (exactly 1 overnight per company), 40 employees (28 Ngoc Phat + 12 Binh Minh), 12 work requests (8 pending), 4 periods (current + previous calendar month per company), plus the minimal work_sites/overtime_rules/audit_log/attendance_photos rows carried forward from 01-05
- ~1202 attendance_records rows generated per seed run — a rolling ~30-day history for every one of the 40 employees (not just a single demo employee), built entirely from SQL (`generate_series` + an 8-slot pattern CTE reproducing `buildMonthlyHistory`'s cycle from `src/lib/mock/db.ts`), so the data recomputes fresh on every `npm run db:seed`
- D-07 satisfied structurally: every operational date/timestamp (attendance, work requests, periods, photo captured_at) derives from `public.tf_work_date(now())`; `seed.sql` contains no literal `2026-07-27` (V1's `REFERENCE_DATE`)
- D-08 (phase acceptance criterion 5) verified on real seeded data, not just on the `tf_*` functions in isolation: 113 overnight-shift attendance rows with both timestamps present all satisfy `work_date = tf_work_date(check_in_at)`, `check_out_at > check_in_at`, and `worked_minutes = tf_shift_minutes(...)`, confirmed identical under `America/New_York` session timezone
- `supabase/tests/05_seed_fixture.sql` (new, 35 assertions) proves dataset completeness (every company-scoped table except `holidays` has rows for both `cty-01` and `cty-02`, per T-01-27), the D-07 sliding invariants, and the D-08 overnight invariants — registered in `run-all.sql` after `04_isolation_v2.sql`
- `npm run test:db` (reseeds from a clean schema, then runs the full pgTAP suite): **170/170 assertions pass, exit 0** (135 prior + 35 new)
- Seed re-run twice in a row produces identical row counts on every table — confirms idempotency

## Task Commits

Each task was committed atomically (plus one mid-task fix commit surfaced by validation):

1. **Task 1: Port full two-company seed dataset with sliding dates** - `e489480` (feat)
   - Fix commit surfaced while validating Task 1's own acceptance criteria - `410bdd2` (fix)
2. **Task 2: Assert completeness, date sliding, and overnight convention** - `cca3840` (test)

## Files Created/Modified
- `supabase/seed.sql` - full rewrite: 9 departments, 7 shifts, 40 employees, dept-manager backfill, generate_series-based attendance history, 12 work requests, work_sites/attendance_photos/overtime_rules/audit_log/periods
- `supabase/tests/05_seed_fixture.sql` - new, 35-assertion completeness/sliding-date/overnight-invariant suite
- `supabase/tests/03_isolation_core.sql` - fixed a hardcoded date that collided with the new full history (see Deviations)
- `supabase/tests/run-all.sql` - registered `\ir 05_seed_fixture.sql` after `04_isolation_v2.sql`

## Decisions Made
See `key-decisions` in frontmatter for the full list. Highlights:
- Renamed ids away from V1's `pb-XX`/`ca-XX`/`nv-XX` scheme where necessary to preserve six literal anchor ids (`dept-01`, `dept-02`, `sft-01-day`, `sft-02-day`, `nv-01a`, `nv-02a`, plus `att-02a`) that 01-04/01-05's existing pgTAP tests hardcode as FK targets — cheaper than touching every downstream test file.
- Generated monthly attendance history for **all 40 employees** (not just one demo employee like V1's `buildMonthlyHistory`), per this plan's own must_have wording ("lịch sử chấm công cả tháng cho từng nhân viên") and the phase's threat register (T-01-31 already budgeted ~1000 rows for this).
- Check-in/check-out offsets are relative to each employee's own shift boundaries rather than V1's literal absolute clock times, since the original pattern was tuned only for one day shift and would produce nonsensical timestamps if applied verbatim to a 22:00-06:00 shift.
- Overnight-shift attendance rows with both timestamps present are forced to offset 0 / status `on_time` (see Deviations below) — a data-generation decision required to satisfy the phase's own acceptance criterion 5, discovered while designing Task 2's assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Overnight-shift attendance rows didn't satisfy the D-08 worked_minutes invariant**
- **Found during:** Designing Task 2's group-3 assertions (before committing 05_seed_fixture.sql)
- **Issue:** The plan's own acceptance criterion 5 requires that every overnight-shift attendance row with both timestamps present have `worked_minutes = public.tf_shift_minutes(shift.start_time, shift.end_time, shift.break_minutes)` exactly. The initial bulk generation applied the same varied check-in/check-out offset pattern (late/early-leave minutes) uniformly to all employees including overnight-shift ones, so `worked_minutes` (computed from actual timestamps) almost never matched the scheduled full-shift duration.
- **Fix:** In the `raw` CTE, when the employee's shift is `overnight` and the pattern slot has both a check-in and check-out offset (i.e., a "worked" status, not `leave_paid`/`leave_unpaid`/`missing_checkout`), force both offsets to 0 and the status to `on_time`. `missing_checkout` (checkout null) and leave rows are untouched since they fall outside the assertion's "both timestamps present" scope.
- **Files modified:** `supabase/seed.sql`
- **Verification:** `select count(*) from attendance_records a join shifts s on s.id=a.shift_id where s.overnight and a.check_in_at is not null and a.check_out_at is not null and a.worked_minutes <> public.tf_shift_minutes(...)` returns 0 (113 qualifying rows checked)
- **Committed in:** `410bdd2`

**2. [Rule 3 - Blocking] 03_isolation_core.sql's hardcoded date collided with the new full history**
- **Found during:** Running `npm run test:rls` after Task 1's seed rewrite
- **Issue:** `03_isolation_core.sql`'s null-checkout `lives_ok` test inserted a row at the literal date `'2026-07-29'` for employee `nv-01a`/shift `sft-01-day`. Once the full ~30-day bulk history landed, that date already had a row for the same employee+shift (it's within the last 30 days of "today," 2026-07-31), so the test's own insert violated `unique(employee_id, work_date, shift_id)` and the whole file failed.
- **Fix:** Changed the literal date to a relative future expression, `(public.tf_work_date(now()) + 5)`, which can never fall inside the backward-only 30-day historical window — permanently immune to this class of collision as "today" keeps moving under D-07.
- **Files modified:** `supabase/tests/03_isolation_core.sql`
- **Verification:** `npm run test:rls` exit 0, 135/135 assertions (re-confirmed at 170/170 after adding 05_seed_fixture.sql)
- **Committed in:** `e489480`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). Both were necessary for correctness against the plan's own acceptance criteria; no scope creep.

## Issues Encountered

**Package install failures:** None — this plan added zero dependencies, only SQL files (T-01-SC inherited, no exceptions triggered).

**Sabotage/teeth checks and CI push skipped per speed_directive.** Task 2's acceptance criteria describe two controlled-sabotage checks (delete an overnight shift row for `cty-02` and expect `npm run test:rls` to fail; mutate an `attendance_records.work_date` and expect the same) and Task 1 implicitly depends on eventually pushing to `origin` for the `db` CI workflow to confirm green. Per this execution's explicit speed_directive ("Do NOT perform sabotage / 'teeth' checks" and "Do NOT attempt to push to origin — it fails with 403"), neither was run. The git-push blocker is the same pre-existing 403 already logged as `WINDOWS.md` entry 3 (git identity `LeeCuongg` is not a collaborator on the remote) — not re-logged. The skipped teeth checks were logged as a new `WINDOWS.md` entry (id 4) describing the exact manual steps a human can run later; the underlying invariants they'd prove are already exercised structurally by `05_seed_fixture.sql`'s group-3 assertions (same reasoning already accepted for entry 2 from 01-05).

## User Setup Required

**Deferred to a human (see WINDOWS.md entries 1, 3, 4):**
1. Push branch `gsd/phase-01-n-n-d-li-u-v-c-l-p-doanh-nghi-p` to `origin` using an account with write access (or add `LeeCuongg242` as collaborator), then confirm the `db` GitHub Actions workflow is green on the complete schema + full seed.
2. Optionally run the two controlled-sabotage teeth checks for Task 2 manually (exact steps in `WINDOWS.md` entry 4) to physically confirm `05_seed_fixture.sql` goes red when the overnight-shift or work_date invariants are violated.
3. Enable branch protection on `main` requiring the `db` check to pass before merge (carried forward from 01-05).

No new external service configuration is required.

## Next Phase Readiness
- Phase 1's success criteria are now fully met: full two-company dataset (criterion 1), per-table isolation proof (criterion 2, unchanged from 01-04/01-05), D-08 overnight convention verified on real data (criterion 5), and the seed is idempotent and slides with time (D-07).
- Phase 2 (Server Actions swapping `src/lib/mock/service.ts`) has a realistic, densely-populated dataset to develop and manually verify every V1 screen against, without needing to hand-enter fixtures — including a full month of attendance history per employee, 8 pending work requests spread across both companies, and a demo employee (`nv-01a` / `NV001` / Nguyễn Minh Anh) wired to a real Supabase Auth user (`00000000-0000-0000-0000-000000000001`).
- This is the last plan of Phase 1 per ROADMAP.md — phase-level wrap-up (CI confirmation, branch protection) remains a human follow-up tracked in WINDOWS.md.

## Self-Check: PASSED

Verified `supabase/seed.sql`, `supabase/tests/05_seed_fixture.sql`, `supabase/tests/03_isolation_core.sql`, and `supabase/tests/run-all.sql` exist on disk with the expected content. Verified all three task commits (`e489480`, `410bdd2`, `cca3840`) present in `git log`. Verified `npm run test:db` exits 0 with 170/170 assertions against the live dev project after a full re-seed.

---
*Phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p*
*Completed: 2026-07-31*
