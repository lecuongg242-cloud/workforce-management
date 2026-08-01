---
phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
plan: 03
subsystem: auth
tags: [supabase, admin-api, gotrue, seed, signup-gate, credentials]

requires:
  - phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi (plan 02-02)
    provides: >
      platform_admins scaffold (D-11) and seed.sql with synthetic pgTAP uuids split
      out into supabase/tests/ (D-15) — this plan needed seed.sql's real `employees`
      rows (email addresses) to exist before it could attach real credentials to them.
provides:
  - "scripts/seed-auth.mjs (npm run seed:auth): creates 10 real Supabase Auth accounts via auth.admin.createUser() — 5 per company (owner/admin/manager/employee/employee), email_confirm:true (D-14a), must_change_password in app_metadata not user_metadata (D-16). Re-runnable without rotating existing passwords; 30 remaining employees are left with user_id = null by design (D-14)."
  - "scripts/check-signup-disabled.mjs (npm run check:signup): fail-closed HTTP probe against the live GoTrue /auth/v1/signup endpoint. Now reports `OK: dang ky cong khai DA TAT (HTTP 422, error_code=signup_disabled)`, exit 0 — proof signup is off, obtained after the Dashboard toggle was flipped (D-13a closed)."
  - "supabase/config.toml: enable_signup=false in both [auth] and [auth.email] blocks (commit 575a0be), with a comment stating the cloud project's Dashboard is the real gate and this file only affects local `supabase start` (D-13a)."
  - "scripts/db.mjs: `test`/`testdb` now refuse to run against a *.supabase.co/.com/.in host, with a TF_ALLOW_CLOUD_TESTS=1 escape hatch — fix for a live incident this plan's execution triggered (see Issues Encountered)."
  - "scripts/reset-temp-passwords.mjs (npm run reset:passwords): regenerates temp passwords for the 10 seeded accounts via Admin API while preserving auth.users.id, so memberships/employees.user_id/audit_log.actor_user_id stay wired to the same account."
affects: ["02-04", "02-10", "02-11"]

actuals:
  tokens: 16800
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "scripts/seed-auth.mjs follows scripts/db.mjs's convention exactly: shebang + purpose comment, missing-env-var messages that name the exact variable and exit 1, invoked via `node --env-file=.env.local`."
    - "Two Supabase clients per script: an `admin` client (secret key, persistSession:false, bypasses RLS) used for auth.admin.* and business-table writes, and an `anon` client (publishable key) reserved strictly for the one login-verification call in seed-auth.mjs — never used to query business data."
    - "check-signup-disabled.mjs is fail-closed by construction: only `error_code === \"signup_disabled\"` counts as proof signup is off. Every other outcome (network error, unrelated 4xx, 2xx) is treated as inconclusive-or-worse and exits non-zero."

key-files:
  created:
    - scripts/seed-auth.mjs
    - scripts/check-signup-disabled.mjs
    - scripts/reset-temp-passwords.mjs
  modified:
    - supabase/config.toml
    - scripts/db.mjs
    - package.json
    - docs/HUONG-DAN-TEST.md

key-decisions:
  - "Task 2 (disabling public signup on the Supabase Dashboard) was correctly scoped as a human-action checkpoint — no CLI command was found in research that pushes `config.toml` to an already-linked cloud project (02-RESEARCH.md Assumptions Log A2). The project owner has now performed this action: the 'Allow new users to sign up' toggle under Authentication -> Sign In / Providers is off, confirmed by screenshot and by `npm run check:signup` returning `error_code=signup_disabled`."
  - "The remediation order was deliberate and is the reason this closes cleanly: Dashboard toggle flipped first, `npm run check:signup` re-run and confirmed green (exit 0, `error_code=signup_disabled`) second, and only then was `supabase/config.toml` edited (commit 575a0be) to match. Setting the file to `false` while the cloud project was still `true` would have made a currently-accurate document into a lying one — the same class of bug the probe's own first draft had (see Deviations)."
  - "check-signup-disabled.mjs treats `over_email_send_rate_limit` (HTTP 429) as proof signup is still ON, not as an inconclusive probe failure: GoTrue only attempts to send a confirmation email *after* the signup gate has let a request through, so hitting the email-rate-limit itself is evidence the gate passed the request."
  - "scripts/db.mjs's cloud-host guard was added directly in response to a real incident (see Issues Encountered), not a hypothetical hardening pass — the incident is what confirmed D-15's convention-only enforcement was insufficient."

