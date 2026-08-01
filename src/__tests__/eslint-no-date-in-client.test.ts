import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/**
 * Chung minh rule `timeflow/no-date-in-client` (D-19a, eslint-rules/no-date-in-client.mjs)
 * CO RANG — no bao loi tren mot fixture co chu dich vi pham, khong bao loi
 * tren fixture doi chung (cung noi dung, khong co chi thi "use client"), va
 * khong bao nham tren mot client component that dang dung dung prop server-cap.
 *
 * Dung API Node cua ESLint voi CHINH `eslint.config.mjs` cua du an (khong
 * viet lai config rieng cho test), va `ignore: false` de vuot qua
 * `eslint-rules/__fixtures__/**` trong `ignores` cua config (fixture vi pham
 * bi ignore khoi `npm run lint` co chu dich, nhung van phai lint duoc rieng
 * khi test truc tiep goi ten no).
 */

const RULE_ID = "timeflow/no-date-in-client";

async function lintFile(filePath: string) {
  const eslint = new ESLint({
    overrideConfigFile: "eslint.config.mjs",
    ignore: false,
  });
  const results = await eslint.lintFiles([filePath]);
  return results.flatMap((result) => result.messages);
}

describe("timeflow/no-date-in-client (D-19a)", () => {
  it("bat vi pham that tren fixture co chi thi 'use client'", async () => {
    const messages = await lintFile(
      "eslint-rules/__fixtures__/violating-client.tsx",
    );
    const ruleMessages = messages.filter((m) => m.ruleId === RULE_ID);

    expect(ruleMessages.length).toBeGreaterThan(0);
  });

  it("khong bao loi nao mang ma rule tren fixture doi chung (cung noi dung, khong co chi thi client)", async () => {
    const messages = await lintFile("eslint-rules/__fixtures__/clean-server.tsx");
    const ruleMessages = messages.filter((m) => m.ruleId === RULE_ID);

    expect(ruleMessages.length).toBe(0);
  });

  it("khong bao nham tren mot client component that dang dung dung prop server-cap (chong bao nham)", async () => {
    const messages = await lintFile(
      "src/app/admin/dashboard/dashboard-view.tsx",
    );
    const ruleMessages = messages.filter((m) => m.ruleId === RULE_ID);

    expect(ruleMessages.length).toBe(0);
  });
});
