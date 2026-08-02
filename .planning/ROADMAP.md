# Roadmap: TimeFlow V2

## Overview

V1 để lại một frontend hoàn chỉnh chạy trên dữ liệu giả. V2 đi từ dưới lên theo từng
lớp: trước hết dựng nền dữ liệu thật trên Supabase và **chứng minh bằng test** rằng hai
doanh nghiệp không nhìn thấy nhau, rồi mới cắt phiên đăng nhập và toàn bộ tầng
`service.ts` sang dữ liệu thật. Có nền vững rồi mới xây phần làm nên giá trị của sản
phẩm — chấm công kèm ảnh hiện trường và toạ độ GPS được kiểm ở phía server. Sau đó để
doanh nghiệp tự khai quy tắc công của mình, đóng vòng nghiệp vụ bằng luồng duyệt yêu cầu
và chốt kỳ, và cuối cùng mở màn hình super admin — làm sau cùng vì đó là chỗ duy nhất
được phép nhìn xuyên doanh nghiệp, chỉ an toàn khi ranh giới đã được kiểm chứng.

Thứ tự này là **xây theo lớp ngang**, không phải cắt lát dọc theo tính năng: giao diện đã
có sẵn từ V1, nên rủi ro lớn nhất nằm ở tính đúng đắn của lớp dữ liệu chứ không ở việc
sớm có màn hình chạy được.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Nền dữ liệu và cô lập doanh nghiệp** - Schema Postgres, RLS trên mọi bảng, test rò rỉ xuyên doanh nghiệp, cổng CI, chặn khóa bí mật lọt client bundle
- [x] **Phase 2: Phiên thật và cắt tầng dữ liệu giả** - Supabase Auth qua cookie, phân quyền bốn vai trò, toàn bộ `service.ts` chạy trên Postgres, xóa mock (completed 2026-08-02)
- [ ] **Phase 3: Chấm công có bằng chứng** - Ảnh hiện trường chụp trực tiếp, GPS kiểm ở server theo bán kính điểm làm việc, màn hình quản trị xem lại
- [ ] **Phase 4: Quy tắc công do doanh nghiệp tự khai** - Trang cài đặt: giờ làm, ân hạn, ngày lễ, hệ số tăng ca; phân loại công theo quy tắc đang hiệu lực
- [ ] **Phase 5: Duyệt yêu cầu và chốt kỳ công** - Duyệt/từ chối có lý do, tác động đúng vào dữ liệu kỳ, lịch sử xử lý, thông báo, chốt kỳ có ghi vết
- [ ] **Phase 6: Super admin và hỗ trợ nhiều doanh nghiệp** - Danh sách toàn hệ thống, tra cứu sâu một doanh nghiệp, đường ghi riêng có kiểm soát

## Phase Details

### Phase 1: Nền dữ liệu và cô lập doanh nghiệp

**Goal**: Dữ liệu TimeFlow nằm trên Postgres thật và ranh giới giữa các doanh nghiệp được chứng minh bằng test tự động, chưa cần một dòng mã ứng dụng nào phụ thuộc vào nó.
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-07, AUTH-06
**Success Criteria** (what must be TRUE):

  1. Hai bộ dữ liệu Ngọc Phát và Bình Minh tồn tại đầy đủ trên Supabase, phủ hết thực thể của `src/lib/types/domain.ts` lẫn các bảng mới của V2 (memberships, work_sites, attendance_photos, holidays, overtime_rules, audit_log, periods).
  2. Chạy bộ test cô lập: tài khoản thuộc Ngọc Phát không đọc và không ghi được bất kỳ dòng nào của Bình Minh, và ngược lại — test báo kết quả theo từng bảng, không phải một khẳng định chung chung.
  3. Thêm một bảng mới mà quên bật RLS, hoặc bật RLS mà không có policy nào, thì CI báo đỏ và chặn merge.
  4. Khóa mới nằm ngoài git và không xuất hiện trong client bundle, chứng minh bằng `npm run check:secrets` chạy trên build thật. *(Vế "thu hồi khóa legacy" đã được gỡ khỏi phạm vi ngày 2026-07-31 theo quyết định của chủ dự án — xem Out of Scope trong REQUIREMENTS.md.)*
  5. Ca đêm 22:00 hôm nay đến 06:00 hôm sau ra đúng 8 giờ công theo giờ Việt Nam, không lệch ngày khi máy chủ chạy ở múi giờ khác.

**Plans:** 6/6 plans executed

Plans:

- [x] 01-01-PLAN.md — Lát cắt xuyên suốt: companies + memberships cô lập được, cổng quét RLS toàn schema, cổng CI trên Postgres sạch
- [x] 01-02-PLAN.md — Enum nghiệp vụ và quy ước thời gian UTC+7 / ca qua đêm tính vào ngày bắt đầu (D-08)
- [x] 01-03-PLAN.md — AUTH-06: thu hồi khóa legacy, chuyển sang mô hình khóa hiện hành, quét khóa lọt client bundle
- [x] 01-04-PLAN.md — Năm bảng thực thể V1 kèm RLS và test cô lập theo từng bảng
- [x] 01-05-PLAN.md — Sáu bảng mới của V2 kèm RLS, test cô lập, và bước đẩy schema đầy đủ
- [x] 01-06-PLAN.md — Port đầy đủ bộ seed hai doanh nghiệp với ngày tháng trượt theo ngày chạy

### Phase 2: Phiên thật và cắt tầng dữ liệu giả

**Goal**: Người dùng đăng nhập bằng tài khoản thật và mọi màn hình V1 đọc/ghi Postgres; `mock/db.ts` biến mất khỏi mã nguồn.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, DATA-05, DATA-06, DATA-08
**Success Criteria** (what must be TRUE):

  1. Người dùng đăng nhập bằng Supabase Auth, phiên nằm ở cookie và sống qua lần đóng/mở trình duyệt; đăng xuất là mất quyền truy cập ngay lập tức.
  2. Khách chưa đăng nhập gõ thẳng URL vào `/admin/*` hay `/employee/*` đều bị chặn ở `middleware.ts` trước khi trang kịp render.
  3. Bốn vai trò (nhân viên / quản lý / quản trị / super admin) chỉ thấy và làm được đúng phần của mình; người thuộc nhiều doanh nghiệp đổi được nơi làm việc và dữ liệu đổi theo, với doanh nghiệp hiện hành lấy từ phiên phía server chứ không từ giá trị client gửi lên.
  4. Quản trị tạo được tài khoản cho nhân viên kèm mật khẩu tạm; nhân viên đăng nhập lần đầu buộc phải đổi mật khẩu mới đi tiếp được.
  5. Mọi màn hình V1 chạy trên dữ liệu Postgres thật theo ngày giờ thật (không còn `REFERENCE_DATE`), `mock/db.ts` và `mock/seed.ts` đã bị xóa, và mỗi thao tác ghi để lại một dòng audit log truy ngược được ai / làm gì / lúc nào / trước / sau.

**Plans:** 11/11 plans complete

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Hạ tầng: hai gói Supabase ghim phiên bản, Vitest (bộ chạy test JS đầu tiên), hợp đồng biến môi trường

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Vai trò nền tảng `platform_admins`, tách fixture khỏi seed, cổng đếm assertion, đẩy schema

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — 10 credential thật qua Admin API, 30 nhân viên không tài khoản, tắt đăng ký công khai

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — Lát cắt xuyên suốt: phiên cookie thật, cổng `middleware.ts`, Route Handler đọc và Server Action ghi đầu tiên

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-05-PLAN.md — Lát cắt phòng ban + đường đọc nhân viên
- [x] 02-06-PLAN.md — Lát cắt ca làm việc (giờ, mảng ngày, cột sinh)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 02-07-PLAN.md — Lát cắt nhân viên: đọc hồ sơ, ba đường ghi, năm màn hình

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 02-08-PLAN.md — Chấm công theo giờ server, bảng điều khiển từ dữ liệu thật, "hôm nay" do server cấp

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 02-09-PLAN.md — Lát cắt yêu cầu và trang chi tiết nhân viên — hai màn hình cuối rời tầng giả lập

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 02-10-PLAN.md — AUTH-04: quản trị tạo tài khoản kèm mật khẩu tạm, cổng buộc đổi mật khẩu lần đầu

**Wave 10** *(blocked on Wave 9 completion)*

- [x] 02-11-PLAN.md — Rule ESLint cưỡng chế quy ước thời gian, xóa tầng dữ liệu giả, nghiệm thu toàn phase

### Phase 3: Chấm công có bằng chứng

