import type {
  AttendanceRejectionReason,
  AttendanceStatus,
  CompanyRole,
  CompanySize,
  ContractType,
  DepartmentStatus,
  EmployeeStatus,
  Gender,
  PhotoReviewStatus,
  RequestStatus,
  RequestType,
  ShiftStatus,
  SystemRole,
  WeekdayNumber,
} from "@/lib/types/domain";

/* -------------------------------------------------------------------------- */
/* Thuong hieu & cau hinh chung                                                */
/* -------------------------------------------------------------------------- */

export const APP_NAME = "TimeFlow";
export const APP_TAGLINE = "Quản lý thời gian làm việc rõ ràng và chính xác hơn.";
export const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";
export const DEFAULT_LOCALE = "vi-VN";
export const DEFAULT_CURRENCY = "VND";

/* -------------------------------------------------------------------------- */
/* Nhan hien thi                                                               */
/* -------------------------------------------------------------------------- */

export type SemanticTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "brand";

export const EMPLOYEE_STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: "Đang làm việc",
  on_leave: "Đang nghỉ phép",
  terminated: "Đã nghỉ việc",
  pending_invite: "Chưa kích hoạt tài khoản",
};

export const EMPLOYEE_STATUS_TONE: Record<EmployeeStatus, SemanticTone> = {
  active: "success",
  on_leave: "warning",
  terminated: "neutral",
  pending_invite: "info",
};

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  probation: "Thử việc",
  seasonal: "Thời vụ",
  intern: "Thực tập",
};

export const GENDER_LABEL: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  on_time: "Đúng giờ",
  late: "Đi muộn",
  early_leave: "Về sớm",
  missing_checkout: "Thiếu giờ ra",
  leave_paid: "Nghỉ phép",
  leave_unpaid: "Nghỉ không phép",
  day_off: "Ngày nghỉ",
};

export const ATTENDANCE_STATUS_TONE: Record<AttendanceStatus, SemanticTone> = {
  on_time: "success",
  late: "warning",
  early_leave: "warning",
  missing_checkout: "danger",
  leave_paid: "info",
  leave_unpaid: "danger",
  day_off: "neutral",
};

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  leave: "Xin nghỉ phép",
  attendance_supplement: "Bổ sung chấm công",
  time_adjustment: "Điều chỉnh giờ vào/ra",
  overtime: "Đăng ký tăng ca",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

export const REQUEST_STATUS_TONE: Record<RequestStatus, SemanticTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

export const SYSTEM_ROLE_LABEL: Record<SystemRole, string> = {
  owner: "Chủ sở hữu",
  admin: "Quản trị viên",
  manager: "Quản lý",
  employee: "Nhân viên",
};

export const COMPANY_ROLE_LABEL: Record<CompanyRole, string> = {
  owner: "Chủ sở hữu",
  admin: "Quản trị viên",
  manager: "Quản lý",
  employee: "Nhân viên",
};

export const DEPARTMENT_STATUS_LABEL: Record<DepartmentStatus, string> = {
  active: "Đang hoạt động",
  inactive: "Ngừng hoạt động",
};

export const DEPARTMENT_STATUS_TONE: Record<DepartmentStatus, SemanticTone> = {
  active: "success",
  inactive: "neutral",
};

export const SHIFT_STATUS_LABEL: Record<ShiftStatus, string> = {
  active: "Đang áp dụng",
  archived: "Ngừng sử dụng",
};

export const SHIFT_STATUS_TONE: Record<ShiftStatus, SemanticTone> = {
  active: "success",
  archived: "neutral",
};

export const COMPANY_SIZE_LABEL: Record<CompanySize, string> = {
  "1-10": "1 – 10 nhân viên",
  "11-30": "11 – 30 nhân viên",
  "31-100": "31 – 100 nhân viên",
  "101-500": "101 – 500 nhân viên",
  "500+": "Trên 500 nhân viên",
};

export const WEEKDAY_LABEL: Record<WeekdayNumber, string> = {
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
  7: "CN",
};

export const WEEKDAY_LABEL_LONG: Record<WeekdayNumber, string> = {
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ Nhật",
};

