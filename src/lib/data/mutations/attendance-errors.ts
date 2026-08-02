import type { AttendanceRejectionReason } from "@/lib/types/domain";

/**
 * Tach RIENG khoi `src/lib/data/mutations/attendance.ts` vi file do mang chi
 * thi `"use server"` — Next.js CHI cho phep export ham async tu mot file
 * nhu vay (loi build: "Only async functions are allowed to be exported in a
 * "use server" file"), nen mot class loi khong export duoc tu chinh no.
 *
 * Loi cham cong bi tu choi vi thieu bang chung (D-20b). `reason` khop
 * `AttendanceRejectionReason` de tang goi (Camera Sheet, plan 03-03) phan
 * biet duoc voi loi mang tinh he thong chung (mat mang, DB loi...).
 */
export class AttendanceEvidenceError extends Error {
  constructor(
    public readonly reason: AttendanceRejectionReason,
    message: string,
  ) {
    super(message);
    this.name = "AttendanceEvidenceError";
  }
}
