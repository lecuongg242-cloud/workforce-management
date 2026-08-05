# Phase 4: Quy tắc công do doanh nghiệp tự khai - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

> **Nguồn gốc:** thu thập trực tiếp trong phiên làm việc (GSD tooling đã gỡ ngày
> 2026-08-05, không còn `/gsd-discuss-phase`). Ba quyết định D-24, D-25, D-29 do chủ dự án
> chọn sau khi được trình bày phương án và hệ quả từng phương án; các quyết định còn lại là
> hệ quả kỹ thuật bắt buộc, ghi ra để không ai phải suy đoán lại.

<domain>
## Phase Boundary

Phase này làm cho **mọi con số nghiệp vụ của việc phân loại công đều do doanh nghiệp khai**,
không có con số nào nằm trong mã nguồn: giờ làm chuẩn và ân hạn đi muộn của từng ca, danh
sách ngày nghỉ lễ, hệ số tăng ca cho bốn loại ngày. Và bản ghi chấm công được phân loại theo
đúng quy tắc **đang hiệu lực tại thời điểm phát sinh**, nên sửa quy tắc hôm nay không viết
lại lịch sử hôm qua.

**Trong phạm vi:** bảng `company_settings` (mới) và trang `/admin/settings` với bốn tab;
tầng ứng dụng cho hai bảng `holidays` và `overtime_rules` đã tồn tại từ Phase 1 nhưng chưa
có một dòng mã ứng dụng nào chạm tới; phiên bản hoá hệ số tăng ca theo `effective_from`;
mô-đun phân loại công (loại ngày, phút đêm, phút tăng ca, giờ quy đổi) và chỗ hiển thị của
nó trên màn hình chấm công lẫn tổng hợp kỳ; đóng nốt lời hứa D-21a của Phase 3 — hai ngưỡng
còn nhúng trong mã chuyển thành cấu hình doanh nghiệp.

**Ngoài phạm vi:** trần tăng ca và cảnh báo vượt trần (SET-05 — Phase 5, vì nó chỉ có nghĩa
trong luồng duyệt); duyệt yêu cầu và chốt kỳ (Phase 5); màn hình super admin (Phase 6); tính
lương gross-net, thuế, BHXH (V3 — xem PROJECT.md §Out of Scope); xuất file kỳ công cho kế
toán (chưa có requirement nào phủ); cộng dồn hệ số theo đúng luật lao động (xem D-28 —
giới hạn có ý thức của V2).

**Phụ thuộc:** Phase 3. Cụ thể là những thứ đã chạy thật và phase này dùng lại nguyên trạng:
cặp Route Handler đọc / Server Action ghi (D-12c), `getSessionContext()`, `logMutation()`,
khuôn cặp schema Zod hai đầu (D-12d), khuôn Dialog + card của `/admin/work-sites`, và
`src/lib/attendance/suspicious.ts` — nơi hai ngưỡng cuối cùng còn nhúng cứng đang nằm.

</domain>

<decisions>
## Implementation Decisions

### Hệ số tăng ca phải dẫn tới một con số nhìn thấy được

- **D-24:** Hệ số tăng ca không dừng ở chỗ được khai. Mỗi bản ghi chấm công mang **loại
  ngày** (thường / cuối tuần / lễ / đêm) và **số giờ tăng ca quy đổi**; màn hình chấm công
  của quản trị và tổng hợp tháng của nhân viên hiển thị **cả giờ thô lẫn giờ quy đổi**.
  *Lý do:* tính lương nằm ngoài phạm vi V2, nên nếu hệ số chỉ được lưu mà không quy đổi thì
  tiêu chí 3 của phase chỉ được chứng minh gián tiếp và không ai biết mình khai đúng hay
  sai cho tới V3. PROJECT.md đã nói giá trị của V2 là "dữ liệu công đúng" — giờ quy đổi
  chính là dữ liệu đó.
  — **Reversibility:** reversible — phép quy đổi nằm gọn trong một mô-đun thuần, chỗ hiển
  thị là hai màn hình.

