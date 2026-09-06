# Người dùng tự đổi mật khẩu

**Ngày:** 2026-09-06
**Trạng thái:** Đã thiết kế, đã thực thi

## Vấn đề

Trang hồ sơ nhân viên có mục "Đổi mật khẩu" nhưng bấm vào chỉ hiện thông báo
"Đổi mật khẩu sẽ có khi kết nối máy chủ thật." — một chỗ giữ tạm từ thời V1
chạy dữ liệu giả, chưa bao giờ được nối vào backend.

Khu quản trị còn thiếu hơn: không có lối vào nào cả. Admin và owner hiện không
có cách nào đổi mật khẩu của chính mình.

Ba hàm mật khẩu đã có đều không lấp được chỗ này:

- `completeForcedPasswordChange()` — chỉ chạy khi cờ `must_change_password` bật,
  và **cố ý** ném lỗi nếu không (T-02-10-08: "chặn đúng như một đường đổi mật
  khẩu chung chưa được thiết kế")
- `createEmployeeAccount()` — dành cho tài khoản chưa tồn tại
- `setEmployeePassword()` — quản trị đổi cho **người khác** (spec 2026-09-06)

Cái thiếu là đường người dùng đổi mật khẩu của **chính mình**, biết mật khẩu cũ.

## Quyết định thiết kế

| Điểm | Lựa chọn |
|------|----------|
| Mật khẩu hiện tại | Bắt buộc nhập và xác minh |
| Phạm vi | Cả khu nhân viên và khu quản trị, dùng chung một hộp thoại |
| Vai trò | Ai đăng nhập cũng dùng được, không phân vai trò |

Bắt nhập mật khẩu hiện tại vì nhân viên làm việc ở xưởng, điện thoại hay để
lại trên bàn. Không có bước này thì ai nhặt được máy đang đăng nhập cũng đặt
được mật khẩu mới và khóa chủ tài khoản ra ngoài.

## Kiến trúc

### Server Action — `changeOwnPassword()`

Thêm vào `src/lib/data/mutations/accounts.ts`:

```
changeOwnPassword(currentPassword: string, newPassword: string) → Promise<void>
```

1. `getSessionContext()` → `userId`, `email`, `companyId`. **Không** gọi
   `requireRole` — ai đăng nhập cũng đổi được mật khẩu của chính mình
2. Kiểm ở server trước khi chạm bất cứ thứ gì: mật khẩu mới ≥ 8 ký tự, và phải
   khác mật khẩu hiện tại
3. Xác minh mật khẩu hiện tại bằng `signInWithPassword({ email, password })`
   trên **client tách rời** (xem dưới). Sai → "Mật khẩu hiện tại không đúng."
4. Đổi mật khẩu qua client cookie-bound: `supabase.auth.updateUser({ password })`
5. `logMutation` — không mang mật khẩu

### Điểm dễ làm hỏng: xác minh bằng client nào

Bước 3 **tuyệt đối không được** gọi trên client cookie-bound.
`signInWithPassword` trên client đó ghi đè cookie phiên: người dùng gõ đúng mật
khẩu cũ thì bị cấp lại phiên mới giữa chừng, gõ sai thì có thể mất phiên đang
có. Đang muốn xác minh lại thành ra đăng nhập lại.

Nên có `src/lib/supabase/verify.ts` — client dùng khóa công khai,
`persistSession: false`, `autoRefreshToken: false`, không ràng buộc cookie.

Tách thành file riêng vì hai lý do, lý do thứ hai mới là lý do chính:

1. Nó thật sự là một loại client khác với ba loại đang có
2. Nó **mock được**, nên khẳng định "không xác minh bằng client cookie-bound"
   trở thành một bài test chạy thật, chứ không phải một lời hứa trong comment

### Hệ quả nhỏ đã cân nhắc

Mỗi lần đổi mật khẩu tạo thêm một phiên Supabase dùng một lần rồi bỏ (hệ quả
của `signInWithPassword`). Không gọi `signOut` để dọn: `signOut` phạm vi toàn
cục sẽ giết luôn phiên người dùng đang dùng — chữa một chuyện nhỏ bằng cách gây
ra một chuyện lớn. Refresh token của phiên đó không đi đâu cả, nó nằm trong bộ
nhớ của request rồi bị bỏ, và tự hết hạn theo cấu hình dự án.

### Validation

Schema mới `changeOwnPasswordSchema` (ba ô: hiện tại / mới / nhập lại), cộng hai
luật: mới phải khớp nhập lại, và mới phải khác hiện tại.

**Không** sửa `changePasswordSchema` đang có (hai ô) — luồng bắt buộc lần đầu
không có mật khẩu cũ để nhập, ép chung một schema là làm hỏng luồng đó.

### Giao diện — một hộp thoại, hai lối vào

Component dùng chung `src/components/account/change-own-password-dialog.tsx`:

- **Khu nhân viên** — `src/app/employee/profile/profile-view.tsx`: thay
  `toast.info` giữ tạm bằng mở hộp thoại
- **Khu quản trị** — `src/components/layout/admin-topbar.tsx`: thêm mục "Đổi mật
  khẩu" vào menu avatar, ngay trên "Đăng xuất"

Hai mục giữ tạm còn lại ở trang hồ sơ ("Thông tin cá nhân", "Cài đặt thông báo")
để nguyên — ngoài phạm vi.

### Phiên đăng nhập sau khi đổi

Phiên hiện tại vẫn sống: không có gì trong JWT thay đổi, nên không cần bước
`refreshSession()` ép buộc như luồng `completeForcedPasswordChange` (bước đó tồn
tại vì `app_metadata` chỉ vào JWT sau khi refresh). Thiết bị khác có thể phải
đăng nhập lại — điều này do cấu hình GoTrue quyết định, cần xác nhận bằng bấm
tay chứ không khẳng định trước.

## Kiểm thử

Thêm vào `src/lib/data/__tests__/accounts.test.ts`:

1. mật khẩu hiện tại sai → báo lỗi **và** `updateUser` không hề được gọi
2. mật khẩu mới < 8 ký tự → chặn ở server, không xác minh, không đổi
3. mật khẩu mới trùng mật khẩu cũ → chặn, không đổi
4. đường thành công → xác minh trước, đổi sau, đúng thứ tự
5. xác minh dùng client tách rời, **không** dùng client cookie-bound
6. bản ghi audit không chứa mật khẩu ở bất kỳ khóa hay giá trị nào

Bài 5 là bài quan trọng nhất: đó là lỗi mà nếu mắc phải thì mọi bài khác vẫn
xanh, và triệu chứng ngoài đời (thỉnh thoảng mất phiên khi đổi mật khẩu) rất khó
lần ra nguồn.

Client cookie-bound giả trong test **có** hàm `signInWithPassword` — không phải
vì hàm thật được phép gọi nó, mà ngược lại: để bài 5 khẳng định được rằng nó
không bao giờ bị gọi. Một mock thiếu hàm đó sẽ ném `TypeError` và bài test đỗ vì
lý do sai.

## Kết quả thực thi (2026-09-06)

Các file đã đổi:

| File | Việc |
|------|------|
| `src/lib/supabase/verify.ts` | mới — client xác minh, không ràng buộc cookie |
| `src/lib/data/mutations/accounts.ts` | thêm `changeOwnPassword()` |
| `src/lib/validation/schemas.ts` | thêm `changeOwnPasswordSchema` |
| `src/lib/constants.ts` | thêm `CHANGE_OWN_PASSWORD_LABELS` |
| `src/components/account/change-own-password-dialog.tsx` | mới — hộp thoại dùng chung |
| `src/app/employee/profile/profile-view.tsx` | thay chỗ giữ tạm bằng hộp thoại |
| `src/components/layout/admin-topbar.tsx` | thêm mục vào menu avatar |
| `src/lib/data/__tests__/accounts.test.ts` | 6 bài kiểm thử (bài 15–20) |

Đã kiểm chứng:

- `npm test` — 806/806 bài qua, 73 file (6 bài mới đều xanh)
- `npm run typecheck` — sạch
- `npm run lint` — 0 lỗi (còn 1 cảnh báo có sẵn ở `scripts/tmp/`, không liên quan)
- `npm run build` — dựng thành công, 28/28 trang
- `npm run check:secrets` — quét 293 file, không có khóa bí mật nào lọt xuống client

Ghi chú về một lần đỏ: lượt chạy `npm test` đầu tiên có
`payroll-summary.test.ts` đổ. Đó là test tích hợp gọi Supabase thật (~18 giây),
đổ vì hết giờ khi chạy song song với các file khác. Chạy riêng qua, chạy lại
toàn bộ cũng qua. Không liên quan tới lát cắt này, nhưng là dấu hiệu file test
đó chập chờn dưới tải — đáng xử lý riêng.

Chưa làm: kiểm thử end-to-end trên Supabase thật. Sáu bài trên là unit test
mock. Cần bấm tay để xác nhận hai điều mà mock không chứng minh được: mật khẩu
mới đăng nhập được thật, và **phiên hiện tại không bị mất** sau khi đổi. Điểm
thứ hai cũng là lúc quan sát được thiết bị khác có bị đăng xuất hay không —
điều này do cấu hình GoTrue quyết định, spec này không khẳng định trước.
