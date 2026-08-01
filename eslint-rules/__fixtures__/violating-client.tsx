"use client";

/**
 * Fixture CO CHU DICH VI PHAM D-19a — dung boi
 * `src/__tests__/eslint-no-date-in-client.test.ts` va boi acceptance
 * criteria cua 02-11 Task 1 de chung minh rule `timeflow/no-date-in-client`
 * co rang. KHONG import file nay tu ma nguon that — no nam trong
 * `eslint.config.mjs` -> `ignores` de khong lam do vinh vien `npm run lint`.
 */
import * as React from "react";

export function ViolatingClock(): React.ReactElement {
  const [now] = React.useState(new Date());
  const stamp = Date.now();
  return (
    <p>
      {now.toISOString()} / {stamp}
    </p>
  );
}
