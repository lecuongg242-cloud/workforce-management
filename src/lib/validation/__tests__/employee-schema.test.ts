import { describe, expect, it } from "vitest";

import { UNSET, employeeSchema } from "@/lib/validation/schemas";

/**
 * TIEN TANG CA BAT BUOC — nhung CHI o ca linh hoat, va CHI luc tao moi.
 *
 * Ba dieu kien nay giao nhau, va chinh cho giao nhau la cho de sai: mot o bat
 * buoc o mot che do ma no khong hien tren man hinh se khoa bieu mau ma khong
 * chi duoc cho nao dang thieu. Nhom test nay khoa ca bon to hop lai.
 *
 * `payRateRequired` la co "dang o che do TAO MOI" (xem chu thich cua chinh
 * truong do trong `employeeSchema`), khong phai mot cong tac rieng cua muc
 * luong.
 */

type FormValues = Record<string, unknown>;

/** Ho so hop le o che do TAO MOI, ca CO GIO CU THE. Cac test boi tu day. */
function baseCreate(overrides: FormValues = {}): FormValues {
  return {
    fullName: "Nguyễn Văn A",
    code: "NV100",
    email: "nv100@timeflow.test",
    phone: "",
    dateOfBirth: "",
    gender: UNSET,
    avatarUrl: null,
    departmentId: "dept-01",
    position: "",
    contractType: UNSET,
    startDate: "2026-08-10",
    managerId: null,
    shiftMode: "shift",
    shiftId: "sft-01",
    dailyHours: null,
    shiftWorkingDays: [1, 2, 3, 4, 5],
    workLocation: "Văn phòng chính",
    status: "pending_invite",
    systemRole: "employee",
    invitationSent: true,
    canViewPayslip: true,
    canCheckInRemotely: false,
    payRateRequired: true,
    payRateUnit: "month",
    payRateAmount: 10_000_000,
    payRateEffectiveFrom: "2026-08-10",
    overtimeRateValueType: "fixed_hourly",
    overtimeRateValue: null,
    ...overrides,
  };
}

/** Cung ho so nhung o ca LINH HOAT — nhanh duy nhat bat buoc tien tang ca. */
function baseHours(overrides: FormValues = {}): FormValues {
  return baseCreate({
    shiftMode: "hours",
    dailyHours: 10,
    ...overrides,
  });
}

/** Cac thong diep loi gan vao dung o `overtimeRateValue`. */
function overtimeErrors(values: FormValues): string[] {
  const result = employeeSchema.safeParse(values);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path.join(".") === "overtimeRateValue")
    .map((issue) => issue.message);
}

describe("employeeSchema — tiền tăng ca ở ca linh hoạt", () => {
  it("1. ca linh hoạt + để trống tiền tăng ca -> lỗi, gắn đúng ô", () => {
    expect(overtimeErrors(baseHours({ overtimeRateValue: null }))).toEqual([
      "Vui lòng nhập tiền tăng ca.",
    ]);
  });

  it("2. ca linh hoạt + có tiền tăng ca -> hợp lệ", () => {
    expect(
      employeeSchema.safeParse(baseHours({ overtimeRateValue: 60_000 })).success,
    ).toBe(true);
  });

  it("3. ca CÓ GIỜ CỤ THỂ + để trống -> HỢP LỆ (hai ô đó không hiện trên màn hình)", () => {
    const result = employeeSchema.safeParse(
      baseCreate({ overtimeRateValue: null }),
    );
    expect(result.success).toBe(true);
  });

  it("4. chế độ SỬA (payRateRequired=false) + ca linh hoạt + để trống -> hợp lệ", () => {
    // Doi tien tang ca o che do sua la mot PHIEN BAN MOI khai o tab "Thông tin
    // lương" (append-only), khong phai mot o cua bieu mau nay.
    const result = employeeSchema.safeParse(
      baseHours({
        payRateRequired: false,
        payRateAmount: null,
        overtimeRateValue: null,
      }),
    );
    expect(result.success).toBe(true);
  });

  it("5. giá trị bằng 0 hoặc âm -> lỗi riêng, không phải lỗi 'để trống'", () => {
    expect(overtimeErrors(baseHours({ overtimeRateValue: 0 }))).toEqual([
      "Tiền tăng ca phải lớn hơn 0.",
    ]);
    expect(overtimeErrors(baseHours({ overtimeRateValue: -5 }))).toEqual([
      "Tiền tăng ca phải lớn hơn 0.",
    ]);
  });
});

/**
 * Hai bien tren duoi day phai KHOP DUNG `employeeOvertimeRateInputSchema` phia
 * server. Lech nhau thi mot con so lot qua bieu mau roi bi server tu choi SAU
 * KHI ho so da duoc tao — nguoi dung nhan mot loi ve mot ho so da ton tai.
 */
describe("employeeSchema — hai biên trên, khớp với ràng buộc phía server", () => {
  it("6. hệ số > 10 -> lỗi; đúng 10 -> hợp lệ (biên)", () => {
    expect(
      overtimeErrors(
        baseHours({ overtimeRateValueType: "multiplier", overtimeRateValue: 10.1 }),
      ),
    ).toEqual(["Hệ số tăng ca không vượt quá 10 lần đơn giá giờ."]);
    expect(
      overtimeErrors(
        baseHours({ overtimeRateValueType: "multiplier", overtimeRateValue: 10 }),
      ),
    ).toEqual([]);
  });

  it("7. số tiền > 10 triệu -> lỗi; đúng 10 triệu -> hợp lệ (biên)", () => {
    expect(
      overtimeErrors(
        baseHours({
          overtimeRateValueType: "fixed_hourly",
          overtimeRateValue: 10_000_001,
        }),
      ),
    ).toEqual(["Số tiền một giờ tăng ca quá lớn."]);
    expect(
      overtimeErrors(
        baseHours({
          overtimeRateValueType: "fixed_hourly",
          overtimeRateValue: 10_000_000,
        }),
      ),
    ).toEqual([]);
  });

  it("8. hai biên KHÔNG lẫn sang nhau: hệ số 1,5 hợp lệ, số tiền 1,5 cũng hợp lệ", () => {
    // 1,5 la mot he so binh thuong; cung con so do doc nhu TIEN thi vo ly
    // nhung KHONG bi chan (1,5 dong/gio van la mot con so duong) — bien duoi
    // la viec cua nguoi khai, khong phai cua schema. Test nay khoa lai rang
    // hai nhanh kiem KHONG ap nham nguong cua nhau.
    expect(
      overtimeErrors(
        baseHours({ overtimeRateValueType: "multiplier", overtimeRateValue: 1.5 }),
      ),
    ).toEqual([]);
    expect(
      overtimeErrors(
        baseHours({ overtimeRateValueType: "fixed_hourly", overtimeRateValue: 1.5 }),
      ),
    ).toEqual([]);
  });
});
