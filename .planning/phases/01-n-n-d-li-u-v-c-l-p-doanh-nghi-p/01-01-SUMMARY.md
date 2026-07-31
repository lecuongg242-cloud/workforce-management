---
phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p
plan: 01
subsystem: database
tags: [postgres, supabase, rls, pgtap, github-actions, multi-tenant]

# Dependency graph
requires: []
provides:
  - "supabase/ project initialized via Supabase CLI (config.toml), linked to dev project ujvgagujfsdrlmjdhooi"
  - "0001_supabase_compat.sql idempotent shim (roles, auth schema, auth.users stub, auth.uid()) — same migrations run on cloud and CI"
  - "companies + memberships tables with 4 PERMISSIVE RLS policies each, gated by public.tf_is_member(company_id)"
  - "scripts/db.mjs runner (push/seed/test/testdb) — zero new npm dependencies"
  - "pgTAP isolation test pattern (tf_test_login/tf_test_logout + per-table assertions) for future company-scoped tables"
  - "supabase/tests/00_rls_coverage.sql — schema-wide gate for missing RLS / missing policies, reusable for every future table"
  - ".github/workflows/db-ci.yml — CI job building a clean containerized Postgres, never touching the cloud project"
affects: [01-02, 01-03, 01-04, 01-05, 01-06]

actuals:
  tokens: 12041
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "RLS policy pattern: <table>_<select|insert|update|delete>_member, condition always public.tf_is_member(company scoping column), never a Postgres session variable"
    - "SECURITY DEFINER membership-check function filters by (select auth.uid()) internally, never accepts user_id as a parameter"
    - "pgTAP cross-tenant test shape: tf_test_login(uuid) / tf_test_logout(), assertions per table naming the table in the description string"
    - "db.mjs command runner: built-in Node only, spawnSync with shell:true on win32 (npx resolves to npx.cmd)"

key-files:
  created:
    - .env.local
    - scripts/db.mjs
    - supabase/config.toml
    - supabase/migrations/0001_supabase_compat.sql
    - supabase/migrations/0002_tenancy.sql
    - supabase/seed.sql
    - supabase/tests/00_install_pgtap.sql
    - supabase/tests/00_rls_coverage.sql
    - supabase/tests/helpers.sql
    - supabase/tests/run-all.sql
    - supabase/tests/01_isolation_companies.sql
    - supabase/ci/Dockerfile
    - .github/workflows/db-ci.yml
  modified:
    - package.json

key-decisions:
  - "Compat auth.users stub (0001_supabase_compat.sql) expanded beyond the plan's literal id+email to also include instance_id/aud/role — required for seed.sql's insert to work identically on CI's clean Postgres and on Supabase cloud"
  - "db.mjs test/testdb skip a referenced file if it does not yet exist on disk, instead of failing hard — resolves a plan-internal forward reference (Task 1's db.mjs unconditionally names 00_rls_coverage.sql, which is Task 2's deliverable); no-op once Task 2 completes"
  - "Cross-tenant INSERT test for companies (which has no company_id column, unlike memberships) targets a fresh unowned id (cty-99) rather than colliding with an existing company id, to isolate the RLS check from unrelated PK-uniqueness behavior"

patterns-established:
  - "Pattern 3 (per PROJECT ARCHITECTURE.md): all company-scoped RLS conditions call public.tf_is_member(company_id), never SET LOCAL app.company_id"
  - "Migration idempotency convention: every DDL branch in 0001_supabase_compat.sql is guarded by to_regclass/to_regprocedure/pg_roles existence checks so the same file is a no-op on Supabase cloud and a real bootstrap on CI's blank Postgres"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04]