**Goal**: Mỗi bản ghi chấm công mang theo bằng chứng kiểm chứng được — ảnh hiện trường chụp tại chỗ, khoảng cách tới điểm làm việc do server đo và ghi lại, giờ do server cấp. *(Sửa 2026-08-02 khi lập kế hoạch — bản gốc viết "toạ độ **nằm trong** bán kính điểm làm việc", câu này còn sót lại từ trước D-20 và mâu thuẫn với chính tiêu chí 1 đã sửa. Theo D-20a phải nói đúng: GPS không còn chặn được ai, nó chỉ còn làm chứng; hệ thống **không** bảo đảm nhân viên có mặt trong bán kính.)*
**Depends on**: Phase 2
**Requirements**: ATT-01, ATT-02, ATT-03, ATT-04, ATT-05, ATT-06, ATT-07, ATT-08
**Success Criteria** (what must be TRUE):

  1. Quản trị khai được điểm làm việc gồm tên, toạ độ và bán kính cho phép; server tự tính khoảng cách và ghi vào bản ghi. Thiếu ảnh hoặc ngoài ca thì server **từ chối** và màn hình nói rõ lý do; ngoài bán kính thì **vẫn nhận** nhưng màn hình cảnh báo kèm khoảng cách thật và bản ghi mang cờ cho quản trị xem lại. *(Sửa 2026-08-02 — xem ghi chú ATT-02 trong REQUIREMENTS.md: GPS trong nhà xưởng sai 20–50m nên chặn cứng làm người đứng đúng chỗ không chấm được.)*
  2. Màn hình chấm công chỉ mở camera chụp trực tiếp, không có đường nào chọn ảnh có sẵn trong máy; thiếu ảnh thì không gửi được.
  3. Dấu thời gian trên bản ghi là giờ server — đổi đồng hồ thiết bị không đổi được giờ đã ghi.
  4. Quản trị mở một bản ghi chấm công bất kỳ xem lại được ảnh và vị trí; ảnh chỉ mở qua một đường đọc tự kiểm doanh nghiệp trên **mỗi lần gọi**, người ở doanh nghiệp khác cầm đúng liên kết vẫn không xem được. *(Sửa 2026-08-02 khi lập kế hoạch — bản gốc viết "chỉ mở qua liên kết ký hạn ngắn". Nghiên cứu phase xác định cơ chế đó **không thoả** chính vế sau của tiêu chí này: một liên kết ký của Supabase Storage, một khi đã phát hành, dùng được cho bất kỳ ai cầm nó tới lúc hết hạn và không tái kiểm quyền lần nào nữa. Vế "cầm đúng liên kết vẫn không xem được" giữ nguyên và là phần bắt buộc; cơ chế đổi thành broker Route Handler.)*
  5. Lần chấm công cách tâm điểm làm việc quá xa (ngưỡng cấu hình được, mặc định 5 lần bán kính) bị đánh dấu đáng ngờ và hiện ra trong danh sách quản trị cần xem lại. *(Sửa 2026-08-02 — xem ghi chú ATT-07: cách đo cũ theo tốc độ di chuyển hầu như không bao giờ kích hoạt, vì chuỗi chấm công luôn là vào → ra nên hai lần liên tiếp cách nhau trọn một ca.)*

