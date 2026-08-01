-- 0007_search_normalize.sql
--
-- O tim kiem nhan vien cua V1 loc bang normalizeText() (src/lib/format.ts
-- dong 200-208): bo dau bang NFD + xoa dau to hop, doi d/Đ -> d/D, ha chu
-- thuong, cat khoang trang hai dau. Khi phep loc chuyen sang phia server o
-- plan 02-05, Postgres phai lam DUNG phep bien doi do — neu khong tim
-- "nguyen" se khong ra "Nguyễn" va nguoi dung mat mot hanh vi dang co.
--
-- Khong dung extension `unaccent`: extension phai co mat tren ca Postgres CI
-- lan Supabase cloud (chi phi van hanh them), ham unaccent() la STABLE chu
-- khong IMMUTABLE, va bang ky tu tieng Viet la mot tap dong nen translate()
-- cho ket qua xac dinh tren moi moi truong khong phu thuoc extension nao.
--
-- Khong tao index o migration nay: bo du lieu o quy mo hai doanh nghiep
-- pilot chua can, va index tren bieu thuc se khoa cung dinh nghia ham (moi
-- lan sua ham lai phai drop/tao lai index).

-- Hai chuoi truyen cho translate() PHAI dai bang nhau (tinh theo so ky tu,
-- khong phai byte) — moi vi tri tuong ung mot cap (ky tu co dau -> ky tu
-- ASCII). 134 ky tu moi ben: toan bo nguyen am co dau tieng Viet (a/ă/â,
-- e/ê, i, o/ô/ơ, u/ư, y) va d/đ, ca chu thuong lan chu hoa.
create function public.tf_normalize(p text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(trim(translate(
    p,
    'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD'
  )));
$$;
