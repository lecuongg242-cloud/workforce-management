# Hướng dẫn kiểm thử TimeFlow

Tài liệu này mô tả cách kiểm chứng hệ thống **sau Phase 2** — thời điểm ứng dụng lần đầu
chạy trên Postgres thật với phiên đăng nhập thật.

> **Thay đổi lớn so với bản trước.** Ở V1, dữ liệu nằm trong bộ nhớ và đăng nhập là giả
> lập: email đúng định dạng cộng mật khẩu sáu ký tự là vào được, phiên lưu ở
> `localStorage`, mọi thứ về trạng thái gốc sau mỗi lần `npm run dev`.
>
> **Giờ không còn như vậy.** Đăng nhập đi qua Supabase Auth thật, phiên nằm ở cookie
> httpOnly, và **mọi thay đổi bạn tạo ra đều ghi thật xuống database và tồn tại vĩnh
> viễn**. Thêm một nhân viên nghĩa là có thêm một dòng trong Postgres. Muốn về trạng
> thái gốc phải chạy `npm run db:seed`.

Kiểm thử chia làm ba lớp, chạy theo đúng thứ tự:

1. **Cổng tự động** — máy chạy, không cần người. Chạy trước; lớp này đỏ thì không việc gì
   phải mở trình duyệt.
2. **Nghiệm thu tay** — những điều chỉ người thật bấm mới thấy được.
3. **Sự cố đã gặp** — các bẫy có thật của dự án này, kèm cách nhận ra và xử lý.

> **Quy ước:** không tài liệu nào trong repo được chứa mật khẩu hay khóa. Credential lấy
> bằng cách chạy lệnh, không phải bằng cách đọc file.

---

## 1. Cổng tự động

### 1.1 Chạy nhanh sau mỗi lần sửa code

```bash
npm run typecheck    # TypeScript strict, khong dung `any`
npm run lint         # ESLint, gom rule cam doc gio may trong client component
```

### 1.2 Bộ đầy đủ trước khi nghiệm thu

```bash
npm run test              # Vitest — tang du lieu, cong chan route, chuoi doi mat khau
npm run build             # Next.js production build
npm run check:secrets     # Quet .next/ tim khoa bi mat lot xuong client bundle
npm run check:assertions  # Dem assertion pgTAP, san toi thieu 170
```

### 1.3 Cổng chạm cơ sở dữ liệu

```bash
npm run db:push      # Ap migration len Postgres
npm run db:seed      # Nap lai du lieu nghiep vu hai doanh nghiep (GHI DE du lieu hien co)
npm run test:rls     # pgTAP: co lap giua hai doanh nghiep
```

### 1.4 Từng cổng chứng minh điều gì

| Lệnh | Chứng minh |
|---|---|
| `npm run test` | Tầng dữ liệu giữ đúng hình dạng lỗi `error: string \| null`; Route Handler chỉ export `GET`; điểm kiểm danh tính là duy nhất; chuỗi chống mắc kẹt khi đổi mật khẩu |
| `npm run test:rls` | Tài khoản doanh nghiệp A không đọc/ghi được một dòng nào của B, kiểm **theo từng bảng** chứ không phải một khẳng định chung |
| `npm run check:assertions` | Số assertion pgTAP không âm thầm giảm khi ai đó sửa bộ test |
| `npm run check:secrets` | Không khóa bí mật nào lọt vào client bundle. Cổng này đã được chứng minh có răng bằng thủ tục phá-rồi-hoàn |
| `npm run check:signup` | Đăng ký công khai đã tắt **ở endpoint thật**, không tin `config.toml` |
| `npm run lint` | Không client component nào đọc `new Date()` / `Date.now()` ở lần vẽ đầu — nguồn gốc lỗi hydration |

### 1.5 Hai cổng có thể đang đỏ, và đỏ đúng

**`npm run check:signup`** báo đỏ chừng nào đăng ký công khai chưa tắt. Tắt ở Dashboard
Supabase: `Authentication → Sign In / Providers → Email →` bỏ chọn *"Allow new users to
sign up"*. Chạy lại lệnh để xác nhận.

