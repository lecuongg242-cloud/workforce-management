# Phase 2: Phiên thật và cắt tầng dữ liệu giả - Research

**Researched:** 2026-07-31
**Domain:** Supabase Auth (SSR cookie sessions) trên Next.js 15 App Router, phân quyền bốn vai trò, thay tầng `service.ts` sang Postgres thật, audit log, loại bỏ `REFERENCE_DATE`.
**Confidence:** MEDIUM overall — không có Context7/curated-docs MCP nào bật trong phiên này (toàn bộ `exa_search`/`brave_search`/`firecrawl`/`tavily_search`/`ref_search`/`perplexity`/`jina` đều `false` trong `.planning/config.json`), nên mọi phát hiện web đến từ `WebSearch`/`WebFetch` built-in — seam `classify-confidence` xếp các nguồn này ở LOW. Version số cụ thể (`@supabase/supabase-js`, `@supabase/ssr`) được xác nhận trực tiếp qua `npm view` trong phiên này. Pattern kiến trúc (cookie adapter, middleware footgun, CSRF Server Actions) được đối chiếu độc lập qua ≥2 nguồn (docs chính thức Supabase/Next.js + thảo luận GitHub/community) nên xếp CITED thay vì ASSUMED, nhưng người lập kế hoạch nên coi mọi đoạn code mẫu dưới đây là khung sườn cần xác minh lại với docs sống tại thời điểm viết code, không phải copy-paste nguyên văn.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-11 — Vai trò thứ tư (platform_admins), tối thiểu ở Phase 2:** Tạo bảng `platform_admins` (chỉ `user_id` + `created_at`) kèm `tf_is_platform_admin()`, và tầng kiểm quyền có một nhánh cho nó. Không màn hình, không đường đọc xuyên doanh nghiệp, không đụng RLS policy của Phase 1. Reversibility: costly.

**D-11a:** `platform_admins` phải bật RLS kèm ít nhất một policy, và policy đúng là **chặn hết** — không ai đọc bảng trực tiếp, mọi truy cập qua `tf_is_platform_admin()`. Bắt buộc vì `supabase/tests/00_rls_coverage.sql` fail ở cả hai điều kiện `relrowsecurity = false` và RLS bật mà 0 policy.

**D-11b:** `tf_is_platform_admin()` theo đúng khuôn `tf_is_member()` tại `supabase/migrations/0002_tenancy.sql:64,76` — `security definer` cộng `revoke execute on function ... from public`.

**Giới hạn đã biết (D-11):** Ở Phase 2 nhánh này không kiểm chứng được đến nơi — chỉ test hàm trả đúng true/false; "platform admin thấy đúng cái được phép thấy" chỉ chứng minh được ở Phase 6.

**D-12 — Route Handlers cho đọc, Server Actions cho ghi:** Đọc qua Route Handler (giữ `useMockQuery` nguyên hình, `MockDataProvider` sống nguyên, `*-view.tsx` không sửa, nhiều truy vấn chạy song song). Ghi qua Server Action (không viết endpoint riêng, giữ kiểu end-to-end, chỗ tự nhiên gắn audit log). Lý do loại "tất cả Server Actions": chạy tuần tự, dashboard bắn 4-5 truy vấn sẽ cộng dồn round-trip. Reversibility: costly.

**D-12a:** Điểm kiểm danh tính bắt buộc nằm ở một module server dùng chung (`getSessionContext()`), không nằm trong transport.

**D-12b:** Route Handler là URL công khai — mỗi handler gọi `getSessionContext()`, và không có đường nào để `company_id` đến từ query param, kể cả `?company=`.

**D-12c:** Route Handler chỉ được `GET`. Server Action có kiểm tra origin sẵn; Route Handler xác thực bằng cookie thì không, nên `POST` thêm vào là lỗ CSRF. Luật này phải có test chặn, không chỉ ghi trong tài liệu.

**D-12d:** Dùng chung một schema Zod ở hai đầu handler, parse ở cả nơi trả và nơi nhận — nếu không, `useMockQuery` trả `any`.

**D-12e:** Giữ nguyên hình dạng lỗi của `useMockQuery` (`error: string | null`). Chỗ chuyển đổi lỗi mạng → hình dạng cũ nằm trong service layer, không đẩy lên view.

**D-13 — Tắt đăng ký công khai:** Chủ dự án tạo tài khoản owner bằng script admin. Giữ nguyên `/onboarding` cho khai thông tin doanh nghiệp sau khi đăng nhập.

**D-13a:** Phải tắt ở cấu hình Supabase Auth (`disable_signup`), không chỉ giấu nút — endpoint `/signup` của GoTrue vẫn gọi được bằng `curl` nếu chỉ ẩn nút.

**D-14 — Credential thật cho ~10 người đại diện:** Mỗi doanh nghiệp 1 owner, 1 admin, 1 manager, 2 nhân viên. 30 người còn lại `user_id = null` (phủ đúng trạng thái sản xuất thật: nhân viên ca kíp không bao giờ đăng nhập). `employees.user_id` đã nullable (`supabase/migrations/0004_core_entities.sql:82`).

**D-14a:** `email_confirm: true` khi gọi `createUser()`.

**D-15 — Tách fixture khỏi seed:** 4 uuid tổng hợp ở lại `supabase/tests/` cho pgTAP (nơi `auth.users` là bảng compat, không có Supabase Auth thật). `seed.sql` không còn hardcode uuid; script `scripts/seed-auth.mjs` gọi `auth.admin.createUser()` rồi mới điền `memberships`/`employees.user_id`. Uuid tổng hợp không bao giờ chạm cloud.

**D-15a:** Tách này đổi cấu tạo `npm run test:db` — sau khi tách, test phải tự dựng fixture của mình. 170 assertion hiện có không được âm thầm giảm — số assertion sau khi tách phải bằng hoặc lớn hơn.

**D-16 — Cờ buộc đổi mật khẩu ở `app_metadata`:** Không phải cột DB, tuyệt đối không phải `user_metadata` (client sửa được). Nằm sẵn trong JWT nên `middleware.ts` chặn được không cần truy vấn DB.

**D-16a:** `app_metadata` chỉ vào JWT sau khi token refresh. Xoá cờ xong mà không ép refresh session thì người dùng vẫn mang access token cũ với cờ cũ — đổi mật khẩu thành công rồi mà middleware vẫn đá về trang đổi mật khẩu, không thoát ra được. Phải ép refresh ngay sau khi xoá cờ.

**D-17 — Audit log ghi ở tầng server, không dùng trigger:** Trigger không biết actor khi thao tác đi qua đường admin API, cũng không bao giờ biết `reason`.

**D-17a:** Giới hạn phải ghi rõ: audit tầng server đúng cho ai/vì sao nhưng không đảm bảo đủ — một migration hay phiên psql tay ghi thẳng vào bảng sẽ không để lại vết. Nếu sau này cần tính đầy đủ, thêm trigger làm lưới thứ hai (bổ sung, không thay thế).

**D-18 — `before`/`after` lưu nguyên dòng, không lưu delta.**

**D-18a:** Hệ quả cần biết trước: từ Phase 3, `attendance_records` mang GPS, nên `audit_log` thành bản sao thứ hai của dữ liệu cá nhân. Không phải việc phải làm ở V2 — ghi lại để không thành bất ngờ.

**D-19 — "Hôm nay" do server cấp, truyền xuống như dữ liệu:** Không `new Date()` trong client component cho bất cứ thứ gì render ở lần vẽ đầu. Phase 1 đã có `tf_work_date()`/`tf_tz()`.

**D-19a:** Quy ước phải cưỡng chế được — thêm rule ESLint cấm `new Date()` và `Date.now()` trong client component.

### Claude's Discretion

- Cách đặt tên và bố cục thư mục `src/lib/supabase/`
- Hình dạng cụ thể của `getSessionContext()` và kiểu trả về
- Cách tổ chức Route Handler theo route segment
- Chi tiết schema Zod dùng chung ở biên
- Cách viết rule ESLint cho D-19a
- Thứ tự thay thế ~40 hàm trong `service.ts`

### Deferred Ideas (OUT OF SCOPE)

- Màn hình super admin và đường đọc xuyên doanh nghiệp — Phase 6 (SADM-02/04)
- Trigger audit làm lưới thứ hai — chỉ khi cần tính đầy đủ (D-17a)
- Vòng đời và lưu trữ dữ liệu cá nhân trong `audit_log` — nhóm PRIV cho V3 (D-18a)
- Thay `useMockQuery` bằng TanStack Query — không làm ở phase này
- Thu hồi khóa Supabase legacy — đã ra khỏi phạm vi theo quyết định 2026-07-31
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Đăng nhập Supabase Auth, phiên ở cookie, không localStorage | §Three-Client Pattern, §Middleware Cookie-Propagation Footgun |
| AUTH-02 | Route bảo vệ ở `middleware.ts`, chặn trước khi render | §Middleware Cookie-Propagation Footgun, §Next.js 16 rename cảnh báo |
| AUTH-03 | Bốn vai trò quyết định xem/làm gì | §getSessionContext() Design, §platform_admins (D-11) |
| AUTH-04 | Admin tạo tài khoản kèm mật khẩu tạm, buộc đổi lần đầu | §Admin API User Provisioning, §app_metadata JWT Refresh |
| AUTH-05 | Chọn doanh nghiệp, active company từ session server | §getSessionContext() Design, §Route Handlers vs Server Actions |
| DATA-05 | Thay toàn bộ `service.ts`, xóa `mock/db.ts`/`mock/seed.ts` | §Route Handlers vs Server Actions, §Thứ tự thay ~40 hàm |
| DATA-06 | Mọi thao tác ghi vào audit log | §Audit Log Server-Side Pattern |
| DATA-08 | Gỡ `REFERENCE_DATE`, chạy thời gian thật không lỗi hydration | §Server-Supplied "Today" Pattern |
</phase_requirements>

## Summary

