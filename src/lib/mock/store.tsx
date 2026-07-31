"use client";

import * as React from "react";

/**
 * Kho du lieu gia lap dung chung cho toan bo ung dung.
 *
 * Provider khong giu ban sao du lieu; no chi giu mot so phien ban (`version`).
 * Moi khi co thao tac ghi (them / sua / xoa) ta goi `invalidate()`, cac hook
 * doc du lieu se tu goi lai `service` de lay so lieu moi nhat — cach lam nay
 * giong voi `router.refresh()` hoac invalidate cache khi dung Supabase that.
 */
interface MockDataContextValue {
  version: number;
  invalidate: () => void;
}

const MockDataContext = React.createContext<MockDataContextValue | null>(null);

export function MockDataProvider({
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
    <MockDataContext.Provider value={value}>{children}</MockDataContext.Provider>
  );
}

export function useMockData(): MockDataContextValue {
  const context = React.useContext(MockDataContext);
  if (!context) {
    throw new Error("useMockData phải được dùng bên trong MockDataProvider.");
  }
  return context;
}
