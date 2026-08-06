# Phase 5: Duyệt yêu cầu và chốt kỳ công - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning

> **Nguồn gốc:** thu thập trực tiếp trong phiên làm việc (GSD tooling đã gỡ 2026-08-05). Bốn
> quyết định D-30, D-31, D-32, D-33 do chủ dự án chọn sau khi được trình bày phương án và hệ
> quả từng phương án.

<domain>
## Phase Boundary

Phase này đóng vòng nghiệp vụ: yêu cầu của nhân viên được **xử lý minh bạch** (ai duyệt, lúc
nào, lý do gì), **tác động đúng** vào dữ liệu công của kỳ, và kỳ đã chốt thì **không đổi sau
lưng ai**.

**Trong phạm vi:** màn hình duyệt của quản trị; duyệt/từ chối kèm lý do bắt buộc; lịch sử xử
lý; tác động của yêu cầu được duyệt lên dữ liệu công (nghỉ phép, bổ sung công, điều chỉnh giờ,
đăng ký tăng ca); trần tăng ca của doanh nghiệp và cảnh báo khi duyệt vượt trần (SET-05); bảng
thông báo trong ứng dụng và chuông trên giao diện nhân viên; chốt kỳ công và cưỡng chế "kỳ đã
chốt chỉ đổi được qua một yêu cầu được duyệt".

**Ngoài phạm vi:** màn hình super admin (Phase 6); duyệt nhiều cấp (một cấp là đủ cho pilot —
xem §Rủi ro); thông báo qua email/SMS/push (chỉ trong ứng dụng, APRV-05 nói đúng vậy); mở lại
một kỳ đã chốt (xem D-32b — chưa có đường nào, có chủ đích); tính lương (V3).

**Phụ thuộc:** Phase 4. Cụ thể là những thứ đã chạy thật và phase này dùng lại nguyên trạng:
`company_settings` + trang `/admin/settings` bốn tab (thêm trần tăng ca vào tab Chung là một
trường mới, không phải một trang mới); mô-đun phân loại công `classification.ts` /
`classification-context.ts` (nguồn duy nhất của giờ tăng ca); khuôn Server Action + `logMutation`;
và tiền lệ **cưỡng chế quy ước bằng trigger** của D-25a.

</domain>

<decisions>
## Implementation Decisions

### Quyền duyệt giữ nguyên ranh giới đang có

- **D-30:** Chỉ `owner`/`admin` duyệt được. `manager` **không** được đưa vào khu `/admin` ở
  phase này.
  *Lý do:* `canAccessAdminArea()` hiện đúng bằng `owner`/`admin` (AUTH-03) và mọi Route Handler
  / Server Action đã dựng trên ranh giới đó. Mở một cửa hẹp cho `manager` nghĩa là thêm một
  chiều phân quyền (theo `department_id`) vào **mọi** truy vấn duyệt, cộng sửa middleware và
  layout — khoảng một plan, cho một nhu cầu chưa có ở quy mô pilot 1-2 doanh nghiệp.
  — **Giới hạn ghi rõ:** doanh nghiệp 40 người thì chủ phải duyệt tất. Nếu pilot thấy nặng,
  đây là việc đầu tiên nên mở ở phase sau.
  — **Reversibility:** reversible — thêm một điều kiện lọc, không đổi mô hình dữ liệu.

### Duyệt tăng ca là cho phép trước, không phải ghi giờ

- **D-31:** Duyệt một yêu cầu tăng ca nghĩa là **cho phép làm thêm**; số giờ tăng ca vẫn do
  **dữ liệu chấm công thật** quyết định (đúng mô-đun của Phase 4). Màn hình đối chiếu hai con
  số: "đăng ký 3h / thực tế 2h30".
  *Lý do:* Phase 4 vừa dựng xong một nguồn sự thật duy nhất cho giờ tăng ca. Cho phép duyệt ghi
  thẳng số giờ là tạo **nguồn thứ hai** cho cùng một con số, và khi hai nguồn lệch thì không ai
  biết tin cái nào.
  — **Giới hạn ghi rõ:** doanh nghiệp không chấm công ngoài giờ sẽ thấy giờ tăng ca bằng 0 dù
  đã duyệt. Với họ, cách đúng là chấm công, không phải khai giờ.
  — **Reversibility:** reversible.

### Kỳ đã chốt được bảo vệ ở tầng database

