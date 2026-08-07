# Lương theo ngày

**Ngày:** 2026-08-07
**Trạng thái:** Đã duyệt thiết kế, chờ viết plan

## Mục tiêu

Nhân viên xem được **tiền của từng ngày đã làm**, không phải đợi tới cuối kỳ.
Cơ chế chốt kỳ lương giữ nguyên: phiếu lương đã chốt vẫn là con số chính thức và
vẫn bất biến.

Quản trị cũng xem được cùng chi tiết đó trong bảng lương, để trả lời được câu
"vì sao ra con số này" ở mức từng ngày.

## Bối cảnh

Nền tảng theo ngày **đã có sẵn**. `resolveDayCredit()` (`src/lib/attendance/work-mode.ts`)
và `classifyDay()` (`src/lib/attendance/classification-context.ts`) đều chạy trên
từng ngày một; `summarizeMonth()` gọi chúng theo ngày rồi mới cộng lại thành tổng
tháng. Số liệu ngày không thiếu — nó bị cộng mất ở bước cuối.

Chỗ duy nhất chỉ biết mức kỳ là `computePayrollLine()` (`src/lib/payroll/compute.ts`),
hàm quy công ra tiền.

## Quyết định đã chốt

| # | Câu hỏi | Quyết định |
|---|---------|-----------|
| Q1 | Con số mỗi ngày gồm gì | Chỉ tiền phát sinh trong ngày: lương ngày + tăng ca + lệch giờ. Phụ cấp/khấu trừ theo kỳ **không** chia ra ngày |
| Q2 | Sau khi chốt kỳ | Lưu chi tiết từng ngày vào bản chốt — tổng luôn khớp phiếu |
| Q3 | Quyền xem | Dùng chung cờ `can_view_payslip` đã có, không thêm cờ mới |
| Q4 | Chỗ đặt (nhân viên) | Mở rộng màn hình Phiếu lương đang có |
| Q5 | Ngày đang làm dở | Không có số, hiện nhãn "Đang diễn ra" |
| Q6 | Màn hình quản trị | Có — thêm bảng ngày vào hàng mở rộng đã có |

## Đánh đổi đã chấp nhận

**Số lương sẽ lệch vài chục đồng so với công thức hiện tại.** Hiện `basePay`
được làm tròn **một lần** ở mức kỳ. Sau thay đổi, mỗi ngày làm tròn một lần rồi
cộng lại — lệch tối đa khoảng vài chục đồng một tháng.

Không tránh được: hoặc tổng bằng đúng tổng các dòng, hoặc tổng là số chính xác
nhất — không thể cả hai. Dự án **đã chọn sẵn phía này**: `allowanceTotal` hiện là
tổng của các dòng khoản đã làm tròn, không phải làm tròn của tổng chính xác
(`compute.ts`, quy tắc (3)). Thay đổi này chỉ áp cùng nguyên tắc đó xuống một tầng.

Các kỳ **đã chốt không bị ảnh hưởng** — bản chốt bất biến, migration 0024 chặn
`UPDATE`. Chỉ các kỳ chốt từ nay về sau dùng công thức mới.

## Kiến trúc

### Module mới: `src/lib/payroll/compute-daily.ts`

Hàm **thuần** — không dùng client cơ sở dữ liệu, không đọc biến môi trường,
không đọc đồng hồ hệ thống. Cùng khuôn `compute.ts` / `work-mode.ts`.

```
computeDailyPay({ date, credit, classification, isOpen,
                  dailyRate, hourlyRate, overtimeRate, workMode, paysByActualHours })
  → DailyPayLine
```

`DailyPayLine`:

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| `date` | `string` | "YYYY-MM-DD" |
| `dayType` | `"weekday" \| "weekend" \| "holiday"` | Từ `classification`, không tính lại |
| `state` | `"counted" \| "in_progress" \| "leave_paid" \| "leave_unpaid"` | |
| `creditedDays` | `number \| null` | Chép từ `credit` |
| `regularMinutes` | `number \| null` | |
| `overtimeMinutes` | `number` | |
| `convertedOvertimeHours` | `number \| null` | |
| `hourDeltaMinutes` | `number` | |
| `basePay` | `number \| null` | Đã làm tròn |
| `overtimePay` | `number \| null` | Đã làm tròn |
| `hourAdjustment` | `number \| null` | Đã làm tròn |
| `dayTotal` | `number \| null` | Tổng ba số **đã làm tròn** ở trên |
| `missing` | `PayrollMissingInput[]` | |

