# Project Research Summary

**Project:** TimeFlow V2 — Supabase backend migration for multi-tenant workforce attendance SaaS
**Domain:** Vietnamese SME workforce management (attendance, time-tracking, approval workflows)
**Researched:** 2026-07-31
**Confidence:** MEDIUM (pattern-verified across research documents; key tech versions confirmed via npm registry; some guidance sourced from web search rather than curated documentation)

## Executive Summary

TimeFlow V2 is a backend migration from in-memory mocks to a real, multi-tenant Supabase database, combined with a proof-of-presence attendance feature (live camera + GPS geofence). The recommended approach is to build the system with two independent isolation layers — explicit server-side company-scoped filtering backed by Postgres RLS policies — rather than relying on RLS alone. This "belt and suspenders" defense is critical because the codebase already has a named, open risk around the service-role key's exposure, and the attendance feature will handle sensitive employee data (photos + precise location) requiring explicit consent and retention policies under Vietnam's new Personal Data Protection Law.

The research identifies 18 specific pitfalls ranging from critical (RLS misconfiguration, service-role key exposure, client-supplied company_id) to important-but-recoverable (N+1 queries, missing timezone handling). The phased approach recommended by the architecture research sequences RLS validation before any real UI depends on it, defers cross-tenant super-admin work to the end (when isolation is already proven), and treats the attendance-evidence phase as high-risk and high-reward — it's the feature that makes TimeFlow's value proposition real ("đúng giờ, đúng nơi" — accurate time and location proof), but GPS/photo spoofing and consent handling need careful, deliberate scope.

## Key Findings

### Recommended Stack

The migration uses Supabase as the committed backend (per PROJECT.md), bringing three distinct client types:

**Core technologies:**
- **@supabase/supabase-js 2.111.0** — JavaScript SDK for Postgres (PostgREST), Auth, and Storage access; version-locks all sub-packages and requires Node ≥22 (matches project's existing 22.18.0)
- **@supabase/ssr 0.12.4** — Server-side session management for Next.js App Router, cookie-bound, with three-client pattern (browser, server, middleware)
- **Supabase-managed Postgres** — Primary datastore; RLS becomes the second-layer isolation enforcement alongside server-side company_id filtering
- **pgTAP extension** — SQL-level unit testing of RLS policies; only realistic way to assert "tenant A cannot read tenant B's rows" independently
- **browser-image-compression** — Client-side photo downscaling before upload (addresses ~1MB Server Action body-size ceiling)
- **Vitest + @testing-library/react** — Unit test runner (recommended by Next.js 15)
- **@playwright/test** — E2E testing with native geolocation/permission mocking

**Key architectural decision:** Supabase Storage buckets for attendance photos must remain private; photos are served via short-TTL signed URLs minted server-side after re-checking authorization per-request.

### Expected Features

**Table stakes (users expect these):**
- Live-camera photo capture (no gallery picker allowed per PROJECT.md)
- GPS geofence around admin-configured work location
- Admin review UI for photos + location per attendance record
- Configurable work hours, grace period per shift
- Public holiday calendar (VN 2026 statutory dates pre-seeded)
- Role-based access (employee/manager/admin/super admin)
- Member invitation + role assignment flow
- Approve/reject requests with mandatory reason on reject
- Approved requests correctly update underlying attendance records
- Audit history visible on each request
- In-app notifications when requests are decided
- Super admin: tenant list + ability to view one company's data

**Should-have differentiators (after validation):**
- Physics-based GPS-spoof detection (accuracy jitter / impossible-speed between consecutive check-ins)
- OT cap soft-warnings at approval time
- Holiday-aware automatic attendance classification
- Audited "view as" mode for super admin support (time-boxed, logged, visibly bannered)

**Critical dependency:** OT rate rules require the holiday calendar. Request→attendance linkage requires *both* approval workflow AND settings. Member invitation requires role-based access model. Super admin conflicts with standard RLS (needs separate, audited cross-tenant code path).

### Architecture Approach

The architecture enforces a single, controlled path from every View to Supabase: `*-view.tsx` (Client Components) → `src/lib/data/*` (Server Actions) → Supabase. No direct client-side Supabase calls from Views.

**Major components:**
1. **Session/Auth layer** — Resolves "who is asking" (user, company, role) server-side; every data-access function calls this first
2. **Domain data-access functions** — Replaces `src/lib/mock/service.ts` function-for-function; each applies explicit `company_id` filter AND relies independently on RLS
3. **Postgres RLS policies** — Every tenant table gets `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` with policies checking membership via a `memberships` table joined against `auth.uid()`
4. **Supabase Storage (private)** — Attendance-photos bucket with RLS policies keyed to `company_id` path prefix
5. **Audit log** — Append-only table recording who/what/when/before/after for every mutation

**Suggested build order:**
1. **Schema + RLS foundation** — Write full multi-tenant schema and RLS policies as SQL migrations; seed with existing V1 companies; run automated cross-tenant leak tests
2. **Auth + session layer** — Migrate to real Supabase Auth (three-client pattern), introduce `session.ts`, rebuild company-selection flow
3. **Foundational entity CRUD** — Convert employees, departments, shifts (lowest-complexity tables) to prove the pattern
4. **Attendance + photo/GPS pipeline** — Highest genuine complexity; server-side haversine geofence check, Storage signed URLs, `getUserMedia()` capture
5. **Work requests + approval workflow** — Approved requests link to attendance records correctly
6. **Super admin surfaces** — Cross-tenant read UI + audited write path; built last after isolation is proven

### Critical Pitfalls

1. **RLS enabled on old tables, forgotten on new ones** — Prevention: CI check that fails if any public-schema table has `rowsecurity = false` or RLS with zero policies

2. **Client-supplied company_id trusted in queries** — Prevention: Resolve company_id exclusively from verified session in `session.ts`, never as a function parameter

3. **service_role key exposure** — Already a named risk in PROJECT.md. Prevention: Rotate keys before real backend connection; restrict references via grep/CI to narrow allow-list

4. **SECURITY DEFINER functions become unaudited RLS bypasses** — Prevention: Manual audit checklist for every SECURITY DEFINER; restrict EXECUTE grants to minimum roles

5. **GPS/photo "proof of presence" treated as unforgeable** — Prevention: Layer independent signals (mock-flag, physics-based checks, server-issued upload nonce); treat as deterrence + manual review, not cryptographic proof

## Implications for Roadmap

### Phase 1: Schema Foundation + RLS Validation
**Rationale:** Multi-tenant isolation is the single most critical risk. RLS must be proven correct in isolation, before any application code depends on it.

**Delivers:** Full multi-tenant schema, RLS policies on every tenant table, automated cross-tenant leak tests (pgTAP)

**Avoids pitfalls:** Missing RLS, client-supplied company_id, joins leaking rows, overnight shifts, UTC+7 timezone issues

---

### Phase 2: Auth Migration + Session Layer
**Rationale:** Every data-access function depends on knowing "who is asking" from a verified server session. Blocks phases 3-6.

**Delivers:** Three-client Supabase Auth pattern, `session.ts` as mandatory identity choke point, middleware hardening, `audit.ts` infrastructure

**Avoids pitfalls:** getSession() misuse, middleware redirect races, client/server identity drift

---

### Phase 3: Foundational Entity CRUD
**Rationale:** Lowest-complexity proof that the "swap the body, keep the signature" pattern works end-to-end.

**Delivers:** employees.ts, departments.ts, shifts.ts, work_sites.ts (all replacing `src/lib/mock/service.ts`), Company Settings foundation, member invitation, audit logging on all mutations

**Addresses:** Work hours + grace period, member invitation, role-based access

**Avoids:** N+1 queries, naive pagination, hidden mock assumptions

---

### Phase 4: Attendance Evidence + Proof of Presence
**Rationale:** Highest novelty + highest business value. Highest fraud-deterrence complexity. Sequenced after entities exist.

**Delivers:** Live-camera via `getUserMedia()`, server-side haversine geofence check, Storage signed upload/read URLs, private attendance-photo bucket with RLS, admin review UI, physics-based GPS spoof detection (P2), consent capture step

**Addresses:** Photo-on-punch, GPS geofence, admin review, consent/privacy obligations

**Avoids:** Public storage buckets, GPS/photo treated as unbeatable proof

---

### Phase 5: Work Requests + Approval Workflow
**Rationale:** The feature that makes the system worth building. High-complexity because it touches attendance + shifts + OT rules. Depends on phases 1-4.

**Delivers:** Leave/OT/correction approval, manager/admin approve/reject with reason, correct request→attendance linkage, holiday calendar + OT rate rules (150/200/300%), OT hour caps as soft warnings, audit history, in-app notifications, period-closing concept

**Addresses:** Approvals, request→attendance linkage, audit history, notifications, OT rates, holidays, retroactive-correction safeguards

**Avoids:** Overnight shift midnight split, UTC+7 timezone issues, retroactive corrections to closed periods

---

### Phase 6: Super Admin Console + Cross-Tenant Operations
**Rationale:** Last phase, intentionally. Super admin needs cross-tenant visibility (bypassing RLS), which is most likely to leak boundaries if built too early.

**Delivers:** Super admin tenant list, drill into one company's data/status, platform_admins table, dedicated super-admin.ts module, audited impersonation (or read-only view), audit trail of super admin access

**Avoids:** service-role key exposure, SECURITY DEFINER bypasses, client/server identity drift

---

### Phase Ordering Rationale

Schema validates RLS in isolation before application code depends on it. Auth provides session foundation every phase after needs. Base entities prove pattern with lowest risk. Attendance is core value but high complexity, built after infrastructure stable. Approvals layer on top of attendance; highest data-integrity risk. Super admin last as capstone, tested against dual-company fixtures.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 4 (Attendance):** Device/browser coverage for live-camera capture among target Vietnamese SME employee population; GPS accuracy testing in real customer office environments (common for basements/underground in Vietnam)
- **Phase 5 (Approvals):** Real pilot company approval-workflow patterns (may need more complex routing than single-level scoped)

**Phases with standard patterns (can skip research-phase):**
- **Phase 1 (Schema):** RLS patterns are well-established; phase is mechanically verification-driven rather than design-driven
- **Phase 2 (Auth):** Supabase @supabase/ssr patterns are officially documented; phase is implementation-driven

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Versions via npm registry (high); auth patterns via Supabase docs (medium); testing via web search (medium, multiple sources converging) |
| Features | MEDIUM | Vietnam labor-law via multiple independent sources (medium); competitor features via web search (low); feature dependencies via domain reasoning (high) |
| Architecture | MEDIUM | RLS/three-client patterns via Supabase docs + multiple blogs (medium); build order via domain reasoning (medium-high intent, medium execution confidence given this codebase hasn't done it) |
| Pitfalls | HIGH | Security pitfalls via Supabase docs + OWASP (high); codebase-specific via PROJECT.md/CONCERNS.md (high); GPS/privacy via multiple independent sources (medium) |

**Overall: MEDIUM**

### Gaps to Address

1. **Device/browser coverage for live-camera capture** — Target Vietnamese SME employee device mix coverage for `getUserMedia()` uncertain. Phase 4 planning should include device validation research.

2. **GPS accuracy in real Vietnamese office environments** — Real GPS accuracy indoors/underground (common for Vietnamese office basements) may exceed configured radius. Phase 4 acceptance criteria should include customer-site testing.

3. **Real pilot company approval-workflow patterns** — Single-level approval model assumption needs confirmation. Phase 5 should include pre-phase customer validation.

4. **Ongoing storage cost + retention policy** — Photo retention decisions (90 days? forever?) deferred. Phase 4 should include cost projection and policy decision.

5. **Period-closing UX before V3 payroll** — Lightweight "period status" introduced in Phase 5, but full UX deferred. Phase 5 planning should clarify scope.

## Sources

Consolidated from the four dimension documents in this directory:

- `STACK.md` — package versions verified against the npm registry; Supabase auth/SSR patterns from official Supabase documentation
- `FEATURES.md` — Vietnam labor law (OT multipliers, caps, 2026 holiday calendar) cross-checked across Playroll, Talentnet, ASEAN Briefing, Vietnam Briefing; competitor feature sets (MISA AMIS, TanCa, Deputy, Homebase, Buddy Punch) from vendor and comparison sites
- `ARCHITECTURE.md` — Supabase RLS multi-tenant patterns from official docs and community writeups; TanStack Query guidance on Server Actions
- `PITFALLS.md` — Supabase troubleshooting docs (`getUser()` vs `getSession()`), OWASP, documented Supabase storage-exposure incidents, Vietnam Decree 13/2023 and 2026 Personal Data Protection Law legal analyses

---
*Research synthesis completed: 2026-07-31*
*Synthesized by: GSD Research Synthesizer Agent (file persisted by orchestrator — issue #222 self-heal)*
*Ready for roadmap generation: YES*
