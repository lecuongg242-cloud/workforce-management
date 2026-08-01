---
phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
plan: 10
subsystem: auth
tags: [supabase-admin-api, forced-password-change, jwt-app-metadata, middleware, audit-log]

requires:
  - phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi (plan 02-04, plan 02-09)
    provides: >
      resolveGate() pure function and getSessionContext()/requireRole() identity choke point
      (02-04) that this plan extends with a third gate input; the Route Handler + Server
      Action + audit pattern replicated five times through 02-09, which this plan's
      createEmployeeAccount follows for the sixth and final account-lifecycle write path.
provides:
  - "createAdminSupabase() (src/lib/supabase/admin.ts) — secret-key client, scope-limited to server-only modules, guarded by a mechanical test that scans all of src/ for importers"
  - "createEmployeeAccount(employeeId) (src/lib/data/mutations/accounts.ts) — owner/admin-only Server Action creating a real Supabase Auth account for an employee, one-time temp-password reveal, audit_log row with an assertion that no snapshot field looks like a password"
  - "completeForcedPasswordChange(newPassword) — six-step mandatory-order Server Action: change password -> clear app_metadata flag -> refresh session in the SAME request (D-16a), with one retry on refresh-token-rotation conflict and two distinct never-merged error messages"
  - "middleware.ts resolveGate() gains a third input, mustChangePassword, read from the JWT app_metadata claim (no DB query) — flag-on redirects everywhere except /doi-mat-khau and /login, including /select-company (the easiest bypass to miss)"
  - "/doi-mat-khau route (page.tsx + change-password-form.tsx)"
  - "admin-client-scope.test.ts (secret-key import scope gate) + 11 new middleware-gate.test.ts cases + accounts.test.ts (order/anti-trap behavior), all with sabotage-and-revert proof recorded"
affects: ["02-11"]

actuals:
  tokens: 15900
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Forced-password-change flag lives in JWT app_metadata (never user_metadata, D-16) so middleware.ts can gate on it without a database round trip — same shape as createEmployeeAccount's account creation in 02-03's seed-auth.mjs"
    - "Mandatory six-step order for completeForcedPasswordChange (D-16a): change password -> clear server-side flag -> refreshSession() in the SAME request, before any redirect. Getting steps 2 and 3 out of order is exactly the trap D-16a exists to prevent, and a test asserts the call order directly rather than just asserting the end state."
    - "Two never-merged error message families for the password-change flow: 'not changed yet, retry' vs 'changed but session refresh failed, log in again' — a test asserts the two strings are literally unequal, because merging them is what produces a user who retries with their old password."

key-files:
  created:
    - src/lib/supabase/admin.ts
    - "src/app/(auth)/doi-mat-khau/page.tsx"
    - "src/app/(auth)/doi-mat-khau/change-password-form.tsx"
    - src/__tests__/admin-client-scope.test.ts
    - src/__tests__/lib/admin-client-scope-check.ts
    - src/lib/data/__tests__/accounts.test.ts
  modified:
    - src/lib/data/mutations/accounts.ts
    - src/middleware.ts
    - src/lib/validation/schemas.ts
    - "src/app/admin/employees/[id]/employee-detail-view.tsx"
    - src/lib/constants.ts
    - src/__tests__/middleware-gate.test.ts
    - src/lib/types/domain.ts
    - src/lib/validation/api/employees.ts
    - src/lib/data/__tests__/employees.test.ts

key-decisions:
  - "createEmployeeAccount matches scripts/seed-auth.mjs's (02-03) account-creation shape exactly (email_confirm:true D-14a, must_change_password in app_metadata D-16) so accounts created through either path behave identically."
  - "audit_log snapshots for auth.users changes are NOT full-row snapshots — they carry only { must_change_password: true/false }, never the encrypted password hash, an explicit and commented exception to D-18's usual 'store the whole row' rule."
  - "The forced-password-change gate blocks /select-company specifically, not just /admin and /employee — this is called out in the plan as 'the easiest bypass to miss' and is covered by its own middleware-gate.test.ts case."

requirements-completed: []

