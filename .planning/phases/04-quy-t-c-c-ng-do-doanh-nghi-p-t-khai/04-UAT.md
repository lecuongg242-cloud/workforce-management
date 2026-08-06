# Phase 4 — Biên bản nghiệm thu

**Ngày:** 2026-08-06
**Cách nghiệm thu:** bốn tiêu chí được kiểm bằng **quan sát trên hệ thống chạy thật** — test
tích hợp chạy trên database dev thật (không mock) và một kịch bản e2e đi qua HTTP thật với
phiên đăng nhập thật (`npm run test:e2e-settings`, server dev trên cổng 3007).

> **Điều biên bản này KHÔNG nhận là đã làm:** chưa có ai mở trình duyệt bấm tay qua bốn tab.
> Mọi khẳng định dưới đây là quan sát của máy trên hệ thống chạy thật, không phải quan sát
> của mắt người. Với các màn hình mới (`/admin/settings`), một lượt bấm tay vẫn đáng làm
> trước khi có khách hàng thật.

---

## Tiêu chí 1 — Đặt giờ làm chuẩn và ân hạn đi muộn cho từng ca; đổi xong có hiệu lực ngay

**Quan sát** (`shift-rules-effect.test.ts`, 5/5 xanh trên database dev thật):

| Bước | Quan sát cụ thể |
|---|---|
| Ca có ân hạn 30 phút, nhân viên A vào ca muộn 20 phút | `late_minutes = 0`, trạng thái `on_time` |
| Siết ân hạn xuống 5 phút qua `updateShift()` | không có bước "áp dụng" nào ở giữa |
| Nhân viên B vào ca muộn 20 phút **ngay sau đó** | `late_minutes = 15`, trạng thái `late` |

Tab "Ca làm việc" của `/admin/settings` dùng lại **đúng** `ShiftDialog` và **đúng** Server
Action `updateShift()` của `/admin/shifts` — số nơi ghi bảng `shifts` trong `mutations/` giữ
nguyên 8, không có đường ghi thứ hai.

**Đạt.**

---

## Tiêu chí 2 — Doanh nghiệp tự thêm/sửa/xoá ngày lễ; doanh nghiệp mới không có ngày lễ nào

**Quan sát** (`holidays-mutations.test.ts` 7/7 + `e2e-settings.mjs` bước 2-3):

- Doanh nghiệp vừa tạo: `select count(*) from holidays` trả **0**; `GET /api/holidays?year=2017`
  trả **mảng rỗng với mã 200**, không phải lỗi.
- `createHoliday` ghi đúng doanh nghiệp của phiên, để lại **1 dòng audit**.
- Trùng ngày → thông điệp tiếng Việt ("Ngày … đã được khai là ngày nghỉ lễ của doanh nghiệp"),
  không phải lỗi Postgres thô.
- `id` ngày lễ của doanh nghiệp khác truyền vào `updateHoliday`/`deleteHoliday` → **"Không tìm
  thấy ngày nghỉ lễ"** và dòng đó **vẫn còn nguyên** trong database (không im lặng thành công).
- Vai trò `manager` bị từ chối ở **cả ba** đường ghi lẫn ở phép đếm.
- Thao tác trên ngày quá khứ đã có bản ghi: audit mang `reason` chứa **"2 bản ghi chấm công"** —
  đúng bằng số đếm được bằng SQL.

**Đạt.**

---

## Tiêu chí 3 — Doanh nghiệp tự khai hệ số tăng ca; không hệ số nào nhúng cứng

**Quan sát** (`overtime-rules.test.ts` 11/11 + `no-hardcoded-work-rules.test.ts` + e2e bước 3):

- Doanh nghiệp trắng: `GET /api/overtime-rules` trả **đủ bốn loại ngày**, cả bốn
  `currentMultiplier = null`, `versions = []`.
- Không hệ số nào tồn tại ở bất kỳ tầng nào trước khi doanh nghiệp khai — cổng tự động quét
  `src/`, `supabase/seed.sql`, `supabase/migrations/` và **xanh**.
- `UPDATE`/`DELETE` trên `overtime_rules` bị **database** từ chối (trigger `overtime_rules_append_only`),
  thông điệp chứa "append-only".
- Khai phiên bản mới **không xoá** phiên bản cũ; lịch sử đọc được từ giao diện.
- Vai trò `employee` bị từ chối ở đường ghi.

**Đạt.**

---

## Tiêu chí 4 — Phân loại theo quy tắc đang hiệu lực tại thời điểm phát sinh