Cổng này **fail-closed**: nếu probe bị chặn vì lý do khác (địa chỉ không hợp lệ, rate
limit, captcha) thì nó báo *"không kết luận được"* và fail, chứ không bao giờ báo xanh
khi thiếu bằng chứng.

**`npm run test:db`** sẽ **từ chối chạy** khi `POSTGRES_URL_NON_POOLING` trỏ tới project
Supabase trên cloud. Đó là hành vi đúng — xem mục 4.1.

---

## 2. Chuẩn bị nghiệm thu tay

```bash
npm run seed:auth          # Tao 10 tai khoan that (chay lai duoc, khong tao trung)
npm run reset:passwords    # In bang mat khau tam — CHI HIEN MOT LAN, luu lai ngay
npm run dev
```

Đọc dòng `Local:` trong output để biết cổng — Next.js tự nhảy cổng khi 3000 bận, có thể
ra 3006, 3007…

`seed:auth` tạo **10 tài khoản đại diện**: mỗi doanh nghiệp một owner, một admin, một
manager và hai nhân viên.

| Doanh nghiệp | Mã | Email |
|---|---|---|
| Công ty TNHH Thương mại Ngọc Phát | `cty-01` | `nv001…nv005@ngocphat.test` |
| Xưởng Sản xuất Bình Minh | `cty-02` | `bm001…bm005@binhminh.test` |

**30 nhân viên còn lại cố ý không có tài khoản** (`employees.user_id = null`). Đó không
phải thiếu sót mà mô phỏng đúng thực tế: công nhân ca kíp không bao giờ đăng nhập. Chính
những người này là đối tượng để test chức năng "quản trị tạo tài khoản".

> **Lần đăng nhập đầu của mọi tài khoản đều bị ép sang trang đổi mật khẩu.** Đó là AUTH-04
> hoạt động đúng, không phải lỗi. Sau khi đổi, mật khẩu trong bảng hết hiệu lực.

---

## 3. Kịch bản nghiệm thu

### 3.1 Cổng chặn route — làm trước khi đăng nhập

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | Chưa đăng nhập, gõ thẳng `/admin/dashboard` | Bật về `/login`, **không thấy giao diện quản trị lóe lên** dù một khung hình |
| 2 | Chưa đăng nhập, gõ thẳng `/employee` | Bật về `/login` |
| 3 | Mở `/login` | Hiện bình thường |

Bước 1 quan trọng ở chỗ *"không lóe lên"*. Nếu giao diện quản trị kịp vẽ rồi mới chuyển
trang, nghĩa là chặn ở phía client chứ không phải ở `middleware.ts` — tiêu chí số 2 của
phase chưa đạt.

### 3.2 Vòng đời tài khoản và buộc đổi mật khẩu

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 4 | Đăng nhập bằng một tài khoản vừa reset | Bị ép sang `/doi-mat-khau` ngay |
| 5 | Đang ở đó, gõ thẳng `/admin/dashboard` | Bật ngược lại `/doi-mat-khau` |
| 6 | Vẫn ở đó, gõ thẳng `/select-company` | Bật ngược lại — **đường lách dễ bỏ sót nhất** |
| 7 | Đổi mật khẩu | **Vào thẳng, không phải tải lại trang, không bị đá về lại** |
| 8 | Bấm quanh vài trang ngay sau đó | Không bị đăng xuất bất ngờ, không màn hình lỗi |
| 9 | Đăng xuất, đăng nhập bằng mật khẩu **mới** | Vào thẳng |
| 10 | Thử đăng nhập bằng mật khẩu **tạm cũ** | Bị từ chối |

**Bước 7 là bước quan trọng nhất của cả đợt nghiệm thu.** Cờ `must_change_password` nằm
trong `app_metadata`, mà `app_metadata` chỉ vào JWT sau khi token được làm mới. Nếu xóa
cờ mà không ép làm mới phiên, người dùng vẫn cầm token cũ mang cờ cũ — đổi mật khẩu
thành công rồi mà vẫn bị đá về trang đổi mật khẩu, **và không có đường nào thoát ra**.
Nếu bước 7 phải tải lại trang mới vào được, hãy báo lại: đó là lỗi thật.

