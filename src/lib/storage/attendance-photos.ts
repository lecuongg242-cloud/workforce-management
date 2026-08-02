/**
 * Hang so va tien ich duong dan cho bucket Storage rieng tu chua anh cham
 * cong (03-01-PLAN.md, checkpoint:decision — option-a).
 *
 * Bo cuc duong dan da CHOT (mot chieu, xac nhan boi chu du an): moi doi lai
 * sau khi da co anh that la mot cuoc di chuyen object cong viet lai
 * `storage_path` cua tung dong, khong phai mot lan refactor. `0005_v2_tables.sql`
 * mang rang buoc `check (storage_path like company_id || '/%')`, nen moi
 * duong dan BAT BUOC bat dau bang chinh `company_id`.
 *
 * `{company_id}/{employee_id}/{photo_id}.jpg` duoc chon (thay vi
 * `{company_id}/{yyyy}/{mm}/...`) vi no lam cho viec xoa-theo-tung-nhan-vien
 * (thu nhom PRIV se can o V3: "rut lai dong y" / "tu xuat du lieu ca nhan")
 * thanh mot lan liet ke tien to duy nhat — doi lai, mot job don theo TUOI ve
 * sau se phai doc `captured_at` tu bang thay vi suy tu duong dan. Danh doi
 * nay duoc chap nhan co y thuc vi D-22 da khong dat lich cho bat ky job don
 * nao trong V2.
 *
 * Phan cuoi duong dan la uuid cua `attendance_photos.id` (KHONG PHAI mot so
 * thu tu) — de khong ai liet ke duoc anh bang cach doan URL.
 */

export const ATTENDANCE_PHOTO_BUCKET = "attendance-photos";

/**
 * Gioi han MIME va kich thuoc that su nam o CAU HINH BUCKET PHIA SERVER
 * (`scripts/storage-bucket.mjs`), vi do la cho duy nhat khong tin loi khai
 * cua client ve kieu noi dung. Danh sach nay dung lai o ca hai dau (script
 * tao bucket va schema Zod validate truoc khi tai len) de khong viet hai lan.
 */
export const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png"] as const;

export type AttendancePhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

export interface BuildAttendancePhotoPathInput {
  companyId: string;
  employeeId: string;
  photoId: string;
  kind: "check_in" | "check_out";
}

/**
 * Dung theo dung bo cuc da chot:
 * `{company_id}/{employee_id}/{photo_id}.jpg`. `kind` khong xuat hien trong
 * duong dan — `photo_id` (uuid cua `attendance_photos.id`) da la duy nhat,
 * va rang buoc `unique (attendance_record_id, kind)` cua database da dam bao
 * moi (ban ghi, loai) chi co dung mot dong.
 */
export function buildAttendancePhotoPath({
  companyId,
  employeeId,
  photoId,
}: BuildAttendancePhotoPathInput): string {
  return `${companyId}/${employeeId}/${photoId}.jpg`;
}
