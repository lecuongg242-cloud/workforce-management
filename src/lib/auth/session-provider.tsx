"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { selectCompanyAction } from "@/lib/data/mutations/companies";
import { signOutAction } from "@/lib/data/mutations/session";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { UserSession } from "@/lib/types/domain";

/**
 * Phien dang nhap that qua Supabase Auth.
 *
 * Phien nam o cookie do `@supabase/ssr` quan ly, khong con luu o kho luu tru
 * cua trinh duyet.
 * `SessionProvider` khong tu doc phien nua -- no nhan `initialSession` (da
 * duoc `src/app/layout.tsx` dung o server bang `getClientSession()`) lam
 * prop va khoi tao state ngay lap tuc, khong con `useEffect` doc kho luu
 * tru trinh duyet nen cung khong con trang thai "loading" nhap nhay o lan
 * ve dau. Giu "loading" trong union kieu de khong pha call site nao dang so
 * sanh voi no.
 */

export type SessionStatus = "loading" | "authenticated" | "guest";

interface SessionContextValue {
  status: SessionStatus;
  session: UserSession | null;
  signIn: (email: string, password: string) => Promise<void>;
  selectCompany: (companyId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({
  initialSession,
  children,
}: {
  initialSession: UserSession | null;
  children: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const [session, setSession] = React.useState<UserSession | null>(
    initialSession,
  );
  const [status, setStatus] = React.useState<SessionStatus>(
    initialSession ? "authenticated" : "guest",
  );

  // Khi server dung lai `initialSession` (sau router.refresh()), dong bo lai
  // state cuc bo — Component nay khong tu doc phien nua.
  React.useEffect(() => {
    setSession(initialSession);
    setStatus(initialSession ? "authenticated" : "guest");
  }, [initialSession]);

  const signIn = React.useCallback(
    async (email: string, password: string): Promise<void> => {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        throw new Error("Email hoặc mật khẩu không đúng. Vui lòng thử lại.");
      }
      router.refresh();
    },
    [router],
  );

  const selectCompany = React.useCallback(
    async (companyId: string): Promise<void> => {
      await selectCompanyAction(companyId);
      router.refresh();
    },
    [router],
  );

  const signOut = React.useCallback(async (): Promise<void> => {
    await signOutAction();
    router.replace("/login");
    router.refresh();
  }, [router]);

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