### 3.3 Quản trị tạo tài khoản cho nhân viên

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 11 | Đăng nhập owner, mở hồ sơ một nhân viên **chưa có tài khoản** (30 người) | Có nút tạo tài khoản đăng nhập |
| 12 | Bấm tạo tài khoản | Hiện email và mật khẩu tạm **một lần** |
| 13 | Đóng hộp thoại, mở lại hồ sơ đó | Mật khẩu **không hiện lại** |
| 14 | Đăng xuất, đăng nhập bằng tài khoản vừa tạo | Bị ép đổi mật khẩu, rồi vào được |

### 3.4 Phiên sống qua đóng/mở trình duyệt

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 15 | Đăng nhập xong, **tắt hẳn trình duyệt** (đóng tiến trình, không chỉ đóng tab) | — |
| 16 | Mở lại, vào thẳng `/admin/dashboard` | Vẫn đăng nhập, không hỏi lại |
| 17 | Đăng xuất, rồi gõ thẳng `/admin/dashboard` | Bật về `/login` ngay |

### 3.5 Mười ba màn hình trên dữ liệu thật

Đăng nhập tài khoản **owner** cho các bước quản trị.

| # | Màn hình | Việc cần làm | Kỳ vọng |
|---|---|---|---|
| 18 | `/select-company` | Xem danh sách | Đúng doanh nghiệp mình là thành viên, lấy từ Postgres |
| 19 | `/admin/dashboard` | Xem KPI và biểu đồ | Biểu đồ 7 ngày **kết thúc ở hôm nay theo ngày thật** |
| 20 | `/admin/departments` | Thêm → sửa → xóa một phòng ban | Cả ba vào thẳng DB |
| 21 | `/admin/shifts` | Nhân bản một ca rồi sửa bản sao | Ca đêm hiển thị đúng tổng giờ, không âm |
| 22 | `/admin/employees` | Tìm `nguyen` (không dấu) | Ra cả `Nguyễn` — bỏ dấu chạy ở tầng DB |
| 23 | `/admin/employees` | Lọc phòng ban, chuyển trang | Không mất dòng, không lặp dòng khi qua ranh giới trang |
| 24 | `/admin/employees` | Chọn nhiều dòng, chuyển phòng ban hàng loạt | Đổi đúng số dòng đã chọn |
| 25 | `/admin/employees/new` | Tạo nhân viên mới | Tạo được |
| 26 | `/admin/employees/new` | Tạo lại với **cùng mã nhân viên** | Bị từ chối, thông báo nêu đúng mã trùng |
| 27 | `/admin/employees/<id>` | Mở hồ sơ | Đủ năm tab, số liệu thật |
| 28 | `/employee` | Đăng nhập nhân viên, chấm công vào rồi ra | **Giờ hiện ra là giờ thật lúc bấm**, do server cấp |
| 29 | `/employee/history` | Xem tháng này, lùi tháng trước | Khớp với chấm công vừa tạo |
| 30 | `/employee/requests` | Tạo một yêu cầu nghỉ phép | **Ngày mặc định của biểu mẫu là hôm nay** |
| 31 | `/employee/profile` | Xem hồ sơ cá nhân | Đúng người đang đăng nhập |
| 32 | `/onboarding` | Tạo một doanh nghiệp mới | Vào được ngay sau đó, và **chưa có nhân viên nào** — cách tốt nhất để xem toàn bộ empty state |

**Suốt quá trình mở DevTools → Console.** Kỳ vọng: không cảnh báo lệch lần vẽ (hydration
mismatch), không lỗi đỏ. Một cảnh báo hydration là dấu hiệu còn chỗ nào đó đọc đồng hồ
máy khi vẽ lần đầu.

**Cuối cùng** quay lại `/admin/dashboard` bằng owner, xác nhận thao tác ở bước 20, 21,
24, 25 đã phản ánh vào số liệu.

### 3.6 Cô lập giữa hai doanh nghiệp

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 33 | Đăng nhập `cty-01`, ghi lại id một nhân viên bất kỳ | — |
| 34 | Đăng xuất, đăng nhập `cty-02`, gõ thẳng `/admin/employees/<id-cua-cty-01>` | Báo không tìm thấy — **giống hệt khi id không tồn tại**, không được để lộ rằng id đó có thật |

Bước 34 kiểm một thứ tinh tế: phân biệt "không có quyền" với "không tồn tại" là một dạng
rò rỉ thông tin. Hai trường hợp phải nhìn giống hệt nhau.

