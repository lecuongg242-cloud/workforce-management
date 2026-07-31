"use client";

import * as React from "react";

import { REFERENCE_DATE, STORAGE_KEY_SESSION } from "@/lib/constants";
import { seedCompanies, seedUser } from "@/lib/mock/seed";
import type { AppUser, CompanyRole, UserSession } from "@/lib/types/domain";

/**
 * Phien dang nhap gia lap.
 *
 * Giai doan nay chua noi Supabase Auth: phien duoc luu trong localStorage de
 * mo phong dung luong (dang nhap -> chon doanh nghiep -> vao trang quan tri).
 * Khi thay bang Supabase, chi can doi `signIn` / `signOut` va cach doc phien;
 * toan bo component su dung `useSession()` khong phai sua.
 */

export type SessionStatus = "loading" | "authenticated" | "guest";

interface SessionContextValue {
  status: SessionStatus;
  session: UserSession | null;
  signIn: (email: string) => Promise<UserSession>;
  selectCompany: (companyId: string, role: CompanyRole) => void;
  signOut: () => void;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

function readStoredSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserSession;
    if (!parsed.user?.id || !parsed.companyId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: UserSession | null): void {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(STORAGE_KEY_SESSION);
  }
}

export function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [status, setStatus] = React.useState<SessionStatus>("loading");
  const [session, setSession] = React.useState<UserSession | null>(null);

  // Doc phien sau khi da gan vao DOM — localStorage khong ton tai tren server
  React.useEffect(() => {
    const stored = readStoredSession();
    setSession(stored);
    setStatus(stored ? "authenticated" : "guest");
  }, []);

  const signIn = React.useCallback(async (email: string) => {
    // Gia lap thoi gian goi mang
    await new Promise((resolve) => setTimeout(resolve, 700));

    const user: AppUser = { ...seedUser, email: email || seedUser.email };
    const defaultCompany = seedCompanies[0];
    const next: UserSession = {
      user,
      companyId: defaultCompany.id,
      role: defaultCompany.role,
      signedInAt: `${REFERENCE_DATE}T08:00:00+07:00`,
    };

    writeStoredSession(next);
    setSession(next);
    setStatus("authenticated");
    return next;
  }, []);

  const selectCompany = React.useCallback(
    (companyId: string, role: CompanyRole) => {
      setSession((current) => {
        const base: UserSession = current ?? {
          user: seedUser,
          companyId,
          role,
          signedInAt: `${REFERENCE_DATE}T08:00:00+07:00`,
        };
        const next: UserSession = { ...base, companyId, role };
        writeStoredSession(next);
        return next;
      });
      setStatus("authenticated");
    },
    [],
  );

  const signOut = React.useCallback(() => {
    writeStoredSession(null);
    setSession(null);
    setStatus("guest");
  }, []);

  const value = React.useMemo<SessionContextValue>(
    () => ({ status, session, signIn, selectCompany, signOut }),
    [status, session, signIn, selectCompany, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error("useSession phải được dùng bên trong SessionProvider.");
  }
  return context;
}

/**
 * Phien da chac chan ton tai — dung ben trong cac layout da co route guard
 * de khong phai kiem tra null o moi component con.
 */
export function useAuthenticatedSession(): UserSession {
  const { session } = useSession();
  if (!session) {
    throw new Error(
      "useAuthenticatedSession chỉ được dùng trong khu vực đã đăng nhập.",
    );
  }
  return session;
}