**Ràng buộc bắt buộc:** `credit` và `classification` được truyền vào nguyên vẹn,
**không tính lại** bên trong. Đây là quy tắc (1) của `compute.ts` — không mở nguồn
thứ hai cho cùng một con số.

`state = "in_progress"` khi ngày có lượt chấm vào mà chưa chấm ra. Ngày đó
**không đóng góp gì vào tổng kỳ** — nó vốn đã có `worked_minutes = 0`. Thay đổi
duy nhất là nhãn hiển thị thay cho số "0 đ".

### Sửa `computePayrollLine()`

`basePay` / `overtimePay` / `hourAdjustment` **không còn nhân từ số tổng** mà cộng
các `DailyPayLine` đã làm tròn.

Giữ nguyên ở mức kỳ:

- phụ cấp / khấu trừ (`per_period` và `per_late`) — không thuộc ngày nào
- `dailyRate` dùng cho khoản dạng `%` lương ngày
- `lateCount` làm hệ số cho `per_late`

Hành vi thiếu dữ kiện **không đổi**: một ngày thiếu mẫu số thì `dayTotal` của ngày
đó là `null`, kéo theo cả kỳ `null`. Giống hệt `sumCreditedDays()` hôm nay.

Chữ ký nhận thêm `dailyLines: DailyPayLine[]`. Nơi dựng `dailyLines` là
`payroll-rows.ts` — chỗ đã có sẵn `credit` và `classification` theo ngày.

### `payroll-rows.ts`

`buildPayrollRows()` nhận thêm tham số **tuỳ chọn** `employeeId`. Có nó thì chỉ
dựng một dòng.

Đây là cách giữ đúng lý do file đó tồn tại: **một hàm, một nguồn** cho màn hình
quản trị, `closePayroll()`, và phiếu tạm tính của nhân viên. Không thêm đường
tính thứ hai.

`summarizeMonth()` hiện chỉ trả tổng tháng. Cần trả thêm mảng theo ngày
(`credit` + `classification` + `date` + `isOpen` của từng ngày) để `payroll-rows.ts`
dựng được `dailyLines`.

Đây là **mở rộng giá trị trả về, không đổi phép tính** — mọi trường hiện có giữ
nguyên tên và ý nghĩa. `summarizeMonth()` còn được `GET /api/attendance/summary`
dùng; nơi đó không đọc trường mới nên không bị ảnh hưởng. Plan phải kiểm điều này
bằng cách chạy test hiện có của attendance, không chỉ bằng typecheck.

## Dữ liệu — `supabase/migrations/0030_payroll_line_days.sql`

```
payroll_line_days
  id                        uuid pk
  company_id                text not null → companies
  line_id                   uuid not null → payroll_lines (on delete cascade)
  work_date                 date not null
  day_type                  text not null check in ('weekday','weekend','holiday')
  credited_days             numeric(8,4) not null
  regular_minutes           int not null
  overtime_minutes          int not null
  converted_overtime_hours  numeric(8,2) not null
  hour_delta_minutes        int not null
  base_pay                  numeric(14,2) not null
  overtime_pay              numeric(14,2) not null
  hour_adjustment           numeric(14,2) not null
  day_total                 numeric(14,2) not null
  unique (line_id, work_date)
```

Theo đúng ba khuôn migration 0024 đã đặt:

- Dùng lại trigger `tf_payroll_immutable()` để chặn `UPDATE`
- `on delete cascade` để huỷ chốt lương xoá sạch theo
- RLS chép khuôn 0029: owner/admin thấy cả công ty, còn lại chỉ thấy dòng thuộc
  `payroll_lines` của chính mình

`not null` trên các cột tiền là **bất biến, không phải tiện nghi** — cùng lý do
với `payroll_lines`: một kỳ chỉ chốt được khi không dòng nào thiếu dữ kiện.

**Ngày nào được ghi.** Chỉ ngày mà `groupAttendanceByDay()` dựng ra một ngày —
tức là ngày **có ít nhất một bản ghi chấm công**, kể cả ngày nghỉ có phép / không
phép (chúng là bản ghi trạng thái, không phải khoảng trống). Ngày không có bản ghi
nào thì không sinh dòng — bảng này không phải một cuốn lịch.

