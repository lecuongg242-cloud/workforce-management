
## Project

**TimeFlow**

TimeFlow là nền tảng SaaS multi-tenant quản lý chấm công và chuẩn bị dữ liệu tính
lương cho doanh nghiệp vừa và nhỏ tại Việt Nam. Người dùng gồm hai nhóm: quản trị
viên / nhân sự làm việc trên giao diện desktop (`/admin/*`) và nhân viên chấm công
trên giao diện mobile (`/employee/*`).

V1 đã hoàn thiện toàn bộ frontend nhưng chạy trên lớp dữ liệu giả: mọi truy vấn đi
qua `src/lib/mock/service.ts` với in-memory database, phiên đăng nhập lưu ở
localStorage. **V2 biến TimeFlow từ prototype thành sản phẩm chạy thật** — backend
Supabase, chấm công có bằng chứng chống gian lận, và các module quản trị còn thiếu.

**Core Value:** Doanh nghiệp tin được số liệu chấm công: mỗi bản ghi vào/ra là có thật, đúng người,
đúng nơi, đúng giờ — và không doanh nghiệp nào nhìn thấy dữ liệu của doanh nghiệp khác.

### Constraints

- **Tech stack**: Next.js 15 App Router + React 19 + TypeScript strict (không dùng
  `any`) + Tailwind v4 + shadcn/ui — giữ nguyên từ V1, không đổi nền tảng

- **Backend**: Supabase (Postgres + Auth + Storage) — khóa đã có sẵn, không đưa thêm
  nhà cung cấp mới vào hệ thống

- **Bảo mật**: mọi truy cập dữ liệu đi qua tầng server của Next.js; anon key không
  đủ quyền làm gì đáng kể ở client; RLS bật trên mọi bảng làm lớp phòng thủ thứ hai

- **Design system**: tuân thủ tokens trong `src/app/globals.css` — mỗi khu vực chỉ
  một nút filled indigo, gradient mesh chỉ ở login và onboarding

- **Ngôn ngữ**: giao diện tiếng Việt; nhãn nằm ở `constants.ts`, enum nghiệp vụ tiếng Anh
- **Quy mô mục tiêu**: đủ tin cậy cho 1-2 doanh nghiệp thật, chưa cần tối ưu cho
  hàng nghìn tenant


## Technology Stack

## Languages

- TypeScript 5.7.2 - Full application codebase in `src/`
- JavaScript (ESM modules) - Configuration files (`next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`)

## Runtime

- Node.js 22.18.0 (current in development)
- npm 11.10.1
- Lockfile: `package-lock.json` present

## Frameworks

- Next.js 15.0.0 - Full-stack web framework with React server components
- React 19.0.0 - Client-side component framework
- Radix UI 1.6.7 - Headless component library (buttons, forms, modals, etc.)
- Lucide React 0.468.0 - Icon library
- Tailwind CSS 4.0.0 - Utility-first CSS framework
- tw-animate-css 1.2.5 - Animation utilities
- class-variance-authority 0.7.1 - Component style variance management
- tailwind-merge 2.6.0 - Tailwind class merging utility
- React Hook Form 7.54.0 - Performant form state management
- @hookform/resolvers 3.9.1 - Schema validation integration
- Zod 3.24.1 - TypeScript-first schema validation
- Recharts 2.15.0 - React charting library for dashboard analytics
- date-fns 4.1.0 - Date manipulation and formatting
- react-day-picker 10.0.1 - Calendar component
- Sonner 1.7.1 - Toast notification library

## Key Dependencies

- next 15.0.0 - Framework backbone; upgrades include React 19 compatibility
- react 19.0.0 - React 19 introduces use() hook and improved SSR
- typescript 5.7.2 - Full type safety across application
- recharts 2.15.0 - Dashboard attendance charts and analytics
- radix-ui 1.6.7 - Accessible components (currently minimal usage, see `components/` directory)
- zod 3.24.1 - Runtime validation for forms and domain models
- tailwindcss 4.0.0 - All visual styling; design tokens in `src/app/globals.css`
- @tailwindcss/postcss 4.0.0 - PostCSS plugin for Tailwind

