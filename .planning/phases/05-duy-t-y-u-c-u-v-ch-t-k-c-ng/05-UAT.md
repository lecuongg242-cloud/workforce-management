# Phase 5 — Biên bản nghiệm thu

**Ngày:** 2026-08-06
**Cách nghiệm thu:** năm tiêu chí được kiểm bằng **quan sát trên hệ thống chạy thật** — test
tích hợp chạy trên database dev thật (không mock) và một kịch bản e2e đi hết vòng đời qua HTTP
thật với hai phiên đăng nhập thật (`npm run test:e2e-approval`, server dev trên cổng 3008).

> **Điều biên bản này KHÔNG nhận là đã làm:** chưa có ai mở trình duyệt bấm tay qua
> `/admin/requests`, `/admin/periods` và `/employee/notifications`. Mọi khẳng định dưới đây là
> quan sát của **máy** trên hệ thống chạy thật, không phải quan sát của **mắt người**. Ba màn
> hình mới đó đáng một lượt bấm tay trước khi có khách hàng thật — đặc biệt là hộp xác nhận
> chốt kỳ, vì đó là thao tác duy nhất của cả sản phẩm **không hoàn tác được**.
>
> Kịch bản e2e cũng **không** chứng minh đường ghi của tầng ứng dụng: mọi thao tác ghi là
> Server Action (D-12c) và một script ngoài không gọi được. Các bước ghi của nó gọi thẳng
> RPC/lệnh mà Server Action gọi, đánh dấu `[mo phong ghi]`. Bản thân `reviewRequest()` /
> `closePeriod()` / `markNotificationsRead()` được phủ bởi test tích hợp chạy trên database
> thật.

---

## Tiêu chí 1 — Danh sách chờ đúng doanh nghiệp; từ chối bắt buộc nhập lý do

**Quan sát** (`e2e-approval.mjs` bước 3 qua HTTP thật + `request-review.test.ts` 7/7):

| Bước | Quan sát cụ thể |
|---|---|
| `GET /api/requests?status=pending` bằng cookie quản trị thật | **200**, yêu cầu vừa gửi có mặt |
| Ngữ cảnh người gửi trên mỗi dòng | `employeeName = "Nhan vien e2e"`, `departmentName = "Phong Kinh doanh"` |
| Từ chối với `note = "   "` (chỉ khoảng trắng) | ném lỗi *"Từ chối yêu cầu phải kèm lý do…"*, và **dòng vẫn `pending`**, **0 dòng lịch sử** — tức là bị chặn **trước khi chạm database** |
| Từ chối không truyền `note` | cùng kết quả |
| `requestId` của doanh nghiệp khác | *"Không tìm thấy yêu cầu."*, dòng đó `status` vẫn `pending`, `reviewer_id` vẫn `null` |
| Vai trò `employee` và `manager` gọi thẳng Server Action | `ForbiddenError` cả hai, dòng không đổi |

Ba lớp cưỡng chế "từ chối phải có lý do", không phải một: form (`zodResolver`), Server Action
(`reviewRequestInputSchema`), và ràng buộc `CHECK` của migration 0017 — pgTAP khẳng định cả
`note IS NULL` lẫn `note` toàn khoảng trắng đều bị database từ chối.

**Đạt.**

---

## Tiêu chí 2 — Duyệt xong số liệu kỳ đổi đúng theo loại yêu cầu

**Quan sát** (`request-effect.test.ts` 8/8 trên database thật + `e2e-approval.mjs` bước 4–5):

