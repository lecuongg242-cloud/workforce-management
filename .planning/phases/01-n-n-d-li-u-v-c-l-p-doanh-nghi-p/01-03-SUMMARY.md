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
  - "Task 1's Management API auto-revoke attempt was not performed: SUPABASE_ACCESS_TOKEN is not set in this environment, so there is no credential to call https://api.supabase.com/v1/projects/{ref}/api-keys with. Went straight to documenting the dashboard path (Task 2) rather than attempting a call that could only fail on auth, per the plan's own fallback instruction (no API path available -> Task 2 handles it)."
  - "check:secrets scans BOTH .next/static and .next/server/app, not just .next/static — verified necessary empirically: the teeth-check leak (SUPABASE_SECRET_KEY read into a Client Component prop) surfaced in the prerendered .next/server/app/login.html, not under .next/static/. A static-only scan would have missed this exact leak shape."
  - "The plan's literal dependency-diff acceptance criteria script uses `origin/main`, which on this fork's remote is a near-empty stub commit (README.md only, 1 line). Re-ran the same check against `main` (local branch, holds the real V1 baseline package.json) instead — same intent (prove zero new npm dependencies), correct base ref for this repo's actual state."
  - "Build instability discovered and worked around, not a plan deviation: `npx next build` intermittently fails with `PageNotFoundError: Cannot find module for page: /_document` or an ENOENT on `.next/server/pages-manifest.json` when built on top of a stale `.next`/`node_modules/.cache` (this project's `outputFileTracingRoot` override for the parent-lockfile workaround appears to interact badly with incremental rebuilds on Windows). `rm -rf .next node_modules/.cache` before every build made it reliably green (exit 0) every time. Documented here so a future phase doesn't waste time debugging it as a real bug."

patterns-established:
  - "scripts/*.mjs convention: built-in Node 22 modules only (node:fs, node:path, node:process), zero new npm dependencies, matching scripts/db.mjs from 01-01"

requirements-completed: []
# AUTH-06 intentionally NOT marked complete — Task 2 (legacy key revocation on the
# Supabase dashboard) is still pending human action. Will be added to
# requirements-completed by the continuation agent once Task 2's verification
# (legacy key -> HTTP 401) is confirmed.

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
    description: "Legacy HS256 key pair (anon/service_role) revoked on the Supabase dashboard for project ujvgagujfsdrlmjdhooi; GET {SUPABASE_URL}/rest/v1/ with the legacy service_role key returns HTTP 401 instead of 200"
    requirement: "AUTH-06"
    verification: []
    human_judgment: true
    rationale: "Revoking the legacy key pair is a Supabase dashboard action with no CLI/API path available in this environment (no SUPABASE_ACCESS_TOKEN configured for the Management API). This is exactly the plan's own checkpoint:human-action gate (Task 2) — blocking-human, cannot be auto-approved. As of this SUMMARY, GET {SUPABASE_URL}/rest/v1/ with the legacy service_role key still returns HTTP 200 (confirmed empirically) and GET with the new secret key also returns HTTP 200. AUTH-06 is not complete until this flips to 401 for the legacy key."

duration: 19min (Tasks 1 and 3 only; Task 2 pending)
completed: 2026-07-31
status: blocked
---

# Phase 1 Plan 3: Supabase Key Rotation and Client-Bundle Secret Scan Summary

**`.env.local` confirmed clean to the four current-model variables, `.env.example` as a committed value-free contract, `docs/env` demoted from key store to a pointer note, and a from-scratch `scripts/check-bundle-secrets.mjs` (`npm run check:secrets`) that scans both `.next/static` and `.next/server/app` and was proven — with a real temporary leak — to actually catch a secret landing in prerendered HTML. Legacy Supabase key revocation (Task 2) is a dashboard-only action still awaiting the checkpoint below.**

## Performance

- **Duration:** ~19 min (Tasks 1 and 3; Task 2 is a `checkpoint:human-action` gate, not yet resolved)
- **Started:** 2026-07-31T13:02:00Z (approx, continuing directly after 01-02)
- **Completed (this session):** 2026-07-31T13:21:26Z — plan not yet fully complete, stopped at Task 2's checkpoint
- **Tasks:** 2 of 3 executed (Task 1: auto, Task 3: auto); Task 2 (checkpoint:human-action) pending
- **Files modified:** 5

