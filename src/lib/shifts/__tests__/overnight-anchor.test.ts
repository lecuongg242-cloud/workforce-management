import { describe, expect, it } from "vitest";

import { scheduledStartDayOffset } from "@/lib/shifts/overnight-anchor";

/**
 * Moc thoi gian viet duoi dang ISO co offset +07:00 — dung hinh dang ma
 * `tf_server_now()` va `tf_local_instant()` tra ve. Ham duoc kiem chi so hai
 * diem tuyet doi, nen offset viet the nao cung cho cung ket qua; giu +07:00
 * de doc ra dung gio Viet Nam.
 */
const WORK_DATE = "2026-08-11";

/** Ca dem 22:00-06:00: gio ket thuc dat tren chinh ngay cong. */
const NIGHT_END = `${WORK_DATE}T06:00:00+07:00`;

/** Ca hanh chinh 08:00-17:00. */
const DAY_END = `${WORK_DATE}T17:00:00+07:00`;

function punchAt(time: string): string {
  return `${WORK_DATE}T${time}+07:00`;
}

describe("scheduledStartDayOffset — ca qua đêm bắt đầu từ hôm qua hay hôm nay", () => {
  it("ca qua đêm, chấm TRƯỚC giờ kết thúc ca: mốc bắt đầu nằm ở HÔM QUA", () => {
    // Đây chính là ca gây lỗi: người vào lúc 00:09 cho ca 22:00 là muộn
    // 2 giờ 9 phút, chứ không phải sớm 21 giờ 51 phút cho ca tối nay.
    for (const time of ["00:00:00", "00:09:00", "03:30:00", "05:59:00"]) {
      expect(
        scheduledStartDayOffset({
          overnight: true,
          punchInstant: punchAt(time),
          shiftEndInstantOnWorkDate: NIGHT_END,
        }),
      ).toBe(-1);
    }
  });

  it("ca qua đêm, chấm SAU giờ kết thúc ca: mốc bắt đầu là HÔM NAY", () => {
    for (const time of ["06:00:00", "12:00:00", "21:55:00", "23:59:00"]) {
      expect(
        scheduledStartDayOffset({
          overnight: true,
          punchInstant: punchAt(time),
          shiftEndInstantOnWorkDate: NIGHT_END,
        }),
      ).toBe(0);
    }
  });

  it("ranh giới đúng ở GIỜ KẾT THÚC ca, không phải nửa đêm", () => {
    expect(
      scheduledStartDayOffset({
        overnight: true,
        punchInstant: punchAt("05:59:59"),
        shiftEndInstantOnWorkDate: NIGHT_END,
      }),
    ).toBe(-1);
    expect(
      scheduledStartDayOffset({
        overnight: true,
        punchInstant: punchAt("06:00:00"),
        shiftEndInstantOnWorkDate: NIGHT_END,
      }),
    ).toBe(0);
  });

  it("ca trong ngày không bao giờ lùi — kể cả chấm lúc rạng sáng", () => {
    for (const time of ["00:09:00", "07:59:00", "08:00:00", "23:00:00"]) {
      expect(
        scheduledStartDayOffset({
          overnight: false,
          punchInstant: punchAt(time),
          shiftEndInstantOnWorkDate: DAY_END,
        }),
      ).toBe(0);
    }
  });

  it("ca linh hoạt (không có giờ kết thúc) không bao giờ lùi", () => {
    expect(
      scheduledStartDayOffset({
        overnight: false,
        punchInstant: punchAt("00:09:00"),
        shiftEndInstantOnWorkDate: null,
      }),
    ).toBe(0);
    // Ke ca khi co doi bi danh dau overnight, thieu gio ket thuc thi khong
    // suy duoc gi.
    expect(
      scheduledStartDayOffset({
        overnight: true,
        punchInstant: punchAt("00:09:00"),
        shiftEndInstantOnWorkDate: null,
      }),
    ).toBe(0);
  });

  it("ca qua đêm sát nửa đêm (23:30–00:30) vẫn đúng", () => {
    const end = `${WORK_DATE}T00:30:00+07:00`;
    expect(
      scheduledStartDayOffset({
        overnight: true,
        punchInstant: punchAt("00:15:00"),
        shiftEndInstantOnWorkDate: end,
      }),
    ).toBe(-1);
    expect(
      scheduledStartDayOffset({
        overnight: true,
        punchInstant: punchAt("00:45:00"),
        shiftEndInstantOnWorkDate: end,
      }),
    ).toBe(0);
  });

  it("kết quả không phụ thuộc cách viết offset — chỉ so hai điểm tuyệt đối", () => {
    // Cung mot khoanh khac, viet bang UTC: 00:09 gio VN = 17:09 UTC hom truoc.
    expect(
      scheduledStartDayOffset({
        overnight: true,
        punchInstant: "2026-08-10T17:09:00Z",
        shiftEndInstantOnWorkDate: NIGHT_END,
      }),
    ).toBe(-1);
  });
});