| Loại yêu cầu | Trước | Sau | Ghi chú |
|---|---|---|---|
| **Nghỉ phép** 03/10 → 06/10 (4 ngày lịch, 2 ngày cuối tuần) | `leaveDays = 0` | `leaveDays = 2` | Xem trước nói **2**, kết quả **2** — hai con số khớp |
| Nghỉ phép chồng ngày **đã có chấm công thật** | `worked_minutes = 600` | `worked_minutes = 600`, vẫn **đúng một dòng** | Ngày đó vào `skippedDates`, không dòng nào chồng lên |
| **Bổ sung công** 08:00–16:00 | `totalMinutes = X` | `X + 480`, `workedDays + 1` | Bản ghi mang note `"Bổ sung công theo yêu cầu <id>"` |
| **Điều chỉnh giờ** 09:00 → 08:30–18:00 | 1 dòng, 480 phút, `late_minutes = 0` | **cùng `id`**, 570 phút, `late_minutes = 30`, `late` | Sửa, không tạo mới |
| **Tăng ca** | `convertedOvertimeHours = 3` | `convertedOvertimeHours = 3` | **0 bản ghi** được tạo (D-31) |
| **Từ chối** | — | mọi trường của `summary` **y hệt**, `applied_at` vẫn `null` | Từ chối không chạm dữ liệu công |