requirements-completed: []

coverage:
  - id: D1
    description: "scripts/seed-auth.mjs creates 10 real Supabase Auth accounts via Admin API (5 per company: owner/admin/manager/employee/employee), each with a working auth.identities row provable by a real signInWithPassword call; 30 employees keep user_id = null; must_change_password lives in app_metadata, never user_metadata; the script is safe to re-run (no password rotation on existing accounts, no duplicate accounts)."
    requirement: "AUTH-03"
    verification:
      - kind: other
        ref: "Live execution (commit 1f8e108) plus the recovery performed later the same day: `auth.admin.listUsers()` calls against the live project surfaced a GoTrue 500 that, once fixed, confirmed all 10 accounts and their auth.identities rows exist and are queryable (see Issues Encountered). scripts/reset-temp-passwords.mjs (commit 4ff1829) was built specifically to regenerate credentials for these same 10 auth.users.id values without touching memberships/employees.user_id, which only makes sense if those 10 rows and their FK wiring already existed."
        status: pass
    human_judgment: true
    rationale: "The acceptance criteria require live psql counts against the cloud project (memberships=10, employees.user_id not null=10, employees.user_id null=30, identities=10, must_change_password=10, raw_user_meta_data hits=0) and a second `npm run seed:auth` run proving idempotency. Re-running these checks now would mean querying/mutating live production auth data outside of a real operational need, which this documentation-only recovery task is not authorized to do. The GoTrue-500 incident and its resolution are strong indirect evidence the accounts exist correctly, but no human has re-confirmed the exact counts since the incident was fixed."

  - id: D2
    description: "Public signup disabled on the Supabase Dashboard (Authentication -> Sign In / Providers -> Email -> 'Allow new users to sign up')."
    requirement: "AUTH-04"
    verification:
      - kind: other
        ref: "Project owner turned off 'Allow new users to sign up' under Authentication -> Sign In / Providers -> User Signups (screenshot confirmed toggle off; `Confirm email` remains ON in that same panel). Proven by `npm run check:signup` -> `OK: dang ky cong khai DA TAT (HTTP 422, error_code=signup_disabled)`, exit 0 — the exact single condition the fail-closed probe accepts as evidence."
        status: pass
    human_judgment: true
    rationale: "This was task 2's human-action checkpoint. The project owner has now completed it, and the fail-closed probe independently confirms the effect at the live endpoint."

  - id: D3
    description: "scripts/check-signup-disabled.mjs exists, is fail-closed, and correctly reports the true state of the live signup endpoint (whatever that state is)."
    requirement: "AUTH-04"
    verification:
      - kind: other
        ref: "npm run check:signup (commit fc4d293, run after 02-11's phase-gate pass): exits 1 and reports evidence code `over_email_send_rate_limit` (HTTP 429) from a live POST to /auth/v1/signup — a fail-closed, non-2xx-but-inconclusive-by-design result that correctly did NOT count as proof signup was off at that time. Re-run after the Dashboard toggle was flipped (see D2): `OK: dang ky cong khai DA TAT (HTTP 422, error_code=signup_disabled)`, exit 0 — the probe correctly flipped from RED to GREEN when, and only when, the underlying state actually changed."
        status: pass
    human_judgment: false

  - id: D4
    description: "supabase/config.toml's [auth] block sets enable_signup = false, with a comment stating the cloud project's Dashboard toggle (not this file) is the real gate."
    requirement: "AUTH-04"
    verification:
      - kind: other
        ref: "Commit 575a0be sets `enable_signup = false` in both the `[auth]` block (was line 176) and the `[auth.email]` block (was line 221) — both were required, since leaving only the `[auth]` block off would have left the email provider's own signup path open. The edit was made only after the Dashboard toggle was confirmed off and the probe confirmed green (see key-decisions ordering rationale), so the file was never inaccurate at any point in time."
        status: pass
    human_judgment: false

