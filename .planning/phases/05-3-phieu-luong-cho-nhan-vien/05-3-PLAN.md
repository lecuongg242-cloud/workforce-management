# Phase 5.3 — Phiếu lương cho nhân viên (PAY-05)

> **Trạng thái:** dự thảo, chưa thực thi. Viết ngày 2026-08-07.
> **Requirement:** PAY-05 (`.planning/REQUIREMENTS.md:148`) — hiện đang nằm ở nhóm V3.
> Kéo về v1 thì phải sửa REQUIREMENTS.md và ROADMAP.md như Phase 5.1/5.2 đã làm.

## Mục tiêu

Nhân viên đăng nhập vào app mobile xem được phiếu lương của **chính mình** cho những
kỳ doanh nghiệp **đã chốt lương** — số tiền, các khoản cộng/trừ, và số liệu công đã
dùng để ra con số đó.

## Điểm bắt đầu đã đo được (2026-08-07)

| Thứ | Trạng thái | Nguồn |
|---|---|---|
| Dữ liệu lương đã chốt | **Đã có đủ**, 3 bảng tự chứa | `supabase/migrations/0024_payroll_runs.sql` |
| Phép tính tiền | **Đã có**, dùng chung một hàm | `src/lib/payroll/payroll-rows.ts` |
| `formatVnd()` | Đã có và đã được dùng từ 5.2 | `src/lib/format.ts:180` |
| `employees.can_view_payslip` | Cờ **chết** — ghi/đọc được nhưng **không nơi nào gác** | grep toàn `src/`: 0 chỗ đọc để phân quyền |
| Màn hình nhân viên | 4 mục nav, **không có** mục lương | `src/lib/nav.ts:48-53` |
| RLS trên `payroll_lines` | `tf_is_member(company_id)` — **mọi thành viên đọc được mọi dòng** | `0024_payroll_runs.sql:269-277` |

Nói cách khác: **toàn bộ dữ liệu đã sẵn sàng**, phase này không tính thêm một con số
nào. Việc cần làm là một đường đọc có phân quyền và một màn hình.

## Quyết định thiết kế

### D-46 — Nhân viên chỉ đọc từ BẢN CHỐT, không bao giờ tính lúc truy vấn

`GET /api/payroll/summary` có hai nhánh: kỳ đã chốt đọc bản chốt, kỳ chưa chốt tính
live (`route.ts:189-244`). Phiếu lương **chỉ lấy nhánh một**.

Lý do: con số của kỳ chưa chốt còn đổi mỗi khi admin sửa cấu hình hoặc duyệt một yêu
cầu. Cho nhân viên nhìn thấy nó là phát ra một con số **chưa ai duyệt**, rồi tháng sau
con số ấy khác đi mà không ai giải thích được. Kỳ chưa chốt → màn hình nói "chưa có
phiếu lương", không hiển thị số tạm.

Hệ quả cố ý: nhân viên **không** xem được lương tháng đang chạy.

### D-47 — Route riêng, không mở rộng `/api/payroll/summary`

`/api/payroll/summary` gộp lương **toàn bộ nhân viên** vào một phản hồi và gác bằng
`requireRole(role, ["owner", "admin"])` (`route.ts:153`). Thêm một nhánh `employee`
vào đó là đặt một cái rẽ quyền vào giữa một hàm đang **giả định người gọi là admin** —
hỏng một lần là lộ bảng lương cả công ty.

Hai route mới, tách bạch:

- `GET /api/payslips` → danh sách kỳ **của chính mình** có phiếu (tháng, ngày chốt, thực nhận)
- `GET /api/payslips/[month]` → chi tiết một phiếu

Hai route thay vì một route hai hình dạng — theo đúng ghi chú "hai nhánh trả cùng một
hình dạng" ở `0024`/`summary/route.ts`: một route trả hai hình dạng khác nhau thì màn
hình sẽ mọc hai đường render.

### D-48 — Phạm vi theo PHIÊN, không phải theo tham số (bắt buộc)

Route phiếu lương **không nhận tham số `employeeId`**. `employee_id` luôn lấy từ
`getSessionContext().employeeId` và luôn được đưa vào `.eq()` — không có tham số nào
đổi được điều đó.

Đây là phản ứng trực tiếp với một lỗ hổng **đang tồn tại** trong repo:

```
// src/app/api/attendance/route.ts:43-59
if (!isAdminRole && queryParams.employeeId && queryParams.employeeId !== sessionEmployeeId) {
  throw new ForbiddenError();
}
...
if (queryParams.employeeId) {
  query = query.eq("employee_id", queryParams.employeeId);
}
```

Chốt chặn chỉ bật khi client **có gửi** `employeeId`. Một nhân viên gọi
`GET /api/attendance?month=2026-07` (bỏ trống `employeeId`) thì không nhánh nào lọc, và
RLS `tf_is_member` cho qua — **đọc được chấm công của cả công ty**. Đó là mô hình
opt-in scope, và nó sai theo mặc định.

