import { describe, expect, it } from "vitest";

import { pickedDateToIso, toIsoDate } from "@/lib/format";

/**
 * Ngay nguoi dung bam tren lich phai ra DUNG o lich do, o moi mui gio.
 *
 * LOI THAT DA XAY RA: bo loc khoang ngay goi thang `toIsoDate()` len gia tri
 * ma `react-day-picker` tra ve. Bo lich tra nua dem theo GIO MAY, con
 * `toIsoDate()` doc cac truong UTC — o UTC+7, nua dem 09/08 la
 * `2026-08-08T17:00Z`, nen bam mung 9 thi he thong nhan mung 8.
 *
 * Bo kiem nay chay theo mui gio cua may dang chay. O mui gio DUONG (Viet Nam)
 * no bat duoc loi ngay; o UTC no chi la mot phep khang dinh hien nhien. Do la
 * danh doi chap nhan duoc: may cua nguoi lam du an nay deu o UTC+7, va do cung
 * la noi loi se tai xuat hien.
 */
describe("pickedDateToIso — ngày bấm trên lịch không được lệch một ngày", () => {
  it("1. giữ đúng ô lịch người dùng bấm, không lùi một ngày", () => {
    // Nua dem 09/08/2026 theo GIO MAY — dung thu ma bo lich tra ve.
    expect(pickedDateToIso(new Date(2026, 7, 9))).toBe("2026-08-09");
  });

  it("2. đúng ở cả biên tháng — mùng 1 không tụt về tháng trước", () => {
    expect(pickedDateToIso(new Date(2026, 7, 1))).toBe("2026-08-01");
    expect(pickedDateToIso(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("3. đúng ở ngày cuối tháng và cuối năm", () => {
    expect(pickedDateToIso(new Date(2026, 7, 31))).toBe("2026-08-31");
    expect(pickedDateToIso(new Date(2026, 11, 31))).toBe("2026-12-31");
    // Nam nhuan — 29/02 phai con nguyen la 29/02.
    expect(pickedDateToIso(new Date(2028, 1, 29))).toBe("2028-02-29");
  });

  it("4. KHÁC `toIsoDate` khi máy ở múi giờ dương — đó là lý do hàm này tồn tại", () => {
    const picked = new Date(2026, 7, 9);
    const lechPhut = picked.getTimezoneOffset(); // am o mui gio duong

    if (lechPhut < 0) {
      // Chinh la loi cu: doc thang truong UTC se ra mung 8.
      expect(toIsoDate(picked)).toBe("2026-08-08");
      expect(pickedDateToIso(picked)).not.toBe(toIsoDate(picked));
    } else {
      // O UTC va mui gio am, hai ham trung nhau — khong con gi de phan biet.
      expect(pickedDateToIso(picked)).toBe("2026-08-09");
    }
  });
});
