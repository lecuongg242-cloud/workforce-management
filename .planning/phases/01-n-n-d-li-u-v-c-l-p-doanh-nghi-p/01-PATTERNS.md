# Phase 1: Nền dữ liệu và cô lập doanh nghiệp - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 8 target files/groups (migrations, seed, pgTAP tests, RLS check script, CI workflow, package.json scripts, .env.local)
**Analogs found:** 3 real in-repo analogs (TypeScript layer) / 0 in-repo SQL, test, or CI analogs — this phase is greenfield infra.

## Important framing

The repo has **no `supabase/` directory, no SQL, no test runner, no `.github/workflows/`**. Every file this phase creates is new infrastructure with no direct in-repo precedent of the same role. The only real analogs are the **TypeScript files that define the shape the schema must reproduce**. Do not force a weak SQL/CI analog — instead treat `domain.ts`, `seed.ts`, `db.ts`, `service.ts`, and `format.ts` as the source-of-truth contract, and note explicitly where "no analog exists."

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/000x_schema.sql` (tables + enums) | migration | CRUD (DDL) | `src/lib/types/domain.ts` | contract-match (not code analog — TS interfaces define columns/enums 1:1) |
| `supabase/migrations/000x_rls.sql` (RLS policies) | migration | request-response (row-level auth) | none in repo | no analog — first RLS ever written here |
| `supabase/migrations/000x_memberships.sql` (`memberships` table) | migration | CRUD | `Company.role` / `CompanyRole` in `domain.ts` + `UserSession` | contract-match |
| `supabase/seed.sql` | file-I/O / batch | batch insert | `src/lib/mock/seed.ts` + `src/lib/mock/db.ts` | strong structural analog (same entities/relationships, different language) |
| `supabase/tests/*.sql` (pgTAP RLS isolation tests) | test | request-response (assert query results per role) | none in repo | no analog — no test runner/tests exist anywhere in repo |
| RLS coverage-gate script (CI step or SQL query scanning `pg_tables`/`pg_policies`) | utility / config | batch (scan schema) | none in repo | no analog |
| `.github/workflows/db-ci.yml` | config | event-driven (on PR) | none in repo | no analog — first CI workflow |
| `package.json` scripts (`test:rls`, `test:db`) | config | — | `package.json` existing `scripts` block | exact location match, no prior test script pattern to copy |
| `.env.local` (new keys, rotated `sb_publishable_`/`sb_secret_`) | config | — | `docs/env` (current key store, gitignored, HS256 legacy pair) | exact analog for which keys exist today; this phase rotates the pair, not the file format |

## Pattern Assignments

### `supabase/migrations/*.sql` — schema/enum tables

**Analog:** `src/lib/types/domain.ts` (entire file, esp. lines 13–108 for enums, 65–194 for entities)

This is the authoritative source. Every union type becomes a Postgres enum (or `text` + `check`, per Claude's Discretion). Concretely:

```typescript
// domain.ts lines 13-52 — direct enum -> Postgres enum mapping
export type EmployeeStatus = "active" | "on_leave" | "terminated" | "pending_invite";
export type ContractType = "full_time" | "part_time" | "probation" | "seasonal" | "intern";
export type Gender = "male" | "female" | "other";
export type AttendanceStatus = "on_time" | "late" | "early_leave" | "missing_checkout" | "leave_paid" | "leave_unpaid" | "day_off";
export type RequestType = "leave" | "attendance_supplement" | "time_adjustment" | "overtime";
export type RequestStatus = "pending" | "approved" | "rejected";
export type SystemRole = "owner" | "admin" | "manager" | "employee";
export type CompanyRole = "owner" | "admin" | "manager" | "employee";
export type DepartmentStatus = "active" | "inactive";
export type ShiftStatus = "active" | "archived";
export type CompanySize = "1-10" | "11-30" | "31-100" | "101-500" | "500+";
export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO weekday, 1=Mon..7=Sun
```

Entity shapes to mirror as tables (lines 65–194): `Company`, `Department`, `Shift`, `Employee`, `AttendanceRecord`, `WorkRequest`, `AppUser`, `UserSession`. Every scope-bound table carries `companyId` (→ `company_id` FK) — this is the column every RLS policy will filter on.

Key constraints these types impose on the schema:
- `Shift.workingDays: WeekdayNumber[]` → needs an array/int[] column or join table.
- `Shift.overnight: boolean` + `startTime`/`endTime` as `"HH:mm"` strings → schema needs to support D-08 (overnight shift counts toward its **start date**), so `AttendanceRecord.date` must be derived from shift start, not split across midnight.
- `AttendanceRecord` has no `periodId`; D-09 introduces a new `periods` table (V2, not in `domain.ts`) with explicit `start_date`/`end_date` columns — this is a **new table not in V1 types**, per CONTEXT.md D-09.
- `WorkRequest.fromTime`/`toTime` nullable — only used for `attendance_supplement`/`time_adjustment` types.
- Nothing in `domain.ts` represents `memberships`; that table is new (see below).

**No analog for actual SQL syntax** (no existing `.sql` file in repo) — planner/implementer must write raw DDL from scratch following `domain.ts` field names (converted to `snake_case`).

---

### `supabase/migrations/*.sql` — `memberships` table + RLS policies

**Analog:** none in repo (no RLS, no auth-linked table exists yet).

**Contract source:** `UserSession` interface (`domain.ts` lines 188–194) — `{ user, companyId, role, signedInAt }` — shows the shape of "one user, one company, one role" that `memberships` must encode (user_id, company_id, role). `CompanyRole` (line 47) supplies the four role values (`owner`/`admin`/`manager`/`employee`) for the policy's role checks.

CONTEXT.md explicitly calls out (line 127): "**không** dùng session variable Postgres (`SET LOCAL`)" — RLS policies must join against `memberships` using `auth.uid()`, not connection-level session state, because Supabase uses a connection pooler.

No excerpt to copy — this is genuinely new code. Flag for planner: policy pattern should be `EXISTS (SELECT 1 FROM memberships m WHERE m.company_id = <table>.company_id AND m.user_id = auth.uid())`.

---

### `supabase/seed.sql`

**Analog:** `src/lib/mock/seed.ts` (1285 lines) + `src/lib/mock/db.ts` (162 lines, full file read)

**What to port (structure, not literal file):**
- Two companies, `CURRENT_COMPANY_ID = "cty-01"` (Ngọc Phát, 28 employees) and `SECOND_COMPANY_ID = "cty-02"` (Bình Minh) — `seed.ts` lines 27–75.
- ID convention: short prefixed slugs (`cty-01`, `pb-01`, `nv-01`, `cc-<employeeId>-<date>`) — see `db.ts` line 101 (`cc-${employee.id}-${date}`) and `nextId()` helper (`db.ts` lines 156–161, `idCounter` starting at 1000). SQL seed can keep human-readable text PKs or switch to UUIDs — planner's discretion, but note the V1 convention if kept for readability/debuggability.
- Departments reference a `managerId` that points to an `Employee.id` — i.e., FK order requires employees seeded (or manager FK deferred/nullable) before departments are finalized. `seed.ts` lines 81–120 show `managerId: "nv-02"` set at department-creation time even though that employee is defined later in the file — **seed.sql must handle this forward reference** (e.g., insert employees first without manager linkage, or defer constraint, or insert departments after employees and update).
- Attendance history generation logic (`db.ts` lines 45–117, `buildMonthlyHistory`): cyclical 8-day pattern of check-in/out times and statuses, `workedMinutes` computed via `minutesBetween(checkIn, checkOut) - shift.breakMinutes`, `lateMinutes`/`earlyLeaveMinutes` derived from shift boundaries. Per **D-07**, the ported seed must generate dates relative to "today" (not hardcoded `REFERENCE_DATE = "2026-07-27"` from `constants.ts` line 31) — this is an explicit deviation from the V1 pattern, not a literal copy.
- `createInitialDatabase()` (`db.ts` lines 123–142) shows full assembly order: companies → departments → shifts → employees → attendance → requests. Use this as the insert order for `seed.sql`.

**Constraint imposed:** seed must include at least one overnight shift per company (D-06 says "mỗi bên có một ca đêm") — check `seedShifts`/`seedShifts2` in `seed.ts` for the existing overnight shift definition (not shown in the read range above; grep further if exact clock values are needed during implementation, e.g. `Shift.overnight: true`, likely 22:00–06:00 per CONTEXT.md line 194).

---

### Time/overnight convention (D-08) — informs generated/check columns

**Analog:** `src/lib/format.ts` (full file, 232 lines, read in full)

Key functions whose logic must be reproduced in Postgres (as generated columns, functions, or application-level logic the schema must not preclude):
```typescript
// format.ts lines 141-147
export function minutesBetween(start: string, end: string): number {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  return endMinutes > startMinutes
    ? endMinutes - startMinutes
    : endMinutes + 1440 - startMinutes; // wraps past midnight
}

// format.ts lines 149-152
export function isOvernight(start: string, end: string): boolean {
  return timeToMinutes(end) <= timeToMinutes(start);
}
```
These confirm the "22:00 → 06:00 = 480 minutes, counted on the start date" rule (D-08, D-05 in spec) must be enforced at the schema/seed level: `attendance_records.date` = shift **start** date, full 8h credited there, nothing split to the next calendar day. V1 currently does all date math on `"YYYY-MM-DD"` strings client-side to dodge server/browser timezone drift (comment at `format.ts` lines 7–10) — the new schema is the first place a real UTC+7 timezone convention must be enforced server-side (`timestamptz` columns, or explicit `date` + `time` columns to avoid TZ ambiguity — planner's discretion per CONTEXT.md, but the "belongs to start date" rule is locked, D-08 is one-way/non-configurable).

---

### `supabase/tests/*.sql` (pgTAP cross-tenant isolation tests)

**Analog:** none — no test file, no test runner (`vitest`/`jest`/`pgtap`) exists anywhere in the repo; `package.json` `scripts` has no `test` entry at all (only `dev`, `build`, `start`, `lint`, `typecheck`).

**What determines test scope:** CONTEXT.md's two seeded companies (Ngọc Phát `cty-01`, Bình Minh `cty-02`) are explicitly designated as the cross-tenant fixture (`code_context` §"Established Patterns", line 161-163: "Hai doanh nghiệp tách biệt hoàn toàn trong seed V1 ... dùng luôn làm bộ đối chiếu cho test cô lập"). Tests must assert, **per table**, that a user authenticated as belonging to `cty-01` cannot read/write rows where `company_id = cty-02` and vice versa (CONTEXT.md line 188-190: assertions must be per-table, not one blanket check).

No excerpt to copy. Flag for planner: this is new pgTAP infra using `psql` + `POSTGRES_URL_NON_POOLING` locally (D-03) and a GitHub Actions Postgres service container in CI (D-04) — two different execution environments for the same test files.

---

### RLS coverage gate (CI check for tables missing RLS)

**Analog:** none in repo.

**Requirement source:** CONTEXT.md line 191-193: must scan the entire `public` schema and fail when any table has `rowsecurity = false`, or has RLS enabled but zero policies. This is a SQL query against `pg_tables`/`pg_policies` (or `pg_class.relrowsecurity`), likely run as a pgTAP test or a plain `psql -c` check step in the workflow. No existing script to model after; note this explicitly as new.

---

### `.github/workflows/*.yml`

**Analog:** none — `.github/` directory does not exist.

**Constraints from CONTEXT.md:**
- D-04: spin up a clean Postgres via GitHub Actions **service container**, apply all migrations via Supabase CLI, then run pgTAP — must not touch the cloud project.
- D-05: branch protection + PR-gated merge — CI red blocks merge (requires GitHub branch protection config outside the workflow YAML itself, a manual GitHub settings step, not a file).
- Supabase CLI already available via `npx` (2.111.0, no global install) — workflow should invoke via `npx supabase ...`, matching how it's used locally (implied by CONTEXT.md line 36-37, no separate CLI install step needed beyond Node/npx).

No excerpt to copy — first CI file in this repo.

---

### `package.json` — new scripts

**Analog:** `package.json` lines 5–11 (existing `scripts` block)

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit"
}
```
Follow the existing flat naming convention (`typecheck`, not `type-check`) when adding `test:rls` / `test:db` (or similar) — keep verb:noun or single-word style consistent with the 5 existing entries. No devDependency for a test runner exists yet (`devDependencies` lines 30–41 has no `vitest`/`jest`/pgtap-related package) — this phase is the first to add test-related deps/scripts.

---

### `.env.local` — key rotation (D-10 / AUTH-06)

**Analog:** `docs/env` (full file read, gitignored per `.gitignore` line 36 per CONTEXT.md)

Current file mixes **both** legacy HS256 keys (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — JWT-format) and the new key model (`SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."`, `SUPABASE_SECRET_KEY="sb_secret_..."`) already present side by side, plus `POSTGRES_URL_NON_POOLING` (needed for D-03's local pgTAP runs) and `NEXT_PUBLIC_SUPABASE_URL`. D-10 requires: revoke the legacy HS256 pair in Supabase dashboard/CLI, keep only `sb_publishable_`/`sb_secret_` going forward, and move this content into `.env.local` (not `docs/env`) so it's excluded from any doc/context sharing while `docs/env`'s current gitignore status is retained or the file is removed. Copy the **variable naming convention** (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `POSTGRES_URL_NON_POOLING`) directly from `docs/env` into `.env.local`.

## Shared Patterns

### Company-scoping column
**Source:** `src/lib/types/domain.ts` — every scoped entity (`Department`, `Shift`, `Employee`, `AttendanceRecord`, `WorkRequest`) declares `companyId: string` as its second field, immediately after `id`.
**Apply to:** every table in the schema migration and every RLS policy (all policies filter/join on this column via `memberships`).

### Enum-as-union-type
**Source:** `src/lib/types/domain.ts` lines 13–59.
**Apply to:** all `CREATE TYPE ... AS ENUM (...)` (or check-constraint) statements in the schema migration — use the exact string values from the TS unions, do not invent new ones or Vietnamese values.

### Vietnamese labels stay out of the DB
**Source:** `src/lib/constants.ts` (label maps like `WEEKDAY_LABEL_LONG`) vs. `domain.ts` (English enum values).
**Apply to:** schema migration and seed.sql — store only English enum values (`"on_time"`, `"leave_paid"`, etc.); never insert Vietnamese display strings into enum/status columns. Free-text columns (names, addresses, department descriptions) remain Vietnamese as literal data, which is fine and expected.

### "YYYY-MM-DD"/"HH:mm" string convention → schema translation point
**Source:** `src/lib/format.ts` (whole file) — V1 works entirely in ISO date strings and `"HH:mm"` strings to dodge timezone drift between server and browser.
**Apply to:** migration authors must decide `date`/`time`/`timestamptz` column types that preserve the same semantics (esp. `minutesBetween` wraparound logic for overnight shifts, D-08) — this is not a copy-paste pattern but a hard constraint every time-related column and RLS/query test must satisfy.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `supabase/migrations/*_rls.sql` (policy definitions) | migration | request-response | No RLS policy exists anywhere in repo; first multi-tenant auth boundary being introduced |
| `supabase/tests/*.sql` (pgTAP) | test | request-response | No test file or test runner of any kind exists in the repo today |
| RLS coverage-gate query/script | utility | batch | No schema-introspection script exists |
| `.github/workflows/db-ci.yml` | config | event-driven | `.github/` directory does not exist; no CI has ever run in this repo |
| `supabase/config.toml` (if Supabase CLI init generates one) | config | — | No `supabase/` directory exists |

For all rows above, the planner should rely on RESEARCH.md-equivalent external conventions (pgTAP idioms, Supabase CLI migration conventions, GitHub Actions Postgres service-container examples) since no in-repo precedent exists. Note: RESEARCH.md was skipped for this phase per user choice, so the planner may need to source these conventions directly from Supabase/pgTAP/GitHub Actions documentation during planning or implementation.

## Metadata

**Analog search scope:** `src/lib/types/domain.ts`, `src/lib/mock/seed.ts`, `src/lib/mock/db.ts`, `src/lib/mock/service.ts`, `src/lib/format.ts`, `src/lib/constants.ts`, `package.json`, `docs/env`, repo root (checked for `supabase/`, `.github/` — confirmed absent).
**Files scanned:** 8 read directly (full or targeted), 1 directory listing, 1 grep for `service.ts` function signatures.
**Pattern extraction date:** 2026-07-31
