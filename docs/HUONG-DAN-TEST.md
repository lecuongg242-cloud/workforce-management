# Hướng dẫn kiểm thử TimeFlow

Tài liệu này liệt kê đầy đủ đường link, tài khoản, dữ liệu mẫu và kịch bản test
cho frontend giai đoạn đầu.

> **Lưu ý quan trọng:** Toàn bộ dữ liệu nằm trong bộ nhớ trình duyệt/máy chủ dev.
> Mỗi lần khởi động lại `npm run dev`, dữ liệu trở về trạng thái gốc. Các thay
> đổi bạn tạo ra (thêm nhân viên, tạo ca, gửi yêu cầu) chỉ tồn tại trong phiên
> chạy đó.

---

## 1. Khởi động

```bash
cd e:\externalProjects\workforce-management
npm install     # chỉ cần chạy lần đầu
npm run dev
```

Mặc định chạy ở **http://localhost:3000**. Nếu cổng 3000 đang bận:

```bash
npm run dev -- --port 3100
```

---

## 2. Tài khoản đăng nhập

Hệ thống **chưa nối Supabase Auth thật**. Lớp đăng nhập là giả lập, nên:

| Thông tin | Giá trị |
|---|---|
| Email | `quan.nguyen@ngocphat.vn` *(đã điền sẵn)* |
| Mật khẩu | `timeflow2026` *(đã điền sẵn)* |
| Tên hiển thị | Nguyễn Văn Quân |

**Quy tắc đăng nhập giả:** bất kỳ email đúng định dạng nào cộng với mật khẩu từ
**6 ký tự trở lên** đều đăng nhập được. Đây là chủ ý để bạn test nhanh mà không
cần nhớ mật khẩu.

Dùng để test phần báo lỗi:

| Nhập vào | Kết quả mong đợi |
|---|---|
| Để trống email | “Vui lòng nhập email.” |
| `abc` | “Email không hợp lệ. Ví dụ: ten@congty.vn” |
| Mật khẩu `123` | “Mật khẩu phải có ít nhất 6 ký tự.” |

Phiên đăng nhập lưu ở `localStorage` với khoá `timeflow.session`. Muốn xoá phiên
thủ công: mở DevTools → Application → Local Storage → xoá khoá đó, hoặc bấm
**Đăng xuất** trong ứng dụng.

---

## 3. Danh sách đường link

Thay `3000` bằng cổng bạn đang chạy.

### Xác thực và khởi tạo — vào được khi chưa đăng nhập

| Màn hình | Đường link |
|---|---|
| Trang chủ (tự chuyển sang đăng nhập) | http://localhost:3000/ |
| Đăng nhập | http://localhost:3000/login |
| Tạo doanh nghiệp (wizard 3 bước) | http://localhost:3000/onboarding |
| Chọn doanh nghiệp | http://localhost:3000/select-company |

### Quản trị — bắt buộc đăng nhập, tối ưu cho máy tính

| Màn hình | Đường link |
|---|---|
| Tổng quan | http://localhost:3000/admin/dashboard |
| Danh sách nhân viên | http://localhost:3000/admin/employees |
| Thêm nhân viên | http://localhost:3000/admin/employees/new |
| Chi tiết nhân viên | http://localhost:3000/admin/employees/nv-01 |
| Phòng ban | http://localhost:3000/admin/departments |
| Ca làm việc | http://localhost:3000/admin/shifts |

### Nhân viên — bắt buộc đăng nhập, thiết kế cho điện thoại

| Màn hình | Đường link |
|---|---|
| Trang chủ nhân viên | http://localhost:3000/employee |
| Lịch sử chấm công | http://localhost:3000/employee/history |
| Yêu cầu | http://localhost:3000/employee/requests |
| Hồ sơ cá nhân | http://localhost:3000/employee/profile |

Mở thẳng biểu mẫu tạo yêu cầu theo loại:

- http://localhost:3000/employee/requests?type=leave
- http://localhost:3000/employee/requests?type=attendance_supplement
- http://localhost:3000/employee/requests?type=time_adjustment
- http://localhost:3000/employee/requests?type=overtime

### Chưa xây dựng

`/admin/attendance`, `/admin/payroll`, `/admin/settings` hiển thị nhãn
**“Sắp ra mắt”** trên sidebar và **cố ý không điều hướng**. Gõ thẳng đường link
sẽ ra trang 404 — đúng thiết kế của giai đoạn này.

