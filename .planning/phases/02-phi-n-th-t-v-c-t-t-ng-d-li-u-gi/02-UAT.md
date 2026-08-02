---
status: deferred
phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi
source: [02-VERIFICATION.md]
started: 2026-08-02
updated: 2026-08-02
closed_with_debt: true
closed_by: "chu du an yeu cau dong phase truoc, tu kiem tra tay mot luot sau"
deferred_at: 2026-08-02
deferred_note: >
  Phase 2 da duoc danh dau Complete ngay 2026-08-02 theo quyet dinh cua chu du an,
  voi bon muc duoi day CHUA duoc nghiem thu. Chung khong bi xoa va khong bi coi la
  da xong — van la `pending`. Chay `/gsd-verify-work 2` khi nao tien de ghi ket qua.
---

# Phase 2 — Nghiệm thu tay còn tồn

Phase 2 được **đóng theo yêu cầu của chủ dự án** trong khi bốn mục dưới đây chưa
được nghiệm thu trên trình duyệt thật. Verifier trả `human_needed` — **không truth
nào sai**, không gap nào thất bại; chỉ là bốn điều máy không quan sát được.

Ghi lại ở đây để chúng không biến mất. `/gsd-audit-uat` và `/gsd-progress` sẽ còn
nhắc cho tới khi có kết quả.

**Bối cảnh trước khi đọc tiếp:** phần lớn nội dung của các UAT gốc **đã được máy
chứng minh** bằng `npm run test:e2e` (17/17 assertion, HTTP thật với cookie phiên
`@supabase/ssr` thật). Bốn mục còn lại là phần *duy nhất* mà một bộ test không
thay được.

## Current Test

number: 1
name: Không lóe giao diện quản trị trước khi chuyển hướng
expected: |
  Chưa đăng nhập, gõ thẳng http://localhost:3007/admin/dashboard.
  Phải nhảy về /login mà không thấy sidebar hay khung dashboard hiện ra
  dù chỉ một khung hình.
awaiting: user response

## Tests

### 1. Không lóe giao diện quản trị trước khi chuyển hướng

expected: Chưa đăng nhập, gõ thẳng `/admin/dashboard` → về `/login`, không thấy giao diện quản trị vẽ ra dù một khung hình.
why-machine-cannot: Máy đọc được mã trạng thái 307 (đã kiểm, pass), nhưng không biết mắt người thấy gì trong khoảnh khắc trước khi chuyển trang. Lóe lên nghĩa là chặn ở phía client chứ không phải ở `middleware.ts` — tiêu chí số 2 của phase hỏng.
requirement: AUTH-02
plan: 02-04 Task 4
result: [pending]

### 2. Phiên sống thật qua đóng/mở trình duyệt

expected: Đăng nhập → tắt hẳn trình duyệt (đóng tiến trình, không phải đóng tab) → mở lại → vào thẳng `/admin/dashboard` → vẫn đăng nhập.
why-machine-cannot: Cơ chế đã được chứng minh — phiên mang `expires_at` tường minh và có `refresh_token`, không phải session cookie (đã kiểm, pass). Nhưng một lần khởi động lại tiến trình thật thì không script nào mô phỏng trung thực được.
requirement: AUTH-01
plan: 02-04 Task 4
result: [pending]

### 3. Đổi doanh nghiệp khi thuộc nhiều nơi

expected: Đăng nhập `nv003@ngocphat.test` → `/select-company` phải hiện **hai** doanh nghiệp (Ngọc Phát và Bình Minh) → chọn một, vào được → quay lại chọn nơi kia, dữ liệu đổi theo.
why-machine-cannot: Cần quan sát dữ liệu trên màn hình đổi đúng theo doanh nghiệp đang chọn.
note: Mục này **mới kiểm được từ 2026-08-02**. Trước đó cả 10 tài khoản đều chỉ thuộc một doanh nghiệp, nên tiêu chí này không phải chưa kiểm mà là không có gì để kiểm. Đã sửa ở `scripts/seed-auth.mjs` bước e2 (commit `ee943de`, sửa tính chạy-lại-được ở `3eaab70`).
requirement: AUTH-05
plan: 02-04 Task 4
result: [pending]

### 4. Mười ba màn hình V1 trên dữ liệu thật, không cảnh báo hydration

expected: Đi hết 13 màn hình theo bảng ở `docs/HUONG-DAN-TEST.md` mục 3.5, DevTools Console mở suốt. Không cảnh báo lệch lần vẽ (hydration mismatch), không lỗi đỏ.
why-machine-cannot: Không có cách nào đọc console của trình duyệt tự động trong bộ công cụ hiện tại. Cảnh báo hydration là dấu hiệu còn chỗ đọc đồng hồ máy khi vẽ lần đầu — đúng thứ D-19 sinh ra để chặn.
requirement: DATA-05, DATA-08
plan: 02-11 Task 4
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

Chưa có. Bốn mục trên đang `pending`, không phải `failed` — chưa ai chạy chúng.

## Bằng chứng đã có sẵn (không cần kiểm lại)

Những điều sau **đã được chứng minh bằng máy**, đừng tốn công nghiệm thu lại:

- Bốn route được bảo vệ đều trả 307 về `/login` khi không có cookie; `/api/companies` trả 401 — `npm run test:e2e` mục A
- Cổng buộc đổi mật khẩu chặn `/admin/dashboard`, `/select-company` (đường lách dễ bỏ sót nhất) và `/employee` — mục B
- Bẫy D-16a, năm bước có đối chứng: token cũ vẫn bị chặn → làm mới token → HTTP 200. Bước "token cũ vẫn bị chặn" là đối chứng; nếu nó cho qua thì cả bài kiểm vô nghĩa — mục C
- Phiên mang `expires_at` tường minh và `refresh_token` — mục D
- Đăng ký công khai đã tắt ở endpoint thật: `npm run check:signup` → `HTTP 422, error_code=signup_disabled`, exit 0
- `src/lib/mock/` không còn tồn tại; không file nào import từ đó; `REFERENCE_DATE` chỉ còn trong chính test canh nó vắng mặt
- 9 Route Handler, tất cả chỉ export `GET`
- test 100/100 · pgTAP 191 assertion · typecheck · lint · build · `check:secrets` 170 file

**Và một bằng chứng nghiệm thu thật, tìm thấy trong dữ liệu chứ không do script tạo:**
`nv001@ngocphat.test` có `must_change_password = false` với `updated_at` (17:45:20)
muộn hơn `last_sign_in_at` (17:43:50), trong khi chín tài khoản còn lại vẫn `true`.
Nghĩa là chủ dự án đã đăng nhập, bị ép sang trang đổi mật khẩu, và đổi thật qua
giao diện. Luồng AUTH-04 chạy đúng trên trình duyệt thật. Điều này **không**
chứng minh trải nghiệm D-16a mượt (không bị đá ngược) — chủ dự án chưa báo lại
điểm đó.

## Cách chạy khi nào tiện

```bash
npm run dev                 # doc dong `Local:` de biet cong
cat docs/env.test-accounts  # mat khau (file nay ngoai git)
```

Rồi làm bốn mục trên. Xong gõ `/gsd-verify-work 2` để ghi kết quả.
