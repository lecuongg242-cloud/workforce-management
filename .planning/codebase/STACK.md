# Technology Stack

**Analysis Date:** 2026-07-31

## Languages

**Primary:**
- TypeScript 5.7.2 - Full application codebase in `src/`

**Secondary:**
- JavaScript (ESM modules) - Configuration files (`next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`)

## Runtime

**Environment:**
- Node.js 22.18.0 (current in development)

**Package Manager:**
- npm 11.10.1
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 15.0.0 - Full-stack web framework with React server components
  - App Router used (`src/app/` directory structure)
  - Static optimization enabled (`outputFileTracingRoot` configured in `next.config.ts`)

**UI & Components:**
- React 19.0.0 - Client-side component framework
- Radix UI 1.6.7 - Headless component library (buttons, forms, modals, etc.)
- Lucide React 0.468.0 - Icon library

**Styling & Theme:**
- Tailwind CSS 4.0.0 - Utility-first CSS framework
  - PostCSS integration via `@tailwindcss/postcss` plugin
  - Theme customization in `src/app/globals.css` with design tokens
  - next-themes 0.4.6 - Theme provider (light/dark mode support)
- tw-animate-css 1.2.5 - Animation utilities
- class-variance-authority 0.7.1 - Component style variance management
- tailwind-merge 2.6.0 - Tailwind class merging utility

**Form Handling:**
- React Hook Form 7.54.0 - Performant form state management
- @hookform/resolvers 3.9.1 - Schema validation integration
- Zod 3.24.1 - TypeScript-first schema validation

**Data Visualization:**
- Recharts 2.15.0 - React charting library for dashboard analytics

**Date/Time:**
- date-fns 4.1.0 - Date manipulation and formatting
- react-day-picker 10.0.1 - Calendar component

**Notifications:**
- Sonner 1.7.1 - Toast notification library

## Key Dependencies

**Critical:**
- next 15.0.0 - Framework backbone; upgrades include React 19 compatibility
- react 19.0.0 - React 19 introduces use() hook and improved SSR
- typescript 5.7.2 - Full type safety across application

**UI & UX:**
- recharts 2.15.0 - Dashboard attendance charts and analytics
- radix-ui 1.6.7 - Accessible components (currently minimal usage, see `components/` directory)
- zod 3.24.1 - Runtime validation for forms and domain models

**Styling:**
- tailwindcss 4.0.0 - All visual styling; design tokens in `src/app/globals.css`
- @tailwindcss/postcss 4.0.0 - PostCSS plugin for Tailwind

## Configuration

**Environment:**
- No `.env` files detected in development
- Session storage via browser localStorage (`src/lib/auth/session-provider.tsx`)
- Mock configuration in `src/lib/mock/service.ts` with `mockConfig.simulateError` and `mockConfig.latencyMs`

**Build:**
- `tsconfig.json` - TypeScript compilation with strict mode enabled
  - Path alias: `@/*` → `src/*`
  - Target: ES2020
  - JSX preserved for Next.js handling
- `eslint.config.mjs` - ESLint with Next.js core-web-vitals and TypeScript configs
- `postcss.config.mjs` - PostCSS with Tailwind CSS plugin
- `next.config.ts` - Next.js configuration with React strict mode enabled

## Platform Requirements

**Development:**
- Node.js 22.18.0 (or compatible)
- npm 11.10.1 (or compatible package manager)
- Modern browser with ES2020+ support

**Production:**
- Deployment target: Not yet specified (planned: Vercel or similar Next.js hosting)
- Build output: `.next/` directory (Next.js build artifact)
- Static analysis: ESLint validation on lint command

## Scripts

```bash
npm run dev         # Start development server (next dev)
npm run build       # Build for production (next build)
npm start           # Start production server (next start)
npm run lint        # Run ESLint validation
npm run typecheck   # TypeScript type checking without emit
```

---

*Stack analysis: 2026-07-31*
