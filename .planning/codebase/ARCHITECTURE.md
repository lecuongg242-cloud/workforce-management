<!-- refreshed: 2026-07-31 -->
# Architecture

**Analysis Date:** 2026-07-31

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Next.js 15 App Router                             │
│  Pages & Layouts (Route Groups: auth, admin, employee)               │
│  `src/app/(auth)`, `src/app/admin`, `src/app/employee`               │
└───────────────────┬─────────────────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────────────────────┐
│                  View Components (Client-Side)                        │
│  *-view.tsx files handle state, queries, UI orchestration             │
│  `src/app/admin/employees/employees-view.tsx`                        │
│  `src/app/employee/employee-home-view.tsx`                           │
└───────────────────┬─────────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ UI Layers    │ │ Context      │ │ Custom       │
│ shadcn/ui    │ │ Providers    │ │ Hooks        │
│ & custom     │ │ (Session,    │ │              │
│ components   │ │ MockData)    │ │ useMockQuery │
│              │ │              │ │ useDebounce  │
│ `src/        │ │ `src/lib/    │ │ `src/hooks/` │
│ components/` │ │ auth/`,      │ │              │
│              │ │ `src/lib/    │ │              │
│              │ │ mock/`       │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
        │
        └─────────────────────┬──────────────────┐
                              │                  │
                ┌─────────────┴────────┐         │
                ▼                      ▼         ▼
        ┌──────────────────┐   ┌──────────────────┐
        │ Mock Service     │   │ Constants &      │
        │ Business Logic   │   │ Domain Types     │
        │                  │   │                  │
        │ listEmployees()  │   │ Employee[],      │
        │ listCompanies()  │   │ Department[],    │
        │ updateEmployee() │   │ AttendanceRecord │
        │ etc.             │   │ WorkRequest      │
        │                  │   │                  │
        │ `src/lib/mock/   │   │ `src/lib/        │
        │ service.ts`      │   │ types/domain.ts` │
        │ (async, 420ms    │   │ `src/lib/        │
        │ latency)         │   │ constants.ts`    │
        └──────────────────┘   └──────────────────┘
                │
                ▼
        ┌──────────────────┐
        │ In-Memory Mock   │
        │ Database         │
        │                  │
        │ `src/lib/mock/   │
        │ db.ts` (seed     │
        │ data)            │
        └──────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Route Handlers** | Accept HTTP request, render page metadata, delegate rendering to View | `src/app/**/page.tsx` |
| **View Components** | Client-side logic container: fetch data, manage state, handle events, render UI | `src/app/**/*-view.tsx` |
| **UI Components** | Reusable presentational components (buttons, tables, dialogs) | `src/components/ui/`, `src/components/common/`, domain-specific |
| **Layouts** | Route-level wrappers with shared structure (sidebar, topbar) | `src/app/(auth)/layout.tsx`, `src/app/admin/layout.tsx` |
| **Providers** | Context API containers for global state (session, mock data invalidation) | `src/app/providers.tsx`, `src/lib/auth/session-provider.tsx`, `src/lib/mock/store.tsx` |
| **Mock Service** | Async business logic, data queries, mutations with simulated latency | `src/lib/mock/service.ts` |
| **Custom Hooks** | Encapsulated logic for data fetching, debouncing, media queries | `src/hooks/use-mock-query.ts`, `use-debounce.ts` |
| **Domain Types** | TypeScript interfaces for all entities and queries | `src/lib/types/domain.ts` |
| **Constants** | Labels, options, display formats for enums and UI text (Vietnamese) | `src/lib/constants.ts` |

## Pattern Overview

**Overall:** Server-driven frontend with client-side interactivity, using Next.js 15 App Router and Context-based state management

**Key Characteristics:**
- **Server-first**: Pages are Server Components by default; client logic isolated in View components
- **Context-based state**: No Redux/Zustand; uses React Context for session and data invalidation
- **Mock layer**: All data flows through async mock service (designed to swap Supabase with minimal UI changes)
- **Vietnamese-first**: All labels, error messages, and display logic in Vietnamese; business logic uses English enums
- **Responsive design**: Component-level responsive strategies; desktop-first for admin, mobile-first for employee app
- **Form validation**: React Hook Form + Zod for strongly-typed schema validation

## Layers

**App Layer (Routes & Pages):**
- Purpose: Accept requests, render pages with metadata, delegate to View components
- Location: `src/app/`
- Contains: `page.tsx` (Server Components), `layout.tsx` (Server Components)
- Depends on: View components, metadata, TypeScript types
- Used by: Next.js 15 router

**View Layer (Client-Side Containers):**
- Purpose: Orchestrate business logic, manage client state, coordinate UI rendering and user interactions
- Location: `src/app/**/*-view.tsx`
- Contains: Client-side hooks, state management, event handlers, conditional rendering
- Depends on: Hooks (useMockQuery, useSession), UI components, mock service
- Used by: Pages, which render Views directly
- Patterns:
  - `useMockQuery()` for all data fetching
  - `useSession()` or `useAuthenticatedSession()` for auth context
  - `useMockData()` to trigger re-fetches after mutations
  - Local state for UI-only concerns (search filters, pagination, dialog visibility)

**UI Component Layer:**
- Purpose: Render interface elements; no business logic, no data fetching
- Location: `src/components/ui/` (primitives), `src/components/common/` (common composite), domain-specific subdirectories
- Contains: Button, Input, Table, Card, modals, badges, empty states, error states
- Depends on: Tailwind CSS, lucide-react icons, Zod (for form validation)
- Used by: View components

**Business Logic Layer (Mock Service):**
- Purpose: Encapsulate all data operations (queries and mutations)
- Location: `src/lib/mock/service.ts`
- Contains: ~40 async functions (listCompanies, listEmployees, updateEmployee, listAttendance, etc.)
- Depends on: In-memory database (`db.ts`), utility functions
- Used by: useMockQuery hook (in Views)
- Behavior: Each function includes artificial latency (420ms default) to simulate network requests

**State Management Layer:**
- Purpose: Provide global context for authentication session and data invalidation
- Location: `src/lib/auth/session-provider.tsx`, `src/lib/mock/store.tsx`
- Session Provider: Wraps localStorage persistence, sign-in/sign-out, company selection
- Mock Data Provider: Tracks version counter; invalidate() increments version, triggering re-fetches in useMockQuery hooks
- Depends on: localStorage API (browser only)
- Used by: Providers.tsx, View components via useSession() / useMockData() hooks

**Type & Constants Layer:**
- Purpose: Centralize domain types and UI labels; single source of truth for enums
- Location: `src/lib/types/domain.ts` (types), `src/lib/constants.ts` (labels)
- Domain types: Employee, Company, Department, Shift, AttendanceRecord, WorkRequest (and Query/Input variants)
- Constants: Maps enum values to Vietnamese labels, semantic tones (success/warning/danger), form options
- Used by: Every View, Service, and UI component layer

## Data Flow

### Primary Request Path (Viewing Data)

1. User navigates to a route (e.g., `/admin/employees`) → `src/app/admin/employees/page.tsx` renders
2. Page is Server Component; exports metadata, renders EmployeesView (Client Component)
3. EmployeesView renders and calls `useMockQuery(() => listEmployees({...}), [...deps])`
4. useMockQuery creates effect, calls fetcher function
5. `listEmployees()` in `src/lib/mock/service.ts` awaits delay(420ms), retrieves data from in-memory db, returns
6. useMockQuery receives data, updates state → triggers re-render with data/isLoading/error
7. EmployeesView renders UI using data (e.g., EmployeeTable component)

### Mutation Flow (Create/Update/Delete)

1. User submits form → View component event handler calls mutation function (e.g., updateEmployee)
2. `updateEmployee()` awaits delay(420ms), modifies in-memory db, returns
3. After success, handler calls `invalidate()` from `useMockData()` context
4. `invalidate()` increments version counter in MockDataProvider
5. All useMockQuery hooks see version change in dependency array, automatically refetch data
6. UI updates with new data, loading states clear

### Session Management

1. App boots → SessionProvider reads localStorage (`timeflow.session` key)
2. If key exists and valid, set status="authenticated"; otherwise status="guest"
3. Unauthenticated routes render normally; AdminShell redirects guests to /login
4. User signs in → `signIn()` stores session in localStorage and context
5. User signs out → clears localStorage, sets status="guest", user redirected to /login

**State Management:**
- **Session**: Stored in context + localStorage; flows down via useSession() / useAuthenticatedSession()
- **Data cache**: Not persistent; live in-memory in useMockQuery state
- **Invalidation**: MockDataProvider version counter drives re-fetches across all queries
- **UI state**: Local component state (filters, pagination, dialog visibility) — no shared state

## Key Abstractions

**View Component Pattern:**
- Purpose: Separate page routing from business logic
- Examples: `src/app/admin/employees/employees-view.tsx`, `src/app/employee/employee-home-view.tsx`
- Pattern: Pages delegate 100% of rendering to -View.tsx; Views own all hooks and state management

**Mock Service Layer:**
- Purpose: Abstract data operations behind Promise-based functions
- Examples: `listEmployees()`, `updateEmployee()`, `createCompany()`
- Pattern: Each function is async, simulates network latency, works with in-memory database
- Design intent: Swap to Supabase/backend by replacing service.ts internals without touching UI

**useMockQuery Hook:**
- Purpose: Standardized data fetching pattern with automatic re-fetch on dependency or invalidation changes
- Usage: `const { data, isLoading, error, reload } = useMockQuery(() => fetchData(), [deps...])`
- Pattern: Replaces manual useEffect + useState; depends on MockDataProvider version for invalidation

**Context-based Session:**
- Purpose: Provide authenticated user info and sign-out action globally
- Examples: useSession() returns {status, session, signIn, selectCompany, signOut}
- Pattern: Enforced with useAuthenticatedSession() in protected routes; throws if not authenticated

## Entry Points

**Root Route (`/`):**
- Location: `src/app/page.tsx`
- Triggers: Browser requests `/`
- Responsibilities: Server-side redirect to `/login`

**Authentication Routes:**
- Login: `src/app/(auth)/login/page.tsx` + `login-form.tsx`
- Onboarding: `src/app/(auth)/onboarding/page.tsx` + `onboarding-wizard.tsx`
- Company Selection: `src/app/(auth)/select-company/page.tsx` + `select-company-view.tsx`

**Admin Dashboard:**
- Location: `src/app/admin/dashboard/page.tsx` + `dashboard-view.tsx`
- Triggers: User with admin+ role navigates to `/admin`
- Responsibilities: Render KPIs, attendance charts, today's activity, pending requests

**Employee App:**
- Location: `src/app/employee/page.tsx` + `employee-home-view.tsx`
- Triggers: Employee logs in, navigates to `/employee`
- Responsibilities: Check in/out, view today's status, quick actions

## Architectural Constraints

- **Threading:** Single-threaded event loop (JavaScript/React); no worker threads used
- **Global state:** MockDataProvider's version counter is the only shared mutable state; session stored in localStorage
- **Circular imports:** None detected; types flow down, components/hooks import services one-way
- **Client-side only:** No backend yet; all business logic in browser (mock service)
- **Localization:** Single locale (Vietnamese); hardcoded labels in constants.ts
- **Time reference:** REFERENCE_DATE constant (2026-07-27) used throughout for consistent demo data; not based on system time

## Anti-Patterns

### Direct API calls in components

**What happens:** Some older code might call fetch() or make HTTP requests directly in useEffect within a View

**Why it's wrong:** Breaks the mock service abstraction; makes migration to real backend harder; violates separation of concerns

**Do this instead:** Create a function in `src/lib/mock/service.ts`, call it via `useMockQuery()` hook

### Sharing UI state across routes

**What happens:** Using context or Redux for pagination filters, search terms, modal open/close state across different pages

**Why it's wrong:** User expectations break when navigating back to a page (should reset filters); increases complexity; context is meant for auth/data invalidation, not UI state

**Do this instead:** Keep pagination, search, dialog visibility as local state in the View component; when user leaves route, state resets naturally

### Importing types from service layer

**What happens:** Importing domain types from mock/service.ts instead of lib/types/domain.ts

**Why it's wrong:** Couples UI to implementation; makes refactoring harder

**Do this instead:** Import all types from `src/lib/types/domain.ts` exclusively

## Error Handling

**Strategy:** Graceful degradation with user-facing error messages in Vietnamese

**Patterns:**
- useMockQuery returns {data: null, error: string | null}; Views check error and render ErrorState component
- Mock service throws Error with Vietnamese message; useMockQuery catches and stores message
- Forms use Zod schema.parse() for validation; React Hook Form displays errors inline
- Network errors (future Supabase): caught and displayed in toast (sonner) or alert dialog

## Cross-Cutting Concerns

**Logging:** Not yet implemented; console methods used in development. Future: Structured logging to external service.

**Validation:** Zod schemas in `src/lib/validation/schemas.ts`; used in forms and API call input validation before sending to mock service

**Authentication:** SessionProvider handles login/logout; AdminShell enforces route-level access control by redirecting guests to /login. Future: Middleware-based route protection via Next.js.

---

*Architecture analysis: 2026-07-31*
