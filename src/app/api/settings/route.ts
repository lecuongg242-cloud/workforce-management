import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { loadCompanySettings } from "@/lib/settings/company-settings";
import { companySettingsSchema } from "@/lib/validation/api/settings";

/**
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. Duong GHI cau hinh la
 * Server Action `updateCompanySettings` (`src/lib/data/mutations/settings.ts`).
 *
 * MOI vai tro dang nhap deu doc duoc cau hinh: khung gio dem va bien do khung
 * gio ca la thu nhan vien can biet de hieu ban ghi cua chinh minh. Gioi han
 * `owner`/`admin` nam o duong GHI, khong o duong doc.
 *
 * Khong nhan tham so nao — doanh nghiep lay tu phien (D-12b).
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const { companyId } = await getSessionContext();
    const settings = await loadCompanySettings(companyId);
    return NextResponse.json(companySettingsSchema.parse(settings));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon doanh nghiep nao thi KHONG co cau hinh de tra —
      // khac cac danh sach (tra mang rong), o day khong co "hinh dang rong"
      // hop le nen tra loi tuong minh.
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    console.error("Lỗi không xác định ở GET /api/settings:", cause);
    return NextResponse.json(
      { error: "Không thể tải cấu hình doanh nghiệp." },
      { status: 500 },
    );
  }
}