---

## 4. Hai doanh nghiệp để test multi-tenant

Tài khoản demo thuộc **2 doanh nghiệp**. Dữ liệu hoàn toàn tách biệt — đây là
phần đáng test nhất.

| | Ngọc Phát | Bình Minh |
|---|---|---|
| Tên đầy đủ | Công ty TNHH Thương mại Ngọc Phát | Xưởng Sản xuất Bình Minh |
| Vai trò của bạn | Chủ sở hữu | Quản lý |
| Nhân viên | 28 | 12 |
| Phòng ban | 5 | 4 |
| Ca làm việc | 4 | 3 |
| Yêu cầu chờ duyệt | 6 | 2 |
| KPI dashboard | 28 / 22 / 3 / 2 | 12 / 6 / 2 / 1 |

Đổi doanh nghiệp bằng **hai cách**: nút chuyển ở góc phải thanh trên cùng, hoặc
bấm khối tên công ty ở đầu sidebar để quay lại `/select-company`.

---

## 5. Dữ liệu mẫu

### Ngày tham chiếu

Toàn bộ dữ liệu neo vào **Thứ Hai 27/07/2026**. Con số cố định như vậy để dashboard
và biểu đồ không đổi giữa các lần tải trang.

### Phòng ban — Ngọc Phát

| Tên | Quản lý | Số nhân viên |
|---|---|---|
| Ban giám đốc | Trần Hoàng Nam | 2 |
| Kinh doanh | Vũ Ngọc Mai | 6 |
| Kế toán | Trịnh Bảo Châu | 5 |
| Kho vận | Phan Trọng Nghĩa | 6 |
| Sản xuất | Lâm Thị Bích Hạnh | 8 |

### Ca làm việc — Ngọc Phát

| Ca | Mã | Giờ | Nghỉ | Cho phép muộn | Đang áp dụng |
|---|---|---|---|---|---|
| Ca hành chính | HC | 08:00 – 17:30 | 90 phút | 5 phút | 12 người |
| Ca sáng | S1 | 06:00 – 14:00 | 30 phút | 10 phút | 7 người |
| Ca chiều | C1 | 14:00 – 22:00 | 30 phút | 10 phút | 5 người |
| **Ca đêm** | D1 | 22:00 – 06:00 | 45 phút | 10 phút | 3 người |

Ca đêm là ca **qua ngày** — dùng để kiểm tra phép tính giờ (8 giờ gộp − 45 phút
nghỉ = **7 giờ 15 phút** làm việc thực tế).

### Ca làm việc — Bình Minh

| Ca | Mã | Giờ | Ghi chú |
|---|---|---|---|
| Ca ngày 12 tiếng | N12 | 06:00 – 18:00 | Chỉ T2, T4, T6, T7 |
| **Ca đêm 12 tiếng** | D12 | 18:00 – 06:00 | Ca qua đêm |
| Ca hành chính xưởng | HCX | 07:30 – 16:30 | T2 – T7 |

### Nhân viên tiêu biểu — Ngọc Phát

| Mã | Họ tên | Phòng ban | Trạng thái | Link chi tiết |
|---|---|---|---|---|
| NV001 | Nguyễn Minh Anh | Kinh doanh | Đang làm việc | `/admin/employees/nv-01` |
| NV002 | Trần Hoàng Nam | Ban giám đốc | Đang làm việc | `/admin/employees/nv-02` |
| NV003 | Lê Thu Hương | Kế toán | Đang làm việc | `/admin/employees/nv-03` |
| NV004 | Phạm Quốc Khánh | Kho vận | Đang làm việc | `/admin/employees/nv-04` |
| NV005 | Vũ Ngọc Mai | Kinh doanh | Đang làm việc | `/admin/employees/nv-05` |
| NV006 | Đỗ Văn Thành | Sản xuất | Đang làm việc | `/admin/employees/nv-06` |
| NV009 | Ngô Thanh Tuyền | Kinh doanh | **Đang nghỉ phép** | `/admin/employees/nv-09` |
| NV014 | Nguyễn Hải Đăng | Kế toán | **Chưa kích hoạt** | `/admin/employees/nv-14` |
| NV020 | Tô Anh Kiệt | Kho vận | **Đã nghỉ việc** | `/admin/employees/nv-20` |
| NV026 | Lưu Đình Phúc | Sản xuất | **Đang nghỉ phép** | `/admin/employees/nv-26` |
| NV028 | Trần Gia Bảo | Ban giám đốc | **Chưa kích hoạt** | `/admin/employees/nv-28` |

