# Áp ca linh hoạt cho kỳ chưa chốt + gắn ca theo từng ngày

**Ngày:** 2026-08-08
**Trạng thái:** Đã duyệt thiết kế

## Vấn đề

Chuyển một nhân viên sang **ca linh hoạt** (`kind: 'hours'`, không có giờ bắt đầu/kết thúc)
không đụng tới các bản ghi chấm công đã có. Những ngày trước đó vẫn gắn ca cũ và
vẫn mang trạng thái "đi muộn" — trong khi ca mới không hề có giờ mốc nào để muộn
so với.

Ca linh hoạt không tính đi muộn là **định nghĩa của loại ca đó**
(`isHoursShift` trong `src/lib/data/mutations/attendance.ts`), không phải một ngoại
lệ bỏ qua cho tiện. Nên một người đang ở ca linh hoạt mà bảng công vẫn đếm "1 lần
đi muộn" là số liệu tự mâu thuẫn — và số đó chảy thẳng vào bảng lương.

Trường hợp thật: `cuonglm@pamoteam.com` (NV023). Tạo lúc 08:53 với Ca sáng, chấm
công 08:57 (muộn 597 phút), đổi sang "Ca linh hoạt 2 giờ" lúc 09:02 — 5 phút sau.

## Quyết định đã chốt

| # | Câu hỏi | Quyết định |
|---|---------|-----------|
| Q1 | Những ngày nào được cập nhật | Mọi ngày thuộc kỳ **chưa chốt** (có thể nhiều tháng) |
| Q2 | Chiều ngược lại (sang ca có giờ) | **Không đụng** ngày đã qua |
| Q3 | Cách thực thi | **Hỏi xác nhận**, nêu rõ số ngày |

**Vì sao Q2 là "không đụng":** tính lại theo chiều ngược sẽ biến người ta thành đi
muộn **hồi tố** cho những ngày mà lúc đó họ không hề có giờ mốc nào để muộn — và
điều đó có thể trừ tiền của họ.

## Phần A — Cập nhật hồi tố

### Module mới `src/lib/data/mutations/shift-realign.ts`

Hai hàm tách bạch:

```
previewShiftRealign(employeeId) -> { shiftName, dayCount, lateDayCount, months }
applyShiftRealign(employeeId)   -> { dayCount }
```

Cả hai: `getSessionContext()` → `requireRole(['owner','admin'])` → lọc `company_id`
từ phiên. Khuôn giống `mutations/employees.ts`.

**Tiền đề bắt buộc:** từ chối nếu ca hiện tại của nhân viên **không phải**
`kind: 'hours'`. Đó là tiền đề của cả tính năng — gọi nhầm phải ném lỗi chứ không
im lặng bỏ qua.

### Chọn ngày

1. Đọc `periods` của doanh nghiệp có `status = 'closed'` → tập tháng đã chốt
2. Lấy bản ghi của nhân viên có `shift_id` **khác** ca hiện tại
3. Loại bản ghi có `work_date.slice(0,7)` nằm trong tập tháng đã chốt

Kỳ công là tròn một tháng dương lịch (D-09) nên so sánh chuỗi `"YYYY-MM"` là đủ.
Không cần migration mới.

### Mỗi bản ghi đổi đúng bốn cột

| Cột | Giá trị mới |
|---|---|
| `shift_id` | Ca linh hoạt hiện tại |
| `late_minutes` | `0` |
| `early_leave_minutes` | `0` |
| `status` | `late`/`early_leave` → `on_time`; các trạng thái khác **giữ nguyên** |

`missing_checkout`, `leave_paid`, `leave_unpaid`, `day_off` không nói về giờ giấc
nên không bị đụng.

**Không đụng:** `worked_minutes` (là thời lượng **thô** — `p_break_minutes: 0` ở
`checkOut`, giờ nghỉ chỉ trừ lúc hiển thị qua `groupAttendanceByDay`),
`check_in_at`, `check_out_at`, và ảnh bằng chứng + toạ độ. Chúng vẫn là bằng chứng
của một lần chấm công có thật.

