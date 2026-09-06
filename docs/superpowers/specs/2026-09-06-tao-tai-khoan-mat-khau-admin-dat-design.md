# Tạo tài khoản với mật khẩu do admin đặt

**Ngày:** 2026-09-06
**Trạng thái:** Đã thiết kế, đã thực thi
**Thay thế:** quyết định D-16 cho *riêng* luồng tạo tài khoản (xem "Không đụng tới")

## Vấn đề

Luồng tạo tài khoản hiện tại: admin bấm một nút, hệ thống sinh mật khẩu tạm
dạng `base64url` 24 ký tự, hiện ra đúng một lần, và bật cờ
`must_change_password` để ép nhân viên đổi ngay lần đăng nhập đầu.

Hai chỗ vướng trong thực tế:

1. Mật khẩu kiểu `x7Kp-9mQz_Rt2N...` **không đọc qua điện thoại được**. Admin
   phải chụp màn hình hoặc gõ lại tay để gửi cho nhân viên.
2. Nhân viên xưởng phải qua thêm một màn hình đổi mật khẩu ngay lần đầu, trong
   khi việc họ cần làm là chấm công.

Sau khi đã có `setEmployeePassword()` (admin đặt lại mật khẩu, không bắt đổi) và
`changeOwnPassword()` (người dùng tự đổi ở màn hình của mình), luồng tạo tài
khoản trở thành chỗ duy nhất còn hành xử khác — vừa không cho admin tự đặt, vừa
bắt đổi lần đầu.

## Quyết định

| Điểm | Lựa chọn |
|------|----------|
| Ai đặt mật khẩu ban đầu | Admin — ô để trống, gõ tay hoặc bấm nút sinh |
| Bắt đổi lần đầu | Bỏ hẳn cho luồng tạo tài khoản |
| Mật khẩu sinh ra | Dạng đọc được qua điện thoại |

Nhân viên muốn đổi thì tự vào **Cá nhân → Đổi mật khẩu**, màn hình đã có.

### Rủi ro đã chấp nhận có chủ đích

Bỏ bước bắt buộc đổi nghĩa là: người làm nhân sự tạo 30 tài khoản liên tiếp rất
có thể gõ **cùng một mật khẩu** cho cả xưởng. Khi đó bất kỳ nhân viên nào cũng
đoán được mật khẩu của đồng nghiệp và đăng nhập chấm công hộ — đúng thứ mà chấm
công có ảnh và vị trí đang cố ngăn.

Đây là lựa chọn có ý thức, đã cân nhắc hai phương án chặn (giữ nguyên bắt đổi;
chỉ bắt đổi khi admin tự gõ) và bỏ cả hai để giữ luồng đơn giản và nhất quán.
Nút sinh mật khẩu tồn tại chính là để giảm khả năng này xảy ra — nó phải đủ tiện
để admin thực sự dùng, nên mới có yêu cầu "đọc được qua điện thoại" ở dưới.

Cộng với `setEmployeePassword()`, hệ thống **không còn đường nào** cấp cho nhân
viên một mật khẩu chỉ họ biết, trừ khi họ tự đổi. Mật khẩu thôi không còn là
bằng chứng "đúng người" nữa; ảnh chụp và vị trí gánh toàn bộ vai trò đó.

## Kiến trúc

### Server Action

```
createEmployeeAccount(employeeId)          →  { email, temporaryPassword }   (cũ)
createEmployeeAccount(employeeId, password) →  { email }                      (mới)
```

Thay đổi bên trong:

- kiểm mật khẩu ≥ 8 ký tự ở server, **trước** khi đọc dữ liệu hay chạm Admin API
- `app_metadata: { must_change_password: false }` thay cho `true`
- không trả mật khẩu về nữa — admin đang cầm nó trên màn hình
- xóa `generateTemporaryPassword()` phía server; việc sinh chuyển sang trình duyệt

Mọi thứ khác giữ nguyên: kiểm quyền, ranh giới doanh nghiệp, chèn membership,
`pending_invite → active` trong cùng một lần ghi, `assertNoSensitiveAuditKeys`
trước khi ghi audit.

### Hàm sinh mật khẩu — `src/lib/auth/generate-password.ts`

Sinh dạng `k7mq-p4ax-r9tz`: 12 ký tự chia ba nhóm, từ bảng chữ đã **bỏ các ký tự
dễ nhầm khi đọc**: `0` `O` `o` `1` `l` `I` `i`.

Đây không phải chi tiết thẩm mỹ mà là điều kiện để nút sinh mật khẩu được dùng
thật. Hàm cũ sinh `base64url` phân biệt hoa thường, có `-` và `_`, đọc qua điện
thoại cho công nhân xưởng là bất khả thi; admin sẽ bỏ qua nút đó và tự gõ một
mật khẩu yếu. Một nút không ai bấm thì không bảo vệ được gì.

Độ mạnh: bảng 27 ký tự, 12 vị trí ≈ 57 bit. Thừa sức cho mục đích này.

Dùng `crypto.getRandomValues` (có sẵn ở cả trình duyệt và Node hiện đại), lấy
mẫu theo kiểu loại bỏ phần dư để mọi ký tự có xác suất bằng nhau — chia lấy dư
thẳng sẽ làm các ký tự đầu bảng xuất hiện nhiều hơn.