### Sửa quy tắc không được viết lại lịch sử

- **D-25:** Hệ số tăng ca **append-only**. Sửa một hệ số nghĩa là **thêm một dòng mới** với
  `effective_from` là ngày bắt đầu có hiệu lực; không bao giờ `UPDATE` hay `DELETE` một dòng
  `overtime_rules` đã tồn tại. Phân loại đọc dòng có `effective_from` lớn nhất mà vẫn nhỏ
  hơn hoặc bằng `work_date` của bản ghi.
  *Lý do:* đây là cơ chế **duy nhất** làm tiêu chí 4 của phase thành sự thật kiểm chứng
  được. Bảng đã có sẵn cột `effective_from` và ràng buộc `unique (company_id, rule_key,
  effective_from)` từ migration 0005 — thiết kế này đã được dự tính từ Phase 1.
  — **Reversibility:** costly — một khi đã có dữ liệu lịch sử nhiều phiên bản, quay về mô
  hình sửa-tại-chỗ nghĩa là mất phiên bản cũ.

- **D-25a: Cưỡng chế ở tầng database, không chỉ ở tầng ứng dụng.** Quy ước append-only được
  ép bằng policy/trigger trên `overtime_rules`, không phải bằng một thoả thuận trong mã
  ứng dụng. Một quy ước chỉ sống trong đầu người viết mã là một quy ước sẽ bị phá lúc vội.

- **D-25b: Ngày lễ là ngoại lệ có kiểm soát.** `holidays` gắn với một ngày lịch cụ thể nên
  không phiên bản hoá được theo cùng cách. Vẫn cho sửa và xoá, **nhưng** nếu ngày đó đã có
  bản ghi chấm công thì hiện cảnh báo kèm **số bản ghi sẽ đổi cách phân loại** và bắt xác
  nhận. Mọi thay đổi ghi audit log.
  *Lý do:* doanh nghiệp khai nhầm một ngày lễ phải tự sửa được — khoá cứng nghĩa là mọi lỗi
  gõ phím đều thành yêu cầu hỗ trợ. Nhưng người bấm phải biết mình đang đổi quá khứ.

### Không con số nghiệp vụ nào nằm trong mã nguồn

- **D-26:** Doanh nghiệp mới **không có** ngày lễ nào và **không có** hệ số nào cài sẵn —
  đúng như migration 0005 đã cố ý để hai bảng rỗng. Khi phân loại không tìm thấy hệ số hiệu
  lực, kết quả quy đổi là `null` kèm nhãn **"chưa khai hệ số"**, tuyệt đối **không** ngầm
  lấy 1.0.
  *Lý do:* một giá trị mặc định ngầm là con số áp cứng đội lốt sự tiện lợi — nó làm màn hình
  trông như đã tính đúng trong khi doanh nghiệp chưa khai gì. Sai lặng lẽ tệ hơn thiếu ồn ào.
  — **Reversibility:** reversible.

- **D-27: Khung giờ đêm là một định nghĩa, không phải một hệ số.** `night_start_time` /
  `night_end_time` nằm trong `company_settings` với mặc định 22:00–06:00 (theo Bộ luật Lao
  động) và **sửa được**. Đây không vi phạm D-26: D-26 cấm áp cứng **giá trị nghiệp vụ doanh
  nghiệp tự quyết** (hệ số, ngày lễ); khung giờ đêm là mốc pháp lý và vẫn để doanh nghiệp
  đổi được.

