# Thiết kế: Khu quản trị dùng được trên mọi thiết bị

**Ngày:** 2026-08-29
**Trạng thái:** ĐANG SOẠN — Phần 1 và 2 đã chốt, Phần 3 và 4 chưa bàn xong.
**Lý do đẩy sớm:** tiếp tục soạn trên máy khác.

---

## Vấn đề

Khu `/admin/*` được dựng cho màn hình máy tính. Người dùng thật — chủ doanh
nghiệp và nhân sự của doanh nghiệp vừa và nhỏ — thường chỉ có điện thoại trong
tay khi cần duyệt một đơn hay xem một lượt chấm công đáng ngờ.

Khảo sát ngày 2026-08-29:

**Đã có sẵn:**

- `src/components/layout/admin-shell.tsx` — sidebar cố định từ `lg`, dưới `lg`
  chuyển thành drawer (Sheet).
- `src/components/layout/admin-topbar.tsx` — nút hamburger `lg:hidden`,
  breadcrumb rút gọn ở `sm`, ô tìm kiếm ẩn dưới `md`.
- `src/app/admin/employees/employees-view.tsx` — mẫu chuẩn duy nhất: bảng ở
  `md:block`, `EmployeeMobileCard` ở `md:hidden`.
- `src/components/common/filter-bar.tsx` và `src/components/layout/page-header.tsx`
  đã responsive.

**Chưa có** — số class responsive trong mỗi view quản trị:

| View | Số class responsive |
| --- | --- |
| `attendance/review/attendance-review-view.tsx` | 0 |
| `payroll/payroll-view.tsx` | 0 |
| `settings/settings-view.tsx` | 1 |
| `dashboard`, `departments`, `requests`, `shifts`, `work-sites` | 2 |
| `attendance/attendance-view.tsx` | 3 |

Các màn này gần như toàn bảng nhiều cột. Comment ở `admin-shell.tsx:96-98` ghi
chủ ý "KHÔNG CÓ TRÀN BỀ NGANG", nhưng primitive `Table`
(`src/components/ui/table.tsx`) bọc sẵn `overflow-x-auto` — nên trên điện thoại
các bảng đang cuộn ngang, tức là đang vi phạm chính nguyên tắc đó.

---

## Quyết định nền

1. **Hỗ trợ đầy đủ trên mọi thiết bị.** Người quản trị làm được mọi việc trên
   điện thoại, không có màn nào bị chặn với thông báo "mở trên máy tính".
2. **Rút gọn cột, không thu nhỏ bảng.** Ở màn hẹp chỉ giữ thông tin chính.
3. **Không bao giờ ẩn cột là căn cứ ra quyết định của màn đó.** Đây là nguyên
   tắc chọn cột, không phải "giữ N cột đầu". Ví dụ: ở màn Cần xem lại, *khoảng
   cách so với điểm làm việc* chính là căn cứ để duyệt — ẩn nó đi thì không
   duyệt được, mà quyết định 1 nói phải duyệt được trên điện thoại.
4. **Cột phụ bị ẩn đi vào chỗ chi tiết đã có sẵn**, không dựng màn mới. Mỗi bảng
   đều đã có đường dẫn tới chi tiết:

   | Màn | Chỗ xem chi tiết đã có |
   | --- | --- |
   | Chấm công | `AttendancePhotoDialog` |
   | Cần xem lại | `AttendancePhotoDialog` |
   | Yêu cầu | `ReviewDialog` + lịch sử |
   | Bảng lương | hàng mở rộng `payroll-row-detail.tsx` |
   | Nhân viên | trang `/admin/employees/[id]` |

5. **Desktop giữ nguyên 100%.** Mọi thay đổi đều nằm dưới `lg`.

---

## Phần 1 — Ba mốc màn hình và khung giao diện (ĐÃ CHỐT)

Giữ nguyên mốc `lg` (1024px) đang dùng, thêm `md` (768px) làm ranh giới điện
thoại / tablet.

