# Phase 6 — Super admin và hỗ trợ nhiều doanh nghiệp: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đội vận hành TimeFlow nhìn được toàn hệ thống và mở được một phiên hỗ trợ có
thời hạn vào đúng một doanh nghiệp, để đọc dữ liệu của họ qua chính giao diện quản trị
đã có — mà không doanh nghiệp nào bị nhìn thấy ngoài phiên đó và không một bản ghi
chấm công hay dòng lương nào sửa được từ đường này.

**Architecture:** Quyền đọc xuyên doanh nghiệp suy ra từ một **phiên hỗ trợ có hạn**
(`support_sessions` + `tf_has_support_access()`), không suy từ danh tính. 23 policy
`select` mở thêm một nhánh; ba lệnh ghi giữ nguyên `tf_is_member`. Ở tầng ứng dụng,
`getSessionContext()` mọc đúng một nhánh trả `role: "support"`, và ranh giới đọc/ghi
tách bằng hai vị ngữ: `canReadCompanyData()` cho Route Handler, `requireRole()` cho
Server Action (không sửa file mutation nào).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Supabase
(Postgres + Auth + Storage), Zod, Vitest, pgTAP.

**Spec:** `docs/superpowers/specs/2026-08-10-phase-6-super-admin-design.md` (D-49…D-56)

## Global Constraints

- TypeScript strict — **không** dùng `any` ở bất kỳ file nào của phase này.
- Import tuyệt đối bằng `@/` — không dùng đường dẫn tương đối.
- Giao diện tiếng Việt; nhãn nằm ở `src/lib/constants.ts`; enum nghiệp vụ tiếng Anh.
- Mỗi khu vực chỉ **một** nút filled indigo; gradient mesh chỉ ở login và onboarding.
- Mọi Route Handler dưới `src/app/api/` **chỉ được export `GET`** (+ `dynamic`) — cổng
  `src/__tests__/route-handlers-get-only.test.ts`.
- `createAdminSupabase()` **chỉ** được import từ file có `"use server"` ở đầu hoặc nằm
  dưới `src/lib/data/mutations/` — cổng `src/__tests__/admin-client-scope.test.ts`.
  Cổng này **không được nới** trong phase này.
- `companyId` **luôn** đến từ phiên phía server, **không bao giờ** từ tham số truy vấn
  (D-12b).
- Mọi Server Action ghi phải `logMutation()` **ngay trong cùng hàm** (D-17).
- Hàm SQL kiểm quyền: `security definer`, `set search_path = public, pg_temp`, tự lọc
  theo `auth.uid()` bên trong, **không** nhận tham số người dùng (threat T-01-03).
- `supabase/tests/*.sql` **không bao giờ** được đưa vào `supabase/migrations/`
  (threat T-01-04).
- Sàn assertion pgTAP hiện tại là **283** (`npm run check:assertions`) — phase này nâng
  lên **297**.
- Hằng số `SUPPORT_SESSION_MINUTES = 60` là hạ tầng vận hành TimeFlow, **không** rơi
  vào phạm vi cổng `no-hardcoded-work-rules` / `no-hardcoded-money`.
- Commit sau mỗi task. Tiền tố `feat:` / `test:` / `fix:` theo lệ của repo.

---

## File Structure

**Tạo mới:**

| file | trách nhiệm |
|---|---|
| `supabase/migrations/0033_support_sessions.sql` | bảng `support_sessions`, `tf_has_support_access()`, RLS của chính bảng, enum `access`, policy `audit_log_insert_support` |
| `supabase/migrations/0034_support_read_access.sql` | mở nhánh `or tf_has_support_access(...)` cho 22 policy `*_select_member` + `storage.objects` |
| `supabase/migrations/0035_platform_company_overview.sql` | RPC `tf_platform_company_overview()` |
| `supabase/tests/20_support_sessions.sql` | 14 assertion pgTAP cho D-49/D-50/D-55 |
| `src/lib/auth/platform.ts` | `requirePlatformAdmin()` — điểm chặn danh tính của khu `/platform` |
| `src/lib/data/mutations/platform-sessions.ts` | `openSupportSession()`, `closeSupportSession()` |
| `src/lib/data/mutations/platform.ts` | hai đường ghi trắng của SADM-04 |
| `src/lib/data/platform.ts` | client đọc: `listPlatformCompanies()`, `listSupportSessions()` |
| `src/lib/validation/api/platform.ts` | schema Zod cho hai hình dạng phản hồi |
| `src/app/api/platform/companies/route.ts` | `GET` — danh sách toàn hệ thống (SADM-01) |
| `src/app/api/platform/sessions/route.ts` | `GET` — nhật ký phiên hỗ trợ (SADM-03) |
| `src/app/platform/layout.tsx` | khung khu vận hành, chặn bằng `requirePlatformAdmin()` |
| `src/app/platform/page.tsx` + `platform-view.tsx` | danh sách doanh nghiệp + hộp thoại mở phiên |
| `src/app/platform/log/page.tsx` + `support-log-view.tsx` | nhật ký phiên |
| `src/components/layout/support-banner.tsx` | banner dính đỉnh + đếm ngược + nút đóng phiên |
| `src/__tests__/no-inline-admin-role.test.ts` | cổng cơ học của D-52 |
| `scripts/e2e-support.mjs` | e2e vòng đời một phiên hỗ trợ qua HTTP thật |

**Sửa:**

| file | sửa gì |
|---|---|
| `src/lib/auth/session-context.ts` | `AccessRole`, nhánh `support`, `canReadCompanyData()`, `ADMIN_AREA_ROLES` |
| `src/lib/types/domain.ts:669` | `AppUser.employeeId` → `string \| null` |
| `src/lib/auth/session-provider.tsx` | thêm `useEmployeeSession()` |
| 13 file dưới `src/app/api/**` | `requireRole(role, ["owner","admin"])` → `canReadCompanyData(role)` |
| 6 file dưới `src/app/api/**` | bỏ `isAdminRole` tính inline |
| 6 file dưới `src/app/employee/**` + `employee-shell.tsx` | dùng `useEmployeeSession()` |
| `src/app/api/companies/route.ts` | nhánh trả doanh nghiệp đang có phiên hỗ trợ |
| `src/components/layout/admin-shell.tsx` | gắn `SupportBanner` |
| `supabase/tests/run-all.sql` | thêm `\ir 20_support_sessions.sql` |
| `scripts/check-pgtap-assertions.mjs` | sàn 283 → 297 |
| `package.json` | thêm script `test:e2e-support` |
| `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md` | đánh dấu SADM-01…04 |

---

## Task 1: Bảng `support_sessions` và hàm `tf_has_support_access()`

**Files:**
- Create: `supabase/migrations/0033_support_sessions.sql`
- Create: `supabase/tests/20_support_sessions.sql`
- Modify: `supabase/tests/run-all.sql`
- Modify: `scripts/check-pgtap-assertions.mjs` (sàn 283 → 291)

**Interfaces:**
- Produces: bảng `support_sessions(id, platform_admin_id, company_id, reason, opened_at, expires_at, closed_at)`; hàm `public.tf_has_support_access(p_company_id text) returns boolean`; giá trị enum `audit_action.'access'`; policy `audit_log_insert_support`. Task 2 mở RLS đọc dựa trên hàm này; Task 3 ghi vào bảng này.
- Consumes: `public.tf_is_platform_admin()` (`0006_platform_admins.sql`), `public.tf_is_member(text)` (`0002_tenancy.sql`), fixture user `00000000-0000-0000-0000-000000000004` (`supabase/tests/00_fixture_users.sql`).

- [ ] **Step 1: Viết test thất bại**

Tạo `supabase/tests/20_support_sessions.sql` với 8 assertion đầu (6 assertion còn lại
thêm ở Task 2):

```sql
-- supabase/tests/20_support_sessions.sql
--
-- pgTAP cho phien ho tro (D-49/D-50/D-55). User 0004 la platform admin va
-- KHONG thuoc doanh nghiep nao (fixture 00_fixture_users.sql) — dung lam
-- nguoi mo phien. Khuon begin/plan/finish/rollback nhu 06_platform_admins.sql.

begin;

select plan(8);

/* ============================================================================
   1-2. Bang co mat, bat RLS
   ========================================================================= */

select has_table('public', 'support_sessions', 'support_sessions: bang ton tai');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.support_sessions'::regclass),
  'support_sessions: relrowsecurity = true'
);

/* ============================================================================
   3-5. tf_has_support_access: chua co phien -> false; co phien con han ->
        true cho DUNG cty do va false cho cty khac
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select ok(
  not public.tf_has_support_access('cty-01'),
  'tf_has_support_access: false khi user 0004 chua mo phien nao'
);

select tf_test_logout();

-- Chen bang vai tro mac dinh cua ket noi (chu bang, bo qua RLS) de tach
-- phep chen ra khoi thu dang duoc kiem o day la phep DOC.
insert into support_sessions (platform_admin_id, company_id, reason, expires_at)
  values ('00000000-0000-0000-0000-000000000004', 'cty-01', 'pgTAP', now() + interval '60 minutes');

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select ok(
  public.tf_has_support_access('cty-01'),
  'tf_has_support_access: true cho cty-01 khi phien con han'
);

select ok(
  not public.tf_has_support_access('cty-02'),
  'tf_has_support_access: false cho cty-02 — phien chi mo dung MOT doanh nghiep'
);

select tf_test_logout();

/* ============================================================================
   6. Phien HET HAN khong con hieu luc
   ========================================================================= */

update support_sessions set expires_at = now() - interval '1 minute'
  where platform_admin_id = '00000000-0000-0000-0000-000000000004';

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select ok(
  not public.tf_has_support_access('cty-01'),
  'tf_has_support_access: false khi phien da het han — het han khong can cron'
);

select tf_test_logout();

/* ============================================================================
   7. Nguoi thuong khong bao gio co support access
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000001'::uuid);

select ok(
  not public.tf_has_support_access('cty-01'),
  'tf_has_support_access: false cho owner 0001 — khong phai platform admin thi khong co phien'
);

select tf_test_logout();

/* ============================================================================
   8. Nhat ky khong xoa duoc (D-55: khong co policy delete)
   ========================================================================= */

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select throws_ok(
  $del_ss$delete from support_sessions where company_id = 'cty-01'$del_ss$,
  '42501',
  null,
  'support_sessions: platform admin xoa nhat ky cua chinh minh bi tu choi'
);

select tf_test_logout();

select * from finish(true);

rollback;
```