### 3.7 Giao diện đáp ứng

DevTools → Toggle device toolbar → nhập chiều rộng thủ công:

| Chiều rộng | Cần kiểm tra |
|---|---|
| **375px** | Bảng nhân viên chuyển thành thẻ; đăng nhập chỉ còn dải màu mỏng phía trên; KPI xếp 2 cột; không cuộn ngang |
| **768px** | Sidebar quản trị vẫn là drawer (nút ☰); bảng nhân viên bắt đầu hiện dạng bảng |
| **1024px** | Sidebar cố định hiện ra; dashboard bắt đầu chia cột |
| **1440px** | Đăng nhập chia đôi màn hình có mockup; dashboard 2 cột đầy đủ |

Màn hình nhân viên thiết kế cho điện thoại: bật chế độ iPhone, kiểm thanh điều hướng
dưới cùng có 4 tab, **không che nội dung**, mỗi nút cao tối thiểu 44px.

### 3.8 Khả năng tiếp cận

- **Bàn phím:** ở `/admin/employees` nhấn `Tab` liên tục — mọi nút, ô lọc, dòng bảng đều
  có viền tím rõ khi được chọn.
- **Hộp thoại:** mở một hộp thoại xác nhận, nhấn `Tab` — tiêu điểm bị giữ trong hộp
  thoại; nhấn `Esc` để đóng.
- **Không chỉ dựa vào màu:** mọi badge trạng thái đều có **icon + chữ**, không chỉ chấm màu.
- **Nút biểu tượng** đều có nhãn cho trình đọc màn hình.

---

## 4. Sự cố đã gặp trong dự án này

### 4.1 `npm run test:db` làm sập toàn bộ đăng nhập

**Triệu chứng.** Mọi thao tác liên quan người dùng trả về 500:

```
GET /auth/v1/admin/users → 500
{"code":500,"error_code":"unexpected_failure","msg":"Database error finding users"}
```

Đăng nhập hỏng, `seed:auth` hỏng, `reset:passwords` hỏng — dù các tài khoản trong DB
hoàn toàn bình thường.

**Nguyên nhân.** `supabase/tests/00_fixture_users.sql` chèn bốn uuid tổng hợp thẳng vào
`auth.users` — bảng do Supabase quản lý. Trên Postgres tạm của CI điều đó vô hại, vì ở đó
`auth.users` chỉ là bảng tương thích và không có GoTrue nào đọc. Trên cloud thật thì
khác: bốn dòng ấy thiếu `encrypted_password`, `confirmation_token`, `recovery_token`,
`email_change`, `created_at`. GoTrue quét **toàn bộ** bảng khi liệt kê người dùng, gặp
NULL ở cột nó khai là không-null thì cả truy vấn sập. Bốn dòng rác chặn đường của mọi
tài khoản hợp lệ.

**Đã phòng.** `scripts/db.mjs` nay từ chối chạy `test` và `testdb` khi host là
`supabase.co` / `.com` / `.in`. Bất biến "uuid tổng hợp không bao giờ chạm cloud" từ chỗ
là quy ước đã thành thứ cưỡng chế được bằng máy.

**Nếu vẫn dính** (ví dụ ai đó đặt `TF_ALLOW_CLOUD_TESTS=1`), dọn bằng:

```sql
delete from auth.users
where id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004'
)
and encrypted_password is null;   -- lop chan thu hai: tai khoan that khong bao gio NULL o cot nay
```

Rồi `npm run seed:auth` để nối lại `memberships` và `employees.user_id`.

### 4.2 Mất mật khẩu tạm

`seed:auth` sinh mật khẩu **một lần** rồi in ra màn hình, cố ý không ghi xuống đĩa. Mất
lần in đó thì không lấy lại được.

**Đừng xóa tài khoản để tạo lại** — làm vậy mất `auth.users.id`, kéo theo `memberships`,
`employees.user_id` và `audit_log.actor_user_id`. Dùng lệnh này, nó giữ nguyên id:

```bash
npm run reset:passwords
```

### 4.3 File cấu hình hỏng sau khi sửa bằng PowerShell

