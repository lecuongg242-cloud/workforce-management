import { fetchJson } from "@/lib/data/fetch-json";
import { notificationFeedSchema } from "@/lib/validation/api/notifications";
import type { NotificationFeed } from "@/lib/types/domain";

export { markNotificationsRead } from "@/lib/data/mutations/notifications";

/**
 * Thong bao cua CHINH PHIEN kem so chua doc (APRV-05). Khong tham so nao khai
 * nguoi nhan — pham vi den tu `getSessionContext()` o phia server.
 */
export async function listNotifications(): Promise<NotificationFeed> {
  return fetchJson("/api/notifications", notificationFeedSchema);
}