Đủ **4 trạng thái** và đủ **5 loại hợp đồng** (toàn thời gian, bán thời gian,
thử việc, thời vụ, thực tập) để test bộ lọc.

Nhân viên Bình Minh dùng mã **BM001 – BM012**, id `nv2-01` … `nv2-12`.

### Tài khoản trên màn hình nhân viên

Màn `/employee` hiển thị dưới góc nhìn của **Nguyễn Minh Anh (NV001)** — Kinh
doanh, Ca hành chính, Văn phòng chính. Người này có sẵn lịch sử chấm công cả
tháng 07/2026 để test màn lịch sử.

---

## 6. Kịch bản test

### 6.1 Luồng đăng nhập

1. Vào `/login` → bấm **Đăng nhập** → chuyển sang `/select-company`.
2. Chọn **Ngọc Phát** → vào `/admin/dashboard`.
3. Bấm **Đăng xuất** (menu avatar góc phải trên, hoặc menu tài khoản cuối sidebar).
4. Gõ thẳng `/admin/dashboard` → **phải bị đẩy về `/login`**.

### 6.2 Dashboard

- 4 thẻ KPI phải hiện **28 / 22 / 3 / 2**, nền trắng, chỉ khác nhau ở icon.
- Biểu đồ 7 ngày: cột Chủ Nhật 26/07 bằng 0; di chuột lên cột → tooltip tiếng
  Việt hiện “Đã chấm công / Đi muộn / Nghỉ”.
- Bảng **Hoạt động hôm nay** có 22 dòng, sắp xếp tăng dần theo giờ vào.
- Đổi ngày bằng nút chọn ngày → số liệu đổi theo (chọn 26/07 là Chủ Nhật sẽ
  thấy dữ liệu rỗng).

### 6.3 Danh sách nhân viên — tìm kiếm, lọc, phân trang

| Thao tác | Kết quả mong đợi |
|---|---|
| Gõ `huong` (không dấu) vào ô tìm kiếm | Ra **Lê Thu Hương** và **Bùi Thị Lan Phương** |
| Gõ `NV004` | Ra Phạm Quốc Khánh |
| Gõ số điện thoại `0901234567` | Tìm được theo số điện thoại |
| Lọc phòng ban = Kế toán | Còn 5 người |
| Lọc trạng thái = Đã nghỉ việc | Còn 1 người (Tô Anh Kiệt) |
| Đổi số dòng 10 → 50 | Hiện hết trên một trang |
| Gõ `zzzz` | Hiện empty state “Không tìm thấy nhân viên phù hợp” kèm nút xoá bộ lọc |

**Chọn hàng loạt:** tick 3 dòng → thanh tím hiện ra → **Chuyển phòng ban** →
chọn Kho vận → xác nhận. Quay lại lọc theo Kho vận để kiểm chứng số đã tăng.

**Menu ba chấm** mỗi dòng: Xem chi tiết · Chuyển phòng ban · Gửi lại lời mời ·
Đánh dấu đã nghỉ việc (có hộp thoại xác nhận màu đỏ).

### 6.4 Thêm nhân viên

1. `/admin/employees/new` → bấm ngay **Thêm nhân viên** khi form trống → phải
   hiện thông báo lỗi tiếng Việt ở từng trường.
2. Test riêng các ràng buộc:
   - Email `abc` → “Email không hợp lệ.”
   - Số điện thoại `123` → “Số điện thoại phải gồm 10 hoặc 11 số và bắt đầu bằng 0.”
   - Mã nhân viên nhập `NV001` (đã tồn tại) → khi lưu hiện lỗi **“Mã nhân viên
     NV001 đã tồn tại.”**
   - Ngày sinh năm 2015 → “Nhân viên phải từ 16 tuổi trở lên.”
3. Điền hợp lệ → **Thêm nhân viên** → có thông báo thành công, quay về danh sách,
   người mới **nằm ở đầu danh sách**, tổng số trên dashboard tăng lên 29.