### Phòng thủ hai lớp

Trigger `attendance_period_guard` (migration 0021) mới là ranh giới **thật**: nó
chặn ở tầng database mọi thao tác ghi vào ngày thuộc kỳ đã chốt, ném `SQLSTATE
TF001`.

Nếu bộ lọc ở tầng ứng dụng có sai, trigger làm thao tác **hỏng to** thay vì ghi lén
vào kỳ đã chốt. **Tuyệt đối không bắt-rồi-bỏ qua lỗi đó** — một lần nuốt lỗi ở đây
là mở đường cho bảng lương đã chốt bị đổi bên dưới.

### Dấu vết

Một dòng `audit_log` **tổng hợp** trên `employees` (`entityId = employeeId`), mang
danh sách ngày đã đổi và lý do. Theo đúng tiền lệ `closePayroll` — một dòng kèm
`line_count`, không phải N dòng.

### Giao diện

Sau khi lưu hồ sơ thành công: nếu ca mới là `kind: 'hours'` **và**
`previewShiftRealign` trả `dayCount > 0` → hiện `ConfirmDialog`.

Nội dung nêu rõ số ngày và số ngày đang tính đi muộn. Bấm "Không" thì dữ liệu giữ
nguyên và **không hỏi lại lần hai**.

## Phần B — Cột "Ca" theo từng ngày

Thêm cột **CA** lấy từ `record.shift_id` — **không** phải `employee.shift_id` — vào
ba màn hình:

- `src/app/admin/employees/[id]/employee-detail-view.tsx` (tab Chấm công)
- `src/app/admin/attendance/attendance-view.tsx`
- `src/app/employee/history/history-view.tsx`

Phần này vẫn cần **kể cả sau phần A**: phần A chỉ chạm kỳ chưa chốt, còn kỳ đã chốt
sẽ vĩnh viễn giữ ca cũ. Không có cột này thì lịch sử của kỳ đã chốt vẫn đọc ra mâu
thuẫn.

## Căng thẳng đã ghi nhận

`SETTINGS_SHIFT_LABEL.sectionDescription` (`constants.ts`) đang hứa:

> "Thay đổi ở đây áp cho những lần chấm công sau đó; các bản ghi đã có giữ nguyên
> cách phân loại của ngày hôm đó."

Câu đó nói về **sửa quy tắc của một ca**, không phải **chuyển nhân viên sang ca
khác** — hai việc khác nhau. Nhưng chúng nằm cạnh nhau trong đầu người dùng, nên
lời trong hộp thoại xác nhận phải nói rõ đây là hành động **một lần, do người dùng
chủ động bấm**, không phải hệ thống tự trôi.

## Ngoài phạm vi

- Không đổi quy ước D-08 (`work_date` = ngày VN của khoảnh khắc chấm)
- Không tính lại `worked_minutes`, không đụng ảnh/toạ độ
- Không đụng kỳ **đã chốt** dưới bất kỳ hình thức nào
- Không tự động chạy — luôn cần một lần bấm của người dùng

## Kiểm thử

**Module thuần** (chọn ngày):
- ngày thuộc tháng đã chốt bị loại
- ngày đã gắn đúng ca linh hoạt bị loại (không có gì để đổi)
- `leave_paid` / `leave_unpaid` / `missing_checkout` giữ nguyên `status`
- `late` → `on_time`, `early_leave` → `on_time`

**Tích hợp trên Postgres thật:**
- preview đếm đúng số ngày và số ngày đi muộn
- apply đổi bản ghi kỳ mở, **không** đổi bản ghi kỳ đã chốt
- ca hiện tại không phải `hours` → ném lỗi, không ghi gì
- chiều ngược lại (sang ca có giờ) không làm gì
