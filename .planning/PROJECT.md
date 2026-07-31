# TimeFlow

## What This Is

TimeFlow là nền tảng SaaS multi-tenant quản lý chấm công và chuẩn bị dữ liệu tính
lương cho doanh nghiệp vừa và nhỏ tại Việt Nam. Người dùng gồm hai nhóm: quản trị
viên / nhân sự làm việc trên giao diện desktop (`/admin/*`) và nhân viên chấm công
trên giao diện mobile (`/employee/*`).

V1 đã hoàn thiện toàn bộ frontend nhưng chạy trên lớp dữ liệu giả: mọi truy vấn đi
qua `src/lib/mock/service.ts` với in-memory database, phiên đăng nhập lưu ở
localStorage. **V2 biến TimeFlow từ prototype thành sản phẩm chạy thật** — backend
Supabase, chấm công có bằng chứng chống gian lận, và các module quản trị còn thiếu.

## Core Value

Doanh nghiệp tin được số liệu chấm công: mỗi bản ghi vào/ra là có thật, đúng nơi,
đúng giờ — và không doanh nghiệp nào nhìn thấy dữ liệu của doanh nghiệp khác.

## Business Context

- **Customer**: Doanh nghiệp vừa và nhỏ tại Việt Nam có nhân viên làm theo ca
- **Revenue model**: SaaS thuê bao theo doanh nghiệp (chưa triển khai thu tiền ở V2)
- **Success metric**: 1-2 doanh nghiệp chạy thật trọn một kỳ công mà không phải sửa
  tay dữ liệu chấm công
- **Strategy notes**: Thiết kế gói cước ở `docs/DESIGN-stripe.md` — hoãn sang sau V2

## Requirements

### Validated

<!-- Suy ra từ codebase V1 hiện có (.planning/codebase/) — đã chạy được, đang được dựa vào -->

- ✓ Đăng nhập, onboarding doanh nghiệp 3 bước, chọn doanh nghiệp khi thuộc nhiều nơi — V1
- ✓ Dashboard quản trị: KPI, biểu đồ 7 ngày, hoạt động hôm nay, yêu cầu chờ duyệt — V1
- ✓ Quản lý nhân viên: danh sách, tìm kiếm, lọc, phân trang, thao tác hàng loạt, hồ sơ 5 tab — V1
- ✓ Quản lý phòng ban — V1
- ✓ Quản lý ca làm việc, hỗ trợ ca qua đêm — V1
- ✓ App nhân viên: chấm công vào/ra, tổng hợp tháng, lịch sử theo tháng, hồ sơ cá nhân — V1
- ✓ Tạo yêu cầu nghỉ phép / bổ sung công / tăng ca (phía nhân viên) — V1
- ✓ Design system thống nhất: design tokens trong `globals.css`, shadcn/ui đã chỉnh theo thương hiệu — V1
- ✓ Toàn bộ nhãn tiếng Việt tách riêng ở `src/lib/constants.ts`, enum nghiệp vụ bằng tiếng Anh — V1
- ✓ Domain types tập trung ở `src/lib/types/domain.ts`, ánh xạ thẳng sang cột enum Postgres — V1

### Active

<!-- Phạm vi V2. Đây là giả thuyết cho tới khi ship và xác nhận. -->

**Nền tảng dữ liệu thật**

- [ ] Schema Postgres trên Supabase phản chiếu `src/lib/types/domain.ts`
- [ ] RLS policy cô lập dữ liệu theo `company_id` cho mọi bảng
- [ ] Thay thân hàm trong `service.ts` bằng truy vấn thật, xóa `mock/db.ts` và `mock/seed.ts`
- [ ] Supabase Auth thay `session-provider.tsx`; chặn route bằng `middleware.ts` đọc cookie
- [ ] Thu hồi và cấp lại toàn bộ khóa Supabase đang nằm plaintext trong `docs/env`
- [ ] Phân quyền theo vai trò (nhân viên / quản lý / quản trị / super admin)

**Chấm công có bằng chứng**

- [ ] Chấm công bắt buộc kèm ảnh **hiện trường nơi làm việc** chụp trực tiếp bằng camera
      (không cho chọn ảnh có sẵn) — không phải ảnh chân dung nhân viên
- [ ] Chấm công bắt buộc kèm toạ độ GPS, kiểm tra nằm trong bán kính điểm làm việc
- [ ] Quản trị cấu hình được điểm làm việc và bán kính cho phép
- [ ] Quản trị xem lại ảnh + vị trí của từng bản ghi chấm công
- [ ] Lưu trữ ảnh chấm công an toàn, chỉ người có quyền trong cùng doanh nghiệp xem được

**Cài đặt doanh nghiệp**

- [ ] Trang `/admin/settings`: cấu hình giờ làm, thời gian ân hạn, quy tắc tính công
- [ ] Chủ doanh nghiệp tự khai ngày nghỉ lễ và hệ số tăng ca — hệ thống không áp cứng giá trị nào
- [ ] Quản trị tạo tài khoản cho nhân viên và gán vai trò
- [ ] Chốt kỳ công: kỳ đã chốt chỉ sửa được qua yêu cầu được duyệt, có ghi vết