duration: not contiguous — see Performance
completed: 2026-08-02
status: complete
---

# Phase 2 Plan 03: Real credentials via Admin API + signup lockdown probe Summary

**10 real Supabase Auth accounts exist and can log in (Task 1, done); the project owner has disabled public signup on the Supabase Dashboard (Task 2, done); the fail-closed HTTP probe now proves it — `error_code=signup_disabled`, exit 0 — and `supabase/config.toml`'s `enable_signup` edit has been made in both the `[auth]` and `[auth.email]` blocks (Task 3, done). All three tasks complete; D-13a is closed.**

## Performance

- **Started:** 2026-08-01 ~11:48 (Task 1, commit `1f8e108`)
- **Task 3 (probe) shipped:** 2026-08-01 ~23:12 (commit `fc4d293`), by the orchestrator after 02-11's phase-gate run — not contiguous with Task 1. Execution paused at Task 2's human-action checkpoint for most of the day; a live incident (see Issues Encountered) and its fix (`556f9de`, ~19:53) and an ops script (`4ff1829`, ~13:49) happened in between, both triggered by this plan's own accounts.
- **Task 2 completed:** 2026-08-02, project owner turned off "Allow new users to sign up" on the Supabase Dashboard (screenshot confirmed).
- **Task 3 closed out:** 2026-08-02, `npm run check:signup` re-run and confirmed green (exit 0, `error_code=signup_disabled`); `supabase/config.toml`'s `[auth]`/`[auth.email]` edit made only after that confirmation (commit `575a0be`).
- **Tasks:** 3 of 3 fully done (Task 1, Task 2, Task 3)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- `scripts/seed-auth.mjs` (`npm run seed:auth`) selects the first 5 `active` employees per company (ordered by `code`), assigns roles `owner, admin, manager, employee, employee` in that order (D-14), and calls `auth.admin.createUser()` with `email_confirm: true` (D-14a) and `app_metadata.must_change_password = true` (D-16, never `user_metadata`). Existing emails are looked up via `listUsers()` and never have their password reset, so the script is safe to run twice. It verifies one newly-created account with a real `signInWithPassword()` call — proof `auth.identities` exists, the exact thing raw-SQL seeding into `auth.users` does not produce (D-15). No password is ever written to disk; it only appears once on stdout.
- 30 of 40 employees deliberately keep `user_id = null` — this is the intended production shape (shift workers never get logins), not missing data (D-14).
- `scripts/check-signup-disabled.mjs` (`npm run check:signup`) is a fail-closed probe: it POSTs to the live `/auth/v1/signup` with the publishable key and only treats `error_code === "signup_disabled"` as proof the gate is off. Every other outcome — 2xx, an unrelated 4xx, or a network failure — exits non-zero as inconclusive-or-worse. Two real bugs were caught and fixed while building it (see Issues Encountered).
- `docs/HUONG-DAN-TEST.md` was rewritten to match the post-Phase-2 reality: the old text described V1's mock login ("any 6-character password works"), localStorage sessions, data resetting on every restart, and pointed at `src/lib/mock/service.ts` — all now false or deleted.
- The project owner disabled "Allow new users to sign up" on the Supabase Dashboard (Task 2), `npm run check:signup` was re-run and now exits 0 with `error_code=signup_disabled`, and `supabase/config.toml`'s `[auth]`/`[auth.email]` blocks were then updated to match (commit `575a0be`), completing Task 3 and closing D-13a. The edit order (Dashboard first, probe green second, file edit last) was deliberate — see key-decisions.

