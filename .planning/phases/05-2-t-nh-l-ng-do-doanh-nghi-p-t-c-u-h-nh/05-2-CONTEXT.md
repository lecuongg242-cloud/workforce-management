# Phase 5.2 (INSERTED): Tính lương do doanh nghiệp tự cấu hình - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning

> **Nguồn gốc:** thu thập trực tiếp trong phiên làm việc ngày 2026-08-06, sau khi Phase 5.1
> đóng lại hai màn hình `comingSoon` của khu quản trị. Chủ dự án yêu cầu kéo phần tính tiền
> lương từ V3 về, nhưng **bỏ thuế TNCN và BHXH/BHYT/BHTN** — thay vào đó mọi khoản cộng/trừ
> là do doanh nghiệp tự khai. Mười quyết định D-36…D-45 do chủ dự án chọn sau khi được trình
> bày phương án và hệ quả từng phương án.

<domain>
## Phase Boundary

Phase này biến TimeFlow từ chỗ **chuẩn bị dữ liệu công** thành chỗ **ra con số tiền lương** —
nhưng là con số theo đúng những gì doanh nghiệp khai, không theo một công thức nào nhúng cứng.

**Trong phạm vi:** ba chế độ tính công do doanh nghiệp chọn; mức lương của từng nhân viên có
phiên bản theo thời gian; danh mục phụ cấp/khấu trừ có phạm vi áp dụng và danh sách loại trừ;
cấu hình phạt đi muộn; phép tính ra tiền cho một kỳ; bảng lương hiển thị và xuất được.

**Ngoài phạm vi:** thuế thu nhập cá nhân (PAY-02); BHXH/BHYT/BHTN (PAY-03); phiếu lương gửi
cho nhân viên (PAY-05 — nhân viên **chưa** xem được lương của mình ở phase này); chuyển khoản
/ tích hợp ngân hàng; quyết toán năm. Bốn thứ đó vẫn ở V3.

**Phụ thuộc:** Phase 4 (mô-đun phân loại công — nguồn duy nhất của giờ tăng ca), Phase 5
(chốt kỳ — bảng lương chỉ đáng tin khi kỳ đã khoá), Phase 5.1 (`month-context.ts` —
`summarizeMonth()` là nguồn của mọi con số công).

</domain>

<decisions>
## Implementation Decisions

### Ba chế độ tính công, doanh nghiệp chọn

- **D-36:** `company_settings` thêm `work_mode` với ba giá trị:
  1. `daily_hours` — **không có ca cụ thể**, một công = N giờ (doanh nghiệp khai, ví dụ 10);
     phần vượt N giờ trong ngày là tăng ca.
  2. `shift` — **có ca cụ thể**, đúng như hệ thống đang chạy từ Phase 4: tăng ca là phần vượt
     độ dài ca theo kế hoạch.
  3. `shift_hourly` — **có ca cụ thể nhưng lương vẫn cộng/trừ theo giờ thực tế**: thiếu giờ so
     với ca thì trừ, thừa thì cộng.

  *Lý do:* ba chế độ này không phải ba biến thể giao diện — chúng là ba định nghĩa khác nhau về
  "một ngày công", và doanh nghiệp thật ở Việt Nam dùng cả ba.
  — **Reversibility:** reversible ở mã; nhưng đổi chế độ giữa chừng làm số liệu hai kỳ không so
  sánh được với nhau, nên chế độ phải được ghi vào **bản chốt lương của kỳ** (xem D-42).

- **D-36a: Hệ quả kỹ thuật bắt buộc.** Chế độ `daily_hours` **xung đột với mô hình dữ liệu hiện
  tại**: `attendance_records.shift_id` là `NOT NULL`, và `classifyDay()` lấy `workingDays` +
  `scheduledMinutes` từ ca. Không có ca thì `scheduledMinutes = 0` và **toàn bộ giờ làm thành
  tăng ca** — sai hoàn toàn. Chế độ này phải được xử lý tường minh trong mô-đun phân loại, không
  phải bằng cách để `shift` rỗng rồi hy vọng.

