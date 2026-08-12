# Dữ liệu doanh nghiệp thật: Vinh Yến Food

**Ngày:** 2026-08-13
**Trạng thái:** chờ chủ dự án duyệt

## Mục tiêu

Đưa doanh nghiệp thật đầu tiên — Vinh Yến Food, 1 chủ + 10 nhân viên — vào hệ
thống đang chạy, đủ để chấm công và ra bảng lương ngay trong kỳ tháng 8/2026.

Đây **không phải** một tính năng mới. Toàn bộ lược đồ và màn hình cần thiết đã có
từ Phase 1–6; việc của bản thiết kế này là chọn đúng giá trị cho từng cột và ghi
chúng vào một script chạy lại được.

## Quyết định đã chốt với chủ dự án (2026-08-13)

| # | Quyết định | Lựa chọn |
|---|---|---|
| V-01 | Nơi đặt dữ liệu | **Chính database vẫn dùng** (dự án Supabase ở `.env.local`), không tách project riêng |
| V-02 | Cách nhập | Script Node chạy lại được, không nhập tay |
| V-03 | Cách tính công | `work_mode = 'daily_hours'` — thiếu giờ trừ theo tỉ lệ |
| V-04 | Tài khoản | Cả 11 người (Yến + 10 nhân viên) |
| V-05 | Mật khẩu ban đầu | `12345678`, **không** bắt đổi ở lần đăng nhập đầu |
| V-06 | Ngày hiệu lực lương | **2026-08-01** |
| V-07 | Email | tên không dấu + viết tắt họ đệm `@vinhyenfood.com` |
| V-08 | Lịch làm việc | **cả 7 ngày** trong tuần |

### V-01 kéo theo một rủi ro phải chặn bằng máy

`supabase/seed.sql` mở đầu bằng `truncate ... companies, employees ... cascade`.
Một lần `npm run db:seed` — thao tác mà `.planning/STATE.md` khuyên dùng nhiều lần
để dọn fixture test còn sót — sẽ **xoá sạch Vinh Yến Food**, không cảnh báo, không
hoàn tác được.

Vì V-01 đặt dữ liệu thật cạnh dữ liệu demo, chốt chặn không thể là một dòng ghi
chú. Nó phải nằm trong `scripts/db.mjs`: lệnh `seed` từ chối chạy khi database có
doanh nghiệp nào ngoài `cty-01`/`cty-02`, trừ khi người chạy đặt tường minh
`TF_SEED_WIPE_REAL_DATA=1`.

### V-03: vì sao `daily_hours` chứ không phải `shift`

Tiền tăng ca ở đây khai theo giờ (40.000đ/giờ). Chế độ `shift` trả đủ một công dù
người đó về sớm — cộng giờ thì tính từng giờ, trừ giờ thì không tính gì. `daily_hours`
đối xứng: mẫu số là `standard_hours_per_day = 9.5`, và một ngày công thành số thập
phân theo D-39.

Hệ quả kỹ thuật đã kiểm: `paysByActualHours = true` (`src/lib/payroll/compute.ts:223`),
nên lương gốc = `đơn giá giờ × số phút thường`, với đơn giá giờ = `250.000 / 9,5`
(`toHourlyRate`, `unit='day'`). `standard_days_per_month` không tham gia phép tính
nào nên để `null` — "chưa khai", không phải một con số bịa (D-26/D-38).

### V-08: vì sao phải khai đủ 7 ngày

`classifyWorkDay()` (`src/lib/attendance/classification.ts:90`) xếp ngày nằm ngoài
`shifts.working_days` là `weekend`, và `resolveDayCredit()` cho **toàn bộ** giờ làm
của ngày đó thành tăng ca. Khai nghỉ chủ nhật mà quán vẫn mở thì một ngày chủ nhật
của Nguyễn Thị Hiền ra 9,5 × 40.000 = 380.000đ thay vì 250.000đ, và không màn hình
nào báo lỗi.

## Dữ liệu

### companies

| Cột | Giá trị |
|---|---|
| `name` | Vinh Yến Food |
| `code` | `VINHYEN` |
| `industry` | `fnb` |
| `size` | `11-30` |
| `phone` | `0000000000` |
| `address` | `Chưa khai địa chỉ` |
| `accent` | `indigo` |

Chủ dự án chưa có số điện thoại và địa chỉ thật, và hai cột này là `NOT NULL`.
Giá trị điền vào **cố tình đọc ra là chưa khai** thay vì trông như thật: đây chính
là lập luận của migration 0028 — một giá trị đại diện trông như thật thì không ai
phân biệt được với dữ liệu thật, nên không ai sửa. Sửa sau ở `/admin/settings`.

`employees.work_location` **không** lấy từ `address` (vì address đang là chỗ trống)
mà đặt thẳng `Vinh Yến Food` — đó là một sự thật, không phải chỗ trống.

### company_settings

