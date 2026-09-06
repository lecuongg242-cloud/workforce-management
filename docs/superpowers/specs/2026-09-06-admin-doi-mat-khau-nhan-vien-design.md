# Admin đặt lại mật khẩu cho nhân viên

**Ngày:** 2026-09-06
**Trạng thái:** Đã thiết kế, đã thực thi

## Vấn đề

Nhân viên quên mật khẩu thì hiện không có đường nào lấy lại. Dự án chưa cấu hình
gửi email, nên không có luồng "quên mật khẩu" tự phục vụ. Cách duy nhất đang có
là nhờ super admin `/platform` gọi `resetTempPasswordForUser()` — nhưng đó là
người vận hành nền tảng, không phải quản lý của doanh nghiệp. Thực tế nhân viên
sẽ liên hệ quản lý trực tiếp của mình.

Thiếu đúng một mảnh: đường dành cho **admin/owner của chính doanh nghiệp** đặt
lại mật khẩu cho nhân viên trong công ty mình.

## Những gì đã có sẵn

Phần lớn cơ chế đã tồn tại từ Phase 2 (plan 02-10):

- `createEmployeeAccount()` (`src/lib/data/mutations/accounts.ts`) — admin tạo
  tài khoản, sinh mật khẩu tạm, hiện đúng một lần, bật cờ `must_change_password`
- `completeForcedPasswordChange()` (cùng file) — nhân viên tự đặt mật khẩu khi
  đăng nhập lần đầu
- `resetTempPasswordForUser()` (`src/lib/data/mutations/platform.ts`) — cấp lại
  mật khẩu tạm, nhưng chỉ super admin gọi được và bắt buộc nhập lý do

Việc cần làm là nhân bản khả năng đó xuống phạm vi công ty, theo đúng khuôn
`createEmployeeAccount` đã đặt.

## Quyết định thiết kế

| Điểm | Lựa chọn | Ghi chú |
|------|----------|---------|
| Cơ chế | Admin tự gõ mật khẩu mới | Không sinh mật khẩu tạm, không gửi email |
| Bắt đổi lại | Không | Nhân viên dùng luôn mật khẩu admin đặt |
| Phạm vi | Owner và admin đều đổi được cho tất cả | Không phân biệt vai trò người bị đổi |
| Vị trí | Trang chi tiết nhân viên | Không đưa vào menu ba chấm ở danh sách |
| Lý do | Không bắt nhập | Vẫn ghi nhật ký audit đầy đủ |

## Kiến trúc

### Server Action — `setEmployeePassword()`

Thêm vào `src/lib/data/mutations/accounts.ts`:

```
setEmployeePassword(employeeId: string, newPassword: string) → Promise<{ email }>
```

Trình tự, đi đúng khuôn `createEmployeeAccount`:

1. `getSessionContext()` → `companyId`, `userId`, `role`
2. `requireRole(role, ["owner", "admin"])` — manager và employee bị chặn
3. Kiểm độ dài ≥ 8 ký tự **ở server** trước khi chạm bất cứ thứ gì. Form đã kiểm
   qua `changePasswordSchema`, nhưng Server Action không được tin tham số từ
   client (defense-in-depth)
4. Đọc hồ sơ bằng client cookie-bound:
   `.eq("id", employeeId).eq("company_id", companyId)` — **ranh giới doanh
   nghiệp nằm ở đây**, RLS là lớp phòng thủ thứ hai. Admin công ty A gọi với id
   của công ty B thì không đọc được gì → "Không tìm thấy nhân viên."
5. Không có `user_id` → `"Nhân viên này chưa có tài khoản đăng nhập."`
6. `createAdminSupabase()` → `updateUserById(user_id, { password, app_metadata:
   { must_change_password: false } })`
7. `logMutation` — không mang mật khẩu
8. Trả `{ email }` để giao diện xác nhận đúng người

Chỉ chạm khóa bí mật **sau khi** đã kiểm quyền và kiểm ranh giới doanh nghiệp —
đúng khuôn "tự kiểm quyền trước" của `src/lib/supabase/admin.ts`.

### Vì sao phải ghi `must_change_password: false`

Nhân viên đã được tạo tài khoản nhưng chưa đăng nhập lần nào vẫn đang mang cờ
`true` từ `createEmployeeAccount`. Nếu chỉ đổi mật khẩu mà không xóa cờ, người
đó đăng nhập bằng mật khẩu admin vừa đặt rồi bị đá sang màn hình bắt đổi — trái
với quyết định "dùng luôn mật khẩu đó", và admin sẽ không hiểu vì sao có người
bị hỏi còn có người không.

Ghi thẳng `false` làm hành vi giống nhau cho mọi nhân viên, bất kể trước đó họ
đã đăng nhập lần nào hay chưa.

### Ràng buộc về mật khẩu trong nhật ký

Mật khẩu **không bao giờ** đi vào `audit_log`, không vào cột nào của
`employees`, không vào log server. Bản ghi audit chỉ mang:

```
entityTable: "auth.users"
entityId:    <user_id của nhân viên>
before:      null
after:       { credential_reset: true }
reason:      "Quản trị đặt lại mật khẩu cho nhân viên <mã NV>"
```

Khóa `credential_reset` được chọn thay vì một tên có chữ "password" để bản ghi
này cũng vượt qua được `assertNoSensitiveAuditKeys` — cùng ràng buộc mà
`createEmployeeAccount` và `resetTempPasswordForUser` đang giữ.

