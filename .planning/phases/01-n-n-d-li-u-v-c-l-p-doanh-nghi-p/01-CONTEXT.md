# Phase 1: Nền dữ liệu và cô lập doanh nghiệp - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase này dựng nền dữ liệu thật trên Supabase Postgres và **chứng minh bằng test tự
động** rằng hai doanh nghiệp không đọc/ghi được dữ liệu của nhau — trước khi bất kỳ
dòng mã ứng dụng nào phụ thuộc vào nó.

**Trong phạm vi:** schema đầy đủ (thực thể V1 + bảng mới V2), RLS policy trên mọi bảng
thuộc phạm vi doanh nghiệp, bộ test cô lập xuyên tenant, cổng CI chặn bảng thiếu RLS,
quy ước lưu trữ thời gian theo UTC+7 và ca qua đêm, seed dữ liệu hai doanh nghiệp,
xoay khóa Supabase sang mô hình khóa hiện hành.

**Ngoài phạm vi:** không viết Server Action, không sửa `src/lib/mock/service.ts`, không
đụng UI, không làm Supabase Auth. Toàn bộ những thứ đó là Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Môi trường Supabase

- **D-01:** Dùng **một project Supabase duy nhất** (`ujvgagujfsdrlmjdhooi`, hiện đang
  rỗng) cho phát triển và test. Tách project production riêng khi sắp đưa cho doanh
  nghiệp thật đầu tiên, không phải bây giờ.
  — **Reversibility:** reversible — vì D-02 giữ toàn bộ schema dưới dạng migration
  trong repo, dựng project thứ hai chỉ là chạy lại migration + seed, không phải cấu
  hình lại tay từng thứ.

- **D-02:** Schema quản lý bằng **file migration trong repo**: `supabase/migrations/*.sql`,
  áp dụng qua Supabase CLI (đã có sẵn 2.111.0 qua `npx`). Không gõ SQL trực tiếp trên
  dashboard Supabase.
  — **Reversibility:** costly — mọi thứ về sau (cổng CI, dựng lại DB sạch trong CI,
  tách project production) đều dựa vào giả định migration nằm trong git; bỏ quy ước này
  giữa chừng nghĩa là mất lịch sử schema và phải dựng lại từ trạng thái DB hiện tại.

### Kiểm chứng cô lập RLS

- **D-03:** Test cô lập viết bằng **pgTAP**. Máy phát triển **không có Docker** và cũng
  không cài — chạy pgTAP trực tiếp vào project dev qua `psql` với
  `POSTGRES_URL_NON_POOLING`. Không dùng `supabase start`.
  — **Reversibility:** reversible — bộ test pgTAP chạy được trên bất kỳ Postgres nào có
  extension `pgtap`, đổi nơi chạy không phải viết lại test.

- **D-04:** CI dùng **GitHub Actions** (repo đã có remote `lecuongg242-cloud/workforce-management`).
  Mỗi lần chạy, CI tự dựng một Postgres sạch bằng service container, áp toàn bộ
  migration, rồi chạy pgTAP — không phụ thuộc máy của người phát triển và không đụng
  vào project cloud.

- **D-05:** Chuyển sang **làm việc trên nhánh + Pull Request** thay vì push thẳng `main`.
  Đây là điều kiện để yêu cầu "chặn merge" của DATA-04 có nghĩa đen: CI đỏ thì nút merge
  bị khóa. Cần bật branch protection trên GitHub.

### Dữ liệu mẫu

- **D-06:** Port **đầy đủ** bộ seed của V1 (`src/lib/mock/seed.ts`, 1285 dòng) sang
  `supabase/seed.sql`: hai doanh nghiệp Ngọc Phát (28 nhân viên) và Bình Minh (12 nhân
  viên), 9 phòng ban, 7 ca làm việc (mỗi bên có một ca đêm), 8 yêu cầu chờ duyệt, lịch
  sử chấm công cả tháng. Vừa làm fixture cho test cô lập, vừa để Phase 2 có dữ liệu thật
  mà kiểm tra UI.

- **D-07:** Ngày tháng trong seed **trượt theo ngày chạy seed**, không chốt cứng như
  `REFERENCE_DATE = 2026-07-27` của V1. Dữ liệu sinh lùi từ hôm nay để dashboard "7 ngày
  gần đây" và kỳ công đang mở luôn có số, kể cả khi seed lại sau nhiều tháng.

### Quy ước thời gian

