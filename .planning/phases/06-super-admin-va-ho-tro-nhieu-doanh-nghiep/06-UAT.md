# Phase 6 — Biên bản nghiệm thu

**Ngày:** 2026-08-10
**Nhánh:** `phase-6-super-admin`
**Requirements:** SADM-01, SADM-02, SADM-03, SADM-04
**Spec:** `docs/superpowers/specs/2026-08-10-phase-6-super-admin-design.md` (D-49…D-56)
**Plan:** `docs/superpowers/plans/2026-08-10-phase-6-super-admin.md`

## Cách đọc biên bản này

Mỗi tiêu chí có ba mục: **cách quan sát**, **quan sát thật đã có**, **còn thiếu gì**.
Mục thứ ba là mục quan trọng nhất — nó nói rõ ranh giới giữa "máy đã kiểm" và "người
đã nhìn", và không được để trống bằng một câu chung chung.

---

## Tiêu chí 1 — Danh sách toàn hệ thống (SADM-01)

> Super admin thấy danh sách toàn bộ doanh nghiệp trên hệ thống kèm tình trạng cơ bản
> của từng nơi (số nhân viên, hoạt động gần nhất, kỳ đang mở).

**Cách quan sát:** đăng nhập bằng tài khoản platform admin, mở `/platform`.

**Quan sát thật đã có:**

- `npm run test:e2e-support` bước 1, qua **HTTP thật** vào ứng dụng đang chạy:
  `GET /api/platform/companies` trả 200, thấy **cả hai** doanh nghiệp seed
  (`cty-01` và `cty-02`), mỗi dòng mang số nhân viên thật `> 0`.
- `src/lib/data/__tests__/platform-overview.test.ts` — 3/3 trên database thật với
  phiên đăng nhập thật: platform admin thấy cả hai doanh nghiệp; người thường thấy
  **0 dòng**; và một assertion khoá **đúng tập tên cột** trả về, để ai thêm một cột dữ
  liệu nghiệp vụ vào hàm sẽ đỏ ở đó trước.

**Còn thiếu:** chưa ai nhìn bảng này trên trình duyệt. Bốn cột (số nhân viên, hoạt
động gần nhất, kỳ đang mở, hai nút hành động) mới chỉ được kiểm ở tầng dữ liệu.

---

## Tiêu chí 2 — Xem sâu một doanh nghiệp, màn hình nói rõ đang xem ai (SADM-02)

> Super admin mở sâu vào dữ liệu của một doanh nghiệp để trả lời câu hỏi hỗ trợ, và
> màn hình luôn hiển thị rõ đang xem doanh nghiệp nào.

**Cách quan sát:** bấm *Mở phiên hỗ trợ* trên một dòng, nhập lý do, rồi xem `/admin/*`.

**Quan sát thật đã có:**

- `test:e2e-support` bước 3: sau khi mở phiên vào `cty-01`, `GET /api/employees` trả
  200 với `> 0` nhân viên, và **mọi dòng** đều thuộc `cty-01`.
- `test:e2e-support-rls` (13/13, database thật): trong phiên đọc được `employees`,
  `departments`, `attendance_records`, `work_requests`, `company_settings` của
  `cty-01` và **0 dòng** của `cty-02` ở cả năm bảng.
- `platform-sessions.test.ts` (7/7): mở phiên đặt cookie `tf_active_company`; mở phiên
  vào doanh nghiệp khác thì cookie đổi theo.

**Còn thiếu:** **banner hỗ trợ chưa ai nhìn bằng mắt.** Đây là vế "màn hình luôn hiển
thị rõ" của chính tiêu chí này, và nó là thứ duy nhất trong phase không có cách nào
kiểm bằng máy. Cần nhìn: nền hổ phách, đúng tên doanh nghiệp, số phút còn lại giảm
dần, và nút *Đóng phiên* hoạt động.

---

## Tiêu chí 3 — Mỗi lần chạm dữ liệu đều có một dòng audit (SADM-03)

> Mỗi lần super admin chạm vào dữ liệu của một doanh nghiệp đều có một dòng audit log
> ghi ai, doanh nghiệp nào, lúc nào.

