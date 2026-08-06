/**
 * Kieu du lieu nghiep vu cua TimeFlow.
 *
 * Cac union type duoi day duoc thiet ke de anh xa 1-1 sang cot enum trong
 * Postgres/Supabase o giai doan sau, nen gia tri luu tru dung tieng Anh
 * con nhan hien thi tieng Viet nam trong `lib/constants.ts`.
 */

/* -------------------------------------------------------------------------- */
/* Enum nghiep vu                                                             */
/* -------------------------------------------------------------------------- */

export type EmployeeStatus =
  | "active"
  | "on_leave"
  | "terminated"
  | "pending_invite";

export type ContractType =
  | "full_time"
  | "part_time"
  | "probation"
  | "seasonal"
  | "intern";

export type Gender = "male" | "female" | "other";

export type AttendanceStatus =
  | "on_time"
  | "late"
  | "early_leave"
  | "missing_checkout"
  | "leave_paid"
  | "leave_unpaid"
  | "day_off";

export type RequestType =
  | "leave"
  | "attendance_supplement"
  | "time_adjustment"
  | "overtime";

export type RequestStatus = "pending" | "approved" | "rejected";

/** Trang thai xem xet cua quan tri doi voi mot anh cham cong (khop enum photo_review_status) */
export type PhotoReviewStatus = "pending" | "approved" | "rejected";

/**
 * Ba ly do server tu choi mot lan cham cong (D-20b). Gia tri enum giu tieng
 * Anh theo quy uoc du an; nhan tieng Viet nam o `ATTENDANCE_REJECTION_LABEL`
 * trong `constants.ts`. Ngoai ban kinh KHONG nam trong danh sach nay —
 * D-20/D-20a: ngoai ban kinh la mot ghi chu duoc chap nhan, khong phai mot
 * ly do tu choi.
 */
export type AttendanceRejectionReason =
  | "missing_photo"
  | "outside_shift"
  | "network_error";

export type SystemRole = "owner" | "admin" | "manager" | "employee";

export type CompanyRole = "owner" | "admin" | "manager" | "employee";

export type DepartmentStatus = "active" | "inactive";

export type ShiftStatus = "active" | "archived";

/** Trang thai cham cong trong ngay cua man hinh nhan vien */
export type CheckInState = "not_started" | "working" | "finished";

export type CompanySize = "1-10" | "11-30" | "31-100" | "101-500" | "500+";

/** 1 = Thu Hai ... 7 = Chu Nhat (theo quy uoc ISO) */
export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/* -------------------------------------------------------------------------- */
/* Thuc the                                                                    */
/* -------------------------------------------------------------------------- */

export interface Company {
  id: string;
  name: string;
  code: string;
  industry: string;
  size: CompanySize;
  phone: string;
  address: string;
  /** Vai tro cua nguoi dung dang dang nhap trong doanh nghiep nay */
  role: CompanyRole;
  employeeCount: number;
  /** ISO date-time, vi du "2026-07-26T17:32:00+07:00" */
  lastAccessedAt: string;
  /** Mau nen cho chu cai dai dien, dung token thuong hieu */
  accent: "indigo" | "navy" | "ruby" | "cream";
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  description: string;
  /** id cua nhan vien giu vai tro quan ly */
  managerId: string | null;
  status: DepartmentStatus;
}

export interface Shift {
  id: string;
  companyId: string;
  name: string;
  code: string;
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm" — co the nho hon startTime neu la ca qua dem */
  endTime: string;
  breakMinutes: number;
  /** So phut cho phep di muon ma van tinh dung gio */
  lateToleranceMinutes: number;
  /** Ca ket thuc vao ngay hom sau */
  overnight: boolean;
  workingDays: WeekdayNumber[];
  status: ShiftStatus;
}

export interface Employee {
  id: string;
  companyId: string;
  /** Ma nhan vien hien thi, vi du "NV001" */
  code: string;
  fullName: string;
  email: string;
  phone: string;
  /** "YYYY-MM-DD" */
  dateOfBirth: string;
  gender: Gender;
  avatarUrl: string | null;

