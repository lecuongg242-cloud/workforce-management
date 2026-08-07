import { redirect } from "next/navigation";

/**
 * Ky cong da GOP vao trang Cham cong: trang thai ky va nut chot nam ngay canh
 * bang cong cua chinh thang do (`src/app/admin/attendance/attendance-view.tsx`).
 *
 * Duong dan cu duoc GIU va chuyen huong, khong xoa han: no da di vao lich su
 * trinh duyet, vao ghi chu cua nguoi dung, va vao mot script van hanh
 * (`scripts/tmp/setup-ngocphat.mjs`). Mot lien ket cu tra ve 404 la mot cach
 * lam nguoi dung tuong tinh nang bi go mat.
 */
export default function AdminPeriodsPage(): never {
  redirect("/admin/attendance");
}