- **D-08:** Ca qua đêm tính vào **ngày bắt đầu ca**. Ca 22:00 hôm nay → 06:00 hôm sau
  ghi trọn 8 giờ vào ngày 22:00. Không chia theo số giờ rơi vào mỗi ngày, không tính vào
  ngày kết thúc, và **không** để doanh nghiệp tự cấu hình quy ước này.
  — **Reversibility:** one-way — quy ước này quyết định cột ngày công trong bảng
  `attendance_records` và mọi truy vấn tổng hợp kế thừa nó; đổi về sau đòi migration
  tính lại toàn bộ bản ghi lịch sử và làm lệch mọi báo cáo đã xuất.

- **D-09:** Kỳ công theo **tháng dương lịch** (ngày 1 đến hết tháng). Không dùng chu kỳ
  26→25 mà một số doanh nghiệp Việt áp dụng. Bảng `periods` vẫn lưu ngày đầu và ngày
  cuối tường minh.
  — **Reversibility:** costly — bảng `periods` lưu mốc tường minh nên schema không phải
  đổi, nhưng các kỳ đã chốt sẽ mang mốc cũ và cần xử lý riêng nếu đổi quy tắc.

### Xoay khóa

- **D-10:** **AUTH-06 giữ nguyên trong Phase 1.** Làm cùng lúc với việc dựng project:
  thu hồi cặp khóa legacy HS256 (`anon` / `service_role`), chuyển hẳn sang cặp
  `sb_publishable_` / `sb_secret_`, đưa vào `.env.local` ngoài git. Lý do gộp: cấu hình
  môi trường chỉ phải sửa một lần thay vì hai.

  *Bối cảnh:* chủ dự án đã cân nhắc rủi ro khóa plaintext trong `docs/env` và cho rằng
  chấp nhận được ở giai đoạn này vì chỉ mình họ nắm file. Việc giữ AUTH-06 ở Phase 1 là
  vì tiện gộp cấu hình, không phải vì khẩn cấp.

### Claude's Discretion

Những điểm chủ dự án không ràng buộc, planner và researcher tự quyết:

- Kiểu enum trong Postgres: native enum type hay text + check constraint
- Cách đặt tên bảng và cột (số nhiều/số ít, snake_case) — miễn nhất quán
- Cấu trúc file migration: một file lớn hay tách theo nhóm bảng
- Cách tổ chức bộ test pgTAP thành file
- Hình dạng cụ thể của bảng `memberships` và cách policy join tới nó
- Chi tiết cấu hình workflow GitHub Actions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phạm vi và yêu cầu của phase
- `.planning/ROADMAP.md` §"Phase 1: Nền dữ liệu và cô lập doanh nghiệp" — mục tiêu và
  5 tiêu chí thành công phải đạt
- `.planning/REQUIREMENTS.md` §"Nền tảng dữ liệu (DATA)" và §"Xác thực và phân quyền (AUTH)"
  — nội dung DATA-01, DATA-02, DATA-03, DATA-04, DATA-07, AUTH-06
- `.planning/PROJECT.md` — quyết định kiến trúc đã khóa, ràng buộc, và kết quả đo trạng
  thái project Supabase ngày 2026-07-31

### Nghiên cứu nền tảng
- `.planning/research/SUMMARY.md` — tổng hợp; §"Critical Pitfalls" và §"Phase 1" đặc biệt
  liên quan
- `.planning/research/ARCHITECTURE.md` — kiến trúc RLS multi-tenant, thiết kế schema, thứ
  tự build; nêu rõ **không** dùng session variable Postgres (`SET LOCAL`) vì vỡ khi
  Supabase dùng connection pool
- `.planning/research/PITFALLS.md` — 18 cạm bẫy; nhóm RLS/multi-tenant và nhóm ca đêm /
  múi giờ áp thẳng vào phase này
- `.planning/research/STACK.md` — phiên bản package, mô hình khóa mới của Supabase,
  khuyến nghị pgTAP

### Bản đồ codebase V1
- `.planning/codebase/ARCHITECTURE.md` — kiến trúc hiện tại, tầng `mock/service.ts` là
  cửa duy nhất ra dữ liệu
- `.planning/codebase/CONCERNS.md` — nợ kỹ thuật đã biết; §"Date Calculations Rely on
  String Format" và §"Test Coverage Gaps" liên quan trực tiếp tới DATA-07

### Mã nguồn V1 cần đọc khi thiết kế schema
- `src/lib/types/domain.ts` — toàn bộ kiểu nghiệp vụ; union type ánh xạ thẳng sang cột
  enum Postgres. **Đây là nguồn chuẩn cho schema.**