### Validation

Dùng lại `changePasswordSchema` (`src/lib/validation/schemas.ts`) — đã đúng
hình dạng cần: mật khẩu mới ≥ 8 ký tự, nhập lại phải khớp. Không viết schema
mới; hai luồng dùng chung một luật vì đó thực sự là một luật.

### Giao diện

Ở `src/app/admin/employees/[id]/employee-detail-view.tsx`, **cùng vị trí** với
nút "Tạo tài khoản đăng nhập". Hai nút loại trừ nhau tự nhiên theo
`employee.hasAccount`:

- chưa có tài khoản → "Tạo tài khoản đăng nhập"
- đã có tài khoản → "Đổi mật khẩu" (`variant="outline"`, icon `KeyRound`)

Không thêm nút thứ ba vào hàng — giữ quy tắc mỗi khu chỉ một nút filled indigo.

Bấm mở `Dialog` chứa:

- tên và email nhân viên đang thao tác, để admin nhìn thấy mình đang đổi cho ai
- hai ô mật khẩu (mới / nhập lại), `react-hook-form` + `zodResolver`
- một dòng nhắc: nhân viên sẽ dùng luôn mật khẩu này, hãy chuyển qua kênh riêng
  (nhắn tin, gọi điện), đừng gửi qua email hay kênh công khai
- thành công → đóng dialog, `toast.success`; lỗi → `toast.error` với thông điệp
  từ server

Nhãn gom vào `RESET_PASSWORD_LABELS` trong `src/lib/constants.ts`.

Form nằm ở component riêng (`src/components/employees/reset-password-dialog.tsx`)
chứ không nhét thêm vào `employee-detail-view.tsx` — file đó đã dài, và hộp
thoại này có state riêng, không dùng chung gì với phần còn lại của trang.

## Kiểm thử

Thêm vào `src/lib/data/__tests__/accounts.test.ts` (đã là unit test mock sẵn
Supabase):

1. manager gọi → bị từ chối, **và** `updateUserById` không hề được gọi
2. employee gọi → bị từ chối, không chạm Admin API
3. nhân viên thuộc công ty khác → "Không tìm thấy nhân viên.", không chạm Admin API
4. nhân viên chưa có tài khoản → báo lỗi, không chạm Admin API
5. mật khẩu < 8 ký tự → bị chặn ở server, không chạm Admin API
6. đường thành công → `updateUserById` nhận đúng `must_change_password: false`
7. bản ghi audit không chứa mật khẩu ở bất kỳ khóa hay giá trị nào

Khẳng định "không chạm Admin API" quan trọng ngang khẳng định "ném lỗi": một
phiên bản chặn sai thứ tự vẫn ném lỗi đúng nhưng đã kịp đổi mật khẩu rồi.

## Kết quả thực thi (2026-09-06)

Các file đã đổi:

| File | Việc |
|------|------|
| `src/lib/data/mutations/accounts.ts` | thêm `setEmployeePassword()` |
| `src/lib/constants.ts` | thêm `RESET_PASSWORD_LABELS` |
| `src/components/employees/reset-password-dialog.tsx` | mới — hộp thoại nhập mật khẩu |
| `src/app/admin/employees/[id]/employee-detail-view.tsx` | nút "Đổi mật khẩu" + gắn hộp thoại |
| `src/lib/data/__tests__/accounts.test.ts` | 7 bài kiểm thử (bài 8–14) |

Đã kiểm chứng:

- `npm test` — 800/800 bài qua, 73 file (7 bài mới đều xanh)
- `npm run typecheck` — sạch
- `npm run lint` — 0 lỗi (còn 1 cảnh báo có sẵn ở `scripts/tmp/`, không liên quan)
- `npm run build` — dựng thành công
- `npm run check:secrets` — quét 293 file, không có khóa bí mật nào lọt xuống client

Chưa làm: kiểm thử end-to-end chạy thật trên Supabase. Bảy bài trên là unit test
mock, chúng chứng minh Server Action **quyết định** đúng nhưng không chứng minh
Supabase **thi hành** đúng. Cần một lượt bấm tay để xác nhận nhân viên đăng nhập
được bằng mật khẩu mới và không bị hỏi đổi lại.

## Rủi ro đã chấp nhận có chủ đích

Ghi lại để sau này đọc lại biết đây là lựa chọn, không phải sơ suất.

**Admin đặt lại được mật khẩu của owner.** Một tài khoản `admin` có thể đặt mật
khẩu cho tài khoản `owner` rồi đăng nhập vào đó, tức là chiếm quyền toàn doanh
nghiệp. Phương án chặn (admin không đổi được owner/admin) đã được cân nhắc và bị
bỏ để giữ luật đơn giản. Điều này chỉ an toàn chừng nào mọi tài khoản `admin`
đều là người được tin ở mức ngang owner.

**Admin biết mật khẩu nhân viên đang dùng thật.** Vì không bắt đổi lại, mật khẩu
admin đặt là mật khẩu nhân viên dùng lâu dài. Nếu về sau có tranh chấp "ai đã
bấm chấm công", mật khẩu không còn là bằng chứng riêng của nhân viên nữa — lúc
đó ảnh chụp và vị trí là chỗ dựa duy nhất.

Nếu về sau muốn siết, hai chỗ cần sửa: thêm luật vai trò ở bước 2 của Server
Action, và bật lại `must_change_password: true` ở bước 6.
