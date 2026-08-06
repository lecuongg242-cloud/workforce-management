import { z } from "zod";

/**
 * Schema Zod cho thong bao trong ung dung (plan 05-04), theo dung khuon D-12d:
 * mot schema "row" transform snake_case -> camelCase NGAY SAU khi doc DB, va
 * mot schema "plain" dung o CA HAI dau cho hop dong JSON.
 *
 * `readAt` la mot DAU THOI GIAN nullable, khong phai boolean: "da doc luc nao"
 * la thu duy nhat tra loi duoc cau hoi nguoi nhan co kip biet truoc khi so
 * lieu ky bi chot hay khong.
 */

export const notificationKindSchema = z.enum(["request_reviewed"]);

export const notificationRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    user_id: z.string(),
    kind: notificationKindSchema,
    title: z.string(),
    body: z.string(),
    request_id: z.string().nullable(),
    read_at: z.string().nullable(),
    created_at: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    requestId: row.request_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));

export const notificationPlainSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  userId: z.string(),
  kind: notificationKindSchema,
  title: z.string(),
  body: z.string(),
  requestId: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

/**
 * Hop dong cua `GET /api/notifications`. So chua doc di KEM danh sach thay vi
 * mot duong doc thu hai: chuong va danh sach phai noi cung mot con so, va hai
 * lan goi rieng se lech nhau ngay khi co mot thong bao moi den giua chung.
 */
export const notificationFeedSchema = z.object({
  items: z.array(notificationPlainSchema),
  unreadCount: z.number().int(),
});
