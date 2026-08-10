# Phase 6 — Super admin và hỗ trợ nhiều doanh nghiệp (SADM-01…04)

> **Ngày viết:** 2026-08-10
> **Requirements:** SADM-01, SADM-02, SADM-03, SADM-04 (`.planning/REQUIREMENTS.md:131-134`)
> **Phụ thuộc:** Phase 5.2 (đã thực thi xong)
> **Đánh số quyết định:** tiếp nối D-48 của Phase 5.3 → phase này dùng D-49…D-56

## Mục tiêu

Đội vận hành TimeFlow nhìn được toàn hệ thống và hỗ trợ được một doanh nghiệp cụ thể
mà **không** phá vỡ ranh giới cô lập đã dựng ở Phase 1.

## Điểm bắt đầu đã đo được (2026-08-10)

| Thứ | Trạng thái | Nguồn |
|---|---|---|
| `platform_admins` + `tf_is_platform_admin()` | **Đã có**, RLS chặn đọc trực tiếp | `supabase/migrations/0006_platform_admins.sql` |
| `SessionContext.isPlatformAdmin` | **Đã có**, được tính mỗi lần gọi | `src/lib/auth/session-context.ts:137-147` |
| Nơi dùng `isPlatformAdmin` | **0 chỗ** — cờ chết từ Phase 2 | grep toàn `src/` |
| `audit_log.company_id` | **Đã nullable sẵn cho Phase 6** | `0005_v2_tables.sql:83-91` |
| Policy `select` đang sống | **23 bảng** cấp doanh nghiệp: 19 theo khuôn `tf_is_member`, 4 bảng lương theo khuôn `tf_is_company_admin` (0029/0030) | dựng lại từ toàn bộ lịch sử `create`/`drop policy`, không phải grep `create` |
| `requireRole(role, ["owner","admin"])` trong `src/app/api/**` | **13 chỗ** | grep |
| `isAdminRole = role === "owner" \|\| role === "admin"` tính inline | **7 chỗ** trong `src/app/api/**` | grep |
| `requireRole` trong `src/lib/data/mutations/*.ts` | **51 chỗ / 16 file** | grep |
| Màn hình super admin | **Chưa có** — không có route `/platform` hay `/superadmin` | `find src/app` |

Nói cách khác: **nền đã có, chưa có gì đứng trên nó.** Migration 0006 tự ghi trong
comment rằng "platform admin thấy đúng cái được phép thấy" sẽ đợi Phase 6 — đây là
phase đó.

---

## Quyết định thiết kế

### D-49 — Phiên hỗ trợ có thời hạn, không phải quyền vượt RLS dùng chung

Tiêu chí 4 của phase loại trừ tường minh "quyền vượt RLS dùng chung". Một policy
`or tf_is_platform_admin()` gắn thẳng vào 23 bảng chính là thứ đó: một lần đăng nhập
là thấy mọi doanh nghiệp, mãi mãi, không ranh giới thời gian, không lý do, không vết.

Thay vào đó: platform admin phải **mở một phiên hỗ trợ** cho **đúng một** doanh
nghiệp, có lý do bắt buộc và có hạn. Quyền đọc suy ra từ phiên đó, không suy từ danh
tính.

**Bảng `support_sessions`** (migration 0033):

| cột | kiểu | ghi chú |
|---|---|---|
| `id` | `uuid` pk | |
| `platform_admin_id` | `uuid not null` → `auth.users` | ai mở |
| `company_id` | `text not null` → `companies` | mở vào đâu |
| `reason` | `text not null` | vì sao — không có mặc định, không nullable |
| `opened_at` | `timestamptz not null default now()` | |
| `expires_at` | `timestamptz not null` | mặc định `opened_at + interval '60 minutes'` |
| `closed_at` | `timestamptz null` | đóng tay trước hạn |

**Hàm `public.tf_has_support_access(p_company_id text)`** — nhân bản đúng khuôn bảo vệ
của `tf_is_member` (`0002_tenancy.sql:63-77`): `security definer`, `stable`, tự lọc
theo `auth.uid()` bên trong, **không** nhận tham số người dùng (cùng threat T-01-03).

```sql
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
```

