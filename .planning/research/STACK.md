# Technology Stack

**Project:** TimeFlow V2 — Supabase backend for existing Next.js 15 attendance SaaS
**Researched:** 2026-07-31
**Confidence:** MEDIUM (no Context7/curated docs MCP available in this session; verified against npm registry directly plus multiple independent web sources — see Sources)

> Scope note: this file covers only what V2 is *adding* — Supabase backend, RLS multi-tenancy,
> proof-of-presence check-in, secure photo storage, and a first test setup. The existing
> Next.js 15 / React 19 / TypeScript / Tailwind v4 / shadcn frontend stack (see
> `.planning/codebase/STACK.md`) is not re-litigated here.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@supabase/supabase-js` | `^2.111.0` | Core Supabase JS SDK (Postgres via PostgREST, Auth, Storage) | Current stable release (verified via npm registry, 2026-07-31); all sub-packages (`auth-js`, `storage-js`, `realtime-js`, `functions-js`, `postgrest-js`) are version-locked together at 2.111.x. Requires Node ≥22, which matches the project's existing Node 22.18.0 baseline. |
| `@supabase/ssr` | `^0.12.4` | Cookie-based session helpers for Next.js Server Components, Server Actions, Route Handlers, and middleware | This is the only supported way to do Supabase auth in a Next.js App Router server-first architecture in 2026. Peer-depends on `@supabase/supabase-js ^2.111.0`. It supersedes the old `@supabase/auth-helpers-nextjs` package (deprecated — see "What NOT to Use"). |
| Supabase CLI | latest (run via `npx supabase@latest`, do not pin in `package.json`) | Local Postgres stack, migration authoring, type generation, RLS test runner | Standard workflow for schema-as-code with Supabase; needed because the project has no `.env`/migration story yet and is about to define the real Postgres schema from `src/lib/types/domain.ts`. |

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Postgres (Supabase-managed) | Supabase project default (currently PG 15/17 depending on project creation date) | Primary datastore, RLS enforcement point | Already the committed backend per `PROJECT.md` constraints — no new provider. RLS is the second, DB-level line of defense behind the server-only access layer decision already made. |
| pgTAP extension | bundled with Supabase Postgres, enable via dashboard/migration | SQL-level unit testing of RLS policies | Only way to assert "tenant A cannot read tenant B's rows" as an automated, CI-runnable test rather than manual QA. Ships as a standard Supabase Postgres extension — no extra infra. |

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Storage (private bucket) | n/a (Storage API via `supabase-js`) | Attendance check-in photos | Storage objects are Postgres rows under the hood (`storage.objects`), so the *same* RLS + `company_id` model used for the rest of the schema also secures photo access. No separate S3/CDN account to provision. |
| New Supabase API key model (`sb_publishable_...` / `sb_secret_...`) | current default for projects created/rotated after 2025-11-01 | Replaces legacy long-lived `anon` / `service_role` JWT keys | Directly relevant to the already-planned key rotation in `PROJECT.md` ("Thu hồi và cấp lại toàn bộ khóa Supabase"): when rotating, adopt the new key model instead of reissuing legacy keys. Benefits: instantly revocable, individually auditable, auto-revoked by Supabase if leaked to a public GitHub repo (relevant since the old keys leaked into `docs/env`). Legacy keys still work through 2026 but Supabase is phasing them out; no reason to re-adopt the deprecated form during a rotation event. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `browser-image-compression` | latest 2.x | Client-side downscale/compress the camera photo before upload | Mobile camera captures are commonly 3–10MB; compressing to ~300–800KB client-side before it ever hits a Server Action or signed-upload avoids Next.js Server Action body-size limits and cuts Storage cost/bandwidth. Runs in a Web Worker (non-blocking) and correctly reads EXIF orientation before drawing to canvas — a real, easy-to-miss bug source (photos look fine in preview, come out sideways after resize) if you write this by hand. |
| `zod` (already in stack) | 3.24.x (existing) | Validate check-in payload server-side: file MIME/size, lat/lng bounds, timestamp skew | Reuse the existing validation convention rather than introducing a second schema library. Validate GPS coordinates and photo metadata in the Server Action *before* touching Supabase. |
| `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event` | latest (confirm React-19-compatible major at install time — `npm view @testing-library/react version`) | Component-level unit tests for sync client components | Only needed once actual component tests are written; pair with Vitest below. |
| `vitest` + `@vitejs/plugin-react` + `jsdom` | latest 3.x | Unit test runner | See Testing section below. |
| `@playwright/test` | latest 1.5x | E2E tests for the check-in flow (camera + geolocation permission mocking) | See Testing section below — this is the only realistic way to exercise the live-camera + GPS check-in path end-to-end. |

## Session, Middleware & Server Access Patterns

This directly replaces `src/lib/auth/session-provider.tsx` (localStorage-based) and enforces the
project's own constraint that all data access goes through the server, never direct
client-side Supabase calls.

**Three client instances, each scoped to where it runs:**

1. **Browser client** (`utils/supabase/client.ts`) — `createBrowserClient()` from `@supabase/ssr`. Used only for `supabase.auth.signInWithPassword()` / sign-out calls from client components — never for data queries. It's a singleton internally; don't wrap it in `useMemo` per-render.
2. **Server client** (`utils/supabase/server.ts`) — `createServerClient()` from `@supabase/ssr`, backed by `cookies()` from `next/headers`. This is the client every Server Action and Route Handler uses to talk to Postgres/Storage. This is the *only* client that should ever import the service-role/secret key (and only for the narrow admin operations that genuinely need to bypass RLS, e.g. super-admin cross-tenant views — see Pitfalls research for why this must stay rare and audited).
3. **Middleware client** (`middleware.ts`) — `createServerClient()` again, but with request/response cookie adapters, because Server Components cannot write cookies themselves. Its *only* job is to revalidate and refresh the auth token cookie on every request; do not layer extra business logic into this function beyond that.

**Route protection:** `middleware.ts` with a `matcher` excluding static assets/`_next` runs on every request, calls the auth check, and redirects unauthenticated requests away from `/admin/*` and `/employee/*`. Company/role-scoped authorization (which company, which role) still needs a second check inside each Server Action/Route Handler — middleware only proves "there is a valid session," not "this session may touch this resource."

**Auth verification call — use `getClaims()`, not `getUser()` or `getSession()`:**
This is a 2026-current deviation from most existing Supabase+Next.js tutorials (which still show `getUser()`). Supabase moved new projects to **asymmetric JWT signing keys by default starting 2025-10-01**. With asymmetric keys, `getClaims()` verifies the JWT signature locally against the project's published JWKS (fast, no network round-trip) and is the now-recommended way to authenticate a request in middleware/Server Actions. `getUser()` still works (it round-trips to the Auth server every call — slower but authoritative) and remains the correct fallback for a project still on legacy *symmetric* (shared-secret) JWTs. `getSession()` must never be trusted server-side — it reads whatever the cookie claims without revalidating it, which is exactly the spoofing risk the existing localStorage-based session already has today.
**Action for this project:** when the docs/env keys are rotated (already a planned task), check the Supabase dashboard's JWT settings — if the project predates late 2025 it is likely still on symmetric HS256 keys. Migrating to asymmetric keys at the same time as the key rotation unlocks `getClaims()` and is a natural pairing of that already-planned work.

## RLS Policy Patterns for `company_id` Isolation

- Every tenant-scoped table gets a non-null `company_id` column with an index on it (and on any other column a policy filters by — RLS-filtered but unindexed columns are the single most common Supabase RLS performance complaint).
- Enable RLS on every table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) — Postgres defaults to deny-all once RLS is on, so an empty policy set fails safe, not open.
- Read the caller's `company_id` from the JWT (`app_metadata` claim set at sign-up/invite time), not from a request parameter — the same principle the project already committed to for its server-only access layer: never trust a client-declared `company_id`.
- Wrap auth functions in a `select` in policy expressions — `(select auth.uid())` instead of bare `auth.uid()` — so Postgres caches the value per-statement via initPlan instead of re-evaluating per-row. This is a well-documented, large (90%+) performance win at even modest row counts.
- For anything beyond a single-column equality check (e.g. "manager can see their department's employees"), write a `SECURITY DEFINER` helper function rather than a policy with embedded joins — joins inside RLS policies are the other common performance trap, and a helper function is also easier to unit test with pgTAP in isolation.
- **RLS is the second layer, not the only layer**, matching the decision already recorded in `PROJECT.md`: Server Actions filter by the session's `company_id` explicitly (`.eq('company_id', companyId)`) *in addition to* relying on RLS — belt-and-suspenders, and it also helps the Postgres query planner.
- The service-role/secret key **bypasses RLS entirely**. It must never be reachable from client code and its use inside server code should be limited to specific, auditable admin paths (super admin cross-tenant views) — not the default client for ordinary Server Actions.

## Supabase Storage Pattern for Attendance Photos

- Create the attendance-photos bucket as **private** (`public: false`). Do not use a public bucket "for convenience" — public buckets serve any object to anyone with the URL, no auth check, forever.
- Path convention should embed the tenant boundary directly, e.g. `attendance-photos/{company_id}/{employee_id}/{checkin_id}.jpg`, and RLS policies on `storage.objects` should check that the requesting user's `company_id` claim matches the path prefix — this makes storage access rules structurally identical to table RLS rather than a separate mental model.
- Never expose the bucket path to the client directly. The check-in Server Action uploads the (already client-compressed) image using the server client, and any later "view this photo" request (e.g. an admin reviewing a check-in) goes through a Server Action/Route Handler that calls `createSignedUrl()` with a short expiry (minutes, not hours) after re-checking the caller's tenant and role. The signed URL itself is the only thing ever sent to the browser, and it expires.
- Because Next.js Server Actions have a default request body-size ceiling (historically ~1MB, configurable but still worth respecting), and camera photos can be several MB before compression: compress client-side first (see `browser-image-compression` above), and if photos still risk exceeding the limit, use a signed *upload* URL (`createSignedUploadUrl()`) so the browser uploads directly to Storage and the Server Action only records metadata — but for this project's compressed photo sizes, a direct Server Action upload of the compressed image is almost certainly simpler and sufficient; don't build the signed-upload-URL path preemptively without confirming the compressed size actually needs it.

## Live Camera Capture & Geolocation — What's Enforceable vs. Spoofable

This is the part of the stack where expectations need to be set honestly, because it directly
underpins the "chấm công có bằng chứng" (proof-of-presence check-in) requirement.

**Forcing a live camera capture (not a gallery pick):**
- `<input type="file" accept="image/*" capture="environment">` hints the mobile browser to open the camera app directly instead of the photo picker (`capture="user"` for front camera). This works reliably on current iOS Safari and Android Chrome, but it is a *hint*, not a lock enforced by the browser sandbox — a small number of browser/OS combinations may still surface a chooser, and nothing stops a user who really wants to cheat from using an OS-level virtual camera app to feed a saved image back through the camera pipeline. It's the simplest implementation (a styled file input, no camera-stream code).
- `getUserMedia()` with a live `<video>` element and `<canvas>` frame-grab gives the app full control of the capture UI end-to-end (the app decides exactly when to snapshot the live stream) and is a strictly stronger guarantee against gallery substitution than the `capture` attribute, at the cost of writing and maintaining actual camera-stream UI (permission prompt handling, front/back camera selection, canvas-to-blob encoding). **Recommendation: use `getUserMedia()` for the employee check-in flow**, since "no gallery pick" is an explicit, named requirement in `PROJECT.md`, not just a nice-to-have — the file-input `capture` attribute's device-dependent fallback-to-chooser behavior is a real risk against that specific requirement.
- Neither approach can cryptographically prove the frame wasn't itself a photo of a screen or a spoofed virtual camera feed — this is a known, general limitation of any browser-only liveness check, not something fixable with a library choice. Treat the photo as a fraud *deterrent and audit artifact* (an admin can look at it) rather than mathematically unforgeable proof, and document that framing in whatever anti-fraud copy or training material accompanies the feature.

**Geolocation — reading it is trivial, trusting it is not:**
- `navigator.geolocation.getCurrentPosition()` is the whole API surface needed on the client. The hard part isn't reading coordinates, it's that browser-reported coordinates are trivially spoofable: Chrome/Firefox DevTools location override, browser extensions built specifically for this (e.g. GeoSpoof), and OS-level "mock location" apps on Android can all feed arbitrary coordinates to `navigator.geolocation` with **no flag the browser exposes to the calling page**. Android's native `LocationManager.isFromMockProvider()` mock-detection API — the thing that actually *can* detect spoofing — is only available to native apps, not to a web page, so it is not available to this project's mobile-web architecture.
- **There is no web-only technique that turns GPS into unforgeable proof.** The practical, honest mitigation (and the one implied by the project's own decision to require photo *and* GPS as two independent signals rather than either alone) is defense in depth: geofence radius check against the configured work location, combined with the photo, plus server-side plausibility checks worth adding even though they weren't explicitly scoped — e.g. flagging two consecutive check-ins from the same employee that are geographically impossible within the elapsed time ("impossible travel"). These are detection/audit signals for an admin to review, not hard blocks, given the project's stated priority (pilot for 1-2 companies, not adversarial scale).
- **Do not scope-creep into native mock-location detection or a "rooted device" check** — that requires a native app or a WebView with native bridge access, which is explicitly out of scope per `PROJECT.md` ("Mobile app native" is excluded). Set expectations accordingly rather than implying the web check-in can achieve native-app-level anti-spoofing.

## Testing — Pragmatic Starting Setup (from zero tests today)

The codebase has no automated tests. Given the project's actual risk profile (multi-tenant data
leak is the single most damaging failure mode; the check-in flow is the highest-novelty new
code), the pragmatic starting point is two layers, not a full pyramid on day one:

1. **pgTAP for RLS policies — do this first, before writing application code against the schema.** Enable the `pgtap` extension, write SQL test files under `supabase/tests/database/`, and run them with the Supabase CLI's local test runner (`supabase test db`). Structure tests per table × per role × per operation: as one anonymous/other-tenant user, assert `SELECT`/`INSERT`/`UPDATE`/`DELETE` on another company's rows fails; as the correct tenant's user, assert it succeeds. This is the closest thing to a hard guarantee that the multi-tenant isolation requirement actually holds, and it tests the RLS layer independently of whatever the Server Action layer does — which matters precisely because the project's own architecture decision is to keep RLS as an independent second line of defense, not just an assumption.
2. **Vitest for application-level unit tests.** Install `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react` (React-19-compatible major), `@testing-library/jest-dom`. Use it for the things that are pure logic and cheap to test: Zod schema validation for the check-in payload, overtime/shift-boundary date math (`date-fns`-based), and RLS-adjacent Server Action logic that can be tested by mocking the Supabase client. Vitest is the current default recommendation for Next.js 15 (Vite's transform pipeline, no Babel/ts-jest config, 10-20x faster cold start than Jest) and Next.js ships an official `with-vitest` starter template as a config reference. Note its real limitation: Vitest cannot execute `async` Server Components directly — that gap is covered by layer 3.
3. **Playwright, added once the check-in flow exists — not day one, but budget for it early given the feature's novelty.** It is the only realistic way to exercise the actual live-camera + geolocation check-in path end-to-end: `test.use({ geolocation: {...}, permissions: ['geolocation', 'camera'] })` grants permissions and sets a fake-but-consistent coordinate *before* page navigation, and Playwright can feed a fake camera device/video to `getUserMedia()` via Chromium launch flags, so the whole "employee checks in, server verifies radius, photo lands in Storage, admin reviews it" path can be scripted without a real phone. Treat this as the acceptance test for the proof-of-presence feature specifically, not as general-purpose UI coverage.

Do not reach for Cypress — Playwright's built-in geolocation/permission emulation via `context.setGeolocation()` and `permissions` is the more direct fit for this project's specific testing need (camera + GPS mocking), and Playwright is already the more common default for Next.js App Router projects in 2026.

## Database Migration Tooling

- `supabase init` scaffolds the `supabase/` directory (`config.toml`, `migrations/`, `seed.sql`) — do this once, at the start of the phase that introduces the real schema.
- `supabase migration new <name>` creates a timestamped, empty SQL file under `supabase/migrations/` — hand-write the DDL (tables, RLS policies, storage bucket setup) so schema changes are reviewable diffs, not dashboard clicks. Given this project already has a fully-specified target schema (`src/lib/types/domain.ts`), migrations should be authored from that source of truth rather than reverse-engineered from a dashboard session.
- `supabase db reset` recreates the local Postgres container (requires Docker Desktop running) and replays every migration plus `seed.sql` — the fast local iteration loop. Seed the two existing mock companies (Ngọc Phát, Bình Minh) here so multi-tenant RLS behavior can be checked against realistic, already-designed cross-tenant data.
- `supabase link` connects the local project to the real remote Supabase project (the one whose keys are being rotated); `supabase db push` then applies pending local migrations to that remote database. This should be the *only* path schema changes take to production — never hand-edit the schema in the Supabase Studio dashboard for anything that matters, since dashboard changes don't produce a migration file and silently drift local/remote apart.
- If the remote project already has some manually-created schema (verify before assuming a clean slate — `docs/env` implies a Supabase project already exists), run `supabase db pull` first to baseline the existing remote state into a migration file before layering new migrations on top, rather than assuming migrations start from empty.

## Installation

```bash
# Core
npm install @supabase/supabase-js @supabase/ssr

# Client-side photo handling
npm install browser-image-compression

# Dev dependencies — testing
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @playwright/test
npx playwright install --with-deps chromium

# Supabase CLI — do not add as a project dependency; invoke via npx or install
# as a one-off dev tool per the official install docs (npm global install is
# explicitly unsupported by Supabase for the CLI)
npx supabase@latest init
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Auth/session helper | `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | Deprecated by Supabase; `@supabase/ssr` is the maintained successor and the only one documented for current Next.js App Router patterns. |
| Server auth check | `getClaims()` | `getUser()` | `getUser()` still works and is the correct choice on legacy symmetric-JWT projects, but round-trips to the Auth server on every call; `getClaims()` verifies locally against JWKS once asymmetric keys are enabled, which this project should do anyway as part of its planned key rotation. |
| Live capture | `getUserMedia()` in-page stream | `<input capture>` file-input hint | The `capture` attribute is less code but is a browser *hint* that can fall back to a gallery/chooser on some device combinations — a real risk against the project's explicit "no gallery pick" requirement. `getUserMedia()` costs more implementation effort for a materially stronger guarantee on the exact requirement that matters most here. |
| Photo access | Private bucket + signed URLs | Public bucket with obscure/UUID paths | "Security by unguessable URL" is not access control — a leaked link, referrer header, or log line exposes the photo permanently with no revocation. Signed URLs expire and are generated only after a real auth/tenant check. |
| Unit test runner | Vitest | Jest | Jest still works but needs Babel/ts-jest config for this ESM/TS-strict/React-19 stack; Vitest is Next.js's own current documented recommendation and starts significantly faster, with no material downside for this project's needs. |
| E2E runner | Playwright | Cypress | Playwright's native `context.setGeolocation()` / `permissions` API is a more direct fit for mocking camera + GPS in the check-in flow than Cypress's plugin-based approach, and is the more common current default for Next.js App Router projects. |
| RLS testing | pgTAP (SQL-level) | App-level integration tests only (spin up test users, hit Server Actions) | App-level tests conflate "did the Server Action filter correctly" with "did RLS also deny it" — pgTAP isolates the RLS guarantee itself, which is the layer the project is explicitly relying on as independent defense-in-depth. Do both eventually; pgTAP first because it tests the harder-to-get-right, higher-consequence layer. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated by Supabase; not maintained for current Next.js App Router patterns. | `@supabase/ssr` |
| Direct client-side `supabase-js` calls for data (reading/writing tables from client components) | Contradicts the project's own already-recorded architecture decision; puts anon/publishable key + RLS as the *only* wall between tenants, and any missed policy condition becomes a direct cross-tenant leak with no server-side check to catch it. | Server Actions / Route Handlers using the server client only |
| Public Supabase Storage bucket for attendance photos | Serves any object to anyone with the URL, no auth check, and the requirement explicitly calls for tenant-scoped visibility ("chỉ người có quyền trong cùng doanh nghiệp xem được"). | Private bucket + `createSignedUrl()` generated server-side after a tenant/role check |
| Legacy `anon` / `service_role` long-lived keys when rotating credentials | The rotation is already planned in `PROJECT.md` because these keys leaked to `docs/env`; reissuing the same legacy key type just recreates the same leak-and-forget risk with no individual revocability. | New `sb_publishable_...` / `sb_secret_...` key model |
| Trusting `getSession()` or a client-declared `company_id`/role in a Server Action | `getSession()` reads the cookie's claim without server revalidation — exactly the spoofing risk already present in the current localStorage session; a client-declared `company_id` is equivalent to letting the client pick which tenant's data it wants. | `getClaims()`/`getUser()` server-side, and derive `company_id`/role from the verified session, never from request input |
| QR-code check-in | Already explicitly excluded in `PROJECT.md` — a QR code can be photographed once and scanned later from anywhere, proving nothing about physical presence at check-in time. | Live camera capture + GPS radius (already the chosen approach) |
| Treating GPS coordinates as unforgeable proof of location | Browser Geolocation API has no anti-spoofing signal exposed to web pages; native mock-location detection is unavailable outside a native app, which is explicitly out of scope for this project. | Defense in depth: geofence + photo + server-side plausibility checks (impossible-travel-speed flag), reviewed by an admin, not treated as a cryptographic guarantee |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@supabase/supabase-js@2.111.x` | Node ≥22 | Matches existing project Node 22.18.0 — no runtime change needed. |
| `@supabase/ssr@0.12.4` | `@supabase/supabase-js ^2.111.0` | Peer dependency — install both together, don't let them drift apart. |
| `@supabase/ssr` (auth cookie handling) | `next@15.0.0` middleware | Works on both Edge and Node middleware runtimes; Next.js 15.5+ added a stable Node runtime option for middleware which removes some earlier Edge-runtime friction some libraries hit, but is not a requirement — verify current `next` version stays within the project's pinned 15.x major before assuming Node-runtime middleware is available. |
| `@testing-library/react` | `react@19.0.0` | Pin to whatever major currently declares React 19 support (`npm view @testing-library/react peerDependencies` at install time) — do not blindly reuse an older React-18-era pinned version from tutorials. |
| pgTAP | Supabase-managed Postgres | Ships as a selectable extension in the Supabase dashboard/CLI; no separate installation needed beyond enabling it in a migration. |

## Sources

- npm registry (`registry.npmjs.org`) direct fetch — `@supabase/supabase-js` and `@supabase/ssr` current versions and peer dependencies (MEDIUM confidence, cross-checked against web search results)
- `supabase.com/docs/guides/auth/server-side/nextjs` — server/browser/middleware client creation pattern, `getClaims()` vs `getUser()` vs `getSession()` guidance (LOW-MEDIUM, single-source web fetch of official docs — not Context7-verified in this session)
- `supabase.com/docs/guides/database/postgres/row-level-security` — RLS performance patterns (indexing, `(select auth.uid())`, `SECURITY DEFINER` helpers, service-role bypass warning) (LOW-MEDIUM, official docs web fetch)
- `supabase.com/blog/jwt-signing-keys`, `github.com/orgs/supabase/discussions/29289` — asymmetric JWT signing key rollout (default for new projects since 2025-10-01) (LOW, web search, cross-checked across 2 independent sources)
- `supabase.com/docs/guides/getting-started/migrating-to-new-api-keys`, `supabase.com/changelog/29260-upcoming-changes-to-supabase-api-keys` — publishable/secret key model replacing legacy anon/service_role (LOW, web search, cross-checked)
- `supabase.com/docs/guides/local-development/*`, `supabase.com/docs/reference/cli/*` — CLI migration workflow (LOW, web search)
- `supabase.com/docs/guides/local-development/testing/*`, community pgTAP writeups — RLS testing pattern (LOW, web search)
- `nextjs.org/docs/app/guides/testing/vitest`, `nextjs.org/docs/pages/guides/testing/playwright` — official Next.js testing guidance (LOW-MEDIUM, official docs referenced via web search)
- MDN (`developer.mozilla.org`), web.dev — `getUserMedia()`, `capture` attribute behavior (LOW, web search)
- Community sources on Geolocation spoofing / mock-location detection limitations (LOW, web search, cross-checked across multiple independent articles reaching the same conclusion — no web-exposed anti-spoofing signal exists)
- `npmjs.com/package/browser-image-compression` and related client-side image compression writeups (LOW, web search)

**Confidence caveat:** This session had no Context7 or other curated-docs MCP tool available, so all findings come from the built-in `WebSearch`/`WebFetch` tools rather than the higher-confidence provider tiers described in the research process. Package versions were independently confirmed against the npm registry directly (highest-trust source available in this session); pattern/architecture guidance (RLS style, storage pattern, auth method choice) should be treated as directionally solid but worth a final skim of the live Supabase docs at implementation time, since Supabase ships changes frequently.

---
*Stack research for: Multi-tenant workforce attendance SaaS — Supabase backend addition*
*Researched: 2026-07-31*
