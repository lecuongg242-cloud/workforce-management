# Testing Patterns

**Analysis Date:** 2026-07-31

## Test Framework

**Current Status:** No test framework currently configured or in use.

**Runner:**
- Not detected
- Candidates for future use: Jest (common with Next.js), Vitest (faster alternative)
- No test configuration files found (`jest.config.*`, `vitest.config.*`)

**Assertion Library:**
- Not applicable (no tests currently written)

**Run Commands:**
```bash
# Not configured yet
# Future recommendations:
# npm run test              # Run all tests
# npm run test:watch       # Watch mode
# npm run test:coverage    # Coverage report
```

## Test File Organization

**Location:**
- No test files currently exist
- Recommended pattern: Co-located tests next to source files
- Alternative structure: Separate `__tests__` directories or `*.test.ts` suffix

**Naming:**
- Recommended pattern: `ComponentName.test.tsx` or `ComponentName.spec.tsx`
- Example structure would be:
  - `src/components/common/button.test.tsx` next to `src/components/common/button.tsx`
  - `src/lib/format.test.ts` next to `src/lib/format.ts`
  - `src/hooks/use-mock-query.test.ts` next to `src/hooks/use-mock-query.ts`

**Structure:**
```
src/
├── components/
│   └── common/
│       ├── button.tsx
│       └── button.test.tsx         # Co-located test
├── lib/
│   ├── format.ts
│   ├── format.test.ts              # Co-located test
│   └── validation/
│       ├── schemas.ts
│       └── schemas.test.ts          # Co-located test
└── hooks/
    ├── use-mock-query.ts
    └── use-mock-query.test.ts       # Co-located test
```

## Test Structure

**Suite Organization:**
No existing tests to reference. Recommended pattern based on codebase structure:

```typescript
// Example: src/lib/format.test.ts
import { describe, it, expect } from "vitest"; // or Jest
import { formatDate, addDays, toIsoDate } from "./format";

describe("Date formatting utilities", () => {
  describe("formatDate", () => {
    it("should convert ISO date to DD/MM/YYYY format", () => {
      expect(formatDate("2026-07-27")).toBe("27/07/2026");
    });

    it("should handle invalid dates gracefully", () => {
      expect(formatDate("invalid")).toBe("invalid");
    });
  });

  describe("addDays", () => {
    it("should add days to an ISO date", () => {
      expect(addDays("2026-07-27", 5)).toBe("2026-08-01");
    });
  });
});
```

**Patterns:**
- Use `describe()` to group related tests by function or component
- Use `it()` for individual test cases with descriptive names
- Setup/teardown: Use `beforeEach()` and `afterEach()` for test isolation
- Assertion pattern: `expect(actual).toBe(expected)`

## Mocking

**Framework:** Not configured

**Recommended Approach:**
- For React Hook Form: Mock with `jest.mock()` or create test doubles
- For external services: Mock `fetch` or axios calls
- For Zod validation: Test schema separately without mocking

**Patterns:**
```typescript
// Example: Mocking react-hook-form
jest.mock("react-hook-form", () => ({
  useForm: () => ({
    register: jest.fn(),
    handleSubmit: jest.fn((cb) => cb),
    formState: { errors: {} },
    watch: jest.fn(),
  }),
}));

// Example: Mocking async service
jest.mock("@/lib/mock/service", () => ({
  listEmployees: jest.fn().mockResolvedValue([
    { id: "1", fullName: "Test User", ... }
  ]),
}));
```

