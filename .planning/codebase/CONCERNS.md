# Codebase Concerns

**Analysis Date:** 2026-07-31

## Tech Debt

**Hardcoded Credentials in Login Form:**
- Issue: Default login credentials are hardcoded in the form component
- Files: `src/app/(auth)/login/login-form.tsx` (lines 34-37)
  ```typescript
  defaultValues: {
    email: "quan.nguyen@ngocphat.vn",
    password: "timeflow2026",
    remember: true,
  },
  ```
- Impact: Security risk; credentials visible in source code and git history. Must be removed before production.
- Fix approach: Remove hardcoded credentials. Implement proper authentication backend or use environment-based demo credentials if needed.

**In-Memory Database Without Persistence:**
- Issue: All application data stored in a module-level variable in `src/lib/mock/db.ts` (line 144)
- Files: `src/lib/mock/db.ts`
- Impact: All data is lost on page refresh or browser close. No data consistency across sessions or multiple browsers. Makes the app unsuitable for real use.
- Fix approach: Implement proper backend with Supabase or similar. Migrate mock service layer to real API calls as noted in `src/lib/mock/service.ts` comments (lines 36-41).

**Vietnamese Comments Throughout Codebase:**
- Issue: All significant code comments are in Vietnamese
- Files: Affects maintenance across `src/lib/`, `src/app/`, `src/components/`
- Impact: Reduces accessibility for non-Vietnamese developers; harder to onboard new team members who don't speak Vietnamese
- Fix approach: Gradually convert comments to English or provide translation layer. Use English for all new code.

**Clone Function Using JSON Serialization:**
- Issue: Data cloning via `JSON.parse(JSON.stringify(value))` in `src/lib/mock/service.ts` (line 64)
- Files: `src/lib/mock/service.ts`
- Impact: Fails with non-serializable values (functions, Map, Set, circular references, undefined, symbols); creates performance overhead on every query
- Fix approach: Use a proper library (e.g., `structuredClone`) or implement shallow copy when switching to real backend

## Known Bugs

**Forgot Password Link Points to Wrong Route:**
- Symptoms: User clicks "Quên mật khẩu?" link, no functionality
- Files: `src/app/(auth)/login/login-form.tsx` (line 119)
- Trigger: Any user on login page clicking the password recovery link
- Workaround: Feature not yet implemented; users cannot reset passwords

**Missing CheckOut Time Calculation Error Boundary:**
- Symptoms: If shift record missing or checkIn is null, workedMinutes calculation may be incorrect
- Files: `src/lib/mock/service.ts` (lines 441-463)
- Trigger: Checking out without checking in first, or corrupted attendance data
- Workaround: None; UI prevents checkout without checkin, but no validation in service layer

## Security Considerations

**Session Stored in Unencrypted LocalStorage:**
- Risk: Session data (user ID, company ID, role) stored plaintext in localStorage
- Files: `src/lib/auth/session-provider.tsx` (lines 43-50)
- Current mitigation: Client-side only; no real backend authentication yet
- Recommendations: 
  - Implement secure session management with httpOnly cookies
  - Add session expiration
  - Validate session server-side once backend is in place
  - Never store sensitive data in localStorage

**No Role-Based Access Control at API Level:**
- Risk: All access control is client-side only. No server-side authorization checks
- Files: All mock service functions in `src/lib/mock/service.ts` bypass authorization
- Current mitigation: Routes are protected client-side via `AdminShell` and `EmployeeShell`
- Recommendations:
  - Implement server-side authorization checks once backend exists
  - Add role checks in API route handlers
  - Use middleware to enforce access control

**No Input Validation on Service Layer:**
- Risk: Mock service functions accept user input without additional server-side validation
- Files: Functions like `createEmployee()`, `updateEmployee()` in `src/lib/mock/service.ts`
- Current mitigation: Zod schemas validate client-side before calling service
- Recommendations:
  - Validate again at service/API layer
  - Never trust client-side validation alone
  - Add SQL injection protection once using real database

**Default Authentication Works for All Users:**
- Risk: One hardcoded user can access all companies and roles
- Files: `src/lib/auth/session-provider.tsx` (lines 67-84)
- Current mitigation: Demo only; not production code
- Recommendations: Implement proper multi-tenant authentication with role separation

## Performance Bottlenecks

**Large Component Files Reducing Readability:**
- Problem: Several components exceed 600+ lines, making them difficult to maintain and test
- Files: 
  - `src/lib/mock/seed.ts` (1285 lines) - test data generation
  - `src/app/(auth)/onboarding/onboarding-wizard.tsx` (705 lines) - multi-step form
  - `src/lib/mock/service.ts` (668 lines) - mock API layer
  - `src/app/admin/employees/[id]/employee-detail-view.tsx` (667 lines) - detail page
- Cause: All logic combined in single component; no composition
- Improvement path:
  - Extract form steps into separate sub-components
  - Break employee-detail-view into smaller sections (header, tabs, modals)
  - Extract mock data generation into smaller seed modules

**JSON Clone on Every Query:**
- Problem: All mock service responses call `clone()` which does `JSON.parse(JSON.stringify())` on potentially large objects
- Files: `src/lib/mock/service.ts` (repeated throughout)
- Cause: Attempting to prevent accidental mutations of in-memory data
- Improvement path: Use Object.freeze or proper immutability library; or optimize cloning strategy when migrating to real backend