/* -------------------------------------------------------------------------- */
/* Lua chon cho form                                                           */
/* -------------------------------------------------------------------------- */

export interface Option<T extends string> {
  value: T;
  label: string;
}

function toOptions<T extends string>(record: Record<T, string>): Option<T>[] {
  return (Object.keys(record) as T[]).map((value) => ({
    value,
    label: record[value],
  }));
}

export const EMPLOYEE_STATUS_OPTIONS = toOptions(EMPLOYEE_STATUS_LABEL);
export const CONTRACT_TYPE_OPTIONS = toOptions(CONTRACT_TYPE_LABEL);
export const GENDER_OPTIONS = toOptions(GENDER_LABEL);
export const SYSTEM_ROLE_OPTIONS = toOptions(SYSTEM_ROLE_LABEL);
export const COMPANY_SIZE_OPTIONS = toOptions(COMPANY_SIZE_LABEL);
export const REQUEST_TYPE_OPTIONS = toOptions(REQUEST_TYPE_LABEL);
export const DEPARTMENT_STATUS_OPTIONS = toOptions(DEPARTMENT_STATUS_LABEL);

export const WEEKDAY_OPTIONS: Array<{ value: WeekdayNumber; label: string }> = [
  1, 2, 3, 4, 5, 6, 7,
].map((day) => ({
  value: day as WeekdayNumber,
  label: WEEKDAY_LABEL[day as WeekdayNumber],
}));

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

export const INDUSTRY_OPTIONS: Option<string>[] = [
  { value: "retail", label: "Bán lẻ" },
  { value: "fnb", label: "Ẩm thực & Đồ uống" },
  { value: "manufacturing", label: "Sản xuất" },
  { value: "logistics", label: "Kho vận & Logistics" },
  { value: "construction", label: "Xây dựng" },
  { value: "services", label: "Dịch vụ" },
  { value: "technology", label: "Công nghệ thông tin" },
  { value: "education", label: "Giáo dục" },
  { value: "healthcare", label: "Y tế" },
  { value: "other", label: "Lĩnh vực khác" },
];

/* -------------------------------------------------------------------------- */
/* Vong doi tai khoan nhan vien (02-10)                                        */
/* -------------------------------------------------------------------------- */

export const ACCOUNT_LABELS = {
  createButtonIdle: "Tạo tài khoản đăng nhập",
  createButtonPending: "Đang tạo tài khoản…",
  createSuccessToast: "Đã tạo tài khoản đăng nhập.",
  dialogTitle: "Tài khoản đã được tạo",
  dialogDescription:
    "Mật khẩu tạm dưới đây chỉ hiển thị đúng một lần ở màn hình này. Hãy chuyển cho nhân viên qua một kênh an toàn (nhắn tin trực tiếp, gọi điện...), không gửi qua email hay kênh công khai.",
  emailLabel: "Email đăng nhập",
  temporaryPasswordLabel: "Mật khẩu tạm",
  closeButton: "Đã lưu lại, đóng",
  genericError: "Không thể tạo tài khoản cho nhân viên này.",
} as const;

/* -------------------------------------------------------------------------- */
/* Doi mat khau bat buoc lan dau (02-10, D-16/D-16a)                          */
/* -------------------------------------------------------------------------- */

export const CHANGE_PASSWORD_LABELS = {
  pageTitle: "Đổi mật khẩu",
  heading: "Đổi mật khẩu lần đầu",
  description:
    "Đây là lần đăng nhập đầu tiên bằng mật khẩu tạm. Vui lòng đặt một mật khẩu mới trước khi tiếp tục.",
  newPasswordLabel: "Mật khẩu mới",
  confirmPasswordLabel: "Nhập lại mật khẩu mới",
  submitIdle: "Đổi mật khẩu",
  submitPending: "Đang đổi mật khẩu…",
  successToast: "Đã đổi mật khẩu, đang chuyển hướng…",
  // Loi loai 1: mat khau CHUA doi duoc -- nguoi dung thu lai la an toan.
  notChangedErrorFallback: "Không đổi được mật khẩu. Vui lòng thử lại.",
  // Loi loai 2: mat khau DA doi thanh cong nhung phien khong lam moi duoc --
  // TUYET DOI khong duoc gop chung voi thong diep tren (T-02-10-07): nguoi
  // dung phai biet mat khau moi da co hieu luc, khong duoc thu lai bang mat
  // khau cu.
  changedButSessionStaleError:
    "Mật khẩu mới đã có hiệu lực, nhưng phiên đăng nhập chưa làm mới được. Vui lòng đăng nhập lại bằng mật khẩu mới.",
  notForcedError: "Tài khoản của bạn không ở trạng thái buộc đổi mật khẩu.",
} as const;