Hệ quả cố ý: ngày nghỉ không phép **có** dòng với mọi cột bằng 0. Đó là một sự
thật ("hôm đó nghỉ và không được trả gì"), khác hẳn với không có dòng ("hôm đó
không phải ngày làm việc").

**Ngày đang dở khi chốt.** Kỳ lương chỉ chốt được sau khi kỳ công đã chốt
(`closePayroll()` điều kiện (1)), nên về nguyên tắc không còn ngày dở. Nếu vẫn
còn thì ngày đó được ghi như mọi ngày khác với tiền bằng 0 — `worked_minutes` của
nó vốn là 0, và bản chốt phải ghi lại **đúng những gì đã được dùng** để ra con số.
Không có nhánh đặc biệt nào cho nó.

File chạy lại được mà vô hại (khuôn 0018/0021/0024).

## Đường đọc — nhân viên

### `GET /api/payslips`

Trả thêm kỳ **đang mở**. Mỗi mục có `status: "closed" | "provisional"` và
`closedAt: string | null`.

### `GET /api/payslips/[month]`

Hai nhánh:

- **Đã chốt** — đọc snapshot `payroll_lines` + `payroll_line_days`. Không tính lại.
- **Chưa chốt** — gọi `buildPayrollRows({ companyId, month, employeeId })`, gắn
  `status: "provisional"`.

`assertCanViewOwnPayslip()` đứng trước **cả hai nhánh**. Không đổi.

### Hợp đồng dữ liệu

`payslipSchema` hiện có mọi trường tiền là `z.number()` **không nullable**, và
khối comment ở `src/lib/validation/api/payslips.ts` giải thích rõ vì sao: phiếu
chỉ tồn tại khi kỳ đã chốt, mà kỳ chỉ chốt được khi không dòng nào thiếu dữ kiện.

Bất biến đó **vẫn đúng cho kỳ đã chốt** và không được nới lỏng. Kỳ tạm tính thì
tiền **có thể** `null` (chưa khai mức lương). Vì vậy tách thành union phân biệt
theo `status`:

- `closedPayslipSchema` — giữ nguyên `payslipSchema` hiện tại, tiền không nullable
- `provisionalPayslipSchema` — tiền nullable, thêm `missing: string[]`
- Cả hai có thêm `days: DailyPayLine[]`

Nới `payslipSchema` hiện tại thành nullable là **sai** — nó sẽ xoá mất một bất
biến thật của bản chốt để phục vụ một trường hợp khác.

### Comment phải viết lại

Khối comment mục (2) ở `src/app/api/payslips/route.ts` (dòng 27-37) hiện lập luận
**ngược lại** thiết kế này: *"Kỳ chưa chốt không có phiếu — và màn hình nói đúng
như vậy."*

Phải viết lại thành lý do vì sao quyết định được đảo, kèm điều kiện đi kèm: nhãn
"tạm tính" là **bắt buộc**, không phải trang trí. Để nguyên là để lại một comment
nói dối về code bên dưới.

## Giao diện — nhân viên

**`/employee/payslips`** — mục đầu danh sách là **"Tháng này · Tạm tính"**, dưới
là các kỳ đã chốt như hiện tại.

**`/employee/payslips/[month]`** — thêm mục **"Chi tiết theo ngày"**. Mỗi dòng:
ngày · loại ngày · giờ làm · giờ tăng ca · tiền của ngày. Ngày đang dở hiện chữ
*"Đang diễn ra"* ở chỗ số tiền.

Kỳ chưa chốt có dải cảnh báo ở đầu trang:

> Số tạm tính. Con số có thể thay đổi cho tới khi doanh nghiệp chốt lương.

Đây là thứ trả lời trực tiếp rủi ro mà comment cũ nêu — nhân viên không bao giờ
nhầm số tạm tính với số đã duyệt.

Thiếu mức lương thì **không hiện số nào**, hiện đúng lý do qua `describeMissingReason()`
đã có. Không thay một giá trị thiếu bằng 0 (quy tắc (2) của `compute.ts`).

## Giao diện — quản trị

**`/admin/payroll`** đã có hàng mở rộng `PayrollRowDetail` — lưới 3 cột
*"Cách ra con số" / "Phụ cấp" / "Khấu trừ"*. Thêm bảng **"Chi tiết theo ngày"**
trải hết chiều ngang, nằm dưới ba cột đó.

Cột: ngày · loại ngày · giờ làm · giờ tăng ca · lương ngày · tăng ca · **tổng ngày**.
Dòng cuối là tổng, và tổng đó **phải khớp đúng** ô "Lương gốc + Tăng ca" ở cột bên trên.

`GET /api/payroll/summary` **không cần route mới** — nó đã có sẵn hai nhánh đúng
như thiết kế (kỳ đã chốt đọc `payroll_lines`, kỳ chưa chốt gọi `buildPayrollRows()`).
Chỉ cần mỗi nhánh mang theo mảng ngày.

### Việc dọn có phạm vi hẹp

`src/app/admin/payroll/payroll-view.tsx` đang ~1.200 dòng. Nhồi thêm bảng ngày sẽ
tệ hơn. Tách `PayrollRowDetail` + bảng ngày mới ra `payroll-row-detail.tsx`.

**Chỉ tách đúng phần đang phải sửa.** Không đụng phần còn lại của file.

## Giới hạn ghi rõ

**Kích thước phản hồi.** `/api/payroll/summary` ở kỳ chưa chốt sẽ kèm ngày của
*mọi* nhân viên trong một phản hồi — 50 người × 26 ngày là ~1.300 dòng. Với quy
mô mục tiêu trong `.claude/CLAUDE.md` (1-2 doanh nghiệp thật) thì chấp nhận được,
và gộp một route giữ được nguyên tắc một nguồn.

Nếu sau này chậm, đường sửa là **tải ngày theo yêu cầu khi mở dòng**, không phải
đập lại kiến trúc.

## Ngoài phạm vi

- **CSV xuất bảng lương** — không thêm cột ngày
- **Không thêm cờ quyền mới** — dùng `can_view_payslip` đã có
- **Không đụng cơ chế chốt/huỷ chốt kỳ công** (D-32b) hay chốt lương (D-42/D-45)
- **Không tính lại các kỳ đã chốt** — bản chốt bất biến

## Kiểm thử

**`compute-daily.test.ts`** (module thuần, không cần giả lập database):

- ngày thường / cuối tuần / lễ
- nghỉ có phép (1 ngày công, 0 giờ) / nghỉ không phép (0 tất cả)
- ngày đang dở → `state: "in_progress"`, không có số
- thiếu mức lương → `dayTotal: null` kèm `missing`
- người có mức tăng ca riêng (migration 0026)
- chế độ `daily_hours` chưa khai `standard_hours_per_day` → `null`, không phải 0

**`compute.test.ts`** — bổ sung:

- **Bài đối chiếu:** `netPay === Σ dayTotal + allowanceTotal − deductionTotal`,
  bằng **đúng**, không xấp xỉ. Đây là bài giữ cho lời hứa "tổng luôn khớp" không
  âm thầm hỏng.
- Ngày đang dở **không** làm đổi tổng kỳ.

**Route test:**

- `can_view_payslip = false` → 403 ở **cả** nhánh tạm tính
- Kỳ chưa chốt → `status: "provisional"`
- Kỳ đã chốt → đọc từ snapshot, **không** gọi `buildPayrollRows()`
- Phạm vi `employee_id` cố định theo phiên ở cả hai nhánh

**Chốt / huỷ chốt:**

- `payroll_line_days` được ghi đủ số ngày có phát sinh
- Huỷ chốt xoá sạch theo cascade
- Lỗi giữa chừng → dọn `payroll_runs`, không để lại bản chốt rỗng

## Thứ tự thực hiện

1. `compute-daily.ts` + test (thuần, không phụ thuộc gì)
2. `summarizeMonth()` trả thêm mảng ngày
3. `computePayrollLine()` cộng từ ngày + bài đối chiếu
4. Migration 0030
5. `closePayroll()` ghi `payroll_line_days`
6. `buildPayrollRows()` nhận `employeeId`
7. API nhân viên + hợp đồng dữ liệu + viết lại comment
8. Màn hình nhân viên
9. `/api/payroll/summary` mang mảng ngày
10. Tách `payroll-row-detail.tsx` + bảng ngày quản trị

Bước 1-3 là phần chạm tới tiền. Bước 4-5 là phần chạm tới bản chốt. Hai nhóm đó
nên được kiểm kỹ trước khi làm tiếp phần giao diện.
