import { describe, expect, it } from "vitest";

import {
  CONFUSABLE_CHARACTERS,
  generateReadablePassword,
} from "@/lib/auth/generate-password";

/**
 * Ham nay ton tai de quan tri DOC mat khau qua dien thoai cho cong nhan xuong.
 * Neu chuoi sinh ra kho doc thi khong ai bam nut do, va moi nguoi se quay ve go
 * tay mot mat khau yeu dung chung ca xuong — dung dieu ma spec 2026-09-06 dang
 * co giam bot. Nen "khong chua ky tu de nham" la mot yeu cau that, khong phai
 * mot chi tiet tham my.
 */

const SAMPLE_SIZE = 500;

describe("generateReadablePassword", () => {
  it("Khong bao gio chua ky tu de nham — kiem qua nhieu lan sinh, khong phai mot", () => {
    // Mot lan sinh khong chung minh duoc gi: ky tu de nham co the chi xuat hien
    // o mot phan nghin lan goi. Lay mau du lon de khang dinh co nghia.
    for (let attempt = 0; attempt < SAMPLE_SIZE; attempt += 1) {
      const password = generateReadablePassword();
      for (const character of CONFUSABLE_CHARACTERS) {
        expect(password).not.toContain(character);
      }
    }
  });

  it("Hai lan goi cho hai ket qua khac nhau", () => {
    const results = new Set<string>();
    for (let attempt = 0; attempt < SAMPLE_SIZE; attempt += 1) {
      results.add(generateReadablePassword());
    }
    // Trung lap o co mau nay gan nhu chac chan la loi (khong goi RNG that,
    // hoac tra ve mot hang so).
    expect(results.size).toBe(SAMPLE_SIZE);
  });

  it("Dung dinh dang 3 nhom 4 ky tu, du dai de qua nguong 8 ky tu cua server", () => {
    const password = generateReadablePassword();

    expect(password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    // 14 ky tu ke ca hai dau gach — vuot nguong MIN_PASSWORD_LENGTH = 8 cua
    // Server Action, ke ca khi sau nay bo dau gach di.
    expect(password).toHaveLength(14);
    expect(password.replace(/-/g, "").length).toBeGreaterThanOrEqual(8);
  });
});
