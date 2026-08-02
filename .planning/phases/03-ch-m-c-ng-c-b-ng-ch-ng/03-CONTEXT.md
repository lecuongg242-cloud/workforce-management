# Phase 3: Chấm công có bằng chứng - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

> **Nguồn gốc:** thu thập trực tiếp trong phiên làm việc, không qua `/gsd-discuss-phase`
> (lệnh đó không chạy lồng được). Bốn quyết định D-20…D-23 do chủ dự án chọn sau khi
> được trình bày phương án và hệ quả từng phương án.

<domain>
## Phase Boundary

Phase này làm cho mỗi bản ghi chấm công **mang theo bằng chứng kiểm chứng được**: ảnh hiện
trường chụp trực tiếp tại chỗ, toạ độ GPS được server đo và ghi lại, giờ do server cấp, và
quản trị xem lại được cả ảnh lẫn vị trí.

**Trong phạm vi:** bảng `work_sites` và màn hình khai báo điểm làm việc; luồng chấm công
bắt buộc camera trực tiếp; đo khoảng cách ở server; bucket Storage riêng tư + liên kết ký
hạn ngắn; màn hình quản trị xem lại ảnh và vị trí; cờ đáng ngờ và danh sách cần xem lại;
thông báo lý do rõ ràng cho nhân viên.

**Ngoài phạm vi:** trang cài đặt doanh nghiệp — giờ làm, ân hạn, ngày lễ, hệ số tăng ca
(Phase 4); duyệt yêu cầu và chốt kỳ (Phase 5); màn hình super admin (Phase 6); quyền riêng
tư nâng cao — rút lại đồng ý, tự xuất dữ liệu, nhật ký ai xem ảnh của ai (nhóm PRIV, V3).

**Phụ thuộc:** Phase 2. Tầng dữ liệu (`src/lib/data/*`), điểm kiểm danh tính
`getSessionContext()`, cặp Route Handler đọc / Server Action ghi, và helper audit đều đã có
và đã chạy thật.

</domain>

<decisions>
## Implementation Decisions

### Ngoài bán kính: ghi nhận, không chặn

- **D-20:** Ngoài bán kính **không phải lý do từ chối**. Server vẫn nhận bản ghi, tính và
  lưu khoảng cách thật, gắn cờ để quản trị xem lại. Màn hình nhân viên hiện cảnh báo kèm
  khoảng cách, không hiện lỗi.
  *Lý do:* GPS trong nhà xưởng sai 20–50m, có khi hơn. Chặn cứng nghĩa là người đứng đúng
  chỗ vẫn không chấm công được và không có đường nào đi tiếp.
  — **Reversibility:** costly — cột và cờ vẫn giữ nguyên nếu sau này siết lại thành chặn
  cứng, nhưng mọi bản ghi đã tạo trong giai đoạn "cho qua" sẽ mang ý nghĩa khác với bản ghi
  sau đó, và không có cách phân biệt ngoài mốc thời gian.

- **D-20a: Hệ quả bắt buộc ghi rõ, không được quên.** "Trong bán kính" từ **điều kiện bắt
  buộc** trở thành **ghi chú**. GPS không còn chặn được ai — nó chỉ còn làm chứng. Người đọc
  `ROADMAP.md` sau này không được hiểu nhầm rằng hệ thống bảo đảm nhân viên có mặt tại chỗ.
  Đã sửa `ROADMAP.md` tiêu chí 1 và `REQUIREMENTS.md` ATT-02/ATT-08 cho khớp — nếu không,
  Phase 3 sẽ được viết để cố tình không đạt tiêu chí của chính nó.

- **D-20b:** Lý do **từ chối** còn đúng ba: thiếu ảnh, ngoài ca, mất mạng. Ba lý do này
  server quyết, client chỉ hiển thị.

### Đáng ngờ đo theo khoảng cách tới điểm làm việc

- **D-21:** Gắn cờ đáng ngờ khi lần chấm công **cách tâm `work_site` quá xa** — ngưỡng cấu
  hình được, mặc định **5 lần bán kính**. Không dùng phép tính tốc độ di chuyển.
  *Lý do:* chuỗi chấm công của TimeFlow luôn là vào → ra, nên hai lần liên tiếp cách nhau
  trọn một ca 8 tiếng — thừa thời gian đi bất cứ đâu trong Việt Nam. Luật theo tốc độ mà
  `ROADMAP.md` ghi ban đầu **hầu như không bao giờ kích hoạt**, và một luật không bao giờ
  chạy thì tệ hơn không có luật vì nó tạo cảm giác an toàn giả.
  — **Reversibility:** reversible — ngưỡng là cấu hình, cách đo nằm gọn trong một hàm.

- **D-21a:** Ngưỡng **không được nhúng cứng**. Doanh nghiệp có chi nhánh xa nhau cần nới.
  Hằng số mặc định đặt ở một chỗ, đọc được từ cấu hình doanh nghiệp khi Phase 4 dựng trang
  cài đặt.

