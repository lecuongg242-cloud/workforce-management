"use server";

import { getSessionContext } from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Danh dau da doc (APRV-05, plan 05-04).
 *
 * KHONG co `logMutation` o day, va do la mot ngoai le CO CAN NHAC voi D-17:
 * "toi da doc thong bao cua chinh toi" khong phai mot thay doi du lieu nghiep
 * vu — no khong doi cong, khong doi tien, khong doi quyet dinh nao. Ghi no vao
 * `audit_log` se lam nhat ky thao tac ngap trong tieng on va cac dong that su
 * quan trong chim theo. Ban than `read_at` da la vet cua chinh no.
 *
 * `user_id` LUON tu phien, khong bao gio tu tham so — cung ly do voi
 * `companyId` (D-12b). Truyen id cua nguoi khac thi dieu kien `.eq("user_id",
 * userId)` loc no ra va so dong bi tac dong la 0; ham tra ve dung con so do
 * thay vi gia vo thanh cong (T-05-04-02).
 */
export async function markNotificationsRead(ids: string[]): Promise<number> {
  // Danh sach rong khong cham database, khong cham phien — cung khuon
  // `bulkMoveDepartment` (02-07).
  if (ids.length === 0) return 0;

  const { companyId, userId } = await getSessionContext();
  const supabase = await createServerSupabase();

  // Dau thoi gian den tu DONG HO DATABASE (D-19), khong tu `new Date()` cua
  // tien trinh dang chay — cung duong ma `checkIn`/`checkOut` dung (0010).
  const { data: serverNow, error: nowError } = await supabase.rpc("tf_server_now");
  if (nowError || !serverNow) {
    throw new Error("Không đọc được giờ máy chủ.");
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: serverNow as string })
    .in("id", ids)
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id");

  if (error) {
    throw new Error("Không đánh dấu được thông báo đã đọc.");
  }
  return (data ?? []).length;
}
