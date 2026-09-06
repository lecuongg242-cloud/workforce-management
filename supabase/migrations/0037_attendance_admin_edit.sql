-- 0037_attendance_admin_edit.sql
--
-- Dau hieu "ban ghi nay da bi nguoi chinh" cho `attendance_records`
-- (spec 2026-09-06 — quan tri chinh cham cong).
--
-- (1) VI SAO CAN HAI COT NAY KHI DA CO audit_log
--
-- `audit_log` van la SO CAI: no giu anh chup nguyen dong truoc/sau, ai lam,
-- luc nao. Hai cot o day KHONG thay the no va khong duoc coi la nguon su that.
--
-- Chung ton tai vi mot ly do khac han: bang cham cong phai tra loi duoc NGAY
-- tren man hinh cau hoi "so nay may ghi hay nguoi dat". Loi hua cot loi cua
-- san pham la moi ban ghi vao/ra la co that; tu luc quan tri sua duoc gio,
-- loi hua do chi con giu duoc neu cho nao bi sua deu noi ra rang no bi sua.
-- Tra `audit_log` cho tung dong khi doc mot bang 28 dong khong phai la mot
-- cau tra loi dung duoc.
--
-- (2) VI SAO `edited_by` LA text VA KHONG CO KHOA NGOAI
--
-- Cung khuon voi `audit_log.actor_user_id`: dinh danh nguoi dung Supabase
-- nam o `auth.users`, khong thuoc quyen cua schema ung dung. Mot khoa ngoai
-- sang do se lam viec xoa tai khoan keo theo hoac chan mat mot dau vet audit
-- — dung dieu khong duoc phep xay ra voi dau vet.
--
-- Ten hien ra man hinh duoc tra o tang doc (Route Handler doi chieu
-- `employees.user_id`), khong luu ban sao ten o day.
--
-- (3) TRIGGER KY DA CHOT VAN AP LEN CA HAI COT NAY
--
-- Khong can lam gi them: `attendance_period_guard` (0021) chan theo THAO TAC
-- GHI tren bang, khong theo cot. Moi lenh update dat `edited_at` deu di qua
-- no. Duong sua truc tiep vi vay tu dong dung o ranh gioi ky chot.

alter table attendance_records
  add column if not exists edited_at timestamptz null,
  add column if not exists edited_by text null;

comment on column attendance_records.edited_at is
  'Spec 2026-09-06: thoi diem mot quan tri chinh tay ban ghi nay. NULL = chua '
  'ai chinh (so do may ghi). Day la DAU HIEU HIEN THI, so cai van la audit_log.';

comment on column attendance_records.edited_by is
  'Spec 2026-09-06: user_id cua quan tri da chinh. Khong co khoa ngoai sang '
  'auth.users — cung ly do voi audit_log.actor_user_id.';

-- Loc nhanh "nhung ban ghi da bi chinh" khi soat lai ky truoc khi chot. Index
-- MOT PHAN: da so ban ghi khong bao gio bi chinh, nen index day du chi ton
-- cho ma khong phuc vu truy van nao.
create index if not exists attendance_records_edited_idx
  on attendance_records (company_id, edited_at)
  where edited_at is not null;