→ Xem mục "Việc phát sinh cần xử lý riêng" bên dưới.

### D-49 — `can_view_payslip` trở thành cổng thật, gác ở SERVER

Cờ này đang bật/tắt được ở form sửa nhân viên (`employee-form.tsx:867`) nhưng không
thay đổi bất cứ điều gì. Phase này cho nó ý nghĩa:

- `false` → route trả **403**, mục nav bị ẩn
- Gác ở **route**, không chỉ ở UI. Ẩn nav chỉ là lịch sự; 403 mới là quyền.

Ngữ nghĩa cố ý: `false` nghĩa là nhân viên **không xem được phiếu của chính mình** qua
app (doanh nghiệp phát phiếu giấy, hoặc chưa muốn công khai). Không phải "không xem
được phiếu của người khác" — điều đó đã do D-48 lo.

### D-50 — RLS phải siết lại (migration 0029)

Hiện tại `payroll_lines` cho `select` với điều kiện duy nhất `tf_is_member(company_id)`.
Nghĩa là **lớp phòng thủ thứ hai đang không phòng thủ gì** cho dữ liệu nhạy cảm nhất
của sản phẩm — trái với ràng buộc ở `CLAUDE.md` ("RLS bật trên mọi bảng làm lớp phòng
thủ thứ hai").

Hôm nay chưa có đường khai thác vì mọi truy cập đi qua tầng server và không route nào
mở `payroll_lines` cho `employee`. Phase này **tạo ra** đường đó, nên phải siết trước:

```sql
-- 0029: select tách làm hai vế
--   owner/admin  -> mọi dòng của công ty
--   còn lại      -> chỉ dòng có employee_id trỏ về employees.user_id = auth.uid()
```

Helper `tf_is_company_admin(company_id)` **chưa tồn tại** (đã kiểm: `supabase/migrations/`
chỉ có `tf_is_member` ở `0002_tenancy.sql:60` và `tf_is_platform_admin` ở `0006`) — phải
tạo mới, kiểm `memberships.role in ('owner','admin')`, theo đúng khuôn security-definer
của hai hàm kia.

Ghi rõ giới hạn: khóa `service_role` legacy vẫn bỏ qua RLS (rủi ro đã được chấp nhận
có ý thức, `STATE.md:235`) — RLS ở đây là lớp thứ hai, không phải lớp duy nhất.

### D-51 — Không xuất PDF ở lần đầu

Xem trên màn hình. Xuất PDF/gửi email là việc riêng, có ràng buộc riêng (font tiếng
Việt, lưu trữ, ai được tải lại). Đưa vào đây sẽ làm phase phình ra mà không phục vụ
câu hỏi chính: "tháng rồi tôi được trả bao nhiêu và vì sao".

## Các bước thực hiện

### Task 1 — Migration 0029: siết RLS ba bảng lương

- Helper `tf_is_company_admin(text)` (security definer, khuôn 0002/0006)
- Thay `*_select_member` bằng `*_select_scoped` trên `payroll_runs`, `payroll_lines`,
  `payroll_line_items`
- `insert`/`update`/`delete` **giữ nguyên** — chỉ admin mới có đường ghi ở tầng ứng dụng,
  và `update` đã bị trigger chặn hoàn toàn
- File chạy lại được mà vô hại (khuôn 0018/0021/0022/0023/0024)
- pgTAP `16_payslip_rls.sql`: nhân viên A select không ra dòng của B; admin select ra cả hai

### Task 2 — Kiểu miền + schema

`src/lib/types/domain.ts`:

```ts
export interface PayslipSummary {
  month: string;            // "2026-07"
  closedAt: string;
  netPay: number;
}

export interface Payslip {
  month: string;
  closedAt: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  payUnit: "month" | "day" | "hour";
  payAmount: number;
  // Công đã dùng để ra con số — chép từ bản chốt, KHÔNG suy lại
  workedDays: number;
  totalMinutes: number;
  leaveDays: number;
  lateCount: number;
  overtimeMinutes: number;
  convertedOvertimeHours: number;
  // Tiền
  basePay: number;
  overtimePay: number;
  hourAdjustment: number;
  allowanceItems: PayslipItem[];
  deductionItems: PayslipItem[];
  allowanceTotal: number;
  deductionTotal: number;
  netPay: number;
}
```

Kiểu riêng chứ **không** tái dùng `PayrollPrepRow`: hình dạng đó mang theo
`missingMultiplierKeys`, `missingWorkModeInputs`, `missing` — ba trường chỉ có nghĩa ở
màn hình chuẩn bị của admin, và ở bản chốt chúng luôn rỗng theo bất biến. Đẩy chúng
xuống app nhân viên là đẩy một khái niệm không thuộc về đó.

`src/lib/validation/api/payslips.ts` — schema hai chiều theo khuôn D-12d.

### Task 3 — Hai Route Handler

`src/app/api/payslips/route.ts`:
1. `getSessionContext()` → `employeeId`; `null` → 400 "tài khoản chưa gắn hồ sơ nhân viên"
2. Đọc `employees.can_view_payslip`; `false` → 403 (D-49)
3. `payroll_lines` join `payroll_runs`, `.eq("employee_id", employeeId)` **luôn luôn** (D-48)
4. Sắp theo `period_start` giảm dần

`src/app/api/payslips/[month]/route.ts`: như trên + lấy `payroll_line_items` của **đúng
dòng đó** (`.eq("line_id", line.id)`), không quét cả công ty.

Cả hai: `export const dynamic = "force-dynamic"`, chỉ `GET`, khuôn bắt lỗi 4 lớp giống
`summary/route.ts:245-263`.

### Task 4 — Tầng data client

`src/lib/data/payslips.ts` — `listMyPayslips()`, `getMyPayslip(month)`, qua `fetchJson`
+ schema. Không tham số nào khai danh tính (D-12b).

### Task 5 — Màn hình

- `src/app/employee/payslips/page.tsx` + `payslips-view.tsx` — danh sách kỳ, mỗi dòng:
  tháng, thực nhận (`formatVnd`), ngày chốt
- `src/app/employee/payslips/[month]/page.tsx` + `payslip-detail-view.tsx` — chi tiết:
  khối "Thực nhận" nổi bật, rồi Lương cơ bản → Tăng ca → Điều chỉnh giờ → từng khoản
  cộng → từng khoản trừ
- Empty state khi chưa có kỳ nào chốt: *"Chưa có phiếu lương. Phiếu sẽ xuất hiện sau khi
  doanh nghiệp chốt lương của kỳ."*
- Mobile-first, tuân design tokens, **không** nút filled indigo thứ hai trong khu vực

### Task 6 — Điều hướng

`src/lib/nav.ts:48` thêm mục thứ 5. **Đây là điểm cần bạn quyết** — xem mục dưới.

### Task 7 — Test

- Tích hợp: nhân viên A không đọc được phiếu của B (không có tham số nào để thử → test
  ở tầng RLS + tầng route)
- `can_view_payslip = false` → 403
- Kỳ chưa chốt → danh sách rỗng, không rò số tạm
- `employeeId = null` → 400, không chạm database
- pgTAP `16_payslip_rls.sql` (Task 1)

## Điểm cần bạn quyết trước khi làm

**Bottom nav đang có 4 mục** (Trang chủ / Lịch sử / Yêu cầu / Cá nhân). Hai hướng:

1. **Thêm tab thứ 5 "Phiếu lương"** — phiếu lương là đích đến chính, xứng đáng một tab.
   Đổi lại 5 tab trên màn hình hẹp là chật, nhãn dễ bị cắt.
2. **Đặt trong trang Cá nhân** — menu ở đó đang có 4 mục toàn placeholder
   (`profile-view.tsx:57-79`); thêm "Phiếu lương" thành mục **thật đầu tiên**. Nav giữ 4
   tab, nhưng nhân viên phải bấm hai lần.

Khuyến nghị: **hướng 1**. Đây là câu hỏi nhân viên hỏi hằng tháng, chôn nó sau một menu
placeholder là hạ nó xuống ngang "Cài đặt thông báo".

## Việc phát sinh cần xử lý riêng (KHÔNG thuộc phase này)

1. **`/api/attendance` opt-in scope** (D-48 ở trên) — nhân viên bỏ trống `employeeId` thì
   đọc được chấm công cả công ty. Là lỗ hổng **đang có**, độc lập với phiếu lương. Nên
   sửa thành mặc-định-scope và rà cùng khuôn ở các route khác (`/api/requests`,
   `/api/attendance/summary`, `/api/notifications`).
2. **`summary/route.ts:201-203`** đọc `payroll_line_items` lọc theo `company_id` mà không
   lọc theo `run_id` — kéo về **mọi khoản của mọi kỳ** rồi mới lọc trong JS
   (`rowFromSnapshot:110`). Đúng kết quả, nhưng lớn dần theo số kỳ đã chốt.

## Phạm vi KHÔNG làm

- Thuế TNCN (PAY-02), BHXH/BHYT/BHTN (PAY-03) — vẫn ở V3
- Xuất PDF, gửi email phiếu lương (D-51)
- Nhân viên xem lương kỳ **chưa chốt** (D-46)
- `manager` xem phiếu của cấp dưới — một cấp duyệt, chỉ `owner`/`admin` (D-30)
- Nhân viên tự sửa hồ sơ cá nhân — việc riêng, backend đã sẵn (`employees.test.ts:371-399`)
  nhưng UI chưa có (`profile-view.tsx:62`)