- **D-28: Mỗi phút thuộc đúng một loại, không cộng dồn hệ số.** Thứ tự ưu tiên: **lễ > cuối
  tuần > đêm > thường**. Một giờ làm đêm ngày lễ tính theo hệ số **lễ**, không nhân chồng
  lễ × đêm.
  *Lý do:* mô hình cộng dồn đúng luật cần cả phụ cấp đêm cộng thêm trên nền ngày lễ, và nó
  chỉ có ý nghĩa khi đi kèm bảng lương thật — thứ đã nằm ngoài phạm vi V2.
  — **Giới hạn ghi rõ, không được giấu:** con số quy đổi của V2 là **số liệu công**, chưa
  phải căn cứ trả lương đúng luật. Màn hình phải nói đúng điều đó bằng chữ, không để người
  dùng tự suy ra. V3 làm bảng lương sẽ phải dựng lại phép cộng dồn.
  — **Reversibility:** reversible — phép cộng dồn thêm vào cùng một mô-đun; nhưng mọi con số
  đã hiển thị trong giai đoạn này mang nghĩa khác với sau đó.
  — **Checkpoint:** quy ước này được xác nhận với chủ dự án ở 04-04 Task 3 **trước khi**
  04-05 hiện thực phép quy đổi.

### Đóng nốt lời hứa của Phase 3

- **D-29:** `SUSPICIOUS_DISTANCE_MULTIPLIER` (mặc định 5 lần bán kính) và
  `SHIFT_WINDOW_GRACE_MINUTES` (mặc định 120 phút) chuyển từ hằng số trong mã sang cột của
  `company_settings`. Hai hằng số vẫn ở lại `src/lib/attendance/suspicious.ts` nhưng đổi vai
  thành **giá trị mặc định khi doanh nghiệp chưa khai**, và mọi nơi dùng chúng phải nhận
  ngưỡng qua tham số.
  *Lý do:* D-21a của Phase 3 đã hứa đúng điều này. Đây cũng là lát cắt tracer tốt nhất của
  phase — nó chứng minh cấu hình **thật sự điều khiển hành vi**, chứ không chỉ là một form
  ghi vào database rồi không ai đọc.
  — **Reversibility:** reversible.

</decisions>

<constraints>
## Ràng buộc kỹ thuật kế thừa

| Ràng buộc | Nguồn | Hệ quả cho phase này |
|---|---|---|
| Route Handler chỉ xuất `dynamic` + `GET`; mọi đường ghi là Server Action | D-12c (02-04) | Bốn nhóm cấu hình đều theo cặp đọc/ghi này; có test `route-handlers-get-only` chặn |
| Cặp schema Zod hai đầu: `*RowSchema` transform snake→camel chỉ ở server, `*Schema` phẳng dùng cả hai đầu | D-12d (02-05, 02-06) | Không dựng khuôn thứ ba cho cấu hình |
| Mọi thao tác ghi để lại một dòng `audit_log` truy ngược được trước/sau | DATA-08 (Phase 2) | Sửa cấu hình là thao tác ghi nhạy cảm nhất của phase — bắt buộc có vết |
| Giờ do server cấp, cấm `new Date()` / `Date.now()` ở tầng view (rule ESLint) | D-19a (02-11) | "Hiệu lực từ ngày nào" lấy từ server, không lấy đồng hồ máy người dùng |
| Ca qua đêm tính trọn vào ngày bắt đầu | D-08 (01-02) | Phút đêm của ca 22:00–06:00 thuộc `work_date` của ngày vào ca |
| Không cột boolean nào lưu cứng kết quả đánh giá; tính tại thời điểm truy vấn | D-21 (03-06) | Loại ngày và giờ quy đổi **tính khi đọc** từ quy tắc hiệu lực, không ghi đè hàng loạt |
| RLS bật trên mọi bảng, policy `<bảng>_<lệnh>_member` điều kiện `tf_is_member(company_id)` | 01-01 | `company_settings` nhân đúng khuôn; cổng `00_rls_coverage.sql` sẽ báo đỏ nếu quên |
| Mỗi khu vực chỉ một nút filled indigo | CLAUDE.md §Constraints | Trang cài đặt bốn tab: mỗi tab đúng một nút chính |

## Điểm bắt đầu đã đo được (2026-08-05)

