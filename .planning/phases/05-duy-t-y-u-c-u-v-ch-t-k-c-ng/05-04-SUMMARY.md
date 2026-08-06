---
phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng
plan: 04
subsystem: notifications
tags: [postgres, rls, pgtap, nextjs, route-handler, server-action, zod, vitest, react, ui, employee-app]

requires:
  - phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng (05-01, 05-02)
    provides: "reviewRequest() (05-01) va diem noi sau khi ap dung tac dong (05-02)"
provides:
  - "notifications (migration 0020) — RLS theo NGUOI NHAN, ba policy (khong co delete)"
  - "GET /api/notifications (danh sach + so chua doc), listNotifications()"
  - "markNotificationsRead(ids) — chi dong cua chinh minh"
  - "reviewRequest() sinh thong bao trong CUNG thao tac"
  - "NotificationBell (thanh tren cung nhan vien) + /employee/notifications"
affects: ["05-06"]

actuals:
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "RLS dieu kien `user_id = (select auth.uid()) and tf_is_member(company_id)` — bang DUY NHAT cua du an khong dung ranh gioi doanh nghiep lam dieu kien duy nhat"
    - "So chua doc di KEM danh sach trong cung mot phan hoi: chuong va danh sach phai noi cung mot con so, hai duong doc rieng se lech ngay khi co thong bao moi den giua chung"
    - "`read_at timestamptz null` thay vi `is_read boolean`: mot boolean mat thong tin 'doc luc nao', va dau thoi gian do la thu duy nhat tra loi duoc 'ho co kip biet truoc khi ky bi chot khong'"
    - "`markNotificationsRead` KHONG ghi audit_log — ngoai le co can nhac voi D-17: 'toi da doc thong bao cua chinh toi' khong doi cong, khong doi tien, va ghi no se lam nhat ky ngap trong tieng on"

key-files:
  created:
    - supabase/migrations/0020_notifications.sql
    - supabase/tests/14_notifications.sql
    - src/lib/validation/api/notifications.ts
    - src/lib/data/notifications.ts
    - src/lib/data/mutations/notifications.ts
    - src/app/api/notifications/route.ts
    - src/components/employee-app/notification-bell.tsx
    - src/app/employee/notifications/page.tsx
    - src/app/employee/notifications/notifications-view.tsx
    - src/lib/data/__tests__/notifications.test.ts
  modified:
    - supabase/tests/run-all.sql
    - scripts/check-pgtap-assertions.mjs
    - src/lib/types/domain.ts
    - src/lib/data/mutations/requests.ts
    - src/components/layout/mobile-header.tsx
    - src/lib/constants.ts

key-decisions:
  - "KHONG them muc thu nam vao `EMPLOYEE_NAV_ITEMS`. Thanh dieu huong duoi cua giao dien mobile dang co bon muc va la khong gian dat nhat cua man hinh; chuong o header la cho dung cho mot thu duoc xem luot va co so dem. `nav.ts` khong doi mot dong nao o plan nay."
  - "Chuong CU la mot chuong GIA: cham do co dinh + nhan 'có 2 thông báo mới' viet cung trong ma (`mobile-header.tsx` truoc 05-04). Thay bang so that; `0` chua doc thi KHONG hien cham nao."
  - "Mo man hinh la DA DOC (khong co nut 'đánh dấu đã đọc'): nguoi dung da nhin thay noi dung roi, bat ho bam them mot nut chi de lam so ve 0 la bat ho lam viec cho he thong."
  - "`read_at` lay tu `tf_server_now()` (dong ho database, D-19) chu khong tu `new Date()` — cung duong ma checkIn/checkOut dung."
  - "`insert` policy chi dieu kien `tf_is_member(company_id)` chu khong `user_id = auth.uid()`: nguoi duyet KHAC nguoi nhan, siet ve chinh chu thi khong ai gui duoc thong bao cho ai."

requirements-completed: [APRV-05]
---

# 05-04: Thong bao trong ung dung khi yeu cau duoc xu ly

## Da lam

**Task 1 — bang thong bao (migration 0020).** `notifications`: `id`, `company_id`, `user_id`
(FK `auth.users`, cascade), `kind` (text + check, hien chi `request_reviewed`), `title`,
`body`, `request_id` (FK `work_requests`, null duoc), `read_at` (null = chua doc),
`created_at`. Ba index, trong do `(user_id, read_at)` phuc vu dung truy van dem chua doc.

**BA policy, khong phai bon:** `select`/`update` dieu kien
`user_id = (select auth.uid()) and tf_is_member(company_id)`; `insert` dieu kien
`tf_is_member(company_id)`; **khong co** policy `delete` — thong bao khong xoa duoc tu ung
dung o phase nay, ke ca chinh chu. Khoi comment dau file giai thich vi sao RLS o day chat hon
moi bang khac: noi dung mang ly do tu choi, la mot cau nhan xet rieng ve mot nguoi.