### Lương khai theo từng nhân viên, và có phiên bản

- **D-37:** Mỗi nhân viên khai **đơn vị** (`month` / `day` / `hour`) và **số tiền** của riêng
  mình. Văn phòng để lương tháng, xưởng để lương giờ — cùng một doanh nghiệp.
  *Lý do:* chủ dự án chọn phương án này thay vì ép một đơn vị cho cả doanh nghiệp; ba chế độ
  tính công của D-36 vốn đã cho phép hai kiểu người trong cùng một nơi.

- **D-37a:** Mức lương là **append-only theo `effective_from`**, nhân lại nguyên khuôn
  `overtime_rules` của Phase 4 (D-25/D-25a), **kèm trigger cưỡng chế ở database**.
  *Lý do:* tăng lương giữa năm mà ghi đè dòng cũ thì bảng lương của tháng trước tính lại ra số
  khác — và không ai phát hiện, vì số liệu chỉ đơn giản là khác đi. Đây đúng là lý do đã dẫn tới
  D-25a; ở đây hậu quả nặng hơn vì nó là tiền.
  — **Reversibility:** costly, giống D-25a.

### Quy đổi giữa các đơn vị cần một mẫu số do doanh nghiệp khai

- **D-38:** `company_settings` thêm `standard_hours_per_day` và `standard_days_per_month`.
  Đây là **mẫu số** để quy đổi: lương tháng → đơn giá ngày → đơn giá giờ.
  *Lý do:* không có mẫu số thì không có cách nào tính tiền tăng ca cho người ăn lương tháng.
  Con số này **không được nhúng cứng** (D-26): 22 hay 26 ngày công chuẩn là chuyện của từng
  doanh nghiệp, và đoán sai thì sai đơn giá giờ của mọi người.
  — **Giới hạn ghi rõ:** hai giá trị này áp cho cả doanh nghiệp, không khai riêng theo người.

### Thiếu giờ ở chế độ không-ca thì trả theo giờ thực tế

- **D-39:** Chế độ `daily_hours`: làm 6 tiếng trong ngày chuẩn 10 tiếng thì **trả 6 giờ**, và
  ngày công ghi nhận là **0,6**. Làm 12 tiếng thì 10 giờ thường + 2 giờ tăng ca.
  *Lý do:* chủ dự án chọn. Hệ quả phải hiểu đúng: ở chế độ này **"ngày công" thành một con số
  thập phân**, không còn là phép đếm ngày — mọi màn hình hiện "ngày công" phải chịu được điều đó.

### Phụ cấp và khấu trừ là một danh mục có phạm vi

- **D-40:** Phụ cấp/khấu trừ là các **khoản** doanh nghiệp tự khai. Mỗi khoản có:
  - **loại**: phụ cấp (cộng) hoặc khấu trừ (trừ);
  - **giá trị**: số tiền cố định, **hoặc** phần trăm của lương ngày;
  - **phạm vi áp dụng**: toàn công ty / theo phòng ban / theo chức vụ / theo nhân viên cụ thể;
  - **danh sách loại trừ**: "toàn công ty **trừ** mấy người".

  *Lý do:* chủ dự án mô tả đúng hình dạng này. Phạm vi + loại trừ là **hai chiều khác nhau**,
  không gộp được: "toàn công ty trừ 3 người" mà phải khai bằng cách liệt kê 37 người thì lần
  tuyển thêm người tiếp theo sẽ sai lặng lẽ.
  — **Reversibility:** reversible.

- **D-40a (chốt 2026-08-06): Mọi khoản áp cho MỌI KỲ LƯƠNG.** Không có khoản "chỉ kỳ này".
  Bảng `pay_adjustments` **không** có cột tháng.
  *Lý do:* chủ dự án chọn. Hệ quả phải ghi rõ: **thưởng tháng, tạm ứng, phạt một lần** chưa
  nhập được ở phase này — muốn cộng/trừ một lần thì phải tạo khoản, chạy kỳ, rồi tắt khoản đó.
  Nếu pilot thấy vướng, thêm một cột tháng vào bảng là đủ, không đổi mô hình.

