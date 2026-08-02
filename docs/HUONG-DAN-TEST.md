# Hướng dẫn kiểm thử TimeFlow

Tài liệu này mô tả cách kiểm chứng hệ thống **sau Phase 3** — thời điểm mỗi lần chấm công
mang theo bằng chứng (ảnh chụp trực tiếp + toạ độ GPS), và quản trị có màn hình xem lại.

> **Chỉ muốn đi một vòng xem có gì?** Nhảy thẳng xuống [§0](#0-đi-một-vòng-nhanh).
> Phần còn lại là kiểm thử chi tiết, đọc khi cần.

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

> **Quy ước credential.** Không file nào **được git theo dõi** chứa mật khẩu hay khóa.
> Danh sách tài khoản (email, doanh nghiệp, vai trò) thì nằm ngay trong tài liệu này vì
> nó không phải bí mật và không đổi. Mật khẩu tạm lấy bằng `npm run reset:passwords`,
> hoặc đọc `docs/env.test-accounts` — file đó nằm ngoài git (`.gitignore` dòng 37).

---

## 0. Đi một vòng nhanh

Phần này để trả lời đúng một câu hỏi: **hệ thống hiện có những chức năng gì?** Khoảng
20–30 phút, không cần đọc gì thêm.

### 0.1 Dựng môi trường (một lần)

```bash
npm run db:push          # Ap migration (hien co 12 migration)
npm run db:seed          # Nap du lieu mau hai doanh nghiep
npm run db:bucket        # Tao bucket Storage rieng tu cho anh cham cong
npm run seed:auth        # Tao 10 tai khoan dang nhap that
npm run reset:passwords  # In bang mat khau tam — CHI HIEN MOT LAN, luu lai ngay
npm run dev
```

Đọc dòng `Local:` trong output để biết cổng thật (Next tự nhảy cổng khi 3000 bận).

### 0.2 Vòng quản trị — máy tính

Đăng nhập `nv001@ngocphat.test` (owner). Lần đầu sẽ **bị ép đổi mật khẩu** — đó là đúng.

| Thứ tự | Màn hình | Bạn sẽ thấy chức năng gì |
|---|---|---|
| 1 | `/admin/dashboard` | KPI, biểu đồ chấm công 7 ngày, hoạt động hôm nay, yêu cầu chờ duyệt |
| 2 | `/admin/employees` | Danh sách 28 nhân viên: tìm không dấu, lọc phòng ban/trạng thái, chọn nhiều dòng đổi phòng ban hàng loạt |
| 3 | `/admin/employees/<id>` | Hồ sơ 5 tab. **Tab chấm công có chấm tròn nhỏ ở dòng nào có ảnh** — bấm vào mở dialog xem lại bằng chứng |
| 4 | `/admin/employees/new` | Tạo nhân viên; thử tạo trùng mã để xem cổng chặn |
| 5 | `/admin/departments` | Thêm / sửa / xóa phòng ban |
| 6 | `/admin/shifts` | 4 ca, có ca đêm qua ngày; nhân bản rồi sửa bản sao |
| 7 | `/admin/work-sites` | **Mới ở phase 3** — khai báo điểm làm việc: toạ độ + bán kính cho phép |
| 8 | `/admin/attendance/review` | **Mới ở phase 3** — danh sách lần chấm công cần người xem lại |

Ba mục `/admin/attendance`, `/admin/payroll`, `/admin/settings` hiện nhãn *"Sắp ra mắt"*
và cố ý không đi đâu cả.

### 0.3 Vòng nhân viên — điện thoại

Mở DevTools → Toggle device toolbar → chọn iPhone. Đăng nhập `nv004@ngocphat.test`.

| Thứ tự | Màn hình | Bạn sẽ thấy chức năng gì |
|---|---|---|
| 1 | `/employee` | Thẻ trạng thái hôm nay, nút **Vào ca** / **Tan ca**, tóm tắt tháng, lối tắt |
| 2 | `/employee` → bấm **Vào ca** | **Trọng tâm phase 3**: mở Camera Sheet, xin quyền camera + vị trí, chụp ảnh trực tiếp, gửi kèm toạ độ |
| 3 | `/employee` → bấm **Tan ca** | Đi qua đúng Camera Sheet đó — lần ra cũng mang bằng chứng như lần vào |
| 4 | `/employee/history` | Lịch sử theo tháng, lùi được tháng trước |
| 5 | `/employee/requests` | Tạo yêu cầu: nghỉ phép, bổ sung công, điều chỉnh giờ, tăng ca |
| 6 | `/employee/profile` | Hồ sơ cá nhân của đúng người đang đăng nhập |

**Lưu ý khi test camera trên trình duyệt máy tính:** camera cần HTTPS hoặc `localhost`.
Trên `localhost` thì chạy được. Webcam máy tính sẽ đóng vai camera điện thoại — đủ để
xem luồng, nhưng **không thay được kiểm thử trên thiết bị thật** (mục 3.9.4).

### 0.4 Xem cô lập hai doanh nghiệp có thật không

Đây là lời hứa lõi của sản phẩm, và có một lệnh chứng minh nó qua HTTP thật:

```bash
npm run test:e2e-photo -- nv001@ngocphat.test '<mk>' bm001@binhminh.test '<mk>'
```

Kỳ vọng `8 pass, 0 fail`. Nó đăng nhập thật bằng ba tài khoản rồi kiểm: chủ doanh nghiệp
A xem được ảnh của A (200), doanh nghiệp B xin đúng ảnh đó nhận **404** (không phải 403 —
không được để lộ rằng ảnh có tồn tại), nhân viên thường cùng doanh nghiệp nhận 403, không
cookie nhận 401.

### 0.5 Bản đồ chức năng theo phase

| Nhóm | Trạng thái |
|---|---|
| Đăng nhập, đổi mật khẩu bắt buộc, chọn doanh nghiệp, tạo doanh nghiệp | ✓ Phase 1–2 |
| Nhân viên, phòng ban, ca làm việc, dashboard | ✓ Phase 1–2 |
| Cô lập dữ liệu giữa hai doanh nghiệp (RLS + tầng ứng dụng) | ✓ Phase 2, mở rộng sang ảnh ở Phase 3 |
| Chấm công vào/ra kèm ảnh trực tiếp + GPS | ✓ Phase 3 |
| Điểm làm việc (toạ độ, bán kính) | ✓ Phase 3 |
| Đánh dấu lần chấm công đáng ngờ + màn hình xem lại | ✓ Phase 3 |
| Xem lại ảnh bằng chứng phía quản trị | ✓ Phase 3 |
| Duyệt yêu cầu phía quản trị, chốt kỳ công, cài đặt doanh nghiệp | ○ Phase sau |
| Tính lương, phiếu lương | ○ V3 |

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
npm run check:assertions  # Dem assertion pgTAP, san toi thieu 199
```

### 1.3 Cổng chạm cơ sở dữ liệu

```bash
npm run db:push      # Ap migration len Postgres
npm run db:seed      # Nap lai du lieu nghiep vu hai doanh nghiep (GHI DE du lieu hien co)
npm run db:bucket    # Tao/kiem bucket Storage rieng tu cho anh cham cong
npm run test:rls     # pgTAP: co lap giua hai doanh nghiep
```

### 1.3b Cổng chạy qua HTTP thật

Hai lệnh này cần `npm run dev` đang chạy ở terminal khác, và cần mật khẩu tạm:

```bash
npm run test:e2e         # Dang nhap, doi mat khau, co lap giua hai doanh nghiep
npm run test:e2e-photo -- <email-A> <mk-A> <email-B> <mk-B>   # Co lap ANH cham cong
```

`test:e2e-photo` là **cách duy nhất trong repo** phát hiện được lỗi RLS ở tầng
`storage.objects`. Mọi test tích hợp trong `npm run test` đều mock `createServerSupabase()`
để trả về client dùng secret key, mà client đó **bỏ qua RLS** — nên chúng không bao giờ
chạm tới lớp ấy. Bài học này không phải lý thuyết: chính `test:e2e-photo` đã tìm ra bucket
`attendance-photos` không có policy RLS nào, tức là mọi thao tác Storage của người dùng
thật đều bị chặn im lặng, trong khi toàn bộ 200+ test vẫn xanh.

### 1.4 Từng cổng chứng minh điều gì

| Lệnh | Chứng minh |
|---|---|
| `npm run test` | Tầng dữ liệu giữ đúng hình dạng lỗi `error: string \| null`; Route Handler chỉ export `GET`; điểm kiểm danh tính là duy nhất; chuỗi chống mắc kẹt khi đổi mật khẩu |
| `npm run test:rls` | Tài khoản doanh nghiệp A không đọc/ghi được một dòng nào của B, kiểm **theo từng bảng** chứ không phải một khẳng định chung |
| `npm run check:assertions` | Số assertion pgTAP không âm thầm giảm khi ai đó sửa bộ test |
| `npm run check:secrets` | Không khóa bí mật nào lọt vào client bundle. Cổng này đã được chứng minh có răng bằng thủ tục phá-rồi-hoàn |
| `npm run test:e2e-photo` | Ảnh chấm công **thật sự** cô lập giữa hai doanh nghiệp, kiểm qua HTTP thật với cookie phiên thật — không mock chỗ nào |
| `src/__tests__/no-signed-url.test.ts` (trong `npm run test`) | Không ai lén đưa signed URL / `getPublicUrl` quay lại `src/`. Ảnh chỉ được đi qua broker route |
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

### Mười tài khoản nghiệm thu

`seed:auth` tạo 10 tài khoản đại diện — mỗi doanh nghiệp một owner, một admin, một
manager và hai nhân viên:

| Email | Doanh nghiệp | Vai trò | Dùng để nghiệm thu |
|---|---|---|---|
| `nv001@ngocphat.test` | Ngọc Phát (`cty-01`) | owner | Toàn bộ phần quản trị: dashboard, phòng ban, ca, nhân viên, tạo tài khoản |
| `nv002@ngocphat.test` | Ngọc Phát | admin | Phân quyền cấp admin |
| `nv003@ngocphat.test` | Ngọc Phát | manager | Phân quyền cấp giữa |
| `nv004@ngocphat.test` | Ngọc Phát | employee | App nhân viên: chấm công, lịch sử, yêu cầu, hồ sơ |
| `nv005@ngocphat.test` | Ngọc Phát | employee | Nhân viên thứ hai, để so sánh |
| `bm001@binhminh.test` | Bình Minh (`cty-02`) | owner | **Kiểm cô lập**: dán id nhân viên của `cty-01` vào |
| `bm002@binhminh.test` | Bình Minh | admin | |
| `bm003@binhminh.test` | Bình Minh | manager | |
| `bm004@binhminh.test` | Bình Minh | employee | App nhân viên phía doanh nghiệp thứ hai |
| `bm005@binhminh.test` | Bình Minh | employee | |

**Mật khẩu tạm không nằm trong tài liệu này.** Hai lý do, cả hai đều thực tế:

- Mật khẩu commit vào git thì nằm lại trong lịch sử vĩnh viễn, kể cả sau khi xóa.
- Chúng **đổi mỗi lần** ai đó chạy `reset:passwords` — chép vào đây là biến một tài
  liệu đúng thành tài liệu sai ngay ở lần chạy kế tiếp.

Lấy bảng mật khẩu bằng một trong hai cách:

```bash
npm run reset:passwords     # sinh bo moi va in ra man hinh
cat docs/env.test-accounts  # bo da luu lan truoc (file nay nam ngoai git)
```

**30 nhân viên còn lại cố ý không có tài khoản** (`employees.user_id = null`). Đó không
phải thiếu sót mà mô phỏng đúng thực tế: công nhân ca kíp không bao giờ đăng nhập. Chính
những người này là đối tượng để test chức năng "quản trị tạo tài khoản đăng nhập".

> **Lần đăng nhập đầu của mọi tài khoản đều bị ép sang trang đổi mật khẩu.** Đó là AUTH-04
> hoạt động đúng, không phải lỗi. Sau khi đổi, mật khẩu tạm hết hiệu lực — muốn quay lại
> trạng thái ban đầu thì chạy `npm run reset:passwords`.

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

### 3.9 Chấm công có bằng chứng — phần mới của Phase 3

#### 3.9.1 Khai báo điểm làm việc

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 35 | Owner mở `/admin/work-sites` | Danh sách điểm làm việc; rỗng thì có empty state tử tế |
| 36 | Tạo một điểm: tên, toạ độ, bán kính | Lưu được, hiện ngay trong danh sách |
| 37 | Sửa bán kính rồi lưu | Giá trị mới hiện đúng |
| 38 | Đăng nhập `cty-02`, mở `/admin/work-sites` | **Chỉ thấy điểm của Bình Minh**, không thấy của Ngọc Phát |

#### 3.9.2 Chấm công kèm ảnh và GPS

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 39 | Nhân viên bấm **Vào ca** | Camera Sheet mở, xin quyền camera và vị trí |
| 40 | Chụp ảnh rồi gửi | Chấm công thành công; **giờ là giờ máy chủ**, không phải giờ máy người dùng |
| 41 | Bấm **Tan ca**, chụp ảnh | Lần ra cũng đi qua đúng Camera Sheet đó |
| 42 | Từ chối quyền camera | Hiện thông báo rõ ràng, không treo, không màn hình trắng |
| 43 | Từ chối quyền vị trí | Thông báo riêng, phân biệt được với lỗi camera |
| 44 | Bật chế độ máy bay rồi gửi | Báo mất kết nối, cho gửi lại |
| 45 | Chấm công ở xa hơn 5× bán kính điểm gần nhất | Vẫn **nhận**, nhưng hiện banner "đã ghi nhận, sẽ được xem lại" |

Bước 45 là quy tắc D-21 và nó cố ý **không chặn**: GPS trong nhà xưởng sai 20–50m, nhân
viên có thể đang công tác, hoặc toạ độ điểm làm việc bị khai sai. Vượt ngưỡng chỉ có
nghĩa "cần người xem lại", không có nghĩa "gian lận".

#### 3.9.3 Quản trị xem lại bằng chứng

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 46 | Owner mở `/admin/attendance/review` | Danh sách lần chấm công vượt ngưỡng |
| 47 | Mở một dòng | Dialog: hai ô ảnh (vào/ra) độc lập, khoảng cách **luôn đi kèm độ chính xác GPS**, toạ độ thô, link mở Google Maps |
| 48 | Bấm **Đánh dấu đã xem xét** | Trạng thái đổi; `reviewed_at` là giờ máy chủ |
| 49 | Mở hồ sơ nhân viên → tab chấm công | Dòng nào có ảnh thì có chấm tròn nhỏ; bấm mở đúng dialog trên |
| 50 | DevTools → Network, chặn request tới broker route | Ô ảnh hiện trạng thái lỗi + nút thử lại, phần còn lại của dialog vẫn dùng được |

#### 3.9.4 Kiểm trên thiết bị thật — **chưa chạy**

> **Chưa ai làm những bước này.** Chúng cần điện thoại thật và không tự động hoá được.
> Ghi ở đây để không rơi vào quên lãng.

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 51 | Mở app trên **Android**, bấm Vào ca | Chỉ mở camera **mặt sau**, không có đường vào thư viện ảnh |
| 52 | Mở app trên **iOS**, bấm Vào ca | Như trên |
| 53 | Đo thời gian bắt GPS, 3 lần, tại văn phòng thật | Ghi lại con số; quá lâu thì cần chỉnh timeout |
| 54 | Từ chối quyền trên thiết bị thật rồi cấp lại | Phục hồi được, không phải cài lại app |
| 55 | Bật chế độ máy bay trên thiết bị thật giữa lúc gửi | Báo lỗi đúng, gửi lại được sau khi có mạng |

Bước 51–52 là điều **chỉ thiết bị thật mới trả lời được**: trình duyệt máy tính luôn cho
chọn webcam, nên không chứng minh được gì về ràng buộc "chỉ camera sau, không thư viện".

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

> **Sự cố này đã tái diễn hai lần trong Phase 3**, cả hai lần đều vì có người đặt
> `TF_ALLOW_CLOUD_TESTS=1` để lách cổng chặn khi máy không có Docker. Cổng chặn đúng,
> nhưng **cửa thoát hiểm quá dễ mở và không tự dọn**. Nếu bạn định dùng cờ đó, hãy coi
> việc chạy đoạn SQL dọn bên dưới là **phần bắt buộc của cùng một thao tác**, không phải
> việc để lúc khác. Cân nhắc bỏ hẳn cờ này, hoặc bắt nó tự dọn sau khi chạy.

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

**Phải chạy bằng `psql`, không dùng được Supabase Admin API.** `admin.deleteUser()` phải
đọc dòng user trước khi xóa, mà chính thao tác đọc đó đang là thứ bị hỏng — nên nó thất
bại với lỗi rỗng. Trên Windows `psql` thường không nằm sẵn trên PATH; nó ở
`C:\Program Files\PostgreSQL\<phiên bản>\bin\psql.exe`, và chuỗi kết nối là biến
`POSTGRES_URL_NON_POOLING` trong `.env.local`.

Bốn dòng fixture còn được tham chiếu từ `platform_admins`, `memberships`,
`employees.user_id` và `audit_log.actor_user_id`. Nếu khóa ngoại chặn lệnh `delete`, gỡ
các tham chiếu đó trước rồi xóa lại.

Rồi `npm run seed:auth` để nối lại `memberships` và `employees.user_id`, và
`npm run reset:passwords` để có mật khẩu dùng được.

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
| Điểm làm việc | `/admin/work-sites` |
| Chấm công cần xem lại | `/admin/attendance/review` |

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

**Sẽ làm ở các phase sau của V2:** trang cài đặt doanh nghiệp (giờ làm, ngày lễ, hệ số
tăng ca) · duyệt yêu cầu từ phía quản trị (hiện chỉ xem được danh sách chờ) · chốt kỳ
công · màn hình super admin · màn hình chấm công tổng hợp `/admin/attendance`.

**Đã xong ở Phase 3** (trước đây nằm trong danh sách này): chấm công kèm ảnh hiện trường
và GPS · cấu hình điểm làm việc · đánh dấu lần chấm công đáng ngờ · xem lại ảnh bằng
chứng phía quản trị.

**Ngưỡng đáng ngờ hiện là hằng số** (5× bán kính điểm làm việc gần nhất), chưa đọc từ cấu
hình doanh nghiệp — sẽ chuyển ở Phase 4 khi trang cài đặt ra đời.

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
| `npm run db:bucket` | Tạo/kiểm bucket Storage riêng tư cho ảnh chấm công |
| `npm run test:rls` | Kiểm cô lập giữa hai doanh nghiệp |
| `npm run test:e2e-photo` | Kiểm cô lập **ảnh chấm công** qua HTTP thật (cần `npm run dev`) |
| `npm run check:assertions` | Kiểm số assertion pgTAP không tụt |
| `npm run seed:auth` | Tạo 10 tài khoản thật (chạy lại được) |
| `npm run reset:passwords` | Lấy lại mật khẩu tạm khi đã mất |
| `npm run check:signup` | Kiểm đăng ký công khai đã tắt chưa |
