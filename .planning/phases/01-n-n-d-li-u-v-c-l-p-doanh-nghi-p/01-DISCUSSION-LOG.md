# Phase 1: Nền dữ liệu và cô lập doanh nghiệp - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 1-Nền dữ liệu và cô lập doanh nghiệp
**Areas discussed:** Môi trường Supabase, Cách chạy test RLS, Dữ liệu mẫu Ngọc Phát / Bình Minh, Ngày công của ca qua đêm

---

## Môi trường Supabase

| Option | Description | Selected |
|--------|-------------|----------|
| Hai project tách biệt | Project hiện tại làm dev/test, tạo project thứ hai cho pilot thật ở Phase 2-3. Dữ liệu khách không nằm chung nơi test chạy | |
| Một project duy nhất | Rẻ và ít việc hơn; test cô lập phải thêm/xóa dữ liệu ngay trên DB có dữ liệu thật | |
| Một project, tách khi có khách thật | Bắt đầu bằng một cho đỡ việc, tách khi sắp đưa cho doanh nghiệp đầu tiên | ✓ |

**User's choice:** Một project, tách khi có khách thật
**Notes:** Rủi ro "lúc tách phải làm lại toàn bộ cấu hình" mà tôi nêu trong mô tả lựa
chọn này phần lớn bị vô hiệu bởi quyết định migration ngay sau đó — dựng project thứ hai
chỉ còn là chạy lại migration + seed.

---

## Migration SQL

| Option | Description | Selected |
|--------|-------------|----------|
| File trong repo qua Supabase CLI | `supabase/migrations/*.sql` trong git, áp bằng CLI; lịch sử schema truy ngược được, CI kiểm tra được | ✓ |
| Gõ SQL trên dashboard Supabase | Nhanh lúc đầu; không có lịch sử thay đổi, không dựng lại được project thứ hai giống hệt | |

**User's choice:** File trong repo qua Supabase CLI
**Notes:** Supabase CLI 2.111.0 đã dùng được qua `npx`, không phải cài thêm.

---

## Cách chạy test RLS

| Option | Description | Selected |
|--------|-------------|----------|
| pgTAP trên cloud + Postgres trong CI | Local chạy pgTAP thẳng vào project dev qua psql; CI tự dựng Postgres sạch mỗi lần. Không cần Docker trên máy | ✓ |
| Cài Docker Desktop, chạy stack local | `supabase start` dựng đủ Postgres + Auth + Storage; nhanh nhất, offline được, đổi lại tốn 2-4GB RAM | |
| Test qua client app (Vitest, không pgTAP) | Hai supabase-js client thuộc hai doanh nghiệp, assert đọc/ghi chéo bị chặn; đi đúng đường app thật đi nhưng khó chỉ đích danh bảng thiếu policy | |

**User's choice:** pgTAP trên cloud + Postgres trong CI
**Notes:** Bối cảnh kỹ thuật đã kiểm tra trước khi hỏi — `docker` không có trên máy, nên
`supabase start` không chạy được nếu không cài thêm.

---

## Quy trình code

| Option | Description | Selected |
|--------|-------------|----------|
| Push thẳng vào main | Đúng hiện trạng repo; cổng CI chỉ báo đỏ sau khi push, không chặn được | |
| Chuyển sang nhánh + PR | Mỗi phase làm trên nhánh riêng, mở PR vào main; CI đỏ thì nút merge bị khóa | ✓ |

**User's choice:** Chuyển sang nhánh + PR
**Notes:** Đây là điều kiện để yêu cầu "chặn merge" của DATA-04 có nghĩa đen thay vì chỉ
là một cảnh báo hậu kiểm.

---

## Dữ liệu mẫu Ngọc Phát / Bình Minh

| Option | Description | Selected |
|--------|-------------|----------|
| Đầy đủ như V1 | 40 nhân viên, 9 phòng ban, 7 ca, 8 yêu cầu chờ duyệt, lịch sử cả tháng → `supabase/seed.sql` | ✓ |
| Tối thiểu cho test | Mỗi doanh nghiệp 2-3 nhân viên, đủ chứng minh cô lập; Phase 2 phải tự dựng thêm dữ liệu | |
| Viết fixture mới hoàn toàn | Bỏ seed V1, thiết kế bộ dữ liệu mới theo schema V2 | |

**User's choice:** Đầy đủ như V1
**Notes:** Giữ được công đã bỏ ra cho 1285 dòng seed của V1 và giữ điểm đối chiếu với
hành vi V1 khi Phase 2 cắt tầng dữ liệu.

---

## Ngày tháng trong seed

