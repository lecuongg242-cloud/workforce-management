# Architecture Research

**Domain:** Multi-tenant Supabase backend migration for an existing Next.js 15 workforce/attendance SaaS (TimeFlow)
**Researched:** 2026-07-31
**Confidence:** MEDIUM (patterns cross-verified against Supabase official docs content surfaced in search + current community practice; no single source treated as authoritative in isolation — see Sources)

This document builds directly on `.planning/codebase/ARCHITECTURE.md` (the mapped V1 architecture) and the locked decisions in `.planning/PROJECT.md`. It does not re-derive V1 — it answers how to grow it into a real multi-tenant backend without discarding the "one door" design V1 was deliberately built for.

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Client (Browser)                                                        │
│  *-view.tsx (Client Components) — unchanged from V1                      │
│  useMockQuery/useDataQuery hook — reads      MockDataProvider version    │
│  Direct call to Server Action    — mutations  counter — invalidation     │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │ Next.js Server Action RPC (serialized,
                                 │ not a hand-rolled fetch/JSON API)
┌───────────────────────────────┴────────────────────────────────────────┐
│  Server-only Data Access Layer — src/lib/data/*  ('use server')          │
│  ┌────────────┐ ┌────────────┐ ┌───────────────┐ ┌───────────────────┐  │
│  │ session.ts │ │ employees. │ │ attendance.ts │ │ attendance-        │  │
│  │ (who is    │ │ ts, shifts.│ │ (check-in/out,│ │ photos.ts (signed  │  │
│  │  asking)   │ │ ts, ...    │ │  geofence)    │ │ upload/review)     │  │
│  └────────────┘ └────────────┘ └───────────────┘ └───────────────────┘  │
│  ┌────────────┐ ┌────────────────────┐ ┌──────────────────────────────┐ │
│  │ audit.ts   │ │ super-admin.ts      │ │ admin-client.ts (service_role,│ │
│  │ (append-   │ │ (cross-tenant reads,│ │  imported ONLY here, never   │ │
│  │  only log) │ │  audited, read-only)│ │  reaches a View)              │ │
│  └────────────┘ └────────────────────┘ └──────────────────────────────┘ │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │ authenticated-role Postgres connection
                                 │ (cookie-bound session, NOT service_role)
┌───────────────────────────────┴────────────────────────────────────────┐
│  Supabase                                                                │
│  ┌───────────────────────────┐  ┌───────────────────────────────────┐  │
│  │ Postgres + RLS             │  │ Storage (private buckets)          │  │
│  │ every tenant table carries │  │ attendance-photos/{company_id}/... │  │
│  │ company_id + RLS policy    │  │ signed URLs only, no public read   │  │
│  └───────────────────────────┘  └───────────────────────────────────┘  │
│  ┌───────────────────────────┐                                          │
│  │ Auth (JWT, cookie session) │                                          │
│  └───────────────────────────┘                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

The load-bearing rule this diagram encodes: **there is exactly one path from a View to Postgres/Storage**, through `src/lib/data/*`. This is the same "one door" property V1 already has with `mock/service.ts` — the migration's job is to keep that door in place and change what's behind it, not to add a second door (no direct `createBrowserClient()` Supabase calls from any `*-view.tsx`, except the one deliberate exception below for photo bytes).

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `*-view.tsx` (unchanged) | Client state, forms, event handlers, calls data layer, calls `invalidate()` after mutations | Client Component, same as V1 |
| `useMockQuery` / renamed `useDataQuery` | Standardized fetch-and-cache-in-state pattern, refetch on version bump | React hook, unchanged mechanics |
| `MockDataProvider` version counter | Cross-cutting invalidation signal after any mutation | React Context, unchanged mechanics |
| `src/lib/data/session.ts` | Resolve "who is asking": `auth.getUser()`, active membership, active company, role | Server-only module, wraps `@supabase/ssr` |
| `src/lib/data/*.ts` (per domain) | Same exported function names/signatures as `mock/service.ts` today; now real queries/mutations | Next.js Server Actions (`'use server'`) |
| `src/lib/data/admin-client.ts` | Sole holder of `service_role` key | Server-only module, imported by nothing outside `super-admin.ts` and system hooks |
| `src/lib/data/audit.ts` | Append-only write of who/what/when/before/after | Called from inside every mutation, not bolted on after |
| Postgres RLS policies | Second, independent enforcement of tenant isolation | `USING`/`WITH CHECK` clauses per table, membership-join based |
| Supabase Storage private bucket + policies | Physical isolation of attendance photo bytes | Path-prefixed bucket, signed URL issuance server-side only |
| `middleware.ts` | Refresh Supabase session cookie before Server Components render; route gating | Next.js middleware using the "middleware" Supabase client |

## Recommended Project Structure

```
src/
├── lib/
│   ├── data/                    # replaces src/lib/mock/ — the one door to Supabase
│   │   ├── supabase-server.ts   # createServerClient() bound to next/headers cookies()
│   │   ├── supabase-admin.ts    # createClient() with service_role — imported nowhere else
│   │   ├── session.ts           # getCurrentUser(), getActiveMembership(), requireRole()
│   │   ├── mappers.ts           # Postgres row → domain.ts type conversion, one place
│   │   ├── employees.ts         # listEmployees(), updateEmployee(), ... (was in service.ts)
│   │   ├── departments.ts
│   │   ├── shifts.ts
│   │   ├── work-sites.ts
│   │   ├── attendance.ts        # check-in/out, geofence validation
│   │   ├── attendance-photos.ts # signed upload ticket, confirm, review, signed read URL
│   │   ├── work-requests.ts     # leave/overtime/correction + approval flow
│   │   ├── company-settings.ts  # work hours, overtime rules, holidays
│   │   ├── memberships.ts       # invite, role assignment, company switch
│   │   ├── audit.ts             # logDecision(), logMutation()
│   │   └── super-admin.ts       # cross-tenant read-only queries + impersonated actions
│   ├── auth/
│   │   └── session-provider.tsx # thin client Context wrapping Supabase Auth session,
│   │                            # replaces localStorage-based version; keeps useSession() API
│   ├── types/domain.ts          # unchanged — still the single source of truth for shapes
│   ├── constants.ts              # unchanged
│   └── validation/schemas.ts     # unchanged — Zod schemas now also used server-side as
│                                  # the last gate before a query, not just form validation
├── hooks/
│   └── use-mock-query.ts         # unchanged mechanics; optionally renamed use-data-query.ts
supabase/
├── migrations/                   # SQL migrations: schema, RLS policies, indexes, seed
└── tests/                        # pgTAP or scripted cross-tenant leak tests (see Build Order)
```

### Structure Rationale

- **`src/lib/data/` replaces `src/lib/mock/` file-for-file where possible.** Same function names as `mock/service.ts` (per the locked decision to keep signatures stable) so every `*-view.tsx` import changes only its `from` path, not its call sites.
- **`session.ts` is a new, mandatory choke point** that did not exist in the mock layer (mock trusted whatever the client claimed). Every other file in `src/lib/data/` calls into it first; this is where "trust the server, not the client" is physically enforced.
- **`supabase-admin.ts` is isolated in its own file** specifically so it is grep-able and reviewable: a single `import` statement is the entire surface area of `service_role` usage in the codebase. Treat any new import of this file outside `super-admin.ts` as a required code-review flag.
- **`supabase/migrations/` and `supabase/tests/`** are new — V1 has no SQL/schema artifacts at all today. Cross-tenant RLS tests live next to the schema they test, not inside the Next.js app, so they can run in CI independent of the frontend.

## Architectural Patterns

### Pattern 1: Server Actions as the data layer, not a separate API

**What:** Every `src/lib/data/*.ts` export is a Next.js Server Action (`'use server'`), called directly from Client Components exactly as `mock/service.ts` functions are called today — no hand-rolled `fetch('/api/...')`, no new Route Handlers for normal CRUD.

**When to use:** For this project, always — both reads and mutations — at the current scale (1-2 tenants pilot). This is the path of least UI churn, which is an explicit project constraint (`.planning/PROJECT.md`: "giữ nguyên chữ ký hàm trong `service.ts`").

**Trade-offs:** The wider Next.js/TanStack community treats Server-Actions-for-reads as an anti-pattern at scale — they are POST-based, not cacheable via the Next.js `fetch` cache, execute serially when several are awaited from a client (confirmed in TanStack Query's own docs, which warn against using Server Actions inside a `queryFn`), and don't dedupe concurrent identical requests. None of these matter yet: the admin dashboard has a handful of concurrent queries per page, not dozens, and the pilot has no multi-tab/offline requirement. Treat this as a deliberate, documented trade-off with a named upgrade trigger (see Pattern 2), not an oversight.

**Example:**
```typescript
// src/lib/data/employees.ts
'use server'
import { getActiveMembership } from './session'
import { createServerClient } from './supabase-server'

export async function listEmployees(query: EmployeeQuery): Promise<Employee[]> {
  const { companyId } = await getActiveMembership() // never trust a client-passed companyId
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('company_id', companyId) // defense layer 1: explicit filter
    .order('full_name')
  if (error) throw new Error('Không tải được danh sách nhân viên')
  return data.map(toEmployeeDomain) // defense layer 2 happens inside RLS, transparently
}
```

### Pattern 2: `useMockQuery` survives the migration unchanged; TanStack Query is a later, named upgrade

**What:** The version-counter invalidation pattern in `MockDataProvider` is orthogonal to whether the underlying fetcher is a mock function or a real Server Action — it works identically either way. Do not replace it as part of this migration.

**When to use:** Keep `useMockQuery` (cosmetic rename to `useDataQuery` is fine, mechanics untouched) through the entire V2 backend migration and the pilot period.

**Trade-offs / graduation trigger:** Replace with TanStack Query (backed by Route Handlers instead of Server Actions for the query side) only when one of these becomes true:
- Need for cross-tab or cross-device live updates (e.g., an admin dashboard that must reflect another admin's approval within seconds without a manual refresh)
- Need for optimistic UI updates on mutations (attendance approval, employee edits) to feel instant
- The number of `invalidate()` call sites after mutations becomes large enough that manual invalidation is regularly forgotten (a correctness smell, not a performance one)
- Concurrent query volume per page grows enough that Server Action serial execution becomes visibly slow

None of these are true for a 1-2 company pilot. Document this trigger list in the roadmap so a future "why didn't we just use React Query from the start" question has a recorded answer.

**Example (unchanged from V1 mechanics):**
```typescript
const { data, isLoading, error } = useMockQuery(
  () => listEmployees({ search, departmentId }),
  [search, departmentId, dataVersion] // dataVersion from useMockData()
)
```

### Pattern 3: Two independent isolation layers — app-level company filter, then RLS as backstop

**What:** The Server Action always explicitly filters by `company_id` resolved server-side from the session (never from the request payload). RLS policies independently verify that the authenticated user is actually a member of that `company_id` before returning any row. Neither layer is trusted alone.

**When to use:** Every tenant-scoped table, every query, every mutation, without exception. This is already a locked decision in `.planning/PROJECT.md` ("Vẫn bật RLS đầy đủ dù đã có tầng server").

**Trade-offs:** Slightly more query planning overhead per RLS-protected query (measured elsewhere at ~0.4ms difference at 100k rows/1000 tenants when `company_id` is indexed) — negligible at pilot scale, and the alternative (RLS as the *only* wall) means one missed `.eq('company_id', ...)` in application code is a full cross-tenant data leak with no second check.

**Example (RLS policy, `attendance_records` table):**
```sql
alter table attendance_records enable row level security;

create policy "members can read their company's attendance"
  on attendance_records for select
  using (
    exists (
      select 1 from memberships m
      where m.company_id = attendance_records.company_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
    or exists (select 1 from platform_admins pa where pa.user_id = auth.uid())
  );

create policy "members can write to their company's attendance"
  on attendance_records for insert
  with check (
    exists (
      select 1 from memberships m
      where m.company_id = attendance_records.company_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  ); -- note: platform_admins intentionally NOT in the write check — see Pattern 4
```

### Pattern 4: "Selected company" is an app-layer concept; RLS only answers "is this user a member at all"

**What:** V1 already supports a user belonging to multiple companies and picking one at login (`select-company`). RLS cannot cheaply and safely model "which company did this session pick" (see Anti-Pattern 2 below on session-variable fragility) — so don't try. RLS's job is narrower and more robust: "does this `auth.uid()` have any active membership in this row's `company_id`." The app layer (via `session.ts`, backed by the existing session/cookie mechanism) decides which single company a given request is scoped to and passes that explicitly into every query. If the app layer ever picks the wrong company due to a bug, RLS still prevents it from returning another tenant's data for a company the user isn't a member of — worst case is an empty result, never a leak.

**When to use:** Anywhere "which company" matters — i.e., everywhere except `super-admin.ts` and `platform_admins`-gated reads.

**Trade-offs:** A user who is simultaneously an active member of two companies can, in principle, have RLS permit a query against either company's data — the app layer is the only thing preventing a UI bug from ever asking for the wrong one. This is acceptable because it is the same trust boundary as V1's existing multi-company selection UX already assumes (a user who legitimately belongs to two companies is allowed to see both, just not concurrently by app design).

### Pattern 5: Super admin — read broadly by default, write only through audited, explicit actions

**What:** `platform_admins` is a small, `service_role`-managed table, separate from any company's `memberships`. RLS `SELECT` policies on tenant tables include an `OR EXISTS (... platform_admins ...)` clause, granting read-only cross-tenant visibility for support. RLS `INSERT`/`UPDATE`/`DELETE` policies deliberately do **not** include that clause — a platform admin cannot silently mutate tenant data via the same path a tenant admin uses. Any actual cross-tenant write (e.g., support fixing a stuck record) goes through a distinct, narrow Server Action in `super-admin.ts` that uses `supabase-admin.ts` (`service_role`, which bypasses RLS entirely) and is required to write an `audit_log` row recording `actor_user_id`, `acted_as_company_id`, and a reason before the write is allowed to proceed.

**When to use:** Whenever the "Super admin" requirement set is built (`.planning/PROJECT.md` Active requirements: xem và quản lý toàn bộ doanh nghiệp, hỗ trợ khách hàng).

**Trade-offs:** More code than a single blanket "super admins bypass RLS everywhere" rule, but that blanket rule is the single most common cause of accidental or unaudited cross-tenant writes in Supabase multi-tenant apps — the explicit split is the whole point.

## Data Flow

### Read flow (query)

```
View (Client Component)
    ↓ useDataQuery(() => listEmployees(params), [deps, dataVersion])
Server Action listEmployees()  [runs on server, 'use server']
    ↓ session.ts: auth.getUser() → resolve active membership + company_id + role
    ↓ explicit .eq('company_id', companyId) filter
Postgres (authenticated role, RLS re-checks membership independently)
    ↓ mapped via mappers.ts to domain.ts types
Server Action return value (Next.js serializes across the RPC boundary)
    ↓
useDataQuery updates {data, isLoading, error} → View re-renders
```

### Mutation flow

```
View → form submit / handler calls Server Action (e.g., updateEmployee(id, patch))
    ↓ session.ts resolves actor + company_id + role
    ↓ requireRole('manager') or similar authorization check
    ↓ Zod schema.parse() on the patch (already exists in validation/schemas.ts,
      now the last gate before a write, not just a form-UX convenience)
    ↓ UPDATE ... WHERE id = $1 AND company_id = $2  (explicit filter)
Postgres (RLS WITH CHECK re-verifies membership independently)
    ↓ audit.ts: insert audit_log row (actor, action, entity, before/after)
Server Action returns success
    ↓
View calls invalidate() from useMockData()  — UNCHANGED from V1
    ↓
All useDataQuery hooks whose deps include dataVersion refetch automatically
```

### Attendance photo flow (the one deliberate exception to "never call Supabase from the client")

```
Employee client: capture photo via getUserMedia/canvas (NOT a file picker — see Pitfall
below), capture GPS via Geolocation API
    ↓
Server Action createAttendanceUploadTicket({ shiftId, workSiteId, lat, lng, kind })
    ↓ session.ts resolves employee + company_id
    ↓ server-side haversine check: is (lat,lng) within work_sites.radius_meters?
      (client-side radius display is UX only — this check is the real gate)
    ↓ if outside radius → reject with Vietnamese error, no upload happens, no storage cost
    ↓ if inside radius → create attendance_records row (status='pending_photo')
    ↓ mint a short-lived Supabase Storage SIGNED UPLOAD URL scoped to
      attendance-photos/{company_id}/{employee_id}/{attendance_record_id}/{kind}.jpg
Server Action returns { uploadUrl, attendanceRecordId } to client
    ↓
Client uploads photo bytes DIRECTLY to Supabase Storage via the signed URL
  — this is the one place the client talks to Supabase directly, and it is safe because
    the URL itself was minted server-side, is path-scoped, and is short-lived; it exists
    specifically to route around the ~1MB Server Action body limit
    ↓
Server Action confirmAttendancePhoto({ attendanceRecordId })
    ↓ verifies the object actually exists at the expected path (Storage API check —
      never trust the client's "I uploaded it" claim)
    ↓ finalizes attendance_records, inserts attendance_photos row (review_status='pending')
    ↓ audit.ts logs the check-in event
    ↓
Admin review UI (later): Server Action getAttendancePhotoUrl(photoId) re-checks the
  requester's membership/role, then mints a fresh short-lived signed READ URL per view
  — never a cached or public URL
Server Action reviewAttendancePhoto({ photoId, decision, note }) updates review_status,
  reviewed_by (from session), reviewed_at, and writes audit_log
```

### State management (unchanged shape from V1, different backing)

```
Session state:  Supabase Auth session (JWT in HTTP-only cookies, managed by the
                three-client @supabase/ssr pattern) ←→ session-provider.tsx Context,
                same useSession()/useAuthenticatedSession() API surface as V1
Data cache:     Not persistent; lives in useDataQuery component state, same as V1
Invalidation:   MockDataProvider version counter, UNCHANGED mechanics
UI state:       Local component state (filters, pagination, dialogs), UNCHANGED
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-2 companies (current pilot target) | Server Actions for both reads and writes; `useMockQuery`/`useDataQuery` as-is; no caching layer needed; single Supabase project |
| ~10-50 companies | Consider Route Handlers + TanStack Query for the highest-traffic read screens (admin dashboard, employee list) if serial Server-Action fetching becomes visibly slow; add composite indexes on `(company_id, <hot filter column>)` if not already present; keep everything else unchanged |
| 100+ companies / high concurrent admin usage | Revisit connection pooling mode (Supabase's pooler transaction mode has known limits with session-scoped patterns — irrelevant here since this architecture never relies on `SET LOCAL` session variables, see Anti-Pattern 2); consider read replicas; this is explicitly out of scope per `.planning/PROJECT.md` ("chưa cần tối ưu cho hàng nghìn tenant") |

### Scaling Priorities

1. **First bottleneck (if it ever appears):** Server Action serial execution on pages with many concurrent queries (e.g., dashboard loading 4-5 widgets at once). Fix: move just those reads to a Route Handler + TanStack Query, leave the rest of the app on Server Actions — this can be done incrementally, screen by screen, because `useDataQuery`'s call signature doesn't care what's underneath it.
2. **Second bottleneck:** RLS policy evaluation cost on large tables (`attendance_records` grows fastest — daily rows per employee). Fix: ensure `(company_id, employee_id, check_in_at)` composite index exists before this becomes measurable; not a concern at pilot volume (dozens of employees × two punches/day).

## Anti-Patterns

### Anti-Pattern 1: Trusting a client-supplied `company_id`

**What people do:** Accept `companyId` as a parameter from the client (form field, query param, or request body) and use it directly in a query, because it's convenient and "the UI only shows the right company anyway."

**Why it's wrong:** The UI is not a security boundary. A malicious or buggy client can send any `company_id`. If RLS is even slightly misconfigured for one table, this becomes a direct cross-tenant read/write — which is exactly the risk this project has named as its top concern.

**Do this instead:** `company_id` (or "active company") is resolved exclusively server-side in `session.ts` from the authenticated session, never accepted as an input parameter to any `src/lib/data/*` function, even for convenience.

### Anti-Pattern 2: Encoding "current tenant" as a Postgres session variable

**What people do:** Use `SET LOCAL app.company_id = '...'` at the start of a request and write RLS policies against `current_setting('app.company_id')`, because it's a common pattern in RLS tutorials.

**Why it's wrong:** Supabase's connection pooler in transaction mode does not guarantee session-local variables stay scoped to a single logical request the way this pattern assumes; it is easy to leak a session variable across requests under pooling, which is a subtle and dangerous cross-tenant bug that's hard to catch in testing (works fine locally, breaks under production connection reuse).

**Do this instead:** Use membership-table joins in RLS (`EXISTS (SELECT 1 FROM memberships WHERE ...)`) as in Pattern 3/4 above — no session state required, safe under any pooling mode.

### Anti-Pattern 3: `service_role` used for "just this one convenient admin query"

**What people do:** Reach for the `service_role` client somewhere in normal application code because it "just works" and sidesteps an RLS policy that's inconvenient to write correctly.

**Why it's wrong:** `service_role` bypasses RLS entirely — every query written against it is only as safe as the application code around it, with zero database-level backstop. This directly contradicts the project's own locked decision to keep RLS as an independent second layer.

**Do this instead:** Fix the RLS policy. If cross-tenant access is genuinely needed (super admin), route it through `super-admin.ts` exclusively, with mandatory audit logging, as in Pattern 5.

### Anti-Pattern 4: Public Storage buckets or long-lived public URLs for attendance photos

**What people do:** Mark the attendance-photos bucket public, or generate a signed URL once and store/cache it for reuse in the UI, because it's simpler than re-minting URLs.

**Why it's wrong:** Attendance photos are personally identifying, location-correlated images of employees; a public bucket or a long-lived cached URL that leaks (browser history, logs, screenshots) exposes them indefinitely and outside the tenant boundary the rest of the system enforces.

**Do this instead:** Private bucket, short-TTL signed URLs minted per-view by a Server Action that re-checks authorization on every mint (as in the photo flow above).

### Anti-Pattern 5: Relying on the `capture` HTML attribute alone to block gallery photo selection

**What people do:** Use `<input type="file" accept="image/*" capture="environment">` and consider "no pre-existing photo" requirement satisfied, because it opens the camera directly on most mobile browsers.

**Why it's wrong:** `capture` is a hint, not an enforced constraint — behavior is inconsistent across browsers/OSes, and desktop browsers largely ignore it, so a user can still select an existing file in some environments. Since anti-fraud is the explicit point of this requirement ("chấm công bắt buộc kèm ảnh chụp trực tiếp bằng camera (không cho chọn ảnh có sẵn)"), relying on the attribute alone is a false sense of enforcement.

**Do this instead:** Capture via `getUserMedia()` + a `<canvas>` frame grab (no file picker surfaces at all) as the primary mechanism on supported browsers; treat this as a phase-specific research flag — verify actual device/browser coverage for the target Vietnamese SME employee device mix before committing to a single capture mechanism, and decide the fallback behavior (e.g., disallow check-in entirely vs. degrade with a visible "unverified" flag) explicitly rather than silently.

### Anti-Pattern 6: Deferring the audit log to a later phase

**What people do:** Ship the core CRUD migration first, plan to "add audit logging later once the schema stabilizes."

**Why it's wrong:** Retrofitting an audit trail onto every existing mutation function after the fact means touching every file in `src/lib/data/` a second time; building it in from the first mutation means every subsequent file follows an established pattern.

**Do this instead:** Introduce the `audit_log` table and a `logMutation()`/`logDecision()` helper in the same phase as the first real mutation (Build Order phase 2/3 below), not as a separate late phase.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Postgres | `@supabase/ssr` `createServerClient()`, cookie-bound, `authenticated` role | Never use the `service_role` connection string in normal request paths |
| Supabase Auth | Three-client pattern: browser client, server client, middleware client | Middleware refreshes the session cookie before Server Components render; always `getUser()`, never trust `getSession()` server-side for authorization |
| Supabase Storage | Signed upload URLs (write), signed read URLs minted per-request (read) | Private bucket only; path convention `{company_id}/{employee_id}/{record_id}/{kind}.jpg` doubles as a natural RLS/storage-policy boundary |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `*-view.tsx` ↔ `src/lib/data/*` | Direct async function calls (Server Action RPC), same shape as today's mock calls | This is the boundary that must never be crossed by a direct Supabase client import from a View |
| `src/lib/data/*` ↔ Postgres | Supabase JS client over `authenticated` role | Every tenant table query includes an explicit `company_id` filter, backed independently by RLS |
| `src/lib/data/super-admin.ts` ↔ Postgres | Supabase JS client over `service_role` | The only file in the codebase permitted to import `supabase-admin.ts`; every write path mandates an `audit_log` insert |
| Client ↔ Supabase Storage | Signed URL, minted by `src/lib/data/attendance-photos.ts` | The one deliberate exception to "server-only Supabase access" — scoped, short-lived, server-controlled |
| `middleware.ts` ↔ Supabase Auth | Cookie read/refresh on every matched request | Must run before any Server Component that depends on a fresh session |

## Suggested Build Order

Ordered by dependency and by minimizing the blast radius of an RLS mistake, since that is the named top risk.

1. **Schema + RLS foundation, verified in isolation before any UI is wired to it.** Write the full multi-tenant schema (companies, memberships, platform_admins, departments, employees, shifts, work_sites, attendance_records, attendance_photos, work_requests, holidays, company_settings, audit_log) and every RLS policy first, as SQL migrations with no application code depending on them yet. Seed with the two existing V1 sample companies (Ngọc Phát, Bình Minh) specifically because they already exist as a ready-made adversarial fixture. Write and run automated cross-tenant leak tests — as a Ngọc Phát user, assert zero rows returned for every Bình Minh row on every table, and vice versa — before this phase is considered done. This makes the highest-risk part of the whole migration a narrow, mechanically-verifiable phase instead of something discovered later while debugging a feature.
2. **Auth + session + membership layer.** Wire real Supabase Auth (three-client pattern), replace `session-provider.tsx` internals while keeping its `useSession()`/`useAuthenticatedSession()` surface, build `session.ts` (the new mandatory choke point), wire `middleware.ts`, and rebuild the company-selection flow on real memberships. Introduce `audit.ts` here too, even though there's little to log yet — every phase after this one should be able to call it from its first mutation. This phase blocks everything else: no data-layer function can resolve "who is asking" until it exists.
3. **Foundational entity CRUD.** Replace `mock/service.ts` functions for companies, departments, employees, shifts, work_sites, company_settings — the lowest-complexity, no-attendance-specific-logic tables — proving the "swap the body, keep the signature" pattern end-to-end and exercising the RLS policies from phase 1 against real UI traffic for the first time, on the lowest-risk data.
4. **Attendance + photo/GPS pipeline.** Highest genuine complexity in the migration (Storage signed URLs, server-side geofence math, camera capture behavior). Depends on `work_sites` existing from phase 3.
5. **Work requests + approval workflow.** Depends on employees and attendance being real, since corrections reference `attendance_records` and approvals need a real actor/audit trail.
6. **Super admin surfaces.** Cross-tenant read UI and the audited impersonation write path. Technically independent of phases 3-5, but placed last deliberately: it's most useful, and safest to build, once there is real multi-tenant data (from the phase-1 seed companies plus whatever phases 3-5 produced) to verify isolation against, rather than being exercised only against a single company during earlier phases.

**Key ordering rationale:** RLS is proven correct in isolation (phase 1) before anything is built that relies on it (phases 2-6), rather than RLS being retrofitted after features work against a single-tenant happy path. The audit log is infrastructure introduced early (phase 2), not a late add-on (Anti-Pattern 6). Super admin — the feature most directly exercising cross-tenant boundaries — is built last, after the isolation model has already been proven by every earlier phase.

## Sources

- [Setting up Server-Side Auth for Next.js — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — MEDIUM (corroborated across multiple independent search results; matches known `@supabase/ssr` conventions)
- [Creating a Supabase client for SSR — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — MEDIUM
- [Advanced guide — Supabase Docs (server-side auth)](https://supabase.com/docs/guides/auth/server-side/advanced-guide) — MEDIUM
- [Custom Claims & Role-based Access Control (RBAC) — Supabase Docs](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac) — MEDIUM
- [Token Security and Row Level Security — Supabase Docs](https://supabase.com/docs/guides/auth/oauth-server/token-security) — MEDIUM
- [Authorization via Row Level Security — Supabase Features](https://supabase.com/features/row-level-security) — MEDIUM
- [Advanced Server Rendering — TanStack Query React Docs](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) — MEDIUM (documents the Server-Actions-in-queryFn caveat referenced in Pattern 1/2)
- [Approaches to tenancy in Postgres — PlanetScale](https://planetscale.com/blog/approaches-to-tenancy-in-postgres) — LOW-MEDIUM, cross-checked against multiple independent multi-tenant RLS writeups converging on the same shared-schema-plus-RLS recommendation
- General web search corroboration (multiple independent blog/community sources converging on: shared-schema RLS with `tenant_id`/`company_id` column as majority pattern; `service_role` bypasses RLS and must stay server-only; signed URLs as the standard workaround for Server Action body-size limits; `getUser()` over `getSession()` for server-side auth checks) — MEDIUM confidence where 3+ independent sources agreed, treated as directional (not verified against official docs) where only one source was found
- Project-internal sources treated as ground truth, not re-derived: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`

---
*Architecture research for: Multi-tenant Next.js 15 + Supabase workforce management SaaS (TimeFlow V2)*
*Researched: 2026-07-31*