coverage:
  - id: D1
    description: "companies + memberships tables exist on the dev Supabase project with RLS enabled and exactly 4 PERMISSIVE policies each (select/insert/update/delete), condition derived from auth.uid() via memberships"
    requirement: "DATA-02"
    verification:
      - kind: integration
        ref: "psql -tAc \"select count(*) from pg_policies where schemaname='public' and tablename='companies'\" -> 4; relrowsecurity=t for both tables"
        status: pass
    human_judgment: false
  - id: D2
    description: "pgTAP isolation suite (18 assertions) proves per-table cross-tenant read rejection, cross-tenant write rejection (SQLSTATE 42501), dual-member read-both, and no-membership read-zero — table names appear literally in assertion descriptions"
    requirement: "DATA-03"
    verification:
      - kind: integration
        ref: "npm run test:db (supabase/tests/01_isolation_companies.sql, 18/18 ok)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Test suite has teeth: temporarily loosening companies_select_member to using(true) turns npm run test:rls red (exit 3, 3 failed assertions); reverting turns it green again (exit 0)"
    requirement: "DATA-04"
    verification:
      - kind: manual_procedural
        ref: "psql ALTER POLICY ... using (true) -> npm run test:rls exit 3 -> ALTER POLICY revert -> npm run test:rls exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "supabase/tests/00_rls_coverage.sql scans the whole public schema: red when a table has RLS disabled, red when a table has RLS enabled with zero policies, green on a clean schema; violator names sorted by tablename in the failure message; gate proves its own teeth via an internal self-check before the 3 real assertions"
    requirement: "DATA-04"
    verification:
      - kind: manual_procedural
        ref: "create table public.tf_gate_probe(id int) -> gate exit 3, output contains tf_gate_probe -> drop -> exit 0; create table + enable rls (0 policies) tf_gate_probe2 -> exit 3, output contains tf_gate_probe2 -> drop -> exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "GitHub Actions workflow (.github/workflows/db-ci.yml) builds a clean containerized Postgres 17 + pgTAP, applies migrations in lexical order, runs the RLS coverage gate and isolation suite as separate steps, never references any SUPABASE_* key or touches the cloud project; triggers on pull_request (any branch) and push to main"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "node -e content-check (pull_request, 00_rls_coverage.sql, run-all.sql present; no SUPABASE_SECRET/PUBLISHABLE/ANON/SERVICE) -> pass"
        status: pass
      - kind: manual_procedural
        ref: "actual GitHub Actions run success + branch protection on main (plan's own <human-check>) — not verifiable from this environment (no gh CLI, no GitHub token/PR access)"
        status: unknown
    human_judgment: true
    rationale: "Confirming a live GitHub Actions run and enabling branch protection require pushing a branch, opening a PR, and using the GitHub UI/API — none of which are available in this execution environment (gh not installed, no GITHUB_TOKEN). File-level correctness was fully verified; the runtime CI execution and branch protection setup are deferred to the human, per the plan's own <human-check> instruction."

duration: 27min
completed: 2026-07-31
status: complete
---

# Phase 1 Plan 1: Cross-Tenant Isolation Tracer Slice Summary

**companies + memberships tables with 4-policy RLS gated by a SECURITY DEFINER tf_is_member() function, an 18-assertion pgTAP cross-tenant isolation suite, a schema-wide RLS coverage gate, and a GitHub Actions CI job that proves it all on a clean containerized Postgres — zero new npm dependencies.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-07-31T12:02:50Z
- **Completed:** 2026-07-31T12:28:17Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- End-to-end tracer slice proven: table -> RLS policy -> pgTAP test naming the table -> `npm run test:db` green, all on the real Supabase dev project (`ujvgagujfsdrlmjdhooi`)
- Schema-wide RLS coverage gate (`00_rls_coverage.sql`) that self-demonstrates it has teeth (creates and catches an unprotected probe table inside its own transaction) before asserting the real schema is clean
- CI workflow builds its own Postgres 17 + pgTAP image in-workflow (no third-party image tag guessing) and never connects to the Supabase cloud project
- `psql` (PostgreSQL 17 client tools) installed via winget as declared in the plan's `user_setup` block — no manual intervention needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer slice — companies + memberships isolated and proven by test** - `fcab827` (feat)
2. **Task 2: Schema-wide RLS coverage gate** - `ca417a4` (feat)
3. **Task 3: CI gate on a clean Postgres** - `91dec2e` (feat)

