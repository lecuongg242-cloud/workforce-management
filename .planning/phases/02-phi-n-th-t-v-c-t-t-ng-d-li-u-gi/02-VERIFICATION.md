---
phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
verified: 2026-08-01T18:07:46Z
status: human_needed
score: 3/6 must-haves verified
behavior_unverified: 3
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/6
  gaps_closed:
    - "Plan-level must-have (02-03, D-13/D-13a) — Public signup disabled at the Supabase Auth provider config, not just hidden in the UI"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Người dùng đăng nhập bằng Supabase Auth; phiên sống qua đóng/mở trình duyệt thật; đăng xuất mất quyền truy cập ngay lập tức (ROADMAP SC1 / AUTH-01)."
    test: "Log in as a seeded owner, fully quit the browser process (not just the tab), reopen, navigate directly to /admin/dashboard."
    expected: "Still authenticated, no re-login prompt."
    why_human: "Cookie persistence across an actual browser-process restart cannot be exercised by Vitest (in-process, no browser) or by scripts/e2e-auth.mjs (proves the JWT carries expires_at + refresh_token — the ingredients for surviving a restart — but does not itself quit and reopen a browser). This is plan 02-04 Task 4 step 3, a checkpoint:human-verify never resumed. Unchanged since the previous verification."
  - truth: "Người thuộc nhiều doanh nghiệp chọn được doanh nghiệp làm việc qua /select-company với tên thật, và đổi vai trò đúng theo doanh nghiệp đã chọn (ROADMAP SC3 / AUTH-03, AUTH-05)."
    test: "Log in as a dual-membership user, confirm /select-company lists both real company names (Ngọc Phát, Bình Minh) from Postgres, switch between them, confirm session role changes."
    expected: "Both real names shown (not seed/mock data); switching changes the active company and the session's role."
    why_human: "getSessionContext()'s multi-membership resolution logic is unit-tested (session-context.test.ts, 7 assertions, all passing) at the function level, but no automated script exercises the actual /select-company page render or click-through switch. Additionally re-confirmed in this verification: a direct query against the live memberships table shows all 10 seeded accounts have exactly ONE membership row each (0 users with >1 membership) — the dual-membership scenario is not exercisable with the current seed data at all, not merely untested. This is a data gap, not a code gap: the resolution logic itself is sound and unit-tested; there is simply no account today that would ever reach the multi-membership branch in a real browser."
  - truth: "Quản trị tạo tài khoản cho nhân viên qua giao diện thật, nhận mật khẩu tạm hiển thị đúng một lần (ROADMAP SC4 / AUTH-04)."
    test: "As an owner, open an employee profile with no linked account, click 'create account', confirm the one-time dialog shows email + temp password, confirm the dialog never reveals the password again if reopened."
    expected: "Dialog shows credentials once; reopening the profile does not redisplay the password."
    why_human: "createEmployeeAccount() is unit-tested at the Server Action level and its downstream effects (middleware gate, D-16a anti-trap refresh sequence) are independently proven over real HTTP by scripts/e2e-auth.mjs sections B/C — but the actual admin-UI button click and one-time-reveal dialog behavior has zero automated coverage. New evidence this round (see Truth #4 below) shows the D-16 forced-change flow was completed by a real human through the real UI for one account (nv001), which is strong indirect confirmation the downstream half of this flow works in a browser — but it does not touch the admin-side account-creation click-through or the one-time-password dialog, which remain unobserved."
