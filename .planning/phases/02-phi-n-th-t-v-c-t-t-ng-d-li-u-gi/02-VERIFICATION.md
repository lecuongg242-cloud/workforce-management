---
phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
verified: 2026-08-01T17:35:49Z
status: gaps_found
score: 2/6 must-haves verified
behavior_unverified: 3
overrides_applied: 0
gaps:
  - truth: "Đăng ký công khai đã tắt ở cấu hình Supabase Auth (D-13, D-13a) — chủ dự án là người duy nhất tạo được tài khoản owner, người lạ không tạo được dòng doanh nghiệp mới."
    status: failed
    reason: >
      Machine-verified FALSE on both required surfaces. (1) `supabase/config.toml` still reads
      `enable_signup = true` under both `[auth]` (line 176) and `[auth.email]` (line 221) — the
      plan's own Task 3 action required flipping both to `false`; only `[auth.sms]` (line 259,
      unrelated, pre-existing) reads `false`. (2) `npm run check:signup` (the fail-closed probe
      built specifically to prove this) exits 1 with live evidence: the GoTrue endpoint returns
      HTTP 429 `over_email_send_rate_limit`, which by the probe's own documented logic means
      GoTrue accepted the signup request past the gate and only failed later trying to send a
      confirmation email — proof positive that public signup is still ON. This is not a
      programmatic-check limitation; it is a live, reproducible, currently-true fact about the
      cloud project.
    artifacts:
      - path: "supabase/config.toml"
        issue: "[auth].enable_signup=true (line 176) and [auth.email].enable_signup=true (line 221) never edited despite being this exact task's own action item"
      - path: "scripts/check-signup-disabled.mjs"
        issue: "Probe is correctly built and fail-closed; running it now (npm run check:signup) exits 1 with over_email_send_rate_limit — signup confirmed still enabled on the live Supabase project"
    missing:
      - "Disable \"Allow new users to sign up\" in Supabase Dashboard → project ujvgagujfsdrlmjdhooi → Authentication → Sign In / Providers → Email (the human-action checkpoint 02-03 Task 2, deferred by the project owner and still open)"
      - "Edit supabase/config.toml's [auth] and [auth.email] blocks to enable_signup = false, with the comment the plan's Task 3 action (a) specified"
      - "Re-run npm run check:signup until it exits 0 with error_code === \"signup_disabled\""
behavior_unverified_items:
  - truth: "Người dùng đăng nhập bằng Supabase Auth; phiên sống qua đóng/mở trình duyệt thật; đăng xuất mất quyền truy cập ngay lập tức (ROADMAP SC1 / AUTH-01)."
    test: "Log in as a seeded owner, fully quit the browser process (not just the tab), reopen, navigate directly to /admin/dashboard."
    expected: "Still authenticated, no re-login prompt."
    why_human: "Cookie persistence across an actual browser-process restart cannot be exercised by Vitest (in-process, no browser) or by scripts/e2e-auth.mjs (proves the JWT carries expires_at + refresh_token — the ingredients for surviving a restart — but does not itself quit and reopen a browser). This is plan 02-04 Task 4 step 3, a checkpoint:human-verify that was never resumed (no SUMMARY.md was ever written for 02-04 at execution time)."
  - truth: "Người thuộc nhiều doanh nghiệp chọn được doanh nghiệp làm việc qua /select-company với tên thật, và đổi vai trò đúng theo doanh nghiệp đã chọn (ROADMAP SC3 / AUTH-03, AUTH-05)."
    test: "Log in as a dual-membership user, confirm /select-company lists both real company names (Ngọc Phát, Bình Minh) from Postgres, switch between them, confirm session role changes."
    expected: "Both real names shown (not seed/mock data); switching changes the active company and the session's role."
    why_human: "getSessionContext()'s multi-membership resolution logic is unit-tested (session-context.test.ts, 7 assertions, all passing) at the function level, but no automated script (Vitest or scripts/e2e-auth.mjs) exercises the actual /select-company page render or the click-through switch. 02-04-SUMMARY.md states this explicitly: 'Nothing in scripts/e2e-auth.mjs exercises the dual-membership /select-company flow ... this remains completely unverified.'"
  - truth: "Quản trị tạo tài khoản cho nhân viên qua giao diện thật, nhận mật khẩu tạm hiển thị đúng một lần (ROADMAP SC4 / AUTH-04)."
    test: "As an owner, open an employee profile with no linked account, click 'create account', confirm the one-time dialog shows email + temp password, confirm the dialog never reveals the password again if reopened."
    expected: "Dialog shows credentials once; reopening the profile does not redisplay the password."
    why_human: "createEmployeeAccount() is unit-tested at the Server Action level (admin-client-scope.test.ts, accounts.test.ts) and its downstream effects (middleware gate, D-16a anti-trap refresh sequence) are independently proven over real HTTP by scripts/e2e-auth.mjs sections B/C — but the actual admin-UI button click and one-time-reveal dialog behavior has zero automated coverage. This is plan 02-10 Task 4, a 9-step checkpoint:human-verify that was never resumed (no SUMMARY.md existed for 02-10 at execution time)."
