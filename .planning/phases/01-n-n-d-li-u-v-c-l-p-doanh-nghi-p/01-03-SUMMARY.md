---
phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p
plan: 03
subsystem: auth
tags: [supabase, secrets, env, nextjs, bundle-scan, key-rotation]

# Dependency graph
requires:
  - phase: 01-01
    provides: ".env.local (gitignored) already holding the new sb_publishable_/sb_secret_ pair + POSTGRES_URL_NON_POOLING, scripts/db.mjs npm-script conventions"
provides:
  - ".env.example — committed env-var contract (names only, no values)"
  - "docs/env demoted from key store to a pointer note; README.md security section updated to match"
  - "scripts/check-bundle-secrets.mjs + npm run check:secrets — reusable gate proving no secret leaks into .next/static or .next/server/app, proven to have teeth against a real leak"
affects: []

actuals:
  tokens: 9500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Bundle-secret scan pattern: forbidden-string list built from (a) actual values of every non-NEXT_PUBLIC_ var in .env.local longer than 12 chars, plus (b) fixed Supabase secret-key prefix (sb_secret_) and legacy key variable names; scans .next/static AND .next/server/app (prerendered HTML lands in server/app, not static/)"
    - "Zero-file / zero-artifact gates: check:secrets exits 1 (never a silent pass) when .next/static is missing or when the scan touches zero text files"

key-files:
  created:
    - .env.example
    - scripts/check-bundle-secrets.mjs
  modified:
    - docs/env
    - README.md
    - package.json

key-decisions:
  - "Task 1's Management API auto-revoke attempt was not performed: SUPABASE_ACCESS_TOKEN is not set in this environment, so there is no credential to call https://api.supabase.com/v1/projects/{ref}/api-keys with. This is what surfaced the Task 2 checkpoint in the first place."
  - "check:secrets scans BOTH .next/static and .next/server/app, not just .next/static — verified necessary empirically: the teeth-check leak (SUPABASE_SECRET_KEY read into a Client Component prop) surfaced in the prerendered .next/server/app/login.html, not under .next/static/. A static-only scan would have missed this exact leak shape."
  - "The plan's literal dependency-diff acceptance criteria script uses `origin/main`, which on this fork's remote is a near-empty stub commit (README.md only, 1 line). Re-ran the same check against `main` (local branch, holds the real V1 baseline package.json) instead — same intent (prove zero new npm dependencies), correct base ref for this repo's actual state."
  - "Build instability discovered and worked around, not a plan deviation: `npx next build` intermittently fails with `PageNotFoundError: Cannot find module for page: /_document` or an ENOENT on `.next/server/pages-manifest.json` when built on top of a stale `.next`/`node_modules/.cache` (this project's `outputFileTracingRoot` override for the parent-lockfile workaround appears to interact badly with incremental rebuilds on Windows). `rm -rf .next node_modules/.cache` before every build made it reliably green (exit 0) every time. Documented here so a future phase doesn't waste time debugging it as a real bug."
  - "**AUTH-06 narrowed by product decision on 2026-07-31, after this plan's Task 1/3 landed and while Task 2 sat at its checkpoint.** The project owner reviewed the Task 2 checkpoint (legacy Supabase key revocation, dashboard-only, blocked on missing SUPABASE_ACCESS_TOKEN) and decided to move 'revoke & reissue the legacy Supabase key pair' entirely out of scope, rather than complete it later. This is a cancellation, not a deferral: the measured facts behind the decision (key never entered git history, docs/env never committed, no JWT anywhere in the repo) are recorded in REQUIREMENTS.md and PROJECT.md §Out of Scope, alongside the accepted risk (the legacy service_role key remains live and bypasses all 52+ RLS policies from Phase 1 for anyone holding it). AUTH-06 itself was narrowed to keep only its bundle-leak clause, which this plan's Task 3 already fully delivered and verified — so AUTH-06 is complete as redefined."