**Duyệt yêu cầu hoàn chỉnh**

- [ ] Luồng duyệt nghỉ phép / bổ sung công / tăng ca: duyệt, từ chối kèm lý do
- [ ] Yêu cầu được duyệt tác động đúng vào dữ liệu công của kỳ
- [ ] Lịch sử xử lý yêu cầu, ai duyệt lúc nào
- [ ] Thông báo cho nhân viên khi yêu cầu được xử lý

**Super admin**

- [ ] Xem và quản lý toàn bộ doanh nghiệp trên hệ thống
- [ ] Hỗ trợ khách hàng: tra cứu tình trạng một doanh nghiệp cụ thể

### Out of Scope

- **Tính lương đầy đủ** (gross-net, thuế TNCN, BHXH/BHYT/BHTN, phiếu lương) — hoãn
  sang V3. Rủi ro nghiệp vụ cao, cần đúng luật và kiểm thử kỹ; V2 chỉ cần dữ liệu
  công đúng đã đủ giá trị.
- **Chấm công bằng QR** — loại bỏ có chủ đích: nhân viên có thể chụp sẵn mã QR rồi
  quét từ nhà, không chứng minh được sự hiện diện.
- **Khóa thiết bị** (mỗi nhân viên chỉ chấm từ một máy đã đăng ký) — cân nhắc nhưng
  bỏ: phát sinh nghiệp vụ đổi máy / mất máy, tăng tải cho nhân sự mà ảnh + GPS đã
  đủ với quy mô pilot.
- **Thanh toán gói SaaS / Stripe billing** — chưa cần khi chỉ triển khai 1-2 doanh
  nghiệp; thiết kế đã có sẵn ở `docs/DESIGN-stripe.md` để dùng sau.
- **Máy chấm công phần cứng, nhận diện khuôn mặt** — chi phí tích hợp lớn, không
  cần cho pilot.
- **Nhận diện khuôn mặt / liveness detection** — ảnh chấm công là ảnh hiện trường nơi
  làm việc, không có khuôn mặt để đối chiếu.
- **Màn hình xin đồng ý thu thập dữ liệu** — ảnh chụp là nơi làm việc nên không phải
  dữ liệu sinh trắc. Ghi chú còn tồn: toạ độ GPS của nhân viên vẫn thuộc dữ liệu cá
  nhân theo NĐ 13/2023; theo dõi ở nhóm PRIV trong REQUIREMENTS.md cho V3.
- **Mời thành viên qua email hoặc SMS OTP** — quản trị tạo tài khoản trực tiếp, không
  phụ thuộc nhà cung cấp email/SMS.
- **Duyệt nhiều cấp** — quá mức cần thiết cho doanh nghiệp pilot cơ cấu phẳng.
- **Theo dõi vị trí liên tục** — chỉ lấy toạ độ tại thời điểm chấm công.
- **Đa ngôn ngữ** — thị trường mục tiêu là Việt Nam, giữ một locale.
- **Mobile app native** — web mobile-first đã phục vụ được nhân viên.

## Context

**Điểm xuất phát.** V1 là một frontend hoàn chỉnh đã được thiết kế sẵn cho việc nối
backend. Toàn bộ truy cập dữ liệu đi qua một cửa duy nhất là `src/lib/mock/service.ts`
(~40 hàm async), tên hàm và chữ ký đã đặt theo hướng ánh xạ 1-1 sang Supabase. Không
component nào import trực tiếp `mock/db.ts` hay `mock/seed.ts`. Điều này khiến việc
chuyển sang dữ liệu thật là thay phần thân hàm chứ không phải viết lại UI.

**Kiến trúc hiện tại.** Next.js 15 App Router; page là Server Component ủy quyền toàn
bộ cho `*-view.tsx` phía client; dữ liệu lấy qua hook `useMockQuery`; invalidate bằng
version counter trong `MockDataProvider`. Không dùng Redux/Zustand.

**Dữ liệu mẫu.** Hai doanh nghiệp tách biệt hoàn toàn (Ngọc Phát 28 nhân viên, Bình
Minh 12 nhân viên) đã được dựng sẵn để kiểm thử multi-tenant — dùng làm bộ dữ liệu
đối chiếu khi kiểm tra RLS.

**Nợ kỹ thuật đã biết.** Chưa có test tự động nào. Chưa có `.env`, cấu hình chạy bằng
hằng số. `REFERENCE_DATE` cố định 2026-07-27 xuyên suốt để tránh lỗi hydration — khi
sang dữ liệu thật phải gỡ bỏ giả định này. Chi tiết ở `.planning/codebase/CONCERNS.md`.