human_verification:
  - test: "02-04 Task 4 (6 steps): guest→/login redirect with no admin-chrome flash, session survives a real browser-process restart, dual-membership /select-company with real company names and role-switch, no hydration warnings in DevTools Console."
    expected: "All six steps behave as described in 02-04-PLAN.md's <how-to-verify>."
    why_human: "Depends on real browser cookie lifecycle and visual/hydration inspection; never resumed after the tracer plan's automated tasks finished (no SUMMARY.md was on disk for 02-04 until this verification's own reconstruction)."
  - test: "02-10 Task 4 (9 steps): full account lifecycle — admin creates an account, one-time password dialog, new user forced to /doi-mat-khau, password change completes without a manual reload, re-login with new password succeeds, old temp password is rejected."
    expected: "All nine steps behave as described in 02-10-PLAN.md's <how-to-verify>, especially step 6 (no manual reload) and step 7 (no random logout)."
    why_human: "Depends on real JWT refresh timing (D-16a) and a real admin-UI click-through; never resumed (no SUMMARY.md was on disk for 02-10 until this verification's own reconstruction). The JWT-timing-critical parts (gate + anti-trap refresh) are independently machine-verified by scripts/e2e-auth.mjs sections B/C, but the UI click-through itself is not."
  - test: "02-11 Task 4 (13 screens): full phase-closing UAT — every V1 screen (select-company, dashboard, departments, shifts, employees list/create/detail, employee check-in/out, history, requests, profile, onboarding) walked through as both an owner and an employee on real data, with a clean DevTools Console throughout."
    expected: "All 13 screens render real Postgres data (real company names, real headcounts, today's real date) with no console errors or hydration warnings, and admin-side writes are reflected back on the dashboard."
    why_human: "This is the phase's own closing acceptance checkpoint (checkpoint:human-verify by design) and was never resumed — 02-VALIDATION.md's own row for it (02-11-04) is honestly marked pending by the plan's own Task 3, not assumed done."
---

# Phase 2: Phiên thật và cắt tầng dữ liệu giả Verification Report