export const WORK_LOCATION_OPTIONS: Option<string>[] = [
  { value: "Văn phòng chính", label: "Văn phòng chính" },
  { value: "Chi nhánh Quận 7", label: "Chi nhánh Quận 7" },
  { value: "Nhà máy Bình Dương", label: "Nhà máy Bình Dương" },
  { value: "Kho Long An", label: "Kho Long An" },
  { value: "Làm việc từ xa", label: "Làm việc từ xa" },
];

/* -------------------------------------------------------------------------- */
/* Chấm công có bằng chứng (Phase 3) — TOÀN BỘ chữ tiếng Việt của phase tập   */
/* trung ở đây trong plan 03-01 (tracer) để các plan wave sau (03-02..03-07)  */
/* chạy song song mà không tranh cùng một file. Nguồn: 03-UI-SPEC.md          */
/* §"Copywriting Contract" và §"UI Considerations", chép nguyên văn.          */
/* -------------------------------------------------------------------------- */

/** Ba lý do server từ chối một lần chấm công (D-20b) — mỗi lý do có tiêu đề + phần thân. */
export const ATTENDANCE_REJECTION_LABEL: Record<
  AttendanceRejectionReason,
  { title: string; body: string }
> = {
  missing_photo: {
    title: "Thiếu ảnh chấm công",
    body: "Máy chủ từ chối vì không có ảnh đính kèm. Hãy chụp lại và gửi.",
  },
  outside_shift: {
    title: "Ngoài giờ ca làm",
    body: "Bạn đang chấm công ngoài khung giờ ca được phân. Liên hệ quản lý nếu đây là nhầm lẫn.",
  },
  network_error: {
    title: "Mất kết nối mạng",
    body: "Không gửi được chấm công. Vui lòng kiểm tra mạng và chạm để gửi lại.",
  },
} as const;

/**
 * Chữ dùng trong Camera Sheet (`camera-sheet.tsx`) — mọi trạng thái từ mở
 * camera tới gửi chấm công. Nhánh nào chưa được nối dây ở plan tracer này
 * (no-camera-device, camera-in-use, ngoài bán kính, từ chối quyền vị trí)
 * vẫn khai chữ ở đây ngay từ bây giờ để plan 03-03 chỉ điền nhánh, không
 * phải sửa file dùng chung này lần thứ hai.
 */