## Accomplishments
- Verified `.env.local` (already gitignored, never committed) holds exactly the four current-model variables from 01-01 — no legacy key names present, exactly one `NEXT_PUBLIC_` variable
- Added `.env.example` as the committed, value-free environment-variable contract for CI / new machines / Phase 2
- Demoted `docs/env` from key store to a pointer note; updated `README.md`'s security section to match; kept the existing `.gitignore` coverage for `docs/env` and `docs/env.*` untouched (already correct)
- Built `scripts/check-bundle-secrets.mjs` from scratch (built-in Node 22 only, zero new dependencies) and wired `npm run check:secrets`
- Proved the scan gate has real teeth: a temporary secret leak in a Client Component was caught (in `.next/server/app/login.html`, not `.next/static/` — validating the plan's decision to scan both roots), then confirmed green again after reverting and rebuilding
- Confirmed via direct `fetch()` calls that the legacy `service_role` key still returns HTTP 200 against `{SUPABASE_URL}/rest/v1/` — establishing the exact "before" state Task 2 must flip to 401

## Task Commits

Each task was committed atomically:

1. **Task 1: Chuyen sang mo hinh khoa hien hanh va thu hoi cap legacy** - `f19b5f8` (feat) — `.env.local` verification, `.env.example`, `docs/env` demotion, `README.md` update
2. **Task 3: Lenh kiem tra khoa bi mat lot xuong client bundle** - `f467a09` (feat) — `scripts/check-bundle-secrets.mjs`, `check:secrets` npm script

_Task 2 (checkpoint:human-action, gate="blocking") has no commit yet — awaiting the legacy key revocation on the Supabase dashboard._

## Files Created/Modified
- `.env.example` - four-variable env contract, no real values, committed (not gitignored, per `.gitignore`'s `!.env.example` exception)
- `docs/env` - demoted from key store to a pointer note referencing `.env.example`; still gitignored, never committed
- `README.md` - "Bảo mật" section updated to point at `.env.local`/`.env.example` instead of `docs/env`
- `scripts/check-bundle-secrets.mjs` - new; scans `.next/static` + `.next/server/app` for secret values and fixed secret-key markers, built-in Node 22 only
- `package.json` - added `check:secrets` script

## Decisions Made
- Skipped the Management API auto-revoke attempt (no `SUPABASE_ACCESS_TOKEN` available in this environment) and went straight to preparing the dashboard-based Task 2 checkpoint — see `key-decisions` in frontmatter.
- Scoped the bundle scanner to scan `.next/server/app` in addition to `.next/static`, which turned out to be load-bearing: the proof-of-teeth leak landed in prerendered HTML under `server/app`, not `static/`.
- Verified the "zero new dependencies" acceptance criterion against `main` (local branch, real V1 baseline) instead of `origin/main` (a near-empty stub on this fork's remote) — see `key-decisions`.
- Diagnosed and worked around a pre-existing, non-deterministic Next.js build failure (`_document` / `pages-manifest.json` errors) tied to stale `.next`/`node_modules/.cache` interacting with this project's `outputFileTracingRoot` workaround for the parent-directory lockfile; `rm -rf .next node_modules/.cache` before every build made it reliably green. Not a plan deviation (no code fix needed, no plan-scope file touched) — documented for future phases running `next build`.

## Deviations from Plan

### Auto-fixed Issues

None — Rules 1-3 did not apply. The two items below are process/decision notes, not code fixes:

- **[Decision] Management API path skipped for lack of credentials.** Documented above; no code change, feeds directly into the Task 2 checkpoint.
- **[Decision] Acceptance-criteria base ref corrected from `origin/main` to `main`.** The dependency-diff check in Task 3's acceptance criteria literally names `origin/main`; on this fork `origin/main` is a 1-line stub unrelated to the actual project history. Re-ran the identical check against `main` (the correct base) to verify the real intent (zero new npm dependencies) — confirmed pass. No plan or requirements change; this is a verification-script environment mismatch, not a deviation in delivered behavior.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None — all planned Task 1 and Task 3 behavior delivered as specified; the two decisions above are about how verification was carried out in this specific environment, not changes to what was built.

## Issues Encountered
- Intermittent `next build` failures traced to stale `.next`/`node_modules/.cache` (see Decisions Made) — resolved by clearing both before each build; no source-level fix needed and no plan file touched to work around it.
- `git merge-base HEAD origin/main` failed outright (`fatal: path 'package.json' exists on disk, but not in '3ad8384...'`) because `origin/main` predates the real project history on this fork's remote — resolved by using `main` instead (see Decisions Made).

## User Setup Required

**Blocking checkpoint reached — see below.** External Supabase dashboard action required before this plan (and AUTH-06) can be marked complete.

## Next Phase Readiness
- `.env.example` is now the durable contract for required environment variables — Phase 2 (Supabase Auth) should read variable names from there, not from `docs/env`.
- `npm run check:secrets` is reusable as-is for every future phase that touches client-facing code — run it after any `next build` to catch new leaks before they ship.
- **Blocked:** AUTH-06 cannot be marked complete, and this plan cannot be closed out, until the legacy Supabase key pair is revoked (Task 2) and `GET {SUPABASE_URL}/rest/v1/` with the legacy `service_role` key returns HTTP 401. See `CHECKPOINT REACHED` in the executor's return message for exact dashboard steps.

## Self-Check: PASSED

Both created files verified present on disk (`.env.example`, `scripts/check-bundle-secrets.mjs`); `docs/env`, `README.md`, `package.json` modifications verified present; both task commits (`f19b5f8`, `f467a09`) verified present in git history via `git log`.

---
*Phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p*
*Status at this checkpoint: blocked on Task 2 (human-action) — 2026-07-31*
