"use client";

import * as React from "react";

/**
 * Theo doi mot media query.
 *
 * Luon tra ve `false` o lan render dau tien tren may chu de markup cua server
 * va client giong nhau (tranh loi hydration), sau do cap nhat trong effect.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const update = (): void => setMatches(mediaQueryList.matches);

    update();
    mediaQueryList.addEventListener("change", update);
    return () => mediaQueryList.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** Man hinh nho hon 768px — nguong chuyen bang sang danh sach the */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/** Man hinh nho hon 1024px — nguong thu gon sidebar quan tri thanh drawer */
export function useIsCompact(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}