patterns-established:
  - "scripts/*.mjs convention: built-in Node 22 modules only (node:fs, node:path, node:process), zero new npm dependencies, matching scripts/db.mjs from 01-01"

requirements-completed: [AUTH-06]
# AUTH-06 marked complete under its narrowed 2026-07-31 definition: "no secret key
# reaches the client bundle" (delivered and verified by Task 3). The original
# second clause ("revoke & reissue the legacy Supabase key pair", Task 2) was
# moved to Out of Scope by deliberate product decision, not completed and not
# still pending — see key-decisions above and REQUIREMENTS.md §Out of Scope.

coverage:
  - id: D1
    description: ".env.local holds exactly the four current-model variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, POSTGRES_URL_NON_POOLING), no legacy key names present, exactly one NEXT_PUBLIC_ variable; .env.example committed as a value-free contract; docs/env demoted to a pointer note"
    requirement: "AUTH-06"
    verification:
      - kind: unit
        ref: "node -e env-local content checks (legacy-key-absence, required-key-presence, single-public-var) -> pass; test -f .env.example && no-values-in-.env.example check -> pass"
        status: pass
      - kind: integration
        ref: "npm run test:rls (79/79 pgTAP assertions) after .env.local confirmed clean -> pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "scripts/check-bundle-secrets.mjs + npm run check:secrets scans .next/static and .next/server/app for secret values / secret-key markers, exits non-zero with no build present, exits non-zero on zero files scanned, and was proven to catch a real leak (SUPABASE_SECRET_KEY surfaced via a Client Component) then confirmed green again after reverting"
    requirement: "AUTH-06"
    verification:
      - kind: integration
        ref: "npm run build && npm run check:secrets -> exit 0, 146 files scanned; rm -rf .next && npm run check:secrets -> exit 1 (build-first message); temp leak in login-form.tsx -> npm run build && npm run check:secrets -> exit 1 (caught in .next/server/app/login.html); revert -> rebuild -> exit 0 again"
        status: pass
    human_judgment: false
  - id: D3
    description: "Legacy HS256 key pair (anon/service_role) revocation on the Supabase dashboard — CANCELLED by product decision on 2026-07-31, not completed and not pending. Legacy service_role key remains active and bypasses RLS; this is a recorded, accepted risk, not an open item."
    requirement: "AUTH-06"
    verification: []
    human_judgment: true
    rationale: "This deliverable was removed from AUTH-06's definition entirely (see key-decisions and REQUIREMENTS.md/PROJECT.md §Out of Scope), so it has no pass/fail verification to report — it is out of scope, not unverified. human_judgment stays true only because the underlying accepted-risk decision is a human/product call, not something a future automated check should re-open on its own."

duration: 19min (Tasks 1 and 3; Task 2 cancelled, not executed)
completed: 2026-07-31
status: complete
---

# Phase 1 Plan 3: Client-Bundle Secret Scan (AUTH-06, Narrowed Scope) Summary

**`.env.local` confirmed clean to the four current-model variables, `.env.example` as a committed value-free contract, `docs/env` demoted from key store to a pointer note, and a from-scratch `scripts/check-bundle-secrets.mjs` (`npm run check:secrets`) that scans both `.next/static` and `.next/server/app` and was proven — with a real temporary leak — to actually catch a secret landing in prerendered HTML. Legacy Supabase key revocation (originally Task 2) was cancelled by deliberate product decision on 2026-07-31 and moved to Out of Scope; AUTH-06 was narrowed to match and is complete under its new definition.**

## Performance

