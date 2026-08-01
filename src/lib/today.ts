import { DEFAULT_TIMEZONE } from "@/lib/constants";

/**
 * Nguon DUY NHAT cua khai niem "hom nay" trong toan bo ung dung (D-19). Module
 * nay CHI CHAY PHIA SERVER — Server Component (`page.tsx`) goi cac ham o day
 * roi truyen ket qua xuong client component lam PROP. Khong client component
 * nao duoc phep tu tinh lai gia tri nay (vi du bang `new Date()`), vi lam
 * vay se lech giua lan ve dau tien o server va lan ve lai o trinh duyet
 * (hydration mismatch) — day chinh la ly do V1 phai dong bang `REFERENCE_DATE`
 * (xem `src/lib/constants.ts`) thay vi doc dong ho that.
 *
 * Dung `Intl.DateTimeFormat` voi locale "en-CA" (dinh dang mac dinh la
 * "YYYY-MM-DD") va `timeZone` lay tu `DEFAULT_TIMEZONE` (cung hang so mui gio
 * voi `public.tf_tz()` cua database) — KHONG viet mot phep cong offset +7
 * thu cong, vi do la mot quy uoc mui gio THU HAI va se som lech voi
 * `tf_tz()` mot ngay nao do.
 */

const todayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DEFAULT_TIMEZONE,
});

/**
 * Tra ve "hom nay" dang "YYYY-MM-DD" theo gio Viet Nam — bang dung ket qua
 * cua `public.tf_work_date(now())` tren database, ke ca khi bien moi truong
 * mui gio cua tien trinh Node la mot gia tri khac (vi du "UTC"), vi
 * `Intl.DateTimeFormat` o day nhan `timeZone` TUONG MINH, khong phu thuoc
 * `process.env.TZ`.
 *
 * `async` du khong can `await`: ham nay duoc goi tu Server Component va giu
 * chu ky bat dong bo de sau nay doi sang mot nguon can I/O (vi du doc thang
 * tf_server_now() tu database) ma khong phai sua noi goi.
 */
export async function getServerToday(): Promise<string> {
  return todayFormatter.format(new Date());
}

/** Tra ve "hom nay" cat con "YYYY-MM" — thang cua `getServerToday()`. */
export async function getServerMonth(): Promise<string> {
  const today = await getServerToday();
  return today.slice(0, 7);
}
