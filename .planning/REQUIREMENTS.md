# Requirements: TimeFlow

**Defined:** 2026-07-31
**Core Value:** Doanh nghiệp tin được số liệu chấm công: mỗi bản ghi vào/ra là có thật, đúng nơi, đúng giờ — và không doanh nghiệp nào nhìn thấy dữ liệu của doanh nghiệp khác.

> **Quy ước đặt tên:** mục `v1 Requirements` bên dưới là **phạm vi milestone hiện tại — TimeFlow V2**.
> Mục `v2 Requirements` là phần đã ghi nhận nhưng hoãn sang milestone kế tiếp (TimeFlow V3).

## v1 Requirements

Yêu cầu cho milestone TimeFlow V2. Mỗi mục ánh xạ vào một phase trong roadmap.

### Nền tảng dữ liệu (DATA)

- [ ] **DATA-01**: Schema Postgres trên Supabase phủ đủ các thực thể trong `src/lib/types/domain.ts` (companies, employees, departments, shifts, attendance_records, work_requests) cộng các bảng mới của V2 (memberships, work_sites, attendance_photos, holidays, overtime_rules, audit_log, periods)
- [ ] **DATA-02**: Mọi bảng thuộc phạm vi doanh nghiệp đều bật RLS với policy xác định quyền qua bảng membership, không đọc `company_id` do client gửi lên
- [ ] **DATA-03**: Bộ test tự động chứng minh tài khoản của doanh nghiệp A không đọc/ghi được bất kỳ dòng nào của doanh nghiệp B, chạy trên chính hai bộ dữ liệu Ngọc Phát và Bình Minh
- [ ] **DATA-04**: Kiểm tra tự động chặn merge nếu có bảng mới không bật RLS hoặc bật RLS mà không có policy nào
- [ ] **DATA-05**: Toàn bộ hàm trong `src/lib/mock/service.ts` được thay bằng truy vấn thật với chữ ký hàm giữ nguyên; `mock/db.ts` và `mock/seed.ts` bị xóa
- [ ] **DATA-06**: Mọi thao tác thay đổi dữ liệu ghi lại vào audit log: ai, làm gì, lúc nào, giá trị trước và sau
- [ ] **DATA-07**: Giờ giấc lưu và tính toán nhất quán theo múi giờ Việt Nam (UTC+7); ca qua đêm cắt qua nửa đêm vẫn ra đúng tổng giờ
- [ ] **DATA-08**: Hằng số `REFERENCE_DATE` bị gỡ bỏ, ứng dụng chạy theo thời gian thật mà không lỗi hydration

### Xác thực và phân quyền (AUTH)

- [ ] **AUTH-01**: Người dùng đăng nhập bằng Supabase Auth; phiên lưu ở cookie, không còn localStorage
- [ ] **AUTH-02**: Route được bảo vệ ở `middleware.ts`; khách chưa đăng nhập không chạm được trang quản trị hay app nhân viên
- [ ] **AUTH-03**: Phân quyền bốn vai trò — nhân viên, quản lý, quản trị, super admin — quyết định được xem gì và làm gì
- [ ] **AUTH-04**: Quản trị tạo tài khoản cho nhân viên kèm mật khẩu tạm; nhân viên bắt buộc đổi mật khẩu ở lần đăng nhập đầu
- [ ] **AUTH-05**: Người dùng thuộc nhiều doanh nghiệp chọn được doanh nghiệp làm việc; doanh nghiệp đang chọn lấy từ phiên phía server, không tin giá trị client gửi lên
- [ ] **AUTH-06**: Toàn bộ khóa Supabase trong `docs/env` được thu hồi và cấp lại theo mô hình khóa hiện hành; không khóa bí mật nào lọt xuống client bundle

### Chấm công có bằng chứng (ATT)