Phase 2 thay ba thứ cùng lúc: (1) phiên đăng nhập giả bằng Supabase Auth cookie thật qua ba client instance (`@supabase/ssr`), (2) toàn bộ 26 hàm trong `mock/service.ts` bằng Route Handler (đọc) + Server Action (ghi) chạm Postgres thật, (3) `REFERENCE_DATE` bằng ngày server cấp. Kiến trúc hai-đường-truyền (D-12) đã khóa: Route Handler chỉ `GET`, xác thực qua `getSessionContext()` dùng chung, Server Action làm mọi ghi và tự nhiên có CSRF miễn phí từ Next.js. Điểm khó nhất không nằm ở việc chọn thư viện (đã khóa `@supabase/ssr` 0.12.4 + `@supabase/supabase-js` 2.111.0) mà ở ba cạm bẫy vận hành: (a) middleware phải trả về đúng `NextResponse` đã ghi cookie lên, không phải một response mới; (b) `app_metadata` chỉ vào JWT sau khi refresh — xóa cờ `must_change_password` xong phải ép refresh ngay, không thì người dùng kẹt vòng lặp; (c) `disable_signup` không nằm trong `config.toml` của project này (project không chạy `supabase start` local — `db:push`/`db:seed` chạy thẳng vào Postgres URL qua psql/npx), nên phải tắt qua Dashboard/Management API và xác minh bằng `curl` vào endpoint `/signup`, không phải sửa `config.toml` rồi tin là xong.

Một phát hiện không nằm trong `<research_focus>` nhưng liên quan trực tiếp đến AUTH-02: Next.js 16 đã đổi tên `middleware.ts` → `proxy.ts` (đọc từ docs Next.js chính thức, fetch 2026). Dự án này pin `next@^15.0.0`, nên `middleware.ts` vẫn đúng — nhưng docs Supabase hiện tại (`supabase.com/docs/guides/auth/server-side/nextjs`, fetch 2026-07-31) đã dùng thuật ngữ "Proxy" thay vì "middleware" trong văn xuôi, dù code mẫu thực tế build trên Next 15 vẫn export từ `middleware.ts`. Người lập kế hoạch cần đọc code mẫu Supabase với tâm thế "Proxy = middleware.ts ở Next 15.x", không đổi tên file theo docs.

**Primary recommendation:** Dựng `getSessionContext()` là điểm chặn danh tính duy nhất (đọc `auth.getClaims()` phía server, fallback `getUser()` nếu project còn khóa JWT đối xứng — kiểm tra Dashboard → Settings → API → JWT Keys trước khi giả định), Route Handler nào cũng gọi nó đầu tiên và không bao giờ nhận `company_id` từ input; audit log ghi ngay trong cùng hàm ghi (không tách phase sau); xử lý `REFERENCE_DATE` bằng một Server Component gốc tính `today` một lần rồi truyền xuống làm prop, không để bất kỳ client component nào tự gọi `new Date()`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Đăng nhập / đăng xuất / đổi mật khẩu | Browser (gọi `supabase.auth.signInWithPassword`) | API/Backend (Supabase Auth) | Chỉ hai thao tác này chạm Supabase trực tiếp từ client — mọi thứ khác qua server |
| Refresh & lưu session cookie | Frontend Server (`middleware.ts`) | — | Middleware là nơi duy nhất "refresh trước khi Server Component render" theo pattern `@supabase/ssr` |
| Route gating (`/admin/*`, `/employee/*`) | Frontend Server (`middleware.ts`) | API/Backend (RLS là lớp 2) | AUTH-02 yêu cầu chặn "trước khi trang kịp render" — chỉ middleware chạy đủ sớm |
| Xác định vai trò / company hiện hành | API/Backend (`getSessionContext()`) | — | Không bao giờ tin giá trị client gửi lên (D-12b); đây là điểm chặn duy nhất theo D-12a |
| Đọc dữ liệu (list*, get*) | API/Backend (Route Handler, GET only) | Database (RLS backstop) | D-12: đọc song song, không tuần tự như Server Action |
| Ghi dữ liệu (create*/update*/checkIn/checkOut) | API/Backend (Server Action) | Database (RLS backstop) | D-12: CSRF miễn phí, audit log tự nhiên |
| Tạo tài khoản nhân viên + mật khẩu tạm | API/Backend (Server Action gọi `auth.admin.createUser`) | — | Cần `service_role`/secret key — không bao giờ ở client |
| Buộc đổi mật khẩu lần đầu | Frontend Server (`middleware.ts` đọc `app_metadata` từ JWT) | Browser (form đổi mật khẩu + force refresh) | D-16: cờ JWT đọc được không cần query DB |
| Audit log ghi before/after | API/Backend (trong cùng hàm ghi) | Database (bảng `audit_log`, RLS) | D-17: không dùng trigger, cần actor + reason |
| "Hôm nay" / ngày hiển thị | Frontend Server (Server Component gốc tính 1 lần) | Browser (nhận prop, không tự tính) | D-19: tránh hydration mismatch bằng cách không bao giờ tính hai lần |
| CSRF trên đường ghi | API/Backend (Next.js Server Action built-in origin check) | — | D-12c: đây là lý do Route Handler bị giới hạn GET-only |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `2.111.0` | Core SDK (Postgres qua PostgREST, Auth, Storage) | `[VERIFIED: npm registry]` — `npm view @supabase/supabase-js version` chạy trong phiên này trả đúng `2.111.0`, không postinstall script. |
| `@supabase/ssr` | `0.12.4` | Cookie-based session helper cho Server Components/Actions/Route Handlers/middleware | `[VERIFIED: npm registry]` — `npm view @supabase/ssr version` trả `0.12.4`; `peerDependencies` xác nhận khớp `@supabase/supabase-js: "^2.111.0"`. Không postinstall script. Là cách duy nhất hiện tại được Supabase tài liệu hóa cho App Router cookie-based auth `[CITED: supabase.com/docs/guides/auth/server-side/nextjs]`. |

**Package name provenance:** hai tên gói trên đến từ tài liệu chính thức Supabase (`supabase.com/docs`) đã fetch trong phiên này, không phải chỉ từ tri thức huấn luyện — nhưng theo quy tắc provenance, tên gói do WebSearch/WebFetch phát hiện vẫn phải gắn `[ASSUMED]` trừ khi đến trực tiếp từ Context7 — phiên này không có Context7 nên tag version là `[VERIFIED: npm registry]` (số version, không phải sự tồn tại của gói) còn bản thân việc "đây đúng là gói chính hãng của Supabase" dựa trên: repo GitHub khớp (`github.com/supabase/ssr.git`, `github.com/supabase/supabase-js.git` — xem Package Legitimacy Audit) + lượng tải hàng tuần hàng chục triệu, không phải một xác nhận Context7 độc lập.

### Supporting (test tooling — Vitest, D-19a ESLint)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `4.1.10` | Unit test runner | `[VERIFIED: npm registry]`. Khuyến nghị chính thức của Next.js cho unit test App Router `[CITED: nextjs.org/docs/app/guides/testing/vitest]`. |
| `@vitejs/plugin-react` | `6.0.5` | Transform JSX/TSX cho Vitest | `[VERIFIED: npm registry]` |
| `vite-tsconfig-paths` | `6.1.1` | Cho Vitest hiểu alias `@/*` từ `tsconfig.json` | `[VERIFIED: npm registry]` — bắt buộc vì dự án dùng absolute import `@/` khắp nơi |
| `jsdom` | latest | Môi trường DOM cho test component | `npm view jsdom version` trả version nhưng do package-legitimacy gate đánh dấu SUS (xem Package Legitimacy Audit) — vẫn OK dùng, chỉ cần checkpoint xác nhận trước khi cài |
| `@testing-library/react` | `16.3.2` | Test component | `[VERIFIED: npm registry]` — `peerDependencies` xác nhận hỗ trợ React `^18 \|\| ^19`, khớp React 19.0.0 hiện có. |
| `@testing-library/dom` | latest | Dependency của `@testing-library/react`, cũng dùng độc lập cho query DOM trong test | Theo hướng dẫn chính thức Next.js Vitest guide |

**Không cần thêm** cho Phase 2: không `@playwright/test` (đó là việc của Phase 3 — camera/GPS), không `browser-image-compression`, không TanStack Query (D-12/D-2 giữ nguyên `useMockQuery`).

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

**Version verification:** đã chạy `npm view <pkg> version` cho toàn bộ bảng trên trong phiên nghiên cứu này (2026-07-31) — xem log lệnh, không lấy từ tri thức huấn luyện.

## Package Legitimacy Audit

| Package | Registry | Age (published-at gần nhất) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|------------------------------|--------------|--------------|---------|-------------|
| `@supabase/supabase-js` | npm | 2026-07-28 (bản mới nhất — gói tồn tại nhiều năm) | 23,644,736 | github.com/supabase/supabase-js | SUS (`too-new`) | Approved — false positive, xem ghi chú |
| `@supabase/ssr` | npm | 2026-07-28 | 6,110,156 | github.com/supabase/ssr | SUS (`too-new`) | Approved — false positive |
| `vitest` | npm | 2026-07-06 | 85,985,847 | github.com/vitest-dev/vitest | SUS (`too-new`) | Approved — false positive |
| `@vitejs/plugin-react` | npm | 2026-07-30 | 69,180,413 | github.com/vitejs/vite-plugin-react | SUS (`too-new`) | Approved — false positive |
| `vite-tsconfig-paths` | npm | 2026-02-11 | 30,926,682 | github.com/aleclarson/vite-tsconfig-paths | OK | Approved |
| `@testing-library/react` | npm | 2026-01-19 | 50,921,849 | github.com/testing-library/react-testing-library | OK | Approved |
| `@testing-library/dom` | npm | 2025-07-27 | 58,391,994 | github.com/testing-library/dom-testing-library | OK | Approved |
| `jsdom` | npm | 2026-07-29 | 89,714,040 | github.com/jsdom/jsdom | SUS (`too-new`) | Approved — false positive |