  departmentId: string;
  position: string;
  contractType: ContractType;
  /** "YYYY-MM-DD" */
  startDate: string;
  managerId: string | null;
  shiftId: string;
  workLocation: string;

  status: EmployeeStatus;
  systemRole: SystemRole;
  invitationSent: boolean;
  canViewPayslip: boolean;
  canCheckInRemotely: boolean;
  /**
   * Nhan vien da co tai khoan dang nhap lien ket (`employees.user_id`
   * khong null) hay chua — suy tu duong tao tai khoan o plan 02-10, khong
   * phai mot truong nguoi dung nhap. Optional (khong bat buoc) de cac
   * object Employee dung o tang gia lap (`mock/seed.ts`, se go bo o 02-11)
   * khong phai khai them truong nay.
   */
  hasAccount?: boolean;
}

export interface AttendanceRecord {
  id: string;
  companyId: string;
  employeeId: string;
  /** "YYYY-MM-DD" */
  date: string;
  shiftId: string;
  /** "HH:mm" hoac null neu chua cham cong */
  checkIn: string | null;
  checkOut: string | null;
  /** Tong so phut lam viec thuc te (da tru gio nghi) */
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: AttendanceStatus;
  location: string;
  /** Ban ghi can nhan vien bo sung thong tin */
  needsSupplement: boolean;
  note: string | null;
}

export interface WorkSite {
  id: string;
  companyId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  /** ISO date-time */
  createdAt: string;
}

/**
 * Ngay nghi le do CHINH doanh nghiep khai (SET-02, bang `holidays`). Bang co y
 * de RONG khi doanh nghiep khoi tao — he thong khong cai san ngay nao (D-26).
 *
 * `date` la NGAY LICH dang "YYYY-MM-DD", khong phai mot khoanh khac: khong co
 * mui gio nao tham gia vao kieu nay.
 */
export interface Holiday {
  id: string;
  companyId: string;
  date: string;
  name: string;
}

/** Bon loai ngay ma doanh nghiep khai he so tang ca (SET-03). */
export type OvertimeRuleKey = "weekday" | "weekend" | "holiday" | "night";

/**
 * MOT PHIEN BAN he so tang ca (SET-03, bang `overtime_rules`). Bang la
 * APPEND-ONLY (D-25): sua he so nghia la them mot dong moi voi `effectiveFrom`
 * khac, dong cu giu nguyen de so lieu cua ky da qua tai lap duoc.
 */
export interface OvertimeRule {
  id: string;
  companyId: string;
  ruleKey: OvertimeRuleKey;
  multiplier: number;
  /** "YYYY-MM-DD" — ngay bat dau co hieu luc */
  effectiveFrom: string;
}

/**
 * Mot loai ngay kem he so DANG HIEU LUC hom nay va toan bo lich su phien ban.
 * `currentMultiplier` bang `null` nghia la doanh nghiep CHUA KHAI — khong bao
 * gio duoc ngam hieu la 1.0 (D-26).
 */
export interface OvertimeRuleGroup {
  ruleKey: OvertimeRuleKey;
  currentMultiplier: number | null;
  currentEffectiveFrom: string | null;
  versions: OvertimeRule[];
}

/**
 * Cau hinh van hanh cua mot doanh nghiep (Phase 4, bang `company_settings`).
 *
 * CHI chua nguong van hanh va dinh nghia phap ly — KHONG chua gia tri nghiep
 * vu ma doanh nghiep tu quyet (he so tang ca o `overtime_rules`, ngay le o
 * `holidays`, hai bang do co y de rong khi khoi tao, D-26).
 */
