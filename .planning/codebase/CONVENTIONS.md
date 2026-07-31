# Coding Conventions

**Analysis Date:** 2026-07-31

## Naming Patterns

**Files:**
- Component files: kebab-case (e.g., `confirm-dialog.tsx`, `stat-card.tsx`)
- Page files: kebab-case or directory-based routing (e.g., `page.tsx` in `admin/employees/[id]/`)
- Utility/service files: kebab-case (e.g., `use-mock-query.ts`, `format.ts`)
- Type/schema files: named descriptively (e.g., `domain.ts`, `schemas.ts`)

**Functions:**
- React components and hooks: PascalCase (e.g., `ConfirmDialog`, `StatCard`, `useMockQuery`)
- Regular utility functions: camelCase (e.g., `formatDate`, `suggestCode`, `toIsoDate`)
- Type predicates and validators: camelCase (e.g., `daysInMonth`, `addDays`)
- Event handlers: `onEventName` pattern (e.g., `onConfirm`, `onOpenChange`, `onSubmit`)

**Variables:**
- Constants: UPPER_SNAKE_CASE (e.g., `APP_NAME`, `DEFAULT_TIMEZONE`, `STORAGE_KEY_SESSION`)
- Regular variables: camelCase (e.g., `isLoading`, `submitError`, `defaultValues`)
- Boolean variables: prefix with `is`, `has`, `can`, or `should` (e.g., `isLoading`, `canViewPayslip`, `isPending`)
- Record/mapping objects: UPPER_SNAKE_CASE when constant (e.g., `EMPLOYEE_STATUS_LABEL`, `CONTRACT_TYPE_OPTIONS`)

**Types:**
- TypeScript types and interfaces: PascalCase (e.g., `Employee`, `Department`, `MockQueryResult`)
- Union types for enums: PascalCase (e.g., `EmployeeStatus`, `ContractType`, `RequestStatus`)
- Props interfaces: component name + "Props" pattern (e.g., implicit in destructured props)
- Form value types: `${FormName}Values` or `${FormName}FormValues` (e.g., `LoginFormValues`, `EmployeeFormValues`)

## Code Style

**Formatting:**
- Tool: ESLint (Next.js config with TypeScript support)
- Config file: `eslint.config.mjs`
- Formatter: Prettier (inferred - not explicitly configured but standard for Next.js projects)
- Line length: No hard limit enforced, but generally kept concise
- Indentation: 2 spaces (standard for Node.js/React)

**Linting:**
- Framework: ESLint 9.x with `@eslint/eslintrc`
- Configuration: Extends `next/core-web-vitals` and `next/typescript`
- Ignores: `.next/`, `node_modules/`, `out/`, `next-env.d.ts`
- Command: `npm run lint` - runs `eslint .`

**Strict TypeScript:**
- `strict: true` enabled in `tsconfig.json`
- `noEmit: true` - type checking only, no output
- All files must pass TypeScript type checking
- Command: `npm run typecheck` - runs `tsc --noEmit`

## Import Organization

**Order:**
1. React/Next.js core imports (e.g., `import * as React from "react"`, `import { useRouter } from "next/navigation"`)
2. Third-party library imports (e.g., `import { useForm } from "react-hook-form"`, `import { z } from "zod"`)
3. Local component/utility imports (e.g., `import { Button } from "@/components/ui/button"`)
4. Type imports (e.g., `import type { EmployeeFormValues } from "@/lib/validation/schemas"`)
5. Styles (e.g., `import "./globals.css"`)

**Grouped by blank lines:**
- Imports are grouped by category with blank lines between groups
- Side effects (like style imports) come last
- Example structure visible in `src/app/layout.tsx` and form components

**Path Aliases:**
- Use `@/*` to reference `./src/*` (configured in `tsconfig.json`)
- Always use absolute imports with `@/` prefix instead of relative paths
- Example: `import { Button } from "@/components/ui/button"` not `import { Button } from "../../../components/ui/button"`

## Error Handling

**Patterns:**
- Try-catch with typed error handling: Check if error is `instanceof Error` to safely access `.message`
  - Example in `src/hooks/use-mock-query.ts`: `catch ((cause: unknown) => { ... cause instanceof Error ? cause.message : "Default message" }`
- Form submission errors: Store in component state (e.g., `submitError: string | null`)
- Async operations: Use `.catch()` for Promise chains with proper error messaging
- User-facing errors: Convert to Vietnamese strings for immediate UI display
- Data loading errors: Pass error state through query hooks that return `{ data, isLoading, error, reload }`

**Error Display:**
- Use `toast()` from `sonner` for notifications (e.g., `toast.error("message")`, `toast.success("message")`)
- Use `ErrorState` component for page-level errors with retry option (see `src/components/common/error-state.tsx`)
- Form validation errors: Display via `react-hook-form` field errors with Zod schema messages

## Logging

**Framework:** Console API