**60 phút** là hằng số hạ tầng vận hành TimeFlow, không phải quy tắc nghiệp vụ của
doanh nghiệp — nên nó nằm trong mã (`SUPPORT_SESSION_MINUTES`) và **không** rơi vào
phạm vi cổng `no-hardcoded-work-rules` / `no-hardcoded-money`.

### D-50 — Chỉ mở `select`, ba lệnh ghi giữ nguyên `tf_is_member`

23 policy `*_select_member` đổi thành:

```sql
using (public.tf_is_member(company_id) or public.tf_has_support_access(company_id))
```

Ba lệnh `insert` / `update` / `delete` **không đổi một chữ**. Đây là chỗ tiêu chí 4
được thoả ở tầng database — không phải bằng một lời hứa ở tầng ứng dụng.

**Phạm vi chính xác:**

- **Có đổi, khuôn chung (19 bảng):** `companies` (scope theo `id`), `memberships`,
  `departments`, `employees`, `shifts`, `work_sites`, `attendance_records`,
  `attendance_photos`, `holidays`, `overtime_rules`, `employee_overtime_rates`,
  `company_settings`, `periods`, `work_requests`, `request_reviews`, `audit_log`,
  `pay_adjustments`, `pay_adjustment_scopes`, `employee_pay_rates` — tất cả là
  `*_select_member` với điều kiện duy nhất `tf_is_member(...)`.
- **Có đổi, khuôn RIÊNG (4 bảng lương):** `payroll_runs`, `payroll_lines`,
  `payroll_line_items`, `payroll_line_days`. **Đo lại 2026-08-10 khi thực thi Task 2:**
  bốn bảng này KHÔNG dùng `tf_is_member`. Migration 0029 (PAY-05) đã thay ba policy
  `*_select_member` bằng `*_select_scoped` với điều kiện **chặt hơn**
  (`tf_is_company_admin` thay vì mọi thành viên) cộng một nhánh cho nhân viên xem
  phiếu lương của chính mình; 0030 nhân bản khuôn đó cho bảng thứ tư. Vì
  `alter policy ... using (...)` **thay thế** toàn bộ biểu thức, áp khuôn chung vào
  đây sẽ âm thầm **nới** quyền đọc bảng lương từ "chỉ quản trị" thành "mọi thành
  viên" — một lỗ hổng lặng lẽ, không phải một lỗi báo đỏ. Ba nhánh cũ được chép
  nguyên văn, chỉ thêm đúng một dòng `or tf_has_support_access(company_id)`.
- **Có đổi:** policy `storage.objects` của bucket `attendance-photos`
  (`0012_attendance_photo_storage_rls.sql`, dùng `tf_is_member` qua
  `split_part(name,'/',1)`) — không đổi thì ảnh chấm công 403 trong phiên hỗ trợ và
  màn hình xem lại của quản trị vô dụng với đội hỗ trợ.
- **KHÔNG đổi:** `notifications` — RLS theo **người nhận** chứ không theo doanh nghiệp
  (D-34). Đội hỗ trợ không có việc gì với hộp thông báo cá nhân của một nhân viên.
- **KHÔNG đổi:** `platform_admins` — vẫn chặn đọc trực tiếp, mọi câu trả lời đi qua
  `tf_is_platform_admin()` (D-11a).

**Bộ test cô lập của Phase 1 vẫn xanh không sửa một assertion nào**: tài khoản trong
đó không nằm trong `platform_admins` nên `tf_has_support_access` trả `false` ở mọi
nhánh, và `or false` không đổi kết quả của bất kỳ phép đọc nào.

### D-51 — `support` là vai trò truy cập, không phải vai trò doanh nghiệp

`getSessionContext()` hôm nay ném `NoMembershipError` khi người dùng có 0 membership
active. Mọc **đúng một nhánh**: 0 membership **và** đang có phiên hỗ trợ khớp cookie
`tf_active_company` → trả context với `role: "support"`, `employeeId: null`.

Kiểu mới khai trong `session-context.ts`, **không** đụng `domain.ts`:

```ts
export type AccessRole = CompanyRole | "support";
```

`CompanyRole` trong `domain.ts` giữ nguyên bốn giá trị. `COMPANY_ROLE_LABEL`,
`SYSTEM_ROLE_OPTIONS`, form khai vai trò nhân viên đều **không biết** `"support"` tồn
tại — vì đó không phải một vai trò ai gán được cho ai, nó là trạng thái của một phiên.