**Plans:** 2/7 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Tracer: lát cắt bằng chứng đầu-cuối cho một lần vào ca (migration 0011 + `tf_distance_meters`, bucket riêng tư, broker Route Handler, Camera Sheet, Dialog ảnh của quản trị)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Điểm làm việc: Route Handler đọc, Server Action ghi, màn hình khai báo (ATT-03)
- [ ] 03-03-PLAN.md — Camera đủ nhánh lỗi, nén ảnh, ba lý do từ chối, banner ngoài bán kính (ATT-01, ATT-08)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 03-04-PLAN.md — Tan ca mang bằng chứng, chữ ký chấm công sạch mọi tham số thời gian (ATT-01, ATT-02, ATT-06, ATT-08)
- [ ] 03-05-PLAN.md — Dialog quản trị xem lại đầy đủ: ảnh, toạ độ, khoảng cách kèm độ chính xác (ATT-04, ATT-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 03-06-PLAN.md — Quy tắc đáng ngờ và danh sách cần xem lại (ATT-07)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 03-07-PLAN.md — Cổng cuối phase: cô lập ảnh chứng minh qua HTTP thật, cổng chặn liên kết ký, QA camera/GPS trên thiết bị thật (ATT-01, ATT-05)

**UI hint**: yes

### Phase 4: Quy tắc công do doanh nghiệp tự khai

**Goal**: Doanh nghiệp tự khai giờ làm, ngày lễ và hệ số tăng ca của mình; hệ thống phân loại công theo đúng những gì họ khai, không áp cứng con số nào.
**Depends on**: Phase 3
**Requirements**: SET-01, SET-02, SET-03, SET-04
**Success Criteria** (what must be TRUE):

  1. Trang `/admin/settings` cho chủ doanh nghiệp đặt giờ làm chuẩn và thời gian ân hạn đi muộn cho từng ca; đổi xong thì việc phân loại đi muộn theo ngưỡng mới có hiệu lực ngay.
  2. Chủ doanh nghiệp tự thêm, sửa, xóa ngày nghỉ lễ của riêng doanh nghiệp mình; doanh nghiệp mới khởi tạo không có ngày lễ nào cài sẵn.
  3. Chủ doanh nghiệp tự khai hệ số tăng ca cho ngày thường, ngày nghỉ, ngày lễ và ca đêm; không có hệ số nào nhúng cứng trong mã nguồn.
  4. Bản ghi chấm công được phân loại theo quy tắc đang hiệu lực tại thời điểm phát sinh — sửa quy tắc hôm nay không làm đổi cách phân loại của bản ghi hôm qua.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Duyệt yêu cầu và chốt kỳ công

**Goal**: Yêu cầu của nhân viên được xử lý minh bạch và tác động đúng vào dữ liệu công; kỳ đã chốt không đổi sau lưng ai.
**Depends on**: Phase 4
**Requirements**: APRV-01, APRV-02, APRV-03, APRV-04, APRV-05, SET-05, PERD-01, PERD-02
**Success Criteria** (what must be TRUE):

  1. Người có quyền duyệt thấy danh sách yêu cầu chờ xử lý của đúng doanh nghiệp mình và xử lý ngay tại đó; từ chối thì bắt buộc nhập lý do mới gửi được.
  2. Duyệt một yêu cầu nghỉ phép / bổ sung công / tăng ca xong, số liệu công của kỳ đổi đúng theo loại yêu cầu (trừ công, thêm bản ghi, ghi nhận giờ tăng ca).
  3. Mở lại một yêu cầu đã xử lý thấy đủ lịch sử ai duyệt, lúc nào, lý do gì; nhân viên nhận được thông báo trong ứng dụng ngay khi yêu cầu của mình được xử lý.
  4. Duyệt tăng ca vượt trần mà doanh nghiệp tự đặt thì hiện cảnh báo cho người duyệt, nhưng vẫn cho phép duyệt tiếp — không chặn cứng.
  5. Quản trị chốt được kỳ công và trạng thái đã chốt hiển thị rõ; sau khi chốt, mọi thay đổi vào dữ liệu của kỳ chỉ đi được qua một yêu cầu được duyệt và đều để lại vết trong audit log.

**Plans**: TBD
**UI hint**: yes

### Phase 6: Super admin và hỗ trợ nhiều doanh nghiệp

**Goal**: Đội vận hành TimeFlow nhìn được toàn hệ thống và hỗ trợ được một doanh nghiệp cụ thể mà không phá vỡ ranh giới cô lập đã dựng ở Phase 1.
**Depends on**: Phase 5
**Requirements**: SADM-01, SADM-02, SADM-03, SADM-04
**Success Criteria** (what must be TRUE):

  1. Super admin thấy danh sách toàn bộ doanh nghiệp trên hệ thống kèm tình trạng cơ bản của từng nơi (số nhân viên, hoạt động gần nhất, kỳ đang mở).
  2. Super admin mở sâu vào dữ liệu của một doanh nghiệp để trả lời câu hỏi hỗ trợ, và màn hình luôn hiển thị rõ đang xem doanh nghiệp nào.
  3. Mỗi lần super admin chạm vào dữ liệu của một doanh nghiệp đều có một dòng audit log ghi ai, doanh nghiệp nào, lúc nào.
  4. Quyền ghi của super admin đi qua một đường riêng có kiểm soát, không phải quyền vượt RLS dùng chung; bộ test cô lập của Phase 1 vẫn xanh sau khi super admin có mặt.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Nền dữ liệu và cô lập doanh nghiệp | 6/6 | In Progress|  |
| 2. Phiên thật và cắt tầng dữ liệu giả | 11/11 | Complete    | 2026-08-02 |
| 3. Chấm công có bằng chứng | 2/7 | In Progress|  |
| 4. Quy tắc công do doanh nghiệp tự khai | 0/TBD | Not started | - |
| 5. Duyệt yêu cầu và chốt kỳ công | 0/TBD | Not started | - |
| 6. Super admin và hỗ trợ nhiều doanh nghiệp | 0/TBD | Not started | - |

## Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| DATA-01, DATA-02, DATA-03, DATA-04, DATA-07 | Phase 1 |
| AUTH-06 | Phase 1 |
| AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05 | Phase 2 |
| DATA-05, DATA-06, DATA-08 | Phase 2 |
| ATT-01 … ATT-08 | Phase 3 |
| SET-01, SET-02, SET-03, SET-04 | Phase 4 |
| SET-05 | Phase 5 |
| APRV-01 … APRV-05 | Phase 5 |
| PERD-01, PERD-02 | Phase 5 |
| SADM-01 … SADM-04 | Phase 6 |

**Coverage:** 38/38 v1 requirements mapped, mỗi requirement thuộc đúng một phase.

---
*Roadmap created: 2026-07-31*
