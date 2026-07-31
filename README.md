# TimeFlow

Nền tảng SaaS multi-tenant quản lý chấm công và chuẩn bị dữ liệu tính lương cho
doanh nghiệp Việt Nam.

Đây là **frontend giai đoạn đầu**: toàn bộ dữ liệu chạy trên lớp mock service,
chưa kết nối backend hay Supabase Auth thật.

## Chạy dự án

```bash
npm install
npm run dev
```

Mở http://localhost:3000 — trang chủ tự chuyển tới `/login`.

Tài khoản demo đã được điền sẵn trong biểu mẫu đăng nhập; nhấn **Đăng nhập** là
vào được hệ thống.

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy máy chủ phát triển |
| `npm run build` | Build bản production |
| `npm run start` | Chạy bản production đã build |
| `npm run lint` | Kiểm tra ESLint |
| `npm run typecheck` | Kiểm tra TypeScript (`tsc --noEmit`) |

## Công nghệ

Next.js 15 (App Router) · React 19 · TypeScript (strict, không dùng `any`) ·
Tailwind CSS v4 · shadcn/ui · Lucide Icons · Recharts · React Hook Form + Zod.

Font **Inter** nạp qua `next/font/google` (weight 300–600).

## Các route

**Xác thực & khởi tạo**

- `/login` — đăng nhập, split-screen với gradient mesh
- `/onboarding` — wizard ba bước tạo doanh nghiệp
- `/select-company` — chọn doanh nghiệp khi tài khoản thuộc nhiều nơi

**Quản trị (desktop-first)**

- `/admin/dashboard` — KPI, biểu đồ 7 ngày, hoạt động hôm nay, yêu cầu chờ duyệt
- `/admin/employees` — danh sách, tìm kiếm, lọc, phân trang, thao tác hàng loạt
- `/admin/employees/new` — biểu mẫu thêm nhân viên
- `/admin/employees/[id]` — hồ sơ nhân viên với 5 tab
- `/admin/departments` — quản lý phòng ban
- `/admin/shifts` — quản lý ca làm việc, hỗ trợ ca qua đêm

**Nhân viên (mobile-first)**

- `/employee` — chấm công vào/ra, tổng hợp tháng, thao tác nhanh
- `/employee/history` — lịch sử chấm công theo tháng
- `/employee/requests` — yêu cầu nghỉ phép, bổ sung công, tăng ca
- `/employee/profile` — hồ sơ cá nhân

Mục **Chấm công**, **Bảng lương** và **Cài đặt** trên sidebar hiển thị nhãn
“Sắp ra mắt” và chưa điều hướng.

## Cấu trúc mã nguồn

```
src/
├── app/                    Route theo App Router
│   ├── (auth)/             login, onboarding, select-company
│   ├── admin/              layout + các trang quản trị
│   └── employee/           layout + các trang nhân viên
├── components/
│   ├── ui/                 shadcn/ui đã chỉnh theo design tokens
│   ├── brand/              AppLogo, GradientMesh, DashboardMockup
│   ├── layout/             AdminSidebar, AdminTopbar, MobileBottomNav…
│   ├── common/             StatCard, StatusBadge, EmptyState, ConfirmDialog…
│   ├── forms/              FormSection, StickyFormActions, Field
│   └── dashboard|employees|departments|shifts|employee-app/
├── hooks/                  use-mock-query, use-debounce, use-media-query
└── lib/
    ├── types/domain.ts     Toàn bộ kiểu nghiệp vụ
    ├── constants.ts        Nhãn tiếng Việt cho mọi enum
    ├── format.ts           Định dạng ngày, giờ, tiền VND, bỏ dấu tiếng Việt
    ├── mock/               seed.ts · db.ts · service.ts · store.tsx
    ├── auth/               Phiên đăng nhập giả (localStorage)
    └── validation/         Schema Zod
```

## Hệ thống thiết kế

