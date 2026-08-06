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
  // Tieu de sr-only cua Sheet — phan biet theo loai cham (plan 03-04, Task 3)
  // de trinh doc man hinh noi dung viec dang lam, khong doi nut gui/banner
  // (UI-SPEC chot "Gửi chấm công" la chu chung cho ca hai loai).
  sheetTitleCheckIn: "Chấm công vào ca bằng camera",
  sheetTitleCheckOut: "Chấm công tan ca bằng camera",
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
  // Nhan/alt/toast con lai cua Camera Sheet (plan 03-03, Task 2) — gom ve day
  // de camera-sheet.tsx khong con chuoi tieng Viet viet thang nao (quy uoc
  // "toan bo chu lay tu khoi hang so")
  closeButtonLabel: "Đóng",
  captureButtonLabel: "Chụp ảnh",
  capturedPhotoAlt: "Ảnh vừa chụp",
  cameraOpenErrorToast: "Không mở được camera. Vui lòng thử lại.",
  captureErrorToast: "Không thể chụp ảnh. Vui lòng thử lại.",
  submitErrorFallback: "Không gửi được chấm công.",
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
  // outsideRadiusBodySuffix sua lai o plan 03-03 (Task 3) — ban goc cua
  // 03-01 lam trung chu "khoang cach nay" khien cau ghep sai ngu phap; tach
  // rieng outsideRadiusDistanceLabel de dat DUNG giua ten diem va con so.
  outsideRadiusTitle: "Đã ghi nhận — cách xa điểm làm việc",
  outsideRadiusBodyPrefix: "Bạn cách",
  outsideRadiusDistanceLabel: "khoảng",
  outsideRadiusBodySuffix: "Quản trị sẽ xem lại bản ghi này.",
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

/**
 * Danh sách "cần xem lại" của quản trị (D-21/ATT-07, `/admin/attendance/review`,
 * plan 03-06) — trạng thái rỗng lành mạnh, không phải ngõ cụt. Chữ tiêu đề/mô
 * tả trên trang MỜI người đọc kiểm tra, không kết luận thay họ: khoảng cách
 * lớn có thể là GPS đo sai, có thể là đi công tác, có thể là điểm làm việc
 * khai sai toạ độ — không bao giờ dùng từ ngữ buộc tội (T-03-06-06).
 */