Áp dụng lần thứ hai cho cùng yêu cầu: database từ chối (*"đã được áp dụng… sẽ tính công hai
lần"*), số bản ghi không đổi.

**Đạt.**

---

## Tiêu chí 3 — Lịch sử xử lý đầy đủ; nhân viên nhận thông báo trong ứng dụng

**Quan sát** (`e2e-approval.mjs` bước 5–6 + `notifications.test.ts` 7/7):

- `GET /api/requests/<id>/reviews` sau khi duyệt: **đúng 1 dòng**, `decision = "approved"`, mang
  người duyệt và thời điểm.
- Lịch sử **không sửa và không xoá được**, kể cả bằng khoá `service_role`: `UPDATE` trả lỗi
  chứa *"append-only"*, `DELETE` trả lỗi, và nội dung dòng vẫn nguyên văn.
- `GET /api/notifications` bằng cookie **của chính nhân viên**: **1 thông báo**,
  `unreadCount = 1`, `readAt = null`, `requestId` trỏ đúng yêu cầu.
- Nội dung đủ hiểu mà không phải bấm vào: *"Đăng ký tăng ca (13/06/2016) đã được duyệt."*; khi
  từ chối thì kèm *"Lý do: Trùng lịch kiểm kê cuối quý."*
- `GET /api/notifications` bằng cookie **quản trị** (cùng doanh nghiệp): **0 dòng**. Ranh giới
  là con người, không phải doanh nghiệp.
- Nhân viên **chưa có tài khoản** (`user_id` null): **0 thông báo**, và thao tác duyệt **vẫn
  thành công**.
- Đánh dấu đã đọc thông báo của người khác: **0 dòng bị tác động**, dòng đó `read_at` vẫn `null`.

**Đạt.**

---

## Tiêu chí 4 — Duyệt vượt trần hiện cảnh báo nhưng vẫn cho duyệt tiếp

**Quan sát** (`overtime-cap.test.ts` thuần 11/11 + tích hợp 5/5 trên database thật):

| Tình huống | `capHours` | Kết quả |
|---|---|---|
| Doanh nghiệp chưa khai trần | `null` | `isOver = false` — **không cảnh báo nào**, không hộp nào hiện ra |
| Đã dùng 18h, yêu cầu thêm 4h, trần 20h | `20` | `isOver = true`, `overHours = 2` — hộp hiện đủ **bốn** con số |
| Đã dùng 36h, yêu cầu thêm 4h, trần 40h | `40` | `isOver = false` — bằng đúng trần **không phải** là vượt |
| Đổi trần 20 → 8 → xoá | 20 / 8 / `null` | `capHours` đổi theo từng lần; `usedHours` **không đổi** ở cả ba lần |

Giờ đã dùng tách làm hai đại lượng thật: `actualHours = 4` (từ chấm công qua mô-đun Phase 4) và
`registeredHours = 5` (hai yêu cầu tăng ca đã duyệt) → `usedHours = 9`. Không cột nào lưu sẵn
con số này.

**Không có nhánh chặn:** `grep -nE "throw|Forbidden|block" src/lib/attendance/overtime-cap.ts`
trả **không dòng nào**; `grep -niE "không thể duyệt|bị chặn|không cho phép"` trên hộp thoại và
`constants.ts` cũng **không dòng nào**. Nút duyệt chỉ đổi **chữ** thành "Vẫn duyệt (vượt trần)",
không đổi `disabled`. Mỗi lần bấm tiếp khi đã vượt trần ghi thêm một ghi chú vào lịch sử xử lý
(bảng append-only), nên sáu tháng sau vẫn biết quyết định đó được đưa ra khi cảnh báo đang hiện.

**Đạt.**

---

## Tiêu chí 5 — Chốt kỳ hiển thị rõ; sau khi chốt chỉ đổi được qua yêu cầu được duyệt, đều có vết

**Quan sát** (`e2e-approval.mjs` bước 7–10 qua HTTP thật + `period-close.test.ts` 8/8):

| Bước | Quan sát cụ thể |
|---|---|
| Chốt kỳ 10/2014 | `status = "closed"`, `closed_by` = đúng người chốt, `closed_at` từ đồng hồ database |
| `GET /api/periods` bằng cookie quản trị | kỳ đó hiện `status: "closed"` |
| Chốt kỳ **chưa kết thúc** (tháng hiện tại) | từ chối: *"Kỳ công tháng … chưa kết thúc (còn đến hết ngày …)"* |
| Chốt **lần hai** | từ chối: *"…đã được chốt trước đó rồi."* |
| `insert` thẳng vào ngày thuộc kỳ | **bị chặn**, thông điệp chứa *"đã chốt"* |
| `update` / `delete` dòng cũ của kỳ | **bị chặn** cả hai, dòng cũ nguyên vẹn (`worked_minutes` không đổi) |
| **Duyệt một yêu cầu bổ sung công** cho ngày trong kỳ đã chốt | **thành công**, `inserted_count = 1` |
| **Ngay sau đó**, `insert` thẳng lại | **vẫn bị chặn** — cờ không rò ra ngoài transaction (D-32a) |
| Kỳ tháng khác (chưa chốt) | ghi bình thường, trigger không chặn nhầm |

Ba khẳng định **chặn → cho qua → chặn lại** nằm liền nhau là bằng chứng chính của PERD-02.
Cả ba đều chạy bằng khoá `service_role` (bỏ qua RLS) — khoá đó **không** bỏ qua trigger.

Mọi thay đổi vào kỳ đã chốt để lại vết: dòng `audit_log` của lần duyệt mang cả quyết định lẫn
hệ quả (*"tạo 1 bản ghi công"*), và lần chốt kỳ để lại một dòng riêng
(`entity_table = "periods"`, `reason = "Chốt kỳ công tháng 2015-04"`).

**Đạt.**

---

## Cổng tự động còn sống sau phase

| Cổng | Chạy trong | Điều nó giữ |
|---|---|---|
| `no-silent-period-write` | `npm test` | Không file mutation nào ngoài `attendance.ts` được ghi thẳng vào `attendance_records`; phần ghi của đường duyệt phải nằm trong `tf_apply_approved_request()` |
| `check:assertions` | thủ công / CI | Sàn 250 assertion pgTAP, chỉ được nâng |
| `route-handlers-get-only` | `npm test` | Route Handler chỉ `GET` (D-12c) |
| `no-hardcoded-work-rules` | `npm test` | Không con số nghiệp vụ nào nhúng cứng (Phase 4) |

Cổng mới đã được **chứng minh có răng** bằng một lần phá hoại có kiểm soát: thêm
`from("attendance_records").insert(...)` vào `mutations/requests.ts` → **đỏ 2 test**; hoàn tác →
**xanh 9/9**; không còn dấu vết nào của dòng đó trong mã.

---

## Hai lỗi thật mà kịch bản e2e bắt được

Cả hai đều không lỗi typecheck, không lỗi lint, không test nào khác bắt được:

1. **`GET /api/requests` trả `employeeName`/`departmentName` là `null` hàng loạt.** Embed
   `departments(name)` từ `employees` **nhập nhằng** — giữa hai bảng có hai quan hệ
   (`employees.department_id` và `departments.manager_id`) nên PostgREST từ chối cả truy vấn.
   Lỗi im lặng vì hai trường đó khai `.default(null)` và màn hình lùi về hiện `employeeId`.
   Sửa: gọi tên khoá ngoại tường minh + không nuốt lỗi của truy vấn thứ hai.
2. **Một kỳ đã chốt cũ hơn 12 tháng biến mất khỏi `/admin/periods`.** Cửa sổ 12 tháng của đường
   đọc lọc mất chính dòng kỳ. Sửa: danh sách tháng = 12 tháng gần đây **hợp với** mọi tháng đã
   có dòng kỳ — một kỳ đã chốt phải luôn nhìn thấy được.

---

## Giới hạn đã biết của phase (viết ra để người sau không tự vấp phải)

1. **Duyệt một cấp, chỉ `owner`/`admin`** (D-30). `manager` **không** duyệt được và không vào
   được khu `/admin`. Doanh nghiệp 40 người thì chủ phải duyệt tất. Nếu pilot thấy nặng, đây là
   việc đầu tiên nên mở ở phase sau — thêm một chiều lọc theo `department_id`, không đổi mô
   hình dữ liệu.
2. **Không có đường mở lại kỳ đã chốt** (D-32b), có chủ đích. Khi pilot thật sự cần, nó phải là
   một thao tác có tên riêng, lý do bắt buộc và audit riêng. Màn hình nói rõ điều này trong hộp
   xác nhận thay vì để người dùng đi tìm một nút không tồn tại.
3. **Duyệt tăng ca không ghi giờ** (D-31). Doanh nghiệp không chấm công ngoài giờ sẽ thấy giờ
   tăng ca **bằng 0** dù đã duyệt. Với họ, cách đúng là chấm công, không phải khai giờ.
4. **Chưa ai bấm tay trên trình duyệt.** Ba màn hình mới (`/admin/requests`, `/admin/periods`,
   `/employee/notifications`) chỉ được chứng minh qua HTTP và qua database, chưa qua mắt người.
5. **`npm run test:db` vẫn chưa chạy được** ở máy phát triển hiện tại (không có `psql`; đã kiểm
   lại trong phiên này). Bốn file pgTAP mới của phase — `12_request_reviews.sql` (8),
   `13_apply_approved_request.sql` (13), `14_notifications.sql` (6), `15_period_close.sql` (11),
   tổng **38 assertion** — đã viết, đã vào cổng `check:assertions`, nhưng **chưa chạy thật lần
   nào**. Toàn bộ hành vi chúng khẳng định đã được phủ độc lập bằng test tích hợp Vitest trên
   database thật; nhưng chính chúng thì cần Postgres tạm của CI.
6. **Dữ liệu test còn sót trên database dev.** Mỗi lần chạy bộ test tích hợp để lại vài doanh
   nghiệp `cty-05xx-<ngẫu nhiên>` không xoá được (cascade xuống `overtime_rules` và
   `request_reviews` bị trigger append-only chặn). Một lần `npm run db:seed` dọn sạch —
   `truncate ... cascade` không bị trigger chặn — nhưng nó cần `psql`.

---

## Chữ ký

| Vai trò | Trạng thái |
|---|---|
| Máy (test tích hợp + e2e trên hệ thống chạy thật) | **Xong** — 420 test xanh, e2e 20/20 khẳng định xanh |
| Chủ dự án (bấm tay qua ba màn hình mới) | **Chưa** — xem giới hạn 4 |