**Đơn vị đếm là PHIÊN, không phải request** (D-55, chốt với chủ dự án khi lập kế
hoạch). Một buổi hỗ trợ 30 phút đẻ ra hàng trăm request; ghi từng cái sẽ chôn vùi
chính audit nghiệp vụ mà `audit_log` sinh ra để phục vụ.

**Quan sát thật đã có:**

- `platform-sessions.test.ts`: mở phiên ghi **một** dòng `audit_log` với
  `action='access'`, đúng `company_id`, đúng `entity_id`, và `reason` chứa nguyên văn
  lý do người dùng nhập. Đóng phiên ghi **dòng thứ hai**.
- `test:e2e-support` bước 6 và 7 qua HTTP thật: `/api/platform/sessions` có đúng một
  dòng của lần chạy đó, đang mở; sau khi đóng thì `closedAt` khác `null`.
- `support_sessions` **không có policy `delete`** — nhật ký không xoá được. Có
  assertion pgTAP cho điều này (`20_support_sessions.sql` #8).

**Còn thiếu:** `/platform/log` chưa ai nhìn trên trình duyệt. Ba nhãn trạng thái
(`Đang mở` / `Đã đóng` / `Hết hạn`) mới chỉ đúng ở tầng dữ liệu.

---

## Tiêu chí 4 — Đường ghi riêng có kiểm soát, cô lập Phase 1 vẫn xanh (SADM-04)

> Quyền ghi của super admin đi qua một đường riêng có kiểm soát, không phải quyền vượt
> RLS dùng chung; bộ test cô lập của Phase 1 vẫn xanh sau khi super admin có mặt.

**Quan sát thật đã có — vế "không phải quyền vượt RLS dùng chung":**

- Migration 0034 chỉ mở nhánh `or tf_has_support_access(...)` cho lệnh **`select`**.
  Ba lệnh ghi giữ nguyên `tf_is_member`, không sửa một chữ.
- `test:e2e-support-rls`: trong phiên, `insert` vào `holidays` của `cty-01` bị từ chối
  **SQLSTATE 42501**; `update employees` chạm **0 dòng**.
- `test:e2e-support` bước 5: cùng khẳng định đó qua đường người dùng thật.
- 51 lời gọi `requireRole` trong 16 file `mutations/*.ts` **không sửa một dòng nào** —
  chúng từ chối `"support"` một cách tự động vì `requireRole` nhận
  `allowed: CompanyRole[]`, một kiểu không chứa `"support"`.

**Quan sát thật đã có — vế "hai đường ghi riêng":**

- `platform-writes.test.ts` (6/6 trên Auth và database thật): cả hai đường từ chối
  người không phải platform admin, bắt buộc lý do, ghi `audit_log` ở tầng nền tảng
  (`company_id = NULL`), và — khẳng định đắt nhất — **mật khẩu tạm không bao giờ
  xuống `audit_log`**, đồng thời mật khẩu mới **đăng nhập được thật** (thao tác có
  hiệu lực chứ không chỉ ghi vết).
- Cả hai đường nằm **ngoài** dữ liệu chấm công và lương. Đội vận hành không sửa được
  một bản ghi công hay một con số tiền nào, ở bất kỳ đường nào.

**Quan sát thật đã có — vế "cô lập Phase 1 vẫn xanh":**

- `test:e2e-support-rls`: khách chưa đăng nhập đọc được **0 dòng** `employees`.
- Ba file `01_isolation_companies.sql`, `03_isolation_core.sql`, `04_isolation_v2.sql`
  **không bị sửa một dòng nào** trong cả phase — xác nhận bằng `git log` trên nhánh.

**Kiểm răng (sabotage-and-revert), cả hai đều đã chạy:**

| cổng | phá thế nào | kết quả |
|---|---|---|
| `no-inline-admin-role.test.ts` | thêm `role === "owner"` vào `periods/route.ts` | **đỏ**, nêu đúng tên file; hoàn nguyên → xanh, `git status` sạch |
| `canReadCompanyData` | thêm `"manager"` vào `READ_ROLES` | **đỏ** đúng một test; hoàn nguyên → 15/15 xanh, `git diff` rỗng |

**Còn thiếu:** hộp thoại của hai đường ghi (`Cấp lại mật khẩu tạm`, `Cấp quyền chủ`)
chưa ai bấm tay. Đặc biệt cần nhìn khối hiện mật khẩu tạm **một lần duy nhất** kèm câu
"Mật khẩu này không hiện lại được — hãy chép ngay."

---

## Kết quả các cổng (chạy 2026-08-10)

| lệnh | kết quả |
|---|---|
| `npm run typecheck` | sạch |
| `npm run lint` | 0 lỗi (1 cảnh báo có sẵn ở `scripts/tmp/setup-ngocphat.mjs`, ngoài phạm vi) |
| `npm run test` | **70 file, 772/772 xanh** |
| `npm run check:assertions` | 306 (sàn 306) |
| `npm run check:secrets` | OK — quét 93 file, không khoá bí mật nào |
| `npm run test:e2e-support` | **TẤT CẢ ĐẠT** (17 khẳng định, HTTP thật) |
| `npm run test:e2e-support-rls` | **13/13** (database thật, phiên đăng nhập thật) |
| `npm run test:db` | **KHÔNG CHẠY ĐƯỢC** — xem mục dưới |

## Giới hạn đã biết

1. **`npm run test:db` chưa chạy thật lần nào trong phase này.** Môi trường phát triển
   không có `psql`, `docker`, hay `supabase` CLI, và database dev là Supabase cloud nên
   bộ chạy test từ chối nạp fixture pgTAP. Đây là blocker **đã treo từ 04-06** qua
   05-06 và 05-2-06, không phải mới.

   Hệ quả: 14 assertion của `supabase/tests/20_support_sessions.sql` đã viết, đã vào
   cổng đếm (sàn 292 → **306**), nhưng **chưa chạy thật**. Cần Postgres tạm của CI.

   Bù lại — và đây là điểm khác với ba phase trước: phase này thêm
   `scripts/e2e-support-rls.mjs`, chạy **cùng những khẳng định đó** bằng một phiên đăng
   nhập thật qua PostgREST (JWT thật, `auth.uid()` thật, RLS thật, không mock gì).
   13/13 đạt. Nên D-49 và D-50 **không** phải là khẳng định chỉ tồn tại trên giấy.

2. **Chưa ai bấm tay trên trình duyệt.** Ba màn hình mới (`/platform`, `/platform/log`,
   và banner hỗ trợ trên `/admin/*`) đều chưa được nhìn bằng mắt. Danh sách cụ thể cần
   bấm nằm ở mục "Còn thiếu" của từng tiêu chí bên trên — **bốn thứ**:
   1. `/platform` hiện đủ hai doanh nghiệp kèm số nhân viên đúng.
   2. Mở phiên → banner hổ phách hiện đúng tên doanh nghiệp và số phút còn lại.
   3. Bấm một nút ghi bất kỳ trong `/admin` khi đang ở phiên hỗ trợ → hiện đúng câu
      "Bạn không có quyền thực hiện thao tác này."
   4. `/platform/log` hiện đúng dòng phiên vừa mở, kèm lý do đã nhập.

3. **Nút ghi trong `/admin` không bị ẩn khi đang ở phiên hỗ trợ** (D-54, có chủ đích).
   Đội vận hành bấm rồi mới biết không được. Đánh đổi: ẩn nút ở 10 màn hình là 10 chỗ
   để quên và 10 chỗ để một phase sau thêm màn hình thứ 11 mà không biết; còn thông
   điệp từ chối thì đến từ **một** chỗ duy nhất và không quên được.

4. **Không có đường gia hạn phiên** (có chủ đích). Hết 60 phút thì mở phiên mới, và
   phiên mới là một dòng nhật ký mới.

5. **Không có màn hình quản lý danh sách platform admin.** Thêm/bớt vẫn bằng
   `npm run seed:platform-admin` hoặc `insert` tay vào `platform_admins`. Đội vận hành
   TimeFlow có 1–2 người ở quy mô hiện tại.

6. **Fixture của test tích hợp có thể để lại vài tài khoản `*@timeflow.test`** trên dev
   nếu một lần chạy bị ngắt giữa chừng (khối `finally` không kịp chạy). Cùng cách dọn
   với các phase trước.

## Chữ ký

- [ ] Chủ dự án đã bấm tay đủ bốn thứ ở mục Giới hạn #2
- [ ] Chủ dự án đồng ý đóng Phase 6

Ngày: ................  Ký: ................