- [ ] **ATT-01**: Nhân viên chấm công vào/ra bắt buộc kèm ảnh chụp trực tiếp bằng camera tại thời điểm chấm; không chọn được ảnh có sẵn trong máy
- [ ] **ATT-02**: Nhân viên chấm công bắt buộc kèm toạ độ GPS; hệ thống kiểm tra phía server rằng toạ độ nằm trong bán kính điểm làm việc, client không tự quyết định hợp lệ hay không
- [ ] **ATT-03**: Quản trị khai báo được điểm làm việc: tên, toạ độ, bán kính cho phép
- [ ] **ATT-04**: Quản trị xem lại được ảnh và vị trí của từng bản ghi chấm công
- [ ] **ATT-05**: Ảnh chấm công lưu ở bucket riêng tư; chỉ người có quyền trong cùng doanh nghiệp mở được, qua liên kết ký hạn ngắn
- [ ] **ATT-06**: Dấu thời gian của bản ghi chấm công do server cấp, không lấy từ đồng hồ thiết bị
- [ ] **ATT-07**: Hệ thống đánh dấu bản ghi đáng ngờ khi hai lần chấm liên tiếp cách nhau một quãng đường không thể di chuyển kịp, để quản trị xem lại
- [ ] **ATT-08**: Nhân viên thấy rõ lý do khi chấm công bị từ chối (ngoài bán kính, thiếu ảnh, ngoài ca)

### Cài đặt doanh nghiệp (SET)

- [ ] **SET-01**: Chủ doanh nghiệp cấu hình giờ làm chuẩn và thời gian ân hạn đi muộn cho từng ca
- [ ] **SET-02**: Chủ doanh nghiệp tự khai danh sách ngày nghỉ lễ của doanh nghiệp mình; hệ thống không áp cứng ngày nào
- [ ] **SET-03**: Chủ doanh nghiệp tự khai quy tắc và hệ số tăng ca (ngày thường, ngày nghỉ, ngày lễ, ca đêm); hệ thống không áp cứng hệ số nào
- [ ] **SET-04**: Bản ghi chấm công được phân loại theo đúng quy tắc mà doanh nghiệp đã khai, tại thời điểm phát sinh
- [ ] **SET-05**: Chủ doanh nghiệp đặt trần tăng ca của riêng mình; vượt trần thì cảnh báo khi duyệt, không chặn cứng

### Duyệt yêu cầu (APRV)

- [ ] **APRV-01**: Người có quyền duyệt xem được danh sách yêu cầu chờ xử lý của doanh nghiệp mình
- [ ] **APRV-02**: Người duyệt chấp thuận hoặc từ chối yêu cầu; từ chối bắt buộc nhập lý do
- [ ] **APRV-03**: Yêu cầu được chấp thuận tác động đúng vào dữ liệu công của kỳ (nghỉ phép trừ công, bổ sung công thêm bản ghi, tăng ca ghi nhận giờ)
- [ ] **APRV-04**: Mỗi yêu cầu lưu lịch sử xử lý: ai duyệt, lúc nào, lý do gì
- [ ] **APRV-05**: Nhân viên nhận thông báo trong ứng dụng khi yêu cầu của mình được xử lý

### Chốt kỳ công (PERD)

- [ ] **PERD-01**: Quản trị chốt được kỳ công; kỳ đã chốt hiển thị rõ trạng thái
- [ ] **PERD-02**: Sau khi chốt, mọi thay đổi vào dữ liệu của kỳ đều phải qua một yêu cầu được duyệt và để lại vết trong audit log

### Super admin (SADM)

- [ ] **SADM-01**: Super admin xem được danh sách toàn bộ doanh nghiệp trên hệ thống và tình trạng cơ bản của từng nơi
- [ ] **SADM-02**: Super admin xem sâu được dữ liệu của một doanh nghiệp cụ thể để hỗ trợ khách hàng
- [ ] **SADM-03**: Mọi lần super admin truy cập dữ liệu của một doanh nghiệp đều ghi lại vào audit log
- [ ] **SADM-04**: Quyền ghi của super admin đi qua một đường riêng có kiểm soát, không phải quyền vượt RLS dùng chung

## v2 Requirements

Đã ghi nhận, hoãn sang TimeFlow V3. Không nằm trong roadmap hiện tại.

### Tính lương (PAY)

- **PAY-01**: Tính lương gross-net theo dữ liệu công đã chốt
- **PAY-02**: Thuế thu nhập cá nhân lũy tiến
- **PAY-03**: BHXH / BHYT / BHTN
- **PAY-04**: Phụ cấp, khấu trừ
- **PAY-05**: Phiếu lương cho nhân viên

### Quyền riêng tư nâng cao (PRIV)

- **PRIV-01**: Nhân viên rút lại đồng ý cho việc thu thập vị trí
- **PRIV-02**: Nhân viên tự xuất dữ liệu cá nhân của mình
- **PRIV-03**: Nhật ký ai đã xem ảnh và vị trí của ai