### Phạt đi muộn là một khoản khấu trừ có điều kiện

- **D-41:** Phạt đi muộn khai dưới dạng **số tiền cố định mỗi lần**, hoặc **phần trăm lương
  ngày** — nhân với số lần đi muộn mà hệ thống đã đếm được.
  *Lý do:* chủ dự án chọn. Vì hình dạng giá trị trùng đúng với D-40 (cố định hoặc % lương ngày),
  phạt đi muộn dùng **cùng một bảng** với khấu trừ, chỉ khác ở chỗ nó nhân với số lần đi muộn
  thay vì áp một lần.
  — **Giới hạn ghi rõ:** phase này chỉ đếm **số lần** đi muộn, không phân bậc theo số phút.
  Doanh nghiệp muốn "muộn 8 phút khác muộn 45 phút" thì chưa làm được.

### Bản chốt lương của một kỳ phải tự chứa

- **D-42:** Khi kỳ được chốt lương, hệ thống lưu lại **bản chốt** gồm: chế độ tính công, mẫu số
  quy đổi, mức lương đã áp cho từng người, từng khoản cộng/trừ, và con số cuối. Không tính lại
  từ cấu hình hiện tại mỗi lần mở màn hình.
  *Lý do:* mọi thứ khác trong TimeFlow đều **tính lúc truy vấn** (D-21, SET-04) — và đó là lựa
  chọn đúng cho số liệu công. Tiền lương thì ngược lại: một khi đã trả cho người lao động, con
  số đó là **một sự kiện đã xảy ra**, không phải một phép tính có thể ra kết quả khác vào tháng
  sau. Đây là ngoại lệ **có chủ đích** thứ hai với khuôn tính-lúc-truy-vấn (ngoại lệ thứ nhất là
  D-32a).
  — **Reversibility:** costly — bỏ bản chốt đi thì không còn cách nào trả lời "tháng 7 đã trả
  bao nhiêu và vì sao".

- **D-42a: Làm tròn.** Mọi số tiền cuối cùng làm tròn **tới đồng**, nửa lên. Các bước trung gian
  giữ nguyên độ chính xác — làm tròn từng bước rồi cộng lại sẽ lệch vài đồng so với cộng rồi làm
  tròn, và kế toán sẽ phát hiện ra.

</decisions>

<constraints>
## Ràng buộc kỹ thuật kế thừa

| Ràng buộc | Nguồn | Hệ quả cho phase này |
|---|---|---|
| Route Handler chỉ `GET`; mọi ghi là Server Action | D-12c | Khai lương, khai khoản, chốt lương đều là Server Action |
| Mọi thao tác ghi để lại một dòng `audit_log` trước/sau | DATA-08 | Sửa mức lương là thao tác nhạy cảm nhất của cả sản phẩm |
| `companyId` luôn từ phiên, không từ tham số | D-12b | Không đường nào nhận `companyId` của client |
| Giờ do server cấp; cấm `new Date()` ở client | D-19/D-19a | "Chốt lương lúc nào" lấy từ database |
| Không con số nghiệp vụ nào nhúng cứng | D-26 + cổng `no-hardcoded-work-rules` | Mẫu số quy đổi, mức phạt, tỉ lệ phụ cấp — tất cả từ cấu hình |
| Giờ tăng ca là nguồn duy nhất từ Phase 4 | D-31, 5.1 | Tiền tăng ca = giờ quy đổi × đơn giá giờ, **không** tính lại giờ |
| Cưỡng chế quy ước bằng trigger, không bằng thoả thuận | D-25a, D-32 | Mức lương append-only phải có trigger |
| Mỗi khu vực một nút filled indigo | CLAUDE.md | Màn hình lương: "Chốt lương kỳ" là nút chính |

## Điểm bắt đầu đã đo được (2026-08-06)

- **Không có một cột lương nào** trong 21 migration lẫn `seed.sql`. Chỉ có
  `employees.can_view_payslip` — một cờ **quyền xem**, không phải dữ liệu lương.