**Phase Goal:** Người dùng đăng nhập bằng tài khoản thật và mọi màn hình V1 đọc/ghi Postgres; `mock/db.ts` biến mất khỏi mã nguồn.
**Verified:** 2026-08-01T17:35:49Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + one plan-level must-have)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — Login via Supabase Auth, session in cookie, survives browser open/close, logout revokes access immediately | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Mechanism fully wired and code-reviewed: `signInWithPassword`/`signOut` via `@supabase/ssr`, no `localStorage`/`sessionStorage` in `src/lib/auth/` (`grep -rEc "localStorage\|sessionStorage" src/lib/auth/` → 0). `scripts/e2e-auth.mjs` §D confirms the issued session carries an explicit `expires_at` and `refresh_token` (the *ingredients* for surviving a restart) but does not itself quit/reopen a browser. The literal "survives a real browser-process restart" behavior was never confirmed by a human (02-04 Task 4, never resumed). |
| 2 | SC2 — Guest hitting `/admin/*` or `/employee/*` blocked by `middleware.ts` with a 307 before any render | ✓ VERIFIED | `resolveGate()` pure function has 14 passing unit-test cases (`middleware-gate.test.ts`, verified running in this session: 53/53 across 6 gate/session/route-handler test files). `scripts/e2e-auth.mjs` §A is a committed real-HTTP script asserting 307→`/login` for `/admin/dashboard`, `/admin/employees`, `/employee`, `/employee/history`, and 401 for `GET /api/companies` with no cookie. Blocking occurs in Next.js middleware, which runs before any route Server Component executes — this is architecturally guaranteed, not merely inferred. |
| 3 | SC3 — Four roles see/do only their scope; multi-company users switch and data/role change from a server-resolved active company | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Role-restriction logic (`requireRole(["owner","admin"])`, two-tier "self vs. admin" checks) is thoroughly unit-tested across all six data domains (departments, shifts, employees, requests, accounts — 53+ passing assertions) and code-reviewed consistently. `getSessionContext()`'s multi-membership resolution (never defaults to `memberships[0]`, throws `NoActiveCompanyError` instead) has 7 passing unit tests. However, the actual `/select-company` UI flow with two real companies and a role change on switch has **zero** automated coverage — 02-04-SUMMARY.md states this explicitly as unverified. Platform-admin role (`platform_admins`) is verified only to "function returns true/false" by explicit, documented design (D-11) — the "sees only what it should" claim is deferred to Phase 6 by contract, not a Phase 2 gap. |
| 4 | SC4 — Admin creates employee accounts with a temp password; employee forced to change password on first login | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `createEmployeeAccount()` and `completeForcedPasswordChange()` are both unit-tested (`admin-client-scope.test.ts`, `accounts.test.ts`) with sabotage-and-revert proofs on call order and anti-trap retry logic. `scripts/e2e-auth.mjs` §B/§C independently re-prove the forced-gate and D-16a anti-trap refresh sequence over real HTTP against the live project (per 02-10-SUMMARY.md, commit `9295a20`). The actual admin-UI button click, one-time password-reveal dialog, and full 9-step lifecycle (02-10 Task 4) were never exercised by a human or any script. |
| 5 | SC5 — All V1 screens run on real Postgres data by real time (no `REFERENCE_DATE`); `mock/db.ts`/`mock/seed.ts` deleted; every write leaves a traceable audit_log row | ✓ VERIFIED | `src/lib/mock/` confirmed absent from disk and from git (`git ls-files src/lib/mock` empty). `git grep -nE "^(import\|export).*lib/mock" -- src/` returns nothing. `git grep -n "REFERENCE_DATE" -- src/` returns only the guard test itself (`no-mock-layer.test.ts`). All 9 `route.ts` files under `src/app/api/` export `GET` only with `force-dynamic` (directly confirmed). `logMutation()` is called in every write path across all 6 data domains, unit-tested, and code-reviewed consistently; direct `psql` checks recorded in every plan's SUMMARY confirm real row counts (28/12 employees, 5/4 departments, 4/3 shifts) against the live database. `npm run test` → 100/100 across 14 files; `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:secrets` all exit 0 (all re-run directly in this verification). Residual caveat: live audit_log row-count reconfirmation through a real authenticated HTTP session was performed for the tracer path only (02-04); later plans (02-05..02-10) substituted direct-`psql`/unit-test evidence for the same claim, honestly disclosed as `human_judgment: true` in their own coverage frontmatter, but the underlying mechanism (identical, replicated 6 times, always code-reviewed against the same audited pattern) is credible. |
| 6 | Plan-level must-have (02-03, D-13/D-13a) — Public signup disabled at the Supabase Auth provider config, not just hidden in the UI | ✗ FAILED | `supabase/config.toml` lines 176 (`[auth]`) and 221 (`[auth.email]`) still read `enable_signup = true`. Directly re-ran `npm run check:signup`: exits 1 with `over_email_send_rate_limit` (HTTP 429) — fail-closed proof the signup gate is still open on the live cloud project. See Gaps below. |

