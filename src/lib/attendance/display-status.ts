import type { AttendanceStatus } from "@/lib/types/domain";

/**
 * TRANG THAI HIEN THI cua mot ban ghi cham cong.
 *
 * Module THUAN: khong dung client co so du lieu, khong doc bien moi truong,
 * khong doc dong ho he thong — `today` PHAI duoc truyen vao.
 *
 * ======================================================================
 * VI SAO CAN MOT TRANG THAI RIENG CHO HIEN THI
 * ======================================================================
 *
 * `attendance_records.status` ghi lai PHEP DANH GIA DUNG GIO tai luc cham
 * VAO: dung gio hay di muon. Do la mot su that ve qua khu va no khong doi.
 *
 * Nhung mot ban ghi CHUA CHAM RA thi cau tra loi dung cho cau hoi "hom nay
 * nguoi nay the nao" khong phai "Đúng giờ" — no la "đang làm việc". Hien
 * "Đúng giờ" cho mot ngay chua khep lai doc ra nhu mot ket luan da xong, va
 * nguoi xem se khong biet la con thieu lan cham ra.
 *
 * Trang thai nay CHI TON TAI O TANG HIEN THI. Khong ghi xuong database:
 *
 *   - no phu thuoc vao HOM NAY la ngay nao, nen mot gia tri da ghi se sai
 *     ngay khi sang ngay moi;
 *   - va ghi de len `status` se xoa mat phep danh gia dung gio — thu ma bang
 *     luong va bao cao di muon dang dung.
 *
 * ======================================================================
 * NGAY DA QUA MA VAN CHUA CHAM RA
 * ======================================================================
 *
 * Khong phai "đang làm việc" — nguoi do khong con lam viec, ho QUEN cham ra.
 * `missing_checkout` ("Thiếu giờ ra") la cau tra loi dung, va no goi nguoi
 * quan tri di sua thay vi de mot ngay hong nam im.
 *
 * Truoc thay doi nay khong mot dong ma nao suy ra `missing_checkout` — gia tri
 * do chi co trong du lieu seed. Nghia la mot ban ghi do CHINH ung dung tao ma
 * quen cham ra se hien "Đúng giờ" MAI MAI.
 */

/** `AttendanceStatus` cong them mot trang thai CHI de hien thi. */
export type AttendanceDisplayStatus = AttendanceStatus | "working";

/**
 * Trang thai de hien ra man hinh cho MOT ban ghi.
 *
 * `today` la ngay theo dong ho MAY CHU (`getServerToday()`), khong phai dong
 * ho trinh duyet: mot may dat lech mui gio se lam ban ghi cua hom nay bi doc
 * thanh "thiếu giờ ra".
 */
export function displayAttendanceStatus({
  status,
  checkIn,
  checkOut,
  date,
  today,
}: {
  status: AttendanceStatus;
  /** `null` = dong nghi phep, khong phai mot luot cham cong. */
  checkIn: string | null;
  checkOut: string | null;
  /** "YYYY-MM-DD" — ngay cong cua ban ghi. */
  date: string;
  /** "YYYY-MM-DD" — hom nay theo dong ho may chu. */
  today: string;
}): AttendanceDisplayStatus {
  // Dong khong co gio vao la nghi phep / nghi khong luong / ngay nghi — chung
  // khong co "lan cham ra" de thieu.
  if (checkIn === null) return status;
  if (checkOut !== null) return status;

  // So sanh chuoi "YYYY-MM-DD" la du va an toan: ca hai deu la ngay theo gio
  // Viet Nam, khong co phep doi mui gio nao chen vao giua (cung ly do voi
  // `formatDate` trong `src/lib/format.ts`).
  return date >= today ? "working" : "missing_checkout";
}