- `formatVnd()` (`src/lib/format.ts`) đã có nhưng **không nơi nào gọi** — mã chết từ V1, phase
  này là chỗ dùng nó lần đầu.
- Tab "Thông tin lương" ở `/admin/employees/[id]` là một `EmptyState` hứa hẹn *"sẽ được thiết
  lập trong giai đoạn tiếp theo"* — đây chính là giai đoạn đó.
- `/admin/payroll` (5.1) đã có bảng tổng hợp công **không tiền**, đọc từ
  `GET /api/payroll/summary`. Phase này thêm cột tiền vào đúng chỗ đó, không dựng màn hình mới.
- `summarizeMonth()` (`month-context.ts`, 5.1) đã trả `workedDays`, `totalMinutes`,
  `overtimeMinutes`, `convertedOvertimeHours`, `leaveDays`, `lateCount` — **sáu con số đầu vào**
  mà phép tính tiền cần, và đã có test khẳng định chúng khớp với màn hình tổng hợp.
- `company_settings` là chỗ sẵn sàng cho `work_mode` + hai mẫu số — thêm cột, không thêm bảng.

</constraints>

<risks>
## Rủi ro của phase

| Rủi ro | Mức | Cách xử lý |
|---|---|---|
| **Ra số tiền sai mà không ai phát hiện** — số liệu công đúng nhưng phép nhân sai, và người lao động là người chịu | rất cao | Mỗi chế độ tính công có test đối chiếu **số tiền** trên database thật, không chỉ test số giờ; bản chốt lương (D-42) giữ lại đầu vào để tái lập được phép tính |
| Sửa mức lương làm đổi bảng lương kỳ đã trả | cao | D-37a: append-only + trigger; D-42: bản chốt tự chứa |
| Chế độ `daily_hours` làm toàn bộ giờ thành tăng ca (D-36a) | cao | Xử lý tường minh trong mô-đun phân loại; test riêng cho từng chế độ với cùng một tập chấm công |
| Phạm vi phụ cấp tính sai người — thêm một nhân viên mới là họ tự nhận phụ cấp không đáng có, hoặc mất phụ cấp đáng có | cao | Phép giải phạm vi là một mô-đun thuần có test riêng; màn hình phải hiện **danh sách người thực sự bị áp** trước khi lưu |
| Làm tròn lệch vài đồng giữa tổng và các dòng | trung bình | D-42a: cộng rồi mới làm tròn; test khẳng định tổng bằng tổng các dòng |
| Người dùng tưởng con số đã gồm thuế và bảo hiểm | trung bình | Nhãn màn hình và tệp xuất nói rõ **chưa gồm** thuế TNCN và bảo hiểm |
| Nhân viên chưa xem được lương của mình → hỏi nhân sự bằng miệng | thấp | Ghi rõ là giới hạn đã biết; PAY-05 vẫn ở V3 |

</risks>

<decisions_late>
## Quyết định chốt sau (2026-08-06, cùng phiên) — ba câu hỏi còn mở đã được trả lời

### Nghỉ không phép tự trừ ở cả ba chế độ

- **D-43 (chốt 2026-08-06):** Ở chế độ `shift`, ngày `leave_unpaid` **tự trừ một ngày công**.
  (Ở `daily_hours` và `shift_hourly` nó vốn đã tự trừ, vì tính theo giờ thực tế.)
  *Lý do:* chủ dự án chọn. Hệ quả: `leave_paid` **được trả**, `leave_unpaid` **không** — hai
  trạng thái nghỉ này từ đây trở đi khác nhau về tiền, không chỉ về nhãn.

### Quyền xem lương giữ nguyên ranh giới khu quản trị

- **D-44 (chốt 2026-08-06):** `owner` **và** `admin` đều xem được bảng lương và khai được mức
  lương — không siết riêng về `owner`.
  *Lý do:* chủ dự án chọn. Giữ đúng `canAccessAdminArea()` đang có (AUTH-03), không thêm một
  chiều phân quyền thứ hai chỉ cho một màn hình.
  — **Giới hạn ghi rõ:** nghĩa là **mọi `admin` xem được lương của mọi người**, kể cả lương của
  nhau. Doanh nghiệp không muốn vậy thì đừng cấp vai trò `admin`.

