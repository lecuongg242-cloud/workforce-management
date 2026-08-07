import { ForbiddenError } from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Cong quyen `can_view_payslip` (PAY-05, AUTH-03).
 *
 * ======================================================================
 * CO GAC O SERVER, KHONG CHI AN O GIAO DIEN
 * ======================================================================
 *
 * `employees.can_view_payslip` da ton tai tu V1 va bat/tat duoc o bieu mau sua
 * nhan vien, nhung cho toi truoc PAY-05 no KHONG duoc doc o bat ky cho nao de
 * phan quyen — mot co chet. File nay la noi no co nghia lan dau.
 *
 * An muc dieu huong chi la phep lich su; mot nguoi go thang duong dan van toi
 * duoc Route Handler. Vi vay cong nam O DAY, truoc moi truy van du lieu luong,
 * va tra `ForbiddenError` -> 403.
 *
 * ======================================================================
 * NGHIA CUA CO NAY
 * ======================================================================
 *
 * `false` = nhan vien KHONG xem duoc phieu CUA CHINH MINH qua ung dung (doanh
 * nghiep phat phieu giay, hoac chua muon cong khai). No KHONG mang nghia
 * "khong xem duoc phieu cua nguoi khac" — dieu do da do pham vi theo phien va
 * RLS (migration 0029) lo, va khong phu thuoc vao mot co co the tat.
 *
 * Mot nhan vien bi tat co van la nguoi duy nhat doc duoc dong cua ho o tang
 * database. Hai lop khong chong cheo nhau: mot lop tra loi "duoc xem gi", lop
 * kia tra loi "co duoc xem khong".
 */
export async function assertCanViewOwnPayslip(
  employeeId: string,
  companyId: string,
): Promise<void> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("employees")
    .select("can_view_payslip")
    .eq("id", employeeId)
    // Loc lai theo `companyId` cua PHIEN (D-12b) du `employeeId` cung den tu
    // phien: hai dieu kien cung tu mot nguon van re hon mot dong doc lot qua
    // neu `getSessionContext()` doi cach phan giai ve sau.
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error("Không thể kiểm tra quyền xem phiếu lương.");
  }

  // Khong tim thay ho so -> tu choi. `maybeSingle()` tra `null` khi dong
  // khong ton tai HOAC thuoc doanh nghiep khac; ca hai deu khong phai nguoi
  // duoc xem phieu o day.
  if (!data || (data as { can_view_payslip: boolean }).can_view_payslip !== true) {
    throw new ForbiddenError();
  }
}