**Ghi chú bắt buộc về false positive `too-new`:** gate `package-legitimacy check` gắn cờ `too-new` dựa trên ngày publish của **bản mới nhất**, không phải ngày gói được tạo lần đầu. Với 5 gói trên, lượng tải hàng tuần (6 triệu đến 90 triệu) và repo GitHub khớp tổ chức chính chủ (`supabase`, `vitest-dev`, `vitejs`, `jsdom`) là bằng chứng đủ mạnh rằng đây là các bản phát hành thường xuyên của gói đã trưởng thành, không phải gói mới/slopsquat. Theo protocol, verdict SUS vẫn phải giữ nguyên trong bảng và **planner phải thêm một task `checkpoint:human-verify` trước bước `npm install`** cho 5 gói này (`@supabase/supabase-js`, `@supabase/ssr`, `vitest`, `@vitejs/plugin-react`, `jsdom`) dù lý do false-positive đã ghi rõ ở đây — không bỏ qua bước checkpoint chỉ vì nghiên cứu đã giải thích được nguyên nhân.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `@supabase/supabase-js`, `@supabase/ssr`, `vitest`, `@vitejs/plugin-react`, `jsdom` — tất cả do `too-new` false positive (xem ghi chú trên); planner vẫn phải gate bằng `checkpoint:human-verify`.

## Architecture Patterns

### System Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Browser                                                              │
│  *-view.tsx (unchanged) ── useMockQuery/useDataQuery ── fetch(GET)   │
│                        └── form submit ──────────────► Server Action │
│  Supabase browser client: CHỈ signInWithPassword/signOut             │
└───────────────┬───────────────────────────────┬─────────────────────┘
                 │ every request                 │ POST only (RPC)
