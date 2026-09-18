import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

/**
 * Ten hien thi cua nhung nguoi da TAO/SUA mot ban ghi, tra cuu theo
 * `employees.user_id` TRONG DUNG doanh nghiep cua phien (D-12b).
 *
 * Khong luu ban sao ten o bang ban ghi: ten la du lieu cua ho so nhan vien,
 * khong phai cua dong du lieu ma ho tao ra. Doi lai la mot truy van phu duy
 * nhat cho ca trang, va chi khi that su co nguoi de tra cuu.
 *
 * Mot id KHONG tra cuu duoc (quan tri khong co ho so nhan vien, hoac ho so da
 * bi go) se vang mat khoi Map. Tang tren PHAI hien mot nhan "co nguoi khai"
 * cho truong hop do — khong duoc doc ra thanh khong ai khai, va tuyet doi
 * khong duoc do id ra man hinh thay cho ten.
 */
export async function resolveActorNames(
  supabase: ServerSupabase,
  companyId: string,
  userIds: readonly (string | null)[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();

  const unique = [
    ...new Set(
      userIds.filter((value): value is string => typeof value === "string"),
    ),
  ];
  if (unique.length === 0) return names;

  const { data } = await supabase
    .from("employees")
    .select("user_id, full_name")
    .eq("company_id", companyId)
    .in("user_id", unique);

  for (const row of (data ?? []) as {
    user_id: string | null;
    full_name: string;
  }[]) {
    if (row.user_id) names.set(row.user_id, row.full_name);
  }

  return names;
}
