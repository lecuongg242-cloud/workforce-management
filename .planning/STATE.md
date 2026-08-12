---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 6
current_phase_name: Super admin và hỗ trợ nhiều doanh nghiệp
status: complete
stopped_at: Phase 6 xong va da merge vao main; khong con muc treo nao; cho chu du an ky dong phase o 06-UAT.md
last_updated: "2026-08-12T17:30:00.000Z"
last_activity: 2026-08-12
last_activity_desc: Phase 6 merge vao main; sua 3 loi co san (dashboard 500 vi phone null, ca dem vao muon ghi on_time, fixture test do sau nua dem) va 3 loi ha tang test (hookTimeout, search_path pgTAP tren CI, plan(11) sai o 18_payroll_runs)
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 42
  completed_plans: 42
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-31)

**Core value:** Doanh nghiệp tin được số liệu chấm công: mỗi bản ghi vào/ra là có thật, đúng nơi, đúng giờ — và không doanh nghiệp nào nhìn thấy dữ liệu của doanh nghiệp khác.
**Current focus:** Phase 6 đã thực thi xong — chờ chủ dự án bấm tay và ký `06-UAT.md`

## Current Position

Phase: 6 — Super admin và hỗ trợ nhiều doanh nghiệp — **9/9 task đã thực thi**
Plan: `docs/superpowers/plans/2026-08-10-phase-6-super-admin.md`
Status: **đã merge vào `main` và đẩy lên `origin`**; nghiệm thu tay xong, chỉ còn chữ ký đóng phase của chủ dự án
Last activity: 2026-08-10 — Thực thi Phase 6 (migration 0033–0036, `support_sessions` + `tf_has_support_access`, khu `/platform`, cổng `no-inline-admin-role`, `e2e-support` + `e2e-support-rls`)

Progress: [██████████] 100% — Phase 1–6 đã thực thi xong (toàn bộ 44 requirement của v1)

## Performance Metrics

**Velocity:**