- **D-21b: Vì sao lớp này quan trọng hơn vẻ ngoài của nó.** Ảnh hiện trường và GPS chứng
  minh *"một thiết bị đã ở đúng nơi"*, **không** chứng minh *"đúng người"* — ảnh là ảnh nhà
  xưởng, không có mặt người để đối chiếu (`PROJECT.md` §Key Decisions). Kiểu gian lận dễ
  nhất còn lại là nhờ đồng nghiệp chấm hộ, và ATT-07 là lớp duy nhất bắt được nó. Sau D-20,
  đây là **lớp phát hiện chính**, không còn là lớp phụ.

### Ảnh giữ vĩnh viễn

- **D-22:** Ảnh chấm công **không tự xoá**. Không dựng job dọn theo lịch ở phase này.
  *Lý do:* ở quy mô pilot (40 người, ~1.700 ảnh/tháng) dung lượng không đáng kể, và gắn vòng
  đời ảnh vào việc chốt kỳ sẽ tạo phụ thuộc ngược vào Phase 5 chưa tồn tại.
  — **Reversibility:** reversible về mặt kỹ thuật (thêm job xoá lúc nào cũng được), nhưng
  **không thu hồi được về mặt dữ liệu**: ảnh đã tích tụ thì đã tích tụ.

- **D-22a: Ghi nhận rủi ro có ý thức.** Ảnh hiện trường kèm toạ độ GPS của nhân viên là dữ
  liệu cá nhân theo NĐ 13/2023. Giữ vĩnh viễn nghĩa là tích tụ không thời hạn. Nhóm PRIV đã
  nằm ngoài phạm vi V2 nên đây **không phải việc phải làm bây giờ** — ghi lại để nó không
  thành bất ngờ khi có khách hàng thật. Cộng hưởng với D-18a của Phase 2: `audit_log` lưu
  nguyên dòng nên từ phase này nó thành bản sao thứ hai của cùng dữ liệu đó.

### Mất mạng: báo lỗi, không xếp hàng

- **D-23:** **Không có hàng đợi offline.** Mất mạng lúc bấm thì báo lỗi và bắt bấm lại.
  *Lý do:* giờ do server cấp là tiêu chí 3 của phase. Một bản ghi nằm chờ trong máy rồi gửi
  sau sẽ mang giờ **gửi** chứ không phải giờ **bấm** — phá vỡ đúng cái bằng chứng phase này
  đang xây. Mọi cách chữa đều làm yếu ATT-06.
  Nhân viên ở chỗ mất sóng dùng đường yêu cầu bổ sung công (đã có từ Phase 2).
  — **Reversibility:** reversible — thêm hàng đợi về sau được, nhưng lúc đó phải trả lời
  câu "ghi giờ nào", và câu trả lời nào cũng làm yếu ATT-06.

### Claude's Discretion

- Hình dạng bảng `work_sites` và cách gắn nhân viên vào điểm làm việc
- Cách tính khoảng cách (haversine trong SQL hay trong TypeScript) — miễn ở **server**
- Tên bucket Storage, cấu trúc thư mục, thời hạn liên kết ký
- Định dạng và mức nén ảnh trước khi tải lên
- Cách tổ chức màn hình quản trị xem lại ảnh + vị trí
- Cách hiển thị bản đồ (hoặc không hiển thị bản đồ) trên màn hình nhân viên
- Bố cục danh sách "cần xem lại"

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phạm vi và yêu cầu
- `.planning/ROADMAP.md` §"Phase 3" — **đã sửa 2026-08-02**, tiêu chí 1 và 5 khác bản gốc
- `.planning/REQUIREMENTS.md` §"Chấm công có bằng chứng (ATT)" — ATT-02, ATT-07, ATT-08 đều
  mang ghi chú sửa phạm vi; đọc cả ghi chú, không chỉ đọc dòng yêu cầu
- `.planning/PROJECT.md` §Key Decisions — đặc biệt dòng "ảnh là ảnh hiện trường, không phải
  selfie" và hệ quả "chứng minh đúng nơi, không chứng minh đúng người"

### Nền tảng Phase 2 đã dựng (đọc trước khi thiết kế)
- `.planning/phases/02-*/02-CONTEXT.md` — D-12a…e (hai transport, GET-only, điểm kiểm danh
  tính duy nhất), D-17/D-18 (audit ở tầng server, lưu nguyên dòng), D-19 (giờ do server cấp)
- `src/lib/auth/session-context.ts` — `getSessionContext()`, `requireRole()`
- `src/lib/data/mutations/attendance.ts` — `checkIn`/`checkOut` hiện tại, chỗ Phase 3 gắn ảnh
  và toạ độ vào
