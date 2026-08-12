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

**Còn thiếu: không còn.** Đã nhìn trên trình duyệt 2026-08-10 — Ngọc Phát 6 nhân
viên / hoạt động 09/08 lúc 02:37 / kỳ 2026-08; Bình Minh 12 nhân viên. Phát hiện kèm:
danh sách lẫn hàng chục doanh nghiệp fixture cũ, dọn bằng `npm run db:seed`.

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

**Còn thiếu: không còn.** Banner đã nhìn bằng mắt 2026-08-10: nền hổ phách, đúng tên
đầy đủ "Công ty TNHH Thương mại Ngọc Phát", đếm ngược chạy thật (60 → 50 phút), nút
*Đóng phiên* đưa về `/platform`. Sidebar ghi vai trò "Phiên hỗ trợ".

**Chính buổi nhìn này bắt được lỗi nặng nhất của phase:** ban đầu banner hiện mã thô
`cty-01` và sidebar kẹt "Đang tải…", vì `GET /api/companies` trả `[]` cho phiên hỗ
trợ — nhánh support nằm nhầm trong `catch (NoMembershipError)`, mà từ khi có D-51 thì
lỗi đó không còn được ném nữa. **Lỗi tương tác giữa Task 4 và Task 6; cả hai task đều
xanh khi đứng riêng, và cả 772 test lẫn e2e đều không bắt được** — vì không chỗ nào
khẳng định về *tên* doanh nghiệp. Đã sửa (`ef410c5`) và thêm 2 test hồi quy.

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

**Còn thiếu: không còn.** Đã nhìn 2026-08-10: dòng phiên mở lúc 16:26, hết hạn 17:26
(đúng 60 phút), lý do nguyên văn "Ticket #418 — khách báo sai giờ tăng ca tháng 8",
trạng thái chuyển `Đang mở` → `Đã đóng`.

**Buổi nhìn này bắt thêm một lỗi:** cột Doanh nghiệp tụt về mã thô `cty-01` **ngay khi
đóng phiên** — route join `companies(name)` qua RLS, mà quyền đọc bảng đó lại đến từ
chính phiên hỗ trợ. Nghĩa là **mọi dòng lịch sử đều mất tên**, đúng lúc một nhật ký
cần đọc lại nhất. Đã đổi sang lấy tên qua `tf_platform_company_overview()` (`ef410c5`).

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

**Đã bấm tay 2026-08-10 — vế "ghi bị chặn":** trong phiên hỗ trợ, bấm **thật** nút
*Chuyển phòng ban* cho Chu Văn Lộc (Sản xuất → Kế toán), hai lần. Kết quả:
`requireRole` ném `ForbiddenError` tại `bulkMoveDepartment` (thấy trong log server),
dữ liệu **không đổi** (nhân viên vẫn ở "Sản xuất"), và toast hiện đúng nguyên văn
`"Bạn không có quyền thực hiện thao tác này."` — phải bắt bằng `MutationObserver` vì
toast tự tắt sau vài giây. Đây là xác nhận trực tiếp cho khẳng định trung tâm của
D-52: **không sửa một dòng nào trong 16 file `mutations/*.ts` mà đường ghi vẫn đóng.**

**Đã bấm tay — vế "hai đường ghi trắng": xong cả hai.**

- *Cấp lại mật khẩu tạm*: chủ dự án tự bấm 2026-08-12, xác nhận chạy đúng.
- *Cấp quyền chủ doanh nghiệp*: bấm 2026-08-12 trên tài khoản dùng-một-lần
  (`uat-owner-…@timeflow.test`), đã dọn sạch sau đó. Quan sát:
  - Trường hợp âm trước: email không tồn tại → toast *"Không tìm thấy tài khoản với
    email …"*, hộp thoại **giữ nguyên** để sửa chứ không đóng mất dữ liệu vừa gõ.
  - Trường hợp thật: toast *"Đã cấp quyền chủ doanh nghiệp cho … tại Công ty TNHH
    Thương mại Ngọc Phát."*, hộp thoại tự đóng.
  - Database: `memberships` có đúng một dòng `cty-01 / owner / active`.
  - `audit_log`: `action=update`, `company_id=null` (tầng nền tảng — đúng D-56),
    `entity_table=memberships`, và `reason` mang **cả mã doanh nghiệp lẫn nguyên văn
    lý do đã gõ**: *"Super admin cấp quyền chủ doanh nghiệp cty-01: Ticket #501 —
    khách mất quyền chủ sau khi đổi nhân sự"*.