**Triệu chứng.** Biến môi trường đầu tiên trong file "biến mất" dù nhìn bằng mắt vẫn thấy
đủ. `process.loadEnvFile()` báo thiếu đúng biến đó.

**Nguyên nhân.** `Set-Content` và `Out-File` với `-Encoding utf8` trên Windows
PowerShell 5.1 ghi kèm BOM. Ba byte `EF BB BF` dính vào tên biến đầu tiên.

**Kiểm:**

```powershell
$b = [System.IO.File]::ReadAllBytes('.env.local')
$b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF   # True nghia la co BOM
```

**Sửa:** đọc byte, bỏ ba byte đầu, ghi lại bằng `[System.IO.File]::WriteAllBytes`.
**Tránh:** dùng trình soạn thảo, hoặc
`[System.IO.File]::WriteAllText($p, $s, (New-Object System.Text.UTF8Encoding($false)))`.

### 4.4 `npm run dev` nhảy cổng

Next.js tự đổi cổng khi 3000 bận — có thể ra 3006, 3007… Đọc dòng `Local:` trong output
thay vì mặc định gõ `localhost:3000`. **Đừng `pkill -f "next dev"` bừa**: lệnh đó giết
luôn tiến trình của người khác đang chạy từ trước.

### 4.5 Cổng kiểm tra báo xanh sai

Trong lúc dựng `check:signup`, phiên bản đầu dò chuỗi `"signup"` trong thông báo lỗi.
Địa chỉ email dùng để probe lại tên là `signup-probe-…`, mà GoTrue thì lặp lại địa chỉ
trong thông báo — nên phép dò tự khớp với chính đầu vào của mình và **báo xanh trong khi
đăng ký vẫn đang bật**.

Bài học đã áp vào script: **chỉ chấp nhận đúng mã lỗi của nhà cung cấp, không dò chuỗi
trong thông báo**, và mọi trường hợp không rõ đều fail. Một cổng nói dối còn tệ hơn không
có cổng.

### 4.6 Muốn về trạng thái dữ liệu gốc

Khác V1, dữ liệu giờ tồn tại vĩnh viễn. Để làm sạch:

```bash
npm run db:seed      # Ghi de du lieu nghiep vu — XOA moi thay doi ban vua tao
npm run seed:auth    # Noi lai wiring tai khoan (db:seed khong biet ve tai khoan)
```

Thứ tự này bắt buộc: `db:seed` ghi đè bảng `employees` nên xóa cột `user_id`, phải chạy
`seed:auth` sau để nối lại.

---

## 5. Dữ liệu mẫu

### Hai doanh nghiệp

| | Ngọc Phát | Bình Minh |
|---|---|---|
| Tên đầy đủ | Công ty TNHH Thương mại Ngọc Phát | Xưởng Sản xuất Bình Minh |
| Mã | `cty-01` | `cty-02` |
| Nhân viên | 28 | 12 |
| Phòng ban | 5 | 4 |
| Ca làm việc | 4 | 3 |
| Yêu cầu chờ duyệt | 6 | 2 |

Ngày tháng trong dữ liệu mẫu **trượt theo ngày chạy seed**, không chốt cứng — nên
dashboard "7 ngày gần đây" và kỳ công đang mở luôn có số, kể cả khi seed lại sau nhiều
tháng.

### Ca làm việc — Ngọc Phát

| Ca | Mã | Giờ | Nghỉ | Cho phép muộn |
|---|---|---|---|---|
| Ca hành chính | HC | 08:00 – 17:30 | 90 phút | 5 phút |
| Ca sáng | S1 | 06:00 – 14:00 | 30 phút | 10 phút |
| Ca chiều | C1 | 14:00 – 22:00 | 30 phút | 10 phút |
| **Ca đêm** | D1 | 22:00 – 06:00 | 45 phút | 10 phút |

Ca đêm là ca **qua ngày** — dùng để kiểm phép tính giờ. Quy ước đã khóa: giờ của ca qua
đêm tính trọn vào **ngày bắt đầu ca**, không chia theo số giờ rơi vào mỗi ngày.

### Ca làm việc — Bình Minh

