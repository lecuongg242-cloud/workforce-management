# Phase 2: Phiên thật và cắt tầng dữ liệu giả - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

> **Nguồn gốc:** các quyết định dưới đây do chủ dự án đưa ra trực tiếp sau khi tự đọc code
> Phase 1 và phát hiện ba khoảng trống (xem `<specifics>`). Bước `/gsd-discuss-phase` được bỏ
> qua vì nội dung của nó đã được chủ dự án hoàn thành bằng tay.

<domain>
## Phase Boundary

Phase này thay phiên đăng nhập giả bằng Supabase Auth thật và cắt toàn bộ tầng dữ liệu giả:
mọi màn hình V1 đọc/ghi Postgres, `mock/db.ts` và `mock/seed.ts` biến mất khỏi mã nguồn.

**Trong phạm vi:** Supabase client (browser/server/middleware), phiên qua cookie, chặn route
ở `middleware.ts`, phân quyền bốn vai trò, quản trị tạo tài khoản nhân viên, thay thân toàn bộ
hàm trong `src/lib/mock/service.ts`, audit log ở tầng server, gỡ `REFERENCE_DATE`.

**Ngoài phạm vi:** ảnh/GPS chấm công (Phase 3), trang cài đặt doanh nghiệp (Phase 4), luồng
duyệt yêu cầu hoàn chỉnh (Phase 5), màn hình super admin và đường đọc xuyên doanh nghiệp
(Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Vai trò thứ tư — platform_admins kéo về Phase 2

- **D-11:** Tạo bảng `platform_admins` **tối thiểu** ở Phase 2: chỉ `user_id` + `created_at`,
  kèm hàm `tf_is_platform_admin()`, và tầng kiểm quyền có một nhánh cho nó. **Không** màn hình,
  **không** đường đọc xuyên doanh nghiệp, **không** đụng bất kỳ RLS policy nào của Phase 1.
  Phase 6 (SADM-02/04) cắm vào đây.
  — **Reversibility:** costly — tầng kiểm quyền viết ở phase này được gọi từ mọi màn hình;
  thêm vai trò thứ tư ở Phase 6 nghĩa là mở lại từng guard đã viết. Giá trả bây giờ là một bảng
  và một nhánh `if`.

- **D-11a:** `platform_admins` **phải bật RLS kèm ít nhất một policy**, và policy đúng là
  **chặn hết** — không ai đọc bảng trực tiếp, mọi truy cập qua `tf_is_platform_admin()`.
  Lý do bắt buộc: `supabase/tests/00_rls_coverage.sql` fail ở cả hai điều kiện
  `relrowsecurity = false` **và** RLS bật mà `pg_policies` đếm 0 — bỏ policy là cổng Phase 1 đỏ.

- **D-11b:** `tf_is_platform_admin()` theo đúng khuôn `tf_is_member()` tại
  `supabase/migrations/0002_tenancy.sql:64,76` — `security definer` cộng
  `revoke execute on function ... from public`.

- **Giới hạn đã biết:** ở Phase 2 nhánh này **không kiểm chứng được đến nơi**. Chỉ test được
  hàm trả đúng true/false; việc "platform admin thấy đúng cái được phép thấy" chỉ chứng minh
  được ở Phase 6. Không được ghi vào SUMMARY như thể đã kiểm chứng đầy đủ.

### Đường dữ liệu — hai transport

- **D-12:** **Route Handlers cho đọc, Server Actions cho ghi.**
  - Đọc qua Route Handler ⇒ `useMockQuery` chỉ đổi tên, `MockDataProvider` sống nguyên, các
    file `*-view.tsx` không phải sửa, nhiều truy vấn trên cùng trang chạy song song.
  - Ghi qua Server Action ⇒ không phải viết endpoint cho từng mutation, giữ kiểu end-to-end,
    và là chỗ tự nhiên gắn audit log.
  - Lý do loại "tất cả qua Server Actions": Next.js chạy Server Action **tuần tự**; dashboard
    bắn 4-5 truy vấn sẽ cộng dồn round-trip, và đó là thứ khó gỡ về sau vì lúc gỡ thì mọi view
    đã bám vào hình dạng đó.
  — **Reversibility:** costly — hình dạng transport ăn vào chữ ký của cả tầng service.

- **D-12a:** Điểm kiểm danh tính bắt buộc nằm ở **một module server dùng chung**
  (`getSessionContext()`), **không** nằm trong transport. Mỗi bên tự kiểm là có ngày lệch.

- **D-12b:** Route Handler là **URL công khai** — ai cầm cookie hợp lệ cũng gọi được, khác
  Server Action vốn có action id sinh lúc build. Hệ quả bắt buộc: mỗi handler gọi
  `getSessionContext()`, và **không có đường nào để `company_id` đến từ query param** — kể cả
  một param `?company=` tưởng là tiện.

- **D-12c:** **Route Handler chỉ được `GET`.** Server Action có kiểm tra origin sẵn; Route
  Handler xác thực bằng cookie thì không, nên một `POST` thêm vào cho tiện là một lỗ CSRF.
  Luật này phải có test chặn, không chỉ ghi trong tài liệu.

- **D-12d:** Nhánh đọc mất kiểu end-to-end (`fetch` không giữ kiểu như Server Action). Dùng
  chung một schema Zod ở hai đầu handler, **parse ở cả nơi trả và nơi nhận** — nếu không,
  `useMockQuery` trả `any` và ràng buộc "TypeScript strict, không dùng `any`" của dự án lặng lẽ
  thủng đúng tại chỗ dữ liệu vào.

- **D-12e:** Giữ nguyên **hình dạng lỗi** của `useMockQuery` (`error: string | null`). Lỗi mạng
  có hình dạng khác lỗi ném ra từ hàm in-process; chỗ chuyển đổi nằm trong service layer, không
  đẩy lên view. Đây là điều kiện để lời hứa "`*-view.tsx` không phải sửa một dòng" thành thật.

### Đăng ký tài khoản

- **D-13:** **Tắt đăng ký công khai.** Chủ dự án tạo tài khoản owner bằng script admin. Giữ
  nguyên màn hình `/onboarding` cho bước khai thông tin doanh nghiệp **sau khi đã đăng nhập**.
  Lý do: mở đăng ký nghĩa là người lạ tạo được dòng trong `companies` — RLS vẫn giữ cô lập,
  nhưng dọn tenant rác thành việc vận hành thật trong khi chưa có giới hạn tài nguyên hay
  thanh toán nào để cản.

- **D-13a:** Phải tắt ở **cấu hình Supabase Auth** (`disable_signup`), không chỉ giấu nút trên
  giao diện — endpoint `/signup` của GoTrue vẫn gọi được bằng `curl` nếu chỉ ẩn nút.

### Tài khoản trong seed

- **D-14:** Tạo credential thật cho **khoảng 10 người đại diện** — mỗi doanh nghiệp 1 owner,
  1 admin, 1 manager, 2 nhân viên. **30 người còn lại để `user_id = null`.**
  Đây không phải cho gọn: nó phủ đúng một trạng thái sản xuất thật — nhân viên ca kíp không bao
  giờ đăng nhập. Cột `employees.user_id` đã nullable sẵn
  (`supabase/migrations/0004_core_entities.sql:82`).

- **D-14a:** Đặt `email_confirm: true` khi gọi `createUser()`, không thì tài khoản kẹt ở trạng
  thái chờ xác nhận email và không ai đăng nhập được.

### Tách fixture khỏi seed

- **D-15:** Bốn uuid tổng hợp **ở lại `supabase/tests/`** phục vụ pgTAP trên Postgres CI (nơi
  `auth.users` chỉ là bảng compat — không có Supabase Auth nên không có vấn đề `identities`).
  Dữ liệu nghiệp vụ ở `seed.sql` **không còn hardcode uuid**; một script `scripts/seed-auth.mjs`
  gọi `auth.admin.createUser()` rồi mới điền `memberships` / `employees.user_id`.
  **Uuid tổng hợp không bao giờ chạm cloud.**
  Lý do: seed hiện chèn thẳng vào `auth.users` — bảng do Supabase quản lý — thiếu bản ghi
  `auth.identities` tương ứng, nên trên cloud thật luồng đăng nhập hỏng kể cả khi gán mật khẩu.

- **D-15a:** Việc tách này đổi cấu tạo `npm run test:db`: nó đang là migration + seed + tests.
  Sau khi tách, test phải tự dựng fixture của mình. **170 assertion hiện có không được âm thầm
  giảm** — số assertion sau khi tách phải bằng hoặc lớn hơn.

### Buộc đổi mật khẩu lần đầu

- **D-16:** Cờ đặt ở **`app_metadata`**, không phải cột DB và **tuyệt đối không phải
  `user_metadata`** (client sửa được qua `supabase.auth.updateUser()`). Nó nằm sẵn trong JWT nên
  `middleware.ts` chặn được mà không cần truy vấn DB.

- **D-16a:** `app_metadata` chỉ vào JWT **sau khi token refresh**. Xoá cờ xong mà không ép
  refresh session thì người dùng vẫn mang access token cũ với cờ cũ — đổi mật khẩu thành công
  rồi mà middleware vẫn đá về trang đổi mật khẩu, và họ không thoát ra được. Phải ép refresh
  ngay sau khi xoá cờ.

### Audit log

- **D-17:** Ghi ở **tầng server, không dùng trigger**. Trigger không biết actor khi thao tác đi
  qua đường admin API (tạo tài khoản — và cả đường ghi riêng của Phase 6), lại không bao giờ
  biết `reason` — cột đã có sẵn trong bảng và Phase 5 cần nó.

- **D-17a:** **Giới hạn phải ghi rõ:** audit ở tầng server đúng cho *ai* và *vì sao*, nhưng
  không đảm bảo *đủ*. Một migration hay một phiên psql tay ghi thẳng vào bảng sẽ không để lại
  vết. Không được để ai đọc `audit_log` rồi tin đó là bản ghi đầy đủ mọi thay đổi. Nếu sau này
  cần tính đầy đủ, thêm trigger làm lưới thứ hai ghi "thay đổi không rõ tác nhân" — bổ sung,
  không thay thế.

- **D-18:** `before`/`after` lưu **nguyên dòng, không lưu delta**. Ở quy mô này dung lượng không
  đáng kể, còn dựng lại một dòng từ delta thì đau.

- **D-18a:** **Hệ quả cần biết trước:** từ Phase 3, mỗi dòng `attendance_records` mang toạ độ
  GPS, nên `audit_log` thành bản sao thứ hai của dữ liệu cá nhân với vòng đời riêng. Phần quyền
  riêng tư đã ra khỏi phạm vi V2 nên đây không phải việc phải làm — ghi lại để nó không thành
  bất ngờ.

### Thời gian

- **D-19:** **"Hôm nay" do server cấp, truyền xuống như dữ liệu.** Không `new Date()` trong
  client component cho bất cứ thứ gì render ở lần vẽ đầu. Phase 1 đã có `tf_work_date()` /
  `tf_tz()`. Đây đúng là lý do V1 phải đóng băng `REFERENCE_DATE`.

- **D-19a:** Quy ước này phải **cưỡng chế được**, không chỉ là quy ước: thêm rule ESLint cấm
  `new Date()` và `Date.now()` trong client component. Đây là loại quy ước âm thầm mục sau vài
  tháng, và triệu chứng của nó là lỗi hydration khó truy.

### Claude's Discretion

- Cách đặt tên và bố cục thư mục `src/lib/supabase/`
- Hình dạng cụ thể của `getSessionContext()` và kiểu trả về
- Cách tổ chức Route Handler theo route segment
- Chi tiết schema Zod dùng chung ở biên
- Cách viết rule ESLint cho D-19a
- Thứ tự thay thế ~40 hàm trong `service.ts`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phạm vi và yêu cầu
- `.planning/ROADMAP.md` §"Phase 2: Phiên thật và cắt tầng dữ liệu giả"
- `.planning/REQUIREMENTS.md` §AUTH-01..AUTH-05, §DATA-05, DATA-06, DATA-08
- `.planning/PROJECT.md` — quyết định kiến trúc đã khóa và ràng buộc

### Nền tảng đã dựng ở Phase 1 (đọc trước khi thiết kế)
- `supabase/migrations/0002_tenancy.sql` — `tf_is_member()`, khuôn `security definer` + `revoke execute` để nhân bản cho `tf_is_platform_admin()`
- `supabase/migrations/0003_enums_time.sql` — `tf_tz`, `tf_work_date`, `tf_overnight`, `tf_shift_minutes`, `tf_worked_minutes`
- `supabase/migrations/0004_core_entities.sql` — 5 bảng V1; dòng 82 là `employees.user_id uuid null`
- `supabase/tests/00_rls_coverage.sql` — cổng RLS mà `platform_admins` phải thoả
- `supabase/seed.sql` — nơi 4 uuid tổng hợp đang nằm và phải được gỡ ra (D-15)
- `.planning/phases/01-*/01-0{1..6}-SUMMARY.md` — những gì Phase 1 thực sự giao

### Mã nguồn V1 phải đọc
- `src/lib/mock/service.ts` — ~40 hàm cần thay thân, giữ nguyên chữ ký
- `src/lib/auth/session-provider.tsx` — phiên localStorage bị thay thế
- `src/hooks/use-mock-query.ts` — hook giữ nguyên hình dạng, đổi nguồn
- `src/lib/mock/store.tsx` — `MockDataProvider` version counter, giữ nguyên
- `src/lib/types/domain.ts` — `CompanyRole` chỉ có 4 giá trị cấp doanh nghiệp; super admin **không** thuộc enum này
- 9 file bám `REFERENCE_DATE` (xem `<specifics>`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`tf_is_member()`** — khuôn hàm bảo vệ để nhân bản cho `tf_is_platform_admin()`
- **`useMockQuery` + `MockDataProvider`** — giữ nguyên cơ chế, chỉ đổi nguồn dữ liệu. Không thay bằng thư viện fetching ở phase này.
- **`supabase/tests/helpers.sql`** — `tf_test_login` / `tf_test_logout` đã có, dùng lại cho test phân quyền

### Established Patterns
- Một cửa ra dữ liệu: mọi truy cập qua `src/lib/mock/service.ts`. Giữ nguyên chữ ký khi đổi thân.
- Nhãn tiếng Việt ở `constants.ts`, giá trị enum tiếng Anh ở `domain.ts`. DB không bao giờ chứa chuỗi hiển thị.
- TypeScript strict, không `any`.

### Integration Points
- `src/lib/supabase/` — thư mục mới
- `middleware.ts` ở gốc `src/` — file mới
- `src/app/api/` — Route Handlers, thư mục mới
- `scripts/seed-auth.mjs` — file mới
- `package.json` — thêm `@supabase/supabase-js`, `@supabase/ssr`

</code_context>

<specifics>
## Specific Ideas

Ba phát hiện của chủ dự án khi tự soi code Phase 1, đã được xác minh:

1. **`supabase/seed.sql` chèn 4 dòng `auth.users` không có mật khẩu** — `encrypted_password`
   xuất hiện 0 lần. Chúng là fixture cho pgTAP (chỉ cần `uid` để `tf_test_login` giả lập phiên),
   nên không phải lỗi của Phase 1. Nhưng trên cloud thật không tài khoản nào trong đó đăng nhập
   được, và việc chèn thẳng vào `auth.users` thiếu bản ghi `auth.identities`. Xử lý ở D-15.

2. **Enum `company_role` không có `super_admin`** — `owner | admin | manager | employee`
   (`0002_tenancy.sql:13`), khớp `CompanyRole` ở `domain.ts:47`. **Enum đang đúng**: thêm
   `super_admin` vào đây là lỗi mô hình, vì nó ngụ ý super admin phải là thành viên của một
   doanh nghiệp cụ thể. Chỗ hổng thật là vai trò thứ tư chưa có nhà — xử lý ở D-11.

3. **Chưa có gì về Supabase client** — không `@supabase/supabase-js`, không `@supabase/ssr`,
   không `middleware.ts`, không `src/lib/supabase/`. Đúng phạm vi Phase 2.
   **`REFERENCE_DATE` bám 9 file, trong đó 4 là UI** — DATA-08 không phải xoá một hằng số, nó
   chạm cả tầng hiển thị. Ước lượng phải tính điều này:
   ```
   src/app/admin/dashboard/dashboard-view.tsx
   src/app/employee/employee-home-view.tsx
   src/components/employee-app/request-form-sheet.tsx
   src/components/employees/employee-form.tsx
   src/lib/auth/session-provider.tsx
   src/lib/constants.ts
   src/lib/mock/db.ts
   src/lib/mock/seed.ts
   src/lib/mock/service.ts
   ```

</specifics>

<deferred>
## Deferred Ideas

- **Màn hình super admin và đường đọc xuyên doanh nghiệp** — Phase 6 (SADM-02/04), cắm vào
  `platform_admins` mà phase này dựng.
- **Trigger audit làm lưới thứ hai** — chỉ khi cần tính đầy đủ; xem D-17a.
- **Vòng đời và lưu trữ dữ liệu cá nhân trong `audit_log`** — xem D-18a; phần quyền riêng tư đã
  ra khỏi phạm vi V2, theo dõi ở nhóm PRIV cho V3.
- **Thay `useMockQuery` bằng TanStack Query** — không làm ở phase này; nó trực giao với việc
  mock→thật, gộp vào chỉ làm rối chẩn đoán khi có lỗi.
- **Thu hồi khóa Supabase legacy** — đã ra khỏi phạm vi theo quyết định ngày 2026-07-31.

</deferred>

---

*Phase: 2-Phiên thật và cắt tầng dữ liệu giả*
*Context gathered: 2026-07-31*
