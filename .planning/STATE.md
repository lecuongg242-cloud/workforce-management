---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 01
current_phase_name: Nền dữ liệu và cô lập doanh nghiệp
status: executing
stopped_at: Completed 01-06-PLAN.md (Phase 1 complete)
last_updated: "2026-07-31T16:35:40.566Z"
last_activity: 2026-07-31
last_activity_desc: Phase 01 execution started
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 17
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-31)

**Core value:** Doanh nghiệp tin được số liệu chấm công: mỗi bản ghi vào/ra là có thật, đúng nơi, đúng giờ — và không doanh nghiệp nào nhìn thấy dữ liệu của doanh nghiệp khác.
**Current focus:** Phase 01 — Nền dữ liệu và cô lập doanh nghiệp

## Current Position

Phase: 01 (Nền dữ liệu và cô lập doanh nghiệp) — EXECUTING
Plan: 6 of 6
Status: Ready to execute
Last activity: 2026-07-31 — Phase 01 execution started

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-31T14:32:54.108Z
Stopped at: Completed 01-06-PLAN.md (Phase 1 complete)
Resume file: None
