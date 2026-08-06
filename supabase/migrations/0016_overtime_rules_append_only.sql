-- 0016_overtime_rules_append_only.sql
--
-- Hai thu cho he so tang ca (SET-03, plan 04-04):
--   (1) TRIGGER cuong che append-only tren `overtime_rules`;
--   (2) HAM tra he so DANG HIEU LUC cho mot ngay bat ky.
--
-- VI SAO CO TRIGGER (D-25a):
-- Tieu chi 4 cua Phase 4 — "sua quy tac hom nay khong doi phan loai cua ban
-- ghi hom qua" — song hoan toan nho mot quy uoc: sua mot he so nghia la CHEN
-- MOT DONG MOI voi `effective_from`, khong bao gio UPDATE hay DELETE dong cu.
-- Mot quy uoc chi song trong ma ung dung la mot quy uoc se bi pha luc voi —
-- va khi no bi pha, khong ai phat hien ra, vi so lieu cua ky da qua chi lang
-- le doi. Trigger o day la thu duy nhat lam quy uoc do co rang.
--
-- KHI THAT SU CAN SUA DU LIEU HONG (vi du mot dong khai nham vao dung ngay
-- hom nay, chua ai doc): tam go trigger trong MOT transaction roi gan lai —
--
--   begin;
--   alter table overtime_rules disable trigger overtime_rules_append_only;
--   -- ... cau lenh sua ...
--   alter table overtime_rules enable trigger overtime_rules_append_only;
--   commit;
--
-- Ghi lai o day de nguoi sau khong phai doan, va de viec do luon la mot hanh
-- dong CO Y THUC chu khong phai mot lan `update` tien tay.
--
-- HAI HE QUA DA BIET:
--   - `truncate` KHONG bi chan (trigger nay la FOR EACH ROW tren delete, con
--     truncate la mot lenh khac han) — nen `supabase/seed.sql` van chay duoc.
--   - XOA MOT DOANH NGHIEP se keo theo `on delete cascade` xuong bang nay va
--     bi trigger chan. Duong xoa doanh nghiep chua ton tai trong ung dung; khi
--     nao co, no phai tam go trigger theo dung thu tuc o tren.

/* -------------------------------------------------------------------------- */
/* (1) Cuong che append-only                                                   */
/* -------------------------------------------------------------------------- */

create function public.tf_overtime_rules_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Bảng overtime_rules chỉ được thêm mới (append-only). Muốn đổi hệ số, hãy khai một phiên bản mới với effective_from là ngày bắt đầu hiệu lực — sửa đè dòng cũ sẽ làm số liệu của các kỳ đã qua không tái lập được.'
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.tf_overtime_rules_append_only() is
  'D-25a: cuong che quy uoc append-only cua overtime_rules o tang database. '
  'Thong diep noi CACH LAM DUNG (khai phien ban moi) chu khong chi noi "cam".';

create trigger overtime_rules_append_only
  before update or delete on overtime_rules
  for each row
  execute function public.tf_overtime_rules_append_only();

/* -------------------------------------------------------------------------- */
/* (2) He so DANG HIEU LUC cho mot ngay                                        */
/* -------------------------------------------------------------------------- */
-- `security invoker` (mac dinh) CO Y: day khong phai ham kiem quyen, no phai
-- di qua RLS nhu moi truy van khac — nguoi goi chi thay dong cua doanh nghiep
-- minh la thanh vien.
--
-- Tra NULL khi ngay can tra nam TRUOC moi `effective_from` cua khoa do, hoac
-- khi khoa do chua duoc khai lan nao. KHONG lui ve dong gan nhat: bia ra mot
-- he so cho khoang thoi gian doanh nghiep chua khai gi la dung loai sai lang
-- le ma D-26 ton tai de chan.

create function public.tf_overtime_multiplier(
  p_company_id text,
  p_rule_key text,
  p_date date
)
returns numeric
language sql
stable
as $$
  select r.multiplier
  from overtime_rules r
  where r.company_id = p_company_id
    and r.rule_key = p_rule_key
    and r.effective_from <= p_date
  order by r.effective_from desc
  limit 1;
$$;

comment on function public.tf_overtime_multiplier(text, text, date) is
  'He so tang ca DANG HIEU LUC tai p_date: dong co effective_from lon nhat ma '
  'van <= p_date. Tra NULL khi ngay do nam truoc moi phien ban da khai — day '
  'la cach tieu chi 4 cua Phase 4 (khong viet lai lich su) duoc thuc thi khi '
  'DOC, khong phai bang mot lan ghi de len du lieu cu.';
