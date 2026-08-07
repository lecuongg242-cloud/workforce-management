import { z } from "zod";

import { timeToMinutes } from "@/lib/format";
import { MAX_SHIFT_HOURS, MIN_SHIFT_HOURS } from "@/lib/shifts/schedule";

/**
 * Toan bo schema kiem tra du lieu bieu mau.
 * Thong bao loi viet bang tieng Viet de hien thi truc tiep tren giao dien.
 */

const VIETNAM_PHONE = /^0\d{9,10}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const EMPLOYEE_CODE = /^[A-Za-z0-9._-]{2,20}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Moc "chua khai" cho cac o `Select` khong bat buoc (migration 0028).
 *
 * Radix `Select` KHONG nhan chuoi rong lam `value` — no coi do la "chua chon gi"
 * va quay ve hien placeholder, nen mot muc chon that mang value `""` khong bao
 * gio chon duoc. Vi vay phai la mot chuoi that; `__unset__` de khong dung ke ca
 * mot enum nghiep vu nao trong tuong lai.
 */
export const UNSET = "__unset__";

/** Khoang cach tu `from` toi `to` theo chieu kim dong ho, 0..1439 phut. */
function forwardMinutes(from: string, to: string): number {
  return (timeToMinutes(to) - timeToMinutes(from) + 1440) % 1440;
}

/**
 * Kiem tra khung gio nghi cua mot ca (migration 0025) — dung chung cho bieu
 * mau tao ca va buoc khai ca o onboarding.
 *
 * Ba dieu kien, va ca ba deu la de con so cong khong the sai trong im lang:
 *   1. Hai moc di CUNG NHAU — mot khung gio thieu mot dau khong tru duoc gi.
 *   2. Hai moc khong trung nhau — khoang nghi dai 0 phut la mot cach viet
 *      long vong cua "khong nghi".
 *   3. Khung nghi phai NAM TRONG ca. Nghi 12:00-13:00 cho ca 18:00-02:00 la
 *      mot khai bao vo nghia, nhung neu de lot thi he thong van tru dung 60
 *      phut cua ai do — mot gio cong bien mat ma khong ai giai thich duoc.
 */