┌────────────────▼───────────────────────────────▼─────────────────────┐
│ middleware.ts  (chạy TRƯỚC mọi Server Component render — AUTH-02)     │
│  - createServerClient() với request/response cookie adapter          │
│  - supabase.auth.getClaims() (hoặc getUser() nếu còn khóa đối xứng)  │
│  - đọc app_metadata.must_change_password, app_metadata.role nếu cần  │
│  - redirect nếu chưa đăng nhập và path thuộc /admin/* /employee/*    │
│  - PHẢI trả về CHÍNH response đã ghi cookie lên (xem Pitfall)         │
└───────────────┬───────────────────────────────┬─────────────────────┘
                 │                                │
┌────────────────▼─────────────┐   ┌─────────────▼─────────────────────┐
│ Route Handler (GET only)      │   │ Server Action ('use server')       │
│ src/app/api/**/route.ts       │   │ src/lib/data/*.ts                  │
│  1. getSessionContext()       │   │  1. getSessionContext()            │
│  2. Zod parse response shape  │   │  2. Zod parse input                │
│  3. .eq('company_id', ...)    │   │  3. requireRole(...)               │
│  4. dynamic = 'force-dynamic' │   │  4. .eq('company_id', ...) write   │
│     (không cache giữa users)  │   │  5. audit.ts: insert audit_log     │
└────────────────┬──────────────┘   └─────────────┬───────────────────┘
                 │                                 │
┌────────────────▼─────────────────────────────────▼─────────────────┐
│ Postgres (Supabase) — RLS re-check company_id độc lập (lớp 2)        │
│ companies / memberships / employees / ... / audit_log / platform_   │
│ admins (RLS deny-all, chỉ đọc qua tf_is_platform_admin())            │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # createBrowserClient() — chỉ cho signIn/signOut
│   │   ├── server.ts          # createServerClient() bind next/headers cookies()
│   │   └── middleware.ts      # updateSession(request) dùng trong middleware.ts gốc
│   ├── auth/
│   │   ├── session-provider.tsx  # giữ useSession()/useAuthenticatedSession() API,
│   │   │                         # đổi nguồn: đọc từ Server Component prop, không
│   │   │                         # còn tự đọc localStorage
│   │   └── get-session-context.ts # getSessionContext(): điểm chặn danh tính DUY NHẤT
│   ├── data/                  # thay cho mock/service.ts, giữ nguyên chữ ký hàm
│   │   ├── employees.ts / departments.ts / shifts.ts / ... (Route Handler đọc)
│   │   ├── mutations/*.ts     # Server Actions ghi
│   │   └── audit.ts           # logMutation(before, after, actor, reason)
│   ├── validation/
│   │   └── api-schemas.ts     # Zod schema dùng chung parse ở CẢ route.ts lẫn fetcher (D-12d)
│   └── today.ts               # tính "today" 1 lần server-side theo tf_tz(), truyền prop
├── app/
│   └── api/
│       └── <resource>/route.ts   # export async function GET only (D-12c)
middleware.ts                      # gốc src/ hoặc root — export middleware() + matcher
eslint-rules/
└── no-date-in-client.mjs      # custom rule D-19a (xem Pitfall/Code Examples)
```

### Pattern 1: Ba client instance, ba nơi chạy

**What:** `createBrowserClient()` (chỉ browser, chỉ auth calls), `createServerClient()` (Server Component/Route Handler/Server Action, bind `cookies()` từ `next/headers`), và một biến thể `createServerClient()` thứ ba dùng trong `middleware.ts` với request/response cookie adapter khác (vì Server Component không tự ghi cookie được).

**When to use:** Luôn — đây là pattern bắt buộc của `@supabase/ssr`, không có lựa chọn khác cho App Router.

**Example (server client):**
```typescript
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component gọi setAll -- bỏ qua nếu middleware đã refresh session.
          }
        },
      },
    },
  );
}
```
`[CITED: supabase.com/docs/guides/auth/server-side/nextjs]` — cookie adapter dùng `getAll()`/`setAll()` là hình dạng hiện tại; hình dạng `get`/`set`/`remove` cũ đã bị loại bỏ. `setAll` bọc trong `try/catch` vì Server Component không được phép ghi cookie (chỉ đọc) — lỗi này vô hại nếu middleware đã đảm nhiệm refresh, đây là pattern chính thức được tài liệu hóa, không phải cách né lỗi tùy tiện.

### Pattern 2: Middleware là nơi DUY NHẤT refresh session, và phải trả về đúng response đã ghi cookie

**What:** `middleware.ts` tạo MỘT `NextResponse` object, truyền nó vào cookie adapter của Supabase client, gọi `getClaims()`/`getUser()` để trigger refresh nếu cần, rồi **trả về chính object đó** — không tạo response mới ở cuối hàm rồi copy cookie qua.

**When to use:** Luôn, mọi request khớp matcher.

**Example:**
```typescript
// middleware.ts (root, Next.js 15.x — KHÔNG đổi tên thành proxy.ts, xem Pitfall)
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // Tạo response NGAY ĐẦU HÀM — mọi cookie.set() bên dưới ghi lên object này.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // PHẢI tạo lại response SAU khi set request.cookies, rồi set lại
          // trên response -- đây là bước hay bị bỏ sót gây mất cookie.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // KHÔNG chèn logic nào giữa createServerClient() và getClaims()/getUser().
  const { data } = await supabase.auth.getClaims();
  const isProtected =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/employee");

  if (isProtected && !data?.claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url); // redirect KHÔNG cần copy cookie -- session rỗng
  }

  // TRẢ VỀ CHÍNH supabaseResponse -- không new NextResponse() nào khác ở đây.
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```
`[CITED: supabase.com/docs/guides/auth/server-side/nextjs + community/GitHub cross-check]` — cross-checked qua GitHub Discussion #34842/#27505 và bài viết cộng đồng độc lập: lỗi phổ biến nhất là tạo `NextResponse.next()` mới ở cuối rồi cố `.cookies.setAll(supabaseResponse.cookies.getAll())` — API đó **không tồn tại** trên `ResponseCookies`, và ngay cả khi viết tay từng cookie, việc tạo response mới thay vì tái sử dụng bản đã ghi cookie là nguồn gốc của "mất session ngẫu nhiên" / vòng lặp redirect được báo cáo lặp lại trong nhiều thread độc lập.

**Matcher:** loại trừ `_next/static`, `_next/image`, `favicon.ico`, và các phần mở rộng ảnh tĩnh — không loại trừ `/login` khỏi matcher (route đó vẫn cần middleware chạy để redirect người ĐÃ đăng nhập ra khỏi `/login`), chỉ loại trừ khỏi *logic chặn*, không loại trừ khỏi matcher.

### Pattern 3: `getClaims()` vs `getUser()` vs `getSession()`

**What:** `getClaims()` xác minh JWT cục bộ qua JWKS (không round-trip mạng) — khuyến nghị hiện tại cho project dùng khóa ký bất đối xứng (mặc định cho project mới). `getUser()` round-trip tới Auth server mỗi lần gọi — vẫn đúng cho project còn dùng khóa đối xứng (legacy). `getSession()` **không bao giờ** được tin ở server vì nó chỉ giải mã JWT cục bộ không xác thực lại.

**Action bắt buộc trước khi viết code:** kiểm tra Supabase Dashboard → Settings → API → JWT Keys xem project hiện tại dùng khóa đối xứng (HS256/legacy) hay bất đối xứng (ES256/mới) — nghiên cứu này **không xác minh được** project thật của TimeFlow đang ở trạng thái nào (không có quyền truy cập dashboard trong phiên nghiên cứu). `[ASSUMED]` project mới tạo dùng khóa bất đối xứng theo mặc định hiện tại của Supabase — planner phải coi đây là điều cần xác nhận, không phải sự thật đã khóa. Nếu là đối xứng, dùng `getUser()` thay `getClaims()` trong toàn bộ `getSessionContext()`/middleware.

`[CITED: supabase.com/docs/reference/javascript/auth-getclaims, auth-getuser, auth-getsession]`

### Pattern 4: `getSessionContext()` — điểm chặn danh tính duy nhất (D-12a)

**What:** Một hàm server-only, được gọi đầu tiên bởi MỌI Route Handler và MỌI Server Action. Trả về actor (user id), company đang active, role trong company đó, và trạng thái `must_change_password`.

**Ví dụ hình dạng đề xuất** (Claude's Discretion — chi tiết kiểu trả về do planner quyết định, đây chỉ là khung gợi ý):
```typescript
// src/lib/auth/get-session-context.ts
export interface SessionContext {
  userId: string;
  companyId: string;
  role: CompanyRole; // "owner" | "admin" | "manager" | "employee" — domain.ts:47
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
}

export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient(); // server client, cookie-bound
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) throw new UnauthenticatedError();

  const appMetadata = data.claims.app_metadata as
    | { must_change_password?: boolean }
    | undefined;

  // "active company" đọc từ đâu là quyết định cần chốt ở plan: ứng viên là
  // (a) cookie riêng set bởi Server Action selectCompany() sau khi xác minh
  // membership, hoặc (b) query memberships mặc định company đầu tiên nếu
  // chưa chọn. KHÔNG BAO GIỜ đọc companyId từ query param/body.
  // ...
}
```

**Lưu ý về `system_role`/`CompanyRole` (giá trị enum có thật, không suy đoán):**
`src/lib/types/domain.ts:47` — `export type CompanyRole = "owner" | "admin" | "manager" | "employee";` `[VERIFIED: src/lib/types/domain.ts:47]`. Đây là 4 giá trị cấp doanh nghiệp; **super admin không thuộc enum này** (đúng như `<specifics>` mục 2 đã xác nhận) — `platform_admins` (D-11) là cơ chế riêng, không phải giá trị thứ 5 của `CompanyRole`.

`supabase/migrations/0002_tenancy.sql:13` — `create type company_role as enum ('owner', 'admin', 'manager', 'employee');` `[VERIFIED: supabase/migrations/0002_tenancy.sql:13]` — khớp chính xác `domain.ts:47`.

### Pattern 5: Route Handler đọc — `force-dynamic`, GET only, Zod ở cả hai đầu

**What:** Mỗi Route Handler là `export async function GET(request: NextRequest)`, đọc `getSessionContext()` trước, không định nghĩa `POST`/`PUT`/`DELETE` (D-12c), và đánh dấu `export const dynamic = 'force-dynamic'` để Next.js không bao giờ cache response giữa các user (khác session/company khác nhau nhưng cùng URL).

**Example:**
```typescript
// src/app/api/employees/route.ts
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { employeeQuerySchema, employeeListResponseSchema } from "@/lib/validation/api-schemas";

export const dynamic = "force-dynamic"; // không cache -- dữ liệu phụ thuộc session

export async function GET(request: Request) {
  const { companyId } = await getSessionContext(); // KHÔNG đọc company_id từ URL
  const url = new URL(request.url);
  const query = employeeQuerySchema.parse({
    search: url.searchParams.get("search") ?? undefined,
    // company_id KHÔNG có trong schema -- nếu client gửi ?company=..., bị bỏ qua
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("company_id", companyId) // luôn từ session, không từ query
    .order("full_name");

  if (error) return NextResponse.json({ error: "Không tải được danh sách nhân viên." }, { status: 500 });

  const parsed = employeeListResponseSchema.parse(data.map(toEmployeeDomain)); // D-12d: parse cả hai đầu
  return NextResponse.json(parsed);
}
// KHÔNG export POST/PUT/DELETE ở file này -- đó là lỗ CSRF theo D-12c.
```
`[ASSUMED]` chi tiết `force-dynamic` là suy luận kiến trúc chuẩn (Route Handler mặc định có thể bị cache tĩnh nếu không đọc `cookies()`/`headers()` — đọc qua `getSessionContext()` vốn gọi `cookies()` nên Next.js 15 thường tự động opt-out cache, nhưng khai báo tường minh `force-dynamic` loại bỏ hoàn toàn rủi ro một Route Handler vô tình không chạm `cookies()` trong nhánh code nào đó bị Next.js coi là static).

### Pattern 6: Server Action ghi — CSRF miễn phí, audit log trong cùng hàm

**What:** Mọi hàm ghi là `'use server'`, Next.js tự so khớp header `Origin` với `Host`/`X-Forwarded-Host` và abort nếu lệch `[CITED: nextjs.org/blog/security-nextjs-server-components-actions]` — đây chính là lý do D-12c cấm `POST` trên Route Handler (Route Handler không có cơ chế này).

**Example:**
```typescript
// src/lib/data/mutations/employees.ts
"use server";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { logMutation } from "@/lib/data/audit";

export async function updateEmployee(id: string, patch: EmployeeInput): Promise<Employee> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createClient();
  const { data: before } = await supabase.from("employees").select("*").eq("id", id).single();

  const { data: after, error } = await supabase
    .from("employees")
    .update(toEmployeeRow(patch))
    .eq("id", id)
    .eq("company_id", companyId) // lớp 1 -- RLS là lớp 2
    .select()
    .single();

  if (error) throw new Error("Không thể cập nhật nhân viên.");

  await logMutation({
    companyId, actorUserId: userId, action: "update",
    entityTable: "employees", entityId: id, before, after, reason: null,
  });

  return toEmployeeDomain(after);
}
```

### Pattern 7: Admin API tạo tài khoản nhân viên — không INSERT thẳng vào `auth.users`

**What:** `supabase.auth.admin.createUser({ email, password, email_confirm: true, app_metadata })` là cách DUY NHẤT tạo tài khoản đăng nhập được — nó tạo cả dòng `auth.users` lẫn dòng `auth.identities` tương ứng (email provider). Insert SQL thẳng vào `auth.users` (như `supabase/seed.sql` hiện tại đang làm cho fixture pgTAP) **không** tạo `auth.identities`, nên tài khoản không đăng nhập được trên Supabase Auth thật — đây chính là phát hiện đã ghi trong `<specifics>` mục 1 và là lý do D-15 tồn tại.

**Example:**
```typescript
// scripts/seed-auth.mjs (server-only, dùng secret/service_role key)
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email: "owner@ngocphat.example",
  password: temporaryPassword,
  email_confirm: true, // D-14a -- thiếu cờ này, tài khoản kẹt "chờ xác nhận email"
  app_metadata: { must_change_password: true },
});
// Sau đó: insert memberships (user_id: data.user.id, company_id, role)
//         update employees set user_id = data.user.id where ...
```
`[CITED: supabase.com/docs/reference/javascript/auth-admin-createuser]` — `app_metadata` set ở đây là "server-side only" (client không sửa được qua `updateUser()`), khác `user_metadata`. Key bắt buộc: `service_role`/secret key, không bao giờ import được từ code chạy ở client bundle — đúng ràng buộc `AUTH-06`/`check:secrets` đã có từ Phase 1.

### Pattern 8: Ép refresh JWT sau khi xóa `must_change_password` (D-16a)

**What:** `app_metadata` cập nhật qua `auth.admin.updateUserById()` **không** phản ánh vào access token JWT hiện có cho tới khi có một lần refresh mới — `getUser()` gọi lại DB sẽ thấy giá trị mới, nhưng JWT (thứ middleware đọc bằng `getClaims()`) vẫn mang cờ cũ cho tới khi refresh xảy ra.

**Cơ chế ép refresh cụ thể:**
1. Server Action `completeForcedPasswordChange()` gọi `supabase.auth.admin.updateUserById(userId, { app_metadata: { must_change_password: false } })` (dùng secret key).
2. Ngay sau đó, trong CÙNG request (còn cookie-bound server client của user đó), gọi `supabase.auth.refreshSession()` — điều này lấy access token mới từ refresh token hiện có, chứa `app_metadata` mới, và (vì đây là server client cookie-bound qua `@supabase/ssr`) `setAll` sẽ ghi cookie mới lên response của chính request này.
3. Redirect người dùng ra khỏi trang đổi mật khẩu SAU khi bước 2 hoàn tất — không redirect ngay sau bước 1.

`[CITED: supabase.com/docs/reference/javascript/auth-refreshsession, cross-checked qua GitHub Discussion #10592]` — có một cạm bẫy đã ghi nhận cộng đồng (không phải lý thuyết): gọi `updateUser()`/`refreshSession()` liên tiếp có thể ném lỗi `Invalid Refresh Token: Already Used` trong một số luồng — planner nên viết test cụ thể cho chuỗi "đổi mật khẩu → xóa cờ → refresh → middleware cho qua" thay vì giả định nó hoạt động từ code mẫu, và cân nhắc thêm 1 lần retry nếu refresh đầu tiên fail do race với refresh-token-rotation (`config.toml:171` `enable_refresh_token_rotation = true` — xác nhận project có bật rotation, làm tăng khả năng gặp lỗi "already used" nếu hai request refresh chồng lên nhau).

### Pattern 9: `disable_signup` — không phải chỉ sửa `config.toml`

**What:** `[auth] enable_signup = true` hiện đang có trong `supabase/config.toml:176` `[VERIFIED: supabase/config.toml:176]` (dòng thật, đọc trực tiếp). Theo docs CLI đã fetch, `config.toml` mô tả rõ là cấu hình cho `supabase start`/local dev — trang docs không đề cập cơ chế đẩy `config.toml` lên project cloud đã link.

**Vấn đề vận hành cụ thể của project này:** `scripts/db.mjs` (đọc trực tiếp, dòng đầu file) ghi rõ dự án **không dùng `supabase start`** — `db:push`/`db:seed`/`test:db` chạy `npx supabase db push --db-url <url>` và `psql` thẳng vào Postgres URL, không qua local Docker stack. Điều này có nghĩa: sửa `enable_signup = false` trong `config.toml` **có thể không có tác dụng gì** trên project cloud thật của TimeFlow trừ khi có bước `supabase link` + một lệnh đồng bộ config riêng (CLI có khái niệm này ở một số phiên bản nhưng docs fetch trong phiên này không xác nhận được lệnh cụ thể) `[ASSUMED — cần xác minh bằng CLI version thật tại thời điểm implement, ví dụ `npx supabase --help` tìm subcommand liên quan tới config/auth push]`.

**Cách xác minh chắc chắn (bắt buộc theo D-13a):** sau khi tắt bằng bất kỳ đường nào (Dashboard → Authentication → Settings → "Allow new users to sign up", hoặc Management API), verify bằng:
```bash
curl -i -X POST "https://<project-ref>.supabase.co/auth/v1/signup" \
  -H "apikey: <publishable-key>" -H "Content-Type: application/json" \
  -d '{"email":"probe@test.local","password":"probepassword123"}'
```
Kỳ vọng: lỗi (thường `422`/`403` với message dạng "Signups not allowed"), không phải `200`. Đây chính xác là cách D-13a yêu cầu kiểm chứng — không tin việc ẩn nút trên UI.

### Anti-Patterns to Avoid

- **Tạo `NextResponse` mới ở cuối `middleware.ts` rồi cố copy cookie:** `ResponseCookies` không có `setAll()`, và ngay cả copy tay từng cookie, response mới không phải object mà Supabase client đã ghi state lên — dẫn tới mất session ngẫu nhiên. Luôn tái sử dụng object đầu hàm.
- **Cho phép `POST`/`PUT`/`DELETE` trên bất kỳ file `route.ts` nào trong `src/app/api/`:** vi phạm trực tiếp D-12c, và không có test nào chặn thì lỗi này im lặng cho tới khi bị khai thác.
- **Insert thẳng SQL vào `auth.users` cho tài khoản thật:** không tạo `auth.identities`, tài khoản không đăng nhập được — chỉ hợp lệ cho fixture pgTAP ở `supabase/tests/` (D-15), không bao giờ cho `seed-auth.mjs`.
- **Redirect người dùng ra khỏi trang đổi mật khẩu ngay sau khi xóa `app_metadata.must_change_password`** mà không đợi refresh hoàn tất — gây vòng lặp redirect (D-16a đã cảnh báo, nhưng cụ thể: thứ tự thao tác sai còn tệ hơn thiếu thao tác, vì middleware sẽ đá ngược lại ngay ở request tiếp theo).
- **Đặt "current company" là Postgres session variable (`SET LOCAL app.company_id`)** — không liên quan trực tiếp scope Phase 2 (Phase 1 đã cấm, xem `ARCHITECTURE.md` Anti-Pattern 2), nhưng nhắc lại vì `getSessionContext()` là nơi dễ bị cám dỗ tái sử dụng pattern này cho "hiệu năng".

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Cookie session Supabase trên Next.js SSR | Tự viết cookie parser/serializer cho JWT | `@supabase/ssr` `createServerClient`/`createBrowserClient` | Đây chính là thư viện được viết ra để giải quyết đúng vấn đề edge/node runtime cookie khác nhau; tự viết lại là tái tạo một class bug đã biết (cookie chunk quá lớn, SameSite, encoding) |
| Buộc đổi mật khẩu lần đầu | Cột DB riêng `employees.must_change_password` + query mỗi request | `app_metadata` trong JWT (D-16) | Đọc được ở middleware không cần round-trip DB; đây đã là quyết định khóa, không phải lựa chọn còn mở |
| CSRF cho đường ghi | Tự sinh CSRF token, so khớp header tay | Server Actions (built-in origin check) | Next.js đã làm việc này cho mọi Server Action; tự viết thêm là trùng lặp và dễ có lỗ hổng nếu quên áp cho một action |
| Audit trail | Trigger Postgres tự động ghi mọi thay đổi | Ghi tường minh trong service layer (D-17) | Trigger không biết actor khi ghi qua admin API, không biết `reason` — đã quyết định, không hand-roll trigger ở phase này |
| Test middleware/route protection | Chạy toàn bộ Next.js dev server rồi click tay | Vitest cho unit-level (parse logic, `getSessionContext` mock), Playwright/manual UAT cho redirect graph thật | Vitest không chạy được async Server Component thật, nhưng logic thuần (role check, Zod parse, cookie-shape) test được nhanh mà không cần server thật |

**Key insight:** Toàn bộ phase này là "nối dây có sẵn", không phải "phát minh cơ chế mới" — mọi cạm bẫy nằm ở việc nối sai thứ tự (redirect trước khi refresh xong, response mới thay vì response cũ, POST trên Route Handler) chứ không phải thiếu thư viện.

## Runtime State Inventory

> Không áp dụng đầy đủ khuôn "rename/refactor" (đây là phase build tính năng mới trên nền Phase 1), nhưng Phase 2 CÓ một cấu phần rename/cắt tầng thật (mock → Supabase, xóa `mock/db.ts`/`mock/seed.ts`) nên vẫn kiểm tra 5 hạng mục để không bỏ sót trạng thái runtime ẩn.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 4 dòng `auth.users` trong `supabase/seed.sql` hiện KHÔNG có `encrypted_password` và KHÔNG có `auth.identities` tương ứng (`<specifics>` mục 1, đã xác nhận). Đây là fixture cho pgTAP local/CI, không phải tài khoản thật. | Data migration: KHÔNG sửa 4 dòng này (chúng ở lại `supabase/tests/` theo D-15) — chỉ đảm bảo `seed.sql` (dữ liệu nghiệp vụ) không còn hardcode uuid này, và `scripts/seed-auth.mjs` tạo bộ ~10 tài khoản thật riêng qua `auth.admin.createUser()`. |
| Live service config | `enable_signup = true` hiện có trong `supabase/config.toml:176` (đọc trực tiếp) — đây là cấu hình sống, KHÔNG chắc áp dụng cho project cloud vì workflow này không chạy `supabase start` local (xác nhận qua `scripts/db.mjs`). | Code edit + manual: sửa `config.toml` (để nhất quán nếu sau này có local dev) VÀ tắt riêng trên Dashboard/Management API cho project cloud thật — hai việc khác nhau, cả hai đều cần. |
| OS-registered state | Không có — dự án không dùng Windows Task Scheduler/pm2/systemd cho phần này (không tìm thấy tham chiếu nào trong `scripts/`). | Không cần hành động. |
| Secrets/env vars | `.env.local` không đọc được trong phiên này (không có quyền), nhưng `scripts/db.mjs` xác nhận biến `POSTGRES_URL_NON_POOLING` bắt buộc. Phase 2 thêm nhu cầu: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client-safe), và secret/service_role key riêng cho `scripts/seed-auth.mjs` + mọi Server Action gọi `auth.admin.*` — key này KHÔNG được có tiền tố `NEXT_PUBLIC_` (đúng cổng `check:secrets` đã dựng ở Phase 1). | Code edit: thêm các biến môi trường mới vào `.env.local`/docs/env theo đúng quy ước AUTH-06 đã có, không đổi tên biến cũ. |
| Build artifacts | Không phát hiện artifact build nào bị stale bởi phase này (không có package Python/binary liên quan). `mock/db.ts`/`mock/seed.ts` là source TypeScript, xóa trực tiếp qua git, không phải artifact build cần "reinstall". | Không cần hành động ngoài xóa file nguồn + cập nhật import. |

## Common Pitfalls

### Pitfall 1: Middleware trả về response sai — mất session hoặc vòng lặp redirect

**What goes wrong:** Middleware tạo `NextResponse` mới ở nhánh redirect hoặc ở cuối hàm thay vì trả về đúng object đã ghi cookie session mới lên, làm trình duyệt và server "lệch pha" về cookie — biểu hiện: đăng nhập xong vẫn bị đá về login, hoặc phiên rơi rụng ngẫu nhiên sau vài request.

**Why it happens:** Code mẫu trên nhiều bài viết cộng đồng (kể cả một phiên bản cũ của chính docs Supabase, theo GitHub Issue #27505) từng gợi ý pattern sai (`myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())` — API không tồn tại).

**How to avoid:** Một biến `let supabaseResponse` duy nhất trong toàn bộ hàm middleware, mọi nhánh (kể cả redirect) đều dùng cookie đã ghi lên nó — với `NextResponse.redirect()`, cookie phiên không quan trọng nữa (người dùng đang bị đá ra vì chưa đăng nhập) nhưng vẫn nên copy để tránh mất cookie khác (theme, locale...) nếu có.

**Warning signs:** QA thấy "thỉnh thoảng" bị đá về login dù vừa đăng nhập; hành vi không tái lập ổn định (dấu hiệu race giữa hai response object).

### Pitfall 2: Route Handler bị cache tĩnh, trả cùng dữ liệu cho hai company khác nhau

**What goes wrong:** Route Handler không tường minh khai `dynamic = 'force-dynamic'`; Next.js 15's default caching heuristics cho Route Handler (GET) có thể cache response nếu handler "trông như" không đọc request-specific data ở nhánh code Next.js phân tích được tĩnh — rủi ro thực tế nhỏ nhưng hậu quả nếu xảy ra là cực nặng (company A thấy dữ liệu company B).

**Why it happens:** D-12b yêu cầu Route Handler đọc session qua `getSessionContext()` (gọi `cookies()` bên trong) — về lý thuyết điều này đã khiến Next.js coi route là dynamic, nhưng đây là hành vi ngầm định phụ thuộc chi tiết implementation, không phải cam kết API tường minh.

**How to avoid:** Luôn khai báo tường minh `export const dynamic = "force-dynamic"` trên MỌI Route Handler đọc dữ liệu theo công ty — đừng dựa vào suy luận "gọi cookies() thì tự động dynamic".

**Warning signs:** Test tự động: đăng nhập company A gọi endpoint, đăng nhập company B gọi CÙNG endpoint trong cùng phiên test nhanh, so sánh response — nếu giống nhau bất thường, nghi ngờ cache.

### Pitfall 3: Thứ tự sai giữa "xóa cờ must_change_password" và "ép refresh"

**What goes wrong:** Đã ghi trong D-16a — nhưng thêm chi tiết chưa nằm trong CONTEXT: nếu `refreshSession()` được gọi ngay sát `updateUserById()` trong cùng millisecond, và refresh-token-rotation đang bật (`config.toml:171`, xác nhận `enable_refresh_token_rotation = true`), có khả năng gặp lỗi `Invalid Refresh Token: Already Used` nếu có một request refresh khác (ví dụ middleware của chính request đó) đã âm thầm rotate token trước.

**Why it happens:** Refresh token rotation nghĩa là mỗi lần refresh sinh ra refresh token MỚI và vô hiệu hóa token cũ ngay lập tức — hai lệnh refresh gần nhau (một từ middleware, một từ Server Action `completeForcedPasswordChange`) tranh nhau dùng cùng refresh token cũ.

**How to avoid:** Thực hiện chuỗi "update app_metadata → refreshSession → set cookie mới" trong CÙNG MỘT request/Server Action, không phụ thuộc vào middleware của request kế tiếp để refresh hộ. Viết test cụ thể cho chuỗi thao tác này (xem Validation Architecture) thay vì tin code mẫu.

**Warning signs:** Lỗi ngẫu nhiên, khó tái lập, chỉ xảy ra khi test nhanh liên tiếp — dấu hiệu race condition trên refresh token.

### Pitfall 4: Next.js 16 đổi tên `middleware.ts` → `proxy.ts` — không áp dụng ở đây nhưng docs mới đã lẫn thuật ngữ

**What goes wrong:** Docs Supabase hiện tại (fetch 2026-07-31) đã dùng từ "Proxy" thay cho "middleware" trong văn xuôi giải thích, phản ánh Next.js 16 đổi tên file convention `middleware.ts` → `proxy.js`/`proxy.ts` (đọc trực tiếp từ `nextjs.org/docs/messages/middleware-to-proxy`, `nextjs.org/docs/app/api-reference/file-conventions/proxy`, fetch 2026). Người lập kế hoạch dễ nhầm và tạo nhầm file `proxy.ts`.

**Why it happens:** Dự án pin `next@^15.0.0` (xác nhận `package.json`), nơi `middleware.ts` vẫn là convention đúng — Next.js 16 mới đổi. Docs bên thứ ba (Supabase) cập nhật ngôn ngữ theo phiên bản mới nhất của Next.js, tạo cảm giác "phải đổi tên" dù chưa cần.

**How to avoid:** Giữ nguyên `middleware.ts` ở root như CONTEXT.md và ROADMAP.md đã chỉ định tường minh (AUTH-02: "Route được bảo vệ ở `middleware.ts`"). Không đổi tên file theo docs Supabase/Next.js mới nhất trừ khi dự án nâng cấp lên `next@16`, việc đó ngoài phạm vi Phase 2.

**Warning signs:** Không có — đây là phòng ngừa nhầm lẫn khi đọc tài liệu mới trong lúc implement, không phải bug runtime.

## Code Examples

### D-19a — ESLint rule cấm `new Date()`/`Date.now()` trong file `"use client"`

Không có plugin ESLint có sẵn nào làm đúng việc này (đã tìm, không tìm thấy plugin match "chỉ cấm trong file có directive use client") `[CITED: kết quả WebSearch, không tìm thấy phản chứng]`. Hai lựa chọn khả thi, cả hai đều để lại cho planner (Claude's Discretion):

**Lựa chọn A — glob theo đường dẫn đã biết (đơn giản hơn, ăn theo quy ước đặt tên hiện có `*-view.tsx`, `src/components/**`):**
```javascript
// eslint.config.mjs -- thêm vào mảng eslintConfig hiện có
{
  files: ["src/app/**/*-view.tsx", "src/components/**/*.tsx", "src/hooks/**/*.ts"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "NewExpression[callee.name='Date']",
        message: "D-19a: không dùng new Date() trong client component -- nhận 'today' từ prop server-side (xem src/lib/today.ts).",
      },
      {
        selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
        message: "D-19a: không dùng Date.now() trong client component.",
      },
    ],
  },
},
```
**Rủi ro của Lựa chọn A:** glob phải được cập nhật thủ công mỗi khi thêm thư mục client component mới — có thể bỏ sót.

**Lựa chọn B — custom rule đọc directive thật (chính xác hơn, tốn công viết hơn):**
```javascript
// eslint-rules/no-date-in-client.mjs
export default {
  meta: { type: "problem" },
  create(context) {
    const program = context.sourceCode.ast;
    const hasUseClient = program.body[0]?.type === "ExpressionStatement"
      && program.body[0].expression.type === "Literal"
      && program.body[0].expression.value === "use client";
    if (!hasUseClient) return {};
    return {
      "NewExpression[callee.name='Date']"(node) {
        context.report({ node, message: "D-19a: cấm new Date() trong client component." });
      },
      "CallExpression[callee.object.name='Date'][callee.property.name='now']"(node) {
        context.report({ node, message: "D-19a: cấm Date.now() trong client component." });
      },
    };
  },
};
```
`[ASSUMED]` — cấu trúc `Program.body[0]` cho directive prologue là hành vi ESTree chuẩn (mọi parser tuân ESTree, gồm cả `@typescript-eslint/parser` mà `next/typescript` config dùng, đặt directive string literal làm `ExpressionStatement` đầu `Program.body`) nhưng chưa được chạy thử thật trong phiên nghiên cứu này — planner/executor phải chạy `eslint --print-config` hoặc test thủ công trên một file mẫu trước khi tin cấu trúc AST này khớp 100% với parser hiện tại của dự án (`@typescript-eslint` qua `eslint-config-next`).

Đăng ký local rule trong flat config cần thêm một `plugins` key trỏ tới file trên — chi tiết cú pháp plugin-loading cụ thể cho ESLint 9 flat config nên được xác nhận lại lúc viết code (không xác minh execution thật trong phiên nghiên cứu này).

### Server-supplied "today" — không hydration mismatch

```typescript
// src/lib/today.ts (server-only)
import { headers } from "next/headers"; // ép Server Component này luôn dynamic