**Không còn mục nào chưa bấm tay.**

---

## Kết quả các cổng (chạy 2026-08-10, cập nhật 2026-08-12)

| lệnh | kết quả |
|---|---|
| `npm run typecheck` | sạch |
| `npm run lint` | 0 lỗi (1 cảnh báo có sẵn ở `scripts/tmp/setup-ngocphat.mjs`, ngoài phạm vi) |
| `npm run test` | **72 file, 787/787 xanh** (ba lượt liên tiếp, sau khi đặt `hookTimeout`) |
| `npm run check:assertions` | 305 (sàn 305 — xem Giới hạn #1) |
| `npm run check:secrets` | OK — quét 93 file, không khoá bí mật nào |
| `npm run test:e2e-support` | **TẤT CẢ ĐẠT** (17 khẳng định, HTTP thật) |
| `npm run test:e2e-support-rls` | **13/13** (database thật, phiên đăng nhập thật) |
| `npm run test:db` | ngoài phạm vi (Giới hạn #1) |

## Giới hạn đã biết

1. **`npm run test:db` / pgTAP trên CI — ĐÃ ĐƯA RA NGOÀI PHẠM VI 2026-08-12 theo
   quyết định của chủ dự án.** Không còn là việc treo, không nêu lại ở các phase sau.

   Bối cảnh để quyết định này đọc được về sau: môi trường phát triển không có `psql`,
   `docker` hay `supabase` CLI, nên `npm run test:db` không chạy được tại máy (blocker
   treo từ 04-06). Khi truy tiếp trên CI thì lộ ra ba tầng nợ có sẵn, đã sửa hết:
   pgTAP nằm ở schema `extensions` mà không ai đặt `search_path` (nên cổng RLS của CI
   đỏ từ trước Phase 6 và bước chạy `run-all.sql` **luôn bị skip**); `18_payroll_runs.sql`
   khai `plan(11)` trong khi chỉ có 10 khẳng định; và sàn `check:assertions` vì thế
   thừa 1 ngay từ đầu (306 → **305**, sửa sổ sách chứ không bỏ test).

   **Điều cố ý chấp nhận:** lượt CI cuối cùng chưa ai xác nhận xanh hay đỏ. Bộ pgTAP
   có thể còn khẳng định khác chưa từng chạy và chưa từng đúng.

   **Vì sao chấp nhận được:** mọi hành vi mà pgTAP của phase này khẳng định đều đã
   được phủ độc lập bằng đường khác chạy trên hệ thống thật —
   `scripts/e2e-support-rls.mjs` (13/13, phiên đăng nhập thật qua PostgREST: JWT thật,
   `auth.uid()` thật, RLS thật, không mock gì) và `scripts/e2e-support.mjs` (17 khẳng
   định qua HTTP thật). Nên D-49 và D-50 không phải là khẳng định chỉ tồn tại trên
   giấy — chỉ là chúng chưa được khẳng định *thêm một lần nữa* bằng pgTAP.

2. ~~**Chưa ai bấm tay trên trình duyệt.**~~ — **ĐÃ BẤM 2026-08-10**, qua Chrome
   DevTools với tài khoản `ops@timeflow.vn` thật trên `localhost:3010`. Cả bốn mục đều
   đạt:
   1. ✅ `/platform` hiện cả hai doanh nghiệp thật (Ngọc Phát 6 nhân viên / kỳ
      2026-08; Bình Minh 12 nhân viên) — **kèm một phát hiện**: danh sách lẫn hàng
      chục doanh nghiệp fixture cũ (`Doanh nghiep e2e …`, `test 04-05 …`), đúng thứ
      §Blockers của `STATE.md` đã ghi là rác từ phase 4/5/5.2. Một lần
      `npm run db:seed` dọn sạch.
   2. ✅ Banner hổ phách, đúng tên đầy đủ "Công ty TNHH Thương mại Ngọc Phát", đếm
      ngược chạy thật (60 → 50 phút), nút *Đóng phiên* đưa về `/platform`.
   3. ✅ Bấm **thật** một nút ghi (*Chuyển phòng ban* cho Chu Văn Lộc): `requireRole`
      ném `ForbiddenError` tại `bulkMoveDepartment`, dữ liệu **không đổi** (nhân viên
      vẫn ở "Sản xuất" sau hai lần thử), và toast hiện đúng nguyên văn
      "Bạn không có quyền thực hiện thao tác này." — xác nhận bằng `MutationObserver`
      vì toast tự tắt sau vài giây.
   4. ✅ `/platform/log` hiện đúng lý do đã nhập, hết hạn đúng 60 phút sau, trạng thái
      chuyển `Đang mở` → `Đã đóng`.

   **Ba lỗi do chính buổi bấm tay này phát hiện, đã sửa** (commit `ef410c5`):
   - `GET /api/companies` trả `[]` cho phiên hỗ trợ → sidebar kẹt "Đang tải…", banner
     hiện mã thô `cty-01`. Nhánh support nằm nhầm trong `catch (NoMembershipError)`,
     mà từ khi có D-51 thì lỗi đó không còn được ném nữa. **Lỗi tương tác giữa Task 4
     và Task 6 — cả hai task đều xanh khi đứng riêng.** Đã thêm 2 test hồi quy.
   - `/platform/log` tụt về mã thô **ngay khi đóng phiên**, vì join `companies(name)`
     đi qua RLS mà quyền đọc bảng đó lại đến từ chính phiên. Mọi dòng lịch sử đều mất
     tên. Đã đổi sang lấy tên qua `tf_platform_company_overview()`.
   - `/select-company` không có lối nào sang `/platform`, trong khi platform admin
     **luôn** rơi vào đúng trang đó sau khi đăng nhập. Sơ đồ luồng trong spec có bước
     này nhưng plan không có task nào làm.

   **Hai hộp thoại đường ghi trắng: đã bấm nốt 2026-08-12** — xem cuối Tiêu chí 4.

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

## Lỗi CÓ SẴN phát hiện khi nghiệm thu (ngoài phạm vi Phase 6)

`GET /api/dashboard` trả **500** cho Ngọc Phát, nên `/admin/dashboard` chỉ hiện
"Không tải được dữ liệu". Nguyên nhân: migration `0028_optional_employee_fields.sql`
cho `employees.phone` nullable, nhưng `dashboardSummarySchema` (`api/dashboard.ts:52`)
vẫn khai `phone: z.string()` — một nhân viên không có số điện thoại là đủ để cả bảng
điều khiển hỏng.

**Không phải hồi quy của Phase 6**: `git log main..HEAD` trên `src/app/api/dashboard/`
và `src/lib/validation/api/dashboard.ts` đều rỗng.

**ĐÃ SỬA 2026-08-11** (commit `f61a75b`): bốn chỗ vẫn khai `phone` không-null được
sửa cho khớp database (`RawEmployeeRow`, schema Zod, `DashboardSummary`, và thẻ giao
diện — chưa có số thì hiện "Chưa có số điện thoại" thay vì hai nút gọi/nhắn dựng ra
`tel:null`). Có test hồi quy; đã xác nhận trên trình duyệt.

**Hai lỗi CÓ SẴN khác cũng phát hiện trong đợt này, đã sửa:**
- Người ca đêm vào muộn sau nửa đêm được ghi `on_time` (commit `9d2bebe`) —
  `work_date` là ngày lịch nên mốc bắt đầu ca giải ra ở TƯƠNG LAI, số phút muộn bị
  kẹp về 0. Sửa bằng `scheduledStartDayOffset()`, không đụng tới D-08.
- `shift-rules-effect.test.ts` đỏ tất định trong 20 phút đầu mỗi đêm (commit
  `1ce1f93`) — fixture dựng ca `now − 20 phút`, sau nửa đêm thì âm và cuộn vòng
  thành ca qua đêm ngoài ý muốn.

## Chữ ký

- [x] Bốn mục ở Giới hạn #2 — bấm tay 2026-08-10 qua Chrome DevTools
- [x] *Cấp lại mật khẩu tạm* — chủ dự án tự bấm 2026-08-12
- [x] *Cấp quyền chủ doanh nghiệp* — bấm 2026-08-12, có kiểm database
- [x] pgTAP trên CI — **đưa ra ngoài phạm vi** 2026-08-12 theo quyết định của chủ
      dự án (Giới hạn #1)

**Không còn mục nào chờ.** Bốn tiêu chí của phase đều có quan sát thật trên hệ thống
chạy thật, và mọi thứ từng nằm ở mục "còn thiếu" đều đã đóng.

- [ ] Chủ dự án đồng ý đóng Phase 6

Ngày: ................  Ký: ................