- **Duration:** ~19 min (Tasks 1 and 3; Task 2 was cancelled at its checkpoint, not executed)
- **Started:** 2026-07-31T13:02:00Z (approx, continuing directly after 01-02)
- **Completed:** 2026-07-31T13:21:26Z (Tasks 1+3); scope-narrowing decision and this SUMMARY's bookkeeping update applied later the same day, 2026-07-31
- **Tasks:** 2 of the original 3 executed (Task 1: auto, Task 3: auto); Task 2 (checkpoint:human-action) cancelled by product decision, never executed
- **Files modified:** 5 (Tasks 1+3) + 3 shared planning docs updated by the product-decision bookkeeping pass (REQUIREMENTS.md, PROJECT.md, ROADMAP.md — not owned by this plan, listed here for traceability only)

## Accomplishments
- Verified `.env.local` (already gitignored, never committed) holds exactly the four current-model variables from 01-01 — no legacy key names present, exactly one `NEXT_PUBLIC_` variable
- Added `.env.example` as the committed, value-free environment-variable contract for CI / new machines / Phase 2
- Demoted `docs/env` from key store to a pointer note; updated `README.md`'s security section to match; kept the existing `.gitignore` coverage for `docs/env` and `docs/env.*` untouched (already correct)
- Built `scripts/check-bundle-secrets.mjs` from scratch (built-in Node 22 only, zero new dependencies) and wired `npm run check:secrets`
- Proved the scan gate has real teeth: a temporary secret leak in a Client Component was caught (in `.next/server/app/login.html`, not `.next/static/` — validating the plan's decision to scan both roots), then confirmed green again after reverting and rebuilding
- Confirmed via direct `fetch()` calls that the legacy `service_role` key returned HTTP 200 against `{SUPABASE_URL}/rest/v1/` at the time of the checkpoint — this measurement fed directly into the product decision to accept the risk rather than chase revocation

## Task Commits

Each task was committed atomically:

1. **Task 1: Chuyen sang mo hinh khoa hien hanh va thu hoi cap legacy (automated portion)** - `f19b5f8` (feat) — `.env.local` verification, `.env.example`, `docs/env` demotion, `README.md` update
2. **Task 3: Lenh kiem tra khoa bi mat lot xuong client bundle** - `f467a09` (feat) — `scripts/check-bundle-secrets.mjs`, `check:secrets` npm script

_Task 2 (checkpoint:human-action, gate="blocking") — CANCELLED. No commit exists and none is expected: the legacy key revocation this task described was moved to Out of Scope rather than performed. This is the intended terminal state for Task 2, not an incomplete task._

## Files Created/Modified
- `.env.example` - four-variable env contract, no real values, committed (not gitignored, per `.gitignore`'s `!.env.example` exception)
- `docs/env` - demoted from key store to a pointer note referencing `.env.example`; still gitignored, never committed
- `README.md` - "Bảo mật" section updated to point at `.env.local`/`.env.example` instead of `docs/env`
- `scripts/check-bundle-secrets.mjs` - new; scans `.next/static` + `.next/server/app` for secret values and fixed secret-key markers, built-in Node 22 only
- `package.json` - added `check:secrets` script

## Decisions Made
- Skipped the Management API auto-revoke attempt (no `SUPABASE_ACCESS_TOKEN` available in this environment) and surfaced the dashboard-based Task 2 as a `checkpoint:human-action` — see `key-decisions` in frontmatter.
- Scoped the bundle scanner to scan `.next/server/app` in addition to `.next/static`, which turned out to be load-bearing: the proof-of-teeth leak landed in prerendered HTML under `server/app`, not `static/`.
- Verified the "zero new dependencies" acceptance criterion against `main` (local branch, real V1 baseline) instead of `origin/main` (a near-empty stub on this fork's remote) — see `key-decisions`.
- Diagnosed and worked around a pre-existing, non-deterministic Next.js build failure (`_document` / `pages-manifest.json` errors) tied to stale `.next`/`node_modules/.cache` interacting with this project's `outputFileTracingRoot` workaround for the parent-directory lockfile; `rm -rf .next node_modules/.cache` before every build made it reliably green. Not a plan deviation (no code fix needed, no plan-scope file touched) — documented for future phases running `next build`.
- **Product decision, 2026-07-31 (post-checkpoint): cancelled Task 2 entirely.** The project owner reviewed the checkpoint (legacy key still returns HTTP 200, no automatable path available) and chose to accept the risk permanently rather than perform the dashboard revocation, narrowing AUTH-06's definition accordingly. See `key-decisions` in frontmatter for the full rationale and `.planning/REQUIREMENTS.md` / `.planning/PROJECT.md` §Out of Scope for the canonical record.

## Deviations from Plan

### Auto-fixed Issues

None — Rules 1-3 did not apply. The items below are process/decision notes, not code fixes:

- **[Decision] Management API path skipped for lack of credentials.** Documented above; no code change, this is what produced the Task 2 checkpoint.
- **[Decision] Acceptance-criteria base ref corrected from `origin/main` to `main`.** The dependency-diff check in Task 3's acceptance criteria literally names `origin/main`; on this fork `origin/main` is a 1-line stub unrelated to the actual project history. Re-ran the identical check against `main` (the correct base) to verify the real intent (zero new npm dependencies) — confirmed pass. No plan or requirements change; this is a verification-script environment mismatch, not a deviation in delivered behavior.
- **[Rule 4 - Architectural/Scope, resolved by product owner] Task 2 (legacy key revocation) descoped.** This is the one item in this plan that went through Rule 4 as designed: the checkpoint stopped and asked, and the product owner's answer was to remove the requirement rather than approve the dashboard action. Recorded as a scope decision, not an auto-fix.

---

**Total deviations:** 0 auto-fixed; 1 scope decision (Task 2 cancelled by product owner)
**Impact on plan:** Tasks 1 and 3 delivered exactly as specified. Task 2 was never executed — by design, following the checkpoint's outcome. AUTH-06 is complete under its narrowed definition.

## Issues Encountered
- Intermittent `next build` failures traced to stale `.next`/`node_modules/.cache` (see Decisions Made) — resolved by clearing both before each build; no source-level fix needed and no plan file touched to work around it.
- `git merge-base HEAD origin/main` failed outright (`fatal: path 'package.json' exists on disk, but not in '3ad8384...'`) because `origin/main` predates the real project history on this fork's remote — resolved by using `main` instead (see Decisions Made).

## User Setup Required

None. The one external action this plan originally required (Supabase dashboard key revocation) was cancelled by product decision rather than deferred — there is nothing outstanding for a human to do on this plan.

**Accepted risk, not a to-do:** the legacy `service_role` key remains active and bypasses RLS. This is a recorded, deliberate risk acceptance (see `.planning/REQUIREMENTS.md` / `.planning/PROJECT.md` §Out of Scope), not an action item.

## Next Phase Readiness
- `.env.example` is now the durable contract for required environment variables — Phase 2 (Supabase Auth) should read variable names from there, not from `docs/env`.
- `npm run check:secrets` is reusable as-is for every future phase that touches client-facing code — run it after any `next build` to catch new leaks before they ship.
- AUTH-06 is complete under its narrowed definition; nothing further required from this plan. Phase 1's remaining plans (01-04/01-05/01-06) are independent of this outcome and had already landed by the time this scope decision was made.
- Carry-forward awareness for anyone touching Supabase key configuration later: the legacy `service_role`/`anon` HS256 pair is still live and still bypasses RLS. If a future phase or incident response ever needs to revisit that decision, the measured facts and rationale are in `.planning/REQUIREMENTS.md` §Out of Scope.

## Self-Check: PASSED

Both created files verified present on disk (`.env.example`, `scripts/check-bundle-secrets.mjs`); `docs/env`, `README.md`, `package.json` modifications verified present; both task commits (`f19b5f8`, `f467a09`) verified present in git history via `git log`.

---
*Phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p*
*Completed: 2026-07-31 (AUTH-06 complete under narrowed scope; Task 2 cancelled by product decision)*