Thêm vào `supabase/tests/run-all.sql`, ngay sau dòng `\ir 19_payslip_rls.sql`:

```
\ir 20_support_sessions.sql
```

- [ ] **Step 2: Chạy test để xác nhận nó đỏ**

Chạy: `npm run test:db`
Expected: FAIL — `relation "public.support_sessions" does not exist`

> **Nếu môi trường không có `psql`** (đã ghi ở `.planning/STATE.md` từ 04-06 tới
> 05-2-06): ghi lại nguyên văn lỗi vào SUMMARY, đánh dấu file test là **chưa chạy
> thật**, và **vẫn phải** hoàn thành mọi bước còn lại — Task 9 sẽ phủ cùng hành vi
> bằng test tích hợp Vitest trên database thật.

- [ ] **Step 3: Viết migration**

```sql
-- supabase/migrations/0033_support_sessions.sql
--
-- Phien ho tro co thoi han (D-49). Quyen doc xuyen doanh nghiep cua platform
-- admin suy tu MOT PHIEN, khong suy tu danh tinh: mot policy
-- `or tf_is_platform_admin()` gan thang vao 23 bang chinh la "quyen vuot RLS
-- dung chung" ma tieu chi 4 cua Phase 6 loai tru.
--
-- Bang nay CHINH LA nhat ky cua SADM-03 (D-55) — khong dung co che thu hai.

/* -------------------------------------------------------------------------- */
/* (a) Bang                                                                    */
/* -------------------------------------------------------------------------- */

create table support_sessions (
  id uuid primary key default gen_random_uuid(),
  platform_admin_id uuid not null references auth.users (id) on delete cascade,
  company_id text not null references companies (id) on delete cascade,
  -- `reason` not null va khong co gia tri mac dinh: mot phien khong ly do la
  -- mot dong nhat ky khong tra loi duoc cau hoi duy nhat nguoi ta hoi no.
  reason text not null,
  opened_at timestamptz not null default now(),
  expires_at timestamptz not null,
  closed_at timestamptz null,
  constraint support_sessions_expires_after_open check (expires_at > opened_at)
);

create index support_sessions_company_id_opened_at_idx
  on support_sessions (company_id, opened_at desc);
create index support_sessions_admin_open_idx
  on support_sessions (platform_admin_id, expires_at)
  where closed_at is null;

/* -------------------------------------------------------------------------- */
/* (b) Ham kiem tra — cung khuon bao ve tf_is_member (0002_tenancy.sql:63-77) */
/* -------------------------------------------------------------------------- */

-- KHONG nhan tham so user: nhan user_id tu ben ngoai se mo cua cho ke tan
-- cong truyen user_id bat ky (threat T-01-03). Ham tu loc theo auth.uid().
-- So `now() < expires_at` moi lan goi nghia la phien TU CHET o tang database,
-- khong tien trinh nen nao phai chay de thu hoi quyen.
create function public.tf_has_support_access(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from support_sessions
    where company_id = p_company_id
      and platform_admin_id = (select auth.uid())
      and closed_at is null
      and now() < expires_at
  );
$$;

revoke execute on function public.tf_has_support_access(text) from public;
grant execute on function public.tf_has_support_access(text) to authenticated;

/* -------------------------------------------------------------------------- */
/* (c) RLS cua chinh bang support_sessions                                     */
/* -------------------------------------------------------------------------- */

alter table support_sessions enable row level security;

-- Doc: platform admin doc duoc moi dong; VA thanh vien doanh nghiep doc duoc
-- dong cua doanh nghiep MINH. Ve thu hai la tinh nang chu khong phai ro ri:
-- khach hang co quyen biet doi van hanh da vao du lieu cua ho luc nao.
create policy support_sessions_select_admin_or_member on support_sessions
  for select
  using (
    public.tf_is_platform_admin()
    or public.tf_is_member(company_id)
  );

-- Ghi: chi platform admin, va chi dong mang ten CHINH MINH.
create policy support_sessions_insert_platform_admin on support_sessions
  for insert
  with check (
    public.tf_is_platform_admin()
    and platform_admin_id = (select auth.uid())
  );

-- Cap nhat: chi de dat `closed_at`. Khong the doi chu so huu dong nho
-- dieu kien platform_admin_id o ca using lan with check.
create policy support_sessions_update_own on support_sessions
  for update
  using (
    public.tf_is_platform_admin()
    and platform_admin_id = (select auth.uid())
  )
  with check (
    public.tf_is_platform_admin()
    and platform_admin_id = (select auth.uid())
  );

-- KHONG CO policy delete — nhat ky khong xoa duoc. RLS bat ma khong co policy
-- cho mot lenh nghia la lenh do bi tu choi mac dinh.

/* -------------------------------------------------------------------------- */
/* (d) audit_log: gia tri enum moi + duong ghi cho phien ho tro (D-55)        */
/* -------------------------------------------------------------------------- */

-- `access` la hanh dong thu tu ben canh insert/update/delete: doi van hanh
-- KHONG doi du lieu, ho DOC no — va chinh viec doc do la thu can ghi vet.
alter type audit_action add value if not exists 'access';

-- Policy `audit_log_insert_member` hien co doi tf_is_member(company_id) nen
-- platform admin (khong la thanh vien) khong lot qua. Duong ghi rieng nay
-- chi mo cho dung doanh nghiep dang co phien.
create policy audit_log_insert_support on audit_log
  for insert
  with check (public.tf_has_support_access(company_id));
```

> **Lưu ý thứ tự:** `alter type ... add value` không chạy được trong cùng transaction
> với lệnh dùng giá trị mới trên một số phiên bản Postgres. Migration này **không**
> dùng `'access'` ở đâu cả (chỉ khai báo), nên an toàn. Task 3 mới là nơi dùng nó, và
> lúc đó `alter type` đã commit từ lâu.

- [ ] **Step 4: Đẩy schema và chạy lại test**

Chạy: `npm run db:push` rồi `npm run test:db`
Expected: PASS — `20_support_sessions.sql` xanh 8/8, và **19 file test cũ vẫn xanh
không sửa một dòng nào**.

- [ ] **Step 5: Nâng sàn assertion**

Trong `scripts/check-pgtap-assertions.mjs`, đổi sàn `283` thành `291`.

Chạy: `npm run check:assertions`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0033_support_sessions.sql supabase/tests/20_support_sessions.sql supabase/tests/run-all.sql scripts/check-pgtap-assertions.mjs
git commit -m "feat: bang support_sessions va tf_has_support_access (D-49)"
```

---

## Task 2: Mở nhánh đọc cho 22 policy và bucket ảnh

**Files:**
- Create: `supabase/migrations/0034_support_read_access.sql`
- Modify: `supabase/tests/20_support_sessions.sql` (thêm 6 assertion, `plan(8)` → `plan(14)`)
- Modify: `scripts/check-pgtap-assertions.mjs` (sàn 291 → 297)

**Interfaces:**
- Consumes: `public.tf_has_support_access(text)` từ Task 1.
- Produces: mọi policy `*_select_member` nhận thêm nhánh phiên hỗ trợ. Task 5 dựa vào
  điều này để Route Handler đọc được dữ liệu; không có Task nào khác đọc DB trực tiếp.

- [ ] **Step 1: Viết test thất bại**

Trong `supabase/tests/20_support_sessions.sql`, đổi `select plan(8);` thành
`select plan(14);` và chèn khối sau **trước** `select * from finish(true);`:

```sql
/* ============================================================================
   9-14. Doc xuyen doanh nghiep qua phien ho tro (D-50)
   ========================================================================= */

-- Mo lai mot phien con han cho cty-01 (phien o muc 6 da bi cho het han).
update support_sessions set expires_at = now() + interval '60 minutes'
  where platform_admin_id = '00000000-0000-0000-0000-000000000004';

select tf_test_login('00000000-0000-0000-0000-000000000004'::uuid);

select ok(
  (select count(*) from employees where company_id = 'cty-01') > 0,
  'employees: platform admin trong phien doc duoc >0 dong cty-01'
);

select is(
  (select count(*)::int from employees where company_id = 'cty-02'),
  0,
  'employees: platform admin trong phien cty-01 doc duoc 0 dong cty-02'
);

select ok(
  (select count(*) from attendance_records where company_id = 'cty-01') > 0,
  'attendance_records: platform admin trong phien doc duoc >0 dong cty-01'
);

select ok(
  (select count(*) from payroll_runs where company_id = 'cty-02') = 0,
  'payroll_runs: platform admin trong phien cty-01 doc duoc 0 dong cty-02'
);