Design tokens khai báo một lần trong `src/app/globals.css` (khối `@theme`), đồng
thời ánh xạ sang biến của shadcn/ui để mọi primitive tự kế thừa thương hiệu.

- Indigo `#533afd` là màu CTA — mỗi khu vực chỉ có **một** nút filled indigo.
- Navy `#1c1e54` cho sidebar quản trị.
- Nút chính dạng pill; card bo 12px; modal bo 16px; input bo 6px.
- Heading dùng weight 300 kèm letter-spacing âm.
- Mọi ô giờ / tiền / số liệu dùng class `.num` (`tabular-nums` + `tnum`).
- Gradient mesh **chỉ** xuất hiện ở trang đăng nhập và phần chào mừng onboarding.
- Màu semantic (xanh lá / cam / đỏ / xanh dương) chỉ dùng cho badge, alert, icon.

Đổi tên và logo sản phẩm: sửa `APP_NAME` trong `src/lib/constants.ts` và
component `src/components/brand/app-logo.tsx`.

## Dữ liệu mẫu

Hai doanh nghiệp có dữ liệu tách biệt hoàn toàn, dùng để kiểm thử multi-tenant:

| | Ngọc Phát | Bình Minh |
|---|---|---|
| Nhân viên | 28 | 12 |
| Phòng ban | 5 | 4 |
| Ca làm việc | 4 (có 1 ca đêm) | 3 (có 1 ca đêm) |
| Yêu cầu chờ duyệt | 6 | 2 |
| KPI dashboard | 28 / 22 / 3 / 2 | 12 / 6 / 2 / 1 |

Kèm 43 bản ghi chấm công gần đây và lịch sử cả tháng 07/2026 cho nhân viên demo
(Nguyễn Minh Anh — NV001), phủ đủ 7 trạng thái chấm công.

Hướng dẫn kiểm thử chi tiết: [docs/HUONG-DAN-TEST.md](docs/HUONG-DAN-TEST.md).

Dữ liệu được viết **tĩnh, không dùng `Math.random` hay `Date.now`** khi khởi tạo
để máy chủ và trình duyệt render giống nhau (tránh lỗi hydration) và số liệu demo
không đổi giữa các lần tải trang. Ngày tham chiếu cố định là **27/07/2026**
(hằng số `REFERENCE_DATE`).

Không có giới hạn cứng về số nhân viên — mọi hàm đều làm việc trên mảng động.

## Kết nối backend ở giai đoạn sau

Mọi truy cập dữ liệu đều đi qua `src/lib/mock/service.ts`. Các hàm ở đây đã được
đặt tên và ký hiệu theo hướng ánh xạ 1-1 sang Supabase:

```ts
// Hiện tại
listEmployees(query) → Promise<Paginated<Employee>>

// Giai đoạn sau
supabase.from("employees").select("*", { count: "exact" })…
```

Cần làm khi kết nối thật:

1. Thay phần thân các hàm trong `service.ts`, xóa `mock/db.ts` và `mock/seed.ts`.
   Không component nào import trực tiếp từ hai file đó.
2. Thay `src/lib/auth/session-provider.tsx` bằng Supabase Auth và chuyển phần
   chặn route sang `middleware.ts` (đọc cookie thay vì localStorage).
3. Union type trong `src/lib/types/domain.ts` ánh xạ thẳng sang cột enum của
   Postgres; nhãn tiếng Việt nằm riêng ở `constants.ts` nên không phải sửa.

## Bảo mật

`docs/env` chứa khóa Supabase dạng plaintext và đã được đưa vào `.gitignore`.
Nên **thu hồi và cấp lại** các khóa đó trước khi triển khai, đặc biệt là
`SUPABASE_SERVICE_ROLE_KEY`.

## Phạm vi chưa triển khai

Tính lương đầy đủ, phiếu lương, thuế và bảo hiểm, máy chấm công, nhận diện khuôn
mặt, QR chấm công, trang super admin, thanh toán gói SaaS, backend thật.
