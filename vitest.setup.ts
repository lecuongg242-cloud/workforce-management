import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Don DOM sau moi test component de tranh ro giua cac case. Plan nay khong
 * cai @testing-library/jest-dom, nen setup chi gioi han o cleanup().
 */
afterEach(() => {
  cleanup();
});