Test pgTAP `14_notifications.sql` — 6 khang dinh, trong do **hai khang dinh dau la thu khong
bang nao khac cua du an co**: hai fixture user CUNG thuoc `cty-01` (0001 va 0003) khong doc
duoc thong bao cua nhau. San assertion 233 -> 239.

**Task 2 — sinh trong cung thao tac.** `AppNotification`/`NotificationFeed` vao `domain.ts`;
cap schema hai dau; `GET /api/notifications` (khong tham so nao khai nguoi nhan — pham vi tu
phien); `listNotifications()`; Server Action `markNotificationsRead(ids)`.

`reviewRequest()` them buoc **(4d)**: doc `employees.user_id` cua chu yeu cau roi chen mot dong
`notifications`. Comment tai cho ghi ro day **khong** phai buoc "best effort" — loi lam ca thao
tac that bai. Ngoai le duy nhat: nhan vien chua co tai khoan thi khong sinh dong nao va thao
tac van thanh cong.

Test tich hop `notifications.test.ts` — 7 test tren database dev that, doanh nghiep rieng voi
**ba tai khoan deu la thanh vien** (de dieu kien `tf_is_member` khong the la thu dang chan ho):

| # | Bai kiem | Ket qua |
|---|---|---|
| 1 | Duyet -> dung MOT thong bao; noi dung mang loai yeu cau + khoang ngay + quyet dinh; `read_at` null | xanh |
| 2 | Tu choi -> thong bao mang LY DO tu choi | xanh |
| 3 | **Nhan vien chua co tai khoan -> 0 dong, thao tac van thanh cong** | xanh |
| 4 | `GET /api/notifications` tra dung cua chinh phien; **nguoi thu ba cung doanh nghiep thay 0 dong** | xanh |
| 5 | Danh dau da doc -> so chua doc ve 0; goi lai -> 0 dong doi, khong nem loi | xanh |
| 6 | **Danh dau da doc cua nguoi khac -> 0 dong, dong do khong doi**; chinh chu thi duoc | xanh |
| 7 | Danh sach rong -> 0, khong cham database | xanh |

**Task 3 — chuong va danh sach.** `NotificationBell` thay cho chuong gia trong
`mobile-header.tsx`; `/employee/notifications` hien danh sach moi nhat truoc, dong chua doc
phan biet bang **dau cham + nhan chu** ("Chưa đọc"), mo man hinh la danh dau da doc (mot lan,
`useRef` chan vong thu hai) roi `invalidate()` de chuong doc lai so. Dong co `request_id` bam
duoc de mo `/employee/requests`. `NOTIFICATION_LABEL` vao `constants.ts`.

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0; `/employee/notifications` va `/api/notifications` co trong output |
| `npx vitest run` | 38 file, **396 test xanh** (truoc plan: 387) |
| `npm run check:assertions` | 239 assertion, sang moc 239 |
| `npm run db:push` | 0020 da ap len database dev |
| `npx vitest run src/__tests__/route-handlers-get-only.test.ts` | xanh — route moi cung chi `GET` |
| `grep -c "NotificationBell" src/components/layout/mobile-header.tsx` | 2 |
| `grep -c "notifications" src/lib/data/mutations/requests.ts` | 2 |
| `grep -rn "new Date()\|Date.now()"` (bell + trang thong bao) | **khong dong nao** (D-19a) |

**Bon quan sat cua acceptance criteria Task 3** duoc chung minh o tang du lieu thay vi bang mat
(duong ghi la Server Action, khong goi duoc tu script ngoai):
- test 1 — duyet mot yeu cau sinh dung **mot** thong bao chua doc cho dung nguoi;
- test 4 — `unreadCount` la **1** roi **2** cho chinh nhan vien do, va **0** cho nguoi khac
  cung doanh nghiep (chuong doc dung con so nay);
- test 1/2 — noi dung thong bao mang du loai yeu cau, khoang ngay, quyet dinh va ly do;
- test 5 — sau khi danh dau da doc, `unreadCount` ve **0** (chuong het cham).

Quan sat tay tren trinh duyet chua lam; e2e vong doi day du thuoc pham vi 05-06.

## Khong lam duoc trong moi truong nay

- `npm run test:db` van **khong chay duoc** (khong co `psql`). `14_notifications.sql` da viet va
  da vao cong `check:assertions` nhung **chua chay that lan nao**. Khang dinh quan trong nhat
  cua no (hai nguoi cung doanh nghiep khong doc duoc cua nhau) **da** duoc chung minh doc lap
  bang test tich hop Vitest (test 4 va test 6).

## Du lieu con sot tren database dev

`notifications.test.ts` don sach `notifications`, `attendance_records`, `audit_log` va ba tai
khoan `auth.users` cua no. Doanh nghiep test `cty-0504-<ngau nhien>` cung phong ban/ca/nhan
vien/yeu cau o lai (yeu cau da xu ly khong xoa duoc vi `request_reviews` la append-only) —
cung tinh chat voi 05-02 va 05-03.