-- Cot loi cua tieu chi 4: DOC mo, GHI khong.
select throws_ok(
  $ins_sup$insert into holidays (company_id, holiday_date, name)
    values ('cty-01', '2030-01-01', 'Phien ho tro khong duoc ghi')$ins_sup$,
  '42501',
  'new row violates row-level security policy for table "holidays"',
  'holidays: platform admin trong phien GHI vao cty-01 bi tu choi — chi mo select'
);

select throws_ok(
  $upd_sup$update employees set full_name = 'Bi sua trom' where company_id = 'cty-01'$upd_sup$,
  '42501',
  null,
  'employees: platform admin trong phien SUA cty-01 bi tu choi'
);

select tf_test_logout();
```

- [ ] **Step 2: Chạy test để xác nhận nó đỏ**

Chạy: `npm run test:db`
Expected: FAIL ở assertion 9 — `platform admin trong phien doc duoc >0 dong cty-01`
trả `false` vì `employees_select_member` chưa có nhánh phiên.

- [ ] **Step 3: Viết migration**

```sql
-- supabase/migrations/0034_support_read_access.sql
--
-- Mo nhanh doc cho phien ho tro (D-50). CHI lenh SELECT. Ba lenh ghi giu
-- nguyen `tf_is_member` — do la cho tieu chi 4 cua Phase 6 duoc thoa o tang
-- database, khong phai bang mot loi hua o tang ung dung.
--
-- KHONG doi: `notifications` (RLS theo NGUOI NHAN chu khong theo doanh
-- nghiep, D-34 — doi ho tro khong co viec gi voi hop thong bao ca nhan) va
-- `platform_admins` (D-11a giu nguyen chan doc truc tiep).

/* -------------------------------------------------------------------------- */
/* (a) 22 policy *_select_member                                               */
/* -------------------------------------------------------------------------- */

alter policy companies_select_member on companies
  using (public.tf_is_member(id) or public.tf_has_support_access(id));

alter policy memberships_select_member on memberships
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy departments_select_member on departments
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy employees_select_member on employees
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy shifts_select_member on shifts
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy attendance_records_select_member on attendance_records
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy work_sites_select_member on work_sites
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy attendance_photos_select_member on attendance_photos
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy holidays_select_member on holidays
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy overtime_rules_select_member on overtime_rules
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy employee_overtime_rates_select_member on employee_overtime_rates
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy company_settings_select_member on company_settings
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy audit_log_select_member on audit_log
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy periods_select_member on periods
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy work_requests_select_member on work_requests
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy request_reviews_select_member on request_reviews
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy pay_adjustments_select_member on pay_adjustments
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy pay_adjustment_scopes_select_member on pay_adjustment_scopes
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy employee_pay_rates_select_member on employee_pay_rates
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy payroll_runs_select_member on payroll_runs
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy payroll_lines_select_member on payroll_lines
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

alter policy payroll_line_items_select_member on payroll_line_items
  using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id));

/* -------------------------------------------------------------------------- */
/* (b) storage.objects — bucket attendance-photos (0012)                       */
/* -------------------------------------------------------------------------- */

-- Khong doi thi anh cham cong tra 403 trong phien ho tro, va man hinh xem lai
-- cua quan tri vo dung voi doi ho tro — dung thu ho can nhat khi tra loi mot
-- cau hoi ho tro ve cham cong.
alter policy attendance_photos_read_member on storage.objects
  using (
    bucket_id = 'attendance-photos'
    and (
      public.tf_is_member(split_part(name, '/', 1))
      or public.tf_has_support_access(split_part(name, '/', 1))
    )
  );
```

> **Trước khi viết mục (b):** chạy
> `grep -n "create policy" supabase/migrations/0012_attendance_photo_storage_rls.sql`
> và dùng **đúng tên policy** có trong file đó. Nếu tên khác
> `attendance_photos_read_member`, sửa lại cho khớp — `alter policy` với tên sai sẽ
> báo lỗi ngay khi `db:push`, không âm thầm bỏ qua.

- [ ] **Step 4: Chạy test để xác nhận nó xanh**

Chạy: `npm run db:push` rồi `npm run test:db`
Expected: PASS — `20_support_sessions.sql` xanh 14/14.

- [ ] **Step 5: Chứng minh không nới ranh giới cho người thường**

Chạy: `npm run test:db` và đọc output của `01_isolation_companies.sql`,
`03_isolation_core.sql`, `04_isolation_v2.sql`.
Expected: cả ba xanh, **không sửa một dòng nào trong ba file đó**. Đây là bằng chứng
trực tiếp cho tiêu chí 4 ("bộ test cô lập Phase 1 vẫn xanh sau khi super admin có
mặt") — ghi số assertion của ba file vào SUMMARY.

- [ ] **Step 6: Kiểm răng bằng phá hoại có kiểm soát**

```sql
-- Chay tay tren database dev:
create or replace function public.tf_has_support_access(p_company_id text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$ select true $$;
```

Chạy: `npm run test:db`
Expected: FAIL — assertion 4 (`false cho cty-02`), 6 (`het han`), 7 (`owner 0001`) và
10 (`0 dong cty-02`) đỏ.

Hoàn nguyên bằng cách chạy lại đúng khối `create function` của
`0033_support_sessions.sql` (đổi `create function` thành `create or replace function`),
rồi chạy `npm run test:db` lại.
Expected: PASS — xanh trở lại, `git status` sạch.

- [ ] **Step 7: Nâng sàn assertion và commit**

Trong `scripts/check-pgtap-assertions.mjs`, đổi sàn `291` thành `297`.

```bash
npm run check:assertions
git add supabase/migrations/0034_support_read_access.sql supabase/tests/20_support_sessions.sql scripts/check-pgtap-assertions.mjs
git commit -m "feat: mo nhanh doc cho phien ho tro tren 22 bang va bucket anh (D-50)"
```

---

## Task 3: Mở và đóng phiên hỗ trợ

**Files:**
- Create: `src/lib/auth/platform.ts`
- Create: `src/lib/data/mutations/platform-sessions.ts`
- Create: `src/lib/data/mutations/__tests__/platform-sessions.test.ts`

**Interfaces:**
- Consumes: `getAuthenticatedUser()` và `ACTIVE_COMPANY_COOKIE` từ
  `@/lib/auth/session-context`; `logMutation()` từ `@/lib/data/audit`;
  `tf_is_platform_admin()` và bảng `support_sessions` từ Task 1.
- Produces:
  - `requirePlatformAdmin(): Promise<{ userId: string; email: string }>` — ném
    `ForbiddenError` nếu không phải platform admin.
  - `SUPPORT_SESSION_MINUTES: number` (= 60).
  - `openSupportSession(companyId: string, reason: string): Promise<void>`
  - `closeSupportSession(): Promise<void>`
  - `getActiveSupportSession(): Promise<{ id: string; companyId: string; expiresAt: string } | null>`
  Task 4 gọi `getActiveSupportSession()`; Task 7 gọi cả ba hàm ghi.

- [ ] **Step 1: Viết test thất bại**

```ts
// src/lib/data/mutations/__tests__/platform-sessions.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ForbiddenError } from "@/lib/auth/session-context";

const rpc = vi.fn();
const insert = vi.fn();
const auditInsert = vi.fn();
const cookieSet = vi.fn();
const cookieDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: cookieSet,
    delete: cookieDelete,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "u-4", email: "ops@timeflow.vn" } } }) },
    rpc,
    from: (table: string) => {
      if (table === "audit_log") return { insert: auditInsert };
      return {
        insert: (row: unknown) => {
          insert(row);
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: "ss-1",
                  company_id: "cty-01",
                  expires_at: "2026-08-10T11:00:00.000Z",
                },
                error: null,
              }),
            }),
          };
        },
      };
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: true, error: null });
  auditInsert.mockResolvedValue({ error: null });
});

