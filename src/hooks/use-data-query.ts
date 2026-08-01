"use client";

import * as React from "react";

import { useDataStore } from "@/lib/data/store";

export interface DataQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Hook doc du lieu tu tang doc (Route Handler qua `fetchJson`, hoac truc
 * tiep mot ham `@/lib/data/*`).
 *
 * - Tu chay lai khi `deps` doi hoac khi kho du lieu bi `invalidate()`.
 * - Bo qua ket qua cua request cu de tranh hien thi du lieu loi thoi
 *   khi nguoi dung go tim kiem lien tuc.
 *
 * DOI TEN tu hook doc du lieu cua tang gia lap truoc day (da xoa o plan
 * 02-11) — CO CHE VA HINH DANG KET QUA GIU NGUYEN TUYET DOI (bon truong ket
 * qua, nhanh bat loi chuyen sang chuoi, co huy chong ket qua cu ghi de ket
 * qua moi, mang phu thuoc gom bo dem phien ban cung token tai lai thu cong),
 * chi ten va nguon du lieu doi (D-12, plan 02-11).
 */
export function useDataQuery<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
): DataQueryResult<T> {
  const { version } = useDataStore();
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