### Huỷ chốt lương được phép, khác kỳ công

- **D-45:** Có đường **huỷ chốt lương** một kỳ — khác D-32b (kỳ công không mở lại được).
  Nó xoá **cả bản chốt**, không sửa từng dòng, và để lại một dòng `audit_log`.
  *Lý do:* hai thứ này khác bản chất. Kỳ công đã chốt là một tuyên bố về **số liệu quá khứ**;
  bảng lương đã chốt nhưng **chưa trả tiền** thì phát hiện sai là chuyện thường (khai nhầm mức
  lương, quên một khoản phụ cấp). Không có đường lùi sẽ đẩy người dùng sang sửa tay ở database.
  — **Giới hạn ghi rõ:** hệ thống **không biết** tiền đã trả hay chưa, nên không chặn được việc
  huỷ một kỳ đã trả. Bản chốt bị xoá vẫn để lại vết ở `audit_log`.

</decisions_late>

<plan_outline>
## Phân rã đề xuất (6 plan, 5 wave)

**Wave 1**
- **05-2-01** — Tracer: `employee_pay_rates` append-only + trigger, `work_mode` và hai mẫu số
  vào `company_settings`, tab "Thông tin lương" ở hồ sơ nhân viên chạy thật.

**Wave 2** *(blocked on 05-2-01)*
- **05-2-02** — Ba chế độ tính công (D-36/D-36a/D-39): mô-đun phân loại xử lý `daily_hours` và
  `shift_hourly`; test đối chiếu cùng một tập chấm công qua cả ba chế độ.
- **05-2-03** — Danh mục phụ cấp/khấu trừ + phạm vi + loại trừ (D-40/D-40a/D-41); mô-đun thuần
  giải phạm vi; màn hình hiện trước danh sách người bị áp.

**Wave 3** *(blocked on 05-2-02 + 05-2-03)*
- **05-2-04** — Phép tính tiền: lương gốc + tăng ca + phụ cấp − khấu trừ − phạt, làm tròn theo
  D-42a. Test **số tiền** trên database thật cho cả ba chế độ.

**Wave 4** *(blocked on 05-2-04)*
- **05-2-05** — Chốt lương kỳ (D-42): bản chốt tự chứa, audit, và bảng lương đọc từ bản chốt
  khi kỳ đã chốt lương / tính lúc truy vấn khi chưa.

**Wave 5** *(blocked on Wave 4)*
- **05-2-06** — Cổng cuối phase: chặn con số tiền nhúng cứng (có kiểm răng), e2e một kỳ lương
  đầy đủ, nghiệm thu.

</plan_outline>

<notes>
## Ghi chú cho người thực thi

Cùng quy ước với Phase 4/5: không có khối `<execution_context>`, các file plan được đọc và thực
thi trực tiếp; frontmatter `must_haves`, `<tasks>`, `<threat_model>`, `<verification>` và file
SUMMARY khi xong giữ nguyên.

**Hai điều môi trường đã biết, đừng mất thời gian phát hiện lại:**
- `npm run test:db` **không chạy được** ở máy phát triển hiện tại (không có `psql`). Test pgTAP
  là bắt buộc và vào cổng `check:assertions` (sàn hiện tại **250**), nhưng bằng chứng chạy thật
  phải đến từ test tích hợp Vitest trên database dev.
- Migration đẩy bằng `npm run db:push`. Migration **chưa phát hành** thì làm chạy-lại-được
  (`drop … if exists` ở đầu) — khuôn 0018/0021 của Phase 5, đã dùng ba lần và tiết kiệm được ba
  file vá.

**Điều quan trọng nhất của cả phase:** đây là phần duy nhất của sản phẩm mà sai thì ra **tiền
sai**. Mọi plan phải có ít nhất một test đối chiếu **số tiền** trên database thật — test số giờ
đúng không chứng minh được tiền đúng.
</notes>