| Mốc | Thiết bị điển hình | Khung |
| --- | --- | --- |
| `< md` (<768) | điện thoại | Topbar gọn + thanh nav đáy + drawer cho mục phụ. Bảng rút còn cột chính. |
| `md`–`lg` (768–1023) | iPad dọc, tablet 10" | Topbar + drawer qua hamburger. Bảng gần đủ cột. Không có nav đáy. |
| `≥ lg` (≥1024) | iPad ngang, laptop, desktop | Sidebar cố định 256px — y như hiện tại, không đụng vào. |

**Vì sao tablet dọc không gắn sidebar cố định:** 820px trừ 256px sidebar chỉ còn
564px cho nội dung — hẹp hơn cả điện thoại xoay ngang. Drawer là đúng.

**Vì sao nav đáy chỉ dưới `md`:** từ 768px trở lên ngón tay với tới topbar dễ, và
thanh đáy trên tablet trông lạc lõng.

### Việc phải làm

1. `src/components/layout/mobile-bottom-nav.tsx` hiện đọc cứng
   `EMPLOYEE_NAV_ITEMS`. Sửa thành nhận `items` qua props. Component này đã tự
   suy số cột từ độ dài mảng (`COLUMN_CLASS`) nên chỉ cần đổi nguồn dữ liệu.
2. Thêm `ADMIN_MOBILE_NAV_ITEMS` vào `src/lib/nav.ts`: Tổng quan · Chấm công ·
   Cần xem lại · Yêu cầu · Thêm. Mục "Thêm" mở đúng drawer đang có, không dựng
   menu thứ hai.
3. `AdminShell` gắn nav đáy `md:hidden`, và `<main>` thêm `pb-20 md:pb-0` để nội
   dung không bị thanh nav che.
4. Topbar dưới `md`: bỏ breadcrumb, thay bằng tên màn hiện tại. Giữ nút chuông
   và avatar. Ô tìm kiếm đã ẩn sẵn dưới `md`.

---

## Phần 2 — Rút gọn cột theo từng màn (ĐÃ CHỐT)

**Cách làm chung:** giữ nguyên một component bảng, gắn `hidden md:table-cell`
lên các cột phụ. Không tách bảng desktop / bảng mobile thành hai nhánh code —
hai nhánh nghĩa là sửa nghiệp vụ hai lần và một ngày nào đó chúng lệch nhau.
Riêng màn Nhân viên đã có `EmployeeMobileCard` thì giữ nguyên.

| Màn | `< md` giữ lại | Ẩn vào chi tiết |
| --- | --- | --- |
| Chấm công | Ngày · Nhân viên · Vào–Ra (một ô, `07:58→17:03`) · Trạng thái | Thời lượng lượt, Ca, Nơi chấm → `AttendancePhotoDialog` |
| Cần xem lại | ☑ · Nhân viên · **Khoảng cách** · Trạng thái · nút Duyệt | Điểm làm việc, Chụp lúc → dialog bằng chứng |
| Yêu cầu | ☑ · Nhân viên · Loại · Khoảng ngày · nút Duyệt | Lý do, Gửi lúc, Trạng thái → `ReviewDialog` |
| Bảng lương | Nhân viên · Ngày công · **Thực nhận** · ▾ | 11–13 cột còn lại → hàng mở rộng `payroll-row-detail.tsx` (đã có sẵn) |
| Nhân viên | đã xong — `EmployeeMobileCard` | — |
| Phòng ban · Ca làm việc · Điểm làm việc · Cài đặt | các màn này là thẻ và form, không phải bảng — chỉ cần sửa lưới `grid-cols` và bề rộng form | — |

### Hai điểm cần nói rõ

**Cột "Vào–Ra" gộp làm một ở `< md` là cột hiển thị mới, không phải ẩn cột.**
Hai cột giờ tách rời chiếm chỗ gấp đôi mà luôn được đọc cùng nhau.

