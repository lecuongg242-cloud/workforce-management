# Màn chấm công của nhân viên chỉ còn ô chấm công

**Ngày:** 2026-08-08
**Trạng thái:** Đã duyệt thiết kế

## Vấn đề

Màn hình `/employee` đang xếp bốn khối chồng nhau: thẻ ca làm việc, ô chấm công,
tổng hợp tháng, và ba nút thao tác nhanh. Người dùng mở màn này để làm **một
việc** — bấm vào ca hoặc tan ca — nhưng phải cuộn qua ba khối khác.

Điều tra cho thấy phần lớn những khối đó **không cần chuyển đi đâu cả, chúng đã
có sẵn ở tab khác**:

| Khối | Tình trạng |
|---|---|
| `MonthSummary` | Trùng hoàn toàn — `history-view.tsx` đã hiện, tiêu đề "Tổng hợp tháng" |
| `CurrentShiftCard` | Hồ sơ đã có "Ca mặc định" + "Địa điểm làm việc"; và ô chấm công đã tự nói "Giờ vào ca dự kiến 06:00" |
| Thao tác nhanh → "Lịch làm việc" | Trùng hoàn toàn — thanh điều hướng dưới đã có "Lịch sử" |
| Thao tác nhanh → "Xin nghỉ" / "Bổ sung công" | Tab "Yêu cầu" có, chỉ mất tham số `?type=` chọn sẵn loại |

Nên việc chính là **xoá trùng**, không phải di chuyển.

## Quyết định đã chốt

Màn hình còn đúng hai khối:

1. **Lời chào + ngày hôm nay** — giữ nguyên. Người làm ca đêm dễ nhầm đang chấm
   công cho ngày nào.
2. **Ô chấm công**, thêm một dòng tên ca.

Ba khối còn lại bị xoá khỏi màn hình. Hai nút "Xin nghỉ" / "Bổ sung công" cũng
bỏ — người dùng vào tab "Yêu cầu" rồi tự chọn loại.

## Xoá file hay giữ

- `src/components/employee-app/current-shift-card.tsx` — **xoá hẳn**
- `src/components/employee-app/quick-actions.tsx` — **xoá hẳn**

Cả hai chỉ được dùng ở đúng màn này. Giữ lại một file không ai gọi là để một
người sau này tưởng nó còn sống.

- `src/components/employee-app/month-summary.tsx` — **giữ**, màn Lịch sử đang dùng.

## Dòng tên ca

Đặt ngay dưới nhãn trạng thái, **trước đồng hồ** — câu hỏi nó trả lời là "tôi
đang chấm công cho ca nào", phải đọc được trước khi bấm nút.

`AttendanceStatusCard` đã nhận sẵn prop `shift`; thêm prop `workLocation`.

### Vì sao địa điểm chỉ hiện ở một trạng thái

Ô chấm công **đã có sẵn** một dòng địa điểm ở cuối, nhưng nội dung khác nhau:

- **Đang làm việc / Đã tan ca**: địa điểm **chấm công thật** (`punch.location`).
  Đây là bằng chứng, và nó có thể khác nơi được gán khi người ta đi công tác.
- **Chưa vào ca**: chưa có lượt nào nên không có địa điểm thật; chỗ đó đang là
  câu nhắc về GPS.

Vì vậy dòng trên cùng là:

- `Ca sáng` ở **cả ba** trạng thái
- `Ca sáng · Văn phòng chính` **chỉ ở "Chưa vào ca"** — trạng thái duy nhất
  không có địa điểm thật để hiện

Cách này không bao giờ hiện hai địa điểm cạnh nhau, và không giấu mất địa điểm
chấm thật.

Nhãn **"Ca qua đêm"** giữ nguyên cạnh tên ca: người làm ca đêm cần biết ngày
công tính về hôm nào.

### Chưa được gán ca

`CurrentShiftCard` từng là chỗ duy nhất nói "Bạn chưa được gán ca làm việc".
Sau khi xoá nó, câu đó phải còn — ô chấm công đã có sẵn ở nhánh "chưa vào ca"
(`"Bạn chưa được gán ca làm việc."`), nên dòng tên ca chỉ đơn giản không hiện
khi `shift` là `null`.

## Ngoài phạm vi

- Không đụng logic chấm công, Camera Sheet, hay bằng chứng
- Không đụng màn Lịch sử / Yêu cầu / Hồ sơ
- Không đổi thanh điều hướng dưới

## Kiểm

Không có test tự động cho component trình bày. Kiểm bằng mắt **cả ba trạng
thái**: chưa vào ca, đang làm việc, đã tan ca.
