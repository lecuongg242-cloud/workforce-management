---
phase: 2
slug: phi-n-th-t-v-c-t-t-ng-d-li-u-gi
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-31
map_populated: 2026-07-31
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> `status: draft` and `nyquist_compliant: false` are **correct at plan time** — both fields are
> owned by `/gsd-validate-phase` §6, not by plan-phase. The per-task map below is populated;
> the two flags flip after execution when the commands have actually been run green.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pgTAP (SQL, from Phase 1) + Vitest 4.1.10 (JS — installed by plan 02-01, the repo's first JS runner) |
| **Config file** | `vitest.config.mts` (created in 02-01 Task 2); pgTAP driven by `scripts/db.mjs` |
| **Quick run command** | `npm run typecheck && npm run lint` |
| **Full suite command** | `npm run test && npm run test:db && npm run check:assertions && npm run build && npm run check:secrets` |
| **Estimated runtime** | ~90 seconds (pgTAP + `next build` dominate) |

**New npm scripts this phase adds** (declared in 02-01, used by later plans): `test` (`vitest run`),
`check:assertions` (`scripts/check-pgtap-assertions.mjs`), `seed:auth` (`scripts/seed-auth.mjs`).

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npm run lint`
- **After every plan wave:** Run `npm run test && npm run test:db`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

35 tasks across 11 plans. `Test Type` values: **auto** (`type="auto"`), **tracer**
(`type="tracer"`), **tdd** (`type="auto" tdd="true"`), **human** (`checkpoint:*` — no automated
command by design).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DATA-05 | T-02-01 | No unvetted package enters the dependency tree | human | — (package legitimacy gate) | n/a | ✅ approved (STATE.md decision log, 02-01) |
| 02-01-02 | 01 | 1 | DATA-05 | T-02-01 | Exact-pinned deps; no floating range can swap a client library | auto | `npm run typecheck && npm run lint && node -e "…version pin assert…"` | ✅ | ✅ green (02-01-SUMMARY; reconfirmed by 02-11 Task 3 full gate) |
| 02-01-03 | 01 | 1 | DATA-05 | T-02-01 | Publishable key renamed so the secret-scanner keeps its teeth | human | — (`.env.local` edit; agent is blocked from `.env*` paths) | n/a | ✅ done (STATE.md decision log, 02-01) |
| 02-01-04 | 01 | 1 | DATA-05 | T-02-01 | `check:secrets` still fails on a real secret leak | auto | `npm run test && npm run build && npm run check:secrets` | ✅ | ✅ green (`check:secrets` OK, 147 files scanned, 02-11 Task 3) |
| 02-02-01 | 02 | 2 | AUTH-03, DATA-05 | T-02-02 | `platform_admins` unreadable except through `tf_is_platform_admin()` (D-11a) | auto | `node -e "…0006 migration source assert: security definer / revoke execute / RLS + deny policy…"` | ✅ | ✅ green (pgTAP `06_platform_admins.sql`, 8/8 ok, 02-11 Task 3 `test:db` run) |
| 02-02-02 | 02 | 2 | AUTH-03, DATA-05 | T-02-02 | Synthetic uuids never reach cloud `auth.users` (D-15) | auto | `npm run check:assertions && node -e "…seed.sql has no synthetic uuid / no auth.users…"` | ✅ | ✅ green (`check:assertions` 191/170, 02-11 Task 3) |
| 02-02-03 | 02 | 2 | AUTH-03, DATA-05 | T-02-02 | **[BLOCKING]** live schema matches migrations before anything is verified against it | auto | `npm run db:push && npm run test:db && npm run check:assertions` | ✅ | ✅ green (`db:push` reports "Remote database is up to date", 02-11 Task 3) |
| 02-03-01 | 03 | 3 | AUTH-03, AUTH-04, DATA-05 | T-02-03 | Accounts created via Admin API get `auth.identities`; no credential written to disk | auto | `npm run seed:auth && npm run seed:auth && node -e "…no file-write in seed-auth…"` | ✅ | ✅ green — code committed (`1f8e108`), but **plan 02-03 has no SUMMARY.md/docs commit** (administrative gap, see STATE.md blockers, not re-run here to avoid rotating live seed credentials) |
| 02-03-02 | 03 | 3 | AUTH-04 | T-02-03 | Public signup off at the provider, not merely hidden (D-13a) | human | — (Dashboard toggle) | n/a | ⬜ **pending — deferred by project owner.** `supabase/config.toml` still reads `enable_signup = true` under `[auth]` and `[auth.email]` (lines 176, 221); public signup remains ENABLED on the cloud project. D-13a unproven. |
| 02-03-03 | 03 | 3 | AUTH-04, DATA-05 | T-02-03 | Signup rejection proven by probing GoTrue, not by trusting config | auto | `node --env-file=.env.local scripts/check-signup-disabled.mjs && node -e "…config.toml enable_signup=false…"` | ❌ | ❌ **red — `scripts/check-signup-disabled.mjs` does not exist.** It is plan 02-03 Task 3's deliverable; that task was never executed because it is gated behind 02-03-02 (deferred). Ran `node --env-file=.env.local scripts/check-signup-disabled.mjs` on 02-11 Task 3's final tree: `MODULE_NOT_FOUND`, exit 1. Out of 02-11's scope to author — creating it would blur plan ownership and probe a live auth endpoint outside this plan's threat model. |
| 02-04-01 | 04 | 4 | AUTH-01, AUTH-02, AUTH-05 | T-02-04 | Session in cookies; identity resolved server-side only; no request-supplied company (D-12a/b) | tracer | `npm run typecheck && npm run lint && npm run build && npm run check:secrets && node -e "…session-context: no searchParams/new URL, uses getClaims, never getSession()…"` | ✅ | ✅ green (code committed; reconfirmed by 02-11 Task 3 full gate). Plan 02-04 also lacks a SUMMARY.md/docs commit (same administrative gap as 02-03, see STATE.md blockers). |
| 02-04-02 | 04 | 4 | AUTH-03, AUTH-05, DATA-05, DATA-06 | T-02-04 | Every Route Handler is GET-only and `force-dynamic` (D-12c) | auto | `npm run typecheck && npm run lint && node -e "…no POST/PUT/PATCH/DELETE/HEAD/OPTIONS export in src/app/api; force-dynamic present…"` | ✅ | ✅ green — `src/__tests__/route-handlers-get-only.test.ts` now scans all 9 `route.ts` files under `src/app/api/` (recursive), re-verified manually in 02-11 Task 3: every handler exports `GET` only |
| 02-04-03 | 04 | 4 | AUTH-02, AUTH-05, DATA-06 | T-02-04 | Route-gate logic and identity choke point covered by tests, not prose | auto | `npm run test && npm run typecheck` | ✅ | ✅ green (`middleware-gate.test.ts`, part of 100/100 passing suite, 02-11 Task 3) |
| 02-04-04 | 04 | 4 | AUTH-01, AUTH-02 | T-02-04 | Session survives a real browser restart; guest URL entry is blocked pre-render | human | — (browser UAT; see Manual-Only below) | n/a | ⬜ **pending — no evidence found.** No SUMMARY.md for 02-04; this browser UAT has not been recorded as performed. Folded into 02-11-04's 13-screen walkthrough where practical, but session-restart-across-browser-close specifically has not been separately confirmed. |
| 02-05-01 | 05 | 5 | AUTH-05, DATA-05 | T-02-05 | Employee read path stays GET-only and tenant-scoped | tdd | `npm run typecheck && npm run lint && node -e "…GET-only + force-dynamic across ≥2 handlers…"` | ✅ | ✅ green (02-05-SUMMARY; reconfirmed by 02-11 Task 3 full gate) |
| 02-05-02 | 05 | 5 | AUTH-03, DATA-05, DATA-06 | T-02-05 | Department writes leave an audit row with before/after (D-17/D-18) | tdd | `npm run typecheck && npm run lint && npx vitest run src/lib/data/__tests__/departments.test.ts` | ✅ | ✅ green (02-05-SUMMARY; part of 100/100 passing suite, 02-11 Task 3) |
| 02-05-03 | 05 | 5 | DATA-05 | T-02-05 | Empty result is distinguishable from error under `error: string \| null` (D-12e) | auto | `npm run test && npm run typecheck` | ✅ | ✅ green (02-05-SUMMARY; reconfirmed 02-11 Task 3) |
| 02-06-01 | 06 | 5 | AUTH-03, DATA-05, DATA-06 | T-02-06 | Shift writes audited; GET-only rule holds as handlers multiply | tdd | `npm run typecheck && npm run lint && node -e "…GET-only assert…"` | ✅ | ✅ green (02-06-SUMMARY; reconfirmed 02-11 Task 3) |
| 02-06-02 | 06 | 5 | DATA-05 | T-02-06 | Time / weekday-array / generated-column boundaries behave | auto | `npm run test && npm run typecheck` | ✅ | ✅ green (02-06-SUMMARY; part of 100/100 passing suite) |
| 02-07-01 | 07 | 6 | AUTH-03, DATA-05, DATA-06 | T-02-07 | Three employee writes each audited | tdd | `npm run typecheck && npm run lint && npx vitest run src/lib/data/__tests__/employees.test.ts` | ✅ | ✅ green (02-07-SUMMARY; reconfirmed 02-11 Task 3) |
| 02-07-02 | 07 | 6 | DATA-05 | T-02-07 | Probe edges: exact-match, ordering, tenant boundary | auto | `npm run test && npm run typecheck` | ✅ | ✅ green (02-07-SUMMARY; part of 100/100 passing suite) |
| 02-07-03 | 07 | 6 | AUTH-03 | T-02-07 | Role-scoped write permission proven at the DB, not only in app code | auto | `npm run test:db && npm run check:assertions` | ✅ | ✅ green (pgTAP `08_role_write_scope.sql`, 7/7 ok including known-limitation row 7, 02-11 Task 3 `test:db` run) |
| 02-08-01 | 08 | 7 | DATA-05, DATA-06, DATA-08 | T-02-08 | Attendance timestamps come from the server clock (D-19) | tdd | `npm run typecheck && npm run lint && npx vitest run src/lib/__tests__/today.test.ts` | ✅ | ✅ green (02-08-SUMMARY; reconfirmed 02-11 Task 3) |
| 02-08-02 | 08 | 7 | DATA-05, DATA-08 | T-02-08 | No hardcoded sample series survives in the real dashboard | tdd | `npm run typecheck && npm run lint && node -e "…git grep CHART_PRESENT_OFFSET/CHART_LATE_VALUES must be empty…"` | ✅ | ✅ green (02-08-SUMMARY; reconfirmed via `npm run build` on final tree) |
| 02-08-03 | 08 | 7 | DATA-05, DATA-08 | T-02-08 | "Today" flows from Server Component as data — no client clock on first paint | auto | `npm run typecheck && npm run lint && npm run build && npx vitest run src/lib/__tests__/today.test.ts src/lib/data/__tests__/attendance.test.ts` | ✅ | ✅ green (02-08-SUMMARY; **superseded/extended by 02-11 Task 1**, which turns this into a repo-wide enforced ESLint rule instead of a 3-file scope) |
| 02-09-01 | 09 | 8 | DATA-05, DATA-06, DATA-08 | T-02-09 | Request creation audited; default date server-supplied | tdd | `npm run typecheck && npm run lint && node -e "…GET-only assert…"` | ✅ | ✅ green (02-09-SUMMARY; reconfirmed 02-11 Task 3) |
| 02-09-02 | 09 | 8 | AUTH-03, DATA-05 | T-02-09 | Last mock-backed screen moves to real data | auto | `npm run typecheck && npm run lint && npm run test && npm run build && node -e "…"` | ✅ | ✅ green (02-09-SUMMARY; `git grep -l "@/lib/mock/service" -- src/app src/components` empty since 02-09, reconfirmed 02-11 Task 3) |
| 02-10-01 | 10 | 9 | AUTH-04, DATA-06 | T-02-10 | Secret-key admin client is scope-limited and never client-importable | auto | `npm run typecheck && npm run lint && npx vitest run src/__tests__/admin-client-scope.test.ts` | ✅ | ✅ green — code committed (`7022689`); part of 100/100 passing suite, 02-11 Task 3. Plan 02-10 lacks a SUMMARY.md/docs commit (same administrative gap as 02-03/02-04). |
| 02-10-02 | 10 | 9 | AUTH-04 | T-02-10 | Forced password change enforced in middleware via `app_metadata` (D-16) | auto | `npm run typecheck && npm run lint && npm run test && npm run build && npm run …` | ✅ | ✅ green — code committed (`d4eb7e2`); `middleware-gate.test.ts` password-change gate rows part of 100/100 passing suite |
| 02-10-03 | 10 | 9 | AUTH-04 | T-02-10 | Token refresh after clearing the flag — user cannot be trapped (D-16a) | auto | `npm run test && npm run typecheck` | ✅ | ✅ green — code committed (`8ad52a6`, anti-trap sequence tests); part of 100/100 passing suite |
| 02-10-04 | 10 | 9 | AUTH-04 | T-02-10 | Whole account lifecycle works against the real provider | human | — (account-lifecycle UAT) | n/a | ⬜ **pending.** Project owner has not yet run `npm run reset:passwords` — no working temp-password login exists yet in the live project, so this lifecycle UAT could not be performed. |
| 02-11-01 | 11 | 10 | DATA-08 | T-02-11 | ESLint rule actually fires on a violating fixture (D-19a) | auto | `npm run lint && npx vitest run src/__tests__/eslint-no-date-in-client.test.ts` | ✅ | ✅ green (02-11-SUMMARY Task 1; sabotage-and-revert on a real client component: exit 1 → 0) |
| 02-11-02 | 11 | 10 | DATA-05, DATA-08 | T-02-11 | Mock layer deleted with nothing left importing it | auto | `npm run typecheck && npm run lint && npm run test && npm run build && node -e "…"` | ✅ | ✅ green (02-11-SUMMARY Task 2; `git ls-files src/lib/mock` empty, `no-mock-layer.test.ts` 4/4) |
| 02-11-03 | 11 | 10 | DATA-05, DATA-08 | T-02-11 | Whole-phase gate green on the final tree | auto | `npm run typecheck && npm run lint && npm run test && npm run build && npm run …` | ✅ | ✅ green for 8/9 commands (typecheck, lint, test 100/100, build, check:secrets, db:push, test:db 191/191, check:assertions 191≥170). ❌ command 9 (`check-signup-disabled.mjs`) red — see 02-03-03 row, not this plan's scope to fix. |
| 02-11-04 | 11 | 10 | DATA-05, DATA-08 | T-02-11 | All 13 V1 screens render on real data | human | — (13-screen phase UAT) | n/a | ⬜ pending — this is the checkpoint this plan returns to the user next |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists: ✅ = infrastructure already in repo · ❌ W0 = depends on Wave 0 (Vitest, created in 02-01)*

**Sampling continuity:** longest run of consecutive tasks without an automated command is **1**
(every `checkpoint:*` task is immediately preceded or followed by an automated one). The
"no 3 consecutive tasks without automated verify" rule holds.

**Watch-mode check:** every JS command uses `vitest run` (single-shot). No `--watch` / `--watchAll`
appears in any `<automated>` block.

---

## Wave 0 Requirements

The repo had **no JavaScript test runner at all** before this phase — Phase 1 introduced pgTAP only.
All six Wave 0 items now map to a concrete task:

| Wave 0 requirement | Task |
|---|---|
| `vitest` + `vitest.config.mts` — the project's first JS runner | 02-01-02 |
| `middleware.ts` route protection test (AUTH-02) | 02-04-03 |
| D-12c guard: **no Route Handler exports anything but `GET`** — mechanical source assertion, re-run in every later slice | 02-04-02 (then re-asserted in 02-05-01, 02-06-01, 02-09-01) |
| `getSessionContext()` identity choke point (D-12a) + no `company_id` from a query param (D-12b) | 02-04-01 (source assert) + 02-04-03 (behavior) |
| pgTAP for `platform_admins` RLS + `tf_is_platform_admin()` (D-11/D-11a/D-11b) | 02-02-01, 02-02-03 |
| pgTAP assertion-count guard ≥ 170 (D-15a) — `scripts/check-pgtap-assertions.mjs` | 02-02-02 |

`wave_0_complete` flips to `true` once 02-01 and 02-02 are executed green.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Task | Test Instructions | Status (02-11 Task 3) |
|----------|-------------|------------|------|-------------------|------------------------|
| Session survives browser close/reopen | AUTH-01 | Needs a real browser profile and cookie persistence across a process restart | 02-04-04 | Log in, fully quit the browser, reopen, navigate to `/admin` — must still be authenticated | ⬜ **Not performed.** No SUMMARY.md exists for 02-04 and no record of this UAT was found in STATE.md/WINDOWS.md. Honestly unverified, not assumed done. |
| Guest URL entry blocked before render | AUTH-02 | Distinguishing "blocked pre-render" from "flashed then redirected" needs human eyes on a real browser | 02-04-04 | In a private window, type `/admin/dashboard` directly — no admin chrome may paint before the redirect | ⬜ **Not performed.** Same gap as above — logic is covered by `middleware-gate.test.ts` (unit-level), but the pre-render-vs-flash distinction itself needs human eyes and has not been recorded. |
| Public signup off at the GoTrue endpoint | AUTH-04 / D-13a | Requires the live cloud project; `config.toml` may not propagate | 02-03-02 | Dashboard → Authentication → Sign-ups off; then 02-03-03 proves it by probe | ❌ **Confirmed NOT done.** `supabase/config.toml` still reads `enable_signup = true` under `[auth]`/`[auth.email]`; deferred by project owner. D-13a remains unproven. |
| Forced password change does not trap the user | AUTH-04 / D-16a | Depends on real JWT refresh timing, which no unit test reproduces faithfully | 02-10-04 | Log in with a temp-password account, change the password, confirm you land past the gate without a manual reload | ⬜ **Not performed.** `npm run reset:passwords` has not been run by the project owner yet — no working temp-password credential exists to test with. |
| Employee accounts from the Admin API can actually log in | AUTH-04 / D-15 | Proves `auth.identities` exists — the exact failure mode raw SQL seeding causes | 02-10-04 | Run `npm run seed:auth`, then log in as one generated employee | ⬜ **Not performed.** Same blocker as above — `reset:passwords` pending. |
| All 13 V1 screens on real data | DATA-05 / DATA-08 | Whole-phase acceptance; "every screen works" is not a source assertion | 02-11-04 | Walk all 13 screens as admin and as employee, on real dates | ⬜ Pending — this is the checkpoint 02-11 Task 4 returns to the user next. |

**Correction to plan text:** 02-11-PLAN.md Task 3's `<action>` instructed marking these four rows "theo kết quả nghiệm thu tay đã thực hiện ở plan 02-04 và 02-10" (per manual UAT already performed in those plans). No evidence of that UAT was found on inspection (no SUMMARY.md for either plan, nothing in STATE.md/WINDOWS.md) — marking them "done" on the plan's assumption alone would violate this same plan's own instruction to record "chưa có bằng chứng" honestly rather than claim pass. Recorded as genuinely pending/not-done instead.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are documented `checkpoint:*` with a Manual-Only row
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (longest gap = 1)
- [x] Wave 0 covers all MISSING references — six items, each mapped to a task
- [x] No watch-mode flags
- [ ] Feedback latency < 90s — measured during execution, not at plan time
- [ ] `nyquist_compliant: true` — set by `/gsd-validate-phase` after execution

**Approval:** pending execution
