# Ảnh chấm công chỉ bắt buộc khi ở xa điểm làm việc

Ngày: 2026-08-10

## Vấn đề

Mọi lần chấm công hiện đều bắt buộc chụp ảnh: `checkIn`/`checkOut` từ chối ngay
với `missing_photo` nếu thiếu ảnh, và khoảng cách chỉ được đo *sau khi* ảnh đã
lên Storage. Nhân viên đứng đúng trong khu vực làm việc vẫn phải qua ba bước
(mở camera → chụp → gửi) cho một việc mà GPS đã trả lời xong.

## Nguyên tắc

> **Cần ảnh ⟺ lần chấm này vượt ngưỡng cho phép của doanh nghiệp.**

Ngưỡng đó đã tồn tại và đã có UI cấu hình, không thêm gì mới:

- `work_sites.radius_meters` — bán kính từng điểm làm việc (`/admin/work-sites`)
- `company_settings.suspicious_distance_multiplier` — "Ngưỡng đáng ngờ (số lần
  bán kính)" (`/admin/settings` → tab Chung)
- `employees.can_check_in_remotely` — miễn hoàn toàn

Hệ quả: mọi bản ghi trong danh sách *"Cần xem lại"* đều có ảnh; bản ghi không có
ảnh là bản ghi hệ thống không có lý do gì để hỏi.

## `requiresPunchPhoto()`

Hàm mới đặt cạnh `isSuspiciousPunch()` trong `src/lib/attendance/suspicious.ts`
(cùng module sở hữu ngưỡng). Dùng chung ngưỡng nhưng **khác một điểm có chủ ý**:

| Tình huống | `isSuspiciousPunch` | `requiresPunchPhoto` |
|---|---|---|
| `canCheckInRemotely` | `false` | `false` |
| Không đo được khoảng cách (chưa khai điểm làm việc) | `false` | **`true`** |
| Trong ngưỡng | `false` | `false` |
| Vượt ngưỡng | `true` | `true` |

Thiếu phép đo không phải bằng chứng của bất thường (nên không kết luận đáng
ngờ), nhưng cũng không phải bằng chứng của bình thường (nên vẫn bắt ảnh).

## Luồng màn nhân viên

1. Bấm "Vào ca"/"Tan ca" → Sheet mở ở trạng thái **"Đang lấy vị trí…"**, camera
   chưa bật.
2. Có toạ độ → gọi Server Action `evaluatePunchLocation({latitude, longitude,
   accuracyMeters})` → `{ requiresPhoto, distanceMeters, workSiteName }`.
3. `requiresPhoto = false` → gửi chấm công ngay, đóng Sheet, toast thành công.
   Camera không bao giờ bật.
4. `requiresPhoto = true` → bật camera kèm dòng *"Bạn cách {điểm} khoảng {x} m —
   cần một ảnh để xác nhận."*
5. Từ chối quyền GPS / hết giờ chờ → giữ nguyên hành vi hiện tại (không có toạ
   độ thì không gửi được). Không có toạ độ nghĩa là không có bằng chứng vị trí
   nào cả, không phải "được miễn".

## Server vẫn quyết định cuối

Client nói "tôi ở gần" không đủ.

- `punchEvidenceSchema`: `photo` thành optional; toạ độ vẫn bắt buộc.
  `undefined`/không có toạ độ vẫn là `missing_photo` như cũ.
- `writePunchEvidence()` tách làm hai: `measurePunchLocation()` (đọc
  `work_sites` + settings, gọi `tf_distance_meters()`, quyết định
  `requiresPhoto`/`isOutsideRadius`) và phần ghi (upload + dòng
  `attendance_photos`).
- `checkIn`/`checkOut` gọi `measurePunchLocation()` **trước khi ghi**
  `attendance_records`. Cần ảnh mà không gửi ảnh → `AttendanceRejectedError
  ("missing_photo")` và **không dòng nào được ghi**.
- Ảnh gửi kèm khi không bắt buộc vẫn được nhận và lưu.

## Database

Migration `0032_optional_attendance_photo.sql`:

```sql
alter table attendance_photos alter column storage_path drop not null;
-- CHECK cũ: storage_path like company_id || '/%'
-- CHECK mới: storage_path is null or storage_path like company_id || '/%'
```

Dòng bằng chứng **vẫn được ghi khi không có ảnh**, để giữ toạ độ, khoảng cách và
điểm gần nhất. Bỏ dòng này thì mọi lần chấm gần mất sạch dấu vết vị trí và màn
quản trị không còn gì đối chiếu.

## Màn quản trị

- `AttendancePhoto` thêm `hasPhoto: boolean` (suy từ `storage_path is not null`;
  đường dẫn Storage vẫn không bao giờ rời server).
- Broker `GET /api/attendance-photos/[id]` trả 404 khi `storage_path` null —
  cùng thông điệp với id không tồn tại.
- `AttendancePhotoDialog`: ô ảnh đổi thành *"Không chụp ảnh — chấm trong khu vực
  cho phép"* thay vì ảnh vỡ. Siêu dữ liệu (toạ độ, khoảng cách, độ chính xác)
  vẫn hiện đầy đủ.

## Kiểm thử

- `suspicious.test.ts` — bảng ca cho `requiresPunchPhoto`: trong bán kính, giữa
  bán kính và ngưỡng, vượt ngưỡng, chưa khai điểm làm việc, `canCheckInRemotely`,
  ngưỡng hỏng (`multiplier <= 0`).
- `attendance-evidence.test.ts` — chấm gần không ảnh: thành công, dòng
  `attendance_photos` có `storage_path` null nhưng đủ toạ độ/khoảng cách; chấm xa
  không ảnh: `missing_photo` **và không dòng `attendance_records` nào được ghi**.
- `camera-sheet.test.tsx` — gần thì `openCamera()` không được gọi; xa thì có.
