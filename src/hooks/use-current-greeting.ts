"use client";

import * as React from "react";

import { greetingByHour } from "@/lib/format";

/**
 * Loi chao doc theo GIO THIET BI cua nguoi dung — CHI tinh SAU KHI component
 * gan vao DOM (`useEffect`), khong bao gio o lan render dau, de markup server
 * va trinh duyet khong lech nhau (tranh loi hydration).
 *
 * Day la mot GIA TRI TRANG TRI (loi chao "Chào buổi sáng/trưa/chiều/tối"),
 * KHAC voi "hom nay" (D-19, xem `src/lib/today.ts`): no khong anh huong den
 * tinh dung dan cua du lieu tren man hinh, chi la van ban hien thi doi theo
 * gio dia phuong cua nguoi xem. Tach thanh hook rieng de dong ho thiet bi
 * (`new Date()`) khong con nam trong cac view da chuyen sang nhan "hom nay"
 * qua prop tu Server Component (D-19a).
 */
export function useCurrentGreeting(): string {
  const [greeting, setGreeting] = React.useState("Chào buổi sáng");

  React.useEffect(() => {
    setGreeting(greetingByHour(new Date().getHours()));
  }, []);

  return greeting;
}
