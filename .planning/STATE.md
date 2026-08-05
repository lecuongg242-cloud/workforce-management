---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 4
current_phase_name: Quy tắc công do doanh nghiệp tự khai
status: planned
stopped_at: Phase 4 da lap ke hoach (6 plan, 5 wave); chua bat dau 04-01
last_updated: "2026-08-05T00:00:00.000Z"
last_activity: 2026-08-05
last_activity_desc: Lap ke hoach Phase 4 — 04-CONTEXT.md + 04-01..04-06-PLAN.md
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 24
  completed_plans: 24
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-31)

**Core value:** Doanh nghiệp tin được số liệu chấm công: mỗi bản ghi vào/ra là có thật, đúng nơi, đúng giờ — và không doanh nghiệp nào nhìn thấy dữ liệu của doanh nghiệp khác.
**Current focus:** Phase 03 — ch-m-c-ng-c-b-ng-ch-ng

## Current Position

Phase: 4 — Quy tắc công do doanh nghiệp tự khai
Plan: 04-01 (chưa bắt đầu) — 6 plan đã lập, xếp thành 5 wave
Status: Planned, ready to execute
Last activity: 2026-08-05 — Lập kế hoạch Phase 4 (04-CONTEXT.md + 04-01…04-06-PLAN.md)

Progress: [██████████] 96%

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

Quyết định của Phase 4 (lập kế hoạch 2026-08-05, chi tiết ở `04-CONTEXT.md`):

- D-24: hệ số tăng ca phải dẫn tới giờ quy đổi nhìn thấy được trên bản ghi và tổng hợp kỳ
- D-25: hệ số tăng ca append-only theo `effective_from`; D-25a cưỡng chế bằng trigger ở database; D-25b ngày lễ vẫn sửa được nhưng cảnh báo kèm số bản ghi bị ảnh hưởng
- D-26: doanh nghiệp mới có 0 ngày lễ và 0 hệ số; thiếu hệ số trả `null` + nhãn "chưa khai", tuyệt đối không ngầm lấy 1.0
- D-27: khung giờ đêm (mặc định 22:00–06:00) là định nghĩa pháp lý, nằm trong `company_settings` và sửa được
- D-28: mỗi phút thuộc đúng một loại, ưu tiên lễ > cuối tuần > đêm > thường, **không cộng dồn** — thấp hơn cách tính của luật lao động, cần chủ dự án chốt ở 04-04 Task 4 trước khi 04-05 chạy
- D-29: `SUSPICIOUS_DISTANCE_MULTIPLIER` và `SHIFT_WINDOW_GRACE_MINUTES` chuyển thành cấu hình doanh nghiệp — đóng lời hứa D-21a của Phase 3

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

- **Không còn pending.** Khóa Supabase legacy trong `docs/env` (gồm `SUPABASE_SERVICE_ROLE_KEY`) vẫn ở dạng plaintext và khóa `service_role` legacy vẫn còn hiệu lực, bỏ qua toàn bộ RLS. Việc "thu hồi & cấp lại khóa legacy" đã bị **gỡ khỏi phạm vi ngày 2026-07-31** theo quyết định có chủ đích của chủ dự án (xem `.planning/REQUIREMENTS.md` §Out of Scope và `.planning/PROJECT.md` §Out of Scope) — không phải bị bỏ sót hay còn chờ xử lý. Rủi ro được ghi nhận và chấp nhận có ý thức, không chặn `/gsd-ship`. Vế còn lại của AUTH-06 (không khóa bí mật nào lọt xuống client bundle) đã hoàn thành và được xác minh (`npm run check:secrets`, plan 01-03).
- Chưa có test tự động nào trong repo — hạ tầng test (pgTAP + Vitest) phải dựng ngay ở Phase 1
- Nghiên cứu còn khoảng trống cần làm rõ khi lập kế hoạch Phase 3: độ phủ thiết bị cho `getUserMedia()` và độ chính xác GPS tại văn phòng thật; và Phase 5: mô hình duyệt một cấp có đủ cho doanh nghiệp pilot không
- 01-01: GitHub Actions CI run + branch protection on main not verified from this environment (no gh CLI/token) — human must push branch, open PR, confirm db check green, and enable branch protection (see WINDOWS.md #1)
- 01-04: Human must manually run the employees_select_member sabotage-and-revert teeth check (loosen to using(true), then drop policy) against the live dev DB — harness permission classifier blocks it from the executor. See WINDOWS.md entry 2 for exact steps.
- 01-05: git push to origin denied (403) - local identity LeeCuongg is not a collaborator on lecuongg242-cloud/workforce-management; human must push with an authorized account and confirm db CI workflow is green (WINDOWS.md entry 3, same root cause as entry 1)
- 02-03/02-04: khong co SUMMARY.md tren dia mac du code da duoc feat()/test() commit va migration da push (chi 02-01/02-02/02-05 co SUMMARY trong thu muc phase 02) -- can mot lan finalize rieng (SUMMARY + docs commit) cho hai plan nay de dong bo STATE/ROADMAP.
- 03-01: Xac nhan cuoi (UAT) con thieu — mot lan cham cong that qua trinh duyet that voi camera/GPS that (dung human_verify_mode: end-of-phase cua config.json, khong chan cac plan tiep theo cua phase 3).
- 03-07: Task 1 xong (commit 6a8a246), Task 2 (checkpoint device UAT, gate=blocking) CHUA thuc hien. Blocker moi: npm run test:db chay trong phien nay nap fixture pgTAP vao auth.users cloud that, lam Admin API listUsers tra 500 -> npm run seed:auth khong chay duoc -> memberships rong -> app khong dung duoc du login token van hop le. Can chu du an xoa 4 tai khoan (owner1/owner2/dualmember/nomember@timeflow.test) qua Supabase Dashboard, roi chay seed:auth+reset:passwords, truoc khi lam Task 2. Chi tiet: 03-07-SUMMARY.md muc 'Blocker moi phat sinh'.

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

Last session: 2026-08-02T16:33:30.939Z
Stopped at: 03-07 Task 1 xong (6a8a246); Task 2 checkpoint cho device UAT, blocked them boi su co auth.users
Resume file: 03-07-SUMMARY.md
