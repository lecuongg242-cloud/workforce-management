# Pitfalls Research

**Domain:** Multi-tenant Supabase backend + proof-of-presence attendance for a Vietnamese SME workforce SaaS (TimeFlow V2)
**Researched:** 2026-07-31
**Confidence:** MEDIUM (web-sourced, cross-checked across independent results; one HIGH-confidence item sourced directly from Supabase's own troubleshooting docs; codebase-specific claims are HIGH — verified directly against this repo's `PROJECT.md` and `CONCERNS.md`)

This file assumes the starting point documented in `PROJECT.md`: a fully-built Next.js 15 frontend backed by an in-memory mock (`src/lib/mock/service.ts`, `~40 functions`), localStorage session (`session-provider.tsx`), and a fixed `REFERENCE_DATE` — being connected to real Supabase (Postgres + Auth + Storage) with RLS-enforced `company_id` isolation and photo+GPS attendance evidence.

## Critical Pitfalls

### Pitfall 1: RLS enabled on old tables, forgotten on new ones

**What goes wrong:**
The team writes correct `company_id`-scoped RLS policies for the initial schema (employees, shifts, attendance_records) and tests them thoroughly. Weeks later, a new table is added for a feature built in a later phase — company settings, holiday calendars, approval history, invite tokens — and RLS is either never enabled on it, or enabled with no policy attached (which, unlike "no RLS," silently denies *all* access including to the legitimate tenant, so it looks like a bug rather than a security hole and gets "fixed" by disabling RLS to unblock the demo).

**Why it happens:**
RLS is a per-table opt-in in Postgres. There's no framework-level guarantee that "every table has a policy" — it has to be a discipline, and disciplines erode under deadline pressure across 5+ separate feature phases (Settings, Approvals, Super Admin). This project has an unusually high number of tables introduced across separate roadmap phases, not one big-bang schema migration.

**How to avoid:**
- Write one CI/pre-commit check (a SQL query against `pg_tables` / `pg_policies`) that fails the build if any table in the public schema has `rowsecurity = false` or has RLS enabled but zero policies, unless explicitly allow-listed (e.g. lookup/reference tables with no tenant data).
- Add "confirm RLS + policy exist for every new table" to the Definition of Done for any phase that adds a table.
- Since this project routes all client access through Server Actions/Route Handlers (per the Key Decisions in PROJECT.md) rather than direct client-to-Supabase calls, RLS is the *second* layer, not the only one — but the project's own rationale for keeping RLS on is exactly this "handler forgets to filter" scenario, so the check above is not optional.

**Warning signs:**
- A newly-added table works fine in local dev/staging with only one seeded company but nobody has verified it under the two-company test fixture (Ngọc Phát / Bình Minh) already present in the codebase.
- Any migration file that doesn't include an `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` pair in the same commit as `CREATE TABLE`.

**Phase to address:**
Data-foundation phase for the initial schema; re-verify at every subsequent phase that introduces a table (Settings, Approvals, Super Admin).

---

### Pitfall 2: RLS policy trusts a client-supplied value instead of deriving `company_id` from the session

**What goes wrong:**
A policy (or, more likely here, a Server Action that pre-filters before hitting the DB) does `WHERE company_id = $1` where `$1` comes from a request body, query param, or a client-set cookie the frontend controls — instead of deriving it from the authenticated session server-side. An attacker (or just a buggy client that sends the wrong id after a stale cache) can read or write another tenant's rows by changing that one value.

**Why it happens:**
`auth.uid()` gives you the *user*, not the *company* — and this app has multi-company membership ("chọn doanh nghiệp khi thuộc nhiều nơi" — a user can belong to more than one company). The natural-looking shortcut is to let the client tell the server "I'm acting as company X right now" and trust it, because the UI already has that context (e.g., the company switcher). That trust boundary is exactly where tenant isolation breaks.

