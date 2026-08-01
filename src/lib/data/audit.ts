import { createServerSupabase } from "@/lib/supabase/server";

/**
 * logMutation() ghi audit_log NGAY TRONG cung ham ghi ma no phuc vu (D-17,
 * khong dung trigger — trigger khong biet actor khi thao tac di qua duong
 * Admin API, va khong bao gio biet `reason`).
 *
 * GIOI HAN PHAI GHI RO (D-17a): audit o tang server nay biet dung AI va VI
 * SAO, nhung KHONG DAM BAO DU — mot migration hay mot phien psql tay ghi
 * thang vao bang se khong de lai vet nao o day. Khong ai duoc doc audit_log
 * roi tin do la ban ghi day du moi thay doi. Neu sau nay can tinh du, them
 * mot trigger lam luoi thu hai ghi "thay doi khong ro tac nhan" — bo sung,
 * khong thay the (D-17a).
 *
 * HE QUA CAN BIET TRUOC (D-18a): tu Phase 3, moi dong `attendance_records`
 * mang toa do GPS; vi `before`/`after` o day luu nguyen dong (D-18, khong
 * luu delta), `audit_log` se thanh mot ban sao thu hai cua du lieu ca nhan
 * voi vong doi rieng. Phan quyen rieng tu da ra khoi pham vi V2 nen day
 * khong phai viec phai lam o Phase 2 — ghi lai de no khong thanh bat ngo.
 */

export interface AuditEntry {
  companyId: string;
  actorUserId: string;
  action: "insert" | "update" | "delete";
  entityTable: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string | null;
}

/**
 * Dung client cookie-bound (khong phai khoa secret) de RLS van la lop phong
 * thu thu hai — chinh nguoi goi phai la thanh vien cua `companyId` thi dong
 * insert nay moi qua duoc policy `audit_log_insert_member`.
 */
export async function logMutation(entry: AuditEntry): Promise<void> {
  const supabase = await createServerSupabase();

  const { error } = await supabase.from("audit_log").insert({
    company_id: entry.companyId,
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_table: entry.entityTable,
    entity_id: entry.entityId,
    before: entry.before,
    after: entry.after,
    reason: entry.reason,
  });

  if (error) {
    // Mot thao tac ghi khong de lai vet la mot thao tac khong duoc coi la
    // thanh cong — nem loi de nguoi goi huy toan bo thao tac.
    throw new Error("Không ghi được nhật ký thao tác — thao tác đã bị huỷ.");
  }
}