## Configuration

- No `.env` files detected in development
- Session storage via browser localStorage (`src/lib/auth/session-provider.tsx`)
- Mock configuration in `src/lib/mock/service.ts` with `mockConfig.simulateError` and `mockConfig.latencyMs`
- `tsconfig.json` - TypeScript compilation with strict mode enabled
- `eslint.config.mjs` - ESLint with Next.js core-web-vitals and TypeScript configs
- `postcss.config.mjs` - PostCSS with Tailwind CSS plugin
- `next.config.ts` - Next.js configuration with React strict mode enabled

## Platform Requirements

- Node.js 22.18.0 (or compatible)
- npm 11.10.1 (or compatible package manager)
- Modern browser with ES2020+ support
- Deployment target: Not yet specified (planned: Vercel or similar Next.js hosting)
- Build output: `.next/` directory (Next.js build artifact)
- Static analysis: ESLint validation on lint command

## Scripts



## Conventions

## Naming Patterns

- Component files: kebab-case (e.g., `confirm-dialog.tsx`, `stat-card.tsx`)
- Page files: kebab-case or directory-based routing (e.g., `page.tsx` in `admin/employees/[id]/`)
- Utility/service files: kebab-case (e.g., `use-mock-query.ts`, `format.ts`)
- Type/schema files: named descriptively (e.g., `domain.ts`, `schemas.ts`)
- React components and hooks: PascalCase (e.g., `ConfirmDialog`, `StatCard`, `useMockQuery`)
- Regular utility functions: camelCase (e.g., `formatDate`, `suggestCode`, `toIsoDate`)
- Type predicates and validators: camelCase (e.g., `daysInMonth`, `addDays`)
- Event handlers: `onEventName` pattern (e.g., `onConfirm`, `onOpenChange`, `onSubmit`)
- Constants: UPPER_SNAKE_CASE (e.g., `APP_NAME`, `DEFAULT_TIMEZONE`, `STORAGE_KEY_SESSION`)
- Regular variables: camelCase (e.g., `isLoading`, `submitError`, `defaultValues`)
- Boolean variables: prefix with `is`, `has`, `can`, or `should` (e.g., `isLoading`, `canViewPayslip`, `isPending`)
- Record/mapping objects: UPPER_SNAKE_CASE when constant (e.g., `EMPLOYEE_STATUS_LABEL`, `CONTRACT_TYPE_OPTIONS`)
- TypeScript types and interfaces: PascalCase (e.g., `Employee`, `Department`, `MockQueryResult`)
- Union types for enums: PascalCase (e.g., `EmployeeStatus`, `ContractType`, `RequestStatus`)
- Props interfaces: component name + "Props" pattern (e.g., implicit in destructured props)
- Form value types: `${FormName}Values` or `${FormName}FormValues` (e.g., `LoginFormValues`, `EmployeeFormValues`)

## Code Style

- Tool: ESLint (Next.js config with TypeScript support)
- Config file: `eslint.config.mjs`
- Formatter: Prettier (inferred - not explicitly configured but standard for Next.js projects)
- Line length: No hard limit enforced, but generally kept concise
- Indentation: 2 spaces (standard for Node.js/React)
- Framework: ESLint 9.x with `@eslint/eslintrc`
- Configuration: Extends `next/core-web-vitals` and `next/typescript`
- Ignores: `.next/`, `node_modules/`, `out/`, `next-env.d.ts`
- Command: `npm run lint` - runs `eslint .`
- `strict: true` enabled in `tsconfig.json`
- `noEmit: true` - type checking only, no output
- All files must pass TypeScript type checking
- Command: `npm run typecheck` - runs `tsc --noEmit`

## Import Organization