**Score:** 2/6 truths verified (3 present-but-behavior-unverified, 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/middleware.ts` | Route gate, exports `middleware`/`config` | ✓ VERIFIED | Present, wired, `resolveGate()` unit-tested |
| `src/lib/auth/session-context.ts` | `getSessionContext()` identity choke point | ✓ VERIFIED | Present; uses `getClaims()` not `getSession()`; no `searchParams`/`URL` reads (grep confirms 0) |
| `src/lib/supabase/{browser,server,middleware}.ts` | Three runtime-split Supabase clients | ✓ VERIFIED | All three present, correctly separated |
| `src/lib/supabase/admin.ts` | Scope-limited secret-key client | ✓ VERIFIED | Present; guarded by `admin-client-scope.test.ts` (5 assertions, passing) |
| `src/app/api/*/route.ts` (9 files) | GET-only, force-dynamic Route Handlers | ✓ VERIFIED | All 9 confirmed to export only `GET` + `dynamic="force-dynamic"` |
| `src/lib/data/mutations/*.ts` (7 modules) | Server Actions with `requireRole` + `logMutation` | ✓ VERIFIED | companies, departments, shifts, employees, attendance, requests, accounts all present, pattern-consistent |
| `src/lib/data/audit.ts` | `logMutation()` shared audit writer | ✓ VERIFIED | Present, called from every mutation module |
| `src/lib/today.ts` | `getServerToday()`/`getServerMonth()` — single source of "today" | ✓ VERIFIED | Present; matches `tf_work_date(now())` per 02-08's psql cross-check |
| `eslint-rules/no-date-in-client.mjs` | D-19a enforcement rule | ✓ VERIFIED | Present, repo-wide (`src/**/*.{ts,tsx}`), proven via fixture pair + sabotage-and-revert |
| `src/__tests__/no-mock-layer.test.ts` | Mechanical gate against mock-layer regression | ✓ VERIFIED | Present, 4 assertions, passing when run directly |
| `src/app/(auth)/doi-mat-khau/*` | Forced password-change route | ✓ VERIFIED | `page.tsx` + `change-password-form.tsx` present |
| `scripts/seed-auth.mjs`, `check-signup-disabled.mjs`, `reset-temp-passwords.mjs`, `e2e-auth.mjs` | Account lifecycle + signup-probe + e2e tooling | ✓ VERIFIED (existence + logic) | All present; `seed-auth.mjs`/`check-signup-disabled.mjs` directly executed in this verification; `e2e-auth.mjs` inspected but not executed (requires a running dev server + live credential) |
| `supabase/migrations/0006-0010` | platform_admins, tf_normalize, employee search RPC, employee-code-dup RPC, check-in time RPCs | ✓ VERIFIED | All 5 present; pushed to live DB per prior SUMMARYs; `npm run check:assertions` confirms 191 ≥ 170 floor |
| `supabase/config.toml` | `[auth].enable_signup = false` per D-13a | ✗ FAILED | Still `true` in both `[auth]` and `[auth.email]` blocks — see Gaps |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/middleware.ts` | `src/lib/supabase/middleware.ts` | `updateSession(request)` | ✓ WIRED | Confirmed by code + passing `middleware-gate.test.ts` |
| `src/app/api/*/route.ts` | `src/lib/auth/session-context.ts` | `getSessionContext()` called first in every handler | ✓ WIRED | Confirmed by code review across all 9 handlers |
| `src/lib/data/mutations/*.ts` | `src/lib/data/audit.ts` | `logMutation()` in the same function as the write | ✓ WIRED | Confirmed across all 7 mutation modules |
| `src/middleware.ts` | JWT `app_metadata` | `mustChangePassword` read from claims, not DB | ✓ WIRED | `grep -rEc "from(.memberships.)\|from(.employees.)" src/middleware.ts` → 0; confirmed no `user_metadata` reads anywhere in the three files that matter |
| `src/lib/data/mutations/accounts.ts` | `src/lib/supabase/admin.ts` | `createAdminSupabase()` for Admin API calls | ✓ WIRED | Confirmed by code |
| `scripts/check-signup-disabled.mjs` | live GoTrue `/auth/v1/signup` | fail-closed HTTP probe | ✓ WIRED (and currently reports RED) | Executed directly in this verification: exits 1, `over_email_send_rate_limit` |

### Behavioral Spot-Checks / Probe Execution

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Full JS test suite | `npm run test` | 100/100 passed, 14 files | ✓ PASS |
| Type check | `npm run typecheck` | exit 0 | ✓ PASS |
| Lint (incl. D-19a rule) | `npm run lint` | exit 0 | ✓ PASS |
| Production build | `npm run build` | exit 0, 17/17 static pages, all API routes render as ƒ (dynamic) | ✓ PASS |
| Secret-bundle scan | `npm run check:secrets` | exit 0, "147 files scanned, no secrets found" | ✓ PASS |
| pgTAP vs. cloud host | `npm run test:db` | exit 0 — correctly **refuses** to run against the cloud host per D-15 enforcement (`scripts/db.mjs`'s cloud-host guard) | ✓ PASS (refusal is correct behavior) |
| pgTAP assertion floor | `npm run check:assertions` | 191 ≥ 170 floor, exit 0 | ✓ PASS |
| Signup-disabled probe | `npm run check:signup` | **exit 1** — `over_email_send_rate_limit` (HTTP 429), signup confirmed still ON | ✗ FAIL (see Gaps) |
| GET-only gate spot-check | 6 focused test files run directly | 53/53 passed (`no-mock-layer`, `admin-client-scope`, `eslint-no-date-in-client`, `route-handlers-get-only`, `session-context`, `middleware-gate`) | ✓ PASS |
| Version pinning | `node -e` check against `package.json` | All 6 core packages exact-pinned as required (no `^`/`~`) | ✓ PASS |
| e2e-auth.mjs (17 assertions over real HTTP) | `npm run test:e2e` | Not executed in this verification (requires a running `npm run dev` server + a live credential neither of which are available in this non-interactive session) | ? SKIP — script inspected and confirmed to exercise exactly what 02-04/02-10 SUMMARYs claim (route gating, forced-password gate, D-16a anti-trap sequence, session-shape checks) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|-------------|--------|----------|
| AUTH-01 | 02-04 | Real Supabase Auth login, cookie session, no localStorage | ⚠️ Mechanism VERIFIED, browser-restart behavior UNVERIFIED | See Truth #1 |
| AUTH-02 | 02-04 | Route protection at `middleware.ts` | ✓ SATISFIED | See Truth #2 |
| AUTH-03 | 02-02, 02-04..02-10 | Four-role authorization | ⚠️ Role-restriction logic VERIFIED, multi-company UI switch UNVERIFIED, platform-admin deferred to Phase 6 by design | See Truth #3 |
| AUTH-04 | 02-03, 02-10 | Admin creates accounts + forced first-login password change | ⚠️ Gate/anti-trap VERIFIED via e2e; admin-UI click-through UNVERIFIED; **public signup still enabled (D-13a) — FAILED** | See Truths #4, #6 |
| AUTH-05 | 02-04 | Multi-company selection, server-resolved active company | ⚠️ Server-side resolution logic VERIFIED; UI switch UNVERIFIED | See Truth #3 |
| DATA-05 | 02-01, 02-04..02-09, 02-11 | `mock/service.ts` replaced, `mock/db.ts`/`mock/seed.ts` deleted, signatures preserved | ✓ SATISFIED | See Truth #5; all 24 functions reconciled in 02-11-SUMMARY.md's table, mock dir confirmed absent |
| DATA-06 | 02-04..02-10 | Every mutation writes an audit_log row | ✓ SATISFIED (mechanism); some live-through-HTTP reconfirmation gaps honestly disclosed by executors | See Truth #5 |
| DATA-08 | 02-08, 02-09, 02-11 | `REFERENCE_DATE` removed, real time, no hydration errors | ✓ SATISFIED (removal + ESLint enforcement); hydration-warning-free rendering itself needs the human 13-screen walkthrough | See Truth #5, human_verification #3 |

No orphaned requirements — the 8 IDs declared across the 11 plans' frontmatter (`requirements:`) exactly match ROADMAP's Phase 2 mapping.

### Anti-Patterns Found

None. `git grep -nE "TBD|FIXME|XXX"` and `TODO|HACK|PLACEHOLDER` across `src/`, `scripts/`, `supabase/` return nothing. One documented, intentional stub was found and cross-checked: `createCompanyAction` (`src/lib/data/mutations/companies.ts`) fills `date_of_birth`/`gender`/`work_location` with placeholder values for a company-creating owner, explicitly flagged as a "Known Stub" in 02-04-SUMMARY.md pending the onboarding wizard's personal-details step (out of Phase 2 scope) — this is disclosed, not hidden, and does not affect any of the 6 truths above.

### Gaps Summary

**One clear-cut FAILED truth blocks a clean phase close:** D-13a (public signup disabled at the Supabase Auth provider) is a locked context decision (`02-CONTEXT.md` D-13/D-13a) that plan 02-03 itself lists as a `must_haves.truths` item, and it is currently, verifiably false — both on the config file (`supabase/config.toml` still reads `enable_signup = true` in the two relevant blocks) and on the live endpoint (the fail-closed probe built specifically to prove this, `npm run check:signup`, exits 1 with concrete evidence). The 02-03/02-11 SUMMARYs are candid about this being "the single largest open item" from the phase, deferred by the project owner rather than hidden — but per this workflow's rules, a failed must-have is a gap regardless of how honestly it was disclosed.

**Three present-but-behavior-unverified truths route to human verification**, all tracing back to `checkpoint:human-verify` tasks that were started but never resumed (02-04 Task 4, 02-10 Task 4, 02-11 Task 4) — no SUMMARY.md existed for three of the eleven plans (02-03, 02-04, 02-10) until they were reconstructed after the fact from commit history, and the fourth (02-11) explicitly records its own closing 13-screen UAT as never performed. The underlying code for all three is well-built and covered as far as automation reasonably can reach (extensive unit tests, a real-HTTP e2e script covering the JWT-timing-sensitive parts of AUTH-01/02/04), but the literal user-facing behaviors — browser-restart session persistence, the dual-membership company-switch UI, and the admin-UI account-creation click-through — have never been confirmed by a human at a real browser.

**Everything else checks out on direct re-verification**: 100/100 tests pass, typecheck/lint/build/check:secrets all exit 0, the mock data layer is confirmed absent from the source tree, all 9 Route Handlers are GET-only with `force-dynamic`, pgTAP assertions sit at 191 (≥170 floor), and package versions are exact-pinned as required.

---

_Verified: 2026-08-01T17:35:49Z_
_Verifier: Claude (gsd-verifier)_
