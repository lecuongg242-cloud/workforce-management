---
status: deferred
phase: 03-ch-m-c-ng-c-b-ng-ch-ng
source: [03-VERIFICATION.md, 03-07-PLAN.md]
started: 2026-08-03
updated: 2026-08-03
deferred_by: project-owner
deferred_reason: "Chu du an quyet dinh tu lam UAT thiet bi sau va dong phase ngay (2026-08-03). Phase da duoc danh dau complete voi no ky thuat nay ghi nhan tuong minh."
---

## Bối cảnh

Phase 3 đã đóng với **5/5 tiêu chí ROADMAP** và **8/8 requirement (ATT-01→ATT-08)** xác
minh được trong mã nguồn, cộng toàn bộ cổng tự động xanh (208/208 test, build, lint,
typecheck, check:secrets, check:assertions 199, và cô lập ảnh 8/0 qua HTTP thật).

Những gì còn lại dưới đây **chỉ thiết bị thật mới trả lời được**. Chúng là Task 2 của plan
03-07 (`checkpoint:human-verify`, `gate=blocking`) và **chưa từng được thực hiện**.

Trình duyệt máy tính không thay thế được: nó luôn cho chọn webcam, nên không chứng minh
được gì về ràng buộc "chỉ camera sau, không thư viện ảnh".

Bản chi tiết kèm bảng kỳ vọng nằm ở `docs/HUONG-DAN-TEST.md` §3.9.4 (bước 51–55).

## Chuẩn bị

```bash
npm run seed:auth
npm run reset:passwords   # CHI HIEN MOT LAN
npm run dev
```

Cần điện thoại truy cập được máy chạy dev server. Đọc dòng `Network:` trong output của
`npm run dev` để lấy địa chỉ LAN. Camera cần HTTPS hoặc `localhost` — qua LAN sẽ cần
tunnel (ví dụ `ngrok`) hoặc bật HTTPS cho dev server.

Đăng nhập bằng một tài khoản nhân viên, ví dụ `nv004@ngocphat.test`.

## Tests

### 51. Android — camera chỉ mặt sau, không vào được thư viện ảnh
expected: Bấm "Vào ca" mở thẳng camera mặt sau. Không có nút/đường nào dẫn tới thư viện ảnh hay chọn tệp.
result: [pending]

### 52. iOS — camera chỉ mặt sau, không vào được thư viện ảnh
expected: Như bước 51, trên Safari iOS.
result: [pending]

### 53. Đo thời gian bắt GPS, 3 lần, tại văn phòng/nhà xưởng thật
expected: Ghi lại ba con số. So với mốc chờ 15 giây trong `03-RESEARCH.md` (giả định A2 — **chưa từng đo thực địa**). Nếu thường xuyên vượt, cần chỉnh timeout.
result: [pending]

### 54. Từ chối quyền camera/vị trí rồi cấp lại, trên thiết bị thật
expected: Thông báo rõ ràng, phân biệt được lỗi camera với lỗi vị trí. Sau khi cấp lại quyền trong Cài đặt, quay lại app dùng được ngay — không phải cài lại, không kẹt màn hình trắng.
result: [pending]

### 55. Bật chế độ máy bay giữa lúc gửi chấm công
expected: Báo mất kết nối, cho gửi lại. Sau khi có mạng, gửi lại thành công và **không tạo bản ghi trùng**.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