| Cột | Giá trị | Ghi chú |
|---|---|---|
| `work_mode` | `daily_hours` | V-03 |
| `standard_hours_per_day` | `9.5` | mẫu số quy một công ra giờ |
| `standard_days_per_month` | `null` | không ai ăn lương tháng |
| còn lại | mặc định của migration 0015 | ngưỡng nghi ngờ ×5, biên độ ca 120 phút, khung đêm 22:00–06:00 |

### shifts — một ca duy nhất

| Cột | Giá trị |
|---|---|
| `name` | Ca linh hoạt |
| `code` | `CA-LH` |
| `kind` | `hours` |
| `duration_minutes` | `570` (9,5 tiếng) |
| `start_time`, `end_time`, `break_start_time`, `break_end_time` | `null` |
| `break_minutes`, `late_tolerance_minutes` | `0` |
| `working_days` | `{1,2,3,4,5,6,7}` |
| `status` | `active` |

Ràng buộc `shifts_shape_check` (0027) đòi đúng hình dạng này cho `kind='hours'`.
Ca linh hoạt không tính đi muộn, về sớm, hay "ngoài khung giờ ca".

### employees, employee_pay_rates, employee_overtime_rates

Cả 11 dòng: `status='active'`, `start_date='2026-08-01'`, `shift_id` là ca linh hoạt,
`work_location='Vinh Yến Food'`, `invitation_sent=false`.

Để `null` (chưa khai, không bịa): `date_of_birth`, `gender`, `department_id`,
`position`, `contract_type`, `phone`, `manager_id`, `avatar_url`.

| Mã | Họ tên | Email `@vinhyenfood.com` | Vai trò | Lương/ngày | Tăng ca/giờ |
|---|---|---|---|---|---|
| QL01 | Nguyễn Yến | `yen` | `owner` | — | — |
| NV001 | Nguyễn Thị Hiền | `hien.nt` | `employee` | 250.000 | 40.000 |
| NV002 | Trần Thị Anh | `anh.tt` | `employee` | 270.000 | 40.000 |
| NV003 | Nguyễn Văn Thái | `thai.nv` | `employee` | 300.000 | 40.000 |
| NV004 | Nguyễn Thị Minh Thu | `thu.ntm` | `employee` | 270.000 | 40.000 |
| NV005 | Lê Thị Hiếu | `hieu.lt` | `employee` | 250.000 | 40.000 |
| NV006 | Nguyễn Thị Yên | `yen.nt` | `employee` | 270.000 | 40.000 |
| NV007 | Đinh Thị Mười | `muoi.dt` | `employee` | 250.000 | 40.000 |
| NV008 | Hà Việt Anh | `vietanh.hv` | `employee` | 220.000 | 40.000 |
| NV009 | Nguyễn Thị Sáu | `sau.nt` | `employee` | 270.000 | 40.000 |
| NV010 | Đường Văn Hưng | `hung.dv` | `employee` | 200.000 | **30.000** |

Quy tắc email là *tên + viết tắt họ đệm*, áp cho **cả mười người** chứ không phải
chỉ hai chỗ trùng (Trần Thị **Anh** / Hà Việt **Anh**, Nguyễn Thị **Yên** / chủ
**Yến**). Một quy tắc có hai ngoại lệ là quy tắc người ta gõ sai.

Chủ Yến không có mức lương: chị không ăn lương ngày trong danh sách này. Bảng lương
sẽ hiện dòng của chị với "chưa khai mức lương" chứ không phải số 0 — đúng ý D-26.

Hai cờ quyền:

- `can_view_payslip = false` cho 10 nhân viên, `true` cho Yến. Đây là **mặc định
  của lược đồ**, bật lại bằng một cú bấm ở từng hồ sơ. Chọn chiều tắt vì bật nhầm
  thì người lao động đã nhìn thấy lương rồi, không thu lại được.
- `can_check_in_remotely = false` cho 10 nhân viên, `true` cho Yến. Bắt có mặt tại
  quán chính là giá trị lõi của sản phẩm.

### employee_pay_rates / employee_overtime_rates

- `effective_from = '2026-08-01'` (V-06) cho cả 20 dòng.
- Lương: `unit='day'`.
- Tăng ca: `value_type='fixed_hourly'` — là **số tiền**, không phải hệ số. Đổi lương
  gốc không kéo tiền tăng ca đổi theo, đúng ý một thoả thuận viết bằng số tiền tuyệt
  đối (migration 0026 §B).

### overtime_rules và holidays — cố ý để trống

Mức tăng ca riêng của mỗi người **thay cho toàn bộ** hệ số theo loại ngày, và
`compute-daily.ts:296` bỏ qua hệ số doanh nghiệp còn thiếu khi người đó có mức riêng.
Nên bảng trống không chặn tiền của ai.