Đây là tiêu chí trung tâm của phase; nó được kiểm ở **ba tầng độc lập**:

| Tầng | Quan sát |
|---|---|
| SQL | `tf_overtime_multiplier('holiday', '2019-03-01')` = 2 và `('holiday', '2019-08-01')` = 3 — cùng một khoá, hai ngày, hai hệ số |
| Route Handler | Một phản hồi chứa ngày 02/05 (hệ số cũ → **3 giờ**) và ngày 13/05 (hệ số mới → **4 giờ**) |
| HTTP thật (e2e) | Khai hệ số 1.5 → ngày công quy đổi **3 giờ**; khai thêm phiên bản 3.0 hiệu lực từ tháng sau → đọc lại ngày cũ **vẫn 3 giờ** |

Cộng thêm: `attendance_records` **không có** cột nào lưu phân loại (`day_type`, `night_minutes`,
`overtime_minutes`, `converted_overtime_hours`) — mọi thứ tính lúc truy vấn.

**Đạt.**

---

## Giới hạn đã biết — viết ra để không ai phải tự vấp phải

1. **Mô hình cộng dồn chỉ có hai lớp** (D-28a). Điều 98.3 Bộ luật Lao động còn một lớp thứ ba
   (tăng ca ban đêm được cộng thêm 20% tiền lương ban ngày của chính ngày đó). V2 **không** làm
   lớp này — nó cần một `rule_key` thứ năm và một migration. Con số quy đổi của V2 là **số liệu
   công**, chưa phải căn cứ trả lương; câu này hiện trên màn hình từ một hằng số dùng chung.
2. **Ngày lễ quá khứ vẫn sửa/xoá được** — có cảnh báo kèm số bản ghi bị ảnh hưởng và có audit,
   nhưng không bị chặn cứng. Chặn theo kỳ đã chốt thuộc Phase 5 (PERD-02).
3. **Hệ số hiệu lực lùi quá khứ vẫn khai được** — có cảnh báo trước khi ghi và có audit. Cùng
   lý do như trên.
4. **`npm run test:db` chưa chạy được trong môi trường phát triển hiện tại**: máy không có
   `psql` và database dev là Supabase cloud (bộ chạy từ chối nạp fixture pgTAP lên cloud). Hai
   file test mới (`10_company_settings.sql`, `11_overtime_rules_append_only.sql`, tổng 13
   assertion) **đã viết và đã vào cổng đếm** nhưng **chưa chạy thật lần nào** — cần chạy trên
   Postgres tạm của CI. Bù lại, các khẳng định quan trọng nhất của chúng (cô lập
   `company_settings`, trigger append-only có răng) **đã được kiểm trên database thật** qua test
   tích hợp Vitest.
5. **Fixture của test tích hợp để lại dòng trên database dev**: `overtime_rules` là append-only
   nên các dòng test không xoá được. Chúng thuộc `cty-02` (2019/2099) và các doanh nghiệp test
   mang id ngẫu nhiên. Một lần `npm run db:seed` sẽ dọn sạch (truncate không bị trigger chặn).
6. **Chưa có ai bấm tay qua giao diện.** Xem ghi chú ở đầu biên bản.

---

## Blocker của Phase 3 đã được dọn

Blocker 03-07 (bốn tài khoản fixture pgTAP nằm trong `auth.users` cloud làm `listUsers` trả 500)
**không còn**: `admin.auth.admin.listUsers()` trả 200 và không còn tài khoản nào trong
`owner1|owner2|dualmember|nomember@timeflow.test`. Nhờ vậy `e2e-settings.mjs` tạo và xoá được
tài khoản thật qua Admin API.

---

## Cổng tự động còn sống sau phase

| Cổng | Nội dung |
|---|---|
| `npm test` → `no-hardcoded-work-rules.test.ts` | Chặn hệ số nhúng cứng, đọc thẳng hai ngưỡng Phase 3, hệ số mặc định ngầm, ngày lễ cài sẵn trong seed/migration |
| `npm run check:assertions` | Sàn 212 assertion pgTAP, chỉ được nâng |
| `npm run test:e2e-settings` | Đường đi của một doanh nghiệp trắng qua HTTP thật |

Cổng chặn số nhúng cứng đã được **chứng minh có răng** bằng hai lần phá hoại có kiểm soát:
thêm `overtime * 1.5` vào `classification-context.ts` → đỏ; thêm `insert into holidays` vào
`seed.sql` → đỏ; hoàn tác cả hai → xanh, `git status` không còn dấu vết.