- **D-32:** Sau khi chốt, mọi ghi vào `attendance_records` của ngày thuộc kỳ đó bị **trigger
  của database** từ chối. Đường ghi hợp lệ duy nhất là hàm `tf_apply_approved_request()` —
  hàm này tự đặt cờ `set_config('tf.applying_approved_request', 'on', true)` trong chính
  transaction của nó, và trigger chỉ cho qua khi thấy cờ đó.
  *Lý do:* PERD-02 là một lời hứa về **tính bất biến của số liệu đã chốt**. Một lời hứa như vậy
  không thể chỉ sống ở tầng ứng dụng: một đường ghi mới quên kiểm là kỳ đã chốt bị sửa lặng lẽ
  — và không ai phát hiện, vì số liệu chỉ đơn giản là khác đi. Đây là cùng lý do đã dẫn tới
  D-25a ở Phase 4.
  — **Reversibility:** costly — gỡ trigger thì mọi bảo đảm biến mất, và không có cách nào biết
  dữ liệu đã bị sửa trong khoảng thời gian nó vắng mặt.

- **D-32a: Hệ quả kiến trúc bắt buộc.** Vì cờ là **transaction-local** và PostgREST chạy mỗi
  RPC trong một transaction riêng, phần **ghi** của một yêu cầu được duyệt phải nằm **bên trong
  hàm SQL**, không phải trong JavaScript. Server Action gọi đúng một RPC; nó không tự chèn từng
  dòng. Đây là ngoại lệ **có chủ đích** đầu tiên với khuôn "logic ở tầng ứng dụng" của dự án, và
  lý do là cờ bảo vệ không tồn tại ngoài transaction.

- **D-32b: Chưa có đường mở lại kỳ đã chốt.** Có chủ đích, không phải bỏ sót. Một nút "mở lại"
  làm rỗng nghĩa của việc chốt; khi pilot thật sự cần, nó phải là một thao tác có tên, có lý do
  bắt buộc và có audit riêng — thiết kế đó chưa được làm ở phase này.

### Lịch sử xử lý là một bảng, không phải ba cột

- **D-33:** Lịch sử xử lý yêu cầu nằm ở bảng `request_reviews` (append-only), không phải ba cột
  `reviewer_id`/`review_note`/`reviewed_at` trên `work_requests`.
  *Lý do:* APRV-04 nói "lịch sử", số nhiều. Ba cột chỉ giữ được **lần xử lý cuối** — duyệt rồi
  đổi ý, hoặc từ chối rồi duyệt lại, thì lần trước biến mất không dấu vết. Ba cột cũ **giữ
  nguyên** làm ảnh chụp trạng thái hiện tại (mọi màn hình đang đọc chúng), nhưng nguồn sự thật
  của lịch sử là bảng mới.
  — **Reversibility:** reversible về mã; dữ liệu lịch sử thì càng để lâu càng đáng giữ.

### Thông báo là dữ liệu, không phải một hiệu ứng giao diện

- **D-34:** Thông báo trong ứng dụng có bảng riêng (`notifications`), RLS chỉ cho chính người
  nhận đọc, sinh một dòng **trong cùng thao tác** xử lý yêu cầu. Giao diện nhân viên có chuông
  kèm số chưa đọc.
  *Lý do:* APRV-05 nói "nhận được thông báo ngay khi yêu cầu của mình được xử lý". Một badge suy
  từ trạng thái yêu cầu chỉ hiện khi nhân viên đã tự vào đúng màn hình — tức là nó thông báo cho
  người đã biết.
  — **Reversibility:** reversible.

### Nghỉ phép sinh bản ghi công theo lịch làm việc

- **D-35:** Duyệt một yêu cầu nghỉ phép sinh bản ghi `attendance_records` cho **từng ngày làm
  việc** trong khoảng — bỏ qua ngày ngoài `working_days` của ca và ngày lễ đã khai. Trạng thái
  `leave_paid` (nghỉ phép) hoặc `leave_unpaid`, `check_in_at`/`check_out_at` đều `null`.
  *Lý do:* sinh cả ngày nghỉ và ngày lễ sẽ đếm chúng thành ngày nghỉ phép, làm nhân viên mất
  phép cho những ngày họ vốn đã được nghỉ. Bản ghi hai cột null là hình dạng mà migration 0013
  đã tính đến tường minh (index `attendance_records_open_punch_uidx` loại chúng ra).

</decisions>

<constraints>
## Ràng buộc kỹ thuật kế thừa

| Ràng buộc | Nguồn | Hệ quả cho phase này |
|---|---|---|
| Route Handler chỉ `GET`; mọi ghi là Server Action | D-12c | Duyệt / từ chối / chốt kỳ đều là Server Action |
| Mọi thao tác ghi để lại một dòng `audit_log` trước/sau | DATA-08 | Duyệt và chốt kỳ là hai thao tác nhạy cảm nhất của phase |
| `companyId` luôn từ phiên, không từ tham số | D-12b | Không đường nào nhận `companyId` của client |
| Giờ do server cấp; cấm `new Date()` ở client | D-19/D-19a | "Đã chốt lúc nào", "duyệt lúc nào" lấy từ database |
| Kỳ công ép tròn tháng dương lịch | D-09 (bảng `periods`) | Chốt kỳ là chốt một tháng, không phải một khoảng tuỳ ý |
| Giờ tăng ca tính lúc truy vấn từ quy tắc hiệu lực | D-21/D-25/D-28a | Trần tăng ca đối chiếu với con số **tính ra**, không lưu thêm cột |
| Cưỡng chế quy ước bằng trigger, không bằng thoả thuận | D-25a | D-32 nhân lại đúng khuôn đó cho kỳ đã chốt |
| Mỗi khu vực một nút filled indigo | CLAUDE.md | Màn hình duyệt: "Duyệt" là nút chính, "Từ chối" là nút phụ |

