# Quản trị chỉnh chấm công

**Ngày:** 2026-09-06
**Trạng thái:** Đã thiết kế, đã thực thi

## Vấn đề

Nhân viên quên bấm, bấm sai giờ, bấm nhầm hai lần liền nhau. Hiện tầng ghi của
chấm công chỉ có `checkIn` và `checkOut` — không có đường nào để quản trị sửa
lại. Màn "Cần xem lại" chỉ để đọc.

Đường sửa duy nhất đang có là gián tiếp: nhân viên gửi yêu cầu bổ sung công →
quản trị duyệt → hàm SQL `tf_apply_approved_request` ghi vào bảng công. Đường đó
vẫn giữ, nhưng nó bắt nhân viên phải chủ động gửi đơn cho một việc mà quản trị
nhìn thấy ngay trên bảng.

## Quyết định

| Điểm | Lựa chọn |
|------|----------|
| Phạm vi | Sửa giờ vào/ra, thêm bản ghi cho ngày quên chấm, xoá lượt thừa |
| Lý do bắt buộc | Không bắt nhập |
| Dấu vết trên màn hình | Có — nhãn "Đã chỉnh", di chuột thấy ai sửa và lúc nào |

## Ba ràng buộc của CSDL định hình toàn bộ

Không phải chi tiết phụ — chúng quyết định hình dạng của tính năng.

### 1. Kỳ đã chốt bị trigger chặn

`attendance_period_guard` (migration 0021) từ chối **mọi** thao tác ghi vào
`attendance_records` của một ngày thuộc kỳ đã chốt, trừ khi đang ở trong
`tf_apply_approved_request`. Chú thích của chính migration đó nói thẳng là nó
chặn cả "sửa bản ghi từ màn hình quản trị".

Nên đường sửa trực tiếp **cố ý dừng ở ranh giới kỳ chốt**, và không cần thêm
phép kiểm nào ở tầng ứng dụng. Chỉ cần bắt SQLSTATE `TF001` qua
`periodGuardError()` đã có sẵn, để người dùng đọc được câu chỉ đường tiếp:
*"…Hãy gửi yêu cầu bổ sung công để quản trị xem xét."*

### 2. `check (work_date = tf_work_date(check_in_at))`

Ngày công phải luôn khớp với ngày mà giờ vào rơi vào (theo giờ Việt Nam, có
tính ca qua đêm). Sửa giờ vào mà giữ nguyên `work_date` sẽ bị CSDL từ chối.

Nên mỗi lần ghi giờ vào, `work_date` được **tính lại bằng chính RPC
`tf_work_date`** và ghi kèm trong cùng một lệnh — không tự suy ra ở tầng ứng
dụng, vì đó sẽ là quy ước múi giờ thứ hai (D-19 cảnh báo đúng điều này).

### 3. Chỉ một lượt đang mở mỗi (nhân viên, ngày, ca)

Index `attendance_records_open_punch_uidx` (migration 0013). Thêm một bản ghi
không có giờ ra cho ngày đã có lượt treo sẽ bị từ chối ở tầng CSDL. Lỗi đó được
dịch sang tiếng Việt, không để chuỗi lỗi Postgres thô lọt lên giao diện.

## Một nguồn sự thật cho bốn cột dẫn xuất

Phần quan trọng nhất của lát cắt này.

`worked_minutes`, `late_minutes`, `early_leave_minutes`, `status` hiện được tính
**nằm rải bên trong** `checkIn` và `checkOut`, mỗi hàm một mảnh. Viết thêm một
phép tính thứ ba cho đường sửa nghĩa là ba bản sao của cùng một quy tắc, và
chúng sẽ trôi khỏi nhau — hệ quả là bảng lương ra số sai một cách âm thầm, đúng
loại lỗi khó phát hiện nhất.

Nên phần tính đó được rút thành **một hàm dùng chung**:

```
computeDerivedAttendance({ supabase, shift, workDate, checkInAt, checkOutAt })
  → { workedMinutes, lateMinutes, earlyLeaveMinutes, status }
```