export interface CompanySettings {
  companyId: string;
  /** Boi so ban kinh de mot lan cham cong bi coi la dang ngo (D-29, dong D-21a) */
  suspiciousDistanceMultiplier: number;
  /** Bien do noi rong hai dau khung gio ca, phut (D-29) */
  shiftWindowGraceMinutes: number;
  /** "HH:mm" — mac dinh 22:00 theo Bo luat Lao dong, sua duoc (D-27) */
  nightStartTime: string;
  /** "HH:mm" — mac dinh 06:00 */
  nightEndTime: string;
  /**
   * SET-05: tran tang ca, don vi GIO / NHAN VIEN / THANG. `null` nghia la
   * KHONG GIOI HAN — khong phai 0, va khong phai "chua tai xong".
   */
  overtimeCapHoursPerMonth: number | null;
  /** ISO date-time */
  updatedAt: string;
  updatedBy: string | null;
}

/**
 * Bang chung mot lan cham cong (ATT-01/ATT-02/ATT-04/ATT-06). KHONG khai
 * truong nao chua URL anh — anh chi den qua duong `/api/attendance-photos/{id}`
 * (broker Route Handler, tiêu chí 4 cua ROADMAP).
 */
export interface AttendancePhoto {
  id: string;
  companyId: string;
  attendanceRecordId: string;
  kind: "check_in" | "check_out";
  /** ISO date-time, luon la tf_server_now() cua chinh lan goi (D-19/ATT-06) */
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  workSiteId: string | null;
  workSiteName: string | null;
  /** met, do server tinh qua tf_distance_meters() — khong bao gio tu client */
  distanceMeters: number | null;
  reviewStatus: PhotoReviewStatus;
}