- Imports are grouped by category with blank lines between groups
- Side effects (like style imports) come last
- Example structure visible in `src/app/layout.tsx` and form components
- Use `@/*` to reference `./src/*` (configured in `tsconfig.json`)
- Always use absolute imports with `@/` prefix instead of relative paths
- Example: `import { Button } from "@/components/ui/button"` not `import { Button } from "../../../components/ui/button"`

## Error Handling

- Try-catch with typed error handling: Check if error is `instanceof Error` to safely access `.message`
- Form submission errors: Store in component state (e.g., `submitError: string | null`)
- Async operations: Use `.catch()` for Promise chains with proper error messaging
- User-facing errors: Convert to Vietnamese strings for immediate UI display
- Data loading errors: Pass error state through query hooks that return `{ data, isLoading, error, reload }`
- Use `toast()` from `sonner` for notifications (e.g., `toast.error("message")`, `toast.success("message")`)
- Use `ErrorState` component for page-level errors with retry option (see `src/components/common/error-state.tsx`)
- Form validation errors: Display via `react-hook-form` field errors with Zod schema messages

## Logging

- No explicit logging library configured (using standard `console.*`)
- Development debugging: Console logs are acceptable
- Production: Rely on browser DevTools for debugging
- No structured logging framework currently in use

## Comments

- Complex algorithm logic: Add comment explaining the "why" not the "what"
- Non-obvious business logic: Explain intent (e.g., date handling to avoid timezone issues in `src/lib/format.ts`)
- Important constraints: Document why something is done a certain way (e.g., ref patterns to prevent stale closures)
- TODO/FIXME: Not found in current codebase - indicates code is relatively stable
- Use JSDoc for public functions and exported utilities
- Comment format: `/** Description */` on single line for simple functions
- Multi-line for complex signatures: Start with description, explain parameters if needed
- Example from `src/lib/format.ts`: `/** "2026-07-27" -> "27/07/2026" */` above `formatDate()`
- Vietnamese comments are acceptable for business logic explanation (seen throughout codebase)
- Use `//` for single-line comments
- Use `/* */` for multi-line comments, but generally prefer JSDoc `/** */`
- Comment code sections with `/* ---------- ... --------- */` separators (visible in schemas and constants)

## Function Design

- Keep functions focused and relatively small (most utilities 10-30 lines)
- Complex form logic can span 100+ lines when unavoidable (e.g., `EmployeeForm`)
- Prefer composition over monolithic functions
- Use object destructuring in parameters for multiple args: `{ param1, param2 }: { param1: Type; param2: Type }`
- React component props: Fully typed via destructuring: `{ prop1, prop2 }: ComponentProps`
- Optional params: Use `?:` in destructuring with defaults (e.g., `confirmLabel = "Xác nhận"`)
- Explicit return types: Functions should declare return type (e.g., `: React.ReactElement`, `: string`, `: Promise<T>`)
- React components: Always return `React.ReactElement`
- Nullable returns: Use `T | null` not `T?` for explicitness
- Async functions: Return `Promise<T>` with proper error handling

## Module Design

- Named exports preferred over default exports (but Next.js pages use default)
- Page components: `export default function PageName() { ... }`
- Utility functions: `export function functionName() { ... }`
- Types: `export type TypeName = ...` or `export interface InterfaceName { ... }`
- Not used in current structure - components export directly from their files
- Each component/utility has its own file (e.g., `src/components/common/button.tsx` not `src/components/index.ts`)
- Separate concerns: UI components in `src/components/`, utilities in `src/lib/`, hooks in `src/hooks/`
- Type-driven design: Types live in dedicated type files (e.g., `src/lib/types/domain.ts`)
- Validation-driven: Schemas co-located in `src/lib/validation/`
- Configuration: Constants in `src/lib/constants.ts`, format utilities in `src/lib/format.ts`

## React-Specific Patterns