## Điểm bắt đầu đã đo được (2026-08-06)

- `work_requests`: bảng + RLS + `reviewer_id`/`review_note`/`reviewed_at` **đã có**;
  `createRequest()` và `GET /api/requests` **đã chạy thật** (02-09). **Chưa có** bất kỳ đường
  duyệt nào — không Server Action, không màn hình quản trị.
- **Không có** `/admin/requests`. Quản trị chỉ thấy yêu cầu chờ qua thẻ trên dashboard, và thẻ
  đó trỏ tới `/employee/requests` (một liên kết sai đích cho vai trò quản trị — sửa ở 05-01).
- `periods`: bảng + RLS + ràng buộc tròn tháng **đã có** từ 01-05. **Chưa có** một dòng mã ứng
  dụng nào chạm tới nó.
- **Không có** khái niệm thông báo ở bất kỳ tầng nào.
- `attendance_status` đã có `leave_paid`, `leave_unpaid`, `day_off`; migration 0013 đã tính
  trước hình dạng "dòng nghỉ phép hai cột null".
- `company_settings` (04-01) là chỗ sẵn sàng cho trần tăng ca của SET-05 — thêm một cột, không
  phải một bảng.

</constraints>

<risks>
## Rủi ro của phase

| Rủi ro | Mức | Cách xử lý |
|---|---|---|
| Duyệt xong nhưng dữ liệu công không đổi — cả phase thành một cái nút không làm gì | cao | Tracer 05-01 dừng ở duyệt + lịch sử; 05-02 là plan riêng chỉ làm tác động, với test đối chiếu số liệu trước/sau trên database thật |
| Trigger kỳ đã chốt chặn nhầm cả chấm công bình thường của kỳ đang mở | cao | Trigger chỉ kích hoạt khi ngày thuộc một kỳ có `status='closed'`; test phải phủ cả hai chiều (kỳ mở ghi được, kỳ chốt bị chặn) |
| Cờ bỏ qua trigger rò ra ngoài, thành một cửa hậu dùng chung | cao | Cờ chỉ được đặt **bên trong** `tf_apply_approved_request()`, transaction-local; test khẳng định gọi thẳng `insert` với cùng dữ liệu vẫn bị chặn |
| Duyệt hai lần sinh hai lần tác động (nghỉ phép trừ công đôi) | cao | Trạng thái yêu cầu kiểm ngay trong hàm SQL: chỉ `pending` mới xử lý được; test gọi hai lần liên tiếp |
| Mô hình duyệt một cấp không đủ cho doanh nghiệp pilot | trung bình | Đã ghi từ nghiên cứu milestone; D-30 chấp nhận có ý thức, mở rộng được mà không đổi mô hình dữ liệu |
| Thông báo tích tụ vô hạn | thấp | Chỉ sinh khi yêu cầu được xử lý (vài dòng/người/tháng); không cần vòng đời ở quy mô pilot |

</risks>

<notes>
## Ghi chú cho người thực thi

Cùng quy ước với Phase 4: không có khối `<execution_context>` (GSD tooling đã gỡ), các file
plan được đọc và thực thi trực tiếp; frontmatter `must_haves`, `<tasks>`, `<threat_model>`,
`<verification>` và file SUMMARY khi xong giữ nguyên.

**Hai điều môi trường đã biết, đừng mất thời gian phát hiện lại:**
- `npm run test:db` **không chạy được** ở máy phát triển hiện tại (không có `psql`, database dev
  là Supabase cloud nên bộ chạy từ chối nạp fixture pgTAP). Viết test pgTAP là bắt buộc và
  chúng vào cổng `check:assertions`, nhưng bằng chứng chạy thật phải đến từ **test tích hợp
  Vitest trên database dev** — khuôn đã dùng suốt Phase 4.
- Migration đẩy lên database dev bằng `npm run db:push` (Supabase CLI, không cần `psql`).

**Nợ kỹ thuật của Phase 4 mà phase này nên dọn tiện tay:** `overtime_rules` và một vài doanh
nghiệp test do fixture để lại trên database dev (append-only nên không xoá được). Một lần
`npm run db:seed` dọn sạch — nhưng nó cần `psql`, nên việc này thuộc về người có máy đủ công cụ.

</notes>