describe("openSupportSession", () => {
  it("tu choi khi khong phai platform admin", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { openSupportSession } = await import("@/lib/data/mutations/platform-sessions");
    await expect(openSupportSession("cty-01", "Ticket #418")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("tu choi khi ly do rong — mot phien khong ly do la mot dong nhat ky vo nghia", async () => {
    const { openSupportSession } = await import("@/lib/data/mutations/platform-sessions");
    await expect(openSupportSession("cty-01", "   ")).rejects.toThrow(
      "Vui lòng nhập lý do mở phiên hỗ trợ.",
    );
  });

  it("ghi support_sessions, mot dong audit action='access', va dat cookie", async () => {
    const { openSupportSession } = await import("@/lib/data/mutations/platform-sessions");
    await openSupportSession("cty-01", "Ticket #418");

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        platform_admin_id: "u-4",
        company_id: "cty-01",
        reason: "Ticket #418",
      }),
    );
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "access",
        company_id: "cty-01",
        entity_table: "support_sessions",
        reason: "Mở phiên hỗ trợ: Ticket #418",
      }),
    );
    expect(cookieSet).toHaveBeenCalledWith(
      "tf_active_company",
      "cty-01",
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó đỏ**

Chạy: `npx vitest run src/lib/data/mutations/__tests__/platform-sessions.test.ts`
Expected: FAIL — `Cannot find module '@/lib/data/mutations/platform-sessions'`

- [ ] **Step 3: Viết `requirePlatformAdmin()`**

```ts
// src/lib/auth/platform.ts
import {
  ForbiddenError,
  getAuthenticatedUser,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Diem chan danh tinh cua khu `/platform`. KHONG dung `getSessionContext()`:
 * ham do doi mot membership active, ma platform admin theo dinh nghia
 * (0006_platform_admins.sql) khong thuoc doanh nghiep nao — goi no o day se
 * luon nem NoMembershipError.
 *
 * Cau tra loi "toi co phai platform admin khong" LUON di qua RPC
 * `tf_is_platform_admin()`: bang `platform_admins` bat RLS chan doc truc tiep
 * (D-11a) nen khong co duong nao khac, va do la co y.
 */
export async function requirePlatformAdmin(): Promise<{
  userId: string;
  email: string;
}> {
  const user = await getAuthenticatedUser();

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("tf_is_platform_admin");
  if (error || data !== true) {
    throw new ForbiddenError();
  }

  return user;
}
```

- [ ] **Step 4: Viết hai Server Action**

```ts
// src/lib/data/mutations/platform-sessions.ts
"use server";

import { cookies } from "next/headers";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Vong doi mot phien ho tro (D-49). Ha tang van hanh TimeFlow, KHONG phai quy
 * tac nghiep vu cua doanh nghiep — nen 60 la mot hang so trong ma nguon va
 * khong roi vao pham vi cong `no-hardcoded-work-rules`.
 */
export const SUPPORT_SESSION_MINUTES = 60;

const SESSION_COLUMNS = "id, company_id, expires_at";

interface SupportSessionRow {
  id: string;
  company_id: string;
  expires_at: string;
}

export interface ActiveSupportSession {
  id: string;
  companyId: string;
  /** ISO date-time */
  expiresAt: string;
}

/**
 * Mo mot phien ho tro vao DUNG MOT doanh nghiep. Thu tu ghi: bang truoc,
 * audit sau, cookie sau cung — cookie la thu duy nhat co the dat lai duoc
 * neu buoc sau hong, con hai buoc dau thi khong.
 */
export async function openSupportSession(
  companyId: string,
  reason: string,
): Promise<void> {
  const { userId } = await requirePlatformAdmin();

  const trimmedReason = reason.trim();
  if (trimmedReason.length === 0) {
    throw new Error("Vui lòng nhập lý do mở phiên hỗ trợ.");
  }

  const supabase = await createServerSupabase();
  const expiresAt = new Date(
    Date.now() + SUPPORT_SESSION_MINUTES * 60_000,
  ).toISOString();

  const { data: inserted, error } = await supabase
    .from("support_sessions")
    .insert({
      platform_admin_id: userId,
      company_id: companyId,
      reason: trimmedReason,
      expires_at: expiresAt,
    })
    .select(SESSION_COLUMNS)
    .single();

  if (error || !inserted) {
    throw new Error("Không mở được phiên hỗ trợ.");
  }
  const row = inserted as SupportSessionRow;

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "access",
    entityTable: "support_sessions",
    entityId: row.id,
    before: null,
    after: { opened_at: new Date().toISOString(), expires_at: row.expires_at },
    reason: `Mở phiên hỗ trợ: ${trimmedReason}`,
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Dong phien dang mo. Sau ham nay `tf_has_support_access` tra false NGAY o
 * request ke tiep — khong cho het han, khong cho cache nao.
 */
export async function closeSupportSession(): Promise<void> {
  const { userId } = await requirePlatformAdmin();

  const active = await getActiveSupportSession();
  const cookieStore = await cookies();

  if (!active) {
    // Khong con phien nao: van xoa cookie de trang thai giao dien khong ke
    // mot cau chuyen khac voi database.
    cookieStore.delete(ACTIVE_COMPANY_COOKIE);
    return;
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("support_sessions")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", active.id);

  if (error) {
    throw new Error("Không đóng được phiên hỗ trợ.");
  }

  await logMutation({
    companyId: active.companyId,
    actorUserId: userId,
    action: "access",
    entityTable: "support_sessions",
    entityId: active.id,
    before: null,
    after: { closed_at: new Date().toISOString() },
    reason: "Đóng phiên hỗ trợ",
  });

  cookieStore.delete(ACTIVE_COMPANY_COOKIE);
}

/**
 * Phien con hieu luc cua NGUOI DANG GOI, neu co. Tra `null` — khong nem —
 * khi nguoi goi khong phai platform admin, vi ham nay duoc goi tren duong
 * doc cua MOI nguoi dung qua `getSessionContext()` (Task 4).
 */
export async function getActiveSupportSession(): Promise<ActiveSupportSession | null> {
  // Tra `null` — khong nem — khi chua dang nhap, vi ham nay nam tren duong
  // doc cua MOI nguoi dung qua `getSessionContext()` (Task 4).
  let userId: string;
  try {
    userId = (await getAuthenticatedUser()).userId;
  } catch {
    return null;
  }

  const supabase = await createServerSupabase();

  // Loc `platform_admin_id` o DAY chu khong dua vao RLS: policy select cua
  // support_sessions (0033 muc c) co y cho thanh vien doanh nghiep doc dong
  // cua NGUOI KHAC — do la tinh nang "khach xem duoc ai da vao du lieu cua
  // minh". Thieu bo loc nay thi mot thanh vien se nham phien cua nguoi khac
  // la phien cua chinh minh.
  const { data, error } = await supabase
    .from("support_sessions")
    .select(SESSION_COLUMNS)
    .eq("platform_admin_id", userId)
    .is("closed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as SupportSessionRow;
  return {
    id: row.id,
    companyId: row.company_id,
    expiresAt: row.expires_at,
  };
}
```

Thêm `getAuthenticatedUser` vào import từ `@/lib/auth/session-context`.

- [ ] **Step 5: Chạy test để xác nhận nó xanh**

Chạy: `npx vitest run src/lib/data/mutations/__tests__/platform-sessions.test.ts`
Expected: PASS 3/3

- [ ] **Step 6: Commit**

```bash
npm run typecheck && npm run lint
git add src/lib/auth/platform.ts src/lib/data/mutations/platform-sessions.ts src/lib/data/mutations/__tests__/platform-sessions.test.ts
git commit -m "feat: mo va dong phien ho tro, moi phien hai dong audit (D-49, D-55)"
```

---

## Task 4: `AccessRole`, nhánh `support`, và hai vị ngữ

**Files:**
- Modify: `src/lib/auth/session-context.ts`
- Modify: `src/lib/auth/__tests__/session-context.test.ts`

**Interfaces:**
- Consumes: `getActiveSupportSession()` từ Task 3.
- Produces:
  - `export type AccessRole = CompanyRole | "support"`
  - `SessionContext.role: AccessRole` (đổi kiểu, cùng tên trường)
  - `export function canReadCompanyData(role: AccessRole): boolean`
  - `ADMIN_AREA_ROLES: AccessRole[]` nay gồm `"support"`
  Task 5 dùng `canReadCompanyData`; Task 6 dùng `role === "support"`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `src/lib/auth/__tests__/session-context.test.ts`:

```ts
describe("canReadCompanyData", () => {
  it("mo cho owner, admin va support — dong cho manager va employee", async () => {
    const { canReadCompanyData } = await import("@/lib/auth/session-context");
    expect(canReadCompanyData("owner")).toBe(true);
    expect(canReadCompanyData("admin")).toBe(true);
    expect(canReadCompanyData("support")).toBe(true);
    expect(canReadCompanyData("manager")).toBe(false);
    expect(canReadCompanyData("employee")).toBe(false);
  });
});

describe("ADMIN_AREA_ROLES", () => {
  it("gom support — phien ho tro dung chinh giao dien quan tri (D-54)", async () => {
    const { canAccessAdminArea } = await import("@/lib/auth/session-context");
    expect(canAccessAdminArea("support")).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó đỏ**

Chạy: `npx vitest run src/lib/auth/__tests__/session-context.test.ts`
Expected: FAIL — `canReadCompanyData is not a function`

- [ ] **Step 3: Sửa `session-context.ts`**

Thêm kiểu và vị ngữ:

```ts
/**
 * Vai tro TRUY CAP, khac vai tro DOANH NGHIEP. `"support"` khong phai mot gia
 * tri ai gan duoc cho ai — no la trang thai cua mot phien ho tro dang mo
 * (D-51). Vi vay `CompanyRole` trong `domain.ts` giu nguyen bon gia tri, va
 * `COMPANY_ROLE_LABEL` / `SYSTEM_ROLE_OPTIONS` / form khai vai tro nhan vien
 * deu khong biet `"support"` ton tai.
 */
export type AccessRole = CompanyRole | "support";
```

Đổi `SessionContext.role: CompanyRole` thành `role: AccessRole`.

Thêm nhánh vào `getSessionContext()`, thay cho dòng `if (rows.length === 0) throw new NoMembershipError();`:

```ts
  const rows = (memberships ?? []) as MembershipRow[];

  // Nhanh DUY NHAT cua Phase 6 (D-51): khong membership nao, nhung dang co
  // mot phien ho tro con han khop cookie doanh nghiep hien hanh. Dat SAU
  // phep doc memberships de mot platform admin tinh co CO membership van di
  // duong thanh vien binh thuong — quyen ho tro khong bao gio de len quyen
  // that cua chinh ho.
  if (rows.length === 0) {
    const support = await getActiveSupportSession();
    if (support && support.companyId === activeCompanyCookie) {
      return {
        userId,
        email,
        companyId: support.companyId,
        role: "support",
        employeeId: null,
        isPlatformAdmin: true,
        mustChangePassword: appMetadata.must_change_password === true,
      };
    }
    throw new NoMembershipError();
  }
```

Thêm vị ngữ và mở rộng `ADMIN_AREA_ROLES`:

```ts
export const ADMIN_AREA_ROLES: AccessRole[] = ["owner", "admin", "support"];

export function canAccessAdminArea(role: AccessRole): boolean {
  return ADMIN_AREA_ROLES.includes(role);
}

/**
 * Ranh gioi DOC du lieu cap doanh nghiep. Dung o MOI Route Handler duoi
 * `src/app/api/`. KHAC `requireRole(role, ["owner","admin"])` — vi ngu do o
 * lai nguyen ven trong 16 file `mutations/*.ts` va chinh vi no khong biet
 * `"support"` ma moi Server Action ghi tu dong nem `ForbiddenError` cho phien
 * ho tro (D-52). Cho nao quen la cho do CHAN, khong phai cho do LOT.
 */
const READ_ROLES: AccessRole[] = ["owner", "admin", "support"];

export function canReadCompanyData(role: AccessRole): boolean {
  return READ_ROLES.includes(role);
}
```

Đổi chữ ký `requireRole` thành `requireRole(role: AccessRole, allowed: CompanyRole[]): void`
— tham số `allowed` giữ kiểu `CompanyRole[]` để không call site nào **thêm được**
`"support"` vào danh sách cho phép ghi.

`homePathForRole(role: AccessRole)`: `"support"` đi theo nhánh `/admin/dashboard` vì
`canAccessAdminArea("support")` là `true`.

- [ ] **Step 4: Chạy test để xác nhận nó xanh**

Chạy: `npx vitest run src/lib/auth/__tests__/session-context.test.ts && npm run typecheck`
Expected: PASS. `typecheck` sẽ báo lỗi ở các file Task 5 và Task 6 sẽ sửa — ghi lại
danh sách file đó, nó chính là danh sách việc của hai task sau.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session-context.ts src/lib/auth/__tests__/session-context.test.ts
git commit -m "feat: AccessRole va vi ngu canReadCompanyData cho phien ho tro (D-51, D-52)"
```

---

## Task 5: Thay 13 `requireRole` đọc và 7 `isAdminRole` inline

**Files:**
- Modify: `src/app/api/attendance/review/route.ts`, `src/app/api/attendance-photos/route.ts`,
  `src/app/api/attendance-photos/[id]/route.ts`, `src/app/api/geocode/route.ts`,
  `src/app/api/overtime-rates/route.ts`, `src/app/api/pay-adjustments/route.ts`,
  `src/app/api/pay-rates/route.ts`, `src/app/api/payroll/summary/route.ts`,
  `src/app/api/payslips/route.ts`, `src/app/api/periods/route.ts`,
  `src/app/api/requests/[id]/effect/route.ts`
- Modify: `src/app/api/attendance/route.ts`, `src/app/api/attendance/summary/route.ts`,
  `src/app/api/attendance/classification/route.ts`, `src/app/api/requests/route.ts`,
  `src/app/api/requests/[id]/reviews/route.ts`, `src/app/api/requests/overtime-usage/route.ts`
- Create: `src/__tests__/no-inline-admin-role.test.ts`

**Interfaces:**
- Consumes: `canReadCompanyData()` từ Task 4.
- Produces: không có API mới — task này chỉ đổi call site và dựng một cổng cơ học.

- [ ] **Step 1: Viết cổng cơ học (test thất bại)**

```ts
// src/__tests__/no-inline-admin-role.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Cong co hoc cua D-52. Bay chO tinh `isAdminRole` inline duoi
 * `src/app/api/` la moi nguy that cua Phase 6: bo sot mot cho thi phien ho
 * tro bi thu pham vi ve `sessionEmployeeId`, ma gia tri do la `null`, va man
 * hinh se RONG chu khong bao loi — hong am tham, kieu kho tim nhat.
 *
 * Cong nay bao ve cac phase SAU, khong chi phase nay: mot Route Handler moi
 * viet theo thoi quen cu se do o day truoc khi kip len san pham.
 */
const API_DIR = join(process.cwd(), "src", "app", "api");
const FORBIDDEN = /role\s*===\s*["'](owner|admin)["']/;

function collectRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectRouteFiles(full));
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("khong tinh vai tro quan tri inline duoi src/app/api/", () => {
  it("moi Route Handler di qua canReadCompanyData(), khong so chuoi truc tiep", () => {
    const offenders = collectRouteFiles(API_DIR).filter((file) =>
      FORBIDDEN.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó đỏ**

Chạy: `npx vitest run src/__tests__/no-inline-admin-role.test.ts`
Expected: FAIL — liệt kê 6 file (`api/attendance/route.ts`,
`api/attendance/summary/route.ts`, `api/attendance/classification/route.ts`,
`api/requests/route.ts`, `api/requests/[id]/reviews/route.ts`,
`api/requests/overtime-usage/route.ts`).

- [ ] **Step 3: Thay 11 chỗ `requireRole` đọc**

Trong mỗi file của nhóm thứ nhất, đổi:

```ts
requireRole(role, ["owner", "admin"]);
```

thành:

```ts
if (!canReadCompanyData(role)) throw new ForbiddenError();
```

và sửa import tương ứng (`requireRole` → `canReadCompanyData`; giữ `ForbiddenError`
nếu đã import, thêm nếu chưa). **Không** đổi bất cứ thứ gì khác trong các file này.

- [ ] **Step 4: Thay 7 chỗ `isAdminRole` inline**

Trong 6 file của nhóm thứ hai, đổi:

```ts
const isAdminRole = role === "owner" || role === "admin";
```

thành:

```ts
const isAdminRole = canReadCompanyData(role);
```

và thêm `canReadCompanyData` vào import từ `@/lib/auth/session-context`. Giữ nguyên
tên biến `isAdminRole` — đổi tên biến ở 7 chỗ là 7 cơ hội gõ nhầm cho một thay đổi
không mang thêm nghĩa nào.

> **`src/app/api/attendance/route.ts` có chỗ thứ hai:** dòng `const isSelfScoped = !isAdminRole;`
> tự đúng theo sau khi `isAdminRole` đổi nghĩa — không sửa dòng đó.

- [ ] **Step 5: Chạy test để xác nhận nó xanh**

Chạy: `npx vitest run src/__tests__/no-inline-admin-role.test.ts && npm run typecheck && npm run test`
Expected: PASS toàn bộ.

- [ ] **Step 6: Kiểm răng — chứng minh cổng có răng**

Thêm tạm dòng `const x = role === "owner";` vào `src/app/api/periods/route.ts`, chạy
`npx vitest run src/__tests__/no-inline-admin-role.test.ts`, xác nhận **đỏ** và có tên
file `periods` trong output; xoá dòng đó, chạy lại, xác nhận **xanh** và `git status`
sạch.

- [ ] **Step 7: Commit**

```bash
git add src/app/api src/__tests__/no-inline-admin-role.test.ts
git commit -m "feat: 18 duong doc di qua canReadCompanyData, them cong chan tinh vai tro inline (D-52)"
```

---

## Task 6: Ba chỗ vỡ giao diện và banner hỗ trợ

**Files:**
- Modify: `src/lib/types/domain.ts` (`AppUser.employeeId`)
- Modify: `src/lib/auth/session-context.ts` (`getClientSession`)
- Modify: `src/lib/auth/session-provider.tsx` (thêm `useEmployeeSession`)
- Modify: `src/app/employee/employee-home-view.tsx`, `src/app/employee/history/history-view.tsx`,
  `src/app/employee/profile/profile-view.tsx`, `src/app/employee/requests/requests-view.tsx`,
  `src/components/layout/employee-shell.tsx`
- Modify: `src/app/api/companies/route.ts`
- Create: `src/components/layout/support-banner.tsx`
- Modify: `src/components/layout/admin-shell.tsx`
- Modify: `src/lib/constants.ts` (nhãn banner)

**Interfaces:**
- Consumes: `AccessRole` từ Task 4; `closeSupportSession()` từ Task 3.
- Produces: `useEmployeeSession(): { session: UserSession; employeeId: string }`;
  component `<SupportBanner companyName={string} expiresAt={string} />`.

- [ ] **Step 1: Viết test thất bại**

```ts
// them vao src/lib/auth/__tests__/session-context.test.ts
describe("getClientSession voi phien ho tro", () => {
  it("tra ve session co employeeId null thay vi null ca session — neu khong AdminShell ket o skeleton", async () => {
    // Mock getSessionContext tra ve role "support", employeeId null.
    const session = await loadClientSessionWithSupportContext();
    expect(session).not.toBeNull();
    expect(session?.role).toBe("support");
    expect(session?.user.employeeId).toBeNull();
  });
});
```

(Hàm trợ giúp `loadClientSessionWithSupportContext()` viết ngay trong file test, dùng
`vi.mock("@/lib/supabase/server", ...)` theo đúng khuôn đã có sẵn ở đầu file đó.)

- [ ] **Step 2: Chạy test để xác nhận nó đỏ**

Chạy: `npx vitest run src/lib/auth/__tests__/session-context.test.ts`
Expected: FAIL — `expected null not to be null` (vì `getClientSession` hiện trả `null`
khi `employeeId` là `null`).

- [ ] **Step 3: Nới `AppUser.employeeId` và sửa `getClientSession`**

Trong `src/lib/types/domain.ts`:

```ts
export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  /**
   * `null` trong DUNG MOT truong hop: phien ho tro cua platform admin (D-51,
   * D-53) — nguoi do khong co dong `employees` nao trong doanh nghiep dang
   * xem. Moi man hinh duoi `/employee/*` doi gia tri nay khac null va phai
   * lay qua `useEmployeeSession()`.
   */
  employeeId: string | null;
}