- Use `"use client"` directive in client components (required for hooks like `useState`, `useEffect`)
- Functional components only (no class components)
- Props are fully typed via destructuring
- No prop drilling - use context when appropriate (auth context in `src/lib/auth/session-provider.ts`)
- Custom hooks prefixed with `use` (e.g., `useMockQuery`, `useMediaQuery`, `useDebounce`)
- Hook dependencies documented via `// eslint-disable-next-line react-hooks/exhaustive-deps` comments when necessary (see `src/hooks/use-mock-query.ts`)
- Use `React.useRef` to maintain stable references across renders (fetcher refs in query hooks)
- `react-hook-form` with `zodResolver` for validation
- Zod schemas define both validation AND types via `z.infer<typeof schema>`
- Custom error messages in Vietnamese for user display
- Use `Controller` from `react-hook-form` for complex field control
- `useState` for local component state
- `useCallback` for memoized event handlers (e.g., reload functions)
- Context API for shared auth state (no Redux/Zustand in use)
- Mock data store for development (not seen in production code)

## Next.js Specific

- Uses App Router (not Pages Router) with nested layouts
- Layouts in `src/app/[segment]/layout.tsx` for shared structure
- Pages in `src/app/[segment]/page.tsx` or `src/app/[segment]/[id]/page.tsx` for dynamic routes
- Route groups with parentheses (e.g., `(auth)`, `(admin)`) for logical organization without URL segments
- Export `Metadata` type from Next.js for title and description
- Template pattern: `title: { default: "...", template: "%s · APP_NAME" }`
- Applied at layout and page level
- Pages are server components by default
- `"use client"` used in interactive components (forms, charts, interactive cards)
- Server-side rendering for SEO and data fetching at layout level when possible



## Architecture

## System Overview

