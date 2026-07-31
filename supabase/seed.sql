-- supabase/seed.sql
--
-- Lat mong (thin slice): chi seed nhung gi Task 1 cua Phase 1 can — auth.users
-- gia lap, hai doanh nghiep va cac membership dung lam fixture cho test co
-- lap. Cac bang khac (departments, employees, shifts, attendance_records,
-- work_requests, ...) do plan 01-04/01-05 bo sung se noi tiep vao file nay.
--
-- Chay lai duoc nhieu lan: `truncate ... restart identity cascade` xoa sach
-- companies/memberships truoc khi chen lai; auth.users dung
-- `on conflict (id) do nothing` vi khong co cot identity de restart.

truncate memberships, companies restart identity cascade;

/* -------------------------------------------------------------------------- */
/* auth.users gia lap — 4 user co dinh dung lam fixture                        */
/* -------------------------------------------------------------------------- */
-- 0001: owner Ngoc Phat | 0002: owner Binh Minh
-- 0003: thanh vien ca hai doanh nghiep (ca thanh vien kep)
-- 0004: khong thuoc doanh nghiep nao (ca khong membership)

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner1@timeflow.test'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner2@timeflow.test'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dualmember@timeflow.test'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nomember@timeflow.test')
on conflict (id) do nothing;

/* -------------------------------------------------------------------------- */
/* companies — du lieu port tu src/lib/mock/seed.ts (seedCompanies)            */
/* -------------------------------------------------------------------------- */

insert into companies (id, name, code, industry, size, phone, address, accent) values
  (
    'cty-01',
    'Công ty TNHH Thương mại Ngọc Phát',
    'NGOCPHAT',
    'retail',
    '11-30',
    '028 3822 4567',
    '142 Nguyễn Thị Minh Khai, Quận 3, TP. Hồ Chí Minh',
    'indigo'
  ),
  (
    'cty-02',
    'Xưởng Sản xuất Bình Minh',
    'BINHMINH',
    'manufacturing',
    '31-100',
    '0274 3756 118',
    'Lô C7, KCN Sóng Thần, Dĩ An, Bình Dương',
    'navy'
  );

/* -------------------------------------------------------------------------- */
/* memberships                                                                 */
/* -------------------------------------------------------------------------- */

insert into memberships (user_id, company_id, role, status) values
  ('00000000-0000-0000-0000-000000000001', 'cty-01', 'owner', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'cty-02', 'owner', 'active'),
  ('00000000-0000-0000-0000-000000000003', 'cty-01', 'admin', 'active'),
  ('00000000-0000-0000-0000-000000000003', 'cty-02', 'admin', 'active');
-- User 0004 co ton tai trong auth.users nhung khong co membership nao —
-- dung lam fixture cho ca "khong thuoc doanh nghiep nao doc duoc 0 dong".
