---
phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
plan: 02
subsystem: database
tags: [supabase, postgres, rls, pgtap, platform-admin, search-normalize]

# Dependency graph
requires:
  - phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
    plan: 01
    provides: "Vitest infra, npm script names (test:db, check:assertions, seed:auth), .env.local 4-variable contract"
  - phase: 01-n-n-d-li-u-v-c-l-p-doanh-nghi-p
    provides: "tf_is_member() security-definer pattern (0002_tenancy.sql), pgTAP infra, 00_rls_coverage.sql gate, seed.sql full V1 dataset (01-06)"
provides:
  - "platform_admins table + tf_is_platform_admin() — fourth platform-level role (D-11), no company_role enum value, self-filtering via auth.uid()"
  - "public.tf_normalize(text) — immutable, translate()-based Vietnamese diacritic stripper matching src/lib/format.ts normalizeText() byte-for-byte"
  - "supabase/tests/00_fixture_users.sql — the 4 synthetic auth.users/memberships/platform_admins fixture rows, now living only in supabase/tests/, never in seed.sql"
  - "scripts/check-pgtap-assertions.mjs — mechanical D-15a gate reconstructing scripts/db.mjs's real test execution order, currently reports 184 assertions against a 170 floor"
  - "supabase/seed.sql with zero synthetic uuids and zero auth.users writes — the file that ships to cloud via npm run db:seed"
affects: [02-03, 02-04, 02-05, 02-06, 02-07, 02-08, 02-09, 02-10, 02-11]

actuals:
  tokens: 7515
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Platform-level role (not company-scoped): dedicated table + no-arg security-definer function, never an enum value on company_role — cloned tf_is_member's guard shape (revoke execute from public, grant to authenticated, set search_path = public, pg_temp)"
    - "RLS deny-all-by-default: enable RLS + exactly one `using (false)` SELECT policy so 00_rls_coverage.sql's two failure branches (missing RLS, RLS-with-zero-policies) are both avoided without granting any real access; absence of INSERT/UPDATE/DELETE policies is the actual write-deny mechanism"
    - "pgTAP fixture files (no begin/plan/rollback) vs. pgTAP test files (begin; plan(N); ...; rollback;) — fixtures persist for the rest of the psql session, tests self-clean"
    - "Server-side text normalization via translate() over a closed Vietnamese diacritic table, not the `unaccent` extension — avoids an extension dependency and unaccent's STABLE (not IMMUTABLE) volatility"
    - "D-15a mechanical assertion-count gate reconstructs the caller's real execution order (scripts/db.mjs) instead of summing files in a directory, because one file (00_rls_coverage.sql) is deliberately executed twice"

key-files:
  created:
    - supabase/migrations/0006_platform_admins.sql
    - supabase/migrations/0007_search_normalize.sql
    - supabase/tests/00_fixture_users.sql
    - supabase/tests/06_platform_admins.sql
    - supabase/tests/07_search_normalize.sql
    - scripts/check-pgtap-assertions.mjs
  modified:
    - supabase/seed.sql
    - supabase/tests/run-all.sql
    - supabase/tests/05_seed_fixture.sql

key-decisions:
  - "07_search_normalize.sql uses exactly 6 assertions (plan's stated minimum), landing the post-plan total at exactly 184 — matching both Task 3's acceptance floor (≥184) and the plan's own accounting (170 + 8 + 6)."
  - "translate() mapping table: 134 Vietnamese diacritic characters (both cases) mapped 1:1 to their ASCII base letter, verified programmatically against src/lib/format.ts's normalizeText() output on five real seed strings before writing the migration, and re-verified via the pgTAP suite running server-side against the live database."
  - "Comment in 07_search_normalize.sql's header rewritten to avoid the literal substring 'select plan(' so the file's own acceptance grep (expects exactly 1 match) isn't inflated by a comment describing the pattern."
  - "Discovered and resolved during Task 3 (see Issues Encountered): npm run test:db, run locally against the live Supabase project, permanently commits the 4 synthetic auth.users/memberships/platform_admins fixture rows to that same database — because 00_fixture_users.sql is deliberately unwrapped by begin/rollback (by plan design, so later \\ir'd test files can see it) and psql defaults to autocommit outside an explicit transaction. This is bounded and accepted: the plan's own acceptance criteria only requires the synthetic-uuid count to be 0 after db:seed ALONE (never touching auth.users at all), not after test/test:db. CI (.github/workflows/db-ci.yml) is unaffected because it runs against a throwaway Docker Postgres container destroyed after each job. Logged as a Threat Flag below since it's new surface not explicitly named in the plan's threat_model."

