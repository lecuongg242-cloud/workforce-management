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
    // D-36/D-39 (plan 05-2-02): che do mac dinh `shift` -> ngay cong tron.
    creditedDays: 21,
    regularMinutes: 9_570,
    hourDeltaMinutes: 0,
    missingWorkModeInputs: [],
    // Tep CSV KHONG co cot theo ngay — bo trong o day la dung, khong phai mot
    // fixture con thieu.
    days: [],
    // PAY-01 (plan 05-2-04) — phan tien. Bo so nay doi chieu duoc:
    // 10.500.000 + 796.875 + 0 + 730.000 − 100.000 = 11.926.875
    payUnit: "month" as const,
    payAmount: 13_000_000,
    basePay: 10_500_000,
    overtimePay: 796_875,
    hourAdjustment: 0,
    allowanceItems: [
      { adjustmentId: "adj-a", name: "Phụ cấp ăn trưa", amount: 730_000, multiplier: 1 },
    ],
    deductionItems: [
      { adjustmentId: "adj-b", name: "Phạt đi muộn", amount: 100_000, multiplier: 2 },
    ],
    allowanceTotal: 730_000,
    deductionTotal: 100_000,
    netPay: 11_926_875,
    missing: [],
    ...overrides,
  };
}

function prep(rows: PayrollPrepRow[]): PayrollPrep {
  return {
    month: "2026-07",
    periodStatus: "closed",
    workMode: "shift",
    payrollStatus: "open",
    payrollClosedAt: null,
    payrollClosedBy: null,
    rows,
  };
}

/**
 * Vi tri cot, viet ra thanh ten de mot lan them cot khong lam mot bai kiem im
 * lang kiem nham o ben canh.
 */
const COL = {
  code: 0,
  name: 1,
  department: 2,
  workedDays: 3,
  creditedDays: 4,
  totalHours: 5,
  overtimeHours: 6,
  overtimeNightHours: 7,
  leaveDays: 8,
  lateCount: 9,
  basePay: 10,
  overtimePay: 11,
  hourAdjustment: 12,
  allowance: 13,
  deduction: 14,
  netPay: 15,
} as const;

const COLUMN_COUNT = 16;

describe("buildPayrollCsv — định dạng cho Excel vi-VN", () => {
  it("1. tách cột bằng dấu CHẤM PHẨY, không phải dấu phẩy", () => {
    const csv = buildPayrollCsv(prep([row()]));
    const [header, first] = csv.split("\r\n");

    expect(header.split(";").length).toBe(COLUMN_COUNT);
    expect(first.split(";")[COL.code]).toBe("NV001");
    expect(first.split(";")[COL.name]).toBe("Nguyễn Minh Anh");
  });

  it("2. số thập phân dùng dấu PHẨY (8,5) — Excel vi-VN đọc '8.5' thành chuỗi", () => {
    const csv = buildPayrollCsv(prep([row()]));
    const cells = csv.split("\r\n")[1].split(";");

    // 10 080 phut = 168 gio (tron), 510 phut = 8,5 gio.
    expect(cells[COL.totalHours]).toBe("168");
    expect(cells[COL.overtimeHours]).toBe("8,5");
    expect(csv).not.toContain("8.5");
  });

  it("3. KHÔNG còn cột giờ quy đổi — số giờ tăng ca đi thẳng tới số tiền", () => {
    const csv = buildPayrollCsv(prep([row()]));
    const header = csv.split("\r\n")[0];

    expect(header).not.toContain("Giờ quy đổi");
    // Con so quy doi VAN duoc tinh va van la duong ra tien tang ca — no chi
    // khong con la mot cot ma nguoi nhan phai tu nhan tay.
    expect(csv).not.toContain("12,75");
    // Va D-26 khong mat theo cot do: xem bai 13.
    expect(header).toContain("Giờ tăng ca");
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

    expect(cells[COL.department]).toBe("");
  });
});