/** Nhung gi client gui kem khi cham cong — thu client TU KHAI, chua phai bang chung cho toi khi server tu do lai */
export interface PunchEvidence {
  photo: Blob;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export interface WorkRequest {
  id: string;
  companyId: string;
  employeeId: string;
  type: RequestType;
  status: RequestStatus;
  /** "YYYY-MM-DD" */
  fromDate: string;
  toDate: string;
  /** Chi dung cho yeu cau dieu chinh gio / bo sung cong */
  fromTime: string | null;
  toTime: string | null;
  reason: string;
  /** ISO date-time */
  createdAt: string;
  reviewerId: string | null;
  reviewNote: string | null;
  /**
   * Ngu canh nguoi gui, do `GET /api/requests` gan them (plan 05-01). `null`
   * khi noi goi khong can den (hoac du lieu khong dong bo) — man hinh duyet
   * lui ve hien `employeeId`, khong bao gio bia mot cai ten.
   */
  employeeName?: string | null;
  employeeCode?: string | null;
  departmentName?: string | null;
}

/** Mot quyet dinh xu ly. `pending` khong phai quyet dinh nen khong co o day. */
export type ReviewDecision = "approved" | "rejected";

/**
 * Mot lan xu ly yeu cau (bang `request_reviews`, migration 0017 — D-33).
 * Append-only: mot dong o day khong bao gio bi sua hay xoa, nen no la cau tra
 * loi duy nhat dang tin cho "ai duyet cai nay, luc nao, vi sao" (APRV-04).
 */
export interface RequestReview {
  id: string;
  companyId: string;
  requestId: string;
  decision: ReviewDecision;
  /** Bat buoc khi tu choi, tuy chon khi duyet */
  note: string | null;
  reviewerUserId: string | null;
  reviewerEmployeeId: string | null;
  /** `null` khi nguoi duyet khong co ho so nhan vien */
  reviewerName: string | null;
  /** ISO date-time, do database cap (D-19) */
  createdAt: string;
}

/** Dau vao cua `reviewRequest()` — khong mang dinh danh doanh nghiep (D-12b). */
export interface ReviewRequestInput {
  decision: ReviewDecision;
  note?: string | null;
}

/**
 * Ban tong ket tac dong cua mot yeu cau len du lieu cong (kieu SQL
 * `tf_request_effect`, migration 0018 — APRV-03).
 *
 * `skippedDates` la nhung ngay bi bo qua vi ngay do DA co du lieu cham cong:
 * mot mau thuan giua don nghi va thuc te, va nguoi duyet la nguoi duy nhat
 * giai quyet duoc. Khong bao gio ghi de len du lieu do (D-35).
 */
export interface RequestEffect {
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  /** "YYYY-MM-DD" */
  skippedDates: string[];
}

/** Ket qua cua `reviewRequest()`: quyet dinh + he qua cua no len du lieu cong. */
export interface ReviewRequestResult {
  request: WorkRequest;
  effect: RequestEffect;
}

export type PeriodStatus = "open" | "closed";

/**
 * Ky cong — mot thang duong lich (D-09, bang `periods`). Trang thai `closed`
 * la mot cua MOT CHIEU: chua co duong mo lai trong V2 (D-32b, co chu dich).
 */
export interface Period {
  id: string;
  companyId: string;
  /** "YYYY-MM-DD" — luon la ngay dau thang */
  startDate: string;
  /** "YYYY-MM-DD" — luon la ngay cuoi thang */
  endDate: string;
  status: PeriodStatus;
  /** ISO date-time, do dong ho database cap (D-19); `null` khi chua chot */
  closedAt: string | null;
  closedBy: string | null;
}

/**
 * Mot ky kem so lieu du de quyet dinh co chot hay khong. Cac con so duoc DEM
 * TAI THOI DIEM TRUY VAN, khong cot nao luu san.
 */
export interface PeriodSummary extends Period {
  /** "YYYY-MM" — tien cho giao dien, suy tu `startDate` */
  month: string;
  /** So nhan vien co it nhat mot ban ghi cong trong ky */
  employeeCount: number;
  /** So ban ghi cham cong trong ky */
  recordCount: number;
  /** So yeu cau con CHO XU LY co ngay bat dau roi vao ky */
  pendingRequestCount: number;
  /** Ky da ket thuc chua (so voi ngay cua server) — dieu kien de chot */
  hasEnded: boolean;
}

/** Loai thong bao trong ung dung. Phase 5 chi sinh mot loai. */
export type NotificationKind = "request_reviewed";

/**
 * Mot thong bao trong ung dung (bang `notifications`, migration 0020 —
 * APRV-05/D-34). Ranh gioi doc la NGUOI NHAN, khong phai doanh nghiep: noi
 * dung mang ly do tu choi.
 */
export interface AppNotification {
  id: string;
  companyId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Yeu cau lien quan, de mo thang toi no; `null` voi cac loai khac. */
  requestId: string | null;
  /** `null` = CHUA DOC. Dau thoi gian, khong phai boolean. */
  readAt: string | null;
  createdAt: string;
}

/** Danh sach thong bao cua chinh phien, kem so chua doc. */
export interface NotificationFeed {
  items: AppNotification[];
  unreadCount: number;
}

/**
 * Gio tang ca da dung trong mot thang cua mot nhan vien, kem tran cua doanh
 * nghiep (SET-05). Khong cot nao luu san nhung con so nay — chung duoc tinh
 * tai thoi diem truy van, cung khuon voi moi so lieu tang ca cua Phase 4.
 */
export interface OvertimeUsage {
  employeeId: string;
  /** "YYYY-MM" */
  month: string;
  /** Gio tang ca THUC TE tu du lieu cham cong. */
  actualHours: number;
  /** Gio da DANG KY o cac yeu cau tang ca KHAC da duoc duyet trong thang. */
  registeredHours: number;
  /** `actualHours + registeredHours`. */
  usedHours: number;
  /** `null` nghia la KHONG GIOI HAN. */
  capHours: number | null;
}

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  /** Ma nhan vien tuong ung tren man hinh nhan vien */
  employeeId: string;
}

export interface UserSession {
  user: AppUser;
  companyId: string;
  role: CompanyRole;
  /** ISO date-time */
  signedInAt: string;
}

/* -------------------------------------------------------------------------- */
/* Truy van & ket qua                                                          */
/* -------------------------------------------------------------------------- */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EmployeeQuery {
  companyId: string;
  search?: string;
  departmentId?: string | "all";
  status?: EmployeeStatus | "all";
  contractType?: ContractType | "all";
  page?: number;
  pageSize?: number;
}