export interface UserSession {
  user: AppUser;
  companyId: string;
  role: AccessRole;
  signedInAt: string;
}
```

Trong `getClientSession()`, thay nhánh `if (!context || !context.employeeId) return null;`
bằng: `if (!context) return null;` rồi thêm nhánh support **trước** phép đọc bảng
`employees`:

```ts
  // Phien ho tro khong co dong `employees` nao — dung email cua chinh
  // platform admin lam ten hien thi. Tra `null` o day nghia la AdminShell
  // ket o skeleton vinh vien (D-53 muc 1).
  if (context.role === "support") {
    return {
      user: {
        id: context.userId,
        fullName: context.email,
        email: context.email,
        avatarUrl: null,
        employeeId: null,
      },
      companyId: context.companyId,
      role: "support",
      signedInAt: new Date().toISOString(),
    };
  }
  if (!context.employeeId) return null;
```

- [ ] **Step 4: Thêm `useEmployeeSession()` và sửa 5 call site**

Trong `src/lib/auth/session-provider.tsx`:

```tsx
/**
 * Phien cua mot NHAN VIEN that. Nem khi `employeeId` la null — truong hop do
 * chi xay ra voi phien ho tro (D-51), va phien ho tro khong bao gio duoc vao
 * `/employee/*` (`homePathForRole` dua no toi `/admin/dashboard`). Nem o day
 * bien mot lop kieu thanh mot loi to ro rang thay vi mot man hinh rong.
 */