describe("Các cột TIỀN (PAY-01, plan 05-2-04)", () => {
  it("10. sáu cột tiền xuất đúng giá trị, theo đúng định dạng số của tệp", () => {
    const csv = buildPayrollCsv(prep([row()]));
    const cells = csv.split("\r\n")[1].split(";");

    expect(cells[COL.basePay]).toBe("10500000");
    expect(cells[COL.overtimePay]).toBe("796875");
    expect(cells[COL.hourAdjustment]).toBe("0");
    expect(cells[COL.allowance]).toBe("730000");
    expect(cells[COL.deduction]).toBe("100000");
    expect(cells[COL.netPay]).toBe("11926875");
  });

  it("11. cột thực nhận BẰNG ĐÚNG tổng các cột tiền còn lại — tệp đối chiếu được", () => {
    const csv = buildPayrollCsv(prep([row()]));
    const cells = csv.split("\r\n")[1].split(";");
    const value = (index: number) => Number(cells[index].replace(",", "."));

    expect(value(COL.netPay)).toBe(
      value(COL.basePay) +
        value(COL.overtimePay) +
        value(COL.hourAdjustment) +
        value(COL.allowance) -
        value(COL.deduction),
    );
  });

  it("12. CHƯA KHAI MỨC LƯƠNG -> ô tiền mang CHỮ nói thiếu gì, KHÔNG mang số 0", () => {
    const csv = buildPayrollCsv(
      prep([
        row({
          basePay: null,
          overtimePay: null,
          hourAdjustment: null,
          allowanceItems: [],
          deductionItems: [],
          allowanceTotal: null,
          deductionTotal: null,
          netPay: null,
          missing: ["pay_rate"],
        }),
      ]),
    );
    const cells = csv.split("\r\n")[1].split(";");

    expect(cells[COL.netPay]).toBe("chưa khai mức lương");
    expect(cells[COL.basePay]).toBe("chưa khai mức lương");
    // Mot o `0` o cot "Thuc nhan" doc nhu MOT SU THAT, va nguoi ky se ky.
    expect(cells[COL.netPay]).not.toBe("0");
  });

  it("13. thiếu hệ số tăng ca -> ô tiền nói ĐÚNG loại ngày còn thiếu", () => {
    const csv = buildPayrollCsv(
      prep([
        row({
          overtimePay: null,
          netPay: null,
          convertedOvertimeHours: null,
          missingMultiplierKeys: ["holiday"],
          missing: ["overtime_rule:holiday"],
        }),
      ]),
    );
    const cells = csv.split("\r\n")[1].split(";");

    expect(cells[COL.netPay]).toContain("chưa khai hệ số tăng ca");
    expect(cells[COL.netPay]).toContain("ngày lễ");
  });

  it("14. LỜI CẢNH BÁO về thuế và bảo hiểm nằm trong TÊN CỘT thực nhận", () => {
    const csv = buildPayrollCsv(prep([row()]));
    const header = csv.split("\r\n")[0];

    expect(header).toContain("Thực nhận");
    expect(header).toContain("CHƯA GỒM thuế TNCN và BHXH/BHYT/BHTN");
  });

  it("15. tệp vẫn là MỘT BẢNG SẠCH: đúng một dòng tiêu đề, rồi tới dữ liệu", () => {
    // Mot dong chu thich rieng o dau tep se lam dong tieu de khong con la dong
    // 1, va moi cong thuc tro theo dong o dau ben kia se lech.
    const csv = buildPayrollCsv(prep([row(), row({ employeeCode: "NV002" })]));
    const lines = csv.split("\r\n");

    expect(lines).toHaveLength(3);
    expect(lines[0].split(";")[COL.code]).toBe("Mã nhân viên");
    expect(lines[1].split(";")[COL.code]).toBe("NV001");
  });

  it("16. ngày công quy đổi `null` -> chữ, và nó là cột KHÁC với ngày công", () => {
    const csv = buildPayrollCsv(
      prep([
        row({
          creditedDays: null,
          missingWorkModeInputs: ["standard_hours_per_day"],
        }),
      ]),
    );
    const cells = csv.split("\r\n")[1].split(";");

    expect(cells[COL.workedDays]).toBe("21");
    expect(cells[COL.creditedDays]).toBe("chưa khai số giờ chuẩn");
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