| Ca | Mã | Giờ | Ghi chú |
|---|---|---|---|
| Ca ngày 12 tiếng | N12 | 06:00 – 18:00 | Chỉ T2, T4, T6, T7 |
| **Ca đêm 12 tiếng** | D12 | 18:00 – 06:00 | Ca qua đêm |
| Ca hành chính xưởng | HCX | 07:30 – 16:30 | T2 – T7 |

### Trạng thái nhân viên

Dữ liệu mẫu phủ đủ **4 trạng thái** (đang làm việc, đang nghỉ phép, chưa kích hoạt, đã
nghỉ việc) và đủ **5 loại hợp đồng** (toàn thời gian, bán thời gian, thử việc, thời vụ,
thực tập) để test bộ lọc.

---

## 6. Danh sách đường link

Thay `3000` bằng cổng thật trong output của `npm run dev`.

### Vào được khi chưa đăng nhập

| Màn hình | Đường link |
|---|---|
| Trang chủ (tự chuyển sang đăng nhập) | `/` |
| Đăng nhập | `/login` |
| Đổi mật khẩu bắt buộc | `/doi-mat-khau` |

### Bắt buộc đăng nhập — quản trị, tối ưu cho máy tính

| Màn hình | Đường link |
|---|---|
| Chọn doanh nghiệp | `/select-company` |
| Tạo doanh nghiệp (wizard 3 bước) | `/onboarding` |
| Tổng quan | `/admin/dashboard` |
| Danh sách nhân viên | `/admin/employees` |
| Thêm nhân viên | `/admin/employees/new` |
| Chi tiết nhân viên | `/admin/employees/<id>` |
| Phòng ban | `/admin/departments` |
| Ca làm việc | `/admin/shifts` |

### Bắt buộc đăng nhập — nhân viên, thiết kế cho điện thoại

| Màn hình | Đường link |
|---|---|
| Trang chủ nhân viên | `/employee` |
| Lịch sử chấm công | `/employee/history` |
| Yêu cầu | `/employee/requests` |
| Hồ sơ cá nhân | `/employee/profile` |

Mở thẳng biểu mẫu tạo yêu cầu theo loại: `/employee/requests?type=leave` ·
`?type=attendance_supplement` · `?type=time_adjustment` · `?type=overtime`

### Chưa xây dựng

`/admin/attendance`, `/admin/payroll`, `/admin/settings` hiển thị nhãn **"Sắp ra mắt"**
trên sidebar và cố ý không điều hướng. Gõ thẳng đường link ra 404 — đúng thiết kế.

---

## 7. Những gì cố ý chưa có

Không phải lỗi — nằm ngoài phạm vi hiện tại:

**Sẽ làm ở các phase sau của V2:** chấm công kèm ảnh hiện trường và GPS · cấu hình điểm
làm việc · trang cài đặt doanh nghiệp (giờ làm, ngày lễ, hệ số tăng ca) · duyệt yêu cầu
từ phía quản trị (hiện chỉ xem được danh sách chờ) · chốt kỳ công · màn hình super admin.

**Hoãn sang V3:** tính lương đầy đủ, phiếu lương, thuế và bảo hiểm.

**Loại trừ có chủ đích:** chấm công bằng QR · máy chấm công phần cứng · nhận diện khuôn
mặt · thanh toán gói SaaS · mời thành viên qua email/SMS · đa ngôn ngữ · mobile app native.

---

## 8. Bảng tra nhanh

| Lệnh | Dùng khi |
|---|---|
| `npm run dev` | Chạy ứng dụng để nghiệm thu tay |
| `npm run typecheck` · `npm run lint` | Sau mỗi lần sửa code |
| `npm run test` | Trước khi commit |
| `npm run build` · `npm run check:secrets` | Trước khi giao |
| `npm run db:push` | Sau khi thêm migration |
| `npm run db:seed` | Nạp lại dữ liệu mẫu (ghi đè dữ liệu nghiệp vụ) |
| `npm run test:rls` | Kiểm cô lập giữa hai doanh nghiệp |
| `npm run check:assertions` | Kiểm số assertion pgTAP không tụt |
| `npm run seed:auth` | Tạo 10 tài khoản thật (chạy lại được) |
| `npm run reset:passwords` | Lấy lại mật khẩu tạm khi đã mất |
| `npm run check:signup` | Kiểm đăng ký công khai đã tắt chưa |