Cả `checkIn`, `checkOut` và ba hàm sửa mới đều gọi nó. Đây là sửa vào code đang
chạy được — rủi ro có thật — nhưng để hai đường tính song song là rủi ro lớn hơn
và âm ỉ hơn.

Hàm giữ nguyên mọi quy ước đã có: ca linh hoạt không có "đi muộn"/"về sớm"
(không có giờ mốc để so), `p_break_minutes: 0` vì giờ nghỉ thuộc về cả ngày chứ
không thuộc một lượt, và mọi phép tính thời gian đi qua RPC của Postgres chứ
không tính ở JavaScript.

## Migration 0037

```sql
alter table attendance_records
  add column if not exists edited_at timestamptz null,
  add column if not exists edited_by text null;
```

Hai cột này là **dấu hiệu hiển thị**, không phải sổ cái. Sổ cái vẫn là
`audit_log` với ảnh chụp nguyên dòng trước/sau. Chúng tồn tại để bảng chấm công
trả lời được ngay câu "số này máy ghi hay người đặt" mà không phải tra nhật ký.

## Ba Server Action

| Hàm | Việc |
|---|---|
| `updateAttendanceRecord(recordId, { checkIn, checkOut })` | sửa giờ vào/ra |
| `createAttendanceRecord({ employeeId, date, shiftId, checkIn, checkOut })` | thêm bản ghi |
| `deleteAttendanceRecord(recordId)` | xoá lượt thừa |

Cả ba đi đúng khuôn của dự án: `getSessionContext()` → `requireRole(["owner",
"admin"])` → đọc/ghi với `.eq("company_id")` từ session (RLS là lớp thứ hai) →
`logMutation` nguyên dòng trước/sau ngay trong cùng hàm.

**Sửa giờ không đổi được ngày công.** Muốn chuyển một bản ghi sang ngày khác thì
xoá rồi thêm lại. Ranh giới này giữ cho ràng buộc `work_date` khỏi biến thành
một mớ trường hợp đặc biệt, và nó cũng phản ánh đúng nghiệp vụ: đổi ngày của một
lượt chấm công là một sự thật khác, không phải một chỗ gõ nhầm.

Giờ nhập vào là **giờ địa phương trên ngày công của bản ghi**, đổi sang
`timestamptz` qua RPC `tf_local_instant` — cùng cơ chế mà `checkIn`/`checkOut`
đang dùng. Giờ ra sớm hơn giờ vào được hiểu là **qua đêm** và cộng thêm một
ngày; đó là trường hợp thật của ca `Xưởng Nem (06:30–18:00)` lẫn các ca đêm.

## Giao diện

Bảng "Danh sách bản ghi": thêm cột hành động ở cuối, menu ba chấm mỗi dòng
(**Sửa giờ** / **Xoá lượt này**), và nút **Thêm bản ghi** ở đầu bảng.

Menu phải chặn sự kiện lan lên dòng (`stopPropagation`) — bấm vào dòng hiện đang
mở hộp thoại bằng chứng chấm công, và bấm "Xoá" mà lại mở ảnh lên là hỏng.

Nhãn **"Đã chỉnh"** hiện cạnh trạng thái, `title` mang tên người sửa và thời
điểm.

## Kiểm thử

- kỳ đã chốt → cả ba hàm bị chặn, thông điệp chỉ đúng đường đi tiếp
- manager/employee gọi → bị từ chối, **và** không chạm dữ liệu
- bản ghi của doanh nghiệp khác → không tìm thấy, không ghi gì
- sửa giờ vào → **cả bốn** cột dẫn xuất được tính lại, không cột nào ôm số cũ
- sửa giờ vào → `work_date` được tính lại qua `tf_work_date`, không giữ giá trị cũ
- giờ ra sớm hơn giờ vào → hiểu là qua đêm, không ra thời lượng âm
- mọi thao tác ghi đều đặt `edited_at`/`edited_by` và để lại một dòng audit

## Kết quả thực thi (2026-09-06)

Các file đã đổi:

| File | Việc |
|------|------|
| `supabase/migrations/0037_attendance_admin_edit.sql` | mới — `edited_at`/`edited_by` + index một phần |
| `src/lib/data/mutations/attendance.ts` | rút `computeDerivedAttendance()`, thêm 3 Server Action |
| `src/lib/validation/api/attendance.ts` | hai cột mới chảy qua hợp đồng JSON |
| `src/app/api/attendance/route.ts` | trả `editedByName` (một truy vấn phụ, chỉ khi có bản ghi bị chỉnh) |
| `src/lib/types/domain.ts` | `editedAt`/`editedBy`/`editedByName` |
| `src/lib/validation/schemas.ts` | `attendanceTimesSchema`, `createAttendanceSchema` |
| `src/lib/format.ts` | `formatInstant()` |
| `src/lib/constants.ts` | `ATTENDANCE_EDIT_LABELS` |
| `src/components/attendance/attendance-edit-dialog.tsx` | mới |
| `src/components/attendance/attendance-create-dialog.tsx` | mới |
| `src/components/attendance/attendance-record-table.tsx` | cột hành động + nhãn "Đã chỉnh" |
| `src/app/admin/attendance/attendance-view.tsx` | nút thêm, ba hộp thoại |
| `src/lib/data/__tests__/attendance-admin-edit.test.ts` | mới — 11 bài tích hợp trên Postgres thật |

Migration đã áp lên database dev (`npm run db:push`).

### Vì sao kiểm thử ở mức tích hợp, không phải unit test mock

Toàn bộ giá trị của lát cắt này nằm ở chỗ database có chấp nhận kết quả hay
không: trigger kỳ chốt, `CHECK (work_date = tf_work_date(...))`, partial unique
index lượt đang mở, và bốn cột dẫn xuất tính qua RPC. Một bộ mock chỉ khẳng
định được code gọi đúng hàm — nó không khẳng định được ràng buộc nào trong số
đó. Nên 11 bài đều chạy trên Postgres thật với fixture doanh nghiệp riêng.

Đã kiểm chứng:

- 11 bài mới — qua hết, chạy trên Postgres thật (~68 giây)
- `npm test` — 822/823 qua (bài đỏ duy nhất là vấn đề có sẵn, xem dưới)
- `npm run typecheck` — sạch
- `npm run lint` — 0 lỗi (còn 1 cảnh báo có sẵn ở `scripts/tmp/`)
- `npm run build` — dựng thành công, 28/28 trang
- `npm run check:secrets` — quét 294 file, không có khóa bí mật nào lọt xuống client

Riêng bộ test chấm công cũ (177 bài, gồm cả bài chạy DB thật) được chạy lại
ngay sau bước rút `computeDerivedAttendance()` và qua hết — đó là bằng chứng
việc gom phép tính không làm lệch hành vi của `checkIn`/`checkOut`.

### Một bài đỏ KHÔNG do lát cắt này

`platform-overview.test.ts` đổ ở khẳng định `toContain("cty-02")`. Nguyên nhân:
bảng `companies` của database dev đã có **1009 dòng**, vượt ngưỡng 1000 dòng
mặc định của PostgREST, nên `cty-02` rơi ra ngoài trang đầu. `cty-02` vẫn tồn
tại nguyên vẹn.

1000 dòng đó là doanh nghiệp fixture còn sót của khoảng 100 lần chạy test
trước (`cty-0405-*` 106 dòng, `cty-pay-*` 100, `cty-0502-*` 99…). Chúng không
xoá được vì `overtime_rules` là append-only nên cascade bị trigger chặn — chính
`attendance-classification.test.ts` đã ghi chú điều này.

Fixture của lát cắt này dọn sạch sau khi chạy (kiểm tra: 0 dòng `cty-edit-*`
còn sót). Việc cần làm riêng: dọn rác fixture cũ trong database dev, hoặc cho
fixture một cách xoá được doanh nghiệp của chính nó.

### Chưa làm

Chưa bấm tay trên giao diện thật. Cần kiểm: menu ba chấm không làm bật hộp
thoại ảnh, nhãn "Đã chỉnh" hiện đúng tên người sửa, và sửa một bản ghi của kỳ
đã chốt hiện đúng câu chỉ đường sang yêu cầu bổ sung công.