coverage:
  - id: D1
    description: "Secret-key admin client (src/lib/supabase/admin.ts) is importable only from server-only modules; no client component or *-view.tsx file can import it; a mechanical gate scans all of src/ and proves it is not blind by fabricating a violation."
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "src/__tests__/admin-client-scope.test.ts, >=5 assertions incl. a self-check that the analyzer detects a fabricated \"use client\" + admin-import violation"
        status: pass
      - kind: other
        ref: "npm run build && npm run check:secrets (part of Task 1's <verify>) — secret key confirmed not to reach the browser bundle"
        status: pass
    human_judgment: false

  - id: D2
    description: "Owner/admin creates a real Supabase Auth account for an employee via the UI, receives a one-time temp password, and the operation leaves exactly one audit_log row with no password trace in before/after."
    requirement: "AUTH-04"
    verification: []
    human_judgment: true
    rationale: "The plan's acceptance criteria require live psql counts (employees.user_id null count decreasing by 1, memberships +1, audit_log +1, a text-search over audit_log for password-shaped strings returning 0) against the cloud database around a real UI action. No SUMMARY existed to record that this was ever run, and it is not re-run here since this recovery task is documentation-only and must not mutate live data."

  - id: D3
    description: "middleware.ts blocks a flagged (must_change_password=true) session from every page except /doi-mat-khau and /login, including /select-company; an unflagged session is bounced away from /doi-mat-khau itself."
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "src/__tests__/middleware-gate.test.ts, 14 total cases (8 from 02-04 + 6 new), incl. the /select-company-specific redirect case"
        status: pass
      - kind: e2e
        ref: "scripts/e2e-auth.mjs section B (\"Cong buoc doi mat khau\"), commit 9295a20: real HTTP against /admin/dashboard, /select-company, /employee with a flagged session's real cookie — all confirmed redirected to /doi-mat-khau; /doi-mat-khau itself confirmed to open (200)"
        status: pass
    human_judgment: false

  - id: D4
    description: "D-16a anti-trap mechanism: clearing the JWT flag via Admin API does not, by itself, un-trap an already-issued token; only a forced token refresh does, and the app performs that refresh in the same request before redirecting."
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/accounts.test.ts, 5 assertions incl. exact call-order proof and exactly-one-retry-on-rotation-conflict"
        status: pass
      - kind: e2e
        ref: "scripts/e2e-auth.mjs section C, commit 9295a20 — 5-step live sequence against the real Supabase project: (1) login gets a flagged JWT, (2) flag cleared via Admin API, (3) the OLD cookie is confirmed STILL bounced to /doi-mat-khau (the control proving the trap is real), (4) refresh_token grant produces a new JWT with the flag cleared, (5) the NEW cookie reaches /admin/dashboard with 200. Script restores the flag to true afterward so it leaves no residue in the account used for later UAT."
        status: pass
    human_judgment: true
    rationale: "The unit tests and the live e2e sequence together prove the server-side refresh mechanism is real and required — about as strong as automated evidence gets for a JWT-timing bug. What remains unverified is the client-side UX during the transition: whether a user physically clicks 'change password' in the real UI and lands past the gate without a manual page reload. The e2e script checks HTTP status codes only, not client-side navigation behavior."

  - id: D5
    description: "Whole account lifecycle via the real admin UI: owner opens an unlinked employee's profile, creates an account, reads the one-time password from a dialog that never shows it twice, the new user logs in, is forced to /doi-mat-khau, changes password without a manual reload, logs back in with the new password, and the old temp password is rejected."
    requirement: "AUTH-04"
    verification: []
    human_judgment: true
    rationale: "This is Task 4's full 9-step UAT. No SUMMARY was ever written to record that it happened, and none of the automated scripts in the repository (Vitest suites or scripts/e2e-auth.mjs) exercise the account-creation-through-the-UI step or the one-time-dialog-reveal behavior specifically — only the password-change gate and anti-trap sequence downstream of an account already existing are machine-verified (see D3/D4)."

duration: 13min (tasks 1-3, commit timestamps 18:01-18:14); Task 4 (checkpoint) never resumed
completed: 2026-08-01
status: partial
---

# Phase 2 Plan 10: Account lifecycle closes — admin creates, JWT forces a password change Summary