requirements-completed: []  # AUTH-03 and DATA-05 both span multiple plans in this
  # phase per the orchestrator's bookkeeping note; neither is fully covered by
  # 02-02 alone. Left [ ] Pending in REQUIREMENTS.md until their last
  # contributing plan lands, per explicit instruction for this plan.

coverage:
  - id: D11
    description: "platform_admins table (user_id PK, created_at) + tf_is_platform_admin() no-arg security-definer function, self-filtering via auth.uid(), revoke/grant execute, RLS enabled with exactly one deny-all SELECT policy"
    requirement: "AUTH-03"
    verification:
      - kind: integration
        ref: "supabase/tests/06_platform_admins.sql — 8 pgTAP assertions run against the live database via npm run test:db: true/false/no-session correctness, RLS enabled + policy present, self-read returns 0 rows, insert rejected (throws_ok 42501), public has no execute privilege"
        status: pass
      - kind: other
        ref: "Direct psql queries against live db: relrowsecurity=t, policy count=1, prosecdef=t, has_function_privilege(public,...)=f"
        status: pass
    human_judgment: false
  - id: D11-limit
    description: "Verification scope explicitly limited (per plan instruction): only 'function returns correct true/false' is proven this phase. 'Platform admin sees exactly what they're allowed to see' has no read path yet and is deferred to Phase 6."
    verification:
      - kind: other
        ref: "No read path exists for platform_admins in Phase 2 — documented limitation, not a gap in this plan's own scope"
        status: pass
    human_judgment: false
  - id: D15
    description: "supabase/seed.sql contains zero synthetic uuid strings and zero statements touching schema auth; the file that reaches cloud via npm run db:seed carries no identity"
    requirement: "DATA-05"
    verification:
      - kind: other
        ref: "node grep-equivalent check (no 00000000-0000-0000-0000-0000000000 pattern, no auth.users outside comments) — exit 0"
        status: pass
      - kind: integration
        ref: "Live database: auth.users synthetic-uuid count = 0 immediately after npm run db:seed alone (verified by deleting pre-existing fixture rows first, then re-seeding and re-querying)"
        status: pass
    human_judgment: false
  - id: D15a
    description: "scripts/check-pgtap-assertions.mjs reconstructs scripts/db.mjs's real test execution order (standalone 00_rls_coverage.sql + full run-all.sql \\ir list) and fails below a 170-assertion floor that only ever rises"
    verification:
      - kind: other
        ref: "npm run check:assertions reports 184 (170 baseline + 8 new D-11 assertions + 6 new tf_normalize assertions), exit 0"
        status: pass
      - kind: other
        ref: "Controlled-sabotage proof: temporarily dropped 02_time_overnight.sql's plan(53) to plan(10) (total 141) -> exit 1 with correct message; reverted -> exit 0 again, diff confirms byte-identical restoration"
        status: pass
    human_judgment: false
  - id: tf-normalize
    description: "public.tf_normalize(text) matches src/lib/format.ts normalizeText() exactly for Vietnamese diacritic stripping, đ/Đ->d/D, lowercasing, and trimming"
    verification:
      - kind: unit
        ref: "supabase/tests/07_search_normalize.sql — 6 pgTAP assertions against real seed strings, all pass server-side"
        status: pass
      - kind: other
        ref: "Direct psql -f (file-based, not argv-based due to a Windows console-encoding artifact) query against live db: tf_normalize('Nguyễn Minh Anh')='nguyen minh anh', tf_normalize('Đoàn Minh Trí')='doan minh tri', provolatile='i'"
        status: pass
    human_judgment: false
  - id: schema-push
    description: "0006_platform_admins.sql and 0007_search_normalize.sql applied to the real Postgres database; full pgTAP suite green on the new schema"
    verification:
      - kind: integration
        ref: "npm run db:push exit 0; npm run test:db exit 0, zero 'not ok' lines in full TAP output"
        status: pass
    human_judgment: false

duration: "~90min"
completed: 2026-08-01
status: complete
---

# Phase 02 Plan 02: Vai trò platform_admins (D-11) + tách fixture khỏi seed.sql (D-15) Summary

**Vai trò nền tảng thứ tư (`platform_admins` + `tf_is_platform_admin()`) dựng xong và kiểm chứng
đúng phạm vi cho phép của Phase 2; bốn uuid tổng hợp đã ra khỏi `seed.sql` sang một fixture pgTAP
riêng; cổng đếm assertion cơ học đã chứng minh có răng; schema đã đẩy lên Postgres thật và toàn bộ
184 assertion đều xanh.**