export async function getServerToday(): Promise<string> {
  // Không new Date() -- lấy "instant hiện tại" rồi quy đổi qua đúng quy ước
  // Phase 1 đã dựng (tf_tz/tf_work_date), KHÔNG tự viết offset UTC+7 khác.
  const supabase = await createClient();
  const { data } = await supabase.rpc("tf_work_date", { p_instant: new Date().toISOString() });
  // Lưu ý: new Date() Ở ĐÂY hợp lệ -- đây LÀ server component/module, không
  // phải "use client". D-19/D-19a chỉ cấm trong client component.
  return data as string; // "YYYY-MM-DD"
}
```
```tsx
// src/app/admin/dashboard/page.tsx (Server Component, không "use client")
import { getServerToday } from "@/lib/today";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  const today = await getServerToday();
  return <DashboardView today={today} />; // truyền xuống làm prop, KHÔNG tự tính lại
}
```
`dashboard-view.tsx` hiện đang `import { REFERENCE_DATE } from "@/lib/constants"` và `const [date, setDate] = React.useState(REFERENCE_DATE)` (`src/app/admin/dashboard/dashboard-view.tsx:19,25` `[VERIFIED: src/app/admin/dashboard/dashboard-view.tsx:19,25]` — quote nguyên văn: `import { REFERENCE_DATE } from "@/lib/constants";` và `const [date, setDate] = React.useState(REFERENCE_DATE);`) — sửa thành nhận `today: string` qua props và seed `useState(today)`, không đổi logic `setDate` (người dùng vẫn đổi ngày xem trên UI, chỉ giá trị khởi tạo đổi nguồn).

**9 file bám `REFERENCE_DATE` cần rà từng file (không phải find/replace máy móc — mỗi usage site có ý nghĩa khác nhau):**
```
src/app/admin/dashboard/dashboard-view.tsx        (useState khởi tạo -- đổi sang prop)
src/app/employee/employee-home-view.tsx           (nhiều chỗ dùng làm "hôm nay" -- prop)
src/components/employee-app/request-form-sheet.tsx (default value form -- prop hoặc context)
src/components/employees/employee-form.tsx        (default startDate -- CÓ THỂ vẫn hợp lệ
                                                    giữ nguyên nếu ý nghĩa là "hôm nay khi tạo
                                                    mới", cần xác nhận ý định nghiệp vụ, không
                                                    phải xóa máy móc)
