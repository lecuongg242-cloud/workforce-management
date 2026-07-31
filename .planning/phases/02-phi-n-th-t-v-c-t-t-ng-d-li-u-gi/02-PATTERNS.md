# Phase 2: Phiên thật và cắt tầng dữ liệu giả - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** ~45 (24 service functions treated as one migration unit + ~21 new/modified structural files)
**Analogs found:** partial — this phase is dominated by "no analog" (new architecture layer). See `## No Analog Found`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/supabase/client.ts` | provider/config | request-response | none (no Supabase code exists) | no-analog — follow RESEARCH Pattern 1 |
| `src/lib/supabase/server.ts` | provider/config | request-response | none | no-analog — follow RESEARCH Pattern 1 |
| `src/lib/supabase/middleware.ts` | middleware | request-response | none | no-analog — follow RESEARCH Pattern 2 |
| `src/middleware.ts` (root) | middleware | request-response | none (repo has zero middleware today) | no-analog |
| `src/lib/auth/get-session-context.ts` | service/guard | request-response | `src/lib/auth/session-provider.tsx` (`useAuthenticatedSession()`) — client-side analog only | role-match (client, not server) |
| `src/lib/data/*.ts` (Route Handler-facing service modules replacing `mock/service.ts`) | service | CRUD | `src/lib/mock/service.ts` (per-function, see inventory below) | exact (signature-level) |
| `src/lib/data/mutations/*.ts` (Server Actions) | service | CRUD | `src/lib/mock/service.ts` mutation functions (`create*`, `update*`, `checkIn`, `checkOut`) | exact (signature-level) |
| `src/lib/data/audit.ts` | utility/service | event-driven (append-only log) | none — but table/RLS shape follows `supabase/migrations/0002_tenancy.sql` policy quad conventions | no-analog for TS code, strong analog for SQL side |
| `src/app/api/**/route.ts` | route (Route Handler) | request-response | none — repo has zero `src/app/api/` today | no-analog — follow RESEARCH Pattern 5 |
| `src/lib/validation/api-schemas.ts` | utility (Zod schemas) | transform | `src/lib/validation/` existing Zod schemas for forms (co-located pattern), not request/response schemas | role-match |
| `src/lib/today.ts` | utility | transform | none — closest conceptual analog is `REFERENCE_DATE` constant itself in `src/lib/constants.ts` | no-analog |
| `scripts/seed-auth.mjs` | utility/script | batch | `scripts/db.mjs` | exact |
| `supabase/migrations/0006_platform_admins.sql` | migration | CRUD (schema) | `supabase/migrations/0002_tenancy.sql` (`tf_is_member` + policy quad) | exact |
| `supabase/tests/0X_platform_admins.sql` (pgTAP) | test | request-response (RLS assertions) | `supabase/tests/01_isolation_companies.sql`, `helpers.sql` | exact |
| `vitest.config.mts` | config | n/a | none — zero JS test infra exists | no-analog |
| `src/**/__tests__/*.test.ts` | test | unit | none (zero Vitest tests exist); pgTAP tests are the only existing test convention, different framework | no-analog |
| `eslint.config.mjs` (modified — add D-19a rule) | config | n/a | existing `eslintConfig` array itself (self-analog, just append) | exact |
| `eslint-rules/no-date-in-client.mjs` (optional Option B) | utility (lint rule) | transform (AST) | none | no-analog |
| `src/lib/mock/service.ts` (modified — all 24 fn bodies rewritten) | service | CRUD | itself (signatures locked, bodies replaced) — see full inventory below | exact (self) |
| `src/lib/auth/session-provider.tsx` (modified) | provider | request-response | itself — keep `useSession()`/`useAuthenticatedSession()`/`SessionProvider` API shape, swap internals for Supabase | exact (self) |
| `src/hooks/use-mock-query.ts` (modified) | hook | request-response | itself — keep `MockQueryResult<T>` shape exactly | exact (self) |
| `src/lib/mock/store.tsx` (unchanged per decisions) | provider | event-driven (version counter) | itself — no changes needed | exact (self, no-op) |
| `package.json` (modified) | config | n/a | itself (add deps + `test` script alongside existing `db:*` scripts) | exact (self) |

## Pattern Assignments

### The 24-function `service.ts` inventory (DATA-05 sizing — the actual risk surface)

Read in full at `src/lib/mock/service.ts`. Every function below keeps its exact signature; only the body changes. Grouped by section comment in the file:

**Doanh nghiệp (companies)**
| Function | Signature | Called from |
|---|---|---|
| `listCompanies()` | `(): Promise<Company[]>` | `select-company-view.tsx` |
| `getCompany(id)` | `(id: string): Promise<Company \| null>` | (internal / not directly grepped as a view import but part of same module) |
| `createCompany(input)` | `(input: CompanyInput): Promise<Company>` | `onboarding-wizard.tsx` |

**Phòng ban (departments)**
| Function | Signature | Called from |
|---|---|---|
| `listDepartments(companyId)` | `(companyId: string): Promise<DepartmentWithStats[]>` | `departments-view.tsx`, `employee-form.tsx`, `employees-view.tsx` |
| `createDepartment(companyId, input)` | `(companyId: string, input: DepartmentInput): Promise<Department>` | `departments-view.tsx` |
| `updateDepartment(id, patch)` | `(id: string, patch: Partial<DepartmentInput>): Promise<Department>` | `departments-view.tsx` |
| `deleteDepartment(id)` | `(id: string): Promise<void>` | `departments-view.tsx` |

**Ca làm việc (shifts)**
| Function | Signature | Called from |
|---|---|---|
| `listShifts(companyId)` | `(companyId: string): Promise<ShiftWithStats[]>` | `shifts-view.tsx`, `employee-form.tsx` |
| `createShift(companyId, input)` | `(companyId: string, input: ShiftInput): Promise<Shift>` | `shifts-view.tsx` |
| `updateShift(id, patch)` | `(id: string, patch: Partial<ShiftInput>): Promise<Shift>` | `shifts-view.tsx`, `shift-card.tsx` |
| `duplicateShift(id)` | `(id: string): Promise<Shift>` | `shifts-view.tsx` |

**Nhân viên (employees)**
| Function | Signature | Called from |
|---|---|---|
| `listEmployees(query)` | `(query: EmployeeQuery): Promise<Paginated<Employee>>` | `employees-view.tsx` |
| `listAllEmployees(companyId)` | `(companyId: string): Promise<Employee[]>` | `employee-form.tsx` (manager picker) |
| `getEmployee(id)` | `(id: string): Promise<Employee \| null>` | `employee-detail-view.tsx` |
| `createEmployee(companyId, input)` | `(companyId: string, input: EmployeeInput): Promise<Employee>` | `new-employee-view.tsx` |
| `updateEmployee(id, patch)` | `(id: string, patch: Partial<EmployeeInput>): Promise<Employee>` | `employee-detail-view.tsx`, `profile-view.tsx` |
| `bulkMoveDepartment(ids, departmentId)` | `(ids: string[], departmentId: string): Promise<number>` | `employees-view.tsx` (bulk action) |

**Chấm công (attendance)**
| Function | Signature | Called from |
|---|---|---|
| `listAttendance(query)` | `(query: AttendanceQuery): Promise<AttendanceRecord[]>` | `history-view.tsx`, `employee-detail-view.tsx` |
| `getMonthlySummary(companyId, employeeId, month)` | `(companyId: string, employeeId: string, month: string): Promise<MonthlySummary>` | `history-view.tsx`, `employee-home-view.tsx` |
| `checkIn(companyId, employeeId, date, time)` | `(...): Promise<AttendanceRecord>` | `employee-home-view.tsx` |
| `checkOut(recordId, time)` | `(recordId: string, time: string): Promise<AttendanceRecord>` | `employee-home-view.tsx` |

**Yêu cầu (requests)**
| Function | Signature | Called from |
|---|---|---|
| `listRequests(query)` | `(query: RequestQuery): Promise<WorkRequest[]>` | `requests-view.tsx` |
| `createRequest(companyId, employeeId, input)` | `(...): Promise<WorkRequest>` | `request-form-sheet.tsx` |

**Dashboard**
| Function | Signature | Called from |
|---|---|---|
| `getDashboardSummary(companyId, date)` | `(companyId: string, date: string): Promise<DashboardSummary>` | `dashboard-view.tsx` |

**Views/components consuming `mock/service` (full call-site list, verified by grep):**
```
src/app/(auth)/onboarding/onboarding-wizard.tsx
src/app/(auth)/select-company/select-company-view.tsx
src/app/admin/dashboard/dashboard-view.tsx
src/app/admin/departments/departments-view.tsx
src/app/admin/employees/[id]/employee-detail-view.tsx
src/app/admin/employees/employees-view.tsx
src/app/admin/employees/new/new-employee-view.tsx
src/app/admin/shifts/shifts-view.tsx
src/app/employee/employee-home-view.tsx
src/app/employee/history/history-view.tsx
src/app/employee/profile/profile-view.tsx
src/app/employee/requests/requests-view.tsx
src/components/employees/employee-form.tsx
src/components/layout/admin-shell.tsx
src/components/layout/admin-topbar.tsx
src/components/layout/employee-shell.tsx
src/components/shifts/shift-card.tsx
```
**Sizing implication for planner:** "replace service.ts" is not one task. It is 24 functions × (Route Handler for reads OR Server Action for writes) × Zod schema × audit-log call (for the 10 write functions: `createCompany`, `createDepartment`, `updateDepartment`, `deleteDepartment`, `createShift`, `updateShift`, `duplicateShift`, `createEmployee`, `updateEmployee`, `bulkMoveDepartment`, `checkIn`, `checkOut`, `createRequest` — 13 write functions) plus 11 read functions needing Route Handlers. Recommend the planner split this into per-domain plans (companies, departments, shifts, employees, attendance, requests, dashboard) rather than one "rewrite service.ts" plan.

---

### `src/lib/data/*.ts` and `src/app/api/**/route.ts` (new — Route Handler reads)

**No analog** — repo has zero `src/app/api/` files today (`Glob("src/app/api/**")` returns nothing).

Use RESEARCH.md Pattern 5 verbatim as the structural template (already includes `getSessionContext()` call order, `dynamic = "force-dynamic"`, Zod parse-both-ends, `.eq("company_id", companyId)` from session not query param, no `POST`/`PUT`/`DELETE` export). This is concrete code the planner can paste directly:

```typescript
// src/app/api/employees/route.ts (RESEARCH.md Pattern 5, already vetted)
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const { companyId } = await getSessionContext();
  // ... Zod parse query, .eq("company_id", companyId), Zod parse response
}
// KHÔNG export POST/PUT/DELETE ở file này
```

**Error-shape requirement (D-12e), concrete pairing with existing hook:**
`src/hooks/use-mock-query.ts:45-51` — current error handling that MUST be preserved:
```typescript
.catch((cause: unknown) => {
  if (cancelled) return;
  setError(
    cause instanceof Error
      ? cause.message
      : "Đã xảy ra lỗi không xác định.",
  );
})
```
This means the new fetcher passed into `useMockQuery(fetcher, deps)` must reject with an `Error` object carrying a Vietnamese message when the Route Handler responds non-2xx — the conversion from `fetch()` Response → thrown `Error` happens in the new `src/lib/data/*.ts` wrapper functions (which keep the exact same exported names/signatures as `mock/service.ts` per D-12e), not in the hook and not in views.

---

### Server Actions for mutations (D-12) — `src/lib/data/mutations/*.ts`

**No analog** (repo has no `"use server"` files today — confirmed no matches for `"use server"` grep pattern in existing `src/`).

Use RESEARCH.md Pattern 6 as the template (already includes `getSessionContext()`, `requireRole()`, before/after fetch for audit, `.eq("company_id", companyId)`, `logMutation()` call). Concrete excerpt to copy:

```typescript
// src/lib/data/mutations/employees.ts (RESEARCH.md Pattern 6, vetted)
"use server";
export async function updateEmployee(id: string, patch: EmployeeInput): Promise<Employee> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);
  // before/after fetch, .eq("company_id", companyId), logMutation({...})
}
```

---

### `getSessionContext()` — `src/lib/auth/get-session-context.ts`

**Analog:** `src/lib/auth/session-provider.tsx` — the *client-side* precedent for "one shared point that hands back {user, companyId, role}" is `useAuthenticatedSession()` at lines 132-140:
```typescript
export function useAuthenticatedSession(): UserSession {
  const { session } = useSession();
  if (!session) {
    throw new Error(
      "useAuthenticatedSession chỉ được dùng trong khu vực đã đăng nhập.",
    );
  }
  return session;
}
```
This is the shape convention to mirror server-side (throw on missing session, return a plain typed object) — but it is NOT a server module and does not read `app_metadata`/`isPlatformAdmin`. The new function is genuinely new code; use RESEARCH.md Pattern 4 as the code template. Domain type source of truth for `role`: `src/lib/types/domain.ts:47` — `export type CompanyRole = "owner" | "admin" | "manager" | "employee";` — do NOT add a 5th value here (platform admin is a separate boolean per D-11).

---

### `scripts/seed-auth.mjs`

**Analog:** `scripts/db.mjs` (full file read above) — strong match on invocation convention and style:
- Same header comment convention (`#!/usr/bin/env node`, block comment explaining purpose + constraint reference like `(D-03, threat T-01-SC)`)
- Same env var access pattern: `requireConnectionUrl()` reads `process.env.POSTGRES_URL_NON_POOLING` and exits with a Vietnamese error message + `process.exit(1)` if missing — copy this exact pattern for the new required env var (service_role key)
- Same invocation convention: `node --env-file=.env.local scripts/seed-auth.mjs` (add to `package.json` scripts block next to `db:seed`)
- No new npm dependency for the script itself — but this script will need `@supabase/supabase-js` (already being added to `dependencies` for the app, so no separate install)
- Copy the `main()` dispatch-by-argv style shown at `scripts/db.mjs:132-167` if the script needs subcommands, or keep it a single top-to-bottom script if not (10 users, not many branches — simpler is fine)

**Core pattern to implement (RESEARCH.md Pattern 7, vetted):**
```javascript
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email: "owner@ngocphat.example",
  password: temporaryPassword,
  email_confirm: true, // D-14a
  app_metadata: { must_change_password: true },
});
// then: insert memberships (user_id: data.user.id, company_id, role)
//       update employees set user_id = data.user.id where ...
```

---

### `supabase/migrations/0006_platform_admins.sql`

**Analog:** `supabase/migrations/0002_tenancy.sql` lines 64-76 (`tf_is_member`) and lines 90-140 (policy quad) — this is an EXACT structural analog per D-11b, already called out in CONTEXT.md.

**Function pattern to clone (lines 64-76, read in full above):**
```sql
create function public.tf_is_member(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from memberships
    where company_id = p_company_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

revoke execute on function public.tf_is_member(text) from public;
grant execute on function public.tf_is_member(text) to authenticated;
```
For `tf_is_platform_admin()`: same shape, no parameter (checks `auth.uid()` against `platform_admins.user_id` directly), same `security definer` + `set search_path = public, pg_temp` + `revoke execute ... from public` + `grant execute ... to authenticated`.

**Policy quad pattern (D-11a — "chặn hết", deny-all) to clone the STRUCTURE of (not the permissive logic) — lines 90-140:**
```sql
alter table companies enable row level security;

create policy companies_select_member on companies
  for select
  using (public.tf_is_member(id));

create policy companies_insert_member on companies ...
create policy companies_update_member on companies ...
create policy companies_delete_member on companies ...
```
For `platform_admins`, D-11a requires the opposite condition (deny-all — no one reads the table directly): `alter table platform_admins enable row level security;` plus at minimum one policy with `using (false)` (or omit permissive policies entirely and rely on default-deny — but `supabase/tests/00_rls_coverage.sql` fails on "RLS on + 0 policies", so at least one explicit `using (false)` policy is required to satisfy that gate, per the CONTEXT.md D-11a note).

**Company/user id types:** note `companies.id` is `text` (not uuid) — `memberships.user_id` is `uuid references auth.users(id)`. `platform_admins.user_id` should follow the `memberships.user_id` convention: `uuid not null references auth.users (id) on delete cascade`, plus `created_at timestamptz not null default now()` per D-11 ("chỉ user_id + created_at").

---

### pgTAP test for `platform_admins`

**Analogs:** `supabase/tests/01_isolation_companies.sql` (full test structure) + `supabase/tests/helpers.sql` (full file, read above).

**Login/logout helper pattern to reuse verbatim (already exists, no new code needed):**
```sql
select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);
-- assertions...
select tf_test_logout();
```

**Assertion pattern to clone (from `01_isolation_companies.sql:9-34`):**
```sql
begin;
select plan(N);

select tf_test_login('<uuid>'::uuid);

select ok(
  (select public.tf_is_platform_admin()) = true,
  'tf_is_platform_admin: user X trả về true'
);
-- or with is():
select is(
  (select count(*) from platform_admins)::int,
  0,
  'platform_admins: RLS chặn đọc trực tiếp ngay cả với chính user đó'
);

select tf_test_logout();
select * from finish();
rollback;
```
Note the file naming convention: `01_isolation_companies.sql`, so a new file should follow `0N_<subject>.sql` (planner picks next available number, likely appended to the existing 4-file numbered sequence — check `supabase/tests/` directory listing at implementation time for the exact next number since only 01/04/05 plus 00_* were directly observed in this session, verify full directory before naming).

---

### Vitest config + first JS tests

**No analog** — zero Vitest/Jest config or `*.test.ts` files exist anywhere in `src/`. This is greenfield infrastructure. Use RESEARCH.md §Standard Stack + §Validation Architecture Wave-0-Gaps list directly:
- `vitest.config.mts` — new, needs `vite-tsconfig-paths` plugin (project uses `@/*` alias everywhere per `tsconfig.json`)
- `package.json` — add `"test": "vitest"` script alongside existing `db:push`/`db:seed`/`test:rls`/`test:db`/`check:secrets` scripts (see `package.json` lines 5-16 read above for the exact scripts-block shape/style to match — kebab-case-free camelCase-free plain command strings, no cross-env wrappers used elsewhere in this project)

---

### ESLint rule banning `new Date()`/`Date.now()` in client components (D-19a)

**Analog:** `eslint.config.mjs` itself (read in full above, only 21 lines) — the file to extend, not clone from elsewhere:
```javascript
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "out/**", "next-env.d.ts"],
  },
];
```
Append a new array entry per RESEARCH.md Code Examples §D-19a (Option A glob-based, ready to paste) — Option A is lower-risk given no existing precedent for custom ESLint rule authoring in this repo (Option B requires a new `eslint-rules/` directory with zero prior art and an unverified AST assumption per Assumptions Log A3).

---

### `REFERENCE_DATE` removal — per-file treatment (DATA-08)

**Analog approach for the two consuming Views (`dashboard-view.tsx`, `employee-home-view.tsx`):** RESEARCH.md's "Server-supplied today" pattern is the concrete template — a Server Component `page.tsx` computes `today` once and passes it as a prop; the View's `useState` is reseeded from the prop instead of the constant. Verified quote:
```
src/app/admin/dashboard/dashboard-view.tsx:19  import { REFERENCE_DATE } from "@/lib/constants";
src/app/admin/dashboard/dashboard-view.tsx:25  const [date, setDate] = React.useState(REFERENCE_DATE);
```
Fix: `dashboard-view.tsx` takes `today: string` prop, `useState(today)`, `setDate` logic unchanged (user can still browse other dates). The Server Component wrapper pattern:
```tsx
// src/app/admin/dashboard/page.tsx
export default async function DashboardPage() {
  const today = await getServerToday();
  return <DashboardView today={today} />;
}
```

**Per-file treatment table (verified via grep this session):**
| File | REFERENCE_DATE usage | Fix approach |
|---|---|---|
| `src/app/admin/dashboard/dashboard-view.tsx` | `useState` seed | prop from Server Component `page.tsx` |
| `src/app/employee/employee-home-view.tsx` | multiple "today" usages | prop, same pattern |
| `src/components/employee-app/request-form-sheet.tsx` | form default value | prop or context (Claude's Discretion per CONTEXT — leaning prop, passed down from the page/view that already has `today`) |
| `src/components/employees/employee-form.tsx` | default `startDate` | CONTEXT.md flags this as possibly staying as-is (meaning "today when creating new" is valid business intent) — confirm intent before removing, do not machine-replace |
| `src/lib/auth/session-provider.tsx` | `signedInAt` field | replace with real `session.created_at` from Supabase Auth, not a "today" value at all — different fix category than the others |
| `src/lib/constants.ts` | defines `REFERENCE_DATE`/`REFERENCE_MONTH` | delete LAST, after all 8 other files no longer import it |
| `src/lib/mock/db.ts` | whole file | delete (DATA-05) |
| `src/lib/mock/seed.ts` | whole file | delete (DATA-05) |
| `src/lib/mock/service.ts` | `createCompany`, `createRequest` use `${REFERENCE_DATE}T08:00:00+07:00}` style literals (lines 98, 498) | replaced naturally as part of the DATA-05 body rewrite — the new Postgres-backed body uses `now()`/`tf_work_date()` server-side, not a JS constant |

## Shared Patterns

### Session/identity check — apply to every Route Handler and every Server Action
**Source:** new `src/lib/auth/get-session-context.ts` (no prior code, built per RESEARCH.md Pattern 4)
**Apply to:** every file under `src/app/api/**/route.ts` and every file under `src/lib/data/mutations/*.ts`
```typescript
const { companyId, userId, role, isPlatformAdmin, mustChangePassword } = await getSessionContext();
// companyId NEVER comes from query param or request body — always from session
```

### Company-scoped RLS backstop — apply to every Supabase query in the new data layer
**Source:** `supabase/migrations/0002_tenancy.sql` policy quad pattern (`tf_is_member`)
**Apply to:** every `.from(table).select/insert/update/delete` call in `src/lib/data/**` — always pair `.eq("company_id", companyId)` at the application layer AND rely on RLS as layer 2, never one or the other alone.

### Audit logging — apply to every write function
**Source:** RESEARCH.md Pattern 6 (`logMutation`), new `src/lib/data/audit.ts`
**Apply to:** the 13 write functions identified in the inventory above (`createCompany`, `createDepartment`, `updateDepartment`, `deleteDepartment`, `createShift`, `updateShift`, `duplicateShift`, `createEmployee`, `updateEmployee`, `bulkMoveDepartment`, `checkIn`, `checkOut`, `createRequest`) — before/after full-row snapshot (D-18), no delta.

### Error-shape preservation — apply to every `src/lib/data/*.ts` wrapper
**Source:** `src/hooks/use-mock-query.ts:45-51` (existing, unchanged)
**Apply to:** every replacement function in `src/lib/data/**` that a View calls through `useMockQuery` — must throw/reject with `Error` carrying a Vietnamese `.message`, converting any Supabase/fetch error shape at this layer, never in the View.

### Vietnamese labels vs English enums — unchanged project-wide convention
**Source:** `src/lib/constants.ts` / `src/lib/types/domain.ts` (existing convention, applies to any new UI text)
**Apply to:** any new user-facing strings (error messages in Route Handlers/Server Actions, ESLint rule messages can stay technical/English per existing `no-restricted-syntax` example in RESEARCH.md).

## No Analog Found

Files/areas with genuinely no existing codebase precedent — planner must treat these as concrete-spec-required, not "follow the pattern of X":

| File/Area | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` | provider/config | request-response | Zero Supabase client code exists; repo only has mock in-memory `db.ts` |
| `src/middleware.ts` (root) | middleware | request-response | Repo has no middleware at all today |
| `src/app/api/**/route.ts` (all Route Handlers) | route | request-response | Repo has zero `src/app/api/` directory |
| `src/lib/data/mutations/*.ts` (Server Actions) | service | CRUD | No `"use server"` files exist in the repo today |
| `getSessionContext()` implementation body | service | request-response | Server-side session/claims reading is entirely new; only a client-side shape-analog exists (`useAuthenticatedSession`) |
| `vitest.config.mts` + all `*.test.ts` | test/config | unit | Zero JS test infrastructure exists; only pgTAP (different framework, different language) |
| `eslint-rules/no-date-in-client.mjs` (if Option B chosen) | utility | transform (AST) | No custom ESLint rule authoring precedent in this repo |
| `src/lib/today.ts` | utility | transform | No prior "server computes once, passes as prop" utility exists — `REFERENCE_DATE` was a static import, not a computed value |
| `supabase/config.toml` `disable_signup` + cloud verification step | ops/config | n/a | Not a code file at all — an operational/manual verification task (`curl` probe), no code pattern applies |

## Metadata

**Analog search scope:** `src/lib/`, `src/app/`, `src/hooks/`, `src/components/`, `supabase/migrations/`, `supabase/tests/`, `scripts/`, root config files (`eslint.config.mjs`, `package.json`, `tsconfig.json`)
**Files scanned:** `src/lib/mock/service.ts` (full, 669 lines), `src/hooks/use-mock-query.ts` (full), `src/lib/auth/session-provider.tsx` (full), `src/lib/mock/store.tsx` (full), `supabase/migrations/0002_tenancy.sql` (lines 1-140), `supabase/tests/helpers.sql` (full), `supabase/tests/01_isolation_companies.sql` (lines 1-60), `scripts/db.mjs` (full), `eslint.config.mjs` (full), `package.json` (full), `src/lib/types/domain.ts` (lines 40-55), `supabase/seed.sql` (grep for `auth.users`), plus grep of all 17 call sites importing `mock/service`
**Pattern extraction date:** 2026-07-31
