---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 01
current_phase_name: Nền dữ liệu và cô lập doanh nghiệp
status: executing
stopped_at: Completed 01-04-PLAN.md
last_updated: "2026-07-31T13:45:05.505Z"
last_activity: 2026-07-31
last_activity_desc: Phase 01 execution started
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 6
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-31)

**Core value:** Doanh nghiệp tin được số liệu chấm công: mỗi bản ghi vào/ra là có thật, đúng nơi, đúng giờ — và không doanh nghiệp nào nhìn thấy dữ liệu của doanh nghiệp khác.
**Current focus:** Phase 01 — Nền dữ liệu và cô lập doanh nghiệp

## Current Position

Phase: 01 (Nền dữ liệu và cô lập doanh nghiệp) — EXECUTING
Plan: 4 of 6
Status: Ready to execute
Last activity: 2026-07-31 — Phase 01 execution started

Progress: [███████░░░] 67%

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
| Phase 01 P04 | 19min | 2 tasks | 4 files |

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

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

- Khóa Supabase trong `docs/env` (gồm `SUPABASE_SERVICE_ROLE_KEY`) vẫn ở dạng plaintext — phải thu hồi trong Phase 1 trước khi nối backend thật
- Chưa có test tự động nào trong repo — hạ tầng test (pgTAP + Vitest) phải dựng ngay ở Phase 1
- Nghiên cứu còn khoảng trống cần làm rõ khi lập kế hoạch Phase 3: độ phủ thiết bị cho `getUserMedia()` và độ chính xác GPS tại văn phòng thật; và Phase 5: mô hình duyệt một cấp có đủ cho doanh nghiệp pilot không
- 01-01: GitHub Actions CI run + branch protection on main not verified from this environment (no gh CLI/token) — human must push branch, open PR, confirm db check green, and enable branch protection (see WINDOWS.md #1)
- 01-04: Human must manually run the employees_select_member sabotage-and-revert teeth check (loosen to using(true), then drop policy) against the live dev DB — harness permission classifier blocks it from the executor. See WINDOWS.md entry 2 for exact steps.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-31T13:45:05.488Z
Stopped at: Completed 01-04-PLAN.md
Resume file: None