export interface AttendanceQuery {
  companyId: string;
  employeeId?: string;
  /** "YYYY-MM" */
  month?: string;
  /** "YYYY-MM-DD" */
  date?: string;
}

export interface RequestQuery {
  companyId: string;
  employeeId?: string;
  status?: RequestStatus | "all";
}

/* -------------------------------------------------------------------------- */
/* Du lieu tong hop cho dashboard                                              */
/* -------------------------------------------------------------------------- */

export interface KpiValue {
  value: number;
  /** Chenh lech so voi ngay truoc; duong la tang */
  delta: number;
}

export interface AttendanceChartPoint {
  /** "YYYY-MM-DD" */
  date: string;
  /** Nhan truc hien thi, vi du "T2 21/07" */
  label: string;
  present: number;
  late: number;
  absent: number;
}

export interface TodayActivityItem {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  avatarUrl: string | null;
  checkIn: string | null;
  status: AttendanceStatus;
  location: string;
}

export interface PendingRequestSummary {
  type: RequestType;
  count: number;
}

export interface DashboardSummary {
  date: string;
  totalEmployees: KpiValue;
  checkedIn: KpiValue;
  late: KpiValue;
  onLeave: KpiValue;
  chart: AttendanceChartPoint[];
  todayActivity: TodayActivityItem[];
  pendingRequests: PendingRequestSummary[];
  notCheckedIn: Array<{
    employeeId: string;
    employeeName: string;
    departmentName: string;
    avatarUrl: string | null;
    phone: string;
    shiftName: string;
  }>;
}

/** Tong hop cong thang cua mot nhan vien */
export interface AttendanceDayClassification {
  date: string;
  dayType: "weekday" | "weekend" | "holiday";
  workedMinutes: number;
  nightMinutes: number;
  overtimeMinutes: number;
  overtimeNightMinutes: number;
  /** `null` nghia la THIEU HE SO (D-26), khong phai "khong co tang ca". */
  convertedOvertimeHours: number | null;
  missingMultiplierKeys: OvertimeRuleKey[];
}

export interface MonthlySummary {
  /** "YYYY-MM" */
  month: string;
  workedDays: number;
  totalMinutes: number;
  lateCount: number;
  leaveDays: number;
  /* SET-04 (plan 04-05) — tang ca quy doi theo quy tac doanh nghiep da khai. */
  overtimeMinutes?: number;
  overtimeNightMinutes?: number;
  /** `null` nghia la THIEU HE SO (D-26), khong phai "khong co gio tang ca". */
  convertedOvertimeHours?: number | null;
  missingMultiplierKeys?: OvertimeRuleKey[];
}

/* -------------------------------------------------------------------------- */
/* Input cho cac thao tac ghi                                                  */
/* -------------------------------------------------------------------------- */

export type EmployeeInput = Omit<Employee, "id" | "companyId">;

export type DepartmentInput = Omit<Department, "id" | "companyId">;

export type ShiftInput = Omit<Shift, "id" | "companyId">;

export type WorkSiteInput = Omit<WorkSite, "id" | "companyId" | "createdAt">;

export type HolidayInput = Omit<Holiday, "id" | "companyId">;

export type OvertimeRuleInput = Omit<OvertimeRule, "id" | "companyId">;

/**
 * Dau vao GHI cau hinh — PATCH TUNG PHAN: truong khong gui giu nguyen gia
 * tri cu, khong bi ghi de bang mac dinh. Khong khai `companyId` (D-12b).
 */
export type CompanySettingsInput = Partial<
  Omit<CompanySettings, "companyId" | "updatedAt" | "updatedBy">
>;

export type WorkRequestInput = Pick<
  WorkRequest,
  "type" | "fromDate" | "toDate" | "fromTime" | "toTime" | "reason"
>;

export interface CompanyInput {
  name: string;
  code: string;
  industry: string;
  size: CompanySize;
  phone: string;
  address: string;
}
