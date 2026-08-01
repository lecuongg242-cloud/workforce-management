/**
 * Fixture DOI CHUNG cua `violating-client.tsx` — CUNG NOI DUNG ben trong
 * (`new Date()` khong tham so, `Date.now()`) nhung KHONG co chi thi
 * "use client" o dau file. Dung boi
 * `src/__tests__/eslint-no-date-in-client.test.ts` de chung minh rule
 * `timeflow/no-date-in-client` do vi NOI DUNG file (chi thi client), khong
 * phai vi mot ly do nao khac.
 */
import * as React from "react";

export function CleanClock(): React.ReactElement {
  const [now] = React.useState(new Date());
  const stamp = Date.now();
  return (
    <p>
      {now.toISOString()} / {stamp}
    </p>
  );
}
