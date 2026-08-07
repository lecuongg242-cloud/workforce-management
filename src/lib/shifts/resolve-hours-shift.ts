import { randomUUID } from "node:crypto";

import { logMutation } from "@/lib/data/audit";
import {
  hoursShiftCode,
  hoursShiftName,
  MAX_SHIFT_HOURS,
  MIN_SHIFT_HOURS,
  hoursToMinutes,
} from "@/lib/shifts/schedule";
import type { createServerSupabase } from "@/lib/supabase/server";
import type { WeekdayNumber } from "@/lib/types/domain";

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>;

/**
 * Doi "nguoi nay lam 10 tieng mot ngay" thanh MOT `shifts.id` de gan vao
 * `employees.shift_id`.
 *
 * VI SAO PHAI QUA MOT DONG `shifts`: `employees.shift_id` va
 * `attendance_records.shift_id` deu la NOT NULL, va ba rang buoc giu tinh dung
 * dan cua cham cong nhieu luot (migration 0013) deu dua vao cot do — xem phan
 * dau `0027_hours_based_shift.sql`. Ca linh hoat vi vay van la mot ca, chi khac
 * o cho no khai do dai thay vi gio moc.
 *
 * TIM TRUOC ROI MOI TAO: hai nhan vien cung khai 10 gio dung CHUNG mot dong
 * `shifts`. Neu moi lan them nguoi lai tao mot ca moi thi man hinh "Ca lam
 * viec" se day len hang chuc dong trung noi dung, va bao cao dem nhan vien
 * theo ca se vo vun thanh moi ca mot nguoi.
 *
 * Module SERVER-ONLY (goi `logMutation`, nhan client Supabase cua server).
 * KHONG dat `"use server"`: day khong phai Server Action, no la mot ham noi bo
 * ma cac mutation khac goi — va mot file `"use server"` bat buoc moi export
 * phai la ham async, tuc hai hang so o duoi se bi tu choi.
 */

/**
 * CA LINH HOAT khai TU MAN HINH NHAN VIEN: thay vi chon mot ca co san, nguoi
 * dung go so gio lam mot ngay cua RIENG nguoi nay.
 *
 * Kieu nay song o day chu khong o `mutations/employees.ts` vi file do mang
 * `"use server"` — Next.js doi MOI export cua mot module Server Action la ham
 * async, nen mot `interface` xuat tu do la mot cai bay cho lan build sau.
 */
export interface HoursShiftSelection {
  /** So gio lam mot ngay, vi du 10 hoac 7,5. */
  hours: number;
  /**
   * Ngay lam viec trong tuan. Chi duoc dung khi PHAI TAO ca moi — ca da co san
   * giu nguyen lich cua no, vi doi lich cua mot ca dang dung se doi cach tinh
   * cong cua MOI nhan vien khac cung ca do.
   */
  workingDays: WeekdayNumber[];
}

export interface ResolveHoursShiftInput extends HoursShiftSelection {
  supabase: ServerSupabaseClient;
  companyId: string;
  actorUserId: string;
}

export async function resolveHoursShiftId({
  supabase,
  companyId,
  actorUserId,
  hours,
  workingDays,
}: ResolveHoursShiftInput): Promise<string> {
  if (!Number.isFinite(hours) || hours < MIN_SHIFT_HOURS || hours > MAX_SHIFT_HOURS) {
    throw new Error(
      `Số giờ làm một ngày phải từ ${MIN_SHIFT_HOURS} đến ${MAX_SHIFT_HOURS}.`,
    );
  }

  const durationMinutes = hoursToMinutes(hours);

  // Khop theo (company_id, kind, duration_minutes) — KHONG theo ten hay ma:
  // ten do `hoursShiftName()` sinh ra va co the doi cach viet o mot ban sau,
  // con do dai la thu that su dinh nghia ca nay.
  const { data: existing, error: findError } = await supabase
    .from("shifts")
    .select("id")
    .eq("company_id", companyId)
    .eq("kind", "hours")
    .eq("duration_minutes", durationMinutes)
    .eq("status", "active")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new Error("Không thể kiểm tra ca linh hoạt hiện có.");
  }
  if (existing) {
    return existing.id as string;
  }

  const id = randomUUID();
  const { data: inserted, error: insertError } = await supabase
    .from("shifts")
    .insert({
      id,
      company_id: companyId,
      name: hoursShiftName(durationMinutes),
      code: hoursShiftCode(durationMinutes),
      kind: "hours",
      start_time: null,
      end_time: null,
      duration_minutes: durationMinutes,
      break_start_time: null,
      break_end_time: null,
      break_minutes: 0,
      late_tolerance_minutes: 0,
      working_days: workingDays,
      status: "active",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error("Không thể tạo ca linh hoạt.");
  }

  // Ca nay duoc tao NGAM tu man hinh nhan vien, khong tu man hinh Ca lam viec.
  // Chinh vi vay no can mot dong audit: neu khong, mot ca xuat hien trong danh
  // sach ma khong ai tim ra ai da tao no va luc nao.
  await logMutation({
    companyId,
    actorUserId,
    action: "insert",
    entityTable: "shifts",
    entityId: id,
    before: null,
    after: inserted,
    reason: "Ca linh hoạt sinh tự động từ số giờ khai ở hồ sơ nhân viên.",
  });

  return id;
}