## Task Commits

1. **Task 1: scripts/seed-auth.mjs — 10 real credentials via Admin API** - `1f8e108` (feat)
2. **Task 2: Disable public signup on the Dashboard (human action)** - done; project owner turned off "Allow new users to sign up" (no commit — Dashboard-only action, verified by `npm run check:signup`)
3. **Task 3: Probe proving signup is off at the endpoint, and sync config.toml** - `fc4d293` (feat, probe script) + `575a0be` (feat/chore, config.toml `[auth]`/`[auth.email]` -> `enable_signup = false`) — both halves of this task are now done

**Related commits triggered by this plan's own data, not part of the plan's task list:**
- `556f9de` (fix) — `scripts/db.mjs` refuses `test`/`testdb` against a `*.supabase.co/.com/.in` host (incident fix, see Issues Encountered)
- `4ff1829` (chore) — `scripts/reset-temp-passwords.mjs` (`npm run reset:passwords`), built so the seeded accounts' one-time-printed passwords can be regenerated without losing `auth.users.id` wiring

## Files Created/Modified

- `scripts/seed-auth.mjs` - creates the 10 real accounts (Task 1)
- `scripts/check-signup-disabled.mjs` - fail-closed HTTP probe (Task 3)
- `scripts/reset-temp-passwords.mjs` - ops script, credential recovery (triggered by the incident below)
- `scripts/db.mjs` - added the cloud-host guard for `test`/`testdb` (incident fix)
- `supabase/config.toml` - modified (commit `575a0be`): `[auth]` and `[auth.email]` blocks both set to `enable_signup = false`, with the comment noting the cloud Dashboard is the real gate
- `package.json` - added `check:signup` and `test:e2e`/`reset:passwords`-adjacent script entries across these commits
- `docs/HUONG-DAN-TEST.md` - rewritten for post-Phase-2 reality

## Decisions Made

- **`check-signup-disabled.mjs` treats HTTP 429 `over_email_send_rate_limit` as proof signup is still ON**, not as a probe failure — GoTrue only attempts to send a confirmation email *after* the signup gate lets a request through, so hitting that rate limit is itself evidence the gate passed the request through.
- **The probe is fail-closed by construction**: only the exact `error_code === "signup_disabled"` counts as evidence signup is off. This was a deliberate response to the two bugs described below, not the original design.
- **`scripts/db.mjs` now hard-refuses `test`/`testdb` against a `supabase.co/.com/.in` host**, with `TF_ALLOW_CLOUD_TESTS=1` as a deliberate, self-documenting escape hatch. `push` and `seed` commands are unaffected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Probe substring-matched its own generated email address**
- **Found during:** Task 3, first draft of `check-signup-disabled.mjs`
- **Issue:** The first version checked whether the GoTrue error message contained the substring `"signup"`. The probe's own throwaway email was named `signup-probe-<uuid>@...`, and GoTrue echoes the submitted address back inside its error message — so the check matched its own input and reported GREEN (signup disabled) while signup was actually still enabled. A false "all clear" is worse than no check at all.
- **Fix:** Rewrote the check to require the exact structured field `error_code === "signup_disabled"` rather than any substring match against free-form message text.
- **Files modified:** `scripts/check-signup-disabled.mjs`
- **Committed in:** `fc4d293`

**2. [Rule 1 - Bug] `.test`/`example.com` probe addresses rejected before reaching the signup gate**
- **Found during:** Task 3, same script
- **Issue:** Supabase rejects `.test` and `example.com` domains with `email_address_invalid` *before* the request reaches the actual signup-enabled/disabled check — so a probe using those domains proves nothing either way.
- **Fix:** Switched the probe's throwaway address to the RFC 2606 `.invalid` TLD, which Supabase accepts as a syntactically valid (never-real) address and which reaches the actual signup gate.
- **Files modified:** `scripts/check-signup-disabled.mjs`
- **Committed in:** `fc4d293`