export function useEmployeeSession(): {
  session: UserSession;
  employeeId: string;
} {
  const { session } = useSession();
  if (!session || session.user.employeeId === null) {
    throw new Error("Màn hình này chỉ dùng được với tài khoản nhân viên.");
  }
  return { session, employeeId: session.user.employeeId };
}
```

Trong 4 view dưới `/employee/*`, đổi `const employeeId = session.user.employeeId;`
thành `const { session, employeeId } = useEmployeeSession();` (bỏ lời gọi `useSession()`
cũ). Trong `employee-shell.tsx` giữ nguyên `session?.user.employeeId ?? null` — file
đó đã xử lý `null` đúng rồi.

- [ ] **Step 5: Thêm nhánh phiên hỗ trợ vào `GET /api/companies`**

Trong `src/app/api/companies/route.ts`, ở nhánh `catch` bắt `NoMembershipError` (hiện
trả `[]`), thay bằng: gọi `getActiveSupportSession()`; nếu có phiên thì đọc đúng một
dòng `companies` theo `support.companyId` và trả mảng một phần tử với
`role: "support"`, `employeeCount` đếm từ `employees`, `lastAccessedAt = created_at`;
nếu không có phiên thì vẫn trả `[]`.

> Đây là chỗ `AdminShell` lấy tên doanh nghiệp để hiện lên sidebar và banner. Không có
> nhánh này thì banner nói "Đang xem —" (D-53 mục 2).

- [ ] **Step 6: Viết `SupportBanner` và gắn vào `AdminShell`**

```tsx
// src/components/layout/support-banner.tsx
"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SUPPORT_LABELS } from "@/lib/constants";
import { closeSupportSession } from "@/lib/data/mutations/platform-sessions";

/**
 * Tieu chi 2 cua Phase 6: "man hinh LUON hien thi ro dang xem doanh nghiep
 * nao". Banner nay dinh dinh moi trang `/admin/*` khi vai tro la `support`.
 *
 * Nut ghi tren cac man hinh quan tri KHONG an (D-54): an nut o 10 man hinh
 * la 10 cho de quen, con thong diep tu choi thi den tu MOT cho duy nhat
 * (`requireRole` trong 16 file mutations) va khong quen duoc.
 */
export function SupportBanner({
  companyName,
  expiresAt,
}: {
  companyName: string;
  /** ISO date-time */
  expiresAt: string;
}): React.ReactElement {
  const [minutesLeft, setMinutesLeft] = React.useState(() =>
    minutesUntil(expiresAt),
  );

  React.useEffect(() => {
    const timer = setInterval(() => setMinutesLeft(minutesUntil(expiresAt)), 30_000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">
        {SUPPORT_LABELS.viewing} <strong>{companyName}</strong> —{" "}
        {SUPPORT_LABELS.sessionPrefix} {minutesLeft > 0
          ? `${SUPPORT_LABELS.remaining} ${minutesLeft} phút`
          : SUPPORT_LABELS.expired}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void closeSupportSession()}
      >
        {SUPPORT_LABELS.close}
      </Button>
    </div>
  );
}

function minutesUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
}
```

Trong `src/lib/constants.ts`:

```ts
export const SUPPORT_LABELS = {
  viewing: "Đang xem",
  sessionPrefix: "phiên hỗ trợ,",
  remaining: "còn",
  expired: "đã hết hạn",
  close: "Đóng phiên",
  openTitle: "Mở phiên hỗ trợ",
  reasonLabel: "Lý do mở phiên",
  reasonPlaceholder: "Ví dụ: Ticket #418 — khách báo sai giờ tăng ca",
  reasonRequired: "Vui lòng nhập lý do mở phiên hỗ trợ.",
} as const;
```

Trong `admin-shell.tsx`, render `<SupportBanner …/>` ngay bên trong `<div className="min-h-dvh …">`
khi `session.role === "support"`, lấy `companyName` từ `currentCompany?.name ?? ""`
và `expiresAt` từ một prop mới mà `admin/layout.tsx` truyền xuống
(`getActiveSupportSession()` gọi ở tầng server, không gọi ở client).

- [ ] **Step 7: Chạy test và commit**

Chạy: `npm run typecheck && npm run lint && npm run test`
Expected: PASS toàn bộ. Nếu `no-date-in-client` ESLint rule kêu về `Date.now()` trong
`support-banner.tsx`, thêm file đó vào danh sách ngoại lệ hẹp của rule kèm một dòng
giải thích — đồng hồ đếm ngược là đồng hồ tick thật hợp lệ, cùng loại với
`attendance-status-card.tsx` đã được miễn từ 02-08.

```bash
git add src/lib src/app/employee src/app/api/companies src/components/layout
git commit -m "feat: giao dien quan tri chay duoc trong phien ho tro + banner dinh dinh (D-53, D-54)"
```

---

## Task 7: Khu `/platform` — danh sách toàn hệ thống và nhật ký

**Files:**
- Create: `supabase/migrations/0035_platform_company_overview.sql`
- Create: `src/lib/validation/api/platform.ts`
- Create: `src/app/api/platform/companies/route.ts`
- Create: `src/app/api/platform/sessions/route.ts`
- Create: `src/lib/data/platform.ts`
- Create: `src/app/platform/layout.tsx`, `src/app/platform/page.tsx`,
  `src/app/platform/platform-view.tsx`
- Create: `src/app/platform/log/page.tsx`, `src/app/platform/log/support-log-view.tsx`
- Modify: `src/middleware.ts` (thêm `/platform` vào `PROTECTED_PREFIXES`)

**Interfaces:**
- Consumes: `requirePlatformAdmin()` (Task 3), `openSupportSession()` (Task 3).
- Produces:
  - RPC `public.tf_platform_company_overview()` trả
    `(company_id text, company_name text, company_code text, employee_count int, last_activity_at timestamptz, open_period_month text)`
  - `PlatformCompany` = `{ id, name, code, employeeCount, lastActivityAt, openPeriodMonth }`
  - `SupportSessionLogEntry` = `{ id, companyId, companyName, platformAdminEmail, reason, openedAt, expiresAt, closedAt }`
  - `listPlatformCompanies(): Promise<PlatformCompany[]>`, `listSupportSessions(): Promise<SupportSessionLogEntry[]>`

- [ ] **Step 1: Viết migration cho RPC**

```sql
-- supabase/migrations/0035_platform_company_overview.sql
--
-- SADM-01: danh sach toan he thong. KHONG doc bang khoa service — cong
-- `src/__tests__/admin-client-scope.test.ts` cam `createAdminSupabase()`
-- ngoai `"use server"`/`mutations/`, va noi cong do cho mot Route Handler doc
-- la doi mot cong dang co rang lay su tien tay (D-56).
--
-- Ham nay tra ve SO TONG HOP, khong tra mot dong du lieu nghiep vu nao — do
-- la ly do no duoc phep nhin xuyen doanh nghiep ma khong can mot phien.

create function public.tf_platform_company_overview()
returns table (
  company_id text,
  company_name text,
  company_code text,
  employee_count int,
  last_activity_at timestamptz,
  open_period_month text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.name,
    c.code,
    (select count(*)::int from employees e where e.company_id = c.id),
    (select max(a.created_at) from attendance_records a where a.company_id = c.id),
    (select p.period_month from periods p
       where p.company_id = c.id and p.status = 'open'
       order by p.period_month desc limit 1)
  from companies c
  -- Toan bo phep nhin xuyen doanh nghiep cua ham nay nam sau DUNG MOT dieu
  -- kien. Sai o day la sai toan bo, nen no dung o menh de where chu khong
  -- nam trong mot nhanh if co the bi bo qua.
  where public.tf_is_platform_admin()
  order by c.name;
$$;

revoke execute on function public.tf_platform_company_overview() from public;
grant execute on function public.tf_platform_company_overview() to authenticated;
```

> **Trước khi viết:** chạy `grep -n "period_month\|status" supabase/migrations/0005_v2_tables.sql`
> để xác nhận tên cột thật của bảng `periods`. Nếu khác `period_month`/`status`, sửa
> cho khớp.

- [ ] **Step 2: Viết test thất bại cho Route Handler**

```ts
// src/app/api/platform/companies/__tests__/route.test.ts
import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "u-4", email: "ops@timeflow.vn" } } }) },
    rpc,
  }),
}));

