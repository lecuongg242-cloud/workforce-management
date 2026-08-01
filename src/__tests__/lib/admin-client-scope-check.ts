/**
 * Ham thuan phan tich mot chuoi nguon TypeScript/TSX: co import module
 * `@/lib/supabase/admin` hay khong, va co chi thi `"use server"` /
 * `"use client"` o dong dau file hay khong. Dung boi cong co hoc
 * `src/__tests__/admin-client-scope.test.ts` (T-02-10-01) — tach rieng ra
 * day de chinh cong co the tu chung minh "co rang" bang cach chay ham nay
 * tren mot chuoi nguon gia lap co tinh vi pham (xem test do).
 */
export interface AdminClientUsageAnalysis {
  importsAdminModule: boolean;
  hasUseServerDirective: boolean;
  hasUseClientDirective: boolean;
}

const ADMIN_IMPORT_PATTERN = /from\s+["']@\/lib\/supabase\/admin["']/;
const USE_SERVER_DIRECTIVE_PATTERN = /^["']use server["'];?\s*$/;
const USE_CLIENT_DIRECTIVE_PATTERN = /^["']use client["'];?\s*$/;

function firstNonEmptyLine(source: string): string {
  return (
    source
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ""
  );
}

export function analyzeAdminClientUsage(source: string): AdminClientUsageAnalysis {
  const topLine = firstNonEmptyLine(source);
  return {
    importsAdminModule: ADMIN_IMPORT_PATTERN.test(source),
    hasUseServerDirective: USE_SERVER_DIRECTIVE_PATTERN.test(topLine),
    hasUseClientDirective: USE_CLIENT_DIRECTIVE_PATTERN.test(topLine),
  };
}