4. Sửa vài trường rồi bấm **Hủy** → hiện hộp thoại “Rời khỏi trang khi chưa lưu?”.

### 6.5 Chi tiết nhân viên

Mở `/admin/employees/nv-01`, kiểm tra 5 tab:

- **Tổng quan** — liên hệ, công việc, ca mặc định, ngày công tháng, số lần đi muộn.
- **Chấm công** — bảng lịch sử, cột giờ dùng chữ số đều nhau.
- **Lịch làm việc** — 7 ô T2…CN, ngày làm việc tô nền tím.
- **Yêu cầu** — 4 yêu cầu của Nguyễn Minh Anh, đủ 3 trạng thái.
- **Thông tin lương** — đúng câu *“Thông tin lương sẽ được thiết lập trong giai
  đoạn tiếp theo.”*

Nút **Chỉnh sửa** mở hộp thoại chứa lại toàn bộ biểu mẫu.
Thử id sai: `/admin/employees/khong-ton-tai` → hiện “Không tìm thấy nhân viên”.

### 6.6 Phòng ban

- **Thêm phòng ban** → điền tên → lưu → xuất hiện trong bảng.
- Sửa một phòng ban, đổi người quản lý.
- Xoá **Sản xuất** (đang có 8 người) → hộp thoại cảnh báo nêu rõ số nhân viên.

### 6.7 Ca làm việc — trọng tâm là ca qua đêm

1. `/admin/shifts` — **Ca đêm** phải có badge **“Ca qua đêm”** và ghi
   **7 giờ 15 phút làm việc**.
2. Bấm **Tạo ca làm việc**, nhập giờ bắt đầu `22:00`, giờ kết thúc `06:00`:
   - Khung tóm tắt dưới form phải tự hiện dòng xanh **“Ca qua đêm — kết thúc lúc
     06:00 ngày hôm sau.”**
   - Thời gian làm việc thực tế tính đúng (8 giờ trừ số phút nghỉ bạn nhập).
3. Menu ba chấm → **Nhân bản ca** → tạo bản sao có hậu tố “(bản sao)”.
4. **Ngừng sử dụng** một ca đang có người áp dụng → cảnh báo nêu số nhân viên.

### 6.8 Màn hình nhân viên — bật chế độ điện thoại trong DevTools

Nhấn `F12` → biểu tượng điện thoại → chọn iPhone.

`/employee` có sẵn **bộ chuyển trạng thái để xem thử** ở cuối trang, cho phép
nhảy qua lại 3 trạng thái mà không cần chờ:

| Chọn | Màn hình hiển thị |
|---|---|
| Dữ liệu thật | Trạng thái theo dữ liệu mock hiện tại |
| Chưa vào ca | Đồng hồ chạy realtime, nút lớn **Vào ca**, ghi chú GPS |
| Đang làm việc | Giờ vào, thời gian đã làm tăng dần, nút **Tan ca** |
| Đã tan ca | Giờ vào, giờ ra, tổng thời gian, badge đúng giờ/đi muộn |

Bấm **Vào ca** thật sẽ ghi nhận giờ hiện tại của máy bạn và hiện thông báo.

Kiểm tra thêm: thanh điều hướng dưới cùng có 4 tab, **không che nội dung**, mỗi
nút cao tối thiểu 44px.

### 6.9 Lịch sử chấm công

- Dải lịch cuộn ngang, mỗi ngày có chấm màu theo trạng thái; chạm để lọc riêng ngày đó.
- Nút mũi tên đổi tháng — **không cho vượt quá tháng 07/2026**.
- Đủ 7 trạng thái: đúng giờ, đi muộn, về sớm, thiếu giờ ra, nghỉ phép, nghỉ không
  phép, ngày nghỉ.
- Bốn ngày có cờ vàng **“Cần bổ sung chấm công”** kèm nút tạo yêu cầu:
  **23/07** và **16/07**, **08/07** (thiếu giờ ra) và **22/07** (nghỉ không phép).

### 6.10 Yêu cầu

- 4 tab: Tất cả (5) · Chờ duyệt (2) · Đã duyệt (2) · Từ chối (1).
- Nút nổi **+ Tạo yêu cầu** → mở bảng trượt từ dưới lên.
- Chọn loại **Xin nghỉ phép** → chỉ hỏi ngày; chọn **Bổ sung chấm công** → hiện
  thêm ô giờ.