describe("GET /api/platform/companies", () => {
  it("tra 403 khi nguoi goi khong phai platform admin", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { GET } = await import("@/app/api/platform/companies/route");
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("tra danh sach da chuyen sang camelCase khi la platform admin", async () => {
    rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            company_id: "cty-01",
            company_name: "Ngọc Phát",
            company_code: "NP",
            employee_count: 40,
            last_activity_at: "2026-08-10T02:00:00.000Z",
            open_period_month: "2026-08",
          },
        ],
        error: null,
      });
    const { GET } = await import("@/app/api/platform/companies/route");
    const body = await (await GET()).json();
    expect(body).toEqual([
      {
        id: "cty-01",
        name: "Ngọc Phát",
        code: "NP",
        employeeCount: 40,
        lastActivityAt: "2026-08-10T02:00:00.000Z",
        openPeriodMonth: "2026-08",
      },
    ]);
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận nó đỏ**

Chạy: `npx vitest run src/app/api/platform`
Expected: FAIL — `Cannot find module '@/app/api/platform/companies/route'`

- [ ] **Step 4: Viết schema, hai Route Handler và client đọc**

`src/lib/validation/api/platform.ts` — hai cặp schema theo khuôn D-12d: một
`*RowSchema` có `.transform()` snake_case → camelCase dùng **chỉ ở server**, một
`*Schema` phẳng dùng ở **cả hai đầu**.

`src/app/api/platform/companies/route.ts` — `export const dynamic = "force-dynamic"`,
**chỉ export `GET`**: `requirePlatformAdmin()` → `supabase.rpc("tf_platform_company_overview")`
→ parse → `NextResponse.json`. Bắt `ForbiddenError` → 403, `UnauthenticatedError` → 401,
còn lại → 500 (đúng khuôn `api/companies/route.ts`).

`src/app/api/platform/sessions/route.ts` — cùng khuôn, đọc `support_sessions` join
`companies` để lấy tên, `order by opened_at desc`, giới hạn 200 dòng gần nhất
(**log** giới hạn này ra màn hình: "Hiển thị 200 phiên gần nhất" — không cắt âm thầm).

`src/lib/data/platform.ts` — hai hàm gọi `fetchJson()` theo khuôn
`src/lib/data/companies.ts`.

- [ ] **Step 5: Viết ba màn hình**

- `src/app/platform/layout.tsx` — Server Component: `await requirePlatformAdmin()`
  trong `try/catch`, `redirect("/")` khi ném. Khung tối giản: một thanh tiêu đề
  `TimeFlow · Vận hành` + hai liên kết (`Doanh nghiệp`, `Nhật ký hỗ trợ`). **Không**
  dùng `AdminShell` — khu này không thuộc một doanh nghiệp nào.
- `src/app/platform/platform-view.tsx` — bảng: Tên · Mã · Số nhân viên · Hoạt động gần
  nhất · Kỳ đang mở · nút *Mở phiên hỗ trợ*. Nút mở `Dialog` bắt nhập lý do
  (`SUPPORT_LABELS.reasonLabel`), submit gọi `openSupportSession(id, reason)` rồi
  `router.push("/admin/dashboard")`. Đây là **nút filled indigo duy nhất** của khu này.
- `src/app/platform/log/support-log-view.tsx` — bảng chỉ đọc: Thời điểm mở · Doanh
  nghiệp · Người mở · Lý do · Trạng thái (`Đang mở` / `Đã đóng` / `Hết hạn`).

Thêm `"/platform"` vào `PROTECTED_PREFIXES` trong `src/middleware.ts`.

- [ ] **Step 6: Chạy test và commit**

Chạy: `npm run db:push && npx vitest run src/app/api/platform && npm run typecheck && npm run lint && npm run test`
Expected: PASS toàn bộ, gồm cả `route-handlers-get-only` và `admin-client-scope`
(cổng thứ hai xanh **mà không phải sửa nó** — đó là điểm của D-56).

```bash
git add supabase/migrations/0035_platform_company_overview.sql src/app/platform src/app/api/platform src/lib/data/platform.ts src/lib/validation/api/platform.ts src/middleware.ts
git commit -m "feat: khu /platform — danh sach toan he thong va nhat ky phien ho tro (SADM-01, SADM-03)"
```

---

## Task 8: Hai đường ghi trắng của SADM-04

**Files:**
- Create: `src/lib/data/mutations/platform.ts`
- Create: `src/lib/data/mutations/__tests__/platform.test.ts`
- Modify: `src/app/platform/platform-view.tsx` (hai hành động trong menu mỗi dòng)

**Interfaces:**
- Consumes: `requirePlatformAdmin()` (Task 3), `createAdminSupabase()`, `logMutation()`.
- Produces:
  - `resetTempPasswordForUser(userId: string, reason: string): Promise<{ email: string; temporaryPassword: string }>`
  - `grantOwnerMembership(companyId: string, userId: string, reason: string): Promise<void>`

- [ ] **Step 1: Viết test thất bại**

```ts
// src/lib/data/mutations/__tests__/platform.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const updateUserById = vi.fn();
const upsert = vi.fn();
const auditInsert = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({
    auth: { admin: { updateUserById, getUserById: async () => ({ data: { user: { email: "chu@ngocphat.vn" } }, error: null }) } },
    from: () => ({ upsert }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "u-4", email: "ops@timeflow.vn" } } }) },
    rpc,
    from: () => ({ insert: auditInsert }),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: true, error: null });
  updateUserById.mockResolvedValue({ data: { user: { email: "chu@ngocphat.vn" } }, error: null });
  upsert.mockResolvedValue({ error: null });
  auditInsert.mockResolvedValue({ error: null });
});

describe("resetTempPasswordForUser", () => {
  it("bat buoc ly do", async () => {
    const { resetTempPasswordForUser } = await import("@/lib/data/mutations/platform");
    await expect(resetTempPasswordForUser("u-9", "  ")).rejects.toThrow(
      "Vui lòng nhập lý do.",
    );
  });

  it("bat co must_change_password va ghi audit KHONG chua mat khau", async () => {
    const { resetTempPasswordForUser } = await import("@/lib/data/mutations/platform");
    const result = await resetTempPasswordForUser("u-9", "Ticket #418");

    expect(result.temporaryPassword).toHaveLength(24);
    expect(updateUserById).toHaveBeenCalledWith(
      "u-9",
      expect.objectContaining({
        app_metadata: expect.objectContaining({ must_change_password: true }),
      }),
    );

    const auditRow = auditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(JSON.stringify(auditRow)).not.toContain(result.temporaryPassword);
    expect(auditRow.action).toBe("update");
    expect(auditRow.company_id).toBeNull();
  });
});

describe("grantOwnerMembership", () => {
  it("upsert membership role=owner status=active va ghi audit mang company_id", async () => {
    const { grantOwnerMembership } = await import("@/lib/data/mutations/platform");
    await grantOwnerMembership("cty-01", "u-9", "Khach mat quyen owner");

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: "cty-01", user_id: "u-9", role: "owner", status: "active" }),
      expect.objectContaining({ onConflict: "user_id,company_id" }),
    );
    expect(auditInsert.mock.calls[0][0]).toMatchObject({ company_id: "cty-01" });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó đỏ**

Chạy: `npx vitest run src/lib/data/mutations/__tests__/platform.test.ts`
Expected: FAIL — `Cannot find module '@/lib/data/mutations/platform'`

- [ ] **Step 3: Viết hai Server Action**

```ts
// src/lib/data/mutations/platform.ts
"use server";

import { randomBytes } from "node:crypto";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import { logMutation } from "@/lib/data/audit";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Hai duong ghi DUY NHAT cua super admin (SADM-04, D-56). Ca hai deu nam
 * NGOAI du lieu cham cong va luong: doi van hanh khong sua duoc mot ban ghi
 * cong hay mot con so tien nao, o bat ky duong nao. Do la loi hua loi cua
 * san pham va phase nay khong duoc phep dung vao.
 *
 * Ca hai di qua Admin API (bo qua RLS) chu KHONG qua phien ho tro — phien ho
 * tro chi mo lenh SELECT (D-50). Vi client nay bo qua RLS, moi ham o day tu
 * kiem quyen bang `requirePlatformAdmin()` TRUOC khi cham du lieu.
 */

const TEMP_PASSWORD_BYTES = 18;

function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length === 0) throw new Error("Vui lòng nhập lý do.");
  return trimmed;
}

export interface ResetTempPasswordResult {
  email: string;
  temporaryPassword: string;
}

/**
 * Cap lai mat khau tam cho mot tai khoan bat ky va bat co buoc doi lan dau
 * (D-16). Mat khau tam roi khoi ham nay DUNG MOT LAN qua gia tri tra ve —
 * khong bao gio xuong `audit_log`, khong bao gio xuong log server.
 */
