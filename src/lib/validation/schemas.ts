import { z } from "zod";

/**
 * Toan bo schema kiem tra du lieu bieu mau.
 * Thong bao loi viet bang tieng Viet de hien thi truc tiep tren giao dien.
 */

const VIETNAM_PHONE = /^0\d{9,10}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const EMPLOYEE_CODE = /^[A-Za-z0-9._-]{2,20}$/;

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
    breakMinutes: z
      .number({ invalid_type_error: "Vui lòng nhập số phút nghỉ." })
      .int("Số phút nghỉ phải là số nguyên.")
      .min(0, "Số phút nghỉ không được âm.")
      .max(240, "Thời gian nghỉ không vượt quá 240 phút."),
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
  });

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
  phone: z
    .string()
    .min(1, "Vui lòng nhập số điện thoại.")
    .regex(VIETNAM_PHONE, "Số điện thoại phải gồm 10 hoặc 11 số và bắt đầu bằng 0."),
  dateOfBirth: z
    .string()
    .min(1, "Vui lòng chọn ngày sinh.")
    .refine((value) => {
      const year = Number(value.slice(0, 4));
      return Number.isFinite(year) && year >= 1940 && year <= 2010;
    }, "Nhân viên phải từ 16 tuổi trở lên."),
  gender: z.enum(["male", "female", "other"], {
    errorMap: () => ({ message: "Vui lòng chọn giới tính." }),
  }),
  avatarUrl: z.string().nullable(),

  // Thong tin cong viec
  departmentId: z.string().min(1, "Vui lòng chọn phòng ban."),
  position: z.string().min(1, "Vui lòng nhập chức vụ."),
  contractType: z.enum(
    ["full_time", "part_time", "probation", "seasonal", "intern"],
    { errorMap: () => ({ message: "Vui lòng chọn loại hợp đồng." }) },
  ),
  startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu làm việc."),
  managerId: z.string().nullable(),
  shiftId: z.string().min(1, "Vui lòng chọn ca làm việc mặc định."),
  workLocation: z.string().min(1, "Vui lòng chọn địa điểm làm việc."),

  // Tai khoan
  status: z.enum(["active", "on_leave", "terminated", "pending_invite"]),
  systemRole: z.enum(["owner", "admin", "manager", "employee"], {
    errorMap: () => ({ message: "Vui lòng chọn vai trò hệ thống." }),
  }),
  invitationSent: z.boolean(),
  canViewPayslip: z.boolean(),
  canCheckInRemotely: z.boolean(),
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
    name: z.string().min(1, "Vui lòng nhập tên ca."),
    code: z
      .string()
      .min(1, "Vui lòng nhập mã ca.")
      .max(8, "Mã ca không được vượt quá 8 ký tự."),
    startTime: z.string().regex(TIME_PATTERN, "Giờ bắt đầu không hợp lệ."),
    endTime: z.string().regex(TIME_PATTERN, "Giờ kết thúc không hợp lệ."),
    breakMinutes: z
      .number({ invalid_type_error: "Vui lòng nhập số phút nghỉ." })
      .int()
      .min(0, "Số phút nghỉ không được âm.")
      .max(240, "Thời gian nghỉ không vượt quá 240 phút."),
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
  .refine((values) => values.startTime !== values.endTime, {
    message: "Giờ bắt đầu và giờ kết thúc không được trùng nhau.",
    path: ["endTime"],
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
