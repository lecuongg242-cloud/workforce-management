---
phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p
plan: 05
subsystem: database
tags: [postgres, supabase, rls, pgtap, multi-tenant]

# Dependency graph
requires:
  - phase: 01-01
    provides: "companies + memberships tables, tf_is_member(), pgTAP harness (helpers.sql, run-all.sql, 00_rls_coverage.sql), <table>_<cmd>_member RLS policy pattern"
  - phase: 01-03
    provides: "tf_tz()/tf_work_date() timezone helpers reused by periods' calendar-month CHECK and the seed's current-month period insert"
  - phase: 01-04
    provides: "attendance_records table (attendance_photos FKs into it), 41-assertion per-table isolation test shape reused (reduced depth) for the six new tables"
provides:
  - "work_sites, attendance_photos, holidays, overtime_rules, audit_log, periods tables in public schema — completes Phase 1 schema (13 tables total: 7 from domain.ts entities + 6 V2 tables), all RLS-enabled with 24 new tf_is_member(company_id) policies (52 total)"
  - "attendance_photos.storage_path CHECK enforcing the company_id-prefix convention Phase 3's storage.objects policy will reuse"
  - "periods.start_date/end_date CHECK enforcing D-09 (calendar-month periods only)"
  - "audit_log with nullable company_id for Phase 6 super-admin actions, invisible to all company-scoped RLS policies by construction"
  - "supabase/tests/04_isolation_v2.sql — reduced-depth (2 assertions/table) per-table isolation suite covering all six new tables plus an audit_log NULL-company invisibility check"
affects: [01-06, phase-02, phase-03, phase-04, phase-05, phase-06]

actuals:
  tokens: 8316
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Speed-directive test depth: 2 pgTAP assertions per table (compound cross-tenant read-denial ok(), throws_ok 42501 write-denial) instead of the 7-assertion suite from 01-04, when the RLS mechanism itself is already proven by precedent — the reduction is scoped to test depth only, never to functional/RLS coverage"
    - "Intentionally-empty table isolation test: for a table with no seed rows (holidays), the test itself inserts one row inside the transaction (lives_ok) to create a non-vacuous fixture, then runs the same read/write cross-tenant denial pair as populated tables — proves isolation without requiring seed data that would contradict the table's 'empty is valid' invariant"
    - "NULL-scoped row invisibility test: audit_log rows with company_id NULL are inserted using the connection's default (table-owner) role, before any tf_test_login call, then checked as invisible under two separate logins — proves the tf_is_member(NULL) = false path structurally rather than by inspection"

key-files:
  created:
    - supabase/migrations/0005_v2_tables.sql
    - supabase/tests/04_isolation_v2.sql
  modified:
    - supabase/seed.sql
    - supabase/tests/run-all.sql

key-decisions:
  - "Per speed_directive: wrote 2 pgTAP assertions per new table (compound cross-tenant read-denial + throws_ok write-denial) instead of the plan's specified 7-assertion-per-table suite. holidays gets a third (setup lives_ok) and audit_log gets two extra (NULL-company invisibility per user) because those are distinct correctness/threat-mitigation proofs, not depth duplication of the same table's read/write pair."
  - "periods seed and cross-tenant-insert test both compute month boundaries via date_trunc('month', now() at time zone public.tf_tz()) rather than hardcoded dates — keeps periods sliding with D-07's 'dates slide with seed run date' convention, and the cross-tenant test targets the NEXT month specifically to avoid colliding with the seeded current-month row's unique (company_id, start_date) constraint."
  - "attendance_photos cross-tenant write test uses kind='check_out' against an existing 'check_in' seed row (att-02a) — the OTHER company's real attendance_record_id, matching 01-04's established principle of using real FK targets so the RLS rejection isn't confounded by an unrelated FK-validity failure, while using a different `kind` avoids colliding with the seeded (attendance_record_id, kind) unique constraint."

patterns-established:
  - "Six V2 tables (work_sites, attendance_photos, holidays, overtime_rules, audit_log, periods) all carry company_id as the second column with the same 4-policy PERMISSIVE tf_is_member(company_id) pattern — Phase 1's schema is now fully closed; no future phase needs to add RLS to a new company-scoped table from scratch."

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04]