## Performance

- **Duration:** ~90 phút
- **Completed:** 2026-08-01
- **Tasks:** 3/3 (Task 1 auto, Task 2 auto, Task 3 [BLOCKING] auto — không có checkpoint nào trong
  plan này)
- **Files modified:** 9 (3 mới ở Task 1, 6 mới/sửa ở Task 2, 0 ở Task 3)

## Accomplishments

- `supabase/migrations/0006_platform_admins.sql`: bảng `platform_admins` (đúng hai cột theo D-11)
  + `tf_is_platform_admin()` — nhân bản đúng khuôn bảo vệ của `tf_is_member` (không tham số, tự
  lọc theo `auth.uid()`, `security definer`, revoke/grant execute), RLS bật kèm đúng một policy
  `using (false)` để chặn đọc hoàn toàn (D-11a) mà vẫn qua được cổng `00_rls_coverage.sql`
- `supabase/migrations/0007_search_normalize.sql`: `public.tf_normalize(text)` — hàm `immutable`
  dùng `translate()` với bảng 134 ký tự tiếng Việt (không dùng extension `unaccent`), khớp
  `normalizeText()` của `src/lib/format.ts` byte-for-byte trên mọi chuỗi seed thật kiểm được
- Tách bốn uuid tổng hợp khỏi `supabase/seed.sql` sang `supabase/tests/00_fixture_users.sql`:
  `seed.sql` không còn insert nào vào `auth.users`, không còn insert `memberships`, hai dòng
  `employees` neo và hai dòng `audit_log` giờ mang `user_id`/`actor_user_id` là `null`
- `supabase/tests/06_platform_admins.sql`: 8 assertion pgTAP cho D-11/D-11a/D-11b, chạy xanh trên
  database thật
- `scripts/check-pgtap-assertions.mjs`: cổng cơ học D-15a, dựng lại đúng thứ tự thực thi thật của
  `scripts/db.mjs` (00_rls_coverage.sql chạy riêng + toàn bộ danh sách `\ir` của run-all.sql) —
  báo đúng 184 assertion, đã chứng minh có răng bằng thủ nghiệm phá hoại có kiểm soát
- `npm run db:push` đẩy hai migration lên Postgres thật thành công; `npm run test:db` xanh toàn bộ
  không có dòng `not ok` nào; sáu khẳng định đối chiếu trực tiếp trên database (RLS, policy count,
  `prosecdef`, `execute` privilege, hai giá trị `tf_normalize`, `provolatile`) đều đúng

## Task Commits

Each task was committed atomically:

1. **Task 1: Hai migration — platform_admins + tf_is_platform_admin(), và tf_normalize()** -
   `d689ae8` (feat)
2. **Task 2: Tách fixture khỏi seed.sql, thêm test D-11, dựng cổng đếm assertion** - `405afc0`
   (feat)
3. **Task 3: [BLOCKING] Đẩy schema lên Postgres thật rồi chạy trọn bộ pgTAP** - không có commit
   (task thuần vận hành: `db:push`/`test:db`/`check:assertions` + đối chiếu trực tiếp qua `psql`,
   không sửa file nào trong repo)