| Option | Description | Selected |
|--------|-------------|----------|
| Trượt theo ngày chạy seed | Sinh dữ liệu lùi từ hôm nay; dashboard 7 ngày luôn có số dù seed lại sau nửa năm | ✓ |
| Cố định như V1 | Mọi lần seed ra số y hệt, test so sánh dễ viết; vài tháng nữa dashboard trống trơn | |
| Trượt, nhưng chốt được bằng tham số | Mặc định trượt; test cần số cố định thì truyền ngày mốc vào | |

**User's choice:** Trượt theo ngày chạy seed
**Notes:** Ăn khớp với DATA-08 — gỡ bỏ hằng số `REFERENCE_DATE = 2026-07-27` của V1.

---

## Ngày công của ca qua đêm

| Option | Description | Selected |
|--------|-------------|----------|
| Ngày bắt đầu ca | Trọn 8 giờ tính vào ngày 22:00; bảng công khớp với lịch phân ca | ✓ |
| Ngày kết thúc ca | Tính vào ngày 06:00; dễ gây hiểu nhầm khi đối chiếu lịch phân ca | |
| Chia theo số giờ mỗi ngày | 2 giờ ngày đầu, 6 giờ ngày sau; chính xác về thời gian thực nhưng bảng công khó đọc | |
| Để doanh nghiệp tự cấu hình | Linh hoạt nhất; Phase 1 phải thiết kế schema cho cả ba cách | |

**User's choice:** Ngày bắt đầu ca
**Notes:** Đây là quyết định một chiều — nó quyết định cột ngày công và mọi truy vấn
tổng hợp kế thừa nó.

---

## Kỳ công

| Option | Description | Selected |
|--------|-------------|----------|
| Tháng dương lịch | Kỳ = ngày 1 đến hết tháng; khớp cách V1 đang hiển thị, không cần thêm cấu hình | ✓ |
| Doanh nghiệp tự đặt mốc | Ví dụ 26 tháng trước → 25 tháng này, kiểu nhiều doanh nghiệp Việt dùng | |
| Chưa quyết, để schema mở | Bảng `periods` lưu ngày đầu/cuối tường minh, quyết cách sinh kỳ ở Phase 5 | |

**User's choice:** Tháng dương lịch
**Notes:** Bảng `periods` vẫn lưu mốc tường minh, nên chu kỳ 26→25 vẫn hỗ trợ được sau
này mà không phải đổi schema.

---

## AUTH-06 (thu hồi & cấp lại khóa Supabase)

Vùng này không nằm trong danh sách ban đầu — nó nổi lên trong lúc thảo luận vì mâu thuẫn
giữa yêu cầu AUTH-06 trong roadmap và phát biểu trước đó của chủ dự án rằng khóa hiện tại
chấp nhận được.

| Option | Description | Selected |
|--------|-------------|----------|
| Chuyển sang Phase 2 | Phase 1 chỉ làm schema/RLS/test; xoay khóa khi bắt đầu có phiên đăng nhập thật | |
| Giữ ở Phase 1 | Làm luôn cùng lúc dựng project: xoay khóa, chuyển sang cặp sb_publishable/sb_secret | ✓ |
| Hoãn tới trước khi có khách thật | Gắn với việc tách project production | |

**User's choice:** Giữ ở Phase 1
**Notes:** Lý do là gộp cho gọn — cấu hình môi trường chỉ phải sửa một lần thay vì hai —
chứ không phải vì đánh giá rủi ro đã đổi.

---

## Claude's Discretion

Chủ dự án không ràng buộc những điểm sau, planner và researcher tự quyết:

- Kiểu enum trong Postgres: native enum type hay text + check constraint
- Quy ước đặt tên bảng và cột
- Cấu trúc file migration
- Cách tổ chức bộ test pgTAP thành file
- Hình dạng bảng `memberships` và cách policy join tới nó
- Chi tiết cấu hình workflow GitHub Actions

Ngoài ra, cổng CI dùng GitHub Actions là quyết định tôi tự chốt sau khi xác nhận repo có
remote GitHub — không đưa ra hỏi vì không có lựa chọn thay thế hợp lý.

## Deferred Ideas

- Tách project Supabase production riêng — khi sắp bàn giao cho doanh nghiệp thật đầu tiên
- Chu kỳ kỳ công 26→25 — schema đã hỗ trợ sẵn, quyết định sau nếu khách cần
- Cấu hình quy ước ngày công cho ca qua đêm — cân nhắc và bỏ
- Cài Docker Desktop — bỏ ở phase này, xem lại nếu cần chạy stack Supabase offline
