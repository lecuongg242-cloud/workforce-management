-- 0020_notifications.sql
--
-- Thong bao trong ung dung (APRV-05, plan 05-04). Mot dong duoc sinh trong
-- CUNG THAO TAC xu ly mot yeu cau, cho chinh nguoi da gui yeu cau do.
--
-- VI SAO RLS O DAY CHAT HON MOI BANG KHAC CUA DU AN (D-34)
--
-- Moi bang khac dieu kien duy nhat `tf_is_member(company_id)`: ranh gioi la
-- DOANH NGHIEP. Bang nay khong the dung ranh gioi do, vi noi dung mot dong o
-- day mang LY DO TU CHOI — mot cau nhan xet rieng ve mot nguoi ("khong du nhan
-- su", "da nghi qua nhieu trong thang"). Cho ca doanh nghiep doc duoc nghia la
-- bien mot co che thong bao thanh mot bang tin noi bo ve doi tu cua nhau.
--
-- Nen dieu kien o day la `user_id = auth.uid()` VA `tf_is_member(company_id)`.
-- Ve thu hai khong thua: no giu ranh gioi doanh nghiep nguyen ven ngay ca khi
-- mot tai khoan roi khoi doanh nghiep (membership het `active`) — luc do ho
-- khong doc lai duoc thong bao cu nua.
--
-- VI SAO KHONG CO POLICY `delete`
--
-- Thong bao khong xoa duoc tu ung dung o phase nay. Danh dau da doc la du, va
-- mot danh sach xoa duoc se can mot cau chuyen ve "ai duoc xoa cua ai" — thu
-- chua duoc thiet ke. Khong co policy nghia la khong ai xoa duoc qua duong
-- ung dung, ke ca chinh chu.

/* -------------------------------------------------------------------------- */
/* notifications                                                               */
/* -------------------------------------------------------------------------- */

create table notifications (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,

  -- NGUOI NHAN. `auth.users` chu khong phai `employees`: mot thong bao chi co
  -- nghia khi co ai do dang nhap duoc de doc no. Nhan vien chua co tai khoan
  -- thi duong ghi KHONG sinh dong nao (mot dong mo coi se khong bao gio duoc
  -- doc).
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Loai thong bao. Text + check theo tien le `attendance_photos.kind` (0005);
  -- Phase 5 chi sinh mot loai, cac loai sau them vao danh sach nay.
  kind text not null check (kind in ('request_reviewed')),

  title text not null,
  body text not null,

  -- Yeu cau lien quan, de giao dien mo thang toi no. `null` duoc: cac loai
  -- thong bao ve sau co the khong gan voi yeu cau nao.
  request_id text null references work_requests (id) on delete cascade,

  -- `null` = CHUA DOC. Mot cot boolean `is_read` se mat thong tin "doc luc
  -- nao", va dau thoi gian do la thu duy nhat tra loi duoc "ho co kip biet
  -- truoc khi bang luong chot khong".
  read_at timestamptz null,

  created_at timestamptz not null default now()
);

/* -------------------------------------------------------------------------- */
/* Index                                                                       */
/* -------------------------------------------------------------------------- */

-- Truy van nong nhat cua ca bang: dem so chua doc cua MOT nguoi (chuong tren
-- giao dien nhan vien goi no o moi lan mo ung dung).
create index notifications_user_id_read_at_idx on notifications (user_id, read_at);
-- Danh sach thong bao: cua mot nguoi, moi nhat truoc.
create index notifications_user_id_created_at_idx
  on notifications (user_id, created_at desc);
create index notifications_company_id_idx on notifications (company_id);

/* -------------------------------------------------------------------------- */
/* RLS — BA policy (khong co `delete`), dieu kien theo NGUOI NHAN              */
/* -------------------------------------------------------------------------- */

alter table notifications enable row level security;

-- `(select auth.uid())` boc trong subquery: cung khuon `tf_is_member` dung o
-- 0002, de Postgres tinh mot lan cho ca truy van thay vi moi dong.
create policy notifications_select_own on notifications
  for select
  using (user_id = (select auth.uid()) and public.tf_is_member(company_id));

-- Duong ghi di qua Server Action da kiem quyen (`reviewRequest` chi cho
-- owner/admin), va nguoi duyet KHAC nguoi nhan — nen dieu kien chen chi co the
-- la thanh vien doanh nghiep. Neu siet ve `user_id = auth.uid()` thi khong ai
-- gui duoc thong bao cho ai ca.
create policy notifications_insert_member on notifications
  for insert
  with check (public.tf_is_member(company_id));

-- Chi de danh dau da doc, va chi tren dong cua chinh minh.
create policy notifications_update_own on notifications
  for update
  using (user_id = (select auth.uid()) and public.tf_is_member(company_id))
  with check (user_id = (select auth.uid()) and public.tf_is_member(company_id));

comment on table notifications is
  'Thong bao trong ung dung (APRV-05 / D-34). RLS theo NGUOI NHAN chu khong '
  'theo doanh nghiep: noi dung mang ly do tu choi, la nhan xet rieng ve mot '
  'nguoi. Khong co policy delete — xem khoi comment dau file 0020.';
