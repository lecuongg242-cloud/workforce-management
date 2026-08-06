-- 0019_overtime_cap.sql
--
-- Tran tang ca cua doanh nghiep (SET-05, plan 05-03). Mot cot them vao
-- `company_settings`, khong phai mot bang moi.
--
-- VI SAO COT NAY KHONG CO MAC DINH TRONG KHI BON COT CUNG BANG THI CO
--
-- 0015 da giai thich ranh gioi: bon cot kia la NGUONG VAN HANH cua chinh he
-- thong phat hien (`suspicious_distance_multiplier`, `shift_window_grace_minutes`)
-- va mot DINH NGHIA PHAP LY (`night_start_time`/`night_end_time`, D-27) — chung
-- co diem khoi dau dung duoc.
--
-- Tran tang ca thi khac han: no la mot CON SO NGHIEP VU DOANH NGHIEP TU QUYET,
-- dung nhom ma D-26 cam ap cung. Mot tran mac dinh se lam moi doanh nghiep chua
-- dong toi cau hinh bong nhien co mot gioi han ma ho khong dat ra.
--
-- `NULL` NGHIA LA KHONG GIOI HAN, KHONG PHAI BANG 0
--
-- Rang buoc CHECK cam gia tri <= 0 chinh la de khoang cach giua hai y nghia do
-- khong the bi lam nhoe: "chua dat gioi han" chi co MOT cach viet (`null`), va
-- 0 khong phai mot tran hop le. Neu `null` bi hieu la 0 thi moi lan duyet tang
-- ca deu sinh canh bao — va nguoi duyet se ngung doc canh bao, ke ca canh bao
-- that (T-05-03-01).
--
-- DON VI: GIO / NHAN VIEN / THANG. "Tran tang ca" co the hieu la moi tuan, moi
-- thang hay moi nam; don vi duoc noi ro o ten cot, o nhan giao dien, va o day.

alter table company_settings
  add column if not exists overtime_cap_hours_per_month numeric(6, 2) null
    check (overtime_cap_hours_per_month is null or overtime_cap_hours_per_month > 0);

comment on column company_settings.overtime_cap_hours_per_month is
  'SET-05: tran tang ca doanh nghiep tu dat, don vi GIO / NHAN VIEN / THANG. '
  'NULL = khong gioi han (khong phai 0). Vuot tran chi sinh CANH BAO cho nguoi '
  'duyet, khong bao gio tu choi mot lan duyet — xem prohibitions cua plan 05-03.';