_Note: db.mjs also received a mid-Task-1 fix (Windows npx.cmd resolution) and 01_isolation_companies.sql received a mid-Task-1 fix (throws_ok signature, top-level CTE) — both folded into the Task 1 commit since they were part of getting Task 1's own verify to pass, not separate tasks._

## Files Created/Modified
- `.env.local` - Supabase URL + new-model keys (sb_publishable_/sb_secret_) + POSTGRES_URL_NON_POOLING; gitignored, never committed
- `scripts/db.mjs` - push/seed/test/testdb runner, built-in Node 22 only
- `package.json` - added db:push, db:seed, test:rls, test:db scripts
- `supabase/config.toml` - generated by `supabase init`
- `supabase/migrations/0001_supabase_compat.sql` - idempotent compat shim (roles, auth schema/table stub, auth.uid())
- `supabase/migrations/0002_tenancy.sql` - companies + memberships tables, tf_is_member(), 8 RLS policies
- `supabase/seed.sql` - 4 fixture auth.users, cty-01/cty-02 companies, 4 memberships (thin slice, no other entities yet)
- `supabase/tests/00_install_pgtap.sql` - `create extension if not exists pgtap`
- `supabase/tests/helpers.sql` - tf_test_login(uuid) / tf_test_logout()
- `supabase/tests/00_rls_coverage.sql` - schema-wide RLS/policy coverage gate
- `supabase/tests/run-all.sql` - entry point: helpers -> coverage gate -> isolation suite
- `supabase/tests/01_isolation_companies.sql` - 18-assertion cross-tenant isolation suite
- `supabase/ci/Dockerfile` - postgres:17 + postgresql-17-pgtap
- `.github/workflows/db-ci.yml` - db-ci job, pull_request + push:main triggers

## Decisions Made
- Expanded the compat `auth.users` stub beyond the plan's literal `id, email` to also include `instance_id, aud, role` — required because `seed.sql` (also specified by this same plan) inserts those columns to mirror real Supabase Auth rows, and the literal minimal shape would have broken seeding on CI's blank Postgres. Documented as a plan-internal gap, not a scope change.
- `db.mjs`'s `test`/`testdb` commands skip a test file if it doesn't yet exist on disk rather than failing — resolves a genuine plan ordering issue (Task 1's own db.mjs spec names `00_rls_coverage.sql`, which is Task 2's file) without weakening final behavior (once Task 2 lands, the file always exists, so the skip branch never fires again).
- Cross-tenant INSERT test for `companies` targets an unowned fresh id (`cty-99`) instead of the literal `cty-02` (unlike `memberships`, `companies` has no `company_id` column — it *is* the company), to test the RLS boundary cleanly without conflating it with primary-key uniqueness behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] db.mjs couldn't spawn `npx` on Windows**
- **Found during:** Task 1, first `npm run db:push`
- **Issue:** `spawnSync("npx", ..., { shell: false })` fails with `ENOENT` on Windows because `npx` resolves to `npx.cmd`, which requires a shell to execute.
- **Fix:** Set `shell: process.platform === "win32"` in the `run()` helper.
- **Files modified:** scripts/db.mjs
- **Verification:** `npm run db:push` applied both migrations successfully afterward.
- **Committed in:** fcab827 (Task 1 commit)

**2. [Rule 1 - Bug] `throws_ok` 3-arg call matched the wrong pgTAP overload**
- **Found during:** Task 1, first `npm run test:db`
- **Issue:** `throws_ok(sql, '42501', description)` resolved to the `(text, text, text)` overload — i.e. `(sql, errmsg, description)` — not `(sql, errcode, description)`, since pgTAP disambiguates errcode-vs-errmsg by parameter *type* (bpchar vs text), and an unquoted string literal prefers text. RLS itself was correctly rejecting the cross-tenant insert (SQLSTATE 42501 was actually raised); only the assertion's own comparison was wrong.
- **Fix:** Switched to the unambiguous 4-arg form `throws_ok(sql, errcode, errmsg, description)`.
- **Files modified:** supabase/tests/01_isolation_companies.sql
- **Verification:** Both throws_ok assertions pass; re-verified RLS still rejects (SQLSTATE 42501 in output).
- **Committed in:** fcab827 (Task 1 commit)

