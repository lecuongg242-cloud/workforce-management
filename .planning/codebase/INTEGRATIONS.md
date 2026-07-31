# External Integrations

**Analysis Date:** 2026-07-31

## APIs & External Services

**Current State:**
- No external APIs integrated yet
- Application is in MVP phase with mock data and local business logic

**Planned Integrations:**
- Comments in `src/lib/mock/db.ts` and `src/lib/mock/service.ts` indicate future Supabase migration

## Data Storage

**Databases:**
- **Current:** In-memory mock database (`src/lib/mock/db.ts`)
  - Stores: Companies, Departments, Shifts, Employees, Attendance Records, Work Requests
  - Persistence: Session-based (resets on page reload; localStorage only for authentication state)
  - ID generation: Sequential counter in `src/lib/mock/db.ts` using `nextId()` function

**Planned:**
- Supabase (PostgreSQL) - referenced in comments as migration target
  - Schema design likely to follow domain types in `src/lib/types/domain.ts`
  - Enum-based columns for `EmployeeStatus`, `ContractType`, `AttendanceStatus`, `RequestType`, `RequestStatus`, `CompanyRole`

**File Storage:**
- Not implemented
- No current avatar/document upload functionality despite `avatarUrl` fields in employee model (`src/lib/types/domain.ts`)

**Caching:**
- Not implemented
- No Redis or similar caching layer
- Mock service layer simulates network latency with configurable `mockConfig.latencyMs` (default: 420ms)

## Authentication & Identity

**Auth Provider:**
- **Current:** Mock localStorage-based session
  - Implementation: `src/lib/auth/session-provider.tsx`
  - Session stored in localStorage with key `STORAGE_KEY_SESSION` (defined in `src/lib/constants.ts`)
  - No password validation; email-based login only for mock

**Planned:**
- Supabase Auth - referenced in session provider comments as replacement

**Session Details:**
- Session structure: `UserSession` type in `src/lib/types/domain.ts`
  - Contains: user object, companyId, role (CompanyRole), signedInAt timestamp
- Multi-company support: User can select company after login (`selectCompany()` function in provider)

## Monitoring & Observability

**Error Tracking:**
- Not implemented
- No Sentry, LogRocket, or similar integration

**Logs:**
- Console-based only
- Mock service has configurable error simulation (`mockConfig.simulateError`)

**Metrics:**
- No analytics or telemetry collection

## CI/CD & Deployment

**Hosting:**
- Not configured
- No Dockerfile or deployment configuration present
- Likely target: Vercel (common for Next.js applications)

**CI Pipeline:**
- Not configured
- No GitHub Actions, GitLab CI, or similar setup
- ESLint and TypeScript checks available locally via npm scripts

## Environment Configuration

**Required env vars:**
- None currently enforced
- Application runs with no external configuration

**Secrets location:**
- No `.env*` files present
- Not applicable for mock phase

## Webhooks & Callbacks

**Incoming:**
- Not implemented
- Attendance check-in/check-out flows are UI-driven, not webhook-driven

**Outgoing:**
- Not implemented
- No notifications to external systems

## API Route Structure

**Current:**
- No API routes implemented
- All business logic in `src/lib/mock/service.ts` (async functions simulating backend)
- Application is frontend-only with mock data

**Planned API Routes:**
- Migration to real backend/Supabase would likely implement routes in `src/app/api/` following Next.js convention

## Domain Model Integration Points

**Key entities with future integration implications:**
- `Company` (`src/lib/types/domain.ts:65-80`) - Multi-tenancy support
- `Employee` - Will need avatar storage (currently just URL field without backend)
- `AttendanceRecord` - Time-series data suitable for Postgres/TimescaleDB optimization
- `WorkRequest` - Workflow engine planned (approval flow with reviewer tracking)

---

*Integration audit: 2026-07-31*
