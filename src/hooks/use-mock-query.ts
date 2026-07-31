"use client";

import * as React from "react";

import { useMockData } from "@/lib/mock/store";

export interface MockQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Hook doc du lieu tu lop service gia lap.
 *
 * - Tu chay lai khi `deps` doi hoac khi kho du lieu bi `invalidate()`.
 * - Bo qua ket qua cua request cu de tranh hien thi du lieu loi thoi
 *   khi nguoi dung go tim kiem lien tuc.
 */
export function useMockQuery<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
): MockQueryResult<T> {
  const { version } = useMockData();
  const [data, setData] = React.useState<T | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [manualToken, setManualToken] = React.useState(0);

  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Đã xảy ra lỗi không xác định.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, manualToken]);

  const reload = React.useCallback(() => {
    setManualToken((current) => current + 1);
  }, []);

  return { data, isLoading, error, reload };
}
