import { ATTENDANCE_REJECTION_LABEL } from "@/lib/constants";
import type { AttendanceRejectionReason } from "@/lib/types/domain";

/**
 * Loi cham cong bi tu choi (D-20b) — dung CHUNG giua Server Action
 * (`src/lib/data/mutations/attendance.ts`) va giao dien (Camera Sheet,
 * `employee-home-view.tsx`). Day la NGUON DUY NHAT cho phan loai tu choi tu
 * plan nay tro di, thay cho `AttendanceEvidenceError` rieng cua 03-01 va
 * logic kiem hinh dang tam thoi (`classifyRejection`/`isRejectionReason`)
 * cua 03-03.
 *
 * Theo dung khuon lop loi cua du an (`src/lib/auth/session-context.ts` dong
 * 16-48): ke thua `Error`, dat `this.name`, thong diep tieng Viet trong ham
 * dung. Diem khac BAT BUOC voi khuon do: them mot truong `reason` CHI DOC
 * (mot trong ba gia tri cua `AttendanceRejectionReason`) de ca Server Action
 * lan giao dien phan nhanh theo PHAN LOAI, khong phai theo chuoi hien thi.
 *
 * Thong diep LAY TU `ATTENDANCE_REJECTION_LABEL[reason].body` — khong viet
 * lai chuoi o day, tranh hai noi giu hai ban sao cua cung mot cau tieng Viet
 * co the lech nhau sau mot lan sua chinh ta.
 */
export class AttendanceRejectedError extends Error {
  constructor(public readonly reason: AttendanceRejectionReason) {
    super(ATTENDANCE_REJECTION_LABEL[reason].body);
    this.name = "AttendanceRejectedError";
  }
}

function isValidRejectionReason(
  value: unknown,
): value is AttendanceRejectionReason {
  return (
    value === "missing_photo" ||
    value === "outside_shift" ||
    value === "network_error"
  );
}

/**
 * Ve si kieu KIEM THEO HINH DANG (co truong `reason` hop le), KHONG dung
 * `instanceof` — mot loi nem tu Server Action co the mat nguyen mau khi toi
 * client qua ranh gioi RSC (tai lieu Next.js: CHI `message` chac chan duoc
 * chuyen tiep qua ranh gioi nay; moi truong tuy bien khac cua mot class loi,
 * KE CA `name`, co the khong con). Vi vay ham nay CHI kiem su co mat cua mot
 * truong `reason` hop le — KHONG doi hoi `name === "AttendanceRejectedError"`
 * (mot phien ban truoc cua ham nay co doi hoi do va da vo tinh tu choi dung
 * chinh hinh dang serialize qua ranh gioi Server Action thuc te). Dung o CA
 * HAI dau: giao dien (`camera-sheet.tsx`, `employee-home-view.tsx`) BAT BUOC
 * kiem hinh dang; noi bo Server Action (`mutations/attendance.ts`) van dung
 * duoc vi cung mot tien trinh, nhung dung chung mot ham thay vi viet hai lan.
 */
export function isAttendanceRejection(
  cause: unknown,
): cause is AttendanceRejectedError {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "reason" in cause &&
    isValidRejectionReason((cause as { reason: unknown }).reason)
  );
}