export async function resetTempPasswordForUser(
  userId: string,
  reason: string,
): Promise<ResetTempPasswordResult> {
  const { userId: actorUserId } = await requirePlatformAdmin();
  const trimmedReason = requireReason(reason);

  const admin = createAdminSupabase();
  const temporaryPassword = randomBytes(TEMP_PASSWORD_BYTES).toString("base64url");

  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
    app_metadata: { must_change_password: true },
  });

  if (error || !data.user) {
    throw new Error("Không cấp lại được mật khẩu tạm cho tài khoản này.");
  }

  await logMutation({
    // `company_id` NULL: thao tac nay thuoc ve NEN TANG, khong thuoc doanh
    // nghiep nao. Cot da nullable san tu 0005 cho dung truong hop nay.
    companyId: null,
    actorUserId,
    action: "update",
    entityTable: "auth.users",
    entityId: userId,
    before: null,
    after: { must_change_password: true },
    reason: `Super admin cấp lại mật khẩu tạm: ${trimmedReason}`,
  });

  return { email: data.user.email ?? "", temporaryPassword };
}

/**
 * Cap lai membership `owner` khi khach mat duong vao chinh doanh nghiep
 * minh. `upsert` chu khong `insert`: truong hop hay gap nhat la dong
 * membership VAN CON nhung `status` da thanh 'inactive'.
 */
export async function grantOwnerMembership(
  companyId: string,
  userId: string,
  reason: string,
): Promise<void> {
  const { userId: actorUserId } = await requirePlatformAdmin();
  const trimmedReason = requireReason(reason);

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("memberships")
    .upsert(
      { company_id: companyId, user_id: userId, role: "owner", status: "active" },
      { onConflict: "user_id,company_id" },
    );

  if (error) {
    throw new Error("Không cấp lại được quyền chủ doanh nghiệp.");
  }

  await logMutation({
    companyId,
    actorUserId,
    action: "update",
    entityTable: "memberships",
    entityId: userId,
    before: null,
    after: { role: "owner", status: "active" },
    reason: `Super admin cấp quyền chủ doanh nghiệp: ${trimmedReason}`,
  });
}
```

> **`logMutation` cần nới kiểu:** `AuditEntry.companyId` hiện là `string`. Đổi thành
> `string | null` (cột DB đã nullable từ 0005) và giữ nguyên mọi call site khác.
> Dòng `company_id: null` **không** lọt qua policy `audit_log_insert_member` lẫn
> `audit_log_insert_support` — nên thêm vào `0033` một policy thứ ba:
> ```sql
> create policy audit_log_insert_platform on audit_log
>   for insert
>   with check (company_id is null and public.tf_is_platform_admin());
> ```
> Nếu Task 1 đã commit, thêm policy này bằng một migration `0036` thay vì sửa `0033`.

- [ ] **Step 4: Chạy test để xác nhận nó xanh**

Chạy: `npx vitest run src/lib/data/mutations/__tests__/platform.test.ts && npm run typecheck`
Expected: PASS 3/3

- [ ] **Step 5: Gắn hai hành động vào `/platform`**

Trong `platform-view.tsx`, mỗi dòng doanh nghiệp có menu `⋯` với *Cấp lại quyền chủ
doanh nghiệp*; hộp thoại nhận `userId` + lý do. *Cấp lại mật khẩu tạm* đặt ở cùng menu,
và kết quả hiện trong một hộp thoại **chỉ một lần**, kèm câu "Mật khẩu này không hiện
lại được — hãy chép ngay."

- [ ] **Step 6: Commit**

```bash
npm run lint && npm run test
git add src/lib/data/mutations/platform.ts src/lib/data/mutations/__tests__/platform.test.ts src/lib/data/audit.ts src/app/platform supabase/migrations
git commit -m "feat: hai duong ghi trang cua super admin, moi lan mot dong audit (SADM-04)"
```

---

## Task 9: Cổng cuối phase — e2e, kiểm răng, nghiệm thu

**Files:**
- Create: `scripts/e2e-support.mjs`
- Modify: `package.json` (script `test:e2e-support`)
- Modify: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`
- Create: `.planning/phases/06-super-admin/06-UAT.md`

**Interfaces:**
- Consumes: mọi thứ của tám task trước.
- Produces: `npm run test:e2e-support`; biên bản nghiệm thu bốn tiêu chí.

- [ ] **Step 1: Viết e2e vòng đời một phiên**

`scripts/e2e-support.mjs` theo đúng khuôn `scripts/e2e-approval.mjs` — HTTP thật vào
server dev, không mock gì. Sáu bước, mỗi bước in một dòng `PASS`/`FAIL`:

1. Đăng nhập bằng tài khoản platform admin → `GET /api/platform/companies` trả **≥ 2**
   doanh nghiệp.
2. `GET /api/employees` **trước khi** mở phiên → **401 hoặc 403** (chưa có doanh
   nghiệp hiện hành).
3. Mở phiên hỗ trợ vào doanh nghiệp thứ nhất → `GET /api/employees` trả **> 0** dòng,
   và mọi dòng có `companyId` bằng doanh nghiệp đó.
4. `GET /api/employees` với cookie doanh nghiệp bị sửa tay sang doanh nghiệp **thứ
   hai** → **401/403** (phiên chỉ mở một nơi, và `companyId` không đến từ client).
5. Gọi một Server Action ghi bất kỳ (ví dụ tạo ngày lễ) → **thất bại** với thông điệp
   `Bạn không có quyền thực hiện thao tác này.`
6. Đóng phiên → `GET /api/employees` trả **401/403** trở lại; `GET /api/platform/sessions`
   có đúng một dòng với `closedAt` khác `null`.

Thêm vào `package.json`:

```json
"test:e2e-support": "node --env-file=.env.local scripts/e2e-support.mjs"
```

- [ ] **Step 2: Chạy toàn bộ cổng**

```bash
npm run typecheck
npm run lint
npm run test
npm run check:assertions
npm run check:secrets
npm run test:db
npm run test:e2e-support
```

Expected: **tất cả PASS.** Ghi lại nguyên văn output của từng lệnh vào SUMMARY. Nếu
`npm run test:db` vẫn không chạy được vì thiếu `psql` (đã treo từ 04-06 đến 05-2-06),
ghi rõ điều đó là **giới hạn đã biết**, **không** ghi là "đã xác minh", và nêu rằng
`test:e2e-support` bước 3-5 phủ độc lập cùng hành vi trên database thật.

- [ ] **Step 3: Kiểm răng lần cuối trên đường ghi**

Sửa tạm `src/lib/auth/session-context.ts` cho `READ_ROLES` gồm cả `"manager"`, chạy
`npm run test`, xác nhận `session-context.test.ts` **đỏ**; hoàn nguyên, chạy lại, xác
nhận **xanh** và `git status` sạch.

- [ ] **Step 4: Viết biên bản nghiệm thu**

`.planning/phases/06-super-admin/06-UAT.md` — bốn tiêu chí của ROADMAP, mỗi tiêu chí
một mục: **cách quan sát**, **quan sát thật đã có** (kèm output), **còn thiếu gì**.

Đánh dấu rõ bốn thứ chủ dự án phải **bấm tay** trước khi ký:

1. `/platform` hiện đủ hai doanh nghiệp kèm số nhân viên đúng.
2. Mở phiên → banner hổ phách hiện đúng tên doanh nghiệp và số phút còn lại.
3. Bấm một nút ghi bất kỳ trong `/admin` khi đang ở phiên hỗ trợ → hiện đúng câu
   "Bạn không có quyền thực hiện thao tác này."
4. `/platform/log` hiện đúng dòng phiên vừa mở, kèm lý do đã nhập.

- [ ] **Step 5: Cập nhật tài liệu kế hoạch**

- `.planning/REQUIREMENTS.md`: SADM-01…04 → `[x]`, bảng phủ → `Complete`.
- `.planning/ROADMAP.md`: Phase 6 → `[x]`, `**Plans**: TBD` → `9/9 plans executed`,
  bảng Progress → `9/9 | Complete | 2026-08-__`.
- `.planning/STATE.md`: `current_phase`, `status`, `last_activity`, mục Decisions thêm
  D-49…D-56, mục Blockers/Concerns thêm mọi giới hạn còn treo của phase này.

- [ ] **Step 6: Commit**

```bash
git add scripts/e2e-support.mjs package.json .planning docs/superpowers
git commit -m "test: cong cuoi Phase 6 — e2e vong doi phien ho tro va nghiem thu bon tieu chi"
```

---

## Tự soát kế hoạch

**Phủ spec:** D-49 → Task 1; D-50 → Task 2; D-51 → Task 4; D-52 → Task 4+5;
D-53 → Task 6; D-54 → Task 6; D-55 → Task 1 (enum + policy) + Task 3 (hai dòng audit);
D-56 → Task 7 (`/platform` + RPC) + Task 8 (hai đường ghi). Bốn tiêu chí nghiệm thu của
ROADMAP → Task 9. Không có mục nào của spec thiếu task.

**Hai chỗ cần xác minh tên thật trong repo trước khi gõ** (không phải placeholder — mã
đã viết đủ, chỉ cần đối chiếu một định danh):

1. Task 2 Step 3 mục (b): tên policy thật của `storage.objects` trong `0012`.
2. Task 7 Step 1: tên cột thật của bảng `periods` (`period_month` / `status`).

**Nhất quán kiểu:** `AccessRole` khai ở Task 4 và dùng ở Task 5/6/7 cùng một tên;
`getActiveSupportSession()` trả `ActiveSupportSession` khai ở Task 3 và tiêu thụ ở
Task 4 + Task 6; `AuditEntry.companyId` nới thành `string | null` ở Task 8 và không
task nào trước đó dựa vào việc nó không nullable.