- `src/lib/mock/seed.ts` — bộ dữ liệu mẫu cần port sang `supabase/seed.sql`
- `src/lib/mock/db.ts` — cách V1 dựng quan hệ giữa các thực thể
- `src/lib/format.ts` — logic ngày giờ hiện tại; CONCERNS.md đánh dấu là mảng dễ vỡ và
  chưa có test nào
- `src/lib/constants.ts` — nhãn tiếng Việt cho enum; **không** đưa vào DB, giữ ở tầng UI

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/lib/types/domain.ts`**: union type của V1 (`EmployeeStatus`, `ContractType`,
  `AttendanceStatus`, `RequestType`, `RequestStatus`, `CompanyRole`) dịch trực tiếp thành
  cột enum Postgres. Không phải thiết kế lại mô hình nghiệp vụ.
- **`src/lib/mock/seed.ts`**: 1285 dòng dữ liệu đã dựng sẵn quan hệ đúng giữa công ty →
  phòng ban → nhân viên → ca → chấm công. Chuyển thành SQL chứ không sinh mới.
- **Hai doanh nghiệp tách biệt hoàn toàn trong seed V1**: Ngọc Phát và Bình Minh vốn được
  tạo ra để kiểm thử multi-tenant — dùng luôn làm bộ đối chiếu cho test cô lập, không cần
  fixture riêng.

### Established Patterns

- **Nhãn tiếng Việt tách khỏi giá trị enum**: `constants.ts` giữ nhãn, `domain.ts` giữ
  giá trị. Schema chỉ chứa giá trị tiếng Anh; DB không bao giờ chứa chuỗi hiển thị.
- **Một cửa ra dữ liệu**: `src/lib/mock/service.ts` là nơi duy nhất chạm dữ liệu. Phase 1
  **không** sửa file này, nhưng schema phải đủ để Phase 2 thay được thân từng hàm mà giữ
  nguyên chữ ký.
- **TypeScript strict, không dùng `any`**: mọi kiểu sinh từ schema phải khớp ràng buộc này.

### Integration Points

- **`supabase/` là thư mục mới** — chưa tồn tại trong repo. Migration, seed và test pgTAP
  nằm ở đây.
- **`.github/workflows/` là thư mục mới** — repo chưa có CI nào.
- **`.env.local`** — repo chưa có file env nào; `docs/env` hiện là nơi giữ khóa và đã nằm
  trong `.gitignore` (dòng 36).
- **Không có test runner nào được cài** — Phase 1 là nơi đầu tiên đưa hạ tầng test vào dự án.

</code_context>

<specifics>
## Specific Ideas

- **"Chứng minh bằng test" phải theo từng bảng, không phải một khẳng định chung.** Tiêu
  chí 2 của phase yêu cầu test báo kết quả cho từng bảng — thiếu policy ở một bảng phải
  chỉ ra được đúng bảng đó.
- **Cổng CI phải bắt được bảng thêm về sau.** Nghiên cứu chỉ ra RLS thường thủng ở bảng
  sinh ra trong các phase sau chứ không phải schema ban đầu. Kiểm tra phải quét toàn bộ
  `public` schema và fail khi có bảng `rowsecurity = false` hoặc bật RLS mà không policy nào.
- **Ca đêm 22:00–06:00 phải ra đúng 8 giờ kể cả khi server chạy ở múi giờ khác** — đây là
  tiêu chí nghiệm thu số 5, không phải chi tiết kỹ thuật phụ.

</specifics>

<deferred>
## Deferred Ideas

- **Tách project Supabase production riêng** — làm khi sắp bàn giao cho doanh nghiệp thật
  đầu tiên (D-01). Nhờ D-02 nên chỉ là chạy lại migration + cấu hình khóa.
- **Chu kỳ kỳ công 26→25** — bảng `periods` lưu mốc tường minh nên hỗ trợ được về sau mà
  không đổi schema; hiện chốt tháng dương lịch (D-09).
- **Cấu hình quy ước ngày công cho ca qua đêm** — cân nhắc và bỏ; chốt cứng "ngày bắt đầu
  ca" (D-08).
- **Cài Docker Desktop** — bỏ ở phase này (D-03); nếu về sau cần chạy toàn bộ stack
  Supabase offline thì xem lại.

</deferred>

---

*Phase: 1-Nền dữ liệu và cô lập doanh nghiệp*
*Context gathered: 2026-07-31*