**Attendance History Built Per Request:**
- Problem: `buildMonthlyHistory()` in `src/lib/mock/db.ts` re-calculates attendance patterns on every initialization
- Files: `src/lib/mock/db.ts` (lines 60-117)
- Cause: Deterministic pattern generation for consistency
- Improvement path: Pre-generate seed data or cache results

## Fragile Areas

**Session Context Throwback on Missing Provider:**
- Files: `src/lib/auth/session-provider.tsx` (lines 120-126)
- Why fragile: If `useSession()` called outside SessionProvider, throws error but recovery is unclear
- Safe modification: Always wrap layouts with `SessionProvider` (already done correctly); but error message could be clearer
- Test coverage: No tests for missing provider scenario

**Date Calculations Rely on String Format:**
- Files: `src/lib/format.ts`
- Why fragile: Any deviation from "YYYY-MM-DD" format breaks all calculations; no validation that strings match format
- Safe modification: Add format validation in getWeekday, addDays functions; add error boundaries
- Test coverage: No unit tests for date edge cases (leap years, month boundaries, timezone issues)

**Mock Data Store Version Counter:**
- Files: `src/lib/mock/store.tsx`
- Why fragile: Simple number increment for cache invalidation; if multiple invalidations happen synchronously, may miss updates
- Safe modification: Use timestamp or UUID for version; add queue for pending invalidations
- Test coverage: No concurrent access tests

**Employee Code Suggestion Using Math.max:**
- Files: `src/components/employees/employee-form.tsx` (lines 46-52)
- Why fragile: If employee codes are non-numeric or missing, suggestions may collide or be invalid
- Safe modification: Add validation that extracted numbers are valid; generate UUIDs if needed
- Test coverage: No tests for edge cases (no employees, special characters in codes)

## Scaling Limits

**In-Memory Database:**
- Current capacity: ~50 seed records across all tables
- Limit: Breaks at ~10,000+ records due to memory and performance
- Scaling path: Migrate to proper database (Supabase PostgreSQL recommended based on comments in code)

**Session Stored in Browser LocalStorage:**
- Current capacity: Typically 5-10MB per domain
- Limit: Not a concern for single session, but problematic for caching user data
- Scaling path: Use server-side session storage with encrypted cookies

## Dependencies at Risk

**Next.js 15.0.0 (Recent Major Version):**
- Risk: Very recent release; potential stability issues; API may change
- Impact: Dependencies or patterns may need updates
- Migration plan: Consider pinning to stable LTS version (14.x) or stay on 15.x with careful update monitoring

**No Testing Framework Installed:**
- Risk: No Jest, Vitest, or other test runner configured
- Impact: Cannot write or run unit/integration/E2E tests
- Migration plan: Install and configure Vitest or Jest; add test scripts to package.json

**No Database ORM:**
- Risk: Raw SQL queries once backend exists; no type safety
- Impact: Prone to SQL injection, type mismatches
- Migration plan: Add Prisma, TypeORM, or Drizzle once backend database is set up

## Missing Critical Features

**No Actual Authentication:**
- Problem: Login doesn't validate credentials; no real user database
- Blocks: Production deployment, multi-user support, security
- Impact: Major blocker for MVP release

**No Backend API:**
- Problem: Entire system uses mock in-memory data
- Blocks: Data persistence, multi-session support, scalability
- Impact: Complete rewrite of service layer needed

**No Testing Suite:**
- Problem: Zero automated tests in source
- Blocks: Confidence in refactoring, regression detection
- Impact: Quality risk as features grow

**No Export/Import Data Functionality:**
- Problem: No way to backup or migrate data
- Blocks: Data safety, migration to real database
- Impact: Users cannot preserve their setup

**Password Reset Flow Not Implemented:**
- Problem: UI shows "Quên mật khẩu?" link but functionality is missing
- Blocks: Users who forget credentials cannot recover access
- Impact: UX regression

## Test Coverage Gaps

**Zero Test Files in Source:**
- What's not tested: All business logic in `src/lib/`, all components in `src/components/`, all views in `src/app/`
- Files: Entire `src/` directory
- Risk: 
  - Date calculations in `src/lib/format.ts` may have edge cases (DST, leap years, timezone boundaries)
  - Employee code generation may collide or fail with certain inputs
  - Attendance calculations may be incorrect for overnight shifts
  - Form validation may accept invalid states
- Priority: **High** - Foundation must be solid before adding features

**No Integration Tests:**
- What's not tested: Mock service layer interactions; multi-step flows; error scenarios
- Files: No tests for `src/lib/mock/service.ts`, `src/lib/mock/store.tsx`, `src/hooks/use-mock-query.ts`
- Risk: Refactoring service layer could break multiple features without detection
- Priority: **High** - Service layer is core to entire app

**No E2E Tests:**
- What's not tested: User workflows; login → company selection → employee management; attendance check-in/out flow
- Files: No test files
- Risk: User-facing bugs discovered only in production
- Priority: **Medium** - Important but less critical than unit/integration tests initially

**No Error Scenario Tests:**
- What's not tested: Network failures (simulated by `mockConfig.simulateError`), missing records, invalid input
- Files: No tests for error paths in `src/lib/mock/service.ts` (guard function)
- Risk: Error messages may not display correctly, UI may crash on errors
- Priority: **Medium** - Error handling is important for UX

---

*Concerns audit: 2026-07-31*
