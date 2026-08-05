import { redirect } from "next/navigation";

import {
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
  homePathForRole,
} from "@/lib/auth/session-context";

/**
 * Diem re DUY NHAT sau khi phien thay doi. Moi luong dang nhap / chon doanh
 * nghiep / doi mat khau deu dua nguoi dung toi `/`, khong tu doan truoc dich
 * den — `middleware.ts` chi doc duoc JWT nen khong biet vai tro (vai tro nam
 * o bang `memberships`), con phia trinh duyet thi cang khong.
 *
 * `redirect()` duoc goi NGOAI khoi `try` vi no hoat dong bang cach nem loi
 * NEXT_REDIRECT — dat trong `try` se bi chinh khoi `catch` nay bat nham.
 */
export default async function RootPage(): Promise<never> {
  let target: string;

  try {
    const { role } = await getSessionContext();
    target = homePathForRole(role);
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      target = "/login";
    } else if (
      cause instanceof NoMembershipError ||
      cause instanceof NoActiveCompanyError
    ) {
      target = "/select-company";
    } else {
      throw cause;
    }
  }

  redirect(target);
}
