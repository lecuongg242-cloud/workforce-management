import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
  canReadCompanyData,
} from "@/lib/auth/session-context";
import {
  geocodeListResponseSchema,
  geocodeQuerySchema,
  nominatimPlaceSchema,
} from "@/lib/validation/api/geocode";

/**
 * Tim dia diem theo ten/dia chi cho o tim kiem cua ban do chon diem lam viec.
 *
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`.
 *
 * DUNG NOMINATIM CUA OPENSTREETMAP: mien phi, KHONG can khoa API nen khong
 * them mot nha cung cap phai cau hinh vao he thong (rang buoc trong
 * CLAUDE.md) — cung ly do da chon Leaflet + anh ban do OSM cho chinh ban do
 * nay.
 *
 * VI SAO PROXY QUA SERVER thay vi goi thang tu trinh duyet:
 * - Rang buoc cua du an: moi truy cap du lieu di qua tang server cua Next.js.
 * - Chinh sach dung Nominatim doi mot `User-Agent` xac dinh duoc ung dung;
 *   trinh duyet KHONG cho dat header do, server thi co.
 * - Yeu cau `getSessionContext()` + `requireRole` de day khong tro thanh mot
 *   proxy mo cho ca Internet dung nho han ngach dung chung cua OSM.
 *
 * Khai bao diem lam viec la viec cua quan tri (cung ranh gioi voi
 * `POST /api/work-sites` va man hinh Diem lam viec), nen chi `owner`/`admin`
 * goi duoc.
 */
export const dynamic = "force-dynamic";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

/**
 * Chinh sach dung Nominatim doi mot User-Agent nhan dang duoc ung dung goi.
 * Day KHONG phai mot header tuy y — thieu no la ly do bi chan hop le.
 */
const NOMINATIM_USER_AGENT = "TimeFlow/1.0 (work-site picker; self-hosted)";

/** San pham chi phuc vu doanh nghiep Viet Nam — gioi han quoc gia cho ket qua sat hon. */
const SEARCH_PARAMS = {
  format: "jsonv2",
  limit: "6",
  countrycodes: "vn",
  "accept-language": "vi",
} as const;

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { role } = await getSessionContext();
    if (!canReadCompanyData(role)) throw new ForbiddenError();

    const url = new URL(request.url);
    const parsed = geocodeQuerySchema.safeParse({ q: url.searchParams.get("q") ?? "" });
    if (!parsed.success) {
      // Truy van qua ngan chua phai loi cua nguoi dung — tra danh sach rong
      // de o tim kiem khong nhap nhay mot thong bao loi khi dang go do.
      return NextResponse.json(geocodeListResponseSchema.parse([]));
    }

    const target = new URL(NOMINATIM_ENDPOINT);
    for (const [key, value] of Object.entries(SEARCH_PARAMS)) {
      target.searchParams.set(key, value);
    }
    target.searchParams.set("q", parsed.data.q);

    const response = await fetch(target, {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        Accept: "application/json",
      },
      // Dich vu ngoai co the cham hoac chet — khong de mot lan tim kiem treo
      // vo han mot ket noi cua server.
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Không tìm được địa điểm. Vui lòng thử lại." },
        { status: 502 },
      );
    }

    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) {
      return NextResponse.json(geocodeListResponseSchema.parse([]));
    }

    // Dong nao khong qua duoc schema thi BO RIENG dong do — mot ket qua di
    // dang tu dich vu ngoai khong duoc lam hong ca danh sach.
    const places = raw
      .map((row) => nominatimPlaceSchema.safeParse(row))
      .filter((result) => result.success)
      .map((result) => result.data);

    return NextResponse.json(geocodeListResponseSchema.parse(places));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      return NextResponse.json(geocodeListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/geocode:", cause);
    return NextResponse.json(
      { error: "Không tìm được địa điểm. Vui lòng thử lại." },
      { status: 502 },
    );
  }
}