export const ATTENDANCE_REVIEW_LABEL = {
  pageTitle: "Cần xem lại",
  pageDescriptionPrefix: "Đang có",
  pageDescriptionSuffix:
    "bản ghi chấm công bất thường: cách xa điểm làm việc, hoặc nằm ngoài khung giờ ca được phân. Cả hai đều có thể do GPS đo sai, nhân viên đi công tác, làm thêm ngoài ca, hoặc dữ liệu ca/điểm làm việc khai sai — hãy xem chi tiết để kiểm tra, không tự kết luận.",
  emptyTitle: "Không có bản ghi nào cần xem lại",
  emptyBody:
    "Mọi lần chấm công gần đây đều nằm trong hoặc gần bán kính điểm làm việc và đúng khung giờ ca.",
  reviewAction: "Đánh dấu đã xem xét",
  detailAction: "Xem chi tiết",
  employeeColumn: "Nhân viên",
  workSiteColumn: "Điểm làm việc / Ca",
  distanceColumn: "Dấu hiệu",
  capturedAtColumn: "Thời điểm",
  reviewStatusColumn: "Trạng thái xem xét",
  actionColumn: "Hành động",
  // "gấp {số} lần bán kính" — ghép tại nơi gọi cùng con số bội số đã tính ở server.
  multiplierPrefix: "gấp",
  multiplierSuffix: "lần bán kính",
  accuracyPrefix: "Độ chính xác GPS",
  outsideShiftLabel: "Ngoài khung giờ ca",
  punchTimePrefix: "Chấm lúc",
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

/**
 * `AttendancePhotoDialog` (plan 03-01 tao ban toi gian, 03-05 mo rong day
 * du) — anh, toa do, khoang cach, do chinh xac, lien ket ban do, hanh dong
 * xem xet. `loadError` KHONG con nhac "lien ket het han": kien truc da chot
 * la broker Route Handler (khong phai signed URL), nen khong co lien ket
 * nao tu mat hieu luc theo thoi gian — mot loi tai anh o day chi co the la
 * loi mang hoac loi server, khong phai mot lien ket qua han.
 */
export const ATTENDANCE_PHOTO_DIALOG_LABEL = {
  noPhoto: "Bản ghi này không có ảnh đính kèm.",
  missingLeg: "Chưa có ảnh cho lần chấm công này.",
  loadError: "Không tải được ảnh.",
  reload: "Tải lại ảnh",
  fetchErrorReload: "Thử lại",
  kindLabel: {
    check_in: "Lần vào ca",
    check_out: "Lần ra ca",
  } as const,
  capturedAtLabel: "Thời điểm chụp",
  workSiteLabel: "Điểm làm việc",
  noWorkSite: "Doanh nghiệp chưa khai điểm làm việc nên không có mốc để đo.",
  distanceTowardsSitePrefix: "Cách",
  distanceTowardsSiteSuffix: "khoảng",
  accuracyLabel: "Độ chính xác GPS thiết bị khai",
  // D-20: chinh cau nay la ly do "trong ban kinh" thoi la dieu kien chan
  // cham cong — do chinh xac la ban kinh tin cay DO THIET BI TU KHAI, khong
  // phai mot phep do cua he thong; nguoi doc can thay CA HAI con so de phan
  // biet "GPS do sai" voi "dung xa that".
  accuracyExplain:
    "là bán kính vòng tròn tin cậy do chính thiết bị khai — vị trí thật có thể lệch tới ngần ấy mét theo bất kỳ hướng nào.",
  coordinateLabel: "Toạ độ thô",
  openMapLink: "Mở trong Google Maps",
  reviewSuccessToast: "Đã đánh dấu ảnh là đã xem xét.",
  reviewErrorToast: "Không thể cập nhật trạng thái xem xét.",
  // Ghi chu pham vi bang chung — anh la anh hien truong, KHONG phai anh
  // chan dung: no chung minh mot thiet bi da o dung noi, khong chung minh
  // dung nguoi (PROJECT.md §Key Decisions).
  scopeNote:
    "Ảnh là ảnh hiện trường tại thời điểm chấm công, không dùng để đối chiếu khuôn mặt hay xác nhận danh tính người chấm công.",
} as const;

/**
 * Trang cài đặt doanh nghiệp (`/admin/settings`, Phase 4). Bốn tab, mỗi tab do
 * một plan lắp nội dung vào — thứ tự tab là cố định và không plan nào được đổi:
 * Chung (04-01) / Ca làm việc (04-02) / Ngày lễ (04-03) / Tăng ca (04-04).
 *
 * Chữ trợ giúp của mỗi trường nói HỆ QUẢ chứ không mô tả lại tên trường: người
 * đọc cần biết đổi con số này thì cái gì trên hệ thống đổi theo.
 */
export const SETTINGS_LABEL = {
  pageTitle: "Cài đặt",
  pageDescription:
    "Những quy tắc công của riêng doanh nghiệp bạn. Hệ thống không áp sẵn con số nào — trừ vài ngưỡng vận hành có thể sửa ở tab Chung.",
  tabGeneral: "Chung",
  tabShifts: "Ca làm việc",
  tabHolidays: "Ngày lễ",
  tabOvertime: "Tăng ca",
  comingSoon: "Đang xây dựng",
  comingSoonBody: "Phần này sẽ có trong bước tiếp theo của Phase 4.",
  saveButton: "Lưu thay đổi",
  saveSuccess: "Đã lưu cấu hình.",
  saveError: "Không lưu được cấu hình.",
  loadError: "Không tải được cấu hình doanh nghiệp.",
} as const;

/**
 * Tab "Chung" — bốn ngưỡng vận hành. Hai ngưỡng đầu là phần đóng lại của
 * D-21a (Phase 3 hứa sẽ đưa chúng ra khỏi mã nguồn); khung giờ đêm là định
 * nghĩa pháp lý dùng cho hệ số ca đêm ở tab Tăng ca (D-27).
 */
export const SETTINGS_GENERAL_LABEL = {
  sectionTitle: "Ngưỡng vận hành",
  sectionDescription:
    "Bốn giá trị này chỉ ảnh hưởng tới cách hệ thống đặt câu hỏi, không tự kết luận thay bạn.",
  suspiciousMultiplierLabel: "Ngưỡng đáng ngờ (số lần bán kính)",
  suspiciousMultiplierHelp:
    "Lần chấm công cách tâm điểm làm việc xa hơn ngần này lần bán kính sẽ xuất hiện trong danh sách Cần xem lại. Đặt cao hơn nếu doanh nghiệp có chi nhánh xa nhau.",
  shiftWindowGraceLabel: "Biên độ khung giờ ca (phút)",
  shiftWindowGraceHelp:
    "Chấm công sớm hoặc muộn hơn khung giờ ca quá ngần này phút sẽ được đưa vào danh sách Cần xem lại. Không chặn ai chấm công.",
  nightStartLabel: "Ca đêm bắt đầu",
  nightEndLabel: "Ca đêm kết thúc",
  nightHelp:
    "Khoảng giờ được tính là làm đêm, dùng cho hệ số ca đêm ở tab Tăng ca. Mặc định 22:00–06:00 theo Bộ luật Lao động.",
} as const;

/**
 * Tab "Ca làm việc" của trang cài đặt (SET-01, plan 04-02). Chữ trợ giúp nói rõ
 * ranh giới thời gian của thay đổi: áp cho những lần chấm công SAU ĐÓ, còn bản
 * ghi đã có giữ nguyên cách phân loại của ngày hôm đó (tiêu chí 1 và 4 của phase).
 */
export const SETTINGS_SHIFT_LABEL = {
  sectionTitle: "Giờ làm chuẩn và ân hạn đi muộn",
  sectionDescription:
    "Mỗi ca có giờ làm và mức ân hạn riêng. Thay đổi ở đây áp cho những lần chấm công sau đó; các bản ghi đã có giữ nguyên cách phân loại của ngày hôm đó.",
  columnShift: "Ca",
  columnHours: "Giờ làm",
  columnTolerance: "Ân hạn đi muộn",
  columnEmployees: "Nhân viên",
  columnAction: "",
  overnightTag: "qua đêm",
  noTolerance: "Không ân hạn",
  editAction: "Sửa",
  saveError: "Không lưu được ca làm việc.",
  emptyTitle: "Chưa có ca làm việc nào",
  emptyBody:
    "Doanh nghiệp cần ít nhất một ca để hệ thống biết giờ làm chuẩn mà đối chiếu khi nhân viên chấm công.",
  emptyAction: "Tới trang Ca làm việc",
} as const;

/**
 * Tab "Ngày lễ" của trang cài đặt (SET-02, plan 04-03).
 *
 * Trạng thái rỗng nói đúng sự thật của D-26: hệ thống KHÔNG cài sẵn ngày lễ
 * nào, vì mỗi doanh nghiệp nghỉ khác nhau — đây là trạng thái hợp lệ của một
 * doanh nghiệp mới, không phải một lỗi hay một ngõ cụt.
 *
 * Chữ cảnh báo khi chạm vào quá khứ (D-25b) nói đúng ba điều: bao nhiêu bản
 * ghi sẽ đổi cách phân loại, rằng đây là thay đổi hồi tố, và rằng thao tác
 * được ghi vào nhật ký.
 */
export const SETTINGS_HOLIDAY_LABEL = {
  sectionTitle: "Ngày nghỉ lễ của doanh nghiệp",
  sectionDescription:
    "Danh sách này do doanh nghiệp tự khai. Hệ thống không cài sẵn ngày nào vì mỗi nơi nghỉ khác nhau.",
  yearLabel: "Năm",
  addButton: "Thêm ngày lễ",
  columnDate: "Ngày",
  columnName: "Tên ngày lễ",
  columnAction: "",
  pastTag: "đã qua",
  editAction: "Sửa",
  deleteAction: "Xoá",
  emptyTitle: "Chưa khai ngày nghỉ lễ nào cho năm này",
  emptyBody:
    "Doanh nghiệp mới bắt đầu với một lịch nghỉ trắng — hệ thống không cài sẵn ngày lễ nào. Thêm ngày đầu tiên để hệ thống phân loại công theo đúng lịch nghỉ của bạn.",
  dialogCreateTitle: "Thêm ngày nghỉ lễ",
  dialogEditTitle: "Sửa ngày nghỉ lễ",
  dialogDescription:
    "Ngày nghỉ lễ ảnh hưởng tới cách phân loại công và hệ số tăng ca của chính ngày đó.",
  fieldDate: "Ngày",
  fieldName: "Tên ngày lễ",
  // Vi du CO Y khong phai mot ngay le quoc gia: goi y mot ngay le quoc gia o
  // day la mot cach ngam de xuat "he thong biet truoc ban nen nghi ngay nao",
  // trai voi chinh D-26.
  fieldNamePlaceholder: "Ví dụ: Nghỉ hè toàn công ty",
  save: "Lưu",
  cancel: "Huỷ",
  createSuccess: "Đã thêm ngày nghỉ lễ.",
  updateSuccess: "Đã cập nhật ngày nghỉ lễ.",
  deleteSuccess: "Đã xoá ngày nghỉ lễ.",
  saveError: "Không lưu được ngày nghỉ lễ.",
  deleteError: "Không xoá được ngày nghỉ lễ.",
  countError: "Không đếm được số bản ghi chấm công của ngày này.",
  pastConfirmTitle: "Thay đổi này có hiệu lực hồi tố",
  pastConfirmBodyPrefix: "Ngày này đã có",
  pastConfirmBodySuffix:
    "bản ghi chấm công. Cách phân loại của những bản ghi đó sẽ đổi theo, và thao tác này được ghi vào nhật ký.",
  pastConfirmAction: "Tôi hiểu, tiếp tục",
  deleteConfirmTitle: "Xoá",
  deleteConfirmBody:
    "Ngày này sẽ không còn được tính là ngày nghỉ lễ khi phân loại công.",
} as const;

/** Nhãn tiếng Việt của bốn loại ngày có hệ số tăng ca (SET-03, enum giữ tiếng Anh). */
export const OVERTIME_RULE_KEY_LABEL: Record<
  "weekday" | "weekend" | "holiday" | "night",
  string
> = {
  weekday: "Ngày thường",
  weekend: "Ngày nghỉ",
  holiday: "Ngày lễ",
  // D-28a: "night" KHONG phai mot loai ngay ngang hang ba loai tren — no la
  // mot PHU CAP CONG THEM tren nen he so cua loai ngay. Nhan phai noi dung
  // dieu do, neu khong nguoi khai se dien vao mot he so nhan (vi du 1.3) va
  // con so quy doi se sai gap boi.
  night: "Phụ cấp ca đêm",
};

/** Mô tả từng loại ngày — nói loại giờ nào rơi vào nhóm này, không mô tả lại nhãn. */
export const OVERTIME_RULE_KEY_HINT: Record<
  "weekday" | "weekend" | "holiday" | "night",
  string
> = {
  weekday: "Giờ làm vượt quá độ dài ca vào một ngày làm việc bình thường.",
  weekend: "Toàn bộ giờ làm vào ngày không thuộc lịch làm việc của ca.",
  holiday: "Toàn bộ giờ làm vào ngày doanh nghiệp đã khai là ngày nghỉ lễ.",
  night:
    "CỘNG THÊM cho phần giờ rơi vào khung giờ đêm (khai ở tab Chung), trên nền hệ số của chính ngày hôm đó. Ví dụ: 0.3 nghĩa là cộng thêm 30%.",
};

/**
 * Tab "Tăng ca" của trang cài đặt (SET-03, plan 04-04).
 *
 * KHÔNG có hệ số nào được gợi ý sẵn ở đây — kể cả các mức theo luật lao động.
 * Chỗ chưa khai nói thẳng là chưa khai (D-26), vì một con số hiện ra khi doanh
 * nghiệp chưa khai gì là sai lặng lẽ, khó phát hiện nhất.
 *
 * `disclaimer` là câu giới hạn của D-28, dùng CHUNG cho mọi màn hình hiển thị
 * giờ quy đổi để hai nơi không nói hai câu khác nhau.
 */
export const SETTINGS_OVERTIME_LABEL = {
  sectionTitle: "Hệ số tăng ca",
  sectionDescription:
    "Hệ số áp từ ngày hiệu lực trở đi. Phiên bản cũ giữ nguyên, nên số liệu của các kỳ trước không đổi khi bạn khai một mức mới.",
  // D-28a: cong thuc noi thanh mot cau ngan ngay tren tab, de nguoi khai hieu
  // vi sao "Phu cap ca dem" hien dang "+30%" con ba loai kia hien dang "x3.0".
  formulaNote:
    "Mỗi giờ tăng ca lấy hệ số của loại ngày, cộng thêm phụ cấp ca đêm nếu giờ đó rơi vào khung giờ đêm. Ví dụ: ngày lễ ×3.0 và phụ cấp đêm 0.3 thì một giờ làm đêm ngày lễ quy đổi ×3.3.",
  notDeclared: "Chưa khai hệ số",
  notDeclaredHint: "Giờ tăng ca của loại ngày này chưa quy đổi được.",
  notDeclaredHintNight:
    "Giờ làm đêm chưa được cộng thêm phụ cấp nào.",
  effectiveFromPrefix: "Hiệu lực từ",
  declareAction: "Khai hệ số mới",
  historyTitle: "Lịch sử phiên bản",
  historyEmpty: "Chưa có phiên bản nào.",
  historyToggleShow: "Xem lịch sử",
  historyToggleHide: "Ẩn lịch sử",
  dialogTitle: "Khai hệ số mới",
  dialogDescription:
    "Thao tác này THÊM một phiên bản mới, không sửa đè phiên bản đang có.",
  fieldMultiplier: "Hệ số",
  fieldMultiplierNight: "Phụ cấp (cộng thêm)",
  fieldMultiplierNightHint:
    "Nhập phần cộng thêm, không phải hệ số nhân. Ví dụ: 0.3 nghĩa là cộng thêm 30% trên hệ số của chính ngày hôm đó.",
  fieldEffectiveFrom: "Hiệu lực từ ngày",
  retroWarning:
    "Ngày hiệu lực nằm trong quá khứ: giờ tăng ca của những ngày đã qua kể từ mốc này sẽ được quy đổi lại theo hệ số mới.",
  save: "Thêm phiên bản",
  cancel: "Huỷ",
  saveSuccess: "Đã thêm phiên bản hệ số mới.",
  saveError: "Không khai được hệ số tăng ca.",
} as const;

/**
 * Câu giới hạn D-28, dùng chung ở mọi nơi hiển thị giờ quy đổi (tab Tăng ca,
 * màn hình chấm công của quản trị, tổng hợp tháng của nhân viên). Một hằng số
 * duy nhất để ba nơi không bao giờ nói ba câu khác nhau.
 */
export const OVERTIME_DISCLAIMER =
  "Giờ quy đổi là số liệu công theo quy tắc doanh nghiệp đã khai, chưa phải căn cứ tính lương theo luật lao động.";

/** Nhãn ba loại ngày công (SET-04). Enum giữ tiếng Anh theo quy ước dự án. */
export const WORK_DAY_TYPE_LABEL: Record<
  "weekday" | "weekend" | "holiday",
  string
> = {
  weekday: "Ngày thường",
  weekend: "Ngày nghỉ",
  holiday: "Ngày lễ",
};

/**
 * Hiển thị giờ tăng ca quy đổi (SET-04, plan 04-05).
 *
 * `notDeclared` được dùng ở MỌI nơi hiển thị giờ quy đổi khi doanh nghiệp chưa
 * khai hệ số — không nơi nào được hiện số 0 thay cho nó. Số 0 nói với nhân
 * viên rằng họ không có giờ tăng ca nào, đó là một lời nói dối khác hẳn với
 * "hệ thống chưa biết quy đổi thế nào".
 */
export const OVERTIME_DISPLAY_LABEL = {
  overtimeRawLabel: "Giờ tăng ca",
  overtimeConvertedLabel: "Quy đổi",
  notDeclared: "Chưa khai hệ số",
  notDeclaredAction: "Khai hệ số tăng ca",
  nightPortionPrefix: "trong đó",
  nightPortionSuffix: "giờ đêm",
} as const;