**3. [Rule 1 - Bug] Data-modifying CTE nested inside a function-call argument**
- **Found during:** Task 1, first `npm run test:db`
- **Issue:** `select is( (with updated as (update ... returning 1) select count(*) from updated), 0, desc )` raised `ERROR: WITH clause containing a data-modifying statement must be at the top level` — Postgres requires the data-modifying CTE to be part of the outermost statement's WITH clause, not nested in a subquery passed as a function argument.
- **Fix:** Restructured each of the 4 update/delete assertions so `WITH ... SELECT is(...)` is the top-level statement.
- **Files modified:** supabase/tests/01_isolation_companies.sql
- **Verification:** All 4 update/delete assertions run and pass (0 rows affected as expected).
- **Committed in:** fcab827 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking/Rule 3, 2 bug/Rule 1)
**Impact on plan:** All three were necessary for the tracer's own `<verify>` to run at all; none changed scope or behavior beyond making the specified mechanism actually work on this OS/Postgres version.

## Issues Encountered
- Plan-internal forward reference: Task 1's own `db.mjs` spec unconditionally names `supabase/tests/00_rls_coverage.sql`, which is Task 2's deliverable — resolved via the skip-if-missing fix documented above (Decisions Made), not treated as a blocker requiring a checkpoint since it's a same-plan, same-session ordering artifact rather than a missing external dependency.
- Task 3's acceptance criteria include confirming an actual GitHub Actions run succeeded and enabling branch protection on `main` — both require the GitHub UI/API (a live PR, `gh` CLI, or a token), none of which are available in this execution environment. File-level correctness (workflow content, Dockerfile, no cloud key references) was fully verified locally; the live-run and branch-protection steps are deferred to the human per the plan's own `<human-check>` tag on Task 3.

## User Setup Required

None further — the plan's declared `user_setup` (PostgreSQL client tools) was satisfied automatically via `winget install --id PostgreSQL.PostgreSQL.17` during Task 1, and `psql --version` now succeeds in this environment.

**Deferred to a human (GitHub UI/API access required, not automatable here):**
1. Push this branch and open a Pull Request to `main`.
2. Confirm the `db` check in `.github/workflows/db-ci.yml` reports `success` on that PR.
3. GitHub → Settings → Branches → add a rule for `main`: enable "Require a pull request before merging" and "Require status checks to pass" with the `db` check.
4. Open a throwaway PR with a migration that intentionally omits RLS on a new table, and confirm the merge button is blocked.

## Next Phase Readiness
- The RLS policy pattern, `tf_is_member()` function, pgTAP test shape, and coverage gate are all reusable as-is for the 11 remaining company-scoped tables added in plans 01-02/01-04/01-05 — no new mechanism needs to be invented, only replicated per table.
- `supabase/seed.sql` currently seeds only `companies` + `memberships` (thin slice by design); plan 01-04/01-05 will extend it with the full V1 dataset (departments, shifts, employees, attendance, requests) per D-06.
- AUTH-06 (legacy Supabase key revocation) was explicitly deferred to plan 01-03 by this plan's own scope — `.env.local` currently holds only the new `sb_publishable_`/`sb_secret_` pair, no legacy keys were copied.
- Blocker carried forward: live GitHub Actions confirmation + branch protection on `main` (see User Setup Required above) should be completed before relying on the CI gate to actually block a bad merge.

## Self-Check: PASSED

All 14 created/modified files verified present on disk; all 3 task commits (`fcab827`, `ca417a4`, `91dec2e`) verified present in git history.

---
*Phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p*
*Completed: 2026-07-31*