Hệ quả có ý thức, phải nói với chủ doanh nghiệp: người có mức riêng **không** được
nhân 300% ngày lễ theo Điều 98 BLLĐ. Đó là lựa chọn của doanh nghiệp (0026 §"MỘT MỨC,
KHÔNG PHẢI BỐN"), không phải một chỗ sót.

## Đối chiếu tiền — Nguyễn Thị Hiền, 250.000đ/ngày

Đơn giá giờ = 250.000 / 9,5 = 26.315,789…đ (không bao giờ làm tròn ở bước này, D-42a).

| Làm | Lương gốc | Tăng ca | Tổng ngày |
|---|---|---|---|
| 9,5 tiếng | 250.000 | 0 | **250.000** |
| 11 tiếng | 570 phút × đơn giá = 250.000 | 1,5 × 40.000 = 60.000 | **310.000** |
| 8 tiếng | 480 phút × đơn giá = 210.526 | 0 | **210.526** |
| 6 tiếng | 0,6316 công = 157.895 | 0 | **157.895** |

Với Đường Văn Hưng (200.000đ): đơn giá giờ = 21.052,63đ, tăng ca 30.000đ/giờ.

## Kiến trúc script

`scripts/seed-vinh-yen-food.mjs` — cùng khuôn `scripts/seed-auth.mjs`: Node 22 thuần
+ `@supabase/supabase-js`, chạy qua `node --env-file=.env.local`, dùng
`SUPABASE_SECRET_KEY`.

Bảy bước, mỗi bước tự kiểm trước khi ghi:

1. `companies` — `upsert` theo `id` cố định `cty-vinhyen`.
2. `company_settings` — `upsert` theo `company_id`.
3. `shifts` — `upsert` theo `id` cố định `sft-vinhyen-lh`.
4. `auth.users` — `createUser()` qua Admin API cho 11 email. **Không bao giờ INSERT
   thẳng vào `auth.users`**: thiếu `auth.identities` thì tài khoản không đăng nhập
   được (D-15, 02-RESEARCH Pattern 7). Email đã tồn tại thì tìm lại id, **không đặt
   lại mật khẩu**.
5. `memberships` — `upsert` theo `(user_id, company_id)`.
6. `employees` — `upsert` theo `id` cố định `nv-vinhyen-01..10` + `nv-vinhyen-ql`.
7. `employee_pay_rates` / `employee_overtime_rates` — **đọc trước khi ghi**. Hai bảng
   này append-only có trigger cưỡng chế ở database; đã có dòng `effective_from =
   2026-08-01` thì bỏ qua, tuyệt đối không `upsert`.

Cuối cùng: đăng nhập thử bằng một tài khoản vừa tạo (như `seed-auth.mjs` làm) rồi in
bảng tổng kết 11 tài khoản ra stdout.

### Vì sao id cố định chứ không `randomUUID()`

Chạy lại lần hai với id ngẫu nhiên sẽ tạo bản sao thứ hai của cả doanh nghiệp. Id
cố định làm `upsert` thành phép hội tụ chứ không phải phép nhân đôi.

## Chốt chặn `db:seed`

`scripts/db.mjs`, lệnh `seed`: trước khi gọi `psql`, đếm doanh nghiệp có `id` ngoài
`('cty-01','cty-02')`. Khác 0 thì in ra tên chúng, nói rõ `seed.sql` sẽ xoá sạch, và
thoát mã 1 — trừ khi `TF_SEED_WIPE_REAL_DATA=1`.

Cùng khuôn với `assertNotCloud()` đã có trong file: một bất biến từng được giữ bằng
trí nhớ, nay cưỡng chế bằng máy.

## Cách nghiệm thu

1. `node --env-file=.env.local scripts/seed-vinh-yen-food.mjs` — chạy hai lần liên
   tiếp, lần hai không tạo thêm dòng nào.
2. Đăng nhập `yen@vinhyenfood.com` / `12345678` → `/admin/employees` thấy đủ 11 người.
3. Mở một hồ sơ → thấy mức lương và tiền tăng ca đúng bảng trên.
4. `/admin/payroll` kỳ 8/2026 → không dòng nào báo thiếu mẫu số quy đổi.
5. `npm run db:seed` **bị từ chối** kèm thông điệp nêu tên Vinh Yến Food.
6. `npm run lint` và `npm run typecheck` xanh.

## Ngoài phạm vi

- **Điểm làm việc GPS** (`/admin/work-sites`) — cần toạ độ thật của quán. Không khai
  thì chấm công vẫn chạy, chỉ là chưa có cảnh báo "chấm ngoài vùng". Chủ dự án tự
  khai trên giao diện.
- **Ngày lễ** (`holidays`) — để trống theo D-26.
- **Phụ cấp / khấu trừ** (`pay_adjustments`) — chưa ai nêu khoản nào.
- **Phòng ban, chức vụ** — chưa ai nêu.
- **Số điện thoại và địa chỉ thật** — chủ dự án tự sửa ở `/admin/settings`.
