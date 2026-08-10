import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
  canReadCompanyData,
} from "@/lib/auth/session-context";
import { ATTENDANCE_PHOTO_BUCKET } from "@/lib/storage/attendance-photos";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Broker Route Handler — CHI GET, phat byte anh cham cong ra ngoai server.
 * Day la ranh gioi ma tieu chi 4 cua ROADMAP noi toi: "nguoi o doanh nghiep
 * khac cam dung lien ket van khong xem duoc". Khuon 02-04 (D-12c): chi xuat
 * `dynamic` va `GET`.
 *
 * TUYET DOI KHONG dung ham tao lien ket ky (signed URL) cua Supabase Storage
 * va khong dua bat ky URL nao cua mien luu tru nha cung cap vao phan hoi: mot
 * lien ket ky, mot khi da phat hanh, dung duoc cho BAT KY AI cam no cho toi
 * luc het han va KHONG tai kiem quyen lan nao nua (Pitfall 2, RESEARCH.md —
 * xac nhan qua thao luan chinh thuc cua Supabase). Duong duy nhat loai tru
 * duoc rui ro do la doc byte anh bang `.download()` NGAY O SERVER nay roi tra
 * thang byte, tren MOI lan goi. (Cong co hoc chan kieu ro ri nay quay lai:
 * `src/__tests__/no-signed-url.test.ts`, plan 03-07.)
 */
export const dynamic = "force-dynamic";

interface AttendancePhotoLookupRow {
  /** Nullable tu migration 0032 — mot dong bang chung khong kem tep anh nao. */
  storage_path: string | null;
  company_id: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const { companyId, role } = await getSessionContext();

    const supabase = await createServerSupabase();

    // Kiem tuong minh o TANG UNG DUNG, khong dua duy nhat vao RLS (khuon cu
    // D-12b) — .eq("company_id", companyId) chay TREN MOI LAN GOI, khong
    // phai mot lan tai thoi diem ky nhu signed URL.
    const { data: photo, error: photoError } = await supabase
      .from("attendance_photos")
      .select("storage_path, company_id")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle<AttendancePhotoLookupRow>();

    if (photoError) {
      return new Response("Không thể tải ảnh.", { status: 500 });
    }

    // Khong thay -> 404 voi CUNG mot thong diep nhu truong hop id khong ton
    // tai (T-03-01/T-03-02): khong ai phan biet duoc "id sai" voi "id dung
    // nhung cua doanh nghiep khac".
    if (!photo) {
      return new Response("Không tìm thấy.", { status: 404 });
    }

    // ATT-04: chi quan tri (owner/admin) xem lai anh cham cong.
    if (!canReadCompanyData(role)) throw new ForbiddenError();

    // Dong ton tai nhung KHONG co tep anh (lan cham trong nguong cho phep,
    // migration 0032). Tra 404 voi CUNG thong diep nhu tren: route nay chi
    // phat byte anh, va o day khong co byte nao ca. Man hinh quan tri khong
    // dua vao 404 nay de biet dieu do — no doc `hasPhoto` tu sieu du lieu va
    // khong hoi anh ngay tu dau; nhanh nay la lop chan cho lien ket dan tay.
    if (!photo.storage_path) {
      return new Response("Không tìm thấy.", { status: 404 });
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(ATTENDANCE_PHOTO_BUCKET)
      .download(photo.storage_path);
    if (downloadError || !blob) {
      return new Response("Không tải được ảnh.", { status: 502 });
    }

    return new Response(blob, {
      headers: {
        "content-type": blob.type || "image/jpeg",
        // private + no-store: khong cho trinh duyet/CDN nao cache lai byte
        // anh — moi lan xem deu phai di qua lai buoc kiem company_id o tren.
        "cache-control": "private, no-store",
      },
    });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return new Response(cause.message, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return new Response(cause.message, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      return new Response("Không tìm thấy.", { status: 404 });
    }
    console.error("Lỗi không xác định ở GET /api/attendance-photos/[id]:", cause);
    return new Response("Không thể tải ảnh.", { status: 500 });
  }
}