**How to avoid:**
- Resolve "current company" server-side from a source the client cannot forge: either a `company_memberships` table joined against `auth.uid()` inside the RLS policy itself, or a signed/httpOnly session value validated against real membership on every request — never a plain cookie or header value taken at face value.
- Every RLS policy on a tenant-scoped table should look like `USING (company_id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid()))`, not `USING (company_id = current_setting('app.company_id'))` unless that setting is itself set server-side from a verified membership check on the same request — and even then, prefer the subquery form since it can't be short-circuited by a missing `SET`.
- For the Server Action layer (this project's first line of defense per its Key Decisions), the same rule applies: derive `company_id` from the verified session, never accept it as a form field or trust a value merely because the UI happened to pass the right one during testing.

**Warning signs:**
- Any policy or query filter where the tenant id comes from `request.json()`, a hidden form field, `searchParams`, or a cookie that isn't cryptographically tied to the session.
- Manual test: log in as a Ngọc Phát user, then edit the request payload/cookie to reference Bình Minh's company_id and confirm it's rejected, not just "usually not sent."

**Phase to address:**
Data-foundation phase (Auth + RLS design), with an explicit adversarial test case per subsequent phase that adds a new tenant-scoped write path.

---

### Pitfall 3: `service_role` key leaks to the client or into git history

**What goes wrong:**
The `service_role` key bypasses RLS entirely — it is effectively root on the database. If it ends up in a `NEXT_PUBLIC_*` env var, an API route response, a client bundle, or committed to git, every tenant's data is exposed regardless of how correct the RLS policies are.

**Why it happens:** This is not hypothetical for this project — `PROJECT.md` already documents that `docs/env` contains the Supabase keys, including `SUPABASE_SERVICE_ROLE_KEY`, in plaintext, and flags that the key **must be rotated before connecting to a real backend**. The generic failure mode beyond this specific instance: using the service-role client inside a Route Handler for convenience (to skip writing an RLS policy) and that handler ends up reachable without the intended auth check, or a debug endpoint is left in.

**How to avoid:**
- Rotate the currently-exposed key before any real backend connection happens (this is already an open, named risk in `PROJECT.md` — treat it as blocking, not a nice-to-have).
- Never reference `SUPABASE_SERVICE_ROLE_KEY` outside a small, explicitly-audited set of server-only files (e.g., a super-admin cross-tenant query module) — grep for it in CI and fail the build if it appears in anything under `src/app/**/*client*` or any file without a `"use server"` boundary.
- Default to the `anon` key + user session (RLS-enforced) everywhere; only reach for `service_role` for genuinely cross-tenant operations (super admin dashboard) and wrap those in their own authorization check independent of RLS.
- Remove `docs/env` from the repo (even though gitignored now, it's in git history) — treat as already compromised and rotate rather than assume `.gitignore` protected it retroactively.

**Warning signs:**
- Any `grep -r SUPABASE_SERVICE_ROLE_KEY src/app` hit outside a narrow allow-list.
- `docs/env` or any `.env*` file present in `git log --all --full-history` for this repo.

**Phase to address:**
Must be resolved before or during the data-foundation phase — before any Supabase project is pointed at by real customer data. This is a pre-existing named risk, not a hypothetical one.

---

### Pitfall 4: `SECURITY DEFINER` functions become invisible RLS bypasses

**What goes wrong:**
A Postgres function is marked `SECURITY DEFINER` — often to solve an RLS-recursion problem (a function querying an RLS-protected table triggers RLS again) or to let a lower-privileged role do one specific cross-table operation (e.g., "check the shift table when approving an overtime request"). If that function is created by a role with elevated privileges and doesn't itself re-check `company_id`, it silently bypasses RLS for whoever can call it — and it's callable via `supabase.rpc()` from the client unless deliberately hidden from the exposed API schema.

**Why it happens:** `SECURITY DEFINER` is the standard, documented fix for RLS-recursion and cross-table logic, so it will get reached for during the Approvals phase (an approval touching attendance + shift + leave-balance tables in one transaction) and the Super Admin phase (cross-tenant queries by design). The danger is that "designed to cross tenant boundaries" (super admin) and "should never cross tenant boundaries" (approval logic) use the same Postgres mechanism, and it's easy to copy the pattern from one context into the other.

**How to avoid:**
- Treat every `SECURITY DEFINER` function as a manual audit item: does the function body itself enforce `company_id` scoping, or does it rely on the caller having already been scoped by RLS (which it now bypasses)?
- Keep `SECURITY DEFINER` functions out of exposed/public schema, or grant `EXECUTE` only to the specific role that needs them — not `PUBLIC`/`authenticated` by default.
- Only the Super Admin feature should have genuinely cross-tenant functions; every other `SECURITY DEFINER` function (used for RLS-recursion workarounds in Approvals, for example) must still filter by the caller's own `company_id` inside the function body — RLS bypass is not the same as authorization bypass, but forgetting the manual check turns it into one.

**Warning signs:**
- Any `SECURITY DEFINER` function whose SQL body has no `WHERE company_id = ...` or membership check of its own.
- A `SECURITY DEFINER` function created for Approvals-phase logic that happens to also be reachable from the employee role.

**Phase to address:**
Data-foundation phase (establish the pattern/checklist); re-audited whenever Approvals or Super Admin phases add new functions.

---

### Pitfall 5: Views and JOINs leak rows the base-table policies would have blocked

**What goes wrong:**
Individual tables (`employees`, `attendance_records`, `shifts`) each have correct `company_id` policies. A dashboard query joins across them, or a Postgres `VIEW` is created to simplify a reporting query (e.g., "attendance with employee name and department"). Views in Postgres default to running with the *view creator's* privileges in older behavior patterns, and even where `security_invoker` semantics apply, a view built by combining tables where only one table's policy is checked correctly can return rows that shouldn't be visible to the requesting company — especially once Settings/Departments/Approvals introduce more join surface.

**Why it happens:** RLS is enforced per base table at query-plan time, which is normally safe for joins — but the common real mistake is a table on one side of the join having no policy at all (falls back to allow — or deny-all depending on RLS state) while the developer only tested the "primary" table's policy, or a view explicitly created with `SECURITY DEFINER`-like elevated view semantics for convenience during dashboard-building.

**How to avoid:**
- For any view, explicitly set `security_invoker = true` (Postgres 15+, which Supabase supports) so the view enforces the querying user's RLS, not the creator's.
- Test every multi-table query/view with the two-company fixture already in this codebase (Ngọc Phát vs Bình Minh) — run the same dashboard query as a Bình Minh user and confirm zero Ngọc Phát rows, not just "the right count."
- Prefer building aggregate/reporting queries inside Server Actions with an explicit `company_id` filter rather than relying solely on views to do the filtering — belt and suspenders, consistent with this project's own two-layer defense decision.

**Warning signs:**
- Any `CREATE VIEW` without `WITH (security_invoker = true)`.
- Dashboard/KPI queries (7-day chart, today's activity — already listed as V1 features to reconnect) that join 3+ tables and were only manually checked against one company's data.

**Phase to address:**
Data-foundation phase for the pattern; re-verified when the Dashboard KPI queries are reconnected to real data.

---

### Pitfall 6: Storage buckets holding attendance photos left public, or lacking their own RLS

**What goes wrong:**
Supabase Storage buckets are private by default, but it's common to flip a bucket to "Public" to get simple CDN-style URLs working quickly — which bypasses all access control for both read and write for anyone who has (or guesses) the object URL. For this project specifically, attendance check-in/out photos and any employee profile photos are the asset at risk, and object paths that embed employee or company identifiers make enumeration feasible once one URL leaks.

**Why it happens:** Public buckets are the path of least resistance during development because they "just work" without wiring up storage RLS policies, and there's rarely a deadline-driven reason to go back and lock it down before shipping — especially since it still "looks done" (photos display correctly in the admin review UI).

**How to avoid:**
- Keep the attendance-photo bucket private; serve images through signed URLs generated server-side (short TTL) or proxied through a Server Action/Route Handler that checks the requester's `company_id` and role before returning the file.
- Add storage RLS policies scoped by `company_id` (commonly done by encoding `company_id` in the object path, e.g. `attendance-photos/{company_id}/{employee_id}/{record_id}.jpg`, and writing the policy against that path segment).
- This is a named, real-world incident class, not theoretical: publicly-readable Supabase storage/databases (170+ apps in one documented case) have been found and scraped at scale by security researchers scanning for exposed Supabase projects. Treat "photo evidence of employee presence and location" as sensitive data requiring the same rigor as the RLS policies on the tables themselves.

**Warning signs:**
- Bucket configured as "Public" in the Supabase dashboard for any bucket holding employee photos.
- Image `<img src>` URLs in the admin review UI that are permanent public Supabase Storage URLs rather than signed/proxied.

**Phase to address:**
Attendance-evidence phase (photo capture + admin review), verified explicitly since this is the phase that first writes real photos to storage.

---

### Pitfall 7: `REFERENCE_DATE` removal exposes hydration mismatches and hidden "today" assumptions

**What goes wrong:**
`PROJECT.md` and `CONCERNS.md` both flag that V1 hardcodes `REFERENCE_DATE` (2026-07-27) throughout specifically *to avoid* hydration mismatches, because server-rendered "today" and client-rendered "today" would otherwise disagree under a real, moving clock. Once real data replaces the mock and this constant is removed, every place that implicitly depended on "today is always this fixed date" (dashboard KPIs, "this month" summaries, default date-range pickers, the 7-day chart) becomes exposed to real Date/timezone handling — and to genuine server/client clock disagreement causing React hydration errors (server renders one date, client re-renders a different one a moment later, especially near local midnight in Vietnam's UTC+7).

**Why it happens:** The mock layer was deliberately built to make dates deterministic for a stable demo. That determinism silently hid every place `new Date()` or "current month" logic would otherwise need genuine timezone-aware handling — this only surfaces once real time is flowing through the system.

**How to avoid:**
- Establish one single source of truth for "now" server-side (compute `today` in a Server Component/Server Action anchored to Vietnam's UTC+7, never `new Date()` inside a Client Component for anything that also renders server-side).
- Audit every usage site of `REFERENCE_DATE` before deleting it — each one is a place that needs deliberate real-date logic, not a mechanical find/replace with `new Date()`.
- For anything rendered on both server and client (dashboard "today" label, month pickers), pass the server-computed date down as a prop rather than letting the client independently compute it, eliminating the hydration mismatch by construction.

**Warning signs:**
- React hydration warnings in the console immediately after removing `REFERENCE_DATE`, especially clustered around midnight Vietnam time during testing.
- Any remaining `new Date()` call inside a component that also runs during SSR.

**Phase to address:**
Data-foundation phase (where `service.ts` bodies are replaced) — this should be treated as its own explicit checklist item, not a side effect of the migration.

---

### Pitfall 8: Mock-only assumptions about data shape break once real inserts happen

**What goes wrong:**
`CONCERNS.md` already documents a live example: `workedMinutes` calculation can be wrong "if shift record missing or checkIn is null" — currently masked because the UI prevents checkout without checkin and the mock seed data never produces that state. Once real database writes happen (a manager manually corrects a record, a request timeout leaves a check-in without a matching check-out, an employee's shift assignment is deleted after they've already checked in), these "shouldn't happen" states start happening, and calculation code that never had to handle nulls/duplicates/orphans breaks in production with real customer data already in the system — which is expensive to fix retroactively because historical records may already be wrong.

**Why it happens:** In-memory seed data is generated to be internally consistent by construction (every attendance record has a valid shift, every check-out has a check-in). Real data doesn't have that guarantee — concurrent requests, partial failures, and manual admin corrections all produce edge cases the seed generator never modeled.

**How to avoid:**
- Before porting each `service.ts` function body, explicitly enumerate the null/missing/duplicate cases the real schema can produce that the mock couldn't (missing check-out, shift deleted after assignment, duplicate check-in from a retried request) and add both DB constraints (where feasible, e.g. a partial unique index preventing two open check-ins for one employee) and defensive calculation logic.
- Add the "checkout without checkin" and "shift missing" cases from `CONCERNS.md` to the test suite for this migration specifically, since they're already named as known gaps.
- Treat this as the reason automated tests matter now even though V1 shipped without any (`CONCERNS.md` — "Zero Test Files in Source") — the migration phase is exactly when hidden assumptions get exercised for the first time.

**Warning signs:**
- Any calculation function that reads a nullable field without a null check, ported unchanged from the mock.
- No unique/exclusion constraint preventing an employee from having two simultaneously "open" attendance records.

**Phase to address:**
Data-foundation phase, specifically the `service.ts` → real-query conversion work.

---

### Pitfall 9: N+1 queries where the mock layer's in-memory loops were free

**What goes wrong:**
In-memory `Array.find()`/`Array.filter()` calls inside a loop cost nothing measurable. The same pattern — e.g., building a monthly attendance summary by iterating employees and, for each one, separately fetching their records — becomes N round trips to Postgres once real network latency exists. At 28–40 seed employees this might still feel fine in dev; it becomes visibly slow (and eventually times out Server Actions) as real companies add more employees or as date ranges grow (a full month of daily records per employee).

**Why it happens:** `service.ts`'s ~40 functions were designed around convenient in-memory access patterns and 1:1 signature mapping to future Supabase calls (a deliberate, documented decision in `PROJECT.md`) — but "same function signature" doesn't guarantee "same query shape underneath." A function that loops and calls another mock function per iteration will, ported literally, loop and call `supabase.from(...)` per iteration.

**How to avoid:**
- When converting each function body, look specifically for any loop that calls another data-access function inside it — those are the N+1 candidates — and replace with a single query using `IN (...)`, a join, or a Postgres RPC that does the aggregation server-side.
- Prioritize this audit for the functions behind the dashboard KPIs and monthly summaries (highest fan-out: per-employee-per-day).
- Add a lightweight query-count assertion in tests for at least the highest-traffic Server Actions (e.g., "loading the dashboard issues at most N queries") so a regression is caught before it reaches customer data at scale.

**Warning signs:**
- A Server Action whose response time scales roughly linearly with employee count during manual testing.
- Any `for`/`.map()` loop containing an `await supabase.from(...)` call inside it.

**Phase to address:**
Data-foundation phase, with a re-check whenever a later phase (Approvals, Dashboard reconnection) adds a new aggregate query.

---

### Pitfall 10: In-memory pagination/sorting logic doesn't translate cleanly to SQL

**What goes wrong:**
The mock service almost certainly implements "search, filter, paginate" (documented V1 feature: employee list with "tìm kiếm, lọc, phân trang") via array slicing over a stable in-memory array. Ported literally to SQL, this can mean: fetching the *entire* filtered table into the Server Action and slicing in JS (works but doesn't scale and defeats the point of moving to a real DB), or naive `LIMIT/OFFSET` pagination that silently skips/duplicates rows when the underlying data changes between page loads (an admin adds an employee while another admin is on page 2), or a "total count" computed by fetching everything instead of a separate `COUNT(*)` query.

**Why it happens:** In-memory arrays have no concurrency concerns and no cost difference between "slice a page" and "compute a count" — SQL does, and the mismatch is invisible until either performance or correctness (drifting offsets) becomes noticeable, both of which need real, changing data to manifest.

**How to avoid:**
- Port pagination as `LIMIT/OFFSET` with a stable `ORDER BY` (including a tiebreaker column like `id`) at minimum, and consider keyset/cursor pagination for any list expected to be edited concurrently while paged (the employee list, given bulk operations are a V1 feature).
- Compute counts via a separate `COUNT(*) ... WHERE` query, not by fetching full result sets client-side.
- Test pagination correctness specifically under concurrent writes (add a row while paginated on page 2) since this is exactly the case the mock array never exhibited.

**Warning signs:**
- Any Server Action that fetches an unbounded result set and slices it in JavaScript.
- Pagination that "loses" or duplicates a row when combined with the bulk-operations feature (add/remove while another session is paginating).

**Phase to address:**
Data-foundation phase, employee-management data-access conversion specifically.

---

### Pitfall 11: `getSession()` used for server-side authorization instead of `getUser()`

**What goes wrong:**
Supabase's own documentation is explicit on this: `getSession()` on the server only decodes the local JWT without revalidating it against the Auth server, so it "isn't guaranteed to validate the received Auth cookie." Using it to gate access in Server Components, Server Actions, or `middleware.ts` means a tampered or stale cookie can pass an authorization check that should have failed. `getUser()` makes a real network round-trip to Supabase Auth and is the only call that should be trusted for authorization decisions server-side.

**Why it happens:** `getSession()` is faster (no network call) and is the natural-feeling choice when porting client-side patterns (where `getSession()` is normal, since the browser SDK already validated on load) into server code, especially when a developer is moving fast to replace `session-provider.tsx`'s localStorage reads with "the Supabase equivalent" without internalizing that server and client have different trust requirements.

**How to avoid:**
- Establish one shared server-side "get current user" helper that calls `getUser()` and is the *only* sanctioned way to check identity in Server Components/Server Actions/`middleware.ts` — ban direct `getSession()` calls outside that helper via a lint rule or code-review checklist.
- Use `getSession()` only when the raw access/refresh token values themselves are needed (rare in this app), never for "is this user allowed to see this."

**Warning signs:**
- Any `await supabase.auth.getSession()` call inside a file with `"use server"`, inside `middleware.ts`, or inside a Server Component.

**Phase to address:**
Data-foundation phase (Auth migration) — should be a one-line rule in the phase's own definition of done.

---

### Pitfall 12: Middleware/redirect races between the three Next.js execution environments

**What goes wrong:**
App Router splits execution across Edge middleware (runs before the request completes, no browser access), Server Components (Node, no browser access), and Client Components (browser, no server access). Supabase session cookies need to be read and refreshed consistently across all three. Two concrete failure patterns are common: (1) middleware protects `/admin` and `/employee` but its matcher also intercepts `/login` or the auth callback route, producing a redirect loop (protected page → login → login itself gets redirected → loop); (2) a session cookie goes stale because middleware isn't refreshing it on every request, so a user gets silently bounced to login mid-session and back.

**Why it happens:** This is the standard, well-documented failure mode of wiring Supabase Auth into Next.js App Router middleware — it appears repeatedly across community troubleshooting content, not specific to this codebase, but this project is migrating from a *much* simpler model (localStorage session with client-only checks, no middleware at all) directly into this three-environment split, so the team has no prior experience with this class of bug in this codebase.

**How to avoid:**
- Explicitly exclude auth routes (`/login`, `/(auth)/**`, the OAuth/magic-link callback route) from whatever matcher/condition triggers the protected-route redirect in `middleware.ts`.
- Call `supabase.auth.getUser()` inside `middleware.ts` on every matched request specifically to refresh the session cookie (per Supabase's documented SSR pattern) — not just to check auth state.
- Manually test the redirect graph before shipping: logged-out user hitting `/admin/*` → login (once, not looped); logged-in user hitting `/login` → redirected to their dashboard (once); session cookie approaching expiry → refreshed transparently, not bounced.

**Warning signs:**
- Any manual QA session where clicking a protected link occasionally bounces to login and immediately back.
- `middleware.ts` matcher config that doesn't explicitly exclude the login/callback paths.

**Phase to address:**
Data-foundation phase (Auth migration), with the redirect graph explicitly listed as a UAT check.

---

### Pitfall 13: Client-held identity (role/company) drifts from server-enforced identity after auth migration

**What goes wrong:**
`session-provider.tsx` currently holds `userId`/`companyId`/`role` in a React context sourced from localStorage, and components throughout the app read that context to decide what to render (which is itself flagged in `CONCERNS.md`: "no role-based access control at API level," "one hardcoded user can access all companies and roles"). After migrating to Supabase Auth + cookies, if any client-side code still reads a locally-cached notion of "current company" or "current role" instead of what the server actually enforces via the session, the UI can show the wrong company's data label or the wrong permission-gated buttons even though the underlying Server Actions correctly reject the request — a confusing, hard-to-reproduce class of bug where "the button is there but clicking it fails," or worse, where a stale client-side company selection briefly renders another company's cached data before the server-verified fetch corrects it.

**Why it happens:** The multi-company switcher (a validated V1 feature — "chọn doanh nghiệp khi thuộc nhiều nơi") needs *some* client-side state to know which company is "currently selected" for UI purposes, and it's tempting to keep that in the same kind of client context as before rather than re-deriving it from a server-verified source on every navigation.

**How to avoid:**
- Make "current company" a value that's set via a server-verified action (validate the user is actually a member of the company being switched to) and stored in a way the server also reads (cookie/session), not a client-only React state that can drift from what Server Actions will actually enforce.
- Re-derive role/permission-gated UI from a server-provided value on each page load (Server Component prop) rather than trusting a client context value to still be accurate after a company switch or a permission change made by an admin mid-session.

**Warning signs:**
- Any UI element gated by `role` or `companyId` read from client-side React context/localStorage rather than passed down from a Server Component that itself re-derived it from the verified session.
- A company switch that updates the header label immediately but data on the page briefly still reflects the old company.

**Phase to address:**
Data-foundation phase (Auth migration), specifically the company-switcher and role-gated-UI rework.

---

### Pitfall 14: GPS + photo "proof of presence" is treated as unbeatable instead of fraud deterrence

**What goes wrong:**
Teams build photo + GPS verification, ship it, and treat "the record has a photo and coordinates" as proof the employee was physically present. In practice: free mock-location apps trip Android's `ALLOW_MOCK_LOCATION` flag and are individually easy to catch (roughly 60–80% of casual attempts, per industry write-ups), but rooted or Magisk-modified devices can hide that flag entirely via Xposed-style modules — meaning the population most motivated to cheat (repeat offenders, not one-off convenience spoofers) is exactly the population basic mock-location detection misses. Similarly, a bare photo requirement without liveness detection is defeated trivially by photographing a photo or another phone's screen — this project's own `PROJECT.md` explicitly names this as the reason QR-code check-in was rejected ("ảnh đơn thuần bị lách bằng cách chụp lại màn hình" — a plain photo alone is bypassed by rescreening), which means the same "plain photo" weakness applies to the photo requirement itself if liveness isn't addressed.

**Why it happens:** GPS coordinates and a captured photo *look* like strong evidence in a review UI, so it's easy to ship the feature, see it work against casual testing, and consider the anti-fraud problem solved — the gap only becomes visible once a specific employee is determined to cheat and the team discovers detection wasn't layered.

**How to avoid:**
- Layer independent signals rather than relying on any single one: mock-location flag detection, physics-based checks (impossible speed/teleport between consecutive check-ins, suspiciously "clean"/constant GPS accuracy vs. real noisy GPS), and — most importantly for the photo side — basic liveness signals (this doesn't need full biometric liveness SDKs for a pilot scale of 1–2 companies, but should at minimum defeat "photo of a screen": e.g., requiring the live camera feed with no gallery-picker path, which `PROJECT.md` already specifies as required, "không cho chọn ảnh có sẵn").
- Generate the attendance timestamp server-side, never trust a client-supplied clock value — this closes the "clock tampering" vector regardless of GPS/photo strength.
- Prevent replayed uploads: each check-in/out submission should be tied to a server-issued, single-use token/nonce for that specific attempt so a previously-accepted photo+GPS payload can't be resubmitted verbatim for a different time.
- Set expectations explicitly with the business stakeholder: this is fraud *deterrence and evidence for manual review*, not cryptographic proof — the admin photo/location review feature (already in scope) is the actual enforcement mechanism, backed by these technical signals, not a replacement for it.

**Warning signs:**
- No server-side check for "impossible" consecutive GPS points (e.g., check-out 50km from check-in 10 minutes later).
- Attendance timestamp derived from any client-supplied value rather than the server's own clock at request-receipt time.
- No mechanism preventing the exact same photo/GPS payload from being submitted twice.

**Phase to address:**
Attendance-evidence phase — the layered-detection checks should be scoped as part of this phase's acceptance criteria, not treated as a later hardening pass.

---

### Pitfall 15: Attendance photos and GPS coordinates handled without Vietnam's data-protection consent/safeguard obligations

**What goes wrong:**
Employee photos and precise location data are sensitive personal data under Vietnamese law (Decree 13/2023/ND-CP, with a new, stricter Personal Data Protection Law taking effect January 1, 2026 that adds employment-specific rules including explicit consent for employee monitoring). Shipping the attendance-evidence feature without an explicit consent capture step, without documented data-minimization/retention practice, and without the storage-layer safeguards this implies (see Pitfall 6) creates real legal exposure for the customer businesses this product serves — not just a security nice-to-have.

**Why it happens:** Consent/legal-compliance work doesn't show up in a demo and has no visible UI difference from "it works," so it's easy for an engineering-driven roadmap to treat it as out of scope for a pilot, especially when the explicit V1/V2 scope decisions already deferred payroll/legal-heavy features (gross-net, thuế TNCN, BHXH) to V3 for exactly this "high business/legal risk" reason — the same reasoning applies here but is less obviously in-scope.

**How to avoid:**
- Add an explicit consent step to onboarding/employee-invite flow (or at minimum, a documented notice) before the first photo/location capture, since this is now specifically named as required under the incoming employment-monitoring provisions.
- Apply data minimization: store what's needed for verification/dispute-resolution and no more; define (even informally, for the pilot) how long attendance photos are retained and who can access them (already scoped correctly in requirements — "chỉ người có quyền trong cùng doanh nghiệp xem được").
- Treat this as a real requirement to validate with the business owner, not an assumption to defer silently — unlike payroll, this touches the feature being built in V2, not V3.

**Warning signs:**
- No consent-capture UI/copy anywhere in onboarding or employee invite flow before photo/GPS attendance goes live.
- No documented retention policy for attendance photos.

**Phase to address:**
Attendance-evidence phase, and/or Company Settings phase if consent is modeled as a company-level onboarding step.

---

### Pitfall 16: Overnight shifts silently split at midnight, corrupting totals and overtime

**What goes wrong:**
A shift like 22:00–06:00 gets stored/computed such that the check-in date and check-out date differ, and any code that groups or sums attendance "by date" (dashboards, monthly summaries, overtime-trigger logic) that doesn't explicitly account for this either drops the shift, double-counts it, or attributes hours to the wrong calendar day — breaking both the "monthly summary" and "overtime rules" features already in requirements ("quy tắc tăng ca" in Company Settings).

**Why it happens:** V1 already claims overnight-shift support at the UI level ("Quản lý ca làm việc, hỗ trợ ca qua đêm"), but `CONCERNS.md` independently flags that date calculations rely on fragile string-format logic with "no unit tests for date edge cases... timezone issues" — meaning the underlying calculation correctness for this exact scenario is explicitly unverified, not just unhandled.

**How to avoid:**
- Compute worked duration by treating the shift as anchored to a single logical work-date (typically the start date) and adding 24h to the end time when `end < start` (e.g., 22:00→06:00 = `(06:00 + 24h) − 22:00` = 8h), rather than deriving duration from two separately-stored calendar-day timestamps that get grouped independently downstream.
- Any "attendance for date X" query must explicitly decide whether an overnight shift starting on X-1 but ending on X belongs to X-1 or X, and apply that rule consistently across dashboard, monthly summary, and overtime calculation — not independently reinvented per feature.
- Add unit tests specifically for the overnight-shift boundary case before this ships, given `CONCERNS.md` already names this as an untested area.

**Warning signs:**
- Any "sum hours for this month" query that groups by `DATE(checked_in_at)` without adjusting for shifts crossing midnight.
- Overtime calculated per calendar day rather than per logical shift for employees on overnight rotations.

**Phase to address:**
Company Settings phase (where overtime/working-hours rules are configured) and the data-foundation phase's date-handling utilities — this needs to be solved once, centrally, not per-feature.

---

### Pitfall 17: UTC+7 timezone assumed implicitly instead of handled explicitly

**What goes wrong:**
Vietnam has no DST, which paradoxically makes timezone bugs *more* likely to go unnoticed during development (nothing ever "shifts" locally), while the actual risk is server/database default timezone (commonly UTC in Postgres/Supabase) disagreeing with the Vietnam-local business meaning of "today," "this month," or a shift's start time. A timestamp stored as UTC and displayed without an explicit +7 conversion will show the wrong date near local midnight (e.g., a 00:30 Vietnam check-in stored as 17:30 UTC the *previous* day) — exactly the kind of bug the current `REFERENCE_DATE`-based string format in `format.ts` was never exercised against, per `CONCERNS.md`.

**Why it happens:** "No DST" is often (wrongly) treated as "no timezone bugs" by developers, when the actual risk is a fixed, unhandled UTC-offset mismatch between where data is stored and where it's interpreted — which is arguably easier to get wrong exactly because it never seems to "break" during a single dev session in one timezone.

**How to avoid:**
- Store all instants (check-in/out timestamps) as `timestamptz` in Postgres (UTC internally, which Supabase/Postgres does correctly) but *always* render and reason about business-date boundaries ("today," "this month," shift-date attribution) by explicitly converting to Asia/Ho_Chi_Minh (UTC+7) — never let the server's or database's default UTC date leak into "what day did this happen" logic.
- Audit `src/lib/format.ts` specifically — `CONCERNS.md` already flags it as fragile, string-format-dependent, with no validation and no edge-case tests — before layering real, moving dates on top of it.
- Since the target market is single-timezone only (per PROJECT.md constraints — no multi-locale need), this doesn't need a general timezone library for arbitrary zones, but it does need one consistent, explicit UTC+7 conversion point rather than ad hoc `Date` arithmetic scattered across components.

**Warning signs:**
- Any place `new Date().toISOString().slice(0,10)` (or similar) is used to derive "today's date" without an explicit UTC+7 offset — this yields the wrong date for roughly 7 hours of every Vietnam day.
- `format.ts` functions with no unit tests for month/year boundaries, exactly as `CONCERNS.md` already flags.

**Phase to address:**
Data-foundation phase, as part of the same date-handling rework needed for `REFERENCE_DATE` removal (Pitfall 7) and overnight shifts (Pitfall 16) — these three should be solved together, not as separate patches.

---

### Pitfall 18: Retroactive corrections silently rewrite totals for periods already treated as closed

**What goes wrong:**
An admin approves a "bổ sung công" (backfill/correction) request for a date in a period that was already reported on, reviewed, or (once V3 payroll exists) paid out. If the system has no concept of a "closed" period, the approval silently changes historical totals with no record that a closed period was altered — which is exactly the kind of bug that's cheap to prevent structurally and expensive to discover after real customer payroll decisions were already made on the old numbers.

**Why it happens:** The approval flow is scoped in V2 as "yêu cầu được duyệt tác động đúng vào dữ liệu công của kỳ" (an approved request correctly affects the period's attendance data) — this is correct and necessary, but nothing in the current requirements defines what happens when the *period itself* is no longer open, because period-closing isn't explicitly named as a V2 concept (payroll is deferred to V3). The gap is that "correction requests" and "period locking" are usually two sides of the same feature, and building one without the other is a natural, easy-to-miss omission.

**How to avoid:**
- Even without full payroll in V2, define a minimal "period status" concept (e.g., a month can be marked reviewed/exported) so a retroactive correction after that point requires an explicit reopen action and is visibly logged as "modified after close" — not silently blended into the original totals.
- At minimum for the pilot: log every correction with a timestamp and the approving admin (already scoped — "lịch sử xử lý yêu cầu, ai duyệt lúc nào") and make it possible to answer "was this month's total ever changed after the fact," even if formal period-locking is deferred.
- Flag this explicitly for whoever designs the Approvals phase, since it sits at the boundary of what's in scope for V2 vs. deferred to V3 payroll and could easily fall through that gap.

**Warning signs:**
- Approval flow that updates attendance totals with no distinction between "correction to an in-progress period" and "correction to a period already exported/reviewed."
- No audit trail answering "did this month's reported total change after a manager already looked at it."

**Phase to address:**
Approvals phase (correction/leave/overtime request handling) — should be scoped explicitly rather than assumed to be a V3-payroll-only concern.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Using `service_role` client in a Server Action to skip writing an RLS policy | Feature ships faster, no policy debugging | Total tenant-isolation bypass if the handler's own auth check ever has a gap; RLS becomes decorative | Never for tenant-scoped tables; only for genuinely cross-tenant Super Admin operations with their own independent auth check |
| Public Supabase Storage bucket for attendance photos | Simple `<img src>` URLs, no signed-URL plumbing | Employee photos/location-linked files become world-readable by URL; real incidents of this exact pattern being scraped at scale exist | Never for photo/PII buckets; acceptable only for genuinely public assets (e.g., company logos) |
| Porting `service.ts` loop-based aggregation literally (call-per-iteration) | Fast conversion, same function signature preserved | N+1 queries; Server Actions slow down or time out as real companies grow past pilot scale | Acceptable only as a stopgap with a tracked follow-up before onboarding a company beyond a handful of employees |
| Keeping client-side role/company context reads instead of re-deriving from server on each load | Less rework of existing components during migration | Client UI can drift from server-enforced permissions, producing confusing "button visible but action rejected" bugs | Never for anything security-relevant; acceptable only for pure display convenience that's re-verified server-side anyway |
| Shipping photo+GPS without liveness/replay protection for the pilot | Ships the core feature faster | First determined cheater discovers the gap; trust in "the data is real" (the product's stated Core Value) erodes with real customers | Acceptable only if explicitly communicated as a v1-of-the-feature limitation with a committed follow-up, never presented as solved |
| No period-locking concept alongside correction approvals | Simpler Approvals phase scope | Silent retroactive rewrites of reported totals once real customers rely on monthly numbers | Acceptable for the pilot only if corrections are logged/auditable even without formal locking |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Supabase Auth + Next.js middleware | Middleware matcher also intercepts `/login`/callback routes, causing redirect loops; or middleware doesn't call `getUser()` so cookies never refresh | Explicitly exclude auth routes from protected-route matching; always refresh the session via `getUser()` inside middleware on every matched request |
| Supabase RLS + Server Actions | Treating RLS as the *only* defense and skipping explicit `company_id` checks in the Server Action itself | Keep both layers independently correct, exactly as this project's own Key Decisions already specify — RLS should be the safety net, not the primary gate |
| Supabase Storage + attendance photos | Bucket set to Public for simple URL access | Private bucket + storage RLS policy keyed on a `company_id` path segment, served via signed URL or a server-side proxy |
| Supabase `rpc()` (SECURITY DEFINER functions) | Function created to solve RLS recursion, exposed to `authenticated` role by default, with no internal `company_id` check | Restrict `EXECUTE` grants to the minimum role needed; internally re-check `company_id` inside any function that bypasses RLS |
| Device GPS/camera APIs (browser Geolocation, `getUserMedia`) | Trusting client-reported coordinates and client-reported capture time at face value | Server-side timestamp always; server-side plausibility checks on coordinates (radius, speed-between-points) before accepting the record |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| N+1 queries from literally-ported mock loops | Server Actions slow down roughly linearly with employee/record count | Convert per-iteration data-access calls into single `IN (...)`/join/RPC queries during the `service.ts` conversion, not after | Noticeable well before 1,000 employees; painful even at the low hundreds given daily attendance rows |
| Full-table fetch + in-JS slice for pagination | Employee list/attendance history slows as a company's headcount or history grows | Real `LIMIT/OFFSET` or keyset pagination with a proper `ORDER BY`; separate `COUNT(*)` query | Breaks well before the "1-2 companies" pilot ends if any company has more than ~100 employees with months of history |
| Missing indexes on RLS-referenced columns (`company_id`, membership join columns) | RLS policy evaluation gets slower as row counts grow, even though the query "looks" simple | Index every column referenced inside an RLS `USING`/`WITH CHECK` clause, especially `company_id` and any membership-table join keys | Becomes noticeable once attendance history accumulates over multiple months per company |
| Building monthly attendance history synchronously per request | Dashboard/monthly-summary pages feel slow as history accumulates | Pre-aggregate or cache monthly summaries rather than recomputing from raw attendance rows on every page load | Scales poorly past a few months of accumulated daily records per employee |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting a client-supplied `company_id` anywhere in a query or policy | Full cross-tenant data read/write | Always derive `company_id` from a server-verified membership check tied to `auth.uid()`, never from client input |
| `service_role` key present anywhere reachable by client code or committed to git | Total RLS bypass, all tenants exposed | Rotate immediately (already a named open risk in this project); restrict usage to a narrow, audited server-only module |
| Public storage bucket for employee photos | Employee photo + implied location data world-readable by URL, enumerable via predictable paths | Private bucket, storage RLS scoped by `company_id` path segment, signed URLs or server-side proxy |
| `SECURITY DEFINER` function without internal `company_id` re-check | Function becomes an unaudited cross-tenant access path | Manual audit checklist for every `SECURITY DEFINER` function; restrict `EXECUTE` grants |
| Client-supplied timestamp trusted for attendance check-in/out time | Clock tampering enables falsified attendance records | Always use server receipt time as the authoritative timestamp |
| No consent capture before collecting biometric photo + precise location data | Non-compliance with Vietnam's Decree 13/2023 and incoming 2026 PDP Law employment-monitoring provisions | Explicit consent step in onboarding/invite flow before first photo/location capture goes live |
| `getSession()` used for server-side auth gating | Stale/tampered session cookie can pass an authorization check it shouldn't | Use `getUser()` exclusively for server-side identity/authorization decisions |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Redirect loop between protected route and login after auth migration | Employee/admin gets stuck bouncing between pages, appears the app is broken | Explicitly test and exclude auth routes from middleware's protected-route logic; treat the full redirect graph as a UAT checklist |
| Photo/GPS check-in rejected with a generic error when GPS accuracy is poor (common indoors/underground in real offices) | Legitimate employees blocked from checking in, erodes trust in the "proof of presence" feature it was built to establish | Distinguish "outside allowed radius" from "GPS accuracy too low to determine" and give an actionable message/retry path rather than a flat rejection |
| Silent retroactive change to a month's reported total after a correction is approved | Manager or (eventually) payroll reviewer discovers numbers changed without warning after they'd already reported/relied on them | Surface "modified after review" state explicitly, even in a lightweight form, per Pitfall 18 |
| Company-switcher UI updates instantly but underlying data briefly reflects the old company (client/server identity drift, Pitfall 13) | Confusing flash of wrong data right after switching companies | Gate the UI transition on the server-verified switch completing, not on optimistic client state alone |

## "Looks Done But Isn't" Checklist

- [ ] **RLS on tenant tables:** Every table has RLS enabled *and* at least one policy — verify via a query against `pg_tables`/`pg_policies`, not by "it worked when I tested with one company."
- [ ] **Storage bucket privacy:** Attendance-photo bucket is Private with a `company_id`-scoped storage policy — verify by attempting to fetch a known object URL from an unauthenticated/incognito session.
- [ ] **Overnight shift totals:** A shift crossing midnight (22:00–06:00 or similar) produces correct hours and correct overtime attribution — verify with an actual test case, not visual inspection of the UI.
- [ ] **Auth redirect graph:** Logged-out access to protected routes, logged-in access to `/login`, and session-expiry mid-session all resolve without looping — verify by manually walking the graph, not just the happy path.
- [ ] **`company_id` never trusted from client input:** Grep every Server Action/Route Handler for `company_id` sourced from `request.json()`/`searchParams`/form fields instead of the verified session.
- [ ] **Timestamp authority:** Attendance check-in/out time is the server's receipt time, not a client-supplied value — verify by attempting to submit a manipulated client timestamp and confirming it's ignored.
- [ ] **`REFERENCE_DATE` fully removed:** No remaining references anywhere in `src/`, and no hydration warnings in the console around local midnight (UTC+7).
- [ ] **Consent capture exists:** Onboarding/invite flow includes an explicit notice/consent step before photo+GPS attendance data collection begins.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-------------------|
| Missing RLS policy discovered after real data exists | MEDIUM | Add the policy immediately (RLS deny-by-default means the gap was likely "inaccessible" rather than "exposed," but audit access logs for the window it was missing if it was misconfigured as fully open) |
| `service_role` key already leaked/committed | HIGH | Rotate the key immediately in Supabase dashboard, update all server env references, audit Supabase project logs for any access during the exposure window, purge from git history if committed |
| Public storage bucket discovered with real employee photos already exposed | HIGH | Flip bucket to private immediately, rotate any predictable-path object URLs if feasible, audit access logs for external fetches during the exposure window, notify affected company per data-protection obligations if evidence of external access exists |
| Overnight-shift totals found to be wrong after weeks of real data | MEDIUM | Backfill-recalculate affected records from raw check-in/out timestamps (not from the already-wrong aggregated totals) once the calculation bug is fixed; flag any period already reported to a manager as corrected |
| Retroactive correction silently altered an already-reviewed period | LOW–MEDIUM | Add the missing audit trail/period-status concept going forward; for past occurrences, reconstruct via the request-approval history already required in scope ("lịch sử xử lý yêu cầu") to identify what changed and when |
| GPS/photo spoofing discovered in practice after launch | MEDIUM | Add the missing layered checks (physics-based plausibility, liveness) as a fast-follow; in the interim, rely on the admin manual photo/location review feature (already in scope) as the enforcement backstop |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|-----------------|
| Missing RLS on new tables (1) | Data-foundation; re-checked every phase adding a table | `pg_policies` audit script passes in CI |
| Client-supplied `company_id` trusted (2) | Data-foundation | Adversarial test: swap `company_id` in a request as a foreign-tenant user, confirm rejection |
| `service_role` key exposure (3) | Data-foundation (blocking, pre-existing risk) | Key rotated; grep for the env var outside allow-listed server files returns nothing |
| `SECURITY DEFINER` bypass (4) | Data-foundation; re-audited in Approvals, Super Admin | Manual checklist per function: internal `company_id` check present, `EXECUTE` grant minimal |
| Views/joins leaking rows (5) | Data-foundation; re-verified when Dashboard KPIs reconnect | Two-company fixture test on every multi-table view/query |
| Public storage bucket (6) | Attendance-evidence phase | Unauthenticated fetch of a known object URL fails |
| `REFERENCE_DATE` removal / hydration (7) | Data-foundation | No hydration warnings; every prior `REFERENCE_DATE` usage site reviewed individually |
| Hidden mock-data assumptions (8) | Data-foundation (`service.ts` conversion) | Tests for missing-checkout/missing-shift cases named in `CONCERNS.md` pass |
| N+1 queries (9) | Data-foundation; re-checked at Dashboard/Approvals | Query-count assertion on high-traffic Server Actions |
| In-memory pagination ported naively (10) | Data-foundation (employee list conversion) | Pagination correctness test under concurrent writes |
| `getSession()` misuse (11) | Data-foundation (Auth migration) | Code-review rule / lint: no direct `getSession()` outside the shared auth helper |
| Middleware redirect races (12) | Data-foundation (Auth migration) | Manual redirect-graph walkthrough as a UAT checklist item |
| Client/server identity drift (13) | Data-foundation (company switcher, role-gated UI) | Server-derived role/company on every page load, not client-cached |
| GPS/photo spoofing underestimated (14) | Attendance-evidence phase | Layered checks (mock-flag, physics, liveness, replay-nonce) present in acceptance criteria |
| Consent/privacy obligations (15) | Attendance-evidence phase / Company Settings phase | Consent-capture step exists in onboarding/invite flow |
| Overnight shift midnight split (16) | Company Settings phase (overtime rules) + Data-foundation (date utilities) | Unit test for a shift crossing midnight producing correct hours/overtime |
| UTC+7 handling (17) | Data-foundation (date utilities) | No date derived via unconverted UTC `Date` arithmetic; `format.ts` covered by edge-case tests |
| Retroactive correction to closed period (18) | Approvals phase | Audit trail answers "was this period's total changed after review" |

## Sources

- [Row-Level Security in Supabase: Multi-Tenant SaaS from Day One (dev.to)](https://dev.to/issuecapture/row-level-security-in-supabase-multi-tenant-saas-from-day-one-4lon)
- [Supabase RLS Guide 2026: Policies That Actually Work (designrevision.com)](https://designrevision.com/blog/supabase-row-level-security)
- [row-level security policies in Supabase for a multitenant application (GitHub Discussions)](https://github.com/orgs/community/discussions/149922)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [bypass (row level security) RLS in a postgres function (Supabase GitHub Discussion #3563)](https://github.com/orgs/supabase/discussions/3563)
- [Supabase Row Level Security in Production: Patterns That Actually Work (dev.to)](https://dev.to/whoffagents/supabase-row-level-security-in-production-patterns-that-actually-work-2l78)
- [Supabase Docs | Troubleshooting | RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase Docs | Troubleshooting | How do you troubleshoot Next.js - Supabase Auth issues?](https://supabase.com/docs/guides/troubleshooting/how-do-you-troubleshoot-nextjs---supabase-auth-issues-riMCZV)
- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Fix Next.js & Supabase Auth Logouts (App Router) (javascript.plainenglish.io)](https://javascript.plainenglish.io/fix-nextjs-supabase-auth-logouts-ff858efdced5)
- [Taming Supabase & Next.js Auth: Why Your Users Keep Getting Logged Out (plainenglish.io)](https://plainenglish.io/nextjs/taming-supabase-next-js-auth-why-your-users-keep-getting-logged-out-and-how-to-fix-it)
- [Why Your Supabase Data Is Exposed (And You Don't Know It) (dev.to)](https://dev.to/jordan_sterchele/why-your-supabase-data-is-exposed-and-you-dont-know-it-25fh)
- [10 Common Supabase Security Misconfigurations (ModernPentest Blog)](https://modernpentest.com/blog/supabase-security-misconfigurations)
- [Supabase Security Risks (2026): RLS Gaps, service_role Leaks & the Storage Bucket Trap (vibeappscanner.com)](https://vibeappscanner.com/risks/supabase)
- [Supabase Security Flaw: 170+ Apps Exposed by Missing RLS (byteiota.com)](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/)
- [Hacking Thousands of Misconfigured Supabase Instances (deepstrike.io)](https://deepstrike.io/blog/hacking-thousands-of-misconfigured-supabase-instances-at-scale)
- [Storage Buckets | Supabase Docs](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Anti Fake-GPS: How Modern Attendance & Field Apps Block Mock Location (WappBlaster Blog)](https://wappblaster.com/blog/anti-fake-gps-tech-explained/)
- [Clock In/Out GPS Spoofing Detection and Audit Guide (DATABASICS)](https://blog.data-basics.com/clock-in/out-gps-spoofing-detection-and-audit-guide-1)
- [Detect Fake GPS on Android Apps (blog.anmolthedeveloper.com)](https://blog.anmolthedeveloper.com/how-to-detect-fake-gps-and-mock-location-in-android-apps-a-developers-security-guide)
- [Protect Against Geo-Spoofing in Mobile Apps (Guardsquare)](https://www.guardsquare.com/blog/securing-location-trust-to-prevent-geo-spoofing)
- [SalaryBox Attendance Management: AI Selfie, Geofencing, Buddy Punching (salarybox.in)](https://salarybox.in/salarybox-attendance-management-how-ai-selfie-geofencing-and-smart-attendance-tracking-are-eliminating-buddy-punching-for-indian-businesses/)
- [Liveness detection - Security for anti-spoofing (Fraud.com)](https://www.fraud.com/post/liveness-detection)
- [A Guide to Face Recognition Attendance Systems (Regula Forensics)](https://regulaforensics.com/blog/face-recognition-attendance-system/)
- [Vietnam's Personal Data Protection Decree: Key Insights (secureprivacy.ai)](https://secureprivacy.ai/blog/vietnam-personal-data-protection-law)
- [Vietnam: Decree 13 and the new regulations on personal data protection (DLA Piper)](https://www.dlapiper.com/en-us/insights/publications/crossroads-icr-insights/2023/vietnam-decree-13-and-the-new-regulations-on-personal-data-protection)
- [Vietnam's new personal data protection law (KPMG Vietnam)](https://kpmg.com/vn/en/home/insights/2025/06/vietnam-new-personal-data-protection-law.html)
- [Vietnam's Personal Data Protection Decree: Overview, Key Takeaways, and Context (Future of Privacy Forum)](https://fpf.org/blog/vietnams-personal-data-protection-decree-overview-key-takeaways-and-context/)
- [Payroll Problems with Overnight Shifts? Here's How to Fix Them (Timeero)](https://timeero.com/post/payroll-overnight-shifts)
- [Why Cross-Day Shift Management Is a Must-Have Feature in Modern HRMS (Horilla)](https://www.horilla.com/blogs/why-cross-day-shift-management-is-a-must-have-feature-in-modern-hrms/)
- Project-internal: `E:/externalProjects/workforce-management/.planning/PROJECT.md`
- Project-internal: `E:/externalProjects/workforce-management/.planning/codebase/CONCERNS.md`

---
*Pitfalls research for: Multi-tenant Supabase backend + proof-of-presence attendance (TimeFlow V2)*
*Researched: 2026-07-31*