src/lib/auth/session-provider.tsx                 (signedInAt -- thay bằng session.created_at
                                                    thật từ Supabase, không phải "today")
src/lib/constants.ts                              (định nghĩa REFERENCE_DATE/REFERENCE_MONTH
                                                    -- xóa SAU CÙNG, sau khi 8 file kia hết import)
src/lib/mock/db.ts                                (xóa cả file theo DATA-05)
src/lib/mock/seed.ts                              (xóa cả file theo DATA-05)
src/lib/mock/service.ts                           (thay thân hàm, DATA-05)
```
`[VERIFIED: kết quả Grep REFERENCE_DATE trong src/, chạy trực tiếp phiên này]` — danh sách trên khớp đúng grep thật, không phải chép lại từ CONTEXT.md mà không kiểm chứng lại.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | Đã deprecated trước 2026 | Không áp dụng cho project này — project chưa cài package nào, đi thẳng lên `@supabase/ssr` |
| `getUser()` mặc định mọi nơi | `getClaims()` ưu tiên cho project khóa bất đối xứng, `getUser()` chỉ còn cho project khóa đối xứng | Mặc định Supabase chuyển sang khóa bất đối xứng cho project mới | Cần xác nhận loại khóa JWT thật của project TimeFlow trước khi chốt dùng hàm nào (xem Pattern 3) |
| `middleware.ts` | `proxy.ts` (Next.js 16) | Next.js 16 (dự án đang ở Next 15.x, KHÔNG áp dụng) | Chỉ là lưu ý tránh nhầm lẫn khi đọc docs mới trong lúc implement Phase 2 |
| Cookie adapter `get`/`set`/`remove` | `getAll()`/`setAll()` | Đã đổi trước 2026, là chuẩn hiện tại của `@supabase/ssr` | Bất kỳ code mẫu cũ nào dùng `get`/`set`/`remove` là lỗi thời, không copy |

**Deprecated/outdated:** `@supabase/auth-helpers-nextjs` — không liên quan project này vì chưa từng cài.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Project Supabase thật của TimeFlow dùng khóa JWT bất đối xứng (ES256/JWKS), cho phép `getClaims()` không cần round-trip mạng | Pattern 3 | Nếu sai (project còn khóa đối xứng legacy), `getClaims()` có thể không hoạt động như mong đợi hoặc trả kết quả không nhất quán — middleware phải dùng `getUser()` thay thế. Phải xác nhận qua Dashboard trước khi viết `getSessionContext()`. |
| A2 | `config.toml` của project này không tự động áp dụng cho project cloud đã link (vì workflow dùng `db:push` trực tiếp qua psql/npx, không qua `supabase start`) | Pattern 9 | Nếu có lệnh `supabase config push` áp dụng được, sửa `config.toml` một mình là đủ và đơn giản hơn — nhưng nếu tin nhầm điều này mà không verify bằng `curl /signup`, D-13a (tắt đăng ký công khai) có thể KHÔNG thực sự có hiệu lực trên production, để lộ endpoint đăng ký công khai. |
| A3 | Cấu trúc AST `Program.body[0]` là nơi directive `"use client"` xuất hiện, khớp parser `@typescript-eslint/parser` mà dự án dùng qua `eslint-config-next` | Code Examples §D-19a Lựa chọn B | Nếu parser đặt directive ở vị trí khác hoặc dùng node type khác, custom rule không bắt được bất kỳ vi phạm nào — cưỡng chế D-19a thất bại âm thầm (rule chạy nhưng luôn pass). |
| A4 | `refreshSession()` gọi từ server client (cookie-bound qua `@supabase/ssr`) sẽ ghi cookie mới lên response của cùng request qua cơ chế `setAll` đã đăng ký, không cần thêm bước thủ công | Pattern 8 | Nếu sai, cookie session không được cập nhật sau bước 2 của D-16a, và middleware ở request tiếp theo vẫn đọc JWT cũ — lặp lại đúng bug D-16a đã cảnh báo dù đã "làm đúng thứ tự". |
| A5 | Route Handler gọi `cookies()` gián tiếp qua `getSessionContext()` không đủ để Next.js 15 tự động coi route là dynamic trong MỌI trường hợp, nên cần khai `force-dynamic` tường minh | Pitfall 2 | Nếu Next.js 15 luôn tự động opt-out cache khi có bất kỳ lệnh gọi `cookies()` nào trong call stack (kể cả gián tiếp), khai báo tường minh là dư thừa nhưng vô hại — rủi ro chỉ một chiều (an toàn thừa), không phải rủi ro đúng/sai nguy hiểm. |

**Nếu bảng trên trống:** không áp dụng — có 5 mục cần xác nhận trước khi khóa thành quyết định thực thi.

## Open Questions

1. **Project Supabase thật đang dùng khóa JWT loại nào (đối xứng hay bất đối xứng)?**
   - What we know: mặc định hiện tại của Supabase cho project mới là bất đối xứng; project TimeFlow đã tồn tại từ Phase 1 (đã có `docs/env` với `SUPABASE_SERVICE_ROLE_KEY`).
   - What's unclear: ngày tạo project thật và cấu hình JWT hiện tại — không truy cập được Dashboard trong phiên nghiên cứu.
   - Recommendation: Task đầu tiên của plan nên là "kiểm tra Dashboard → Settings → API → JWT Keys, ghi kết quả vào SUMMARY", quyết định `getClaims()` hay `getUser()` dựa trên kết quả đó, không giả định trước.

2. **`config.toml` có áp dụng được lên project cloud qua CLI hay không, và bằng lệnh nào?**
   - What we know: docs CLI fetch được trong phiên này không xác nhận cơ chế đẩy config; dự án không dùng local dev stack.
   - What's unclear: phiên bản Supabase CLI thật sẽ dùng lúc implement có subcommand `config push` (hoặc tương đương) hay không.
   - Recommendation: chạy `npx supabase --help` và `npx supabase config --help` (nếu tồn tại) ngay đầu plan liên quan D-13a, thay vì giả định; luôn kết thúc bằng bước `curl /signup` để verify độc lập với cơ chế đã dùng.

3. **`UserSession`/`AppUser` (domain.ts:179-194) chưa có field cho multi-membership hay `mustChangePassword` — cần mở rộng type này thế nào?**
   - What we know: `UserSession` hiện tại (`companyId`, `role`, `signedInAt`) là shape V1 một-công-ty. AUTH-05 yêu cầu chọn công ty và AUTH-04 yêu cầu buộc đổi mật khẩu — cả hai cần state UI không có trong type hiện tại.
   - What's unclear: đây có nên là field mới trên `UserSession`, hay một type riêng (`SessionContext` ở server, khác `UserSession` ở client) — CONTEXT.md để "hình dạng cụ thể của `getSessionContext()`" là Claude's Discretion, nhưng không nói rõ `UserSession`/`domain.ts` có được sửa hay không.
   - Recommendation: planner nên quyết định tường minh trong PLAN.md liệu `domain.ts` có bị sửa (thêm field) hay giữ nguyên và dùng type server-only riêng — đây là quyết định kiến trúc nhỏ nhưng ảnh hưởng nhiều file, nên chốt sớm ở plan đầu tiên của phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Toàn bộ phase (build, script) | ✓ (theo CLAUDE.md) | 22.18.0 | — |
| npm registry access | `npm install`, `npm view` | ✓ | — | — |
| `npx supabase` CLI | `db:push`/`db:seed`/config verification | Không kiểm chứng được trong phiên này (không chạy `npx supabase --version`) | — | Nếu thiếu, `scripts/db.mjs` đã tự gọi `npx supabase ...`, npm sẽ tự tải nếu chưa cache — không cần cài global |
| `psql` | `scripts/db.mjs` seed/test | Không kiểm chứng trong phiên này | — | `scripts/db.mjs` đã có logic dò tìm `psql.exe` trên Windows qua `where`/thư mục cài PostgreSQL mặc định — nếu thiếu, script tự thoát với thông báo rõ ràng |
| Supabase Dashboard access (để xác nhận JWT key type, tắt signup) | Pattern 3, Pattern 9 | Không có trong phiên nghiên cứu (không phải môi trường có quyền) | — | Không có fallback — đây là `checkpoint:human-action` bắt buộc ở đầu plan |
| `.env.local` với `POSTGRES_URL_NON_POOLING` + Supabase keys | Toàn bộ phase | Không đọc được trong phiên này (permission denied khi thử `cat`) | — | Giả định tồn tại theo Phase 1 (AUTH-06 đã verify `check:secrets` chạy được) — planner nên xác nhận lại đầu phase, không giả định nội dung |

**Missing dependencies with no fallback:**
- Quyền truy cập Supabase Dashboard/Management API để xác nhận loại khóa JWT (A1) và tắt `disable_signup` (Open Question 2) — cả hai cần một `checkpoint:human-action` sớm trong plan.

**Missing dependencies with fallback:**
- `npx supabase` CLI và `psql` — cơ chế dò tìm/tải đã có sẵn trong `scripts/db.mjs`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.10` (chưa cài — xem §Standard Stack) + pgTAP (đã có, `supabase/tests/`) |
| Config file | `vitest.config.mts` (mới, chưa tồn tại — Wave 0) |
| Quick run command | `npx vitest run <file>` (sau khi cài); pgTAP: `npm run test:rls` |
| Full suite command | `npm run test` (mới, thêm vào `package.json`); `npm run test:db` (pgTAP, đã có) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| AUTH-01 | Đăng nhập, phiên ở cookie, sống qua đóng/mở trình duyệt | manual-only (browser session lifecycle không test được bằng Vitest/pgTAP) | UAT thủ công theo redirect graph (Pitfall 12 của PITFALLS.md) | ❌ Wave 0 — không có test tự động khả thi cho hành vi "sống qua đóng/mở trình duyệt thật" |
| AUTH-02 | Route bị chặn ở `middleware.ts` trước khi render | unit (logic redirect) + manual (chạy thật) | `npx vitest run src/__tests__/middleware-logic.test.ts` (test hàm logic tách khỏi Next runtime, ví dụ hàm quyết định "path nào cần chặn") | ❌ Wave 0 |
| AUTH-03 | 4 vai trò thấy/làm đúng phần của mình | unit (requireRole/getSessionContext logic, mock Supabase client) | `npx vitest run src/lib/auth/__tests__/get-session-context.test.ts` | ❌ Wave 0 |
| AUTH-04 | Tạo tài khoản kèm mật khẩu tạm, buộc đổi lần đầu | integration (pgTAP cho app_metadata flag qua fixture, hoặc Vitest mock `auth.admin`) | `npm run test:db` (nếu mở rộng fixture) hoặc `npx vitest run src/lib/data/mutations/__tests__/create-employee-account.test.ts` | ❌ Wave 0 |
| AUTH-05 | Company hiện hành từ session server, không từ client | unit (adversarial: gửi `company_id` giả trong request, assert bị bỏ qua) | `npx vitest run src/app/api/**/__tests__/*.test.ts` | ❌ Wave 0 |
| DATA-05 | `service.ts` thay thân, giữ chữ ký; `mock/db.ts`/`seed.ts` xóa | unit (mỗi hàm data layer) + `npm run typecheck` (chữ ký không đổi) | `npm run typecheck && npx vitest run src/lib/data` | ❌ Wave 0 (file `src/lib/data/` chưa tồn tại) |
| DATA-06 | Mọi ghi có audit log (before/after/actor/reason) | pgTAP (audit_log RLS đã có ở Phase 1) + Vitest (logMutation gọi đúng tham số) | pgTAP mới trong `supabase/tests/06_audit_log.sql` + `npx vitest run src/lib/data/__tests__/audit.test.ts` | ❌ Wave 0 cho cả hai file |
| DATA-08 | Không `REFERENCE_DATE`, không lỗi hydration | unit (ESLint rule D-19a tự nó LÀ test) + manual (console hydration warning) | `npm run lint` (bắt `new Date()` trong client) + UAT thủ công | ❌ Wave 0 (rule ESLint D-19a chưa tồn tại) |
| D-12c (không phải REQ nhưng có checkpoint bắt buộc theo CONTEXT) | Route Handler không có method nào ngoài GET | unit — test tĩnh quét file `route.ts` không export POST/PUT/DELETE/PATCH | `npx vitest run src/__tests__/route-handler-get-only.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run <file thay đổi>` (chạy nhanh, không toàn bộ suite)
- **Per wave merge:** `npm run test` (Vitest full) + `npm run test:db` (pgTAP full, đã có 170+ assertion từ Phase 1, D-15a yêu cầu không giảm)
- **Phase gate:** Cả hai lệnh full suite phải xanh trước `/gsd-verify-work`, cộng với UAT thủ công cho AUTH-01 (redirect graph, session sống qua đóng/mở trình duyệt) — hạng mục này không thể tự động hóa hoàn toàn.

