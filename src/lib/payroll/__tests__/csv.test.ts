import { describe, expect, it } from "vitest";

import {
  buildPayrollCsv,
  escapeCsvCell,
  payrollCsvFileName,
} from "@/lib/payroll/csv";
import type { PayrollPrep, PayrollPrepRow } from "@/lib/types/domain";

/**
 * Tep CSV nay duoc mo bang Excel tren may ke toan Viet Nam, khong phai bang
 * mot trinh doc CSV chuan — nen ba bai kiem quan trong nhat cua file la ba
 * quyet dinh dinh dang: dau cham phay, so thap phan dau phay, va o "thieu he
 * so" KHONG duoc thanh so 0.
 */

function row(overrides: Partial<PayrollPrepRow> = {}): PayrollPrepRow {
  return {
    employeeId: "nv-1",
    employeeCode: "NV001",
    employeeName: "Nguyễn Minh Anh",
    departmentName: "Phòng Kinh doanh",
    workedDays: 21,
    totalMinutes: 10_080, // 168 gio
    lateCount: 2,
    leaveDays: 1,
    overtimeMinutes: 510, // 8,5 gio
    overtimeNightMinutes: 0,
    convertedOvertimeHours: 12.75,
    missingMultiplierKeys: [],
    ...overrides,
  };
}

function prep(rows: PayrollPrepRow[]): PayrollPrep {
  return { month: "2026-07", periodStatus: "closed", rows };
}

describe("buildPayrollCsv — định dạng cho Excel vi-VN", () => {
  it("1. tách cột bằng dấu CHẤM PHẨY, không phải dấu phẩy", () => {
    const csv = buildPayrollCsv(prep([row()]));
    const [header, first] = csv.split("\r\n");

    expect(header.split(";").length).toBe(10);
    expect(first.split(";")[0]).toBe("NV001");
    expect(first.split(";")[1]).toBe("Nguyễn Minh Anh");
  });

  it("2. số thập phân dùng dấu PHẨY (8,5) — Excel vi-VN đọc '8.5' thành chuỗi", () => {
    const csv = buildPayrollCsv(prep([row()]));
    const cells = csv.split("\r\n")[1].split(";");

    // 10 080 phut = 168 gio (tron), 510 phut = 8,5 gio.
    expect(cells[4]).toBe("168");
    expect(cells[5]).toBe("8,5");
    expect(cells[7]).toBe("12,75");
    expect(csv).not.toContain("8.5");
  });

  it("3. thiếu hệ số xuất thành CHỮ, không thành số 0 (D-26)", () => {
    const csv = buildPayrollCsv(
      prep([row({ convertedOvertimeHours: null, missingMultiplierKeys: ["holiday"] })]),
    );
    const cells = csv.split("\r\n")[1].split(";");

    expect(cells[7]).toBe("chưa khai hệ số");
    // Mot o `0` trong tep gui cho ke toan la mot lo lang khong ai doc ra.
    expect(cells[7]).not.toBe("0");
  });

  it("4. giữ nguyên số dòng: một dòng tiêu đề + một dòng mỗi nhân viên", () => {
    const csv = buildPayrollCsv(
      prep([row(), row({ employeeId: "nv-2", employeeCode: "NV002" })]),
    );

    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("5. danh sách rỗng vẫn ra tiêu đề, không ra tệp rỗng", () => {
    const csv = buildPayrollCsv(prep([]));

    expect(csv.split("\r\n")).toHaveLength(1);
    expect(csv).toContain("Mã nhân viên");
  });

  it("6. phòng ban null -> ô trống, không ra chữ 'null'", () => {
    const csv = buildPayrollCsv(prep([row({ departmentName: null })]));
    const cells = csv.split("\r\n")[1].split(";");

    expect(cells[2]).toBe("");
  });
});

describe("escapeCsvCell — ô chứa ký tự phá cấu trúc tệp", () => {
  it("7. ô chứa dấu chấm phẩy bị bọc trong nháy kép (tên phòng ban có ';' là chuyện có thật)", () => {
    expect(escapeCsvCell("Kinh doanh; Marketing")).toBe('"Kinh doanh; Marketing"');
  });

  it("8. dấu nháy kép trong ô được nhân đôi", () => {
    expect(escapeCsvCell('Phòng "Đặc biệt"')).toBe('"Phòng ""Đặc biệt"""');
  });

  it("9. xuống dòng trong ô được bọc", () => {
    expect(escapeCsvCell("Dòng 1\nDòng 2")).toBe('"Dòng 1\nDòng 2"');
  });

  it("10. ô bình thường KHÔNG bị bọc thừa", () => {
    expect(escapeCsvCell("Phòng Kinh doanh")).toBe("Phòng Kinh doanh");
  });
});

describe("payrollCsvFileName", () => {
  it("11. tên tệp mang tháng, để tải nhiều tháng không đè lên nhau", () => {
    expect(payrollCsvFileName("2026-07")).toBe("bang-cong-2026-07.csv");
  });
});