### Vận hành nhiều điểm làm việc (SITE)

- **SITE-01**: Một doanh nghiệp có nhiều điểm làm việc, nhân viên gán theo điểm
- **SITE-02**: Lịch phân ca theo điểm làm việc

## Out of Scope

Loại trừ có chủ đích cho V2.

| Feature | Reason |
|---------|--------|
| Chấm công bằng QR | Nhân viên chụp sẵn mã rồi quét từ nhà — không chứng minh được sự hiện diện |
| Khóa thiết bị (mỗi nhân viên một máy đã đăng ký) | Phát sinh nghiệp vụ đổi máy / mất máy, tăng tải cho nhân sự; ảnh + GPS đã đủ ở quy mô pilot |
| Nhận diện khuôn mặt / liveness detection | Ảnh chấm công là ảnh hiện trường nơi làm việc, không phải ảnh chân dung — không có khuôn mặt để đối chiếu |
| Màn hình xin đồng ý thu thập dữ liệu | Chủ dự án xác định ảnh chụp là ảnh nơi làm việc nên không phải dữ liệu sinh trắc. Ghi chú còn tồn: toạ độ GPS của nhân viên vẫn thuộc dữ liệu cá nhân theo NĐ 13/2023 — theo dõi ở PRIV-01..03 cho V3 |
| Mời thành viên qua email hoặc SMS OTP | Quản trị tạo tài khoản trực tiếp; không phụ thuộc nhà cung cấp email/SMS, không phát sinh chi phí tin nhắn |
| Thanh toán gói SaaS / Stripe billing | Chưa cần khi chỉ triển khai 1-2 doanh nghiệp; thiết kế đã có ở `docs/DESIGN-stripe.md` |
| Máy chấm công phần cứng | Chi phí tích hợp lớn, không cần cho pilot |
| Đa ngôn ngữ | Thị trường mục tiêu là Việt Nam, giữ một locale |
| Mobile app native | Web mobile-first đã phục vụ được nhân viên |
| Duyệt nhiều cấp | Quá mức cần thiết cho doanh nghiệp pilot có cơ cấu phẳng |
| Theo dõi vị trí liên tục | Chỉ lấy toạ độ tại thời điểm chấm công; theo dõi liên tục là xâm phạm quá mức với nhân viên văn phòng |

## Traceability

Phase nào phủ requirement nào. Xem `.planning/ROADMAP.md` để biết mục tiêu và tiêu chí thành công của từng phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 2 | Pending |
| DATA-06 | Phase 2 | Pending |
| DATA-07 | Phase 1 | Pending |
| DATA-08 | Phase 2 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| AUTH-06 | Phase 1 | Pending |
| ATT-01 | Phase 3 | Pending |
| ATT-02 | Phase 3 | Pending |
| ATT-03 | Phase 3 | Pending |
| ATT-04 | Phase 3 | Pending |
| ATT-05 | Phase 3 | Pending |
| ATT-06 | Phase 3 | Pending |
| ATT-07 | Phase 3 | Pending |
| ATT-08 | Phase 3 | Pending |
| SET-01 | Phase 4 | Pending |
| SET-02 | Phase 4 | Pending |
| SET-03 | Phase 4 | Pending |
| SET-04 | Phase 4 | Pending |
| SET-05 | Phase 5 | Pending |
| APRV-01 | Phase 5 | Pending |
| APRV-02 | Phase 5 | Pending |
| APRV-03 | Phase 5 | Pending |
| APRV-04 | Phase 5 | Pending |
| APRV-05 | Phase 5 | Pending |
| PERD-01 | Phase 5 | Pending |
| PERD-02 | Phase 5 | Pending |
| SADM-01 | Phase 6 | Pending |
| SADM-02 | Phase 6 | Pending |
| SADM-03 | Phase 6 | Pending |
| SADM-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 38 total (đếm lại từ danh sách bên trên; con số 36 ghi lúc khởi tạo là sai)
- Mapped to phases: 38
- Unmapped: 0 ✓

Phân bổ theo phase: Phase 1 — 6 · Phase 2 — 8 · Phase 3 — 8 · Phase 4 — 4 · Phase 5 — 8 · Phase 6 — 4

---
*Requirements defined: 2026-07-31*
*Last updated: 2026-07-31 after roadmap traceability mapping*
