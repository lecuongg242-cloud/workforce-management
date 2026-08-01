"use client";

import * as React from "react";

/**
 * Kho dem phien ban dung chung cho toan bo ung dung — co che vo hieu hoa
 * cache cho tang doc du lieu.
 *
 * Provider khong giu ban sao du lieu; no chi giu mot so phien ban (`version`).
 * Moi khi co thao tac ghi (them / sua / xoa) ta goi `invalidate()`, cac hook
 * doc du lieu se tu goi lai tang doc de lay so lieu moi nhat — cach lam nay
 * giong voi `router.refresh()` hoac invalidate cache khi dung mot thu vien
 * fetching that.
 *
 * DOI TEN tu provider/hook cua tang gia lap truoc day (da xoa o plan 02-11)
 * — CO CHE GIU NGUYEN TUYET DOI (bo dem phien ban, `invalidate()`), chi ten
 * va vi tri thu muc doi de khong con mang chu tang gia lap sau khi tang du
 * lieu gia da bien mat (D-12, plan 02-11).
 */
interface DataStoreContextValue {
  version: number;
  invalidate: () => void;
}

const DataStoreContext = React.createContext<DataStoreContextValue | null>(
  null,
);

export function DataStoreProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [version, setVersion] = React.useState(0);

  const invalidate = React.useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  const value = React.useMemo(
    () => ({ version, invalidate }),
    [version, invalidate],
  );

  return (
    <DataStoreContext.Provider value={value}>
      {children}
    </DataStoreContext.Provider>
  );
}

export function useDataStore(): DataStoreContextValue {
  const context = React.useContext(DataStoreContext);
  if (!context) {
    throw new Error("useDataStore phải được dùng bên trong DataStoreProvider.");
  }
  return context;
}
