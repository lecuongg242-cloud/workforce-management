"use client";

import * as React from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/lib/auth/session-provider";
import { MockDataProvider } from "@/lib/mock/store";
import type { UserSession } from "@/lib/types/domain";

export function AppProviders({
  initialSession,
  children,
}: {
  initialSession: UserSession | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <SessionProvider initialSession={initialSession}>
      <MockDataProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </TooltipProvider>
      </MockDataProvider>
    </SessionProvider>
  );
}