function checkBreakWindow(
  values: {
    startTime: string;
    endTime: string;
    breakStartTime: string;
    breakEndTime: string;
  },
  ctx: z.RefinementCtx,
): void {
  const { breakStartTime, breakEndTime, startTime, endTime } = values;
  if (breakStartTime === "" && breakEndTime === "") return;

  if (breakStartTime === "" || breakEndTime === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [breakStartTime === "" ? "breakStartTime" : "breakEndTime"],
      message: "Khai giờ nghỉ thì phải có cả giờ bắt đầu và giờ kết thúc.",
    });
    return;
  }

  if (breakStartTime === breakEndTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["breakEndTime"],
      message: "Giờ kết thúc nghỉ phải khác giờ bắt đầu nghỉ.",
    });
    return;
  }

  const shiftMinutes = forwardMinutes(startTime, endTime);
  const offset = forwardMinutes(startTime, breakStartTime);
  const breakMinutes = forwardMinutes(breakStartTime, breakEndTime);

  if (offset + breakMinutes > shiftMinutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["breakEndTime"],
      message: `Khung giờ nghỉ phải nằm trong ca ${startTime}–${endTime}.`,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Dang nhap                                                                   */
/* -------------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Vui lòng nhập email.")
    .email("Email không hợp lệ. Ví dụ: ten@congty.vn"),
  password: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu.")
    .min(6, "Mật khẩu phải có ít nhất 6 ký tự."),
  remember: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/* -------------------------------------------------------------------------- */
/* Doi mat khau bat buoc lan dau (02-10, D-16)                                */
/* -------------------------------------------------------------------------- */

export const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(1, "Vui lòng nhập mật khẩu mới.")
      .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự."),
    confirmPassword: z
      .string()
      .min(1, "Vui lòng nhập lại mật khẩu mới."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Mật khẩu nhập lại không khớp.",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

/* -------------------------------------------------------------------------- */
/* Onboarding                                                                  */
/* -------------------------------------------------------------------------- */

export const companyStepSchema = z.object({
  name: z
    .string()
    .min(1, "Vui lòng nhập tên doanh nghiệp.")
    .min(3, "Tên doanh nghiệp phải có ít nhất 3 ký tự.")
    .max(120, "Tên doanh nghiệp không được vượt quá 120 ký tự."),
  code: z
    .string()
    .min(1, "Vui lòng nhập mã doanh nghiệp.")
    .regex(
      /^[A-Za-z0-9]{2,20}$/,
      "Mã doanh nghiệp chỉ gồm chữ và số, từ 2 đến 20 ký tự.",
    ),
  industry: z.string().min(1, "Vui lòng chọn lĩnh vực hoạt động."),
  size: z.enum(["1-10", "11-30", "31-100", "101-500", "500+"], {
    errorMap: () => ({ message: "Vui lòng chọn quy mô nhân sự." }),
  }),
  phone: z
    .string()
    .min(1, "Vui lòng nhập số điện thoại.")
    .regex(VIETNAM_PHONE, "Số điện thoại phải gồm 10 hoặc 11 số và bắt đầu bằng 0."),
  address: z
    .string()
    .min(1, "Vui lòng nhập địa chỉ.")
    .min(6, "Địa chỉ quá ngắn, vui lòng nhập chi tiết hơn."),
});

export type CompanyStepValues = z.infer<typeof companyStepSchema>;

export const shiftStepSchema = z
  .object({
    name: z.string().min(1, "Vui lòng nhập tên ca làm việc."),
    startTime: z.string().regex(TIME_PATTERN, "Giờ bắt đầu không hợp lệ."),
    endTime: z.string().regex(TIME_PATTERN, "Giờ kết thúc không hợp lệ."),
    // Khung gio nghi (0025) thay cho con so phut. Chuoi rong = ca khong co
    // gio nghi — o `<input type="time">` de trong tra ve "" chu khong phai
    // `null`, nen schema nhan ca hai va duong ghi quy ve `null`.
    breakStartTime: z
      .string()
      .regex(TIME_PATTERN, "Giờ bắt đầu nghỉ không hợp lệ.")
      .or(z.literal("")),
    breakEndTime: z
      .string()
      .regex(TIME_PATTERN, "Giờ kết thúc nghỉ không hợp lệ.")
      .or(z.literal("")),
    lateToleranceMinutes: z
      .number({ invalid_type_error: "Vui lòng nhập số phút cho phép đi muộn." })
      .int("Số phút phải là số nguyên.")
      .min(0, "Số phút không được âm.")
      .max(60, "Số phút cho phép đi muộn không vượt quá 60."),
    workingDays: z
      .array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]))
      .min(1, "Chọn ít nhất một ngày làm việc trong tuần."),
  })
  .refine((values) => values.startTime !== values.endTime, {
    message: "Giờ bắt đầu và giờ kết thúc không được trùng nhau.",
    path: ["endTime"],
  })
  .superRefine(checkBreakWindow);

export type ShiftStepValues = z.infer<typeof shiftStepSchema>;

/* -------------------------------------------------------------------------- */
/* Nhan vien                                                                   */
/* -------------------------------------------------------------------------- */

