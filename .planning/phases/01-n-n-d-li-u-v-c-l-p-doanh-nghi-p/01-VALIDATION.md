---
phase: 1
slug: n-n-d-li-u-v-c-l-p-doanh-nghi-p
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Nguồn:** viết tay từ các quyết định đã khóa trong `01-CONTEXT.md` (D-02, D-03, D-04,
> D-06) thay vì sinh từ `RESEARCH.md` — phase này chạy với research bị bỏ qua.

---

## Test Infrastructure

Dự án hiện **không có bất kỳ hạ tầng test nào** (`.planning/codebase/TESTING.md`,
`CONCERNS.md` §"Zero Test Files in Source"). Phase 1 là nơi hạ tầng test lần đầu vào dự án.

| Property | Value |
|----------|-------|
| **Framework** | pgTAP (SQL-level, chạy qua `psql`) — quyết định D-03 |
| **Config file** | none — Wave 0 cài đặt |
| **Quick run command** | `npm run test:rls` → `psql "$POSTGRES_URL_NON_POOLING" -f supabase/tests/run-all.sql` |
| **Full suite command** | `npm run test:db` → áp lại toàn bộ migration + seed rồi chạy `test:rls` |
| **Estimated runtime** | ~15-40 giây (mạng tới Supabase cloud là phần chậm nhất) |

**Ghi chú môi trường:** máy phát triển không có Docker (D-03), nên `quick run` chạy thẳng
vào project Supabase dev qua `POSTGRES_URL_NON_POOLING`. CI chạy cùng bộ test này trên một
Postgres sạch do GitHub Actions dựng bằng service container (D-04) — cùng file test, khác
nơi chạy.

---

## Sampling Rate

- **After every task commit:** `npm run test:rls`
- **After every plan wave:** `npm run test:db` (dựng lại từ migration + seed, không dựa
  vào trạng thái DB còn sót từ task trước)
- **Before `/gsd-verify-work`:** full suite phải xanh
- **Max feedback latency:** 40 giây

**Vì sao lấy mẫu dày ở phase này:** mục tiêu của Phase 1 là *chứng minh* ranh giới giữa
doanh nghiệp. Một policy viết thiếu điều kiện không làm gì sập — nó âm thầm để lọt dữ liệu.
Không có tín hiệu nào khác ngoài test, nên test phải chạy sau mỗi task chứ không phải cuối
phase.

---

## Per-Task Verification Map

Điền chi tiết sau khi `01-PLAN.md` tồn tại. Ràng buộc bắt buộc với planner:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 0 | DATA-01 | — | N/A | infra | `npm run test:rls` | ❌ W0 | ⬜ pending |

**Quy tắc ánh xạ cho phase này:**

- Mỗi task tạo hoặc sửa bảng → phải có ít nhất một test pgTAP khẳng định bảng đó **bật RLS
  và có ít nhất một policy** (DATA-02, DATA-04)
- Mỗi bảng thuộc phạm vi doanh nghiệp → phải có test đọc chéo **và** test ghi chéo giữa Ngọc
  Phát và Bình Minh (DATA-03). Test đọc một chiều là chưa đủ.
- Task về thời gian → test khẳng định ca 22:00→06:00 ra đúng 480 phút và gắn vào ngày bắt
  đầu ca, chạy với `SET timezone` khác nhau (DATA-07, D-08)
- Task xoay khóa (AUTH-06) → xem mục Manual-Only bên dưới

---

## Wave 0 Requirements

Dự án chưa có gì, nên Wave 0 nặng hơn bình thường:

- [ ] `supabase/` khởi tạo bằng Supabase CLI, liên kết tới project dev
- [ ] Extension `pgtap` cài trên database dev
- [ ] `supabase/tests/run-all.sql` — entry point gom mọi file test
- [ ] `supabase/tests/helpers.sql` — hàm dùng chung: giả lập user thuộc một doanh nghiệp,
      liệt kê bảng thiếu RLS
- [ ] `npm run test:rls` và `npm run test:db` thêm vào `package.json`
- [ ] `.github/workflows/` — workflow chạy migration + seed + pgTAP trên Postgres service container
- [ ] Branch protection trên GitHub: main yêu cầu workflow này xanh mới merge được (D-05)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Khóa Supabase cũ hết hiệu lực | AUTH-06 | Thao tác thu hồi khóa nằm trên dashboard Supabase, không có API để test tự động khẳng định "khóa cũ đã chết" mà không tự lưu lại khóa cũ ở đâu đó | Sau khi xoay khóa: gọi `GET {SUPABASE_URL}/rest/v1/` với khóa legacy cũ, kỳ vọng nhận 401. Ghi kết quả vào SUMMARY của phase. |
| Không khóa bí mật nào lọt xuống client bundle | AUTH-06 | Cần chạy `next build` rồi quét artifact — thuộc về kiểm tra build, không phải test DB | `npx next build` rồi tìm chuỗi `sb_secret` và `service_role` trong `.next/static/`; kỳ vọng không có kết quả nào |
| Branch protection đã bật | DATA-04 | Cấu hình nằm trên GitHub, ngoài repo | Mở PR thử với một migration cố tình thiếu RLS, xác nhận nút merge bị khóa |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