### D-52 — Hai vị ngữ, và cổng cơ học giữ chúng tách nhau

| vị ngữ | giá trị | dùng ở đâu |
|---|---|---|
| `canReadCompanyData(role)` | `owner \| admin \| support` | 13 `requireRole` + 7 `isAdminRole` inline trong `src/app/api/**` |
| `requireRole(role, ["owner","admin"])` | không đổi | 51 chỗ trong `src/lib/data/mutations/*.ts` — **không sửa một file nào** |

Hệ quả then chốt: mọi Server Action ghi **tự động** ném `ForbiddenError` cho phiên hỗ
trợ, không phải viết thêm một guard nào. Chỗ nào quên là chỗ đó **chặn**, không phải
chỗ đó **lọt** — đúng hướng hỏng an toàn.

Bảy chỗ tính `isAdminRole` inline (`api/attendance`, `api/attendance/summary`,
`api/attendance/classification`, `api/requests`, `api/requests/[id]/reviews`,
`api/requests/overtime-usage`, và `api/attendance/route.ts` nhánh `isSelfScoped`) là
mối nguy thật: bỏ sót một chỗ thì phiên hỗ trợ bị thu phạm vi về
`sessionEmployeeId`, mà giá trị đó là `null`, và màn hình sẽ rỗng chứ không báo lỗi.

Cổng `src/__tests__/no-inline-admin-role.test.ts`: không file nào dưới `src/app/api/`
được so `role === "owner"` trực tiếp — bắt buộc đi qua vị ngữ. Cổng này bảo vệ các
phase sau, không chỉ phase này.

### D-53 — Ba chỗ vỡ giao diện, đã đo chứ không suy đoán

1. **`getClientSession()` trả `null` khi `employeeId` null** (`session-context.ts:213`)
   → `AdminShell` kẹt ở `AdminShellSkeleton` vĩnh viễn (`admin-shell.tsx:45-47`).
   Sửa: `AppUser.employeeId` đổi thành `string | null`; thêm `useEmployeeSession()`
   narrow lại cho 6 call site dưới `/employee/*` (`employee-home-view`,
   `history-view`, `profile-view` ×2, `requests-view`, `employee-shell`).
2. **`AdminShell` gọi `listCompanies()`** để lấy tên doanh nghiệp hiện hành
   (`admin-shell.tsx:36,50`) → rỗng cho platform admin vì route đó đọc `memberships`.
   Sửa: `GET /api/companies` thêm nhánh trả đúng doanh nghiệp đang có phiên hỗ trợ.
3. **`ADMIN_AREA_ROLES`** thiếu `"support"` → `/admin/layout.tsx` đá về `/employee`.

### D-54 — Banner hỗ trợ dính đỉnh; nút ghi KHÔNG ẩn

Khi `role === "support"`, mọi trang `/admin/*` mang một banner dính đỉnh, nền hổ
phách: `Đang xem NGỌC PHÁT — phiên hỗ trợ, còn 27 phút` + nút *Đóng phiên*. Đây là
cách tiêu chí 2 ("màn hình luôn hiển thị rõ đang xem doanh nghiệp nào") được thoả.

Nút ghi trên 10 màn hình quản trị **không ẩn**. Chúng vẫn hiện và vẫn báo
"Bạn không có quyền thực hiện thao tác này." Ẩn nút ở 10 màn hình là 10 chỗ để quên
và 10 chỗ để một phase sau thêm màn hình thứ 11 mà không biết; còn thông điệp từ chối
thì đến từ **một** chỗ duy nhất (`requireRole`) và không quên được.

Đánh đổi đã cân nhắc: trải nghiệm của đội hỗ trợ kém hơn một chút (bấm rồi mới biết
không được), nhưng đó là người dùng nội bộ, còn thứ được bảo vệ là dữ liệu của khách.

### D-55 — Một dòng cho mỗi PHIÊN, không phải mỗi request

SADM-03 nói "mỗi lần super admin chạm vào dữ liệu đều có một dòng audit log". Đơn vị
đếm là **phiên hỗ trợ**, không phải HTTP request.

