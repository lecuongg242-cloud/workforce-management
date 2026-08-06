-- 0017_request_reviews.sql
--
-- Lich su xu ly yeu cau (APRV-04, plan 05-01). Moi lan mot nguoi duyet hoac tu
-- choi mot yeu cau, mot dong duoc chen vao day — va khong bao gio sua hay xoa.
--
-- VI SAO CO BANG NAY TRONG KHI `work_requests` DA CO BA COT REVIEW (D-33):
-- Ba cot `reviewer_id` / `review_note` / `reviewed_at` cua 0004_core_entities
-- chi giu duoc DUNG LAN XU LY CUOI. APRV-04 hoi "lich su" — so nhieu: duyet
-- roi doi y, hoac tu choi roi duyet lai, thi lan truoc bien mat khong dau vet
-- neu chi co ba cot ghi de len nhau.
--
-- BA COT KIA KHONG BI BO. Chung giu nguyen vai tro ANH CHUP TRANG THAI HIEN
-- TAI: man hinh yeu cau cua nhan vien va the dashboard dang doc chung, va doc
-- mot cot re hon mot lan join. Nguon su that cua LICH SU la bang nay; nguon
-- su that cua TRANG THAI HIEN TAI van la `work_requests`. Duong ghi
-- (`reviewRequest()`) cap nhat ca hai trong cung mot thao tac.
--
-- VI SAO APPEND-ONLY (khuon D-25a, giong `overtime_rules` cua 0016):
-- Mot lich su sua duoc khong con la lich su. Neu nguoi duyet co the sua lai ly
-- do tu choi cua chinh minh sau khi bi chat van, thi cau hoi "ai duyet cai
-- nay, luc nao, vi sao" khong co cau tra loi dang tin nao — va khong ai phat
-- hien ra, vi dong da sua trong y het mot dong that. Trigger o day la thu duy
-- nhat lam quy uoc do co rang.
--
-- KHI THAT SU CAN SUA DU LIEU HONG: tam go trigger trong MOT transaction roi
-- gan lai — cung thu tuc voi 0016, ghi lai o day de nguoi sau khong phai doan:
--
--   begin;
--   alter table request_reviews disable trigger request_reviews_append_only;
--   -- ... cau lenh sua ...
--   alter table request_reviews enable trigger request_reviews_append_only;
--   commit;
--
-- HAI HE QUA DA BIET (giong 0016):
--   - `truncate` KHONG bi chan (trigger la FOR EACH ROW tren delete) — nen
--     `supabase/seed.sql` van chay duoc.
--   - XOA MOT YEU CAU hoac MOT DOANH NGHIEP keo theo `on delete cascade`
--     xuong bang nay va se bi trigger chan. Duong xoa yeu cau chua ton tai
--     trong ung dung; khi nao co, no phai tam go trigger theo thu tuc tren.

/* -------------------------------------------------------------------------- */
/* request_reviews                                                             */
/* -------------------------------------------------------------------------- */

create table request_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  request_id text not null references work_requests (id) on delete cascade,

  -- Chi hai gia tri: mot dong lich su ghi lai mot QUYET DINH, va "pending"
  -- khong phai mot quyet dinh. Dung text + check thay vi enum moi, theo tien
  -- le `attendance_photos.kind` (0005).
  decision text not null check (decision in ('approved', 'rejected')),

  -- Ly do / ghi chu. Bat buoc khi tu choi (rang buoc ben duoi), tuy chon khi
  -- duyet: nguoi bi tu choi can biet vi sao, nguoi duoc duyet thi khong.
  note text null,

  -- Nguoi bam nut, lay tu phien (auth.users). `reviewer_employee_id` la ho so
  -- nhan vien tuong ung neu co — mot so quan tri khong co ho so nhan vien nen
  -- cot nay null duoc, va no chi de HIEN TEN, khong phai de dinh danh.
  reviewer_user_id uuid null references auth.users (id) on delete set null,
  reviewer_employee_id text null references employees (id) on delete set null,

  created_at timestamptz not null default now(),

  -- LOP THU HAI cua "tu choi phai co ly do". Lop thu nhat o Server Action
  -- (`reviewRequest`) — do la lop cho thong diep tieng Viet dep. Lop nay ton
  -- tai vi mot duong ghi moi quen kiem thi database van phai tu choi.
  constraint request_reviews_rejected_needs_note
    check (decision <> 'rejected' or (note is not null and btrim(note) <> ''))
);

/* -------------------------------------------------------------------------- */
/* Index                                                                       */
/* -------------------------------------------------------------------------- */

create index request_reviews_company_id_idx on request_reviews (company_id);
-- Truy van nong duy nhat: lich su cua MOT yeu cau, moi nhat truoc.
create index request_reviews_request_id_created_at_idx
  on request_reviews (request_id, created_at desc);

/* -------------------------------------------------------------------------- */
/* Cuong che append-only                                                       */
/* -------------------------------------------------------------------------- */

create function public.tf_request_reviews_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Bảng request_reviews chỉ được thêm mới (append-only). Lịch sử xử lý yêu cầu không sửa và không xoá được — muốn đổi quyết định, hãy ghi một lần xử lý mới.'
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.tf_request_reviews_append_only() is
  'D-33 (khuon D-25a): cuong che append-only cua request_reviews o tang '
  'database. Mot lich su sua duoc khong con la lich su.';

create trigger request_reviews_append_only
  before update or delete on request_reviews
  for each row
  execute function public.tf_request_reviews_append_only();

/* -------------------------------------------------------------------------- */
/* RLS — 4 policy PERMISSIVE, dieu kien duy nhat public.tf_is_member           */
/* -------------------------------------------------------------------------- */
-- Nhan rong nguyen ban mau cua 0002/0004/0005/0015. KHONG co policy rieng cho
-- vai tro: gioi han "chi owner/admin duyet" nam o tang Server Action
-- (`requireRole`). RLS o day la lop phong thu thu hai theo RANH GIOI DOANH
-- NGHIEP, khong phai lop phan quyen theo vai tro.
--
-- `update`/`delete` van co policy du trigger da chan tat: hai co che tra loi
-- hai cau hoi khac nhau (co duoc NHIN THAY dong do khong / co duoc SUA no
-- khong), va cong `00_rls_coverage.sql` doi du bon policy tren moi bang.

alter table request_reviews enable row level security;

create policy request_reviews_select_member on request_reviews
  for select
  using (public.tf_is_member(company_id));

create policy request_reviews_insert_member on request_reviews
  for insert
  with check (public.tf_is_member(company_id));

create policy request_reviews_update_member on request_reviews
  for update
  using (public.tf_is_member(company_id))
  with check (public.tf_is_member(company_id));

create policy request_reviews_delete_member on request_reviews
  for delete
  using (public.tf_is_member(company_id));

comment on table request_reviews is
  'Lich su xu ly yeu cau, append-only (APRV-04 / D-33). Ba cot review tren '
  'work_requests KHONG bi thay the — chung la anh chup trang thai hien tai, '
  'con bang nay la nguon su that cua lich su.';