### Wave 0 Gaps

- [ ] `vitest.config.mts` — chưa tồn tại, cần tạo theo mẫu chính thức (§Standard Stack)
- [ ] `package.json` script `"test": "vitest"` — chưa có
- [ ] `src/lib/auth/__tests__/get-session-context.test.ts` — test logic phân quyền cốt lõi
- [ ] `src/__tests__/route-handler-get-only.test.ts` — cưỡng chế cơ học D-12c (quét static tất cả `route.ts` dưới `src/app/api/`, assert chỉ export `GET`)
- [ ] `supabase/tests/06_audit_log.sql` — pgTAP mới cho DATA-06 (chưa tồn tại, `audit_log` RLS đã có từ Phase 1 nhưng chưa có test cho nội dung ghi)
- [ ] `eslint-rules/no-date-in-client.mjs` hoặc override glob tương đương — D-19a chưa tồn tại, bản thân việc "rule chạy và bắt được vi phạm" cần một fixture file cố ý vi phạm để test rule không pass giả (xem A3 ở Assumptions Log)
- [ ] Fixture pgTAP cho `platform_admins`/`tf_is_platform_admin()` (D-11) — bảng/hàm mới, cần ít nhất 2 assertion (true/false) theo giới hạn đã ghi ở D-11

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | yes | Supabase Auth (`@supabase/ssr`), không tự viết password hashing/session token |
| V3 Session Management | yes | Cookie HTTP-only qua `@supabase/ssr`, refresh qua middleware, `getClaims()`/`getUser()` — không bao giờ `getSession()` server-side |
| V4 Access Control | yes | `getSessionContext()` làm điểm chặn duy nhất (D-12a) + RLS làm lớp 2; role-based qua `CompanyRole`/`requireRole()` |
| V5 Input Validation | yes | Zod schema dùng chung ở cả Route Handler response và fetcher (D-12d); `EmployeeInput`/`*Input` type đã có, tái dùng cho Server Action input |
| V6 Cryptography | yes (gián tiếp) | Không tự làm — JWT signing key do Supabase quản lý; secret/service_role key không bao giờ ở client (đã có cổng `check:secrets` từ Phase 1, AUTH-06) |