human_verification:
  - test: "02-04 Task 4 (6 steps): guest→/login redirect with no admin-chrome flash, session survives a real browser-process restart, dual-membership /select-company with real company names and role-switch, no hydration warnings in DevTools Console."
    expected: "All six steps behave as described in 02-04-PLAN.md's <how-to-verify>."
    why_human: "Depends on real browser cookie lifecycle and visual/hydration inspection. Note: the dual-membership step cannot currently be exercised at all — the live seed data gives every account exactly one membership (re-confirmed this round) — so that specific sub-step should be treated as blocked-on-data, not as an open verification task, until a second membership is seeded for at least one test account."
  - test: "02-10 Task 4 (9 steps): full account lifecycle — admin creates an account, one-time password dialog, new user forced to /doi-mat-khau, password change completes without a manual reload, re-login with new password succeeds, old temp password is rejected."
    expected: "All nine steps behave as described in 02-10-PLAN.md's <how-to-verify>, especially step 6 (no manual reload) and step 7 (no random logout)."
    why_human: "Depends on real JWT refresh timing (D-16a) and a real admin-UI click-through. New evidence this round: `auth.users` for `nv001@ngocphat.test` shows `must_change_password=false`, `last_sign_in_at=2026-08-01T17:43:50Z`, `updated_at=2026-08-01T17:45:20Z` (updated strictly after sign-in, re-confirmed directly against the live Admin API in this verification), while the other 9 seeded accounts still read `must_change_password=true`. This is genuine evidence a human signed in, was forced to /doi-mat-khau, and completed a real password change through the app's own UI — the downstream half of this checkpoint. It does NOT establish that the flow felt correct with no loop or manual reload (D-16a's actual UX claim), and it says nothing about the admin-UI account-creation click-through or one-time-password-reveal dialog, which remain fully unobserved."
  - test: "02-11 Task 4 (13 screens): full phase-closing UAT — every V1 screen (select-company, dashboard, departments, shifts, employees list/create/detail, employee check-in/out, history, requests, profile, onboarding) walked through as both an owner and an employee on real data, with a clean DevTools Console throughout."
    expected: "All 13 screens render real Postgres data (real company names, real headcounts, today's real date) with no console errors or hydration warnings, and admin-side writes are reflected back on the dashboard."
    why_human: "This is the phase's own closing acceptance checkpoint (checkpoint:human-verify by design) and was never resumed — 02-VALIDATION.md's own row for it (02-11-04) is honestly marked pending, not assumed done. Unchanged since the previous verification."
---

# Phase 2: Phiên thật và cắt tầng dữ liệu giả Verification Report

**Phase Goal:** Người dùng đăng nhập bằng tài khoản thật và mọi màn hình V1 đọc/ghi Postgres; `mock/db.ts` biến mất khỏi mã nguồn.
**Verified:** 2026-08-01T18:07:46Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (previous run: `gaps_found`, 2/6, 2026-08-01T17:35:49Z)

## What Changed Since the Previous Verification

The single blocking gap from the previous run — public signup still enabled at the Supabase Auth provider (D-13a) — is **confirmed closed** by direct re-execution in this session, not by trusting the SUMMARY:

- `npm run check:signup` run directly in this verification: exits **0** with `OK: dang ky cong khai DA TAT (HTTP 422, error_code=signup_disabled)`. This is the exact single condition the fail-closed probe accepts as proof (any 2xx, unrelated 4xx, or network error is treated as inconclusive-or-worse by the probe's own construction).
- `supabase/config.toml` inspected directly: line 181 (`[auth]`) and line 228 (`[auth.email]`) both read `enable_signup = false`, with a comment at line 226 referencing D-13a and explaining the cloud Dashboard (not this file) is the real gate. `git log` confirms this was committed in `575a0be`, dated *after* `npm run check:signup` first went green — the sequencing 02-03-SUMMARY.md claims (Dashboard toggle → probe green → file edit) is consistent with the commit timeline.
- No regressions: `npm run test` (100/100, 14 files), `npm run typecheck`, `npm run lint`, `npm run build` (17 routes render, all `/api/*` dynamic, middleware present), `npm run check:secrets` (170 files scanned, 0 secrets), and `npm run check:assertions` (191 ≥ 170 floor) were all re-run directly in this session and all still pass.
- New evidence independently re-confirmed (not merely read from SUMMARY): queried the live Supabase project directly via the Admin API in this session and confirmed `nv001@ngocphat.test` has `must_change_password=false`, `last_sign_in_at=2026-08-01T17:43:50Z`, `updated_at=2026-08-01T17:45:20Z` (updated_at strictly after last_sign_in_at), while the other 9 seeded accounts still read `must_change_password=true`. This is real evidence the D-16 forced-password-change flow was exercised end-to-end by a human in a real browser for one account.
- Also independently queried the live `memberships` table directly: all 10 seeded accounts have exactly 1 membership row each — 0 accounts with more than one membership. This confirms the brief's caveat: AUTH-05's dual-membership switch is not merely untested, it is **not exercisable with the current seed data at all**.
- `scripts/e2e-auth.mjs` was inspected (not re-executed — no dev server was running in this non-interactive session, same limitation as the previous verification) and confirmed to structurally contain the sections and checks its SUMMARYs describe (route-gate section A, forced-password-gate section B, D-16a anti-trap section C with an explicit control step proving the old token stays trapped, session-shape section D) — consistent with, though not a re-proof of, the claimed 17/17 pass.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + one plan-level must-have)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — Login via Supabase Auth, session in cookie, survives browser open/close, logout revokes access immediately | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Unchanged from previous run. Mechanism fully wired: `signInWithPassword`/`signOut` via `@supabase/ssr`, no `localStorage`/`sessionStorage` in `src/lib/auth/`. `scripts/e2e-auth.mjs` §D asserts the session carries `expires_at` + `refresh_token`, but a real browser-process restart (02-04 Task 4) was never performed by a human. |
| 2 | SC2 — Guest hitting `/admin/*` or `/employee/*` blocked by `middleware.ts` with a 307 before any render | ✓ VERIFIED | Unchanged. `resolveGate()` has 14 passing unit-test cases; full suite re-run in this session: 100/100 across 14 files. `scripts/e2e-auth.mjs` §A structurally covers the real-HTTP 307/401 assertions. Blocking is architecturally guaranteed by Next.js middleware ordering. |
| 3 | SC3 — Four roles see/do only their scope; multi-company users switch and data/role change from a server-resolved active company | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Role-restriction logic unit-tested across all six data domains; `getSessionContext()`'s multi-membership resolution (never defaults to `memberships[0]`) has 7 passing unit tests. Newly re-confirmed this round: the live `/select-company` UI switch with two real companies is not just unverified — it is currently **not testable at all**, because all 10 live seeded accounts have exactly one membership (directly queried in this session, 0 users with >1 membership). The code path is sound and unit-tested, but no real account today would ever exercise it in a browser. Platform-admin role remains deferred to Phase 6 by explicit design (D-11). |
| 4 | SC4 — Admin creates employee accounts with a temp password; employee forced to change password on first login | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `createEmployeeAccount()`/`completeForcedPasswordChange()` unit-tested with sabotage-and-revert proofs; `scripts/e2e-auth.mjs` §B/§C independently re-prove the forced-gate and D-16a anti-trap sequence structurally. New this round: directly queried the live project and confirmed `nv001@ngocphat.test`'s `must_change_password` flipped `true→false` with `updated_at` strictly after `last_sign_in_at` — real evidence a human completed the forced-change flow through the actual UI. This strengthens but does not close the truth: the admin-UI account-creation click-through and the one-time-password-reveal dialog (02-10 Task 4) remain completely unobserved by any human or script. |
| 5 | SC5 — All V1 screens run on real Postgres data by real time (no `REFERENCE_DATE`); `mock/db.ts`/`mock/seed.ts` deleted; every write leaves a traceable audit_log row | ✓ VERIFIED | Unchanged and re-confirmed directly in this session: `src/lib/mock/` absent from disk and git (`git ls-files src/lib/mock` empty); `git grep` for mock imports and `REFERENCE_DATE` in `src/` returns nothing outside the guard test itself. `npm run test`/`typecheck`/`lint`/`build`/`check:secrets`/`check:assertions` all re-run directly and all pass. |
| 6 | Plan-level must-have (02-03, D-13/D-13a) — Public signup disabled at the Supabase Auth provider config, not just hidden in the UI | ✓ VERIFIED (was FAILED) | **Gap closed and re-verified directly, not taken on trust.** `npm run check:signup` run in this session exits 0 with `error_code=signup_disabled`. `supabase/config.toml` confirmed by direct read: `[auth].enable_signup=false` (line 181) and `[auth.email].enable_signup=false` (line 228), commit `575a0be`. Commit ordering (Dashboard toggle → probe green → config edit, per `git log` timestamps and commit message) is consistent with the claimed non-lying sequencing. |

**Score:** 3/6 truths verified (3 present-but-behavior-unverified, 0 failed) — up from 2/6 (2 verified, 1 failed, 3 present-but-behavior-unverified) in the previous run.

### Required Artifacts