### Giao diện

**Control dùng chung** `src/components/account/password-field.tsx`: một ô mật
khẩu + nút "Tạo mật khẩu" + nút hiện/ẩn. Bấm sinh thì tự hiện luôn — bấm sinh là
để đọc, che lại thì vô nghĩa.

Dùng ở hai chỗ, cả hai đều là "đặt mật khẩu cho người khác":

- `create-account-dialog.tsx` (mới) — nút "Tạo tài khoản đăng nhập" giờ mở hộp
  thoại thay vì tạo ngay
- `reset-password-dialog.tsx` — hộp thoại đặt lại mật khẩu

**Bỏ ô "nhập lại mật khẩu" ở hộp thoại đặt lại.** Ô nhập lại tồn tại để bắt lỗi
gõ nhầm khi ô bị che. Khi giá trị đọc được ngay trên màn hình thì nó không bắt
được gì nữa, chỉ bắt admin gõ hai lần. Hộp thoại **tự đổi mật khẩu của mình**
(`change-own-password-dialog.tsx`) giữ nguyên ô nhập lại — ở đó người dùng gõ bí
mật của chính mình và không nên hiện ra màn hình.

**Bỏ hộp thoại "hiện mật khẩu tạm một lần"** ở trang chi tiết nhân viên. Nó tồn
tại vì trước đây đó là lần duy nhất mật khẩu lộ ra. Giờ admin tự đặt nên không
còn lý do — chỉ cần một toast báo đã tạo xong.

## Không đụng tới

Bộ máy đổi-bắt-buộc giữ nguyên toàn bộ: trang `/doi-mat-khau`,
`completeForcedPasswordChange()` với thứ tự D-16a, và chặn ở `middleware.ts`.

Lý do: `resetTempPasswordForUser()` ở `mutations/platform.ts` (super admin cấp
lại mật khẩu tạm) **vẫn bật cờ** `must_change_password`. Đó là đường phục hồi
khi khách mất lối vào, và ở đó ép đổi là đúng. Không có code chết nào phải dọn.

## Kiểm thử

Sửa 3 bài hiện có (5, 6, 7) theo chữ ký hàm mới. Thêm:

- mật khẩu < 8 ký tự → chặn ở server, `createUser` không hề được gọi
- tạo tài khoản đặt `must_change_password: false`, không phải `true`
- mật khẩu admin đưa vào là mật khẩu thật sự được dùng để tạo

Cho hàm sinh mật khẩu (`generate-password.test.ts`):

- không bao giờ chứa ký tự dễ nhầm — kiểm qua nhiều lần sinh, không phải một
- hai lần gọi cho hai kết quả khác nhau
- đúng định dạng và đủ độ dài

## Kết quả thực thi (2026-09-06)

Các file đã đổi:

| File | Việc |
|------|------|
| `src/lib/auth/generate-password.ts` | mới — sinh mật khẩu đọc được |
| `src/lib/data/mutations/accounts.ts` | `createEmployeeAccount` nhận mật khẩu, bỏ ép đổi |
| `src/lib/validation/schemas.ts` | thêm `setPasswordSchema` (một ô) |
| `src/lib/constants.ts` | sửa `ACCOUNT_LABELS`, thêm `PASSWORD_FIELD_LABELS` |
| `src/components/account/password-field.tsx` | mới — ô + nút sinh + nút hiện/ẩn |
| `src/components/employees/create-account-dialog.tsx` | mới |
| `src/components/employees/reset-password-dialog.tsx` | dùng chung `PasswordField`, bỏ ô nhập lại |
| `src/app/admin/employees/[id]/employee-detail-view.tsx` | mở hộp thoại, bỏ hộp thoại lộ mật khẩu một lần |
| `src/lib/data/__tests__/accounts.test.ts` | sửa 3 bài, thêm 3 bài (21–23) |
| `src/lib/auth/__tests__/generate-password.test.ts` | mới — 3 bài |

Một chi tiết phát sinh khi làm, không có trong thiết kế ban đầu:
`handleCreateAccount` ở trang chi tiết **ném lỗi tiếp ra ngoài** thay vì nuốt
bằng toast. Hộp thoại cần biết thất bại để giữ nguyên ô nhập và hiện lỗi ngay
trong đó — đóng hộp thoại rồi báo lỗi bằng toast sẽ làm mất mật khẩu quản trị
vừa gõ.

Đã kiểm chứng:

- `npm test` — 812/812 bài qua, 74 file (6 bài mới đều xanh)
- `npm run typecheck` — sạch
- `npm run lint` — 0 lỗi (còn 1 cảnh báo có sẵn ở `scripts/tmp/`, không liên quan)
- `npm run build` — dựng thành công, 28/28 trang
- `npm run check:secrets` — quét 293 file, không có khóa bí mật nào lọt xuống client

Chưa làm: kiểm thử end-to-end trên Supabase thật. Cần bấm tay xác nhận nhân viên
mới đăng nhập được bằng mật khẩu quản trị đặt và **không** bị đưa sang màn hình
đổi mật khẩu bắt buộc.