**What to Mock:**
- External API calls and services
- Heavy computations
- Date/time (use a fixed reference date matching project's `REFERENCE_DATE`)
- Random number generation
- Browser APIs (localStorage, fetch)

**What NOT to Mock:**
- Core React hooks (`useState`, `useEffect`)
- React Router (`useRouter` can be mocked lightly)
- Zod validation (test directly)
- Utility functions being tested (only test their real behavior)
- UI components in integration tests

## Fixtures and Factories

**Test Data:**
No fixtures currently established. Recommended approach:

```typescript
// Example: src/lib/__tests__/fixtures.ts
export const mockEmployee = {
  id: "emp-001",
  fullName: "Nguyễn Văn A",
  code: "NV001",
  email: "a.nguyen@company.vn",
  phone: "0912345678",
  dateOfBirth: "1990-01-15",
  gender: "male" as const,
  departmentId: "dept-001",
  position: "Software Engineer",
  contractType: "full_time" as const,
  startDate: "2026-01-01",
  shiftId: "shift-001",
  workLocation: "Văn phòng chính",
  status: "active" as const,
  systemRole: "employee" as const,
  avatarUrl: null,
  managerId: null,
  invitationSent: false,
  canViewPayslip: true,
  canCheckInRemotely: false,
};

// Factory for creating variations
export function createEmployee(overrides: Partial<typeof mockEmployee>) {
  return { ...mockEmployee, ...overrides };
}
```

**Location:**
- Create `src/__tests__/fixtures.ts` or `src/__tests__/factories.ts`
- Organize by domain model (e.g., `mockEmployee`, `mockDepartment`, `mockShift`)
- Update fixtures when domain types change (co-locate with type definitions)

## Coverage

**Requirements:** Not enforced

**Recommended Targets:**
- Utility functions: 100% coverage (e.g., `src/lib/format.ts`, `src/lib/validation/schemas.ts`)
- React components: 70%+ coverage of user interactions
- Hooks: 80%+ coverage of state changes
- Overall project target: 60%+

**View Coverage:**
```bash
# Jest
npm run test:coverage
# Results in: coverage/index.html

# Vitest
npm run test:coverage
# Results in: coverage/index.html (configurable)
```

## Test Types

**Unit Tests:**
- **Scope:** Individual functions, hooks, components in isolation
- **Approach:** Test inputs and outputs, mock dependencies
- **Examples:**
  - Utility functions: `formatDate()`, `addDays()`, `daysInMonth()`
  - Custom hooks: `useMockQuery()`, `useMediaQuery()`, `useDebounce()`
  - Validation: Zod schemas validate correctly
  - Selectors: Record/mapping objects return expected values

**Integration Tests:**
- **Scope:** Multiple units working together (e.g., form submission flow)
- **Approach:** Mock services/API, test user interactions
- **Examples:**
  - Form submission with validation and error display
  - Data loading and error handling flow
  - Page renders with correct data from multiple hooks

**E2E Tests:**
- **Framework:** Not used currently
- **Recommended:** Consider Playwright or Cypress for critical flows
- **Scope:** Full user journeys (login, create employee, submit request)
- **When to use:** After stabilizing core functionality

## Common Patterns

**Async Testing:**
```typescript
// Vitest/Jest pattern
it("should load data on mount", async () => {
  const { result } = renderHook(() => useMockQuery(fetcher, deps));
  
  expect(result.current.isLoading).toBe(true);
  
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeDefined();
  });
});

// Or with mocked promises
it("should handle loading state", async () => {
  const fetcher = jest.fn().mockResolvedValueOnce({ /* data */ });
  // ... test
  await expect(fetcher).toHaveBeenCalled();
});
```

**Error Testing:**
```typescript
it("should display error when fetch fails", async () => {
  const { result } = renderHook(() => 
    useMockQuery(
      () => Promise.reject(new Error("Network error")),
      []
    )
  );
  
  await waitFor(() => {
    expect(result.current.error).toBe("Network error");
  });
});

// Testing form validation errors
it("should show validation errors for empty required fields", () => {
  const schema = loginSchema;
  const result = schema.safeParse({ email: "", password: "" });
  
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.flatten().fieldErrors.email).toBeDefined();
  }
});
```

**Testing React Hook Form:**
```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("should submit form with valid data", async () => {
  const handleSubmit = jest.fn();
  render(<LoginForm onSubmit={handleSubmit} />);
  
  await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
  await userEvent.type(screen.getByLabelText(/password/i), "password123");
  
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  
  await waitFor(() => {
    expect(handleSubmit).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });
});
```

## Setup Recommendations for Implementation

**When adding tests to this project:**

1. **Install testing framework:**
   ```bash
   npm install --save-dev vitest @vitest/ui
   npm install --save-dev @testing-library/react @testing-library/jest-dom
   npm install --save-dev jsdom
   ```

2. **Create `vitest.config.ts`:**
   ```typescript
   import { defineConfig } from "vitest/config";
   import react from "@vitejs/plugin-react";
   
   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: "jsdom",
       setupFiles: ["./src/__tests__/setup.ts"],
       coverage: {
         provider: "v8",
         reporter: ["text", "json", "html"],
       },
     },
   });
   ```

3. **Create `src/__tests__/setup.ts`:**
   ```typescript
   import "@testing-library/jest-dom";
   import { expect, afterEach } from "vitest";
   import { cleanup } from "@testing-library/react";
   
   afterEach(() => cleanup());
   ```

4. **Add to `package.json` scripts:**
   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:watch": "vitest --watch",
       "test:coverage": "vitest --coverage"
     }
   }
   ```

## Critical Testing Priorities

1. **Validation Schemas** (`src/lib/validation/schemas.ts`) - Test all Zod schemas with valid and invalid inputs
2. **Date Utilities** (`src/lib/format.ts`) - Timezone-critical, needs comprehensive testing
3. **Hooks** (`src/hooks/*`) - Custom hooks should have dedicated tests
4. **Form Components** (`src/components/*form*`) - Integration tests for form flow with validation
5. **Authentication Flow** - Critical path: login → company selection → dashboard

---

*Testing analysis: 2026-07-31*
