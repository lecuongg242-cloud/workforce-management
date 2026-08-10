import { describe, expect, it } from "vitest";

import { dashboardSummarySchema } from "@/lib/validation/api/dashboard";

/**
 * Hoi quy cho mot loi CO SAN, phat hien khi nghiem thu Phase 6 tren trinh
 * duyet: `GET /api/dashboard` tra 500 cho ca doanh nghiep chi vi MOT nhan
 * vien khong co so dien thoai.
 *
 * Goc re: migration `0028_optional_employee_fields.sql` cho sau cot cua
 * `employees` thanh nullable (phone, date_of_birth, gender, department_id,
 * position, contract_type). Duong doc nhan vien
 * (`src/lib/validation/api/employees.ts`) da duoc quet theo — ca sau truong
 * deu `.nullable()`. Duong doc BANG DIEU KHIEN thi bi bo sot.
 *
 * Vi sao TypeScript khong chan duoc: `RawEmployeeRow` trong
 * `src/app/api/dashboard/route.ts` KHAI `phone: string`, mot loi khai sai so
 * voi database. Du lieu tu Supabase duoc ep kieu theo interface do, nen
 * `null` di lot toi tan `dashboardSummarySchema.parse()` roi moi no — o
 * runtime, tren production, thay vi o lan biên dich.
 */

function summaryWith(phone: string | null): unknown {
  const kpi = { value: 0, delta: 0 };
  return {
    date: "2026-08-10",
    totalEmployees: kpi,
    checkedIn: kpi,
    late: kpi,
    onLeave: kpi,
    chart: [],
    todayActivity: [],
    pendingRequests: [],
    notCheckedIn: [
      {
        employeeId: "nv-23",
        employeeName: "Nhân viên chưa khai số điện thoại",
        departmentName: "Sản xuất",
        avatarUrl: null,
        phone,
        shiftName: "Ca hành chính",
      },
    ],
  };
}

describe("dashboardSummarySchema — sáu cột nullable của 0028", () => {
  it("nhận `phone: null` — một người chưa khai số điện thoại không được làm hỏng cả bảng điều khiển", () => {
    expect(() => dashboardSummarySchema.parse(summaryWith(null))).not.toThrow();
  });

  it("vẫn nhận `phone` là chuỗi bình thường", () => {
    const parsed = dashboardSummarySchema.parse(summaryWith("0901234567"));
    expect(parsed.notCheckedIn[0].phone).toBe("0901234567");
  });
});