coverage:
  - id: D1
    description: "Six V2 tables (work_sites, attendance_photos, holidays, overtime_rules, audit_log, periods) exist in public schema with columns mapped from the plan's domain.ts-derived spec, all RLS-enabled with 24 tf_is_member(company_id) policies (52 total across all 13 tables)"
    requirement: "DATA-02"
    verification:
      - kind: integration
        ref: "psql counts: 13 public tables, 52 policies, 0 tables missing RLS, 0 RLS-enabled tables without a policy -> pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "supabase/tests/04_isolation_v2.sql proves cross-tenant read rejection and cross-tenant write rejection (SQLSTATE 42501) for all six new tables, plus audit_log NULL-company invisibility (T-01-23) and holidays' intentionally-empty-at-init state, table name literal in every assertion description"
    requirement: "DATA-03"
    verification:
      - kind: integration
        ref: "npm run test:db (135/135 assertions: 120 prior + 15 new) -> exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "attendance_photos.storage_path CHECK rejects a path not prefixed with its own company_id; periods CHECK rejects a start/end date pair that is not a full calendar month (D-09)"
    requirement: "DATA-01"
    verification:
      - kind: integration
        ref: "manual psql insert with mismatched storage_path prefix -> non-zero exit; insert with 2026-03-05/2026-04-04 (not month-aligned) -> non-zero exit"
        status: pass
    human_judgment: false
  - id: D4
    description: "holidays has zero rows for both seeded companies after db:seed — an empty holidays table is a valid, intentional initial state, not a missing-data bug"
    requirement: "DATA-01"
    verification:
      - kind: integration
        ref: "psql -tAc select count(*) from public.holidays -> 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "All 5 migrations applied to the dev project and confirmed via supabase_migrations.schema_migrations, matching the 5 files on disk in the same order"
    requirement: "DATA-02"
    verification:
      - kind: integration
        ref: "psql select version,name from supabase_migrations.schema_migrations -> 0001..0005 in order; node fs.readdirSync count -> 5"
        status: pass
    human_judgment: false
  - id: D6
    description: "Working branch pushed to origin and the db CI workflow runs green on a clean Postgres with the complete 13-table schema"
    requirement: "DATA-04"
    verification: []
    human_judgment: true
    rationale: "git push to origin was denied (403) — the local git identity (LeeCuongg, lecuong24021307@gmail.com) is not a collaborator on the remote repo (lecuongg242-cloud/workforce-management). This is the same class of blocker already open in WINDOWS.md entry 1 from 01-01 (no GitHub token/collaborator access in this execution environment). Logged as WINDOWS.md entry 3 with exact detail and required human action (push with an authorized account or add LeeCuongg242 as collaborator, then confirm the db workflow is green)."

duration: ~24min
completed: 2026-07-31
status: complete
---

# Phase 1 Plan 5: Six V2 Tables Complete the Phase 1 Schema Summary

**Added work_sites, attendance_photos, holidays, overtime_rules, audit_log and periods — the last 6 of 13 public schema tables, all RLS-enabled with 52 total tf_is_member(company_id) policies — completing Phase 1's data foundation.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-07-31T13:45:05Z (approx, right after 01-04's state update)
- **Completed:** 2026-07-31T14:09Z
- **Tasks:** 3 (2 code tasks + 1 verification/push task)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Public schema now has all 13 tables Phase 1 requires: 7 business entities from `domain.ts` (companies, memberships, departments, shifts, employees, attendance_records, work_requests) plus the 6 V2 tables this plan adds
- 52 total RLS policies across 13 tables, 0 tables missing RLS, 0 RLS-enabled tables without a policy — confirmed live against the dev project via `pg_class`/`pg_policies`
- `attendance_photos.storage_path` CHECK enforces the `company_id`-prefix path convention Phase 3's `storage.objects` policy will reuse (Pitfall 6 mitigation baked into the schema now)
- `periods` CHECK enforces D-09 (calendar-month-only periods) at the database layer, verified live by attempting a non-month-aligned insert (rejected)
- `holidays` is intentionally empty for both seeded companies — verified by `select count(*)` returning 0 after seed, with a dedicated test proving that emptiness is a valid state, not a bug
- `supabase/tests/04_isolation_v2.sql`: 15 assertions (2 per table for work_sites/attendance_photos/overtime_rules/periods, 4 for audit_log including the NULL-company invisibility proof, 3 for holidays including its setup insert) — `npm run test:db` passes 135/135 assertions (120 prior + 15 new)
- All 5 migrations confirmed applied to the dev project via `supabase_migrations.schema_migrations`, matching the 5 files on disk in identical order

## Task Commits

Each code task was committed atomically:

1. **Task 1: Six V2 tables with RLS, index and constraints** - `404379d` (feat)
2. **Task 2: Per-table isolation test for the six V2 tables** - `259d53f` (test)
3. **Task 3: Apply full schema and verify** - no separate code commit (verification-only; migration was applied as part of Task 1's `npm run db:push`); the `origin` push attempted here failed with a permission error (see Issues Encountered) and is logged, not committed.

## Files Created/Modified
- `supabase/migrations/0005_v2_tables.sql` - 6 tables, 3 new enums (period_status, photo_review_status, audit_action), 24 RLS policies, 11 indexes, attendance_photos/periods CHECK constraints
- `supabase/seed.sql` - extended truncate list + one row per company each in work_sites, attendance_photos, overtime_rules, audit_log, periods; deliberately zero rows in holidays
- `supabase/tests/04_isolation_v2.sql` - 15-assertion pgTAP isolation suite for the six new tables
- `supabase/tests/run-all.sql` - registered `\ir 04_isolation_v2.sql` after `03_isolation_core.sql`

## Decisions Made
- **Reduced test depth per speed_directive:** 2 assertions per table (compound cross-tenant read-denial `ok()` + `throws_ok` write-denial) instead of the plan's specified 7-assertion suite, since the RLS mechanism itself was already proven with teeth in 01-01/01-04. `holidays` gets one extra setup `lives_ok` (it has no seed rows to read cross-tenant, so the test inserts its own fixture first); `audit_log` gets two extra assertions proving the NULL-company row (T-01-23, super-admin actions) is invisible to both seeded companies' users — these are distinct threat-mitigation proofs, not repeated depth on the same read/write pair.
- **periods date math uses `date_trunc('month', now() at time zone public.tf_tz())`** in both seed.sql and the cross-tenant test, rather than hardcoded dates — keeps the period sliding with D-07's "seed dates slide with run date" convention; the cross-tenant insert test targets the *next* month specifically so it doesn't collide with the seeded current-month row's `unique (company_id, start_date)` constraint.
- **attendance_photos cross-tenant insert test uses `kind = 'check_out'`** against the other company's real seeded `attendance_record_id` (`att-02a`, which already has a `check_in` photo) — reuses 01-04's principle of targeting real FK rows so the RLS rejection isn't confounded by an FK-validity error, while the different `kind` avoids the `unique (attendance_record_id, kind)` constraint.

## Deviations from Plan

### Auto-fixed Issues

None - Task 1 and Task 2's deliverables (migration, seed, test file) matched the plan's action spec directly; no bugs, missing functionality, or blocking issues were found during implementation. The test-depth reduction (7 → 2 assertions/table) was an explicit instruction from the speed_directive in this execution's prompt, not an unplanned deviation under Rules 1-4 — it trades test depth for speed while preserving full functional/RLS scope, as instructed.

## Issues Encountered

**`git push origin` denied with 403 (Task 3's final step).** The plan's Task 3 asks to push the working branch to `origin` and confirm the `db` GitHub Actions workflow runs green on the complete 13-table schema. The push failed: `remote: Permission to lecuongg242-cloud/workforce-management.git denied to LeeCuongg242` / `fatal: ... 403`. The local git identity (`LeeCuongg`, `lecuong24021307@gmail.com`) is not a collaborator on the remote repo owned by `lecuongg242-cloud`. This is the same category of environment limitation already tracked in `WINDOWS.md` entry 1 (from 01-01: no `gh` CLI/GitHub token available to push+open a PR from this environment) — logged as a new, more specific entry (`WINDOWS.md` #3) with exact detail (git identity mismatch, 403) and the required human action: push with an authorized account, or add `LeeCuongg242` as a collaborator on the remote, then confirm the `db` workflow is green with all 13 tables. Everything else Task 3 required (migration count matches file count, `supabase_migrations.schema_migrations` lists all 5 in order, `run-all.sql` registers all 5 test files, `npm run test:db` exit 0) was verified successfully against the live dev database from this environment.

## User Setup Required

**Deferred to a human (see WINDOWS.md entries 1 and 3):**
1. Push branch `gsd/phase-01-n-n-d-li-u-v-c-l-p-doanh-nghi-p` to `origin` using an account with write access to `lecuongg242-cloud/workforce-management` (or add `LeeCuongg242` as a collaborator).
2. Open a PR and confirm the `db` GitHub Actions workflow run is green on a clean Postgres with the complete 13-table schema.
3. Enable branch protection on `main` requiring the `db` check to pass before merge (D-05's stated purpose for moving to branch+PR workflow).

No new external service (Supabase, etc.) configuration is required — this plan only added tables/policies to the already-configured dev project.

## Next Phase Readiness
- Phase 1's full schema is now closed: all 13 tables from `domain.ts`'s 7 entities plus V2's 6 tables exist with RLS and 52 policies. Phase 2 (Server Actions swapping `src/lib/mock/service.ts`) has every table it needs already provisioned, including `audit_log` for its first real mutation.
- Phase 3 (`work_sites`, `attendance_photos`) and Phase 4 (`holidays`, `overtime_rules`) can build directly on this schema without touching migrations or RLS — the "bảng của phase sau" risk the plan's objective named is now closed.
- Phase 5 (`periods`) has its calendar-month CHECK and unique-per-company-per-month constraint already enforced at the database layer.
- `npm run test:db` runs 135 assertions total (4 rls_coverage standalone + 4+18+53+41+15 via run-all.sql) — remains the single command that proves schema + isolation from a clean local state.
- Blockers carried forward unchanged: WINDOWS.md entry 1 (CI/branch-protection verification needs a human with GitHub access) and entry 2 (01-04's employees sabotage-and-revert teeth check needs a human with elevated DB permissions); WINDOWS.md entry 3 is new from this plan and covers the same root cause as entry 1 with more specific detail (git push 403).
- Plan 01-06 (per ROADMAP.md) is the next and final plan of Phase 1.

## Self-Check: PASSED

Both created files verified present on disk (`supabase/migrations/0005_v2_tables.sql`, `supabase/tests/04_isolation_v2.sql`); `supabase/seed.sql` and `supabase/tests/run-all.sql` modifications verified present; both task commits (`404379d`, `259d53f`) verified present in git history via `git log`.

---
*Phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p*
*Completed: 2026-07-31*