Lý do: một buổi hỗ trợ 30 phút đẻ ra hàng trăm request; ghi từng cái sẽ chôn vùi
chính audit nghiệp vụ mà `audit_log` sinh ra để phục vụ, và thêm một lần ghi DB vào
mọi đường đọc. Bản thân bảng `support_sessions` **chính là** nhật ký — không dựng cơ
chế thứ hai.

Hai dòng `audit_log` cho mỗi phiên: một khi **mở**, một khi **đóng**. Cần:

- Giá trị enum mới: `alter type audit_action add value 'access';`
- Policy `audit_log_insert_support` — phiên hỗ trợ ghi được dòng của chính mình
  (policy `audit_log_insert_member` hiện tại đòi `tf_is_member` nên platform admin
  không lọt qua).

RLS `support_sessions`: `select` cho platform admin (qua `tf_is_platform_admin()`)
**và** cho thành viên của doanh nghiệp đó (khách hàng đọc được ai đã vào dữ liệu của
mình — đây là tính năng, không phải rò rỉ); `insert`/`update` chỉ platform admin;
**không có policy `delete`** — nhật ký không xoá được.

### D-56 — Khu `/platform/*` và hai đường ghi trắng

**`/platform`** — layout riêng, không sidebar quản trị, chặn bằng `isPlatformAdmin`:

- `/platform` — danh sách toàn hệ thống (SADM-01): tên, mã, số nhân viên, hoạt động
  gần nhất, kỳ đang mở. Bấm một dòng → hộp thoại bắt nhập lý do → `openSupportSession()`
  → đặt cookie `tf_active_company` → chuyển tới `/admin/dashboard`.
- `/platform/log` — nhật ký mọi phiên hỗ trợ đã mở (SADM-03).

Danh sách toàn hệ thống đọc qua **RPC `tf_platform_company_overview()`**
(`security definer`, tự kiểm `tf_is_platform_admin()` bên trong, trả về số tổng hợp
chứ không trả một dòng dữ liệu nghiệp vụ nào) — **không** qua khoá service. Cổng
`src/__tests__/admin-client-scope.test.ts` cấm `createAdminSupabase()` ngoài
`"use server"`/`mutations/`, và nới cổng đó cho một Route Handler đọc là đổi một cổng
đang có răng lấy sự tiện tay.

**Hai đường ghi trắng** (SADM-04) — mỗi cái một Server Action riêng dưới
`src/lib/data/mutations/platform.ts`, bắt buộc lý do, mỗi lần một dòng `audit_log`:

| hàm | làm gì | vì sao cần |
|---|---|---|
| `resetTempPasswordForUser(userId, reason)` | cấp lại mật khẩu tạm + bật cờ `must_change_password` | khách mất mật khẩu, hôm nay đội vận hành phải mở Supabase dashboard tay |
| `grantOwnerMembership(companyId, userId, reason)` | cấp lại membership `owner` | khách mất đường vào chính doanh nghiệp mình |

Cả hai đi qua Admin API (`createAdminSupabase()`), **không** qua RLS — đúng nghĩa
"đường riêng có kiểm soát" của SADM-04. Cả hai nằm **ngoài** dữ liệu chấm công và
lương: đội vận hành không sửa được một bản ghi công hay một con số tiền nào, ở bất kỳ
đường nào. Đó là lời hứa lõi của sản phẩm và phase này không được phép đụng vào.

---

## Kiến trúc — dòng chảy một buổi hỗ trợ

```
Platform admin đăng nhập
  → getSessionContext(): 0 membership, 0 phiên → NoMembershipError
  → /select-company thấy rỗng, nhưng isPlatformAdmin=true → link sang /platform

/platform
  → GET /api/platform/companies → RPC tf_platform_company_overview()
  → bấm "Ngọc Phát" → hộp thoại lý do → openSupportSession("cty-01", "Ticket #418")
      · insert support_sessions (expires_at = now + 60')
      · insert audit_log (action='access', company_id='cty-01', reason='Ticket #418')
      · set cookie tf_active_company = 'cty-01'
  → redirect /admin/dashboard

/admin/*
  → getSessionContext(): 0 membership NHƯNG có phiên khớp cookie
      → { companyId: 'cty-01', role: 'support', employeeId: null }
  → RLS: mọi SELECT lọt qua nhánh tf_has_support_access
  → Route Handler đọc: canReadCompanyData('support') = true
  → Server Action ghi: requireRole('support', ['owner','admin']) → ForbiddenError
  → SupportBanner đếm ngược 60' + nút Đóng phiên

Đóng phiên (tay hoặc hết hạn)
  → closeSupportSession(): set closed_at, insert audit_log, xoá cookie
  → tf_has_support_access trả false NGAY LẬP TỨC ở request kế tiếp
  → /admin/* → NoMembershipError → /select-company
```