```text

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

- **Server-first**: Pages are Server Components by default; client logic isolated in View components
- **Context-based state**: No Redux/Zustand; uses React Context for session and data invalidation
- **Mock layer**: All data flows through async mock service (designed to swap Supabase with minimal UI changes)
- **Vietnamese-first**: All labels, error messages, and display logic in Vietnamese; business logic uses English enums
- **Responsive design**: Component-level responsive strategies; desktop-first for admin, mobile-first for employee app
- **Form validation**: React Hook Form + Zod for strongly-typed schema validation

## Layers

- Purpose: Accept requests, render pages with metadata, delegate to View components
- Location: `src/app/`
- Contains: `page.tsx` (Server Components), `layout.tsx` (Server Components)
- Depends on: View components, metadata, TypeScript types
- Used by: Next.js 15 router
- Purpose: Orchestrate business logic, manage client state, coordinate UI rendering and user interactions
- Location: `src/app/**/*-view.tsx`
- Contains: Client-side hooks, state management, event handlers, conditional rendering
- Depends on: Hooks (useMockQuery, useSession), UI components, mock service
- Used by: Pages, which render Views directly
- Patterns:
- Purpose: Render interface elements; no business logic, no data fetching
- Location: `src/components/ui/` (primitives), `src/components/common/` (common composite), domain-specific subdirectories
- Contains: Button, Input, Table, Card, modals, badges, empty states, error states
- Depends on: Tailwind CSS, lucide-react icons, Zod (for form validation)
- Used by: View components
- Purpose: Encapsulate all data operations (queries and mutations)
- Location: `src/lib/mock/service.ts`
- Contains: ~40 async functions (listCompanies, listEmployees, updateEmployee, listAttendance, etc.)
- Depends on: In-memory database (`db.ts`), utility functions
- Used by: useMockQuery hook (in Views)
- Behavior: Each function includes artificial latency (420ms default) to simulate network requests
- Purpose: Provide global context for authentication session and data invalidation
- Location: `src/lib/auth/session-provider.tsx`, `src/lib/mock/store.tsx`
- Session Provider: Wraps localStorage persistence, sign-in/sign-out, company selection
- Mock Data Provider: Tracks version counter; invalidate() increments version, triggering re-fetches in useMockQuery hooks
- Depends on: localStorage API (browser only)
- Used by: Providers.tsx, View components via useSession() / useMockData() hooks
- Purpose: Centralize domain types and UI labels; single source of truth for enums
- Location: `src/lib/types/domain.ts` (types), `src/lib/constants.ts` (labels)
- Domain types: Employee, Company, Department, Shift, AttendanceRecord, WorkRequest (and Query/Input variants)
- Constants: Maps enum values to Vietnamese labels, semantic tones (success/warning/danger), form options
- Used by: Every View, Service, and UI component layer

## Data Flow

### Primary Request Path (Viewing Data)

### Mutation Flow (Create/Update/Delete)

### Session Management

- **Session**: Stored in context + localStorage; flows down via useSession() / useAuthenticatedSession()
- **Data cache**: Not persistent; live in-memory in useMockQuery state
- **Invalidation**: MockDataProvider version counter drives re-fetches across all queries
- **UI state**: Local component state (filters, pagination, dialog visibility) — no shared state

## Key Abstractions

- Purpose: Separate page routing from business logic
- Examples: `src/app/admin/employees/employees-view.tsx`, `src/app/employee/employee-home-view.tsx`
- Pattern: Pages delegate 100% of rendering to -View.tsx; Views own all hooks and state management
- Purpose: Abstract data operations behind Promise-based functions
- Examples: `listEmployees()`, `updateEmployee()`, `createCompany()`
- Pattern: Each function is async, simulates network latency, works with in-memory database
- Design intent: Swap to Supabase/backend by replacing service.ts internals without touching UI
- Purpose: Standardized data fetching pattern with automatic re-fetch on dependency or invalidation changes
- Usage: `const { data, isLoading, error, reload } = useMockQuery(() => fetchData(), [deps...])`
- Pattern: Replaces manual useEffect + useState; depends on MockDataProvider version for invalidation
- Purpose: Provide authenticated user info and sign-out action globally
- Examples: useSession() returns {status, session, signIn, selectCompany, signOut}
- Pattern: Enforced with useAuthenticatedSession() in protected routes; throws if not authenticated

## Entry Points

- Location: `src/app/page.tsx`
- Triggers: Browser requests `/`
- Responsibilities: Server-side redirect to `/login`
- Login: `src/app/(auth)/login/page.tsx` + `login-form.tsx`
- Onboarding: `src/app/(auth)/onboarding/page.tsx` + `onboarding-wizard.tsx`
- Company Selection: `src/app/(auth)/select-company/page.tsx` + `select-company-view.tsx`
- Location: `src/app/admin/dashboard/page.tsx` + `dashboard-view.tsx`
- Triggers: User with admin+ role navigates to `/admin`
- Responsibilities: Render KPIs, attendance charts, today's activity, pending requests
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

### Sharing UI state across routes

### Importing types from service layer

## Error Handling

- useMockQuery returns {data: null, error: string | null}; Views check error and render ErrorState component
- Mock service throws Error with Vietnamese message; useMockQuery catches and stores message
- Forms use Zod schema.parse() for validation; React Hook Form displays errors inline
- Network errors (future Supabase): caught and displayed in toast (sonner) or alert dialog

## Cross-Cutting Concerns


## Quy trình làm việc

Chưa có skill/quy trình nào được cấu hình cho dự án này — tooling GSD đã được gỡ
ngày 2026-08-05. Kế hoạch dự án vẫn nằm ở `.planning/` (ROADMAP.md, REQUIREMENTS.md,
PROJECT.md, STATE.md, phases/) và là nguồn tham chiếu duy nhất cho việc còn lại.

Trạng thái khi gỡ: Phase 1-3 đã xong (24 plan), Phase 4-6 chưa làm. Các việc còn treo
được ghi ở `.planning/STATE.md` mục Blockers/Concerns.