- `holidays`, `overtime_rules`: bảng + RLS + test cô lập pgTAP **đã có** (`0005_v2_tables.sql`,
  `supabase/tests/04_isolation_v2.sql`). **Chưa có** một dòng nào trong `src/` chạm tới hai
  bảng này — không route, không mutation, không type, không màn hình.
- `shifts.late_tolerance_minutes` **đã có** và **đã được áp** lúc chấm công
  (`src/lib/data/mutations/attendance.ts:458`), sửa được qua `ShiftDialog`. `late_minutes`
  được **tính lúc chấm và lưu vào bản ghi** — nghĩa là tiêu chí 4 của phase đã đúng sẵn cho
  vế đi muộn; việc của phase là **chứng minh** bằng test chứ không phải xây lại.
- `/admin/settings` mới chỉ là một mục nav `comingSoon: true` (`src/lib/nav.ts:43`), chưa có
  route nào.
- Hai hằng số của D-29 nằm ở `src/lib/attendance/suspicious.ts:29` và `:105`, được đọc từ
  `src/app/api/attendance/review/route.ts` và `src/lib/data/mutations/attendance.ts:180`.
- Không có bất kỳ khái niệm "tăng ca" nào ở tầng dữ liệu: `request_type` có giá trị
  `overtime` nhưng chưa có phút tăng ca nào được tính ở đâu.

</constraints>

<risks>
## Rủi ro của phase

| Rủi ro | Mức | Cách xử lý |
|---|---|---|
| Trang cài đặt ghi được nhưng không nơi nào đọc — cấu hình thành trang trí | cao | Lát cắt tracer 04-01 bắt buộc đi hết vòng: đổi ngưỡng ở form → danh sách "Cần xem lại" đổi theo, kiểm bằng tay và ghi vào SUMMARY |
| Quy ước append-only bị phá lúc vội bằng một `UPDATE` tiện tay | cao | D-25a: cưỡng chế bằng trigger ở database, cộng test `throws_ok` chứng minh có răng |
| Doanh nghiệp chưa khai hệ số mà màn hình vẫn hiện một con số quy đổi | cao | D-26: `null` + nhãn "chưa khai hệ số"; acceptance criteria có grep chặn giá trị mặc định 1.0 |
| Sửa ngày lễ quá khứ đổi lặng lẽ cách phân loại của bản ghi cũ | trung bình | D-25b: cảnh báo kèm số bản ghi bị ảnh hưởng, bắt xác nhận, ghi audit |
| Con số quy đổi bị hiểu là căn cứ trả lương đúng luật | trung bình | D-28: chữ trên màn hình nói rõ đây là số liệu công, chưa phải bảng lương |
| Phase phình sang báo cáo / xuất file / trần tăng ca | trung bình | Ranh giới ở §Phase Boundary; SET-05 thuộc Phase 5 |

</risks>

<notes>
## Ghi chú cho người thực thi

GSD tooling đã được gỡ ngày 2026-08-05. Các file plan của phase này **không** có khối
`<execution_context>` trỏ tới `gsd-core` như Phase 1-3 — chúng được đọc và thực thi trực
tiếp. Mọi quy ước khác (frontmatter `must_haves`, `<tasks>`, `<threat_model>`,
`<verification>`, file SUMMARY khi xong) giữ nguyên, vì `.planning/` vẫn là nguồn tham chiếu
duy nhất cho phần việc còn lại (CLAUDE.md §Quy trình làm việc).

Blocker mở còn treo từ Phase 3, **không chặn** việc lập kế hoạch nhưng chặn UAT trên thiết
bị thật: bốn tài khoản fixture pgTAP (`owner1`/`owner2`/`dualmember`/`nomember@timeflow.test`)
đang nằm trong `auth.users` cloud làm `listUsers` trả 500 — xem STATE.md §Blockers mục 03-07.
Cổng cuối phase (04-06) phải kiểm blocker này đã được dọn trước khi chạy UAT.

</notes>
