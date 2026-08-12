# Khai tiền tăng ca ngay khi thêm nhân viên ca linh hoạt

Ngày: 2026-08-10

## Vấn đề

Tiền tăng ca riêng theo từng người đã có đầy đủ (`employee_overtime_rates`,
migration 0026; `OvertimeRatePanel`; đã chảy vào `compute-daily.ts`) — nhưng chỉ
khai được **sau khi** tạo xong nhân viên, ở tab "Thông tin lương" của hồ sơ.

Với công nhân ca linh hoạt, tăng ca chính là phần vượt quá số giờ chuẩn của
ngày — nó là điều kiện làm việc, không phải một khoản khai thêm. Bắt người tạo
hồ sơ đi hai màn hình cho một thoả thuận đã chốt ngay lúc tuyển là sai nhịp.

## Phạm vi

Chỉ đường **tạo mới** (`/admin/employees/new`), và chỉ khi ca là **"Theo số giờ
— linh hoạt"**. Đường sửa hồ sơ không đổi: mỗi lần đổi tiền tăng ca vẫn là một
phiên bản mới khai ở tab "Thông tin lương" (append-only, D-37a).

## Giao diện

Hai ô mới nằm trong chính khối **"Mức lương"** (khối này vốn chỉ hiện ở chế độ
tạo mới), sau ô "Số tiền (đ)" và trước ô "Hiệu lực từ ngày":

| Ô | Nội dung |
|---|---|
| **Cách khai** | "Số tiền mỗi giờ tăng ca" *(mặc định)* / "Hệ số nhân đơn giá giờ" |
| **Số tiền mỗi giờ tăng ca (₫)** *hoặc* **Hệ số (1,5 = 150% đơn giá giờ)** | Nhãn và bước nhảy đổi theo ô trên — đúng khuôn `OvertimeRateDialog` |

Nhãn lấy nguyên từ `EMPLOYEE_OVERTIME_RATE_LABEL` đang có, không viết lại chuỗi
thứ hai cho cùng một ô.

**Ngày hiệu lực dùng chung** ô "Hiệu lực từ ngày" sẵn có. Chữ trợ giúp của ô đó
đổi theo ngữ cảnh: ở ca linh hoạt nó nói rõ ngày này áp cho cả lương gốc lẫn
tiền tăng ca.

Đổi ca sang "có giờ cụ thể" → hai ô biến mất và hết bắt buộc.

**Cảnh báo phạm vi** hiện ngay dưới hai ô — xem mục "Nợ kỹ thuật phải trả".

## Bắt buộc

Bắt buộc khi và chỉ khi **đang tạo mới VÀ ca linh hoạt**.

Điều kiện đọc từ `payRateRequired && shiftMode === "hours"`. `payRateRequired`
thực chất đã là cờ "đang ở chế độ tạo mới" (comment trong `employeeSchema` nói
đúng vậy) nên không thêm cờ thứ hai — hai cờ cho cùng một sự thật sẽ lệch nhau.

**Hệ quả đã cân nhắc và chấp nhận:** khai một mức riêng nghĩa là người đó ăn
trọn mức ấy cho *mọi* loại ngày — thường, nghỉ, lễ, đêm. Ngày lễ của họ không
còn nhân 300% theo Điều 98 BLLĐ. Bắt buộc ô này nghĩa là mọi nhân viên ca linh
hoạt tạo từ nay đều mất đường "ăn theo hệ số doanh nghiệp". Đây là lựa chọn có
ý thức của doanh nghiệp, và màn hình phải nói ra chứ không để người khai tự
phát hiện khi bảng lương ra số.

## Kiểm tra dữ liệu

Thêm vào `employeeSchema` hai trường:

```ts
overtimeRateValueType: z.enum(["multiplier", "fixed_hourly"])
overtimeRateValue: z.number().nullable()   // null = ô đang để trống
```

Ràng buộc trong `superRefine`, **cùng bộ quy tắc** với
`employeeOvertimeRateInputSchema` phía server (hai lớp, một bộ quy tắc — đúng
khuôn form đang làm với mức lương):

- để trống → "Vui lòng nhập tiền tăng ca."
- ≤ 0 → "Tiền tăng ca phải lớn hơn 0."
- `multiplier` > 10 → "Hệ số tăng ca không vượt quá 10 lần đơn giá giờ."
- `fixed_hourly` > 10.000.000 → "Số tiền một giờ tăng ca quá lớn."

## Đường ghi

`createEmployee` → `createPayRate` → `createEmployeeOvertimeRate`, tuần tự vì cả
hai bảng sau đều tham chiếu `employee_id`.

Bước 3 hỏng thì hồ sơ và mức lương **đã tạo rồi**. Xử đúng khuôn bước 2 đang
dùng: toast *"Đã thêm nhân viên nhưng chưa lưu được tiền tăng ca"* kèm chỉ dẫn
khai lại ở tab "Thông tin lương", rồi chuyển sang hồ sơ vừa tạo. Tuyệt đối
không nói "không lưu được nhân viên" — câu đó khiến người dùng thêm người lần
thứ hai và dính lỗi trùng mã nhân viên.

## Nợ kỹ thuật phải trả trong cùng thay đổi này

`EMPLOYEE_OVERTIME_RATE_LABEL.scopeWarning` và `.legalNote` đang là **chuỗi
rỗng**, ngay dưới một comment nói "Hệ quả PHẢI nói trước khi bấm lưu". Hậu quả:
`OvertimeRatePanel` và `OvertimeRateDialog` đang vẽ một khung cảnh báo có icon
mà không có chữ nào.

Thiết kế này dựa vào đúng hai câu đó, nên chúng được điền ở đây:

- `scopeWarning`: mức riêng áp cho mọi loại ngày — thường, nghỉ, lễ, đêm.
- `legalNote`: nghĩa là ngày lễ không còn nhân 300% theo Điều 98 BLLĐ.

Sửa ở `constants.ts` nên cả ba nơi (form tạo mới, panel, dialog) cùng nói một
câu.

## Kiểm thử

`src/lib/validation/__tests__/` chưa tồn tại — tạo mới với
`employee-schema.test.ts`:

- ca linh hoạt + thiếu tiền tăng ca → lỗi ở đúng `overtimeRateValue`
- ca có giờ cụ thể + thiếu → **hợp lệ** (không bắt buộc)
- chế độ sửa (`payRateRequired: false`) + ca linh hoạt + thiếu → hợp lệ
- hệ số > 10 → lỗi; số tiền > 10.000.000 → lỗi
- ranh giới: hệ số đúng 10 và số tiền đúng 10.000.000 → hợp lệ