**Ngoại lệ có chủ ý: lưới chấm công theo tháng.**
`src/components/attendance/attendance-month-grid.tsx` có 31 cột ngày. Cái này
không rút gọn được — nó là một cuốn lịch, mà lịch thì phải thấy cả tháng. Ở đây
giữ cuộn ngang; cột tên nhân viên đã `sticky left-0` sẵn. Đây là ngoại lệ duy
nhất được phép cuộn ngang: cuộn ngang một cuốn lịch là điều người dùng vốn đã
quen, khác hẳn cuộn ngang một bảng dữ liệu.

### Kích thước chạm

Ở `< md`: hàng bảng cao tối thiểu 48px, nút hành động trong hàng tối thiểu
44×44. Hiện `size="icon-sm"` nhỏ hơn mức đó.

---

## Phần 3 — Hộp thoại và biểu mẫu (CHỐT MỘT PHẦN)

### Lỗi đã xác định

`src/components/ui/dialog.tsx:64` đặt `max-w` nhưng **không có `max-h`** và
không có vùng cuộn bên trong. Trên điện thoại, các hộp thoại cao (duyệt yêu cầu,
tạo ca làm việc, quy tắc tăng ca) tràn khỏi màn hình và không cuộn tới được nút
"Lưu".

### Hướng đã chốt: làm cả hai, theo thứ tự

**Bước A — sửa kích thước tại chỗ.** Thêm `max-h-[90dvh]` và vùng cuộn bên trong
`DialogContent`. Sửa một file, mọi hộp thoại trong dự án hết tràn ngay, kể cả
những cái chưa rà tới.

**Bước B — đổi thành bottom sheet ở màn nhỏ.** Dưới `md`, hộp thoại trượt lên từ
đáy, chiếm gần hết chiều cao. `src/components/ui/sheet.tsx` đã hỗ trợ
`side="bottom"` sẵn. Giao diện nhân viên đã dùng mẫu này ở
`request-form-sheet.tsx` và `camera-sheet.tsx`, nên hai khu vực sẽ nhất quán.

Cách làm: tạo một lớp bọc `ResponsiveDialog` chọn Dialog hay Sheet theo bề
ngang, rồi đổi các chỗ gọi.

Chỉ áp bước B cho các hộp thoại nhập liệu dài: duyệt yêu cầu, form nhân viên,
tạo ca làm việc, quy tắc tăng ca. `ConfirmDialog` ngắn thì giữ nguyên dạng hộp
thoại.

### Còn phải bàn

- Biểu mẫu dài (`employee-form.tsx`, các tab trong Cài đặt) trên điện thoại: bố
  cục một cột, và `sticky-form-actions.tsx` đặt ở đâu để không đụng thanh nav
  đáy.
- Màn Tổng quan: `attendance-chart.tsx` (Recharts) ở bề ngang hẹp.

---

## Phần 4 — Thứ tự triển khai và cách kiểm thử (CHƯA BÀN)

Chưa thống nhất. Dự kiến bàn:

- Thứ tự làm: hạ tầng dùng chung (nav đáy, `ResponsiveDialog`, `max-h` dialog)
  trước, rồi từng màn theo mức độ dùng nhiều.
- Cách kiểm thử: giả lập thiết bị qua Chrome DevTools ở các bề ngang 375 / 768 /
  1024 / 1440, và danh sách việc phải làm được trọn vẹn trên điện thoại.
- Có viết test tự động cho phần này không, hay chỉ kiểm bằng mắt.

---

## Ràng buộc chung

- Tuân thủ design tokens ở `src/app/globals.css`; mỗi khu vực chỉ một nút filled
  indigo.
- TypeScript strict, không dùng `any`.
- Nhãn tiếng Việt nằm ở `src/lib/constants.ts` hoặc `src/lib/nav.ts`, không viết
  thẳng vào component.
- Không thêm thư viện mới.