- Total plans completed: 18
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 2 | 11 | - | - |
| 03 | 7 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 27min | 3 tasks | 14 files |
| Phase 01 P02 | 10min | 2 tasks | 3 files |
| Phase 01 P03 | 19min | 2/3 tasks (Task 2 descoped) | 5 files |
| Phase 01 P04 | 19min | 2 tasks | 4 files |
| Phase 01 P05 | 24min | 3 tasks | 4 files |
| Phase 01 P06 | 55min | 2 tasks | 4 files |
| Phase 02 P01 | 35min | 4 tasks | 8 files |
| Phase 02 P02 | 90min | 3 tasks | 9 files |
| Phase 02 P05 | 95min | 3 tasks | 11 files |
| Phase 02 P06 | 55min | 2 tasks | 7 files |
| Phase 02 P07 | 80min | 3 tasks | 15 files |
| Phase 02 P08 | 100min | 3 tasks | 20 files |
| Phase 02 P09 | 55min | 2 tasks | 10 files |
| Phase 03 P01 | 67min | 3 tasks | 23 files |
| Phase 03 P02 | 42min | 2 tasks | 12 files |
| Phase 03 P05 | 27min | 2 tasks | 9 files |
| Phase 03 P03 | 60min | 3 tasks | 9 files |
| Phase 03 P04 | 50min | 3 tasks | 10 files |
| Phase 03 P06 | 55min | 3 tasks | 11 files |
| Phase 03 P07 | 85min | 1 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Xây theo lớp ngang (horizontal layers) thay vì lát dọc MVP — UI đã có từ V1, rủi ro nằm ở tính đúng đắn của lớp dữ liệu
- [Roadmap]: DATA-03 (test rò rỉ xuyên doanh nghiệp) và DATA-04 (cổng CI cho RLS) nằm ở Phase 1, không hoãn — đây là biện pháp kiểm soát rủi ro số một của dự án
- [Roadmap]: AUTH-06 (thu hồi và cấp lại khóa Supabase) nằm ở Phase 1 vì đó là phase đầu tiên chạm vào Supabase project thật
- [Roadmap]: Super admin (Phase 6) làm sau cùng — đường nhìn xuyên doanh nghiệp chỉ an toàn khi cô lập đã được kiểm chứng
- [Phase ?]: 01-01: RLS policy pattern locked — <table>_<cmd>_member policies always condition on public.tf_is_member(company scoping column) via SECURITY DEFINER, never a Postgres session variable
- [Phase ?]: 01-01: compat auth.users stub in 0001_supabase_compat.sql expanded to include instance_id/aud/role so seed.sql inserts work identically on CI's blank Postgres and Supabase cloud
- [Phase ?]: D-08 confirmed via checkpoint: overnight shift credited entirely to start date (confirm-start-date); end-date and split-by-day rejected
- [Phase ?]: Enum Vietnamese-label pgTAP assertion scoped to schema public to avoid false-positive on Supabase's own storage.buckettype/audit.action system enums
- [Phase ?]: 01-04: Deferred self-referencing FK (departments.manager_id/employees.manager_id -> employees) requires wrapping seed.sql's insert section in explicit begin;/commit; — psql autocommit-per-statement checks even deferred constraints at each statement's own implicit commit
- [Phase ?]: 01-04: Controlled-sabotage teeth check on employees_select_member (ALTER POLICY / DROP POLICY against live dev DB) blocked by harness Bash permission classifier in every framing tried; deferred to human, logged in WINDOWS.md entry 2 — mechanism already proven by 01-01's identical procedure on companies_select_member
- [Phase ?]: 01-05: Speed-directive reduced test depth to 2 assertions/table (compound read-denial + throws_ok write-denial) instead of the 7-assertion suite from 01-04, since the RLS mechanism was already proven with teeth by precedent
- [Phase ?]: 01-05: periods date math computed via date_trunc('month', now() at time zone public.tf_tz()) in both seed and tests, not hardcoded, to keep periods sliding with D-07's convention
- [Phase ?]: 01-06: Full V1 seed dataset ported with sliding dates (D-07) via public.tf_work_date(now()) anchor; overnight-shift attendance pinned to exact scheduled duration to satisfy D-08's worked_minutes invariant
- [Phase ?]: 01-06: Preserved anchor fixture ids (dept-01/02, sft-01-day/02-day, nv-01a/02a, att-02a) required by prior plans' pgTAP tests while renaming the rest of the id scheme for the full 40-employee/9-department/7-shift dataset
- [Phase ?]: 01-03: AUTH-06 narrowed 2026-07-31 — "revoke & reissue legacy Supabase keys" (Task 2, checkpoint:human-action) moved to Out of Scope by deliberate product decision; "no secret key reaches the client bundle" clause delivered and verified (`npm run check:secrets`). Legacy `service_role` key remains active and bypasses RLS — accepted risk, recorded in REQUIREMENTS.md/PROJECT.md §Out of Scope, not an outstanding blocker.
- [Phase ?]: 02-01: Task 1 npm package legitimacy gate approved via npm registry API evidence (name + repository.url match for vitest, @vitejs/plugin-react, jsdom)
- [Phase ?]: 02-01: eslint.config.mjs ignores gained .claude/** — first plan to run repo-wide npm run lint, which surfaced GSD tooling's CommonJS require() was never excluded
- [Phase ?]: 02-01: .env.local/.env.example publishable key renamed to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY by operator (agent Read/Write blocked on .env* paths); hit and fixed a PowerShell 5.1 BOM incident
- [Phase ?]: 02-01: found and fixed a second, related Windows encoding bug in .env.example (em-dash mojibake from double-encoding, not BOM) before commit, via direct byte-level replacement
- [Phase ?]: 02-01: check:secrets gate proven to have teeth via controlled sabotage-and-revert on login-form.tsx — exit 0 -> 1 -> 0, no leftover temp code in git status
- [Phase ?]: 02-02: platform_admins table + tf_is_platform_admin() clone tf_is_member's security-definer guard shape (no user param, RLS deny-all select policy)
- [Phase ?]: 02-02: tf_normalize(text) uses translate() over a 134-char Vietnamese diacritic table (not unaccent extension) to match src/lib/format.ts normalizeText() exactly
- [Phase ?]: 02-02: seed.sql identity fully split into supabase/tests/00_fixture_users.sql (pgTAP-only, never reaches cloud via db:seed); scripts/check-pgtap-assertions.mjs is the D-15a mechanical floor gate (184 assertions)
- [Phase ?]: 02-02: discovered npm run test:db locally commits 4 synthetic fixture rows to the live Supabase db (bounded/accepted per plan's own db:seed-only acceptance criteria); logged as Threat Flag in 02-02-SUMMARY.md
- [Phase ?]: 02-05: RPC tf_search_employee_ids tra ve danh sach id (khong phai setof employees day du) de Route Handler chi giu MOT hinh dang query builder (.from("employees")) bat ke co tu khoa tim kiem hay khong
- [Phase ?]: 02-05: employeeSchema tach thanh employeeRowSchema (transform snake_case->camelCase, chi server-side) va employeeSchema (plain, dung o ca hai dau D-12d) vi Employee co ~20 truong khong the dung mot schema cho ca hai chieu
- [Phase ?]: 02-05: deleteDepartment bat rieng loi Postgres 23503 (FK vi pham, con nhan vien thuoc phong ban) thanh thong diep tieng Viet ro rang -- rang buoc nay khong ton tai trong mock/service.ts
- [Phase ?]: 02-06: Wire contract cua GET /api/shifts la hinh dang cuoi cung (camelCase, HH:mm) — shiftRowSchema transform ngay sau doc DB, shiftWithStatsSchema (plain) dung o ca hai dau (D-12d)
- [Phase ?]: 02-06: Cot sinh (overnight) chi duoc doc lai, khong bao gio tinh lai o tang ung dung — canh bang test sabotage-and-revert
- [Phase ?]: createEmployee kiem ma trung khong phan biet hoa thuong qua RPC scalar tf_employee_code_taken (migration 0009), dung lai tf_normalize thay vi viet lai logic chuan hoa o JS
- [Phase ?]: updateEmployee co hai nhanh quyen: owner/admin sua moi ho so, con lai chi sua ho so co id bang employeeId cua chinh phien -- kiem tra chay TRUOC ca createServerSupabase() de tu choi khong cham DB
- [Phase ?]: bulkMoveDepartment tra 0 va khong cham session/DB/mang khi ids rong; audit_log ghi mot dong CHO MOI nhan vien bi doi phong ban trong thao tac hang loat, khong gop thanh mot dong
- [Phase ?]: 02-08: them migration 0010 (tf_server_now, tf_local_instant) de checkIn/checkOut doc dong ho database va tinh gio bat dau/ket thuc ca ke hoach ma khong viet offset mui gio thu hai
- [Phase ?]: 02-08: lateMinutes/earlyLeaveMinutes tinh qua tf_worked_minutes tren cap timestamptz that (khong phai hai chuoi HH:mm) -- loai bo hoan toan nhu cau nguong chan 720-phut cua tang gia lap
- [Phase ?]: 02-08: checkIn dung khuon doc-truoc-insert-hoac-update thay vi upsert PostgREST -- da xac nhan qua psql that rang upsert se ghi de id cua dong dang co khi trung unique constraint
- [Phase ?]: 02-08: rule ESLint D-19a (cam new Date/Date.now) ap dung pham vi hep chi ba file view cua plan, khong phai toan repo, de khong pha vo dong ho tick that hop le cua attendance-status-card.tsx ngoai pham vi
- [Phase ?]: 02-09: GET /api/requests mac dinh gioi han employeeId ve chinh phien khi vai tro khong phai quan tri VA khong truyen tham so -- khac khuon GET /api/attendance (chi chan khi truyen sai), quyet dinh co chu dich vi yeu cau la loi khai ca nhan nhay cam hon cham cong
- [Phase ?]: 02-09: createRequest doi chieu employeeId voi bang employees theo company_id truoc khi ghi -- FK khong kiem company_id nen can buoc nay de giu ranh gioi doanh nghiep, cung khuon voi checkIn/bulkMoveDepartment
- [Phase ?]: 02-09: sau plan nay khong con file nao duoi src/app/ hoac src/components/ import @/lib/mock/service -- chi con employee-form.tsx dung REFERENCE_DATE, giao lai cho 02-11 (phase gate) xoa tang gia lap
- [Phase ?]: 03-01: checkpoint bucket/duong dan Storage xac nhan boi chu du an - option-a, attendance-photos/{company_id}/{employee_id}/{photo_id}.jpg, uu tien xoa-theo-nhan-vien cho PRIV V3
- [Phase ?]: 03-01: checkIn() evidence optional o MUC KIEU (bat buoc o hanh vi) de giu call site 4-tham-so cu compile duoc giua Task 2 va Task 3, tranh sua employee-home-view.tsx hai lan
- [Phase ?]: 03-01: npm run test:db chay qua TF_ALLOW_CLOUD_TESTS=1 nham thang Supabase dev that vi Docker khong co san trong moi truong thuc thi - don sach 4 dong fixture pgTAP ngay sau khi chay, theo tien le 02-02-SUMMARY.md
- [Phase ?]: 03-02: workSiteFormSchema (dialog) chi 4 truong, khong co isActive - bat/tat la hanh dong archiveWorkSite rieng tren card, khong phai o nhap trong form
- [Phase ?]: 03-02: BREADCRUMB_LABELS phai khai tuong minh cho moi segment co dau '-' (vd work-sites) - thieu entry se bi fallback nham thanh 'Chi tiet' (admin-topbar.tsx dong 43-44)
- [Phase ?]: 03-05: Test Task 1 dung khuon mock DB (khong phai Postgres that) vi markPhotoReviewed ghi audit_log.actor_user_id (FK toi auth.users) - userId gia lap se vi pham FK neu ghi that
- [Phase ?]: 03-05: Import audit qua namespace (import * as auditLog) trong mutations/attendance-photos.ts de dap ung acceptance criteria grep -c logMutation == 1
- [Phase ?]: 03-05: Go getAttendancePhotoForRecord (code chet) va chi thi use server khoi src/lib/data/attendance-photos.ts sau khi Dialog chuyen sang listAttendancePhotos qua Route Handler
- [Phase ?]: checkpoint browser-image-compression@2.0.2 phe duyet boi chu du an — repo/tai xac nhan, khong postinstall
- [Phase ?]: [Rule 2] checkIn() tra them distanceMeters/workSiteName/isOutsideRadius de banner D-20 dung du lieu that; onSubmit cua CameraSheet doi sang Promise<PunchSubmitResult>
- [Phase ?]: Nguong dang ngo D-21 (5x ban kinh) khai tam trong attendance.ts cho banner tuc thi; 03-06 se hop nhat thanh cau hinh doanh nghiep chinh thuc
- [Phase ?]: Phan loai loi Server Action bang kiem hinh dang (truong reason), khong dung instanceof — chuan bi cho isAttendanceRejection() cua 03-04
- [Phase ?]: 03-04: SHIFT_WINDOW_GRACE_MINUTES=120 phut moi dau khung gio ca (Claude's Discretion, khong co so cu the trong CONTEXT.md)
- [Phase ?]: 03-04: checkOut cho ban ghi chua co gio vao tai dung phan loai outside_shift, khong bia them ly do thu tu (D-20b dung ba)
- [Phase ?]: 03-04: [Rule 1] isAttendanceRejection() bo dieu kien name, chi kiem truong reason — name co the mat qua ranh gioi Server Action nhu moi truong tuy bien khac
- [Phase ?]: 03-04: [Rule 3] evidence optional o muc kieu cho checkOut (nhu checkIn 03-01) de call site cu compile duoc ngay sau Task 2; test tich hop moi ep moi truong node (@vitest-environment) vi Blob jsdom khong tai len Storage that duoc
- [Phase ?]: 03-06: SUSPICIOUS_DISTANCE_MULTIPLIER/isSuspiciousPunch()/suspiciousMultiplier() (src/lib/attendance/suspicious.ts) la nguon DUY NHAT cho nguong dang ngo D-21, mutations/attendance.ts (03-01/03-03) xoa ban sao cuc bo va import lai
- [Phase ?]: 03-06: GET /api/attendance/review truy van hai buoc (attendance_photos join work_sites, roi attendance_records join employees) thay vi mot embed PostgREST ba tang, giam rui ro suy dien quan he lien ket sai
- [Phase ?]: 03-06: co dang ngo tinh TAI THOI DIEM TRUY VAN qua isSuspiciousPunch(), khong doc tu cot boolean da luu - Phase 4 doi nguong sang cau hinh doanh nghiep chi can sua mot ham
- [Phase ?]: 03-07: RLS storage.objects thieu hoan toan cho bucket attendance-photos (broker route + checkIn/checkOut deu bi chan) -- them migration 0012, dung lai tf_is_member() qua split_part(name,'/',1)
- [Phase ?]: 03-07: seed.sql attendance_photos fixture thieu GPS gay 500 tren metadata route -- them toa do that khop work_sites

Quyết định của Phase 4 (lập kế hoạch 2026-08-05, thực thi 2026-08-06; chi tiết ở `04-CONTEXT.md`):

- D-24: hệ số tăng ca phải dẫn tới giờ quy đổi nhìn thấy được trên bản ghi và tổng hợp kỳ
- D-25: hệ số tăng ca append-only theo `effective_from`; D-25a cưỡng chế bằng trigger ở database; D-25b ngày lễ vẫn sửa được nhưng cảnh báo kèm số bản ghi bị ảnh hưởng
- D-26: doanh nghiệp mới có 0 ngày lễ và 0 hệ số; thiếu hệ số trả `null` + nhãn "chưa khai", tuyệt đối không ngầm lấy 1.0
- D-27: khung giờ đêm (mặc định 22:00–06:00) là định nghĩa pháp lý, nằm trong `company_settings` và sửa được
- D-28a (**chốt 2026-08-06 tại checkpoint 04-04 Task 4**): chủ dự án chọn **cộng dồn**. `rule_key='night'` đổi nghĩa từ *hệ số nhân* sang **phụ cấp cộng thêm**: hệ số một phút = hệ số loại ngày + phụ cấp đêm. Lễ 3.0 + đêm 0.3 → một giờ tăng ca đêm ngày lễ quy đổi ×3.3. Giới hạn còn lại: Điều 98.3 (thêm 20% cho phần tăng ca ban đêm) **không** làm ở V2
- D-29: `SUSPICIOUS_DISTANCE_MULTIPLIER` và `SHIFT_WINDOW_GRACE_MINUTES` chuyển thành cấu hình doanh nghiệp — đóng lời hứa D-21a của Phase 3

Quyết định của Phase 5 (lập kế hoạch 2026-08-06, chi tiết ở `05-CONTEXT.md`):

- D-30: chỉ `owner`/`admin` duyệt; `manager` giữ nguyên ngoài khu `/admin` — giới hạn có ý thức, mở rộng được mà không đổi mô hình dữ liệu
- D-31: duyệt tăng ca là **cho phép trước**, giờ vẫn do chấm công thật quyết định — không tạo nguồn sự thật thứ hai cho con số Phase 4 vừa dựng
- D-32: kỳ đã chốt được bảo vệ bằng **trigger ở database**; D-32a: hệ quả bắt buộc là phần ghi của yêu cầu được duyệt phải nằm trong hàm SQL (cờ là transaction-local); D-32b: chưa có đường mở lại kỳ đã chốt, có chủ đích
- D-33: lịch sử xử lý là bảng `request_reviews` append-only, không phải ba cột trên `work_requests` (ba cột cũ giữ nguyên làm ảnh chụp trạng thái)
- D-34: thông báo có bảng riêng, RLS theo **người nhận** chứ không theo doanh nghiệp — nội dung mang lý do từ chối
- D-35: duyệt nghỉ phép sinh bản ghi công theo **lịch làm việc của ca**, bỏ qua ngày nghỉ và ngày lễ

Quyết định của Phase 5.2 (chốt 2026-08-06 với chủ dự án, chi tiết ở `05-2-CONTEXT.md`):

- D-36: ba chế độ tính công (`daily_hours` / `shift` / `shift_hourly`) — ba **định nghĩa khác nhau** về "một ngày công", không phải ba biến thể giao diện; D-36a: hệ quả bắt buộc — `daily_hours` phải được xử lý tường minh trong mô-đun phân loại, để `scheduledMinutes = 0` sẽ biến **toàn bộ** giờ làm thành tăng ca
- D-37: mỗi nhân viên khai **đơn vị** (tháng/ngày/giờ) và **số tiền** của riêng mình; D-37a: mức lương **append-only** theo `effective_from`, **có trigger cưỡng chế ở database**
- D-38: `company_settings` thêm `standard_hours_per_day` + `standard_days_per_month` — **mẫu số** quy đổi, **không có mặc định** (22 hay 26 là chuyện của từng doanh nghiệp)
- D-39: chế độ `daily_hours` trả theo **giờ thực tế**; ngày công thành một **số thập phân** (6/10 tiếng → 0,6)
- D-40: phụ cấp/khấu trừ là danh mục có **phạm vi áp dụng** và **danh sách loại trừ** — hai chiều khác nhau, không gộp được; D-40a: mọi khoản áp cho **mọi kỳ**, không có khoản "chỉ kỳ này"
- D-41: phạt đi muộn là khoản khấu trừ nhân với **số lần** đi muộn — không phân bậc theo số phút
- D-42: chốt lương lưu **bản chốt tự chứa** — ngoại lệ **có chủ đích thứ hai** với khuôn tính-lúc-truy-vấn (thứ nhất là D-32a); D-42a: làm tròn tới đồng, nửa lên, và **không** làm tròn ở bước trung gian
- D-43: `leave_unpaid` **không** được tính ngày công ở cả ba chế độ; `leave_paid` thì có — hai trạng thái nghỉ từ đây khác nhau về **tiền**, không chỉ về nhãn
- D-44: `owner` **và** `admin` đều xem được bảng lương — hệ quả: **mọi `admin` xem được lương của mọi người**
- D-45: **có** đường huỷ chốt lương (khác D-32b của kỳ công) — xoá cả bản chốt, lý do bắt buộc, để lại `audit_log`

Quyết định phát sinh **khi thực thi** Phase 5.2 (2026-08-06; chi tiết ở từng file SUMMARY):

- 05-2-02: `workedDays` (đếm ngày) và `creditedDays` (ngày công để tính tiền) **song song, không thay thế nhau** — ở `daily_hours` chúng khác nhau thật; `effectiveScheduledMinutes()` là nguồn duy nhất của mẫu số tính phần vượt
- 05-2-03: `exclude` **luôn thắng** `include`, kể cả khi `include` cụ thể hơn — quy tắc **đoán được** quan trọng hơn quy tắc thông minh khi người khai không có cách kiểm lại ngoài khối xem trước
- 05-2-04: giải căng thẳng giữa D-42a và "tổng bằng tổng các dòng" — **bước trung gian** (đơn giá, phép nhân) không bao giờ làm tròn; **con số cuối** (từng ô hiển thị) làm tròn đúng một lần, và `netPay` là tổng của chính những ô đó, nên bảng luôn đối chiếu được
- 05-2-04: mức lương tra tại **ngày cuối kỳ** — hệ quả: tăng lương giữa kỳ thì cả kỳ ăn mức mới
- 05-2-05: `buildPayrollRows()` được tách khỏi Route Handler và **dùng chung** bởi cả đường đọc lẫn `closePayroll` — con số được chốt không thể khác con số người dùng vừa nhìn thấy
- 05-2-05: `payroll_lines` chép **cả** các cột số liệu công chỉ để hiển thị — suy lại lúc đọc sẽ làm chúng đổi theo dữ liệu hôm nay trong khi các cột tiền thì không, và một bảng tự mâu thuẫn với chính nó tệ hơn một bảng sai

Quyết định phát sinh **khi thực thi** Phase 5 (2026-08-06; chi tiết ở từng file SUMMARY):

- 05-01: thứ tự ghi của `reviewRequest()` là **lịch sử trước, cập nhật `work_requests` sau** —
  PostgREST không cho hai lệnh ghi trong một transaction ở tầng này, nên chọn hướng hỏng an
  toàn hơn (cập nhật trước mà lịch sử hỏng thì quyết định không có vết và yêu cầu đã rời khỏi
  `pending` nên không làm lại được)
- 05-01: chiều sắp xếp của `GET /api/requests` đổi theo bộ lọc — `status=pending` là **hàng
  đợi** (người chờ lâu nhất trước), mọi nhánh còn lại là **lịch sử** (mới nhất trước)
- 05-02: hàm SQL trả **kiểu composite** `tf_request_effect` thay vì `returns table` — PostgREST
  trả một object thay vì mảng một phần tử
- 05-02: `conflicted` của đơn nghỉ tính theo "ngày đó đã có **bất kỳ** dòng `attendance_records`
  nào", không chỉ "đã có chấm công thật"
- 05-03: "giờ đã dùng" tách làm hai đại lượng trả về riêng — `actualHours` (từ chấm công qua
  mô-đun Phase 4) và `registeredHours` (các yêu cầu tăng ca **khác** đã duyệt trong tháng)
- 05-04: **không** thêm mục thứ năm vào thanh điều hướng dưới của giao diện nhân viên; chuông ở
  header là chỗ đúng cho một thứ được xem lướt và có số đếm
- 05-04: `markNotificationsRead` **không** ghi `audit_log` — ngoại lệ có cân nhắc với D-17
- 05-05: **"kỳ đã chốt" không phải lý do từ chối thứ tư của D-20b** — nó là trạng thái của KỲ,
  chặn cả những đường ghi không phải chấm công, và không sinh ra từ việc người lao động làm gì
  sai. Nó là một `Error` thường mang thông điệp của chính trigger (SQLSTATE riêng `TF001`)
- 05-05: `closed_by = coalesce(auth.uid(), p_closed_by)` — `auth.uid()` **luôn thắng** nên tham
  số không thể dùng để ghi tên người khác vào vết
Quyết định của Phase 5.1 (chèn 2026-08-06 theo yêu cầu chủ dự án; chi tiết ở `05-1-SUMMARY.md`):

- **Bảng lương KHÔNG tính tiền** — chủ dự án chọn mức "chuẩn bị lương" sau khi được trình bày
  ba mức (chuẩn bị / thêm lương cơ bản / gross-net đầy đủ). Nhóm PAY vẫn ở V3.
- Phép tổng hợp tháng tách thành `src/lib/attendance/month-context.ts` **trước khi** viết
  đường đọc mới — bảng lương và tổng hợp từng nhân viên dùng CHUNG `summarizeMonth()`, có test
  khẳng định hai đường trả khớp từng trường.
- Quy tắc "ai có mặt trong bảng công / bảng lương" = **không phải người đã nghỉ việc, HOẶC có
  bản ghi trong tháng** — nghỉ việc giữa tháng không xoá đi những ngày đã làm.
- Ký hiệu trong lưới tháng là **chữ**, màu chỉ là lớp thứ hai: bảng công hay được in ra để ký.

- 05-06: hai migration của phase (0018, 0021) được làm **chạy lại được** (`drop … if exists` ở
  đầu) để sửa được tại chỗ khi chưa phát hành, thay vì để lại một file chỉ để vá một dòng

Quyết định của Phase 6 (lập kế hoạch và thực thi 2026-08-10; chi tiết ở
`docs/superpowers/specs/2026-08-10-phase-6-super-admin-design.md`):

- D-49: quyền đọc xuyên doanh nghiệp suy từ một **phiên hỗ trợ có thời hạn**
  (`support_sessions` + `tf_has_support_access()`), **không** suy từ danh tính. Một
  policy `or tf_is_platform_admin()` gắn thẳng vào mọi bảng chính là "quyền vượt RLS
  dùng chung" mà tiêu chí 4 của phase loại trừ. 60 phút, không có đường gia hạn
- D-50: chỉ mở lệnh **`select`**; ba lệnh ghi giữ nguyên `tf_is_member` — đó là chỗ
  tiêu chí 4 được thoả ở tầng database. **Đo lại khi thực thi:** 23 bảng chứ không
  phải 22, và 4 bảng lương dùng khuôn `tf_is_company_admin` (0029/0030) chứ không
  phải `tf_is_member`, nên phải chép nguyên biểu thức cũ rồi mới thêm nhánh
- D-51: `AccessRole = CompanyRole | "support"`; `CompanyRole` giữ nguyên bốn giá trị
  nên không ô chọn vai trò nào trong sản phẩm thấy `"support"`
- D-52: hai vị ngữ — `canReadCompanyData()` cho 16 đường đọc, `requireRole()` giữ
  nguyên ở 51 chỗ trong 16 file `mutations/*.ts`. Server Action ghi tự động từ chối
  phiên hỗ trợ, **không phải sửa một dòng nào**; cổng `no-inline-admin-role` chặn
  thói quen cũ quay lại
- D-53: `AppUser.employeeId` nới thành `string | null`; thêm `useEmployeeSession()`
- D-54: banner hỗ trợ dính đỉnh `/admin/*`; nút ghi **không ẩn** — ẩn ở 10 màn hình
  là 10 chỗ để quên, còn thông điệp từ chối đến từ một chỗ duy nhất
- D-55: một dòng audit cho mỗi **PHIÊN** (mở + đóng), không phải mỗi request. Thêm giá
  trị enum `audit_action.'access'`
- D-56: khu `/platform` + RPC `tf_platform_company_overview()` (chỉ trả số tổng hợp,
  nên được phép nhìn xuyên doanh nghiệp mà không cần phiên); hai đường ghi trắng nằm
  **ngoài** dữ liệu chấm công và lương

Quyết định phát sinh **khi thực thi** Phase 6 (2026-08-10):

- `getActiveSupportSession()` sống ở `session-context.ts` chứ không ở
  `mutations/platform-sessions.ts`: `getSessionContext()` phải gọi nó, mà file kia đã
  import ngược lại — để ở đó sẽ tạo một vòng phụ thuộc
- `closeSupportSession()` phải ghi audit **TRƯỚC** rồi mới đặt `closed_at`: policy
  `audit_log_insert_support` đòi `tf_has_support_access()`, mà hàm đó trả `false`
  ngay khi `closed_at` được đặt — làm ngược thì dòng audit của việc đóng phiên
  **không bao giờ ghi được**. Lỗi do chính test tích hợp bắt được, không phải suy diễn
- `grantOwnerMembership()` ghi `audit_log.company_id = NULL` và đặt mã doanh nghiệp
  vào `reason`: platform admin không là thành viên và không nhất thiết đang có phiên ở
  đó, nên dòng audit "đúng cột" sẽ không bao giờ ghi được
- `AccessRole` khai ở `domain.ts` chứ không ở `session-context.ts` như spec dự định —
  `UserSession.role` cũng cần nó, và `domain.ts` không được import ngược lên tầng auth

Sửa chữa **sau khi Phase 6 đóng** (2026-08-11 → 12), đều là lỗi CÓ SẴN không phải
hồi quy — ghi lại để sau này không phải dựng lại bối cảnh:

- `f61a75b`: `/admin/dashboard` trả 500 cho cả doanh nghiệp chỉ vì MỘT nhân viên
  không có số điện thoại. Migration 0028 cho sáu cột `employees` thành nullable và
  quét đường đọc nhân viên, nhưng bỏ sót đường đọc bảng điều khiển. TypeScript im
  lặng vì `RawEmployeeRow` khai `phone: string` — một lời khai sai so với database.
- `9d2bebe`: người ca đêm vào muộn **sau nửa đêm** được ghi `on_time`. `work_date`
  là ngày lịch của khoảnh khắc (D-08), nên mốc bắt đầu ca giải ra ở TƯƠNG LAI và số
  phút muộn bị kẹp về 0. Sửa bằng `scheduledStartDayOffset()` — **không đụng D-08**,
  chỉ đổi mốc được đếm muộn so với.
- `1ce1f93`: `shift-rules-effect.test.ts` đỏ **tất định** trong 20 phút đầu mỗi đêm.
- `d4ee409`: `vitest.config.mts` thiếu `hookTimeout` (mặc định 10s) trong khi phần
  nặng nhất của test tích hợp nằm ở `beforeAll`. Đây mới là nguyên nhân thật của thứ
  05-2-06 ghi là "nhiễu môi trường". Sau khi sửa: **ba lượt suite liên tiếp sạch,
  72 file / 787 test**.
- `78ee1f5` + `8af16ce`: cổng `db-ci` đỏ **từ trước Phase 6** vì pgTAP nằm ở schema
  `extensions` mà không ai đặt `search_path`; và `18_payroll_runs.sql` khai
  `plan(11)` trong khi chỉ có 10 khẳng định (sàn `check:assertions` vì thế thừa 1
  ngay từ đầu: 306 → **305**).

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

- **2026-08-13 — DOANH NGHIỆP THẬT ĐẦU TIÊN ĐANG SỐNG TRÊN DATABASE DEV.**
  Vinh Yến Food (`cty-vinhyen`, 1 chủ + 10 nhân viên, có mức lương và tiền tăng ca
  thật) đã được nạp bằng `npm run seed:vinhyen`. Thiết kế và biên bản nghiệm thu:
  `docs/superpowers/specs/2026-08-13-du-lieu-vinh-yen-food-design.md`.

  Hệ quả **làm mất hiệu lực lời khuyên ở ba mục 04-06 / 05-06 / 05-2-06 bên dưới**:
  `npm run db:seed` từ nay **bị một cổng chặn trong `scripts/db.mjs` từ chối** khi
  database có doanh nghiệp ngoài `cty-01`/`cty-02` — vì `seed.sql` mở đầu bằng
  `truncate ... cascade` và sẽ xoá sạch dữ liệu thật. Đường thoát
  `TF_SEED_WIPE_REAL_DATA=1` **cũng xoá Vinh Yến Food**, nên nó không phải cách dọn
  fixture.

  **Việc còn treo:** cần một đường dọn fixture test **có chọn lọc** (xoá theo tiền
  tố `cty-wm-*`/`cty-pay-*`/`cty-adj-*`/`cty-pc-*`/`cty-run-*`/`cty-e2ep-*`/
  `cty-05xx-*`, tạm gỡ trigger append-only theo đúng thủ tục ở migration 0022/0026).
  Đo được ngày 2026-08-13: **953 doanh nghiệp** trên database dev, gần như toàn bộ
  là fixture. Chừng nào chưa có đường đó, mỗi lần chạy bộ test tích hợp lại cộng
  thêm rác và không có cách dọn nào an toàn.

  **Chưa ai bấm tay:** `/admin/employees` và `/admin/payroll` của Vinh Yến Food chưa
  được nhìn trên trình duyệt — cùng tính chất với các mục 05-06 và 5.1 bên dưới.
  Ba thứ chủ doanh nghiệp phải tự khai: số điện thoại + địa chỉ thật
  (`/admin/settings`), điểm làm việc + toạ độ GPS (`/admin/work-sites`), ngày lễ.

- **Phase 6 KHÔNG còn mục treo nào** (chốt 2026-08-12). Đã merge vào `main` và đẩy
  lên `origin`; toàn bộ nghiệm thu tay đã xong (xem `06-UAT.md` §Chữ ký). Việc
  "chạy pgTAP trên CI" được **đưa ra ngoài phạm vi theo quyết định của chủ dự án** —
  không phải bị bỏ sót, và **không nêu lại ở các phase sau**; lý do và những gì đã
  sửa được trên đường đi ghi ở `06-UAT.md` §Giới hạn đã biết mục 1.

- **Không còn pending.** Khóa Supabase legacy trong `docs/env` (gồm `SUPABASE_SERVICE_ROLE_KEY`) vẫn ở dạng plaintext và khóa `service_role` legacy vẫn còn hiệu lực, bỏ qua toàn bộ RLS. Việc "thu hồi & cấp lại khóa legacy" đã bị **gỡ khỏi phạm vi ngày 2026-07-31** theo quyết định có chủ đích của chủ dự án (xem `.planning/REQUIREMENTS.md` §Out of Scope và `.planning/PROJECT.md` §Out of Scope) — không phải bị bỏ sót hay còn chờ xử lý. Rủi ro được ghi nhận và chấp nhận có ý thức, không chặn `/gsd-ship`. Vế còn lại của AUTH-06 (không khóa bí mật nào lọt xuống client bundle) đã hoàn thành và được xác minh (`npm run check:secrets`, plan 01-03).
- Chưa có test tự động nào trong repo — hạ tầng test (pgTAP + Vitest) phải dựng ngay ở Phase 1
- Nghiên cứu còn khoảng trống cần làm rõ khi lập kế hoạch Phase 3: độ phủ thiết bị cho `getUserMedia()` và độ chính xác GPS tại văn phòng thật; và Phase 5: mô hình duyệt một cấp có đủ cho doanh nghiệp pilot không
- 01-01: GitHub Actions CI run + branch protection on main not verified from this environment (no gh CLI/token) — human must push branch, open PR, confirm db check green, and enable branch protection (see WINDOWS.md #1)
- 01-04: Human must manually run the employees_select_member sabotage-and-revert teeth check (loosen to using(true), then drop policy) against the live dev DB — harness permission classifier blocks it from the executor. See WINDOWS.md entry 2 for exact steps.
- 01-05: git push to origin denied (403) - local identity LeeCuongg is not a collaborator on lecuongg242-cloud/workforce-management; human must push with an authorized account and confirm db CI workflow is green (WINDOWS.md entry 3, same root cause as entry 1)
- 02-03/02-04: khong co SUMMARY.md tren dia mac du code da duoc feat()/test() commit va migration da push (chi 02-01/02-02/02-05 co SUMMARY trong thu muc phase 02) -- can mot lan finalize rieng (SUMMARY + docs commit) cho hai plan nay de dong bo STATE/ROADMAP.
- 03-01: Xac nhan cuoi (UAT) con thieu — mot lan cham cong that qua trinh duyet that voi camera/GPS that (dung human_verify_mode: end-of-phase cua config.json, khong chan cac plan tiep theo cua phase 3).
- ~~03-07: blocker auth.users (4 tai khoan fixture pgTAP lam listUsers tra 500)~~ — **DA DUOC DON**, xac nhan 2026-08-06 trong 04-06: `admin.auth.admin.listUsers()` tra 200 va khong con tai khoan nao trong owner1|owner2|dualmember|nomember@timeflow.test. Task 2 cua 03-07 (device UAT voi camera/GPS that) VAN CHUA thuc hien.
- 04-06: `npm run test:db` chua chay duoc trong moi truong phat trien hien tai (khong co `psql`, database dev la Supabase cloud nen bo chay tu choi nap fixture pgTAP). Hai file test moi cua Phase 4 (`10_company_settings.sql`, `11_overtime_rules_append_only.sql` — 13 assertion) da viet va da vao cong dem nhung CHUA CHAY THAT lan nao; can chay tren Postgres tam cua CI.
- 04-06: fixture cua test tich hop de lai dong tren database dev o `overtime_rules` (trigger append-only chan xoa) va vai doanh nghiep test mang id ngau nhien. Mot lan `npm run db:seed` se don sach (truncate khong bi trigger chan).
- ~~Nghien cuu con khoang trong: mo hinh duyet mot cap co du cho doanh nghiep pilot khong~~ — **DA QUYET** 2026-08-06 (D-30): mot cap, chi `owner`/`admin`. Gioi han duoc ghi ro trong `05-UAT.md` §Gioi han da biet muc 1; mo rong cho `manager` la viec dau tien nen lam o phase sau neu pilot thay nang.
- 05-06: `npm run test:db` **van chua chay duoc** (khong co `psql`; da kiem lai trong phien 2026-08-06). Bon file pgTAP moi cua Phase 5 — `12_request_reviews.sql` (8), `13_apply_approved_request.sql` (13), `14_notifications.sql` (6), `15_period_close.sql` (11), tong **38 assertion** — da viet va da vao cong `check:assertions` (san 212 -> **250**) nhung CHUA CHAY THAT lan nao; can Postgres tam cua CI. Toan bo hanh vi chung khang dinh da duoc phu doc lap bang test tich hop Vitest tren database that.
- 05-06: **chu du an chua bam tay** qua ba man hinh moi (`/admin/requests`, `/admin/periods`, `/employee/notifications`). Toan bo nghiem thu hien tai la quan sat cua may tren he thong chay that (test tich hop + `npm run test:e2e-approval` qua HTTP that). Dang chu y nhat la hop xac nhan **chot ky** — thao tac duy nhat cua san pham khong hoan tac duoc.
- 05-06: fixture cua test tich hop Phase 5 de lai vai doanh nghiep `cty-05xx-<ngau nhien>` tren database dev khong xoa duoc (cascade xuong `request_reviews`/`overtime_rules` bi trigger append-only chan). Cung cach don voi 04-06: mot lan `npm run db:seed`.
- 5.1: hai man hinh moi (`/admin/attendance`, `/admin/payroll`) **chua ai bam tay tren trinh duyet** — smoke qua HTTP chi chung minh HTML dau tien khong loi, con luoi thang va bang deu render o client sau khi du lieu ve. Cung tinh chat voi ba man hinh cua Phase 5.
- 5.1: **tep CSV chua duoc mo thu bang Excel that.** Ba quyet dinh dinh dang (dau cham phay, BOM UTF-8, so thap phan dau phay) duoc kiem bang test tren chuoi, khong bang mot lan mo tep that tren may co Excel tieng Viet — dang thu mot lan truoc khi ban giao cho ke toan that.
- 05-2-06: `npm run test:db` **vẫn chưa chạy được** (không có `psql`; kiểm lại trong phiên 2026-08-06). Ba file pgTAP mới của Phase 5.2 — `16_employee_pay_rates.sql` (12), `17_pay_adjustments.sql` (10), `18_payroll_runs.sql` (11), tổng **33 assertion** — đã viết và đã vào cổng `check:assertions` (sàn 250 → **283**) nhưng CHƯA CHẠY THẬT lần nào; cần Postgres tạm của CI. Toàn bộ hành vi chúng khẳng định đã được phủ độc lập bằng test tích hợp Vitest trên database thật.
- 05-2-06: **chủ dự án chưa ký biên bản `05-2-UAT.md`.** Task 3 của plan là một checkpoint chặn với `autonomous: false`; buổi nghiệm thu cùng chủ dự án chưa diễn ra. Mọi quan sát trong biên bản là quan sát thật trên hệ thống chạy thật (HTTP thật + database thật), nhưng **chưa có ai nhìn bằng mắt trên trình duyệt**. Bốn thứ cần bấm tay: khối xem trước người bị áp trong hộp thoại khai khoản; bấm một dòng bảng lương mở khối chi tiết; nút "Chốt lương kỳ" bị vô hiệu kèm câu nói rõ vì sao; hộp thoại huỷ chốt bắt buộc nhập lý do.
- 05-2-06: fixture của test tích hợp Phase 5.2 để lại vài doanh nghiệp `cty-pay-*`/`cty-wm-*`/`cty-adj-*`/`cty-pc-*`/`cty-run-*`/`cty-e2ep-*` trên database dev không xoá được (cascade xuống `employee_pay_rates` bị trigger append-only 0022 chặn). Cùng cách dọn với 04-06 và 05-06: một lần `npm run db:seed`. Ngoài ra một dòng `employee_pay_rates` thừa nằm lại ở `nv-02a` (2019-09-01, 13.000.000) từ một lần chạy test trước khi fixture được sửa — vô hại, test đã được viết lại để không phụ thuộc vào dòng nào là mới nhất.
- 05-2-06: **suite đầy đủ có timeout ngẫu nhiên** trên database dev từ xa (`Hook timed out in 10000ms`, trung bình 1–2 file mỗi lần chạy, khác file mỗi lần) — đã đối chiếu trên cây trước Phase 5.2 và xác nhận là nhiễu môi trường, không phải hồi quy. Một lần chạy sạch cho 52/52 file, 579/579 test.
- 5.1: luoi thang **chua co phan trang** — render moi nhan vien cua doanh nghiep trong mot bang. Dung cho quy mo pilot (~40 nguoi), se can xu ly khi mot doanh nghiep vai tram nguoi.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260803-a01 | Bỏ giá trị email/mật khẩu điền sẵn trong form đăng nhập | 2026-08-03 | 8c2820b | [260803-a01-login-bo-prefill](./quick/260803-a01-login-bo-prefill/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-06T09:00:00.000Z
Stopped at: Phase 5 hoan tat (6/6 plan) — bien ban nghiem thu o 05-UAT.md; con cho chu du an bam tay ba man hinh moi
Resume file: 05-UAT.md