- Nhập lý do dưới 10 ký tự → “Lý do cần ít nhất 10 ký tự để người duyệt hiểu rõ.”
- Đặt ngày kết thúc trước ngày bắt đầu → “Ngày kết thúc phải sau hoặc bằng ngày
  bắt đầu.”
- Gửi thành công → yêu cầu mới xuất hiện ở tab **Chờ duyệt**, số đếm tăng.

### 6.11 Onboarding

`/onboarding` — wizard 3 bước:

1. **Bước 1** bỏ trống rồi bấm Tiếp tục → không cho qua, hiện lỗi từng trường.
   Mã doanh nghiệp nhập ký tự đặc biệt → báo lỗi định dạng.
2. **Bước 2** — đổi giờ kết thúc thành sớm hơn giờ bắt đầu để thấy nhãn
   **Ca qua đêm** tự hiện. Bỏ chọn hết ngày trong tuần → “Chọn ít nhất một ngày…”.
3. **Bước 3** — kiểm tra bảng tóm tắt khớp dữ liệu đã nhập, có checklist 4 việc.
   Bấm **Vào trang quản trị** → tạo doanh nghiệp mới và chuyển vào dashboard.
   Doanh nghiệp mới **chưa có nhân viên nào** → đây là cách xem toàn bộ
   **empty state** của các màn quản trị.

---

## 7. Test giao diện đáp ứng

Mở DevTools → Toggle device toolbar → nhập chiều rộng thủ công:

| Chiều rộng | Cần kiểm tra |
|---|---|
| **375px** | Bảng nhân viên chuyển thành thẻ; đăng nhập chỉ còn dải màu mỏng phía trên, không có mockup; KPI xếp 2 cột; không cuộn ngang |
| **768px** | Sidebar quản trị vẫn là drawer (bấm nút ☰); bảng nhân viên bắt đầu hiện dạng bảng |
| **1024px** | Sidebar cố định hiện ra; dashboard bắt đầu chia cột |
| **1440px** | Đăng nhập chia đôi màn hình có mockup bảng công; dashboard 2 cột đầy đủ |

---

## 8. Test trạng thái tải và lỗi

- **Loading skeleton:** DevTools → tab Network → chọn *Slow 3G* → tải lại
  `/admin/employees`. Mỗi truy vấn có độ trễ giả 420ms nên khung xám luôn kịp hiện.
- **Empty state:** lọc ra kết quả rỗng, hoặc tạo doanh nghiệp mới ở onboarding.
- **Error state:** mở `src/lib/mock/service.ts`, đổi
  `simulateError: false` → `true` rồi lưu. Mọi màn hình sẽ hiện khung báo lỗi đỏ
  kèm nút **Thử lại**. Nhớ đổi lại `false` sau khi test.

---

## 9. Test khả năng tiếp cận

- **Bàn phím:** ở `/admin/employees`, nhấn `Tab` liên tục — mọi nút, ô lọc, dòng
  bảng đều có viền tím rõ khi được chọn.
- **Hộp thoại:** mở một hộp thoại xác nhận, nhấn `Tab` — tiêu điểm bị giữ trong
  hộp thoại; nhấn `Esc` để đóng.
- **Không chỉ dựa vào màu:** mọi badge trạng thái đều có **icon + chữ**, không
  chỉ chấm màu.
- **Nút biểu tượng** đều có nhãn cho trình đọc màn hình (chuông thông báo, ba
  chấm, xoá tìm kiếm…).

---

## 10. Những gì cố ý chưa có

Không phải lỗi — nằm ngoài phạm vi giai đoạn đầu:

Tính lương đầy đủ · phiếu lương · thuế và bảo hiểm · máy chấm công · nhận diện
khuôn mặt · chấm công bằng QR · trang super admin · thanh toán gói SaaS · backend
thật · duyệt yêu cầu từ phía quản trị (giai đoạn này chỉ xem danh sách chờ duyệt).

Ngoài ra, các nút **Nhập từ Excel**, **Tải ảnh đại diện**, **Lưu nháp**, **Đổi
mật khẩu**, **Cài đặt thông báo** hiện chỉ hiện thông báo nhắc rằng tính năng
thuộc giai đoạn sau.