Điểm đáng chú ý: **hết hạn không cần cron.** `tf_has_support_access` so `now()` mỗi
lần gọi, nên phiên tự chết ở tầng database mà không có tiến trình nền nào phải chạy.

## Kiểm thử

| tầng | file | khẳng định |
|---|---|---|
| pgTAP | `supabase/tests/20_support_sessions.sql` (mới) | phiên **hết hạn** không đọc được dòng nào; phiên mở cho Ngọc Phát không đọc được dòng nào của Bình Minh; **ghi** vẫn bị từ chối khi đang có phiên; `delete` trên `support_sessions` bị từ chối |
| pgTAP | `01_isolation_companies.sql`, `03_isolation_core.sql`, `04_isolation_v2.sql` | **chạy lại không sửa** — bằng chứng D-50 không nới ranh giới cho người thường |
| Vitest | `src/lib/auth/__tests__/session-context.test.ts` | nhánh `support` trả đúng `role`/`employeeId`; phiên hết hạn quay lại `NoMembershipError` |
| Vitest (cổng) | `src/__tests__/no-inline-admin-role.test.ts` (mới) | 0 chỗ so `role === "owner"` inline dưới `src/app/api/` |
| Vitest (cổng) | `src/__tests__/admin-client-scope.test.ts` | **không nới** — `/api/platform/*` không import `createAdminSupabase` |
| Tích hợp | `src/lib/data/mutations/__tests__/platform.test.ts` (mới) | hai đường ghi trắng ghi đúng `audit_log`; thiếu lý do thì ném |
| e2e | `scripts/e2e-support.mjs` (mới) | qua HTTP thật: mở phiên → đọc được `/api/employees` của khách → ghi bị 403 → đóng phiên → đọc lại bị 401/403 |

**Kiểm răng (sabotage-and-revert)** theo tiền lệ của mọi phase trước: sửa
`tf_has_support_access` thành `select true`, chạy `20_support_sessions.sql`, xác nhận
đỏ, hoàn nguyên, xác nhận xanh.

## Ngoài phạm vi (có chủ đích)

- **Không** có màn hình quản lý danh sách platform admin — thêm/bớt vẫn bằng `insert`
  tay vào `platform_admins`. Đội vận hành TimeFlow có 1–2 người ở quy mô hiện tại.
- **Không** có gia hạn phiên. Hết 60 phút thì mở phiên mới, và phiên mới là một dòng
  nhật ký mới — đó là tính năng, không phải phiền hà.
- **Không** có thông báo cho khách hàng khi có phiên hỗ trợ mở. Nhật ký đọc được là đủ
  cho V2; thông báo chủ động là việc của V3.
- **Không** đụng vào rủi ro khoá `service_role` legacy đã được ghi nhận và chấp nhận ở
  `.planning/PROJECT.md` §Out of Scope.

## Tiêu chí nghiệm thu (bốn tiêu chí của ROADMAP)

1. Super admin thấy danh sách toàn bộ doanh nghiệp kèm số nhân viên, hoạt động gần
   nhất, kỳ đang mở → `/platform`.
2. Super admin mở sâu được dữ liệu một doanh nghiệp, màn hình luôn nói rõ đang xem
   nơi nào → `/admin/*` + `SupportBanner`.
3. Mỗi lần chạm vào dữ liệu có một dòng audit ghi ai / doanh nghiệp nào / lúc nào →
   `support_sessions` + hai dòng `audit_log` mỗi phiên (D-55).
4. Quyền ghi đi qua đường riêng có kiểm soát, và bộ test cô lập Phase 1 vẫn xanh →
   `mutations/platform.ts` + `20_support_sessions.sql` + ba file isolation chạy lại
   không sửa.