### Known Threat Patterns for stack này

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| CSRF trên đường ghi qua Route Handler nếu lỡ thêm `POST` | Tampering/Spoofing | D-12c: chỉ `GET` trên Route Handler, mọi ghi qua Server Action (built-in origin check) — có test cơ học chặn (xem Wave 0 Gaps) |
| Client gửi `company_id`/role giả qua query param/body | Elevation of Privilege, Tampering | `getSessionContext()` không bao giờ nhận input từ client cho các trường này (D-12b); adversarial test bắt buộc: gửi `?company=<company khác>`, assert bị bỏ qua |
| Session cookie bị đọc/sửa qua middleware trả sai response | Spoofing, Denial of Service (tự khóa người dùng hợp lệ) | Pattern 2 (tái sử dụng đúng response object) |
| `service_role`/secret key lọt vào Server Action chạy sai chỗ hoặc vào client bundle | Information Disclosure, Elevation of Privilege | Chỉ dùng trong `scripts/seed-auth.mjs` và một module server hẹp cho `auth.admin.*`; cổng `check:secrets` (Phase 1, AUTH-06) đã quét `.next/static`/`.next/server/app` |
| `app_metadata.must_change_password` bị đọc nhầm từ `user_metadata` (client sửa được) | Elevation of Privilege | D-16 đã khóa: chỉ `app_metadata`, không bao giờ `user_metadata`; code review/test nên assert field đọc đúng namespace |
| RLS bị bỏ qua vì Server Action dùng nhầm client `service_role` cho truy vấn thường | Elevation of Privilege | Chỉ Route Handler/Server Action thường dùng client cookie-bound (`authenticated` role); `service_role` chỉ trong `seed-auth.mjs` và các thao tác admin API tường minh (tạo tài khoản) |

## Sources

### Primary (HIGH confidence — verified via tool this session)
- `npm view @supabase/supabase-js version` / `npm view @supabase/ssr version` / `npm view @supabase/ssr peerDependencies` — chạy trực tiếp phiên này, xác nhận `2.111.0` / `0.12.4` / peer khớp
- `npm view vitest|@vitejs/plugin-react|vite-tsconfig-paths|@testing-library/react version` — chạy trực tiếp phiên này
- `gsd_run query package-legitimacy check` — verdict SUS/OK cho 8 gói, chạy trực tiếp phiên này
- Đọc trực tiếp `supabase/config.toml`, `supabase/migrations/0002_tenancy.sql`, `0003_enums_time.sql`, `0004_core_entities.sql`, `0005_v2_tables.sql`, `supabase/tests/helpers.sql`, `00_rls_coverage.sql`, `05_seed_fixture.sql`, `scripts/db.mjs`, `src/lib/types/domain.ts`, `src/lib/constants.ts`, `src/lib/auth/session-provider.tsx`, `src/hooks/use-mock-query.ts`, `src/lib/mock/store.tsx`, `eslint.config.mjs`, `package.json` — tất cả đọc trực tiếp trong phiên này

### Secondary (MEDIUM/CITED — official docs fetched this session, cross-checked)
- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — cookie adapter, getClaims/getUser guidance
- [JavaScript: getClaims | Supabase Docs](https://supabase.com/docs/reference/javascript/auth-getclaims)
- [JavaScript: getUser | Supabase Docs](https://supabase.com/docs/reference/javascript/auth-getuser)
- [JavaScript: getSession | Supabase Docs](https://supabase.com/docs/reference/javascript/auth-getsession)
- [JavaScript: refreshSession | Supabase Docs](https://supabase.com/docs/reference/javascript/auth-refreshsession)
- [admin.createUser | Supabase Docs](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [CLI config reference | Supabase Docs](https://supabase.com/docs/reference/cli/config)
- [Migrating to new API keys | Supabase Docs](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [How to set up Vitest with Next.js | Next.js Docs](https://nextjs.org/docs/app/guides/testing/vitest)
- [How to Think About Security in Next.js | Next.js Blog](https://nextjs.org/blog/security-nextjs-server-components-actions) — Server Action CSRF/origin check
- [Renaming Middleware to Proxy | Next.js Docs](https://nextjs.org/docs/messages/middleware-to-proxy) — chỉ liên quan Next 16, không áp dụng phase này
- [File-system conventions: proxy.js | Next.js Docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- GitHub Discussion supabase/supabase #34842, Issue #27505 — middleware response footgun, cross-checked qua bài viết cộng đồng độc lập
- GitHub Discussion supabase #10592, supabase-js Issue #1717/#755 — app_metadata refresh timing, "Invalid Refresh Token: Already Used"

### Tertiary (LOW confidence — web search only, chưa cross-check với nguồn chính thức thứ hai)
- eslint no-restricted-syntax selector cho `NewExpression`/`CallExpression` — cú pháp chuẩn ESLint, xác nhận qua eslint.org docs, nhưng việc scope theo directive "use client" là suy luận kỹ thuật (A3), chưa chạy thử thật

## Metadata

**Confidence breakdown:**
- Standard stack (version số): HIGH — verified qua `npm view` trực tiếp phiên này
- Package legitimacy: MEDIUM — verdict SUS do "too-new" false positive đã giải thích, nhưng planner vẫn phải gate `checkpoint:human-verify` theo protocol
- Kiến trúc ba-client/middleware/CSRF: MEDIUM (CITED) — nguồn chính thức + cross-check cộng đồng, nhưng không có Context7 để xác nhận tuyệt đối
- `app_metadata` JWT refresh timing: MEDIUM (CITED) — cross-checked 2 nguồn độc lập nhưng cơ chế chính xác chưa test runtime thật
- `disable_signup` trên cloud vs config.toml: LOW (ASSUMED, Open Question) — docs fetch được không xác nhận cơ chế, cần verify tại thời điểm implement
- Custom ESLint rule D-19a: LOW (ASSUMED) — chưa chạy thử AST thật trong phiên này
- Giá trị enum/schema thật từ codebase (`CompanyRole`, `company_role`, `audit_log`, `REFERENCE_DATE` usage sites): HIGH — đọc trực tiếp file nguồn, quote verbatim kèm số dòng

**Research date:** 2026-07-31
**Valid until:** 14 ngày (Supabase JS/SSR và Next.js đổi API khá thường xuyên — đặc biệt Next 16 rename middleware→proxy đang diễn ra; nên tái xác nhận version/pattern nếu plan bị trì hoãn quá 2 tuần)