- `src/lib/data/audit.ts` — `logMutation`, khuôn ghi audit
- `src/lib/today.ts` — `getServerToday()`, quy ước "hôm nay do server cấp"
- `supabase/migrations/0003_enums_time.sql` — `tf_tz`, `tf_work_date`, `tf_overnight`
- `supabase/migrations/0005_v2_tables.sql` — bảng `work_sites` và `attendance_photos` **đã
  tồn tại** từ Phase 1; Phase 3 dùng chứ không tạo mới
- `scripts/e2e-auth.mjs` — khuôn kiểm chứng qua HTTP thật với cookie phiên thật

### Nghiên cứu
- `.planning/research/PITFALLS.md` — nhóm GPS/ảnh/Storage
- `.planning/research/SUMMARY.md` §"Gaps to Address" — hai khoảng trống đã nêu đích danh cho
  phase này: **độ phủ thiết bị cho `getUserMedia()`** và **độ chính xác GPS tại văn phòng
  thật**. D-20 chính là câu trả lời cho khoảng trống thứ hai.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Bảng `work_sites` và `attendance_photos` đã có sẵn** trong `0005_v2_tables.sql` từ
  Phase 1 kèm RLS và test cô lập. Phase 3 dùng, không dựng lại.
- **Khuôn lát cắt đã lặp sáu lần** ở Phase 2 (companies, departments, shifts, employees,
  attendance, requests): Route Handler GET-only + Server Action ghi + `logMutation`. Lát cắt
  điểm làm việc lặp đúng khuôn đó.
- **`scripts/e2e-auth.mjs`** — mở rộng được để kiểm luồng chấm công qua HTTP thật.
- **`npm run check:assertions`** — sàn 191 assertion; test pgTAP mới của phase này phải đẩy
  số này lên, không được làm tụt.

### Established Patterns
- Route Handler **chỉ `GET`** (D-12c), có cổng cơ học repo-wide kiểm; ảnh tải lên phải đi
  qua Server Action hoặc signed upload URL, **không** thêm POST route.
- `company_id` lấy từ phiên, không bao giờ từ tham số (D-12b).
- Mọi thao tác ghi để lại một dòng `audit_log` với before/after nguyên dòng (D-17/D-18).
- Không `new Date()` trong client component ở lần vẽ đầu — có rule ESLint cưỡng chế (D-19a).

### Integration Points
- `src/app/employee/` — màn hình chấm công hiện tại, nơi gắn camera và GPS
- `src/app/admin/` — thêm màn hình khai báo điểm làm việc và màn hình xem lại
- Supabase Storage — **chưa dùng bao giờ**; đây là lần đầu dự án chạm tới nó
- `src/components/employee-app/attendance-status-card.tsx` — có đồng hồ chạy sau khi mount,
  đã được miễn trừ rule D-19a có ghi lý do; đừng vô tình gỡ miễn trừ đó

</code_context>

<specifics>
## Specific Ideas

- **Camera phải là camera, không phải trình chọn tệp.** ATT-01 nói rõ "không chọn được ảnh
  có sẵn trong máy". `<input type="file" accept="image/*" capture>` **không đủ** — trên
  nhiều trình duyệt nó vẫn cho chọn thư viện. Phải dùng `getUserMedia()`.
- **Liên kết ảnh phải ký hạn ngắn và kiểm quyền theo doanh nghiệp.** Tiêu chí 4 đòi: người
  ở doanh nghiệp khác **cầm đúng liên kết vẫn không xem được**. Bucket phải riêng tư; URL ký
  không được là đường vòng qua RLS.
- **Ba lý do từ chối phải phân biệt được ở giao diện**, không gộp thành "có lỗi xảy ra".
  Nhân viên bị từ chối mà không biết vì sao thì sẽ bấm lại mãi.

</specifics>

<deferred>
## Deferred Ideas

- **Xoá ảnh theo lịch / theo vòng đời kỳ công** — D-22 chốt giữ vĩnh viễn ở phase này.
- **Quyền riêng tư nâng cao** — rút lại đồng ý thu thập vị trí, tự xuất dữ liệu cá nhân,
  nhật ký ai đã xem ảnh của ai: nhóm PRIV, V3. Xem D-22a.
- **Hàng đợi chấm công offline** — cân nhắc và bỏ (D-23); xem lại nếu có khách hàng thật ở
  nơi mất sóng thường xuyên, và khi đó phải trả lời trước câu "ghi giờ nào".
- **Nhiều điểm làm việc cho một doanh nghiệp, gán nhân viên theo điểm** — nhóm SITE, V3.
- **Ngưỡng đáng ngờ cấu hình từ giao diện** — Phase 4 dựng trang cài đặt; Phase 3 chỉ cần
  hằng số đọc được từ một chỗ (D-21a).

</deferred>

---

*Phase: 3-Chấm công có bằng chứng*
*Context gathered: 2026-08-02*
