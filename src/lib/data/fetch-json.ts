import type { ZodTypeAny, z } from "zod";

/**
 * Goi mot Route Handler (GET) va parse ket qua bang schema Zod dung chung
 * (D-12d). Ninh giu hinh dang loi cua `useDataQuery` (`error: string | null`,
 * D-12e) — moi truong hop loi o day deu nem `Error` mang `message` tieng
 * Viet, khong bao gio de loi mang/HTTP tho lot len view.
 */
export async function fetchJson<S extends ZodTypeAny>(
  path: string,
  schema: S,
): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new Error("Không thể kết nối tới máy chủ. Vui lòng thử lại.");
  }

  if (!response.ok) {
    let message: string | null = null;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // Than khong dung hinh dang JSON -- dung thong diep mac dinh ben duoi.
    }
    throw new Error(message ?? "Đã xảy ra lỗi không xác định.");
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new Error("Dữ liệu máy chủ trả về không đúng định dạng.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Dữ liệu máy chủ trả về không đúng định dạng.");
  }
  return parsed.data as z.infer<S>;
}