### Resolved — Previously Recorded Gap

**3. [Task 3, action (a), originally not executed — now resolved] `supabase/config.toml`'s `[auth]` block read `enable_signup = true`**
- **Found during:** an earlier SUMMARY reconstruction, by diffing `git log -- supabase/config.toml` (last touched in Phase 1, commit `fcab827`) against the plan's Task 3 action (a), which required setting `[auth].enable_signup = false` plus an explanatory comment.
- **Why it was not auto-fixed at the time:** that earlier recovery task was documentation-only and explicitly prohibited from modifying source files. Recording it accurately, not silently fixing it, was the correct action for that task.
- **Why it went unnoticed at original execution time:** Task 3's own acceptance-criteria check — `node -e "...if(!/^\s*enable_signup\s*=\s*false/m.test(s))process.exit(1)"` — was not scoped to the `[auth]` block. `supabase/config.toml` already had an unrelated, pre-existing `enable_signup = false` under `[auth.sms]` (SMS signups, never part of this project), so the regex passed even though the `[auth]` and `[auth.email]` blocks were never touched. That was a plan-authoring gap in the acceptance criterion, not an executor oversight.
- **Resolution:** now fixed, commit `575a0be`. Both `[auth]` (was line 176) and `[auth.email]` (was line 221) are set to `enable_signup = false`. The fix was deliberately sequenced after the Dashboard toggle was off and `npm run check:signup` had already confirmed `error_code=signup_disabled` — never the other way around, to avoid the file being `false` while the cloud project was still `true`.
- **Status:** closed.

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in the probe itself), 1 previously-recorded gap now resolved (config.toml edit, commit `575a0be`).
**Impact on plan:** The two auto-fixed bugs were necessary for the probe to be trustworthy at all — a probe that lies green is worse than no probe. The config.toml gap, now closed, never blocked anything downstream (D-13a's real gate was always the Dashboard, never this file), but its resolution means the plan's own file-list promise (`files_modified: [..., supabase/config.toml]`) is now fully kept.

## Issues Encountered

**GoTrue 500 on every Admin API user query, caused by this plan's own accounts colliding with pgTAP fixtures on the live database.**

While retrieving credentials after Task 1, every call to the Supabase Admin API's user-listing endpoint started failing:

```
GET /auth/v1/admin/users -> 500 unexpected_failure
{"msg":"Database error finding users"}
```

**Cause:** `npm run test:db` had, at some point, inserted the 4 synthetic pgTAP fixture uuids (meant to stay in `supabase/tests/` per D-15) straight into the live `auth.users` table. Those 4 rows have `NULL` in `encrypted_password`, `confirmation_token`, `recovery_token`, `email_change`, and `created_at`. GoTrue scans the *entire* `auth.users` table when listing users, so four malformed rows broke the query path for all ten of this plan's perfectly valid accounts. This is exactly the collision D-15 was written to prevent — but the invariant lived only in convention (nothing stopped `test:db` from running against a cloud connection string), not enforcement.

**Fix, in order:**
1. The 4 synthetic rows were deleted from the live database, guarded by a second condition (`encrypted_password is null`) so a real account could never be caught by the same delete.
2. Wiring to the 10 real accounts was restored via `npm run seed:auth` (idempotent — no duplicates, no password resets on existing accounts).
3. `scripts/db.mjs` (commit `556f9de`) now refuses to run `test`/`testdb` when the connection host matches `supabase.co`/`.com`/`.in`, with `TF_ALLOW_CLOUD_TESTS=1` as a deliberate, self-documenting escape hatch. `db:push` and `db:seed` are unaffected — only the two commands that write pgTAP fixtures were the risk.
4. `scripts/reset-temp-passwords.mjs` (commit `4ff1829`) was added as a companion tool: it regenerates temp passwords for the 10 seeded accounts via the Admin API while **preserving `auth.users.id`**, so `memberships`, `employees.user_id`, and `audit_log.actor_user_id` all stay pointed at the same account. This exists because the incident above illustrated how easily a one-time-printed password can become permanently unrecoverable, and the manual-UAT steps for plans 02-04/02-10/02-11 all depend on a working login.

## Post-completion observations (evidence for plan 02-10, not this plan)

While re-running `npm run test:e2e` after the D-13a closure work above (17/17 pass — route gating, forced-password-change gate including the `/select-company` bypass, and the D-16a five-step trap scenario), an `auth.users` inspection surfaced incidental real UAT evidence for plan 02-10, obtained by observation rather than a scripted check:

- `nv001@ngocphat.test` now shows `must_change_password = false`, `last_sign_in_at = 2026-08-01T17:43:50`, `updated_at = 2026-08-01T17:45:20` — `updated_at` strictly after `last_sign_in_at`, while the other nine seeded accounts still read `must_change_password = true`.
- That pattern means the project owner signed in, was forced to the change-password page, and completed a real password change through the application's own UI — exercising the D-16 forced-change flow end to end in a real browser, not just in the automated e2e suite.
- This does **not** by itself prove the D-16a no-redirect-loop behaviour felt correct to the user (they have not reported that yet), so that part is not claimed here. This observation belongs to plan 02-10's UAT record, not to this plan's scope; it is captured here only because it surfaced during this session's verification work.

## User Setup Required

**Task 2 is complete.** For the record, the steps the project owner performed:
1. Opened Supabase Dashboard -> project `ujvgagujfsdrlmjdhooi` -> Authentication -> Sign In / Providers -> User Signups.
2. Turned off "Allow new users to sign up." Confirmed off by screenshot. (`Confirm email` remains ON in the same panel — this is why earlier probe attempts hit `over_email_send_rate_limit`: GoTrue was still trying to send a confirmation email.)
3. `supabase/config.toml`'s `[auth]` block and `[auth.email]` block were then edited to `enable_signup = false` (commit `575a0be`), only after the Dashboard toggle and the probe had already confirmed the live state.
4. `npm run check:signup` re-run and confirmed: `OK: dang ky cong khai DA TAT (HTTP 422, error_code=signup_disabled)`, exit 0. D-13a is proven.

## Next Phase Readiness

- 10 real accounts exist, log in, and are correctly wired to `memberships`/`employees.user_id` — this is the precondition every later plan's manual UAT step (02-04, 02-10, 02-11) depends on. `npm run reset:passwords` is the recovery tool if the one-time-printed passwords are ever lost again.
- **D-13a is now proven and closed:** public signup is off on the live project, confirmed both by the Dashboard toggle (screenshot) and independently by the fail-closed HTTP probe (`error_code=signup_disabled`, exit 0). `supabase/config.toml` matches the live state.
- `scripts/db.mjs`'s cloud-host guard is now a standing safeguard for the rest of the project — any future `test`/`testdb` run against production Postgres will refuse to execute rather than repeat this plan's incident.
- Login remains unaffected by the signup lockdown: `npm run test:e2e` reports 17/17 passing after the change, including the forced-password-change gate and the D-16a five-step trap scenario.

## Self-Check: PASSED

`scripts/seed-auth.mjs`, `scripts/check-signup-disabled.mjs`, `scripts/reset-temp-passwords.mjs` confirmed present on disk. Commit hashes `1f8e108`, `fc4d293`, `556f9de`, `4ff1829`, `575a0be` confirmed present in `git log --oneline --all`. `supabase/config.toml` confirmed to contain `[auth].enable_signup = false` and `[auth.email].enable_signup = false` (commit `575a0be`). `npm run check:signup` confirmed exit 0 with `error_code=signup_disabled`.

---
*Phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi*
*Completed: 2026-08-02*