**A scope-limited secret-key admin client with a mechanical import-scope gate, a Server Action that creates real Supabase Auth accounts the same way `scripts/seed-auth.mjs` (02-03) does, a `middleware.ts` gate that reads the forced-password-change flag straight out of the JWT with no DB query, and a six-step password-change flow whose D-16a anti-trap ordering is enforced by both a unit test and — as of a later commit — a live JWT-refresh sequence over real HTTP. Tasks 1-3 are done and green. Task 4's 9-step browser UAT was never performed; its two most JWT-timing-sensitive claims (the forced gate itself, and the anti-trap refresh) are now independently machine-verified, but the actual click-through of creating an account and reading a one-time password out of a dialog remains unverified.**

## Performance

- **Started:** 2026-08-01 ~18:01 (Task 1, commit `7022689`)
- **Tasks 1-3 completed:** 2026-08-01 ~18:14 (commit `8ad52a6`) — roughly 13 minutes
- **Task 4 (checkpoint:human-verify):** never resumed. No SUMMARY.md existed to record it, which is why this plan had to be reconstructed.
- **Tasks:** 3 of 4 done and verified; 1 of 4 (Task 4, 9-step browser UAT) not performed
- **Files modified:** 15 (6 created, 9 modified)

## Accomplishments

- **`createAdminSupabase()`** (`src/lib/supabase/admin.ts`) uses `@supabase/supabase-js` (not `@supabase/ssr` — this client never binds to cookies or holds a session), throws by name on a missing `SUPABASE_SECRET_KEY`, and carries a comment stating it bypasses all RLS and must be called only from server-only modules that self-check authorization first.
- **`createEmployeeAccount(employeeId)`** requires `owner`/`admin` role, re-reads the target employee row scoped to the caller's own `company_id` via the cookie-bound client (so RLS still gets a say before the secret-key client is ever touched), rejects a second account creation for an already-linked employee without touching the existing account, generates a temp password with `node:crypto`, creates the Supabase Auth account with `email_confirm:true` and `must_change_password` in `app_metadata` (matching `scripts/seed-auth.mjs`'s shape exactly), links `memberships`/`employees.user_id`, and writes one `audit_log` row — with a runtime assertion, not just an assumption, that neither snapshot contains anything password-shaped.
- **`middleware.ts`'s `resolveGate()`** gains a third input, `mustChangePassword`, read straight from the JWT's `app_metadata` claim already produced by `updateSession()` — no database query needed, which is the entire reason D-16 puts the flag in the JWT. When the flag is on, every path except `/doi-mat-khau` and `/login` redirects to `/doi-mat-khau`, explicitly including `/select-company` (flagged in the plan text as the easiest bypass to miss). When the flag is off, `/doi-mat-khau` itself bounces away — to `/admin/dashboard` if the user has claims, `/login` otherwise.
- **`completeForcedPasswordChange(newPassword)`** enforces a mandatory six-step order (D-16a): verify the flag is actually on (reject otherwise, so this Server Action can't be repurposed as a general password-change endpoint) -> `auth.updateUser({ password })` on the cookie-bound client -> clear the flag via the admin client -> `refreshSession()` **in the same request** so the response cookie already carries a clean token -> one retry if the refresh hits a refresh-token-rotation conflict -> `logMutation()` with a `{ must_change_password: true/false }` snapshot (never a full-row snapshot of `auth.users`, an explicit exception to D-18 documented in-code). Two distinct, never-merged error messages separate "password not changed yet" from "password changed but the session didn't refresh — log in again."
- **`/doi-mat-khau`** (page + client form) follows the same `useForm`+`zodResolver` shape as the login form, inheriting the auth-group gradient layout automatically.
- **Test coverage**: `admin-client-scope.test.ts` (secret-key import-scope gate, self-proven non-blind), 6 new `middleware-gate.test.ts` cases (14 total with 02-04's 8), and `accounts.test.ts` (5 assertions on call order and anti-trap behavior, not on API-call presence). Two sabotage-and-revert proofs recorded in the commit: reversing the accounts.ts step order flipped the gate to non-zero, and removing the `/select-company` block from `resolveGate` did the same; both reverted to green.

## Task Commits

1. **Task 1: Scoped admin client + createEmployeeAccount Server Action** - `7022689` (feat)
2. **Task 2: Forced password-change gate at middleware + change-password page** - `d4eb7e2` (feat)
3. **Task 3: Test coverage for the gate and the anti-trap sequence** - `8ad52a6` (test)
4. **Task 4: Manual UAT — full account lifecycle in a real browser** - not performed; no commit

**Supporting evidence commit, produced after this plan and after 02-11 (not part of this plan's own task list):**
- `9295a20` (test) — `scripts/e2e-auth.mjs` (`npm run test:e2e`) sections B and C independently re-prove this plan's password-change gate and D-16a anti-trap sequence over real HTTP against the live Supabase project.

## Files Created/Modified

- `src/lib/supabase/admin.ts` - scoped secret-key client
- `src/lib/data/mutations/accounts.ts` - `createEmployeeAccount`, `completeForcedPasswordChange`
- `src/middleware.ts` - `resolveGate()` gains `mustChangePassword` input
- `src/app/(auth)/doi-mat-khau/page.tsx`, `change-password-form.tsx` - the forced-change route
- `src/lib/validation/schemas.ts` - `changePasswordSchema`
- `src/app/admin/employees/[id]/employee-detail-view.tsx` - "Tạo tài khoản đăng nhập" button + one-time reveal dialog
- `src/lib/constants.ts` - Vietnamese labels for the account-lifecycle flow
- `src/lib/types/domain.ts`, `src/lib/validation/api/employees.ts` - `hasAccount` derived boolean so the UI knows account state without a second query
- `src/__tests__/admin-client-scope.test.ts` + `src/__tests__/lib/admin-client-scope-check.ts` - mechanical scope gate
- `src/lib/data/__tests__/accounts.test.ts`, `src/__tests__/middleware-gate.test.ts` - behavior tests

## Decisions Made

See `key-decisions` in the frontmatter. Summarized:
- `createEmployeeAccount` deliberately mirrors `scripts/seed-auth.mjs`'s account-creation shape so accounts from either path are indistinguishable.
- `audit_log` rows for `auth.users` changes carry only the flag, never a full row snapshot — an explicit, commented exception to D-18.
- The forced-password gate treats `/select-company` as a protected path, not just `/admin`/`/employee`.

## Deviations from Plan

None recorded beyond the sabotage-and-revert proofs already described in Accomplishments, which were part of the plan's own acceptance criteria, not unplanned work.

## Issues Encountered

None specific to this plan's own execution. (See 02-03-SUMMARY.md for the GoTrue-500 incident that affected the shared pool of seeded accounts this plan's UAT would have used.)

## User Setup Required

**Task 4's UAT still requires a human at a real browser**, using an employee account created through the admin UI (not `scripts/seed-auth.mjs`) to exercise the one-time password-reveal dialog and the full nine-step lifecycle described in the plan.

## Next Phase Readiness

- The forced-password-change flag now has a reader (`middleware.ts`) — before this plan, `scripts/seed-auth.mjs` set the flag on all 10 seeded accounts but nothing consumed it, exactly the gap D-16a warned about.
- **Machine-verified since this plan executed:** the forced gate itself and the D-16a anti-trap refresh sequence, both over real HTTP against the live project (`scripts/e2e-auth.mjs` sections B/C, commit `9295a20`).
- **Genuinely open:** the admin-UI account-creation click-through and one-time password dialog have no automated coverage at all — this is the one piece of Task 4 that neither the original plan's Vitest suite nor the later e2e script touches.

## Self-Check: PASSED

All six created files confirmed present on disk (`src/lib/supabase/admin.ts`, `src/app/(auth)/doi-mat-khau/page.tsx`, `change-password-form.tsx`, `src/__tests__/admin-client-scope.test.ts`, `src/__tests__/lib/admin-client-scope-check.ts`, `src/lib/data/__tests__/accounts.test.ts`). Commit hashes `7022689`, `d4eb7e2`, `8ad52a6`, `9295a20` confirmed present in `git log --oneline --all`.

---
*Phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi*
*Completed: 2026-08-01 (partial — see Status)*
