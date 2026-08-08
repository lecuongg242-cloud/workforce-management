"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * AP CA LINH HOAT CHO KY CHUA CHOT (Server Actions).
 *
 * Khuon giong `mutations/employees.ts`: `getSessionContext()` -> kiem quyen ->
 * goi voi `company_id` tu phien -> `logMutation` NGAY TRONG cung ham (D-17).
 *
 * ======================================================================
 * PHAN GHI NAM TRONG `tf_realign_attendance_to_shift()` (migration 0031)
 * ======================================================================
 *
 * File nay KHONG ghi thang vao `attendance_records`, va do la bat buoc theo
 * hai le:
 *
 *   a) Cong `no-silent-period-write` (05-06) cam moi file mutation ngoai danh
 *      sach mien tru ghi thang vao bang do.
 *
 *   b) MOT LAN AP CA PHAI LA MOT GIAO DICH. Mot vong lap `update` tung dong
 *      qua PostgREST khong nguyen tu: hong o dong thu ba de lai hai ngay da
 *      doi va KHONG co dong audit nao — so lieu do chay thang vao bang luong.
 *
 * ======================================================================
 * HAI HAM, MOT DINH NGHIA
 * ======================================================================
 *
 * `previewShiftRealign` goi cung RPC voi `p_dry_run = true`. Nho vay phep chon
 * "ngay nao" chi ton tai o MOT cho: neu dem mot dang va ghi mot dang khac thi
 * cau hoi xac nhan se noi doi, va khong ai phat hien ra.
 *
 * Tach doi vi viec nay VIET LAI LICH SU CHAM CONG. Nguoi bam phai nhin thay
 * dung thiet hai truoc khi dong y; mot ham vua dem vua ghi thi khong con cho
 * nao de tu choi.
 */

export interface ShiftRealignPreview {
  /** Ten ca linh hoat dang duoc ap. */
  shiftName: string;
  /** So ngay se doi. */
  dayCount: number;
  /** Trong do, bao nhieu ngay dang tinh di muon. */
  lateDayCount: number;
  /** Cac thang bi cham, dang "YYYY-MM", tang dan. */
  months: string[];
}

interface RealignRow {
  work_date: string;
  was_late: boolean;
}

/**
 * Phan chung cua ca hai ham: kiem quyen, doc ca hien tai, goi RPC.
 *
 * `dryRun = true` chi DOC. `dryRun = false` GHI, trong mot giao dich.
 */
async function callRealign(
  employeeId: string,
  dryRun: boolean,
): Promise<{
  companyId: string;
  userId: string;
  shiftId: string;
  shiftName: string;
  rows: RealignRow[];
}> {
  const { companyId, userId, role } = await getSessionContext();
  // Viet lai so lieu cham cong cua ca mot ky la viec cua nguoi lam nhan su.
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const { data: employeeRow, error: employeeError } = await supabase
    .from("employees")
    .select("shift_id, shifts(name)")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (employeeError || !employeeRow) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const raw = employeeRow as unknown as {
    shift_id: string;
    shifts: { name: string } | null;
  };

  // Tien de "ca phai la ca linh hoat" duoc CUONG CHE TRONG RPC (0031), khong
  // o day: mot lan goi nham voi ca co gio se xoa do muon that cua nguoi ta, va
  // ranh gioi cho mot mat mat nhu vay phai nam o tang khong bo qua duoc.
  const { data, error } = await supabase.rpc("tf_realign_attendance_to_shift", {
    p_company_id: companyId,
    p_employee_id: employeeId,
    p_shift_id: raw.shift_id,
    p_dry_run: dryRun,
  });

  if (error) {
    // KHONG nuot loi tu trigger `attendance_period_guard` (TF001) hay tu phep
    // kiem loai ca. Ca hai deu la ranh gioi that; nuot chung di la mo duong
    // cho so lieu cua mot ky da chot bi doi ben duoi bang luong da chot.
    throw new Error(error.message);
  }

  return {
    companyId,
    userId,
    shiftId: raw.shift_id,
    shiftName: raw.shifts?.name ?? "",
    rows: (data ?? []) as RealignRow[],
  };
}

/** Dem truoc khi ghi — dung de dung cau hoi xac nhan. Khong ghi gi. */
export async function previewShiftRealign(
  employeeId: string,
): Promise<ShiftRealignPreview> {
  const { shiftName, rows } = await callRealign(employeeId, true);

  return {
    shiftName,
    dayCount: rows.length,
    lateDayCount: rows.filter((row) => row.was_late).length,
    months: Array.from(new Set(rows.map((row) => row.work_date.slice(0, 7)))).sort(),
  };
}

/** Ap ca linh hoat cho moi ngay cua ky CHUA CHOT. Mot giao dich duy nhat. */
export async function applyShiftRealign(
  employeeId: string,
): Promise<{ dayCount: number }> {
  // Dem TRUOC khi ghi: RPC o che do ghi tra ve tap ngay da doi, nhung khong
  // con biet ngay nao TUNG di muon (cac cot da bi dat lai). Dong audit can
  // trang thai TRUOC do de doi chieu duoc ve sau.
  const before = await previewShiftRealign(employeeId);

  if (before.dayCount === 0) {
    return { dayCount: 0 };
  }

  const { companyId, userId, shiftId, shiftName, rows } = await callRealign(
    employeeId,
    false,
  );

  // MOT dong audit tong hop, khong phai mot dong moi ngay — cung khuon
  // `closePayroll` (mot dong kem `line_count`).
  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "attendance_records",
    entityId: employeeId,
    before: {
      day_count: before.dayCount,
      late_day_count: before.lateDayCount,
      months: before.months,
    },
    after: {
      shift_id: shiftId,
      shift_name: shiftName,
      day_count: rows.length,
      work_dates: rows.map((row) => row.work_date),
    },
    reason: "Áp ca linh hoạt cho kỳ chưa chốt",
  });

  return { dayCount: rows.length };
}