**Rủi ro bảo mật đang mở.** `docs/env` chứa khóa Supabase plaintext, trong đó có
`SUPABASE_SERVICE_ROLE_KEY` — khóa này bỏ qua toàn bộ RLS. File đã nằm trong
`.gitignore`. Chủ dự án đã cân nhắc và chấp nhận rủi ro này ở giai đoạn hiện tại vì
chỉ mình họ nắm file; AUTH-06 vẫn giữ trong phạm vi V2 để xử lý trước khi có dữ liệu
thật của khách hàng.

**Trạng thái project Supabase — đo trực tiếp ngày 2026-07-31** (ref `ujvgagujfsdrlmjdhooi`):

- Schema `public`: **0 bảng/view**. `auth.users`: **0 tài khoản**. Storage: **0 bucket**.
  Project hoàn toàn rỗng — Phase 1 viết migration từ đầu, không cần `supabase db pull`
  để dựng baseline.
- **Ký JWT bất đối xứng đã bật**: endpoint JWKS trả về một khóa `EC/ES256`. Do đó
  `getClaims()` dùng được ngay, không phải làm bước chuyển khóa ký trước.
- Project đang ở trạng thái song song hai mô hình khóa: cặp mới
  `sb_publishable_` / `sb_secret_` đã có, đồng thời cặp legacy HS256
  (`anon` / `service_role`) vẫn còn hiệu lực (gọi API trả 200).

## Constraints

- **Tech stack**: Next.js 15 App Router + React 19 + TypeScript strict (không dùng
  `any`) + Tailwind v4 + shadcn/ui — giữ nguyên từ V1, không đổi nền tảng
- **Backend**: Supabase (Postgres + Auth + Storage) — khóa đã có sẵn, không đưa thêm
  nhà cung cấp mới vào hệ thống
- **Bảo mật**: mọi truy cập dữ liệu đi qua tầng server của Next.js; anon key không
  đủ quyền làm gì đáng kể ở client; RLS bật trên mọi bảng làm lớp phòng thủ thứ hai
- **Design system**: tuân thủ tokens trong `src/app/globals.css` — mỗi khu vực chỉ
  một nút filled indigo, gradient mesh chỉ ở login và onboarding
- **Ngôn ngữ**: giao diện tiếng Việt; nhãn nằm ở `constants.ts`, enum nghiệp vụ tiếng Anh
- **Quy mô mục tiêu**: đủ tin cậy cho 1-2 doanh nghiệp thật, chưa cần tối ưu cho
  hàng nghìn tenant

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Truy cập dữ liệu qua Server Actions / Route Handlers, không gọi Supabase thẳng từ client | Giữ khóa ở server; `company_id` lấy từ session server chứ không tin client khai; có chỗ đặt validate, rate-limit, audit log. Gọi thẳng từ client biến RLS thành bức tường duy nhất — một policy sót điều kiện là rò dữ liệu xuyên doanh nghiệp | — Pending |
| Vẫn bật RLS đầy đủ dù đã có tầng server | Phòng thủ hai lớp độc lập: handler quên filter thì DB vẫn từ chối | — Pending |
| Không tách backend riêng (NestJS/Fastify) | Không tăng bảo mật ở quy mô này, chỉ thêm hạ tầng phải vá và giám sát; V1 vốn đã cấu trúc quanh một service layer | — Pending |
| Chấm công = ảnh chụp trực tiếp + GPS trong bán kính | Hai tín hiệu độc lập; QR bị loại vì chụp sẵn quét ở nhà được, ảnh đơn thuần bị lách bằng cách chụp lại màn hình | — Pending |
| Ảnh chấm công là ảnh hiện trường nơi làm việc, không phải selfie | Không thu thập dữ liệu sinh trắc, không cần liveness detection. Hệ quả phải hiểu đúng: ảnh + GPS chứng minh "một thiết bị đã ở đúng nơi", không chứng minh "đúng người" | — Pending |
| Ngày lễ và hệ số tăng ca do chủ doanh nghiệp tự khai, không nhúng sẵn con số nào | Mỗi doanh nghiệp có chính sách riêng; nhúng cứng theo luật khiến hệ thống sai với nơi áp dụng khác đi và phải sửa code mỗi lần luật đổi | — Pending |
| Quản trị tạo tài khoản trực tiếp thay vì mời qua email/SMS | Nhân viên SMB Việt nhiều người không dùng email; SMS phát sinh chi phí và phụ thuộc nhà cung cấp | — Pending |
| Chốt kỳ công có trong V2 dù tính lương hoãn sang V3 | Không có chốt kỳ thì số liệu kỳ cũ đổi sau lưng, báo cáo đã xuất lệch với dữ liệu hiện tại | — Pending |
| Hoãn tính lương sang V3 | Rủi ro nghiệp vụ và pháp lý cao; giá trị pilot nằm ở số liệu chấm công đúng | — Pending |
| Giữ nguyên chữ ký hàm trong `service.ts` khi nối Supabase | V1 đã thiết kế cho đúng việc này; đổi thân hàm thì UI không phải sửa | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-31 after initialization*