No changes to artifact status since the previous verification, except `supabase/config.toml`, which flips from FAILED to VERIFIED:

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/middleware.ts` | Route gate | ✓ VERIFIED | Unchanged |
| `src/lib/auth/session-context.ts` | Identity choke point | ✓ VERIFIED | Unchanged |
| `src/lib/supabase/{browser,server,middleware}.ts` | Runtime-split clients | ✓ VERIFIED | Unchanged |
| `src/lib/supabase/admin.ts` | Scope-limited secret-key client | ✓ VERIFIED | Unchanged |
| `src/app/api/*/route.ts` (9 files) | GET-only, force-dynamic | ✓ VERIFIED | Unchanged; re-confirmed via fresh `npm run build` (all `/api/*` render as ƒ) |
| `src/lib/data/mutations/*.ts` (7 modules) | Server Actions with `requireRole` + `logMutation` | ✓ VERIFIED | Unchanged |
| `src/lib/data/audit.ts` | `logMutation()` | ✓ VERIFIED | Unchanged |
| `src/lib/today.ts` | Single source of "today" | ✓ VERIFIED | Unchanged |
| `eslint-rules/no-date-in-client.mjs` | D-19a enforcement | ✓ VERIFIED | Re-confirmed: `npm run lint` exits 0 in this session |
| `src/__tests__/no-mock-layer.test.ts` | Mock-layer regression gate | ✓ VERIFIED | Re-confirmed: part of the 100/100 passing suite |
| `src/app/(auth)/doi-mat-khau/*` | Forced password-change route | ✓ VERIFIED | Unchanged; strengthened by new real-account evidence (Truth #4) |
| `scripts/seed-auth.mjs`, `check-signup-disabled.mjs`, `reset-temp-passwords.mjs`, `e2e-auth.mjs` | Account lifecycle + signup-probe + e2e tooling | ✓ VERIFIED | `check-signup-disabled.mjs` re-executed directly and exits 0 |
| `supabase/migrations/0006-0010` | 5 migrations | ✓ VERIFIED | Unchanged; `npm run check:assertions` re-confirms 191 ≥ 170 |
| `supabase/config.toml` | `[auth].enable_signup = false` per D-13a | ✓ VERIFIED (was FAILED) | Both `[auth]` and `[auth.email]` blocks confirmed `false` by direct read in this session |

### Key Link Verification

Unchanged from the previous verification except the last row, which now reports GREEN instead of RED:

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/middleware.ts` | `src/lib/supabase/middleware.ts` | `updateSession(request)` | ✓ WIRED | Unchanged |
| `src/app/api/*/route.ts` | `src/lib/auth/session-context.ts` | `getSessionContext()` first | ✓ WIRED | Unchanged |
| `src/lib/data/mutations/*.ts` | `src/lib/data/audit.ts` | `logMutation()` in same function | ✓ WIRED | Unchanged |
| `src/middleware.ts` | JWT `app_metadata` | `mustChangePassword` from claims, not DB | ✓ WIRED | Unchanged |
| `src/lib/data/mutations/accounts.ts` | `src/lib/supabase/admin.ts` | `createAdminSupabase()` | ✓ WIRED | Unchanged |
| `scripts/check-signup-disabled.mjs` | live GoTrue `/auth/v1/signup` | fail-closed HTTP probe | ✓ WIRED (now reports GREEN) | Re-executed directly in this session: exits 0, `error_code=signup_disabled` |

### Behavioral Spot-Checks / Probe Execution

All re-run directly in this session (not taken from SUMMARY claims):

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Full JS test suite | `npm run test` | 100/100 passed, 14 files | ✓ PASS |
| Type check | `npm run typecheck` | exit 0 | ✓ PASS |
| Lint (incl. D-19a rule) | `npm run lint` | exit 0 | ✓ PASS |
| Production build | `npm run build` | exit 0, 17 routes render, all API routes dynamic | ✓ PASS |
| Secret-bundle scan | `npm run check:secrets` | exit 0, "170 files scanned, no secrets found" | ✓ PASS |
| pgTAP assertion floor | `npm run check:assertions` | 191 ≥ 170, exit 0 | ✓ PASS |
| Signup-disabled probe | `npm run check:signup` | **exit 0** — `error_code=signup_disabled` | ✓ PASS (was FAIL) |
| Live membership-count check | ad-hoc Admin API query, executed and removed in this session | 10/10 accounts have exactly 1 membership; 0 with >1 | ✓ CONFIRMS not-testable-as-seeded claim |
| Live nv001 flag/timestamp check | ad-hoc Admin API query, executed and removed in this session | `must_change_password=false`, `updated_at` strictly after `last_sign_in_at` | ✓ CONFIRMS claimed evidence |
| e2e-auth.mjs (17 assertions over real HTTP) | `npm run test:e2e` | Not executed in this session (requires a running `npm run dev` server + live credential, unavailable in this non-interactive verification) | ? SKIP — script inspected and structurally matches the sections/checks claimed by 02-04/02-10 SUMMARYs |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|-------------|--------|----------|
| AUTH-01 | 02-04 | Real Supabase Auth login, cookie session, no localStorage | ⚠️ Mechanism VERIFIED, browser-restart behavior UNVERIFIED | See Truth #1 (unchanged) |
| AUTH-02 | 02-04 | Route protection at `middleware.ts` | ✓ SATISFIED | See Truth #2 (unchanged) |
| AUTH-03 | 02-02, 02-04..02-10 | Four-role authorization | ⚠️ Role-restriction logic VERIFIED; multi-company UI switch UNVERIFIED AND not currently exercisable with live seed data; platform-admin deferred to Phase 6 by design | See Truth #3 |
| AUTH-04 | 02-03, 02-10 | Admin creates accounts + forced first-login password change | ⚠️ Gate/anti-trap VERIFIED via e2e; public signup lockdown now VERIFIED (was the blocking gap); admin-UI click-through and one-time-password dialog still UNVERIFIED | See Truths #4, #6 |
| AUTH-05 | 02-04 | Multi-company selection, server-resolved active company | ⚠️ Server-side resolution logic VERIFIED; UI switch UNVERIFIED and not exercisable with current data (no account has >1 membership) | See Truth #3 |
| DATA-05 | 02-01, 02-04..02-09, 02-11 | `mock/service.ts` replaced, `mock/db.ts`/`mock/seed.ts` deleted, signatures preserved | ✓ SATISFIED | See Truth #5 (unchanged) |
| DATA-06 | 02-04..02-10 | Every mutation writes an audit_log row | ✓ SATISFIED (mechanism) | See Truth #5 (unchanged) |
| DATA-08 | 02-08, 02-09, 02-11 | `REFERENCE_DATE` removed, real time, no hydration errors | ✓ SATISFIED (removal + enforcement); hydration-warning-free rendering needs the human 13-screen walkthrough | See Truth #5, human_verification #3 |

No orphaned requirements. Note: `.planning/REQUIREMENTS.md` still shows all 8 IDs as unchecked `[ ]`/"Pending" — that checklist has not been updated to reflect this phase's completion status; this is a documentation-sync item, not a code gap, and does not affect the verdict above.

### Anti-Patterns Found

None. `git grep -nE "TBD|FIXME|XXX"` across `src/`, `scripts/`, `supabase/` re-run in this session, returns nothing. The one previously-disclosed intentional stub (`createCompanyAction`'s placeholder `date_of_birth`/`gender`/`work_location` for a company-creating owner, documented in 02-04-SUMMARY.md as a "Known Stub" pending the onboarding wizard) is unchanged and does not affect any of the 6 truths above.

### Gaps Summary

**No FAILED truths remain.** The single blocking gap from the previous verification — public signup enabled at the Supabase Auth provider (D-13a) — is now directly re-confirmed closed: `npm run check:signup` exits 0 with `error_code=signup_disabled`, and `supabase/config.toml` reads `enable_signup=false` in both required blocks. This was verified by direct re-execution in this session, not by reading the SUMMARY.

**Three present-but-behavior-unverified truths remain, unchanged in kind from the previous run**, all tracing to `checkpoint:human-verify` tasks that were never resumed as full browser walkthroughs (02-04 Task 4, 02-10 Task 4, 02-11 Task 4):

1. **Browser-restart session persistence (AUTH-01)** — mechanism proven, literal restart never observed by a human.
2. **Dual-membership `/select-company` switch (AUTH-03/AUTH-05)** — resolution logic sound and unit-tested, but genuinely **not exercisable today**: a direct query in this session confirms all 10 live accounts have exactly one membership each. This should be treated as a data precondition to close, not purely a "go watch it happen" task — someone needs to seed a second membership for at least one account before this can be observed at all.
3. **Admin-UI account-creation click-through + one-time-password dialog (AUTH-04)** — new evidence (nv001's real password-change timestamps) confirms the downstream half of the forced-change flow works in a real browser, but the upstream half (admin creates the account, reads the one-time password from the dialog) remains completely unobserved by any human or script.

The phase cannot honestly be marked `passed` while these three items are open, but it is no longer `gaps_found` either — no truth is currently false or missing. It is `human_needed`: the code is real, tested as far as automation reasonably reaches, and the remaining work is a human sitting at a real browser (plus, for the dual-membership case, seeding one extra membership row first).

---

_Verified: 2026-08-01T18:07:46Z_
_Verifier: Claude (gsd-verifier)_