export const ATTENDANCE_EVIDENCE_LABEL = {
  // Loading — mo camera (khong de mot khung den cam khong kem chu)
  cameraOpening: "Đang mở camera…",
  // Loading — dinh vi GPS
  gpsAcquiring: "Đang lấy vị trí…",
  gpsAcquired: "Vị trí: đã xác định",
  // Nut hanh dong
  submitIdle: "Gửi chấm công",
  submitPending: "Đang gửi…",
  submitRetry: "Gửi lại",
  retake: "Chụp lại",
  retry: "Thử lại",
  acknowledge: "Đã hiểu",
  // Tu choi quyen camera (NotAllowedError) — hien thuc day du o plan nay
  cameraPermissionDeniedTitle: "Không có quyền dùng camera",
  cameraPermissionDeniedBody:
    "TimeFlow cần quyền camera để chấm công. Vào cài đặt trình duyệt để cấp quyền, sau đó thử lại.",
  // Tu choi quyen vi tri — cong client-side truoc khi gui, khong phai mot
  // trong ba ly do tu choi cua server (D-20b), nen tach rieng khoi
  // ATTENDANCE_REJECTION_LABEL de khong bia them ly do thu tu
  locationPermissionDeniedTitle: "Cần quyền truy cập vị trí",
  locationPermissionDeniedBody:
    "TimeFlow cần vị trí để đối chiếu với điểm làm việc. Cấp quyền vị trí trong cài đặt trình duyệt rồi thử lại.",
  // Khong co thiet bi camera (NotFoundError/OverconstrainedError) — khong co
  // duong lui trong phase nay (ATT-01 cam thay the bang thu vien anh)
  noCameraDeviceTitle: "Không tìm thấy camera",
  noCameraDeviceBody:
    "Thiết bị này không có camera hoặc trình duyệt không truy cập được camera. Không thể chấm công trên thiết bị này.",
  // Camera dang duoc dung o noi khac (NotReadableError) — backstop, hiem gap
  cameraInUseTitle: "Không mở được camera",
  cameraInUseBody:
    "Camera có thể đang được dùng ở nơi khác. Đóng ứng dụng khác rồi thử lại.",
  // Da ghi nhan nhung ngoai ban kinh (D-20) — CHAP NHAN, khong phai loi.
  // Phan {tenDiemLamViec}/{khoangCach} do component tu ghep tai noi goi
  // (cung khuon voi tieu de ConfirmDialog dong trong ShiftsView), khong
  // dung mot ham dinh dang o day de giu constants.ts thuan du lieu tinh.
  outsideRadiusTitle: "Đã ghi nhận — cách xa điểm làm việc",
  outsideRadiusBodyPrefix: "Bạn cách",
  outsideRadiusBodySuffix: "khoảng cách này. Quản trị sẽ xem lại bản ghi này.",
} as const;

/** Nhãn/rỗng cho `/admin/work-sites` (điểm làm việc) */
export const WORK_SITE_LABEL = {
  emptyTitle: "Chưa có điểm làm việc nào",
  emptyBody:
    "Khai báo điểm làm việc đầu tiên để hệ thống tính được khoảng cách khi nhân viên chấm công.",
  addButton: "Thêm điểm làm việc",
  // Tieu de Dialog xac nhan ngung su dung duoc GHEP tai noi goi bang
  // template literal (`Ngừng sử dụng ${site.name}?`), giong het khuon
  // archive cua ShiftsView — khong luu san mot chuoi co cho trong o day.
  archiveConfirmLabel: "Ngừng sử dụng",
  archiveConfirmBody:
    "Nhân viên chấm công sẽ không còn được tính khoảng cách theo điểm này nữa.",
  statusActive: "Đang dùng",
  statusInactive: "Đã ngừng sử dụng",
  // Dong phu tren the: noi RO bien kinh la moc DE DO khoang cach, khong
  // phai dieu kien chan cham cong (D-20) — tranh cam giac an toan gia D-21b
  // canh bao.
  radiusLabel: "Bán kính đo khoảng cách",
  radiusHelp: "không phải điều kiện chặn chấm công",
} as const;

/** Danh sách "cần xem lại" của quản trị — trạng thái rỗng lành mạnh, không phải ngõ cụt */
export const ATTENDANCE_REVIEW_LABEL = {
  emptyTitle: "Không có bản ghi nào cần xem lại",
  emptyBody:
    "Mọi lần chấm công gần đây đều nằm trong hoặc gần bán kính điểm làm việc.",
  reviewAction: "Đánh dấu đã xem xét",
} as const;

export const PHOTO_REVIEW_STATUS_LABEL: Record<PhotoReviewStatus, string> = {
  pending: "Chờ xem xét",
  approved: "Đã xem xét",
  rejected: "Đã từ chối",
};

export const PHOTO_REVIEW_STATUS_TONE: Record<PhotoReviewStatus, SemanticTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

/** Ô ảnh (`AttendancePhotoDialog`) — bản ghi không có ảnh / ảnh tải lỗi */
export const ATTENDANCE_PHOTO_DIALOG_LABEL = {
  noPhoto: "Bản ghi này không có ảnh đính kèm.",
  loadError: "Không tải được ảnh — liên kết đã hết hạn.",
  reload: "Tải lại ảnh",
} as const;