**Plan metadata:** commit tiếp theo (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/0006_platform_admins.sql` - bảng + hàm + RLS cho vai trò platform admin
- `supabase/migrations/0007_search_normalize.sql` - `tf_normalize(text)` cho tìm kiếm tiếng Việt
- `supabase/tests/00_fixture_users.sql` - fixture pgTAP (4 uuid + memberships + backfill user_id/
  actor_user_id + platform_admins), không `begin/rollback`, không `plan()`
- `supabase/tests/06_platform_admins.sql` - 8 assertion D-11
- `supabase/tests/07_search_normalize.sql` - 6 assertion đối chiếu `tf_normalize` với `normalizeText()`
- `scripts/check-pgtap-assertions.mjs` - cổng D-15a
- `supabase/seed.sql` - gỡ 4 khối liên quan danh tính (auth.users insert, memberships insert, hai
  cột `user_id` employees, hai cột `actor_user_id` audit_log)
- `supabase/tests/run-all.sql` - thêm `\ir 00_fixture_users.sql` (vị trí thứ hai), `\ir
  06_platform_admins.sql`, `\ir 07_search_normalize.sql`
- `supabase/tests/05_seed_fixture.sql` - sửa mô tả một assertion `memberships` để nói đúng nguồn
  dữ liệu mới (fixture của bộ test, không còn là `seed.sql`)

## Decisions Made

Xem `key-decisions` ở frontmatter. Tóm tắt quan trọng nhất: khám phá trong Task 3 rằng `npm run
test:db` chạy cục bộ nhắm vào project Supabase thật SẼ ghi vĩnh viễn bốn dòng fixture (`auth.users`/
`memberships`/`platform_admins`) vào chính database đó, vì `00_fixture_users.sql` cố ý không bọc
`begin/rollback` (để các file test chạy sau còn thấy được dữ liệu của nó) và `psql` mặc định
autocommit ngoài transaction tường minh. Đây là hành vi đã được phạm vi hoá và chấp nhận đúng theo
thiết kế của plan — tiêu chí nghiệm thu của Task 3 chỉ đòi hỏi đếm uuid tổng hợp bằng 0 SAU KHI CHỈ
chạy `db:seed` (không chạm `auth.users`), không đòi hỏi điều đó sau khi chạy `test`/`test:db`. CI
(`.github/workflows/db-ci.yml`) không bị ảnh hưởng vì chạy trên container Postgres dùng một lần rồi
huỷ. Xem `## Threat Flags` bên dưới.

## Deviations from Plan

### Auto-fixed Issues

None mang tính sửa lỗi — plan thực thi đúng như viết. Một điều chỉnh nhỏ đáng ghi lại (không phải
deviation theo nghĩa Rule 1-4, mà là một phát hiện vận hành cần tài liệu hoá):

**1. [Phát hiện, không phải lỗi] `npm run test:db` cục bộ ghi tạm bốn dòng fixture vào database
thật**
- **Found during:** Task 3, khi đối chiếu `select count(*) from auth.users where id::text like
  '00000000-...'` sau lần chạy `test:db` đầu tiên và thấy kết quả là 4 thay vì 0
- **Nguyên nhân:** `00_fixture_users.sql` không bọc `begin/rollback` theo đúng thiết kế của plan
  (để các file test sau còn thấy dữ liệu); `psql` chạy các câu lệnh ngoài transaction tường minh ở
  chế độ autocommit, nên các INSERT của fixture commit ngay lập tức vào database thật khi chạy qua
  `POSTGRES_URL_NON_POOLING` (không phải một Postgres tạm thời như trong CI)
- **Xử lý:** Xoá bốn dòng fixture khỏi database thật (`delete from auth.users where id::text like
  '00000000-...'`, cascade dọn sạch `memberships`/`platform_admins`, `on delete set null` dọn sạch
  `employees.user_id`/`audit_log.actor_user_id`), chạy lại `npm run db:seed` một mình để xác nhận
  đúng tiêu chí nghiệm thu ("count = 0 sau khi CHỈ seed"), roi chạy lại `npm run test:db` để đưa
  database về trạng thái đã qua kiểm chứng đầy đủ
- **Files modified:** Không file nào trong repo — chỉ thao tác dữ liệu trên database thật
- **Verification:** `select count(*) ...` = 0 ngay sau `db:seed` một mình; toàn bộ `test:db` xanh
  lại sau khi chạy tiếp theo
- **Ghi vào:** `## Threat Flags` bên dưới (không phải mục cần commit code)

---

**Total deviations:** 0 sửa lỗi thực sự; 1 phát hiện vận hành đã tài liệu hoá và xử lý (không sửa
code, chỉ dọn dữ liệu database thật để tiêu chí nghiệm thu đo đúng)

## Threat Flags

| Flag | File | Description |
|------|------|--------------|
| threat_flag: new-auth-surface | `supabase/tests/00_fixture_users.sql` (chạy qua `npm run test:db`/`test:rls` nhắm vào `POSTGRES_URL_NON_POOLING`) | Chạy bộ pgTAP cục bộ nhắm vào project Supabase thật ghi vĩnh viễn 4 dòng `auth.users`/`memberships`/`platform_admins` tổng hợp vào chính database đó (không tự dọn, vì fixture không bọc transaction để các test sau còn thấy được). Các dòng này không đăng nhập được (thiếu `auth.identities`) và vô hại về mặt chức năng, nhưng KHÔNG tự biến mất — khác với CI (container Postgres dùng một lần). Không nằm trong phạm vi threat_model gốc của plan này (T-02-02-05 chỉ bao phủ đường `seed.sql`/`db:seed`). Nên cân nhắc ở phase sau: hoặc chấp nhận rõ ràng như một thực tế vận hành (ghi vào tài liệu cho developer), hoặc bọc toàn bộ `run-all.sql` trong một transaction ngoài dùng SAVEPOINT cho từng file con để không commit gì lên database thật khi chạy cục bộ. |

## Issues Encountered

- **Windows: đối số dòng lệnh chứa ký tự tiếng Việt bị hỏng khi truyền cho `psql.exe` qua
  `spawnSync`/argv (kể cả từ git-bash lẫn từ Node `spawnSync`):** `psql "$URL" -tAc "select
  public.tf_normalize('Nguyễn Minh Anh')"` trả về `nguy?n minh anh` và với `'Đoàn Minh Trí'` báo
  lỗi `invalid byte sequence for encoding "UTF8"`. Đây thuần tuý là hiện tượng chuyển đổi codepage
  của Windows khi đối số non-ASCII đi qua argv tới một exe Win32 gốc, KHÔNG PHẢI lỗi của
  `tf_normalize` — pgTAP (`07_search_normalize.sql`, chạy hoàn toàn phía server, không qua argv)
  đã chứng minh hàm đúng trước đó. Xác nhận lại bằng cách viết truy vấn vào một file `.sql` UTF-8
  (qua Write tool, không BOM) và gọi `psql -f <file>` thay vì `-tAc "<inline>"` — cả hai giá trị
  đối chiếu (`nguyen minh anh`, `doan minh tri`) và `provolatile = 'i'` đều đúng. Bài học cho mọi
  lần chạy `psql` với đối số chứa ký tự tiếng Việt trên môi trường Windows của repo này: luôn dùng
  `-f <file.sql>` (viết bằng Write tool), không dùng `-c`/`-tAc` với chuỗi inline.
- **`npm run test:db` cục bộ ghi tạm dữ liệu fixture vào database thật:** xem `## Threat Flags` và
  mục Deviations ở trên — đã xử lý trong phiên này, không phải blocker cho các plan sau nhưng đáng
  ghi lại cho developer kế tiếp chạy `test:db`/`test:rls` cục bộ.
- **Chỉ một assertion `memberships` (không phải hai) đổi ý nghĩa trong `05_seed_fixture.sql`:** plan
  ghi "hai assertion về memberships" nhưng rà soát file chỉ thấy đúng một khối `ok(...)` đo trực
  tiếp `memberships` (khối kia là compound `and` bên trong cùng một lệnh `select ok(...)`, không
  phải hai assertion pgTAP riêng biệt). Đã sửa đúng khối đó; `select plan(35)` giữ nguyên, không
  giảm assertion nào (D-15a).

## User Setup Required

None — Task 3 (đẩy schema + chạy pgTAP + đối chiếu database) đã hoàn thành trong phiên này bằng
`npm run db:push`, `npm run test:db`, `npm run check:assertions`, và các truy vấn `psql -f` trực
tiếp. `.env.local` đã sẵn sàng từ 02-01, không cần thao tác `.env*` nào thêm.

## Next Phase Readiness

- `platform_admins` + `tf_is_platform_admin()` sẵn sàng cho tầng kiểm quyền của các plan sau trong
  Phase 2 (đường đọc thật cho platform admin vẫn đợi Phase 6, đúng giới hạn D-11 đã ghi)
- `public.tf_normalize(text)` sẵn sàng cho plan 02-05 (chuyển ô tìm kiếm nhân viên sang truy vấn
  phía server)
- `scripts/check-pgtap-assertions.mjs` (`npm run check:assertions`) đã tồn tại và xanh — mọi plan
  sau thêm assertion mới chỉ cần đảm bảo tổng không giảm dưới 184 (moc hien tai)
- `supabase/seed.sql` sạch danh tính; `scripts/seed-auth.mjs` (chưa tồn tại, sẽ dựng ở plan sau —
  có thể là 02-03 theo tên script đã khai ở `package.json` từ 02-01) là đường DUY NHẤT tạo tài
  khoản đăng nhập được trên cloud thật
- Không có blocker nào chuyển sang plan 02-03; xem `## Threat Flags` để biết một điều cần lưu ý khi
  vận hành cục bộ (không chặn tiến độ)

## Self-Check: PASSED

- FOUND: supabase/migrations/0006_platform_admins.sql
- FOUND: supabase/migrations/0007_search_normalize.sql
- FOUND: supabase/tests/00_fixture_users.sql
- FOUND: supabase/tests/06_platform_admins.sql
- FOUND: supabase/tests/07_search_normalize.sql
- FOUND: scripts/check-pgtap-assertions.mjs
- FOUND commit: d689ae8 (Task 1)
- FOUND commit: 405afc0 (Task 2)

---
*Phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi*
*Completed: 2026-08-01*