**Patterns:**
- No explicit logging library configured (using standard `console.*`)
- Development debugging: Console logs are acceptable
- Production: Rely on browser DevTools for debugging
- No structured logging framework currently in use

## Comments

**When to Comment:**
- Complex algorithm logic: Add comment explaining the "why" not the "what"
- Non-obvious business logic: Explain intent (e.g., date handling to avoid timezone issues in `src/lib/format.ts`)
- Important constraints: Document why something is done a certain way (e.g., ref patterns to prevent stale closures)
- TODO/FIXME: Not found in current codebase - indicates code is relatively stable

**JSDoc/TSDoc:**
- Use JSDoc for public functions and exported utilities
- Comment format: `/** Description */` on single line for simple functions
- Multi-line for complex signatures: Start with description, explain parameters if needed
- Example from `src/lib/format.ts`: `/** "2026-07-27" -> "27/07/2026" */` above `formatDate()`
- Vietnamese comments are acceptable for business logic explanation (seen throughout codebase)

**Comment Style:**
- Use `//` for single-line comments
- Use `/* */` for multi-line comments, but generally prefer JSDoc `/** */`
- Comment code sections with `/* ---------- ... --------- */` separators (visible in schemas and constants)

## Function Design

**Size:** 
- Keep functions focused and relatively small (most utilities 10-30 lines)
- Complex form logic can span 100+ lines when unavoidable (e.g., `EmployeeForm`)
- Prefer composition over monolithic functions

**Parameters:**
- Use object destructuring in parameters for multiple args: `{ param1, param2 }: { param1: Type; param2: Type }`
- React component props: Fully typed via destructuring: `{ prop1, prop2 }: ComponentProps`
- Optional params: Use `?:` in destructuring with defaults (e.g., `confirmLabel = "Xác nhận"`)

**Return Values:**
- Explicit return types: Functions should declare return type (e.g., `: React.ReactElement`, `: string`, `: Promise<T>`)
- React components: Always return `React.ReactElement`
- Nullable returns: Use `T | null` not `T?` for explicitness
- Async functions: Return `Promise<T>` with proper error handling

## Module Design

**Exports:**
- Named exports preferred over default exports (but Next.js pages use default)
- Page components: `export default function PageName() { ... }`
- Utility functions: `export function functionName() { ... }`
- Types: `export type TypeName = ...` or `export interface InterfaceName { ... }`

**Barrel Files:**
- Not used in current structure - components export directly from their files
- Each component/utility has its own file (e.g., `src/components/common/button.tsx` not `src/components/index.ts`)

**Module Organization:**
- Separate concerns: UI components in `src/components/`, utilities in `src/lib/`, hooks in `src/hooks/`
- Type-driven design: Types live in dedicated type files (e.g., `src/lib/types/domain.ts`)
- Validation-driven: Schemas co-located in `src/lib/validation/`
- Configuration: Constants in `src/lib/constants.ts`, format utilities in `src/lib/format.ts`

## React-Specific Patterns

**Component Structure:**
- Use `"use client"` directive in client components (required for hooks like `useState`, `useEffect`)
- Functional components only (no class components)
- Props are fully typed via destructuring
- No prop drilling - use context when appropriate (auth context in `src/lib/auth/session-provider.ts`)

**Hooks:**
- Custom hooks prefixed with `use` (e.g., `useMockQuery`, `useMediaQuery`, `useDebounce`)
- Hook dependencies documented via `// eslint-disable-next-line react-hooks/exhaustive-deps` comments when necessary (see `src/hooks/use-mock-query.ts`)
- Use `React.useRef` to maintain stable references across renders (fetcher refs in query hooks)

**Form Handling:**
- `react-hook-form` with `zodResolver` for validation
- Zod schemas define both validation AND types via `z.infer<typeof schema>`
- Custom error messages in Vietnamese for user display
- Use `Controller` from `react-hook-form` for complex field control

**State Management:**
- `useState` for local component state
- `useCallback` for memoized event handlers (e.g., reload functions)
- Context API for shared auth state (no Redux/Zustand in use)
- Mock data store for development (not seen in production code)

## Next.js Specific

**App Router:**
- Uses App Router (not Pages Router) with nested layouts
- Layouts in `src/app/[segment]/layout.tsx` for shared structure
- Pages in `src/app/[segment]/page.tsx` or `src/app/[segment]/[id]/page.tsx` for dynamic routes
- Route groups with parentheses (e.g., `(auth)`, `(admin)`) for logical organization without URL segments

**Metadata:**
- Export `Metadata` type from Next.js for title and description
- Template pattern: `title: { default: "...", template: "%s · APP_NAME" }`
- Applied at layout and page level

**Server/Client Boundaries:**
- Pages are server components by default
- `"use client"` used in interactive components (forms, charts, interactive cards)
- Server-side rendering for SEO and data fetching at layout level when possible

---

*Convention analysis: 2026-07-31*