export const employeeSchema = z.object({
  // Thong tin ca nhan
  fullName: z
    .string()
    .min(1, "Vui lòng nhập họ và tên.")
    .min(3, "Họ và tên phải có ít nhất 3 ký tự.")
    .max(80, "Họ và tên không được vượt quá 80 ký tự."),
  code: z
    .string()
    .min(1, "Vui lòng nhập mã nhân viên.")
    .regex(EMPLOYEE_CODE, "Mã nhân viên chỉ gồm chữ, số, dấu chấm hoặc gạch."),
  email: z
    .string()
    .min(1, "Vui lòng nhập email.")
    .email("Email không hợp lệ."),
  /**
   * SAU TRUONG KHONG BAT BUOC (migration 0028): so dien thoai, ngay sinh, gioi
   * tinh, phong ban, chuc vu, loai hop dong.
   *
   * O bieu mau chung mang gia tri RONG chu khong phai `null`: `<input>` de
   * trong tra ve `""`, va Radix `Select` khong nhan chuoi rong lam value nen
   * hai o chon dung `UNSET` lam moc "chua khai". Phep doi sang `null` nam o
   * MOT noi duy nhat — `toEmployeeInput()` trong `employee-form.tsx`.
   *
   * BO TRONG THI KHONG KIEM GI; CO NHAP THI KIEM DAY DU. Mot so dien thoai go
   * sai van la mot loi dang bao — "khong bat buoc" nghia la duoc phep khong co,
   * khong phai duoc phep sai.
   */
  phone: z
    .string()
    .refine(
      (value) => value === "" || VIETNAM_PHONE.test(value),
      "Số điện thoại phải gồm 10 hoặc 11 số và bắt đầu bằng 0.",
    ),
  dateOfBirth: z.string().refine((value) => {
    if (value === "") return true;
    const year = Number(value.slice(0, 4));
    return Number.isFinite(year) && year >= 1940 && year <= 2010;
  }, "Nhân viên phải từ 16 tuổi trở lên."),
  gender: z.enum(["male", "female", "other", UNSET]),
  avatarUrl: z.string().nullable(),

  // Thong tin cong viec
  departmentId: z.string(),
  position: z.string().max(80, "Chức vụ không được vượt quá 80 ký tự."),
  contractType: z.enum([
    "full_time",
    "part_time",
    "probation",
    "seasonal",
    "intern",
    UNSET,
  ]),
  startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu làm việc."),
  managerId: z.string().nullable(),
  /**
   * `shift` = chon mot ca co san. `hours` = CA LINH HOAT (migration 0027):
   * nguoi dung go so gio lam mot ngay cua rieng nguoi nay, va he thong tim
   * hoac tao mot ca linh hoat co do dai do.
   */
  shiftMode: z.enum(["shift", "hours"]),
  shiftId: z.string(),
  dailyHours: z.number().nullable(),
  /** Chi dung khi PHAI tao ca linh hoat moi — xem `resolveHoursShiftId`. */
  shiftWorkingDays: z
    .array(
      z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
        z.literal(7),
      ]),
    )
    .min(1, "Chọn ít nhất một ngày làm việc trong tuần."),
  workLocation: z.string().min(1, "Vui lòng chọn địa điểm làm việc."),

  // Tai khoan
  status: z.enum(["active", "on_leave", "terminated", "pending_invite"]),
  systemRole: z.enum(["owner", "admin", "manager", "employee"], {
    errorMap: () => ({ message: "Vui lòng chọn vai trò hệ thống." }),
  }),
  invitationSent: z.boolean(),
  canViewPayslip: z.boolean(),
  canCheckInRemotely: z.boolean(),

  /**
   * MUC LUONG khai ngay khi them nhan vien. BAT BUOC o che do tao moi va
   * KHONG hien o che do sua (moi lan doi luong la mot PHIEN BAN MOI, khai o
   * tab "Thông tin lương" — D-37a). `payRateRequired` bat dung dieu do:
   * `employeeSchema` dung cho ca hai che do nen khong the bat buoc vo dieu
   * kien, va o che do sua thi ba o duoi khong ton tai tren man hinh.
   */
  payRateRequired: z.boolean(),
  payRateUnit: z.enum(["month", "day", "hour"]),
  // `null` = o nhap dang de trong. KHONG mac dinh 0: mot con so dien san la
  // mot cach ngam de xuat rang he thong biet truoc muc doanh nghiep nen tra
  // (D-26), va 0 cung se lot qua moi phep kiem "da khai chua".
  payRateAmount: z.number().nullable(),
  payRateEffectiveFrom: z.string(),
})
  .superRefine((values, ctx) => {
    if (values.shiftMode === "hours") {
      if (values.dailyHours === null || Number.isNaN(values.dailyHours)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Vui lòng nhập số giờ làm một ngày.",
          path: ["dailyHours"],
        });
      } else if (
        values.dailyHours < MIN_SHIFT_HOURS ||
        values.dailyHours > MAX_SHIFT_HOURS
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Số giờ làm một ngày phải từ ${MIN_SHIFT_HOURS} đến ${MAX_SHIFT_HOURS}.`,
          path: ["dailyHours"],
        });
      }
    } else if (values.shiftId.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng chọn ca làm việc mặc định.",
        path: ["shiftId"],
      });
    }

    if (!values.payRateRequired) return;

    if (values.payRateAmount === null || Number.isNaN(values.payRateAmount)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng nhập mức lương.",
        path: ["payRateAmount"],
      });
    } else if (values.payRateAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mức lương phải lớn hơn 0.",
        path: ["payRateAmount"],
      });
    }

    if (!DATE_ONLY.test(values.payRateEffectiveFrom)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng chọn ngày mức lương bắt đầu hiệu lực.",
        path: ["payRateEffectiveFrom"],
      });
    }
  });

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

/* -------------------------------------------------------------------------- */
/* Phong ban                                                                   */
/* -------------------------------------------------------------------------- */

export const departmentSchema = z.object({
  name: z
    .string()
    .min(1, "Vui lòng nhập tên phòng ban.")
    .max(60, "Tên phòng ban không được vượt quá 60 ký tự."),
  description: z
    .string()
    .max(200, "Mô tả không được vượt quá 200 ký tự."),
  managerId: z.string().nullable(),
  status: z.enum(["active", "inactive"]),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;

/* -------------------------------------------------------------------------- */
/* Ca lam viec                                                                 */
/* -------------------------------------------------------------------------- */

export const shiftSchema = z
  .object({
    /**
     * `hours` = CA LINH HOAT (migration 0027): chi khai do dai, khong gio moc.
     * Khi do `startTime`/`endTime`/khung gio nghi/bien do tre gio deu KHONG
     * duoc kiem — chung khong hien tren man hinh va duong ghi bo qua chung.
     */
    kind: z.enum(["fixed", "hours"]),
    durationHours: z
      .number({ invalid_type_error: "Vui lòng nhập số giờ làm một ngày." })
      .min(MIN_SHIFT_HOURS, `Số giờ làm một ngày phải từ ${MIN_SHIFT_HOURS} trở lên.`)
      .max(MAX_SHIFT_HOURS, "Một ngày làm việc không thể dài hơn 24 giờ."),
    name: z.string().min(1, "Vui lòng nhập tên ca."),
    code: z
      .string()
      .min(1, "Vui lòng nhập mã ca.")
      .max(8, "Mã ca không được vượt quá 8 ký tự."),
    startTime: z.string().regex(TIME_PATTERN, "Giờ bắt đầu không hợp lệ."),
    endTime: z.string().regex(TIME_PATTERN, "Giờ kết thúc không hợp lệ."),
    // Khung gio nghi (0025) thay cho con so phut. Chuoi rong = ca khong co
    // gio nghi — o `<input type="time">` de trong tra ve "" chu khong phai
    // `null`, nen schema nhan ca hai va duong ghi quy ve `null`.
    breakStartTime: z
      .string()
      .regex(TIME_PATTERN, "Giờ bắt đầu nghỉ không hợp lệ.")
      .or(z.literal("")),
    breakEndTime: z
      .string()
      .regex(TIME_PATTERN, "Giờ kết thúc nghỉ không hợp lệ.")
      .or(z.literal("")),
    lateToleranceMinutes: z
      .number({ invalid_type_error: "Vui lòng nhập số phút cho phép đi muộn." })
      .int()
      .min(0, "Số phút không được âm.")
      .max(60, "Số phút cho phép đi muộn không vượt quá 60."),
    workingDays: z
      .array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]))
      .min(1, "Chọn ít nhất một ngày làm việc trong tuần."),
    status: z.enum(["active", "archived"]),
  })
  .refine(
    (values) => values.kind === "hours" || values.startTime !== values.endTime,
    {
      message: "Giờ bắt đầu và giờ kết thúc không được trùng nhau.",
      path: ["endTime"],
    },
  )
  .superRefine((values, ctx) => {
    // Ca linh hoat khong co khung gio nghi de kiem — `shifts_shape_check` cua
    // database bat no phai rong, va man hinh khong hien hai o do.
    if (values.kind === "hours") return;
    checkBreakWindow(values, ctx);
  });

export type ShiftFormValues = z.infer<typeof shiftSchema>;

/* -------------------------------------------------------------------------- */
/* Diem lam viec                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Bieu mau chi co bon truong (ten, vi do, kinh do, ban kinh) — khong co
 * `isActive` (bat/tat nam o hanh dong "Ngung su dung" rieng, khong phai mot
 * o nhap trong form). Rang buoc so KHOP DUNG `workSiteInputSchema`
 * (`src/lib/validation/api/work-sites.ts`) — hai schema trung nhau ve gia
 * tri chap nhan, chi khac o hinh dang dau ra (form giu camelCase phang,
 * input schema transform sang snake_case de ghi).
 */
export const workSiteFormSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên điểm làm việc."),
  latitude: z
    .number({ invalid_type_error: "Vui lòng nhập vĩ độ." })
    .min(-90, "Vĩ độ phải từ -90 đến 90.")
    .max(90, "Vĩ độ phải từ -90 đến 90."),
  longitude: z
    .number({ invalid_type_error: "Vui lòng nhập kinh độ." })
    .min(-180, "Kinh độ phải từ -180 đến 180.")
    .max(180, "Kinh độ phải từ -180 đến 180."),
  radiusMeters: z
    .number({ invalid_type_error: "Vui lòng nhập bán kính." })
    .int("Bán kính phải là số nguyên (đơn vị mét).")
    .positive("Bán kính phải lớn hơn 0."),
});

export type WorkSiteFormValues = z.infer<typeof workSiteFormSchema>;

/* -------------------------------------------------------------------------- */
/* Yeu cau cua nhan vien                                                       */
/* -------------------------------------------------------------------------- */

export const workRequestSchema = z
  .object({
    type: z.enum(
      ["leave", "attendance_supplement", "time_adjustment", "overtime"],
      { errorMap: () => ({ message: "Vui lòng chọn loại yêu cầu." }) },
    ),
    fromDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu."),
    toDate: z.string().min(1, "Vui lòng chọn ngày kết thúc."),
    fromTime: z.string().nullable(),
    toTime: z.string().nullable(),
    reason: z
      .string()
      .min(1, "Vui lòng nhập lý do.")
      .min(10, "Lý do cần ít nhất 10 ký tự để người duyệt hiểu rõ.")
      .max(300, "Lý do không được vượt quá 300 ký tự."),
  })
  .refine((values) => values.fromDate <= values.toDate, {
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.",
    path: ["toDate"],
  })
  .refine(
    (values) =>
      values.type === "leave" ||
      (Boolean(values.fromTime) && Boolean(values.toTime)),
    {
      message: "Vui lòng nhập khung giờ cho loại yêu cầu này.",
      path: ["fromTime"],
    },
  );

export type WorkRequestFormValues = z.infer<typeof workRequestSchema>;
