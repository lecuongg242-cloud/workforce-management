/**
 * Ham thuan phan tich source cua mot Route Handler: tra ve tap ten ham va
 * ten hang duoc `export`. Dung boi cong D-12c
 * (`src/__tests__/route-handlers-get-only.test.ts`) va tu no cung duoc
 * kiem chung "co rang" ngay trong test do (goi tren mot chuoi nguon gia
 * lap co tinh vi pham, khang dinh ham nay PHAT HIEN duoc).
 */
export interface RouteHandlerAnalysis {
  exportedFunctions: string[];
  exportedConsts: string[];
}

const EXPORTED_FUNCTION_PATTERN =
  /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
const EXPORTED_CONST_PATTERN = /export\s+const\s+([A-Za-z_$][\w$]*)/g;

export function analyzeRouteHandlerSource(
  source: string,
): RouteHandlerAnalysis {
  const exportedFunctions: string[] = [];
  const exportedConsts: string[] = [];

  for (const match of source.matchAll(EXPORTED_FUNCTION_PATTERN)) {
    exportedFunctions.push(match[1]);
  }
  for (const match of source.matchAll(EXPORTED_CONST_PATTERN)) {
    exportedConsts.push(match[1]);
  }

  return { exportedFunctions, exportedConsts };
}
