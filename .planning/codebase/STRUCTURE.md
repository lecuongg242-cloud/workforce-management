# Codebase Structure

**Analysis Date:** 2026-07-31

## Directory Layout

```
workforce-management/
├── .claude/                # Claude Code project configuration
├── .git/                   # Git repository
├── .next/                  # Next.js build output
├── .planning/              # GSD workflow planning and codebase maps
├── node_modules/           # Dependencies
├── public/                 # Static assets (if any)
├── src/                    # Source code (see below)
├── docs/                   # Documentation
├── .gitignore              # Git ignore rules
├── .env.local              # Environment variables (local; not committed)
├── components.json         # shadcn/ui config
├── eslint.config.mjs       # ESLint configuration
├── next.config.ts          # Next.js configuration
├── next-env.d.ts           # TypeScript declaration for Next.js
├── package.json            # Dependencies and scripts
├── package-lock.json       # Dependency lock file
├── postcss.config.mjs      # PostCSS config for Tailwind
├── README.md               # Project overview
├── tsconfig.json           # TypeScript configuration
└── tailwind.config.ts      # Tailwind CSS configuration (implicit via @theme in globals.css)

src/
├── app/                    # Next.js 15 App Router
│   ├── (auth)/             # Route group: login, onboarding, company selection
│   │   ├── layout.tsx      # Auth layout (no sidebar, split-screen styling)
│   │   ├── login/
│   │   │   ├── page.tsx    # Route handler
│   │   │   └── login-form.tsx   # Client form component
│   │   ├── onboarding/
│   │   │   ├── page.tsx    # Route handler
│   │   │   └── onboarding-wizard.tsx   # Multi-step wizard
│   │   └── select-company/
│   │       ├── page.tsx    # Route handler
│   │       └── select-company-view.tsx # Client view
│   │
│   ├── admin/              # Admin/management application
│   │   ├── layout.tsx      # Admin shell: sidebar + topbar + main
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   └── dashboard-view.tsx  # KPI, charts, today activity
│   │   ├── employees/
│   │   │   ├── page.tsx
│   │   │   ├── employees-view.tsx  # List, search, filter, paginate
│   │   │   ├── loading.tsx   # Skeleton UI while loading
│   │   │   ├── new/
│   │   │   │   ├── page.tsx
│   │   │   │   └── new-employee-view.tsx  # Create employee form
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── employee-detail-view.tsx  # Employee profile with tabs
│   │   ├── departments/
│   │   │   ├── page.tsx
│   │   │   └── departments-view.tsx  # Department management
│   │   └── shifts/
│   │       ├── page.tsx
│   │       └── shifts-view.tsx  # Shift configuration
│   │
│   ├── employee/           # Employee self-service app (mobile-first)
│   │   ├── layout.tsx      # Employee shell: bottom nav + main
│   │   ├── page.tsx        # Home: check in/out, today's summary
│   │   ├── employee-home-view.tsx  # Check-in UI, quick actions
│   │   ├── history/
│   │   │   ├── page.tsx
│   │   │   └── history-view.tsx  # Monthly attendance history
│   │   ├── requests/
│   │   │   ├── page.tsx
│   │   │   └── requests-view.tsx  # Leave/overtime requests
│   │   └── profile/
│   │       ├── page.tsx
│   │       └── profile-view.tsx  # Personal info, settings
│   │
│   ├── page.tsx            # Root route (redirects to /login)
│   ├── layout.tsx          # Root layout: html, body, Providers wrapper
│   ├── globals.css         # Global styles, Tailwind directives, design tokens
│   └── providers.tsx       # Context provider tree (SessionProvider, MockDataProvider, TooltipProvider)
│
├── components/             # React components (no business logic)
│   ├── ui/                 # Primitives (shadcn/ui, modified)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx        # React Hook Form integration
│   │   ├── skeleton.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── select.tsx      # Combobox
│   │   ├── checkbox.tsx
│   │   ├── sonner.tsx      # Toast notifications
│   │   └── ... (26 total)
│   │
│   ├── brand/              # Brand-specific visual components
│   │   ├── app-logo.tsx    # TimeFlow logo
│   │   ├── gradient-mesh.tsx  # Animated gradient background
│   │   └── dashboard-mockup.tsx
│   │
│   ├── common/             # Composite components used across features
│   │   ├── stat-card.tsx   # KPI display
│   │   ├── status-badge.tsx  # Status indicator (on_time, late, etc.)
│   │   ├── employee-avatar.tsx
│   │   ├── empty-state.tsx  # "No data" state
│   │   ├── error-state.tsx  # "Error fetching" state
│   │   ├── confirm-dialog.tsx  # Yes/No confirmation
│   │   ├── data-table-skeleton.tsx  # Loading skeleton for tables
│   │   ├── search-input.tsx  # Debounced search field
│   │   ├── filter-bar.tsx  # Multi-filter control
│   │   ├── date-range-picker.tsx  # Date selection UI
│   │   └── ... (others)
│   │
│   ├── layout/             # Layout components
│   │   ├── admin-shell.tsx  # Sidebar + topbar + protected routing
│   │   ├── admin-sidebar.tsx  # Navigation + company selector
│   │   ├── admin-topbar.tsx  # Top bar with company dropdown, avatar menu
│   │   ├── page-header.tsx  # Page title + metadata
│   │   ├── mobile-bottom-nav.tsx  # Employee app bottom tab bar
│   │   └── ... (others)
│   │
│   ├── forms/              # Form sub-components
│   │   ├── form-section.tsx  # Grouped form inputs
│   │   ├── sticky-form-actions.tsx  # Fixed button bar at bottom
│   │   └── field.tsx  # Reusable form field wrapper
│   │
│   ├── dashboard/          # Admin dashboard components
│   │   ├── attendance-chart.tsx  # 7-day line/bar chart (Recharts)
│   │   ├── today-activity.tsx  # Today's check-ins table
│   │   ├── not-checked-in-card.tsx  # Employees who haven't checked in
│   │   └── pending-requests-card.tsx  # Approval queue summary
│   │
│   ├── employees/          # Employee management components
│   │   ├── employee-table.tsx  # Desktop list view
│   │   ├── employee-mobile-card.tsx  # Mobile card view
│   │   ├── employee-row-actions.tsx  # Bulk actions menu
│   │   ├── pagination-bar.tsx  # Page size and navigation
│   │   ├── move-department-dialog.tsx  # Bulk transfer dialog
│   │   └── ... (others)
│   │
│   ├── departments/        # Department management components
│   │   └── department-table.tsx  # Department list
│   │
│   ├── shifts/             # Shift configuration components
│   │   ├── shift-form.tsx  # Create/edit shift
│   │   └── shift-table.tsx
│   │
│   └── employee-app/       # Employee self-service UI
│       ├── check-in-button.tsx
│       ├── monthly-summary-card.tsx
│       ├── status-display.tsx
│       └── ... (others)
│
├── hooks/                  # Custom React hooks
│   ├── use-mock-query.ts   # Data fetching hook with invalidation support
│   ├── use-debounce.ts     # Debounced value hook
│   ├── use-media-query.ts  # Responsive design hook
│   └── ... (others)
│
└── lib/                    # Utilities, types, services, auth
    ├── types/
    │   └── domain.ts       # All TypeScript interfaces and enums (Company, Employee, Department, Shift, AttendanceRecord, WorkRequest, etc.)
    │
    ├── constants.ts        # Labels, options, display formats (Vietnamese)
    │                       # EMPLOYEE_STATUS_LABEL, CONTRACT_TYPE_LABEL, ATTENDANCE_STATUS_LABEL, etc.
    │
    ├── format.ts           # Date/time/currency formatting utilities
    │                       # formatDate(), formatTime(), formatCurrency(), normalizeText(), etc.
    │
    ├── utils.ts            # Miscellaneous utilities (classname merge, etc.)
    │
    ├── nav.ts              # Navigation metadata (sidebar links, breadcrumbs)
    │
    ├── mock/               # Mock data layer (will be replaced by real backend)
    │   ├── db.ts           # In-memory database with seed data
    │   ├── seed.ts         # Initial seed data (companies, employees, etc.)
    │   ├── service.ts      # Mock API layer (~40 async functions)
    │   └── store.tsx       # MockDataProvider context (invalidation mechanism)
    │
    ├── auth/               # Authentication layer
    │   └── session-provider.tsx  # SessionProvider context, useSession() hook
    │
    └── validation/         # Form validation
        └── schemas.ts      # Zod schemas for employee input, company input, etc.
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router route definition
- Contains: Page files, layouts, metadata
- Key files: `page.tsx` (route handler), `layout.tsx` (nested layouts), `loading.tsx` (skeleton UI)
- Route groups `(auth)`, `admin`, `employee` organize routes by feature area

**`src/components/`:**
- Purpose: Reusable React components
- Contains: No business logic, no data fetching, pure UI
- Organization: By category (ui, brand, common, layout, forms) and domain (dashboard, employees, departments, shifts, employee-app)
- Styling: Tailwind CSS classes, shadcn/ui patterns

**`src/hooks/`:**
- Purpose: Custom React hooks encapsulating stateful logic
- Contains: useMockQuery (data fetching), useDebounce (input debouncing), useMediaQuery (responsive design)
- Pattern: Hooks are reusable; Views call them to manage state and side effects

**`src/lib/`:**
- Purpose: Shared utilities, types, business logic, authentication
- Subdirectories:
  - `types/`: All TypeScript domain types
  - `mock/`: Data layer (will migrate to real backend)
  - `auth/`: Session management
  - `validation/`: Zod schemas
- Files: constants (labels, options), format (utilities), utils (helpers), nav (routes)

## Key File Locations

**Entry Points:**
- Root route: `src/app/page.tsx` (redirects to /login)
- Login: `src/app/(auth)/login/page.tsx`
- Admin dashboard: `src/app/admin/dashboard/page.tsx`
- Employee home: `src/app/employee/page.tsx`

**Configuration:**
- TypeScript: `tsconfig.json`
- Next.js: `next.config.ts`
- Tailwind: `src/app/globals.css` (design tokens in @theme block)
- ESLint: `eslint.config.mjs`
- shadcn/ui: `components.json`

**Core Logic:**
- Mock service: `src/lib/mock/service.ts`
- Mock database: `src/lib/mock/db.ts`
- Domain types: `src/lib/types/domain.ts`
- Constants: `src/lib/constants.ts`
- Session provider: `src/lib/auth/session-provider.tsx`
- Data fetching hook: `src/hooks/use-mock-query.ts`

**Testing:**
- No test files present in current codebase (tests not yet implemented)

## Naming Conventions

**Files:**
- Pages: `page.tsx`
- Views (client-side containers): `*-view.tsx` (e.g., `employees-view.tsx`, `dashboard-view.tsx`)
- Components: `*.tsx` (e.g., `employee-table.tsx`, `status-badge.tsx`)
- Type definitions: `domain.ts`, `*.ts` for types
- Utilities: `*.ts` (e.g., `format.ts`, `utils.ts`)

**Directories:**
- Features organized by domain: `employees/`, `departments/`, `shifts/`, `dashboard/`
- Authentication: `(auth)` route group
- Admin area: `admin/` route group
- Employee area: `employee/` route group

**React Components:**
- Functional components with PascalCase names (e.g., `EmployeeTable`, `StatusBadge`)
- Exports: `export function ComponentName() { ... }`
- No class components in current codebase

**Variables & Functions:**
- camelCase for variables and functions (e.g., `isLoading`, `departmentId`, `handleSignOut`)
- UPPER_SNAKE_CASE for constants (e.g., `DEFAULT_PAGE_SIZE`, `REFERENCE_DATE`)
- Vietnamese names avoided in code; English with Vietnamese labels in constants

## Where to Add New Code

**New Feature (e.g., Payroll Management):**
- **Primary code:**
  - Route: `src/app/admin/payroll/` (create new directory)
  - Page: `src/app/admin/payroll/page.tsx`
  - View: `src/app/admin/payroll/payroll-view.tsx`
  - Components: `src/components/payroll/` (create subdirectory for domain-specific UI)
- **Tests:** `src/app/admin/payroll/*.test.tsx` (co-located with components)
- **Types:** Add new interfaces to `src/lib/types/domain.ts`
- **Service:** Add new functions to `src/lib/mock/service.ts` (listPayrolls, createPayroll, etc.)

**New Component/Module:**
- **Shared UI component:** `src/components/common/` (if used across multiple features)
- **Feature-specific component:** `src/components/[feature]/` subdirectory
- **Utility hook:** `src/hooks/use-*.ts`
- **Utility function:** `src/lib/utils.ts` or `src/lib/format.ts`

**Utilities & Helpers:**
- **Shared helpers:** `src/lib/utils.ts`
- **Date/format utilities:** `src/lib/format.ts`
- **Navigation config:** `src/lib/nav.ts`

**New Route:**
- Add directory in `src/app/` following Next.js conventions
- Create `page.tsx` for the route handler (Server Component)
- Create corresponding View component (`*-view.tsx` as Client Component)
- Link from navigation (sidebar or bottom nav) via `src/lib/nav.ts`

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD workflow codebase maps and analysis documents
- Generated: Automatically by `/gsd-map-codebase` command
- Committed: Yes (reviewed as documentation)

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (npm run build)
- Committed: No (.gitignore)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (npm install)
- Committed: No (.gitignore)

**`public/`:**
- Purpose: Static assets (images, fonts, etc.)
- Generated: No (manually placed)
- Committed: Yes

**`src/app/globals.css`:**
- Purpose: Global Tailwind directives, design tokens
- Key content: @theme block with CSS variables for colors, spacing, etc.
- Used by: All components via Tailwind class names

## Tailwind & Design System

- **Tailwind version:** v4
- **Token source:** `src/app/globals.css` (@theme block)
- **Token types:** Colors (indigo, navy, ruby, cream), spacing, border radius, shadows
- **Design conventions:**
  - Indigo (#533afd) reserved for primary CTA button in each section
  - Navy (#1c1e54) for admin sidebar
  - Card border-radius: 12px; modal: 16px; input: 6px
  - Heading weight 300 with negative letter-spacing
  - Tabular numbers for numeric fields (.num class)

---

*Structure analysis: 2026-07-31*
