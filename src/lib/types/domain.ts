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

/**
 * Hai cach mot ca duoc khai (migration 0027):
 * - `fixed`: co gio vao va gio ra cu the — hanh vi tu dau du an.
 * - `hours`: CA LINH HOAT, chi khai do dai `durationMinutes`. Nhan vien vao ra
 *   luc nao cung duoc; khong tinh di muon, ve som hay "ngoai khung gio ca".
 */
export type ShiftKind = "fixed" | "hours";

export interface Shift {
  id: string;
  companyId: string;
  name: string;
  code: string;
  kind: ShiftKind;
  /** "HH:mm" — `null` o ca linh hoat (`kind === "hours"`) */
  startTime: string | null;
  /** "HH:mm" — co the nho hon startTime neu la ca qua dem; `null` o ca linh hoat */
  endTime: string | null;
  /**
   * Do dai mot ngay lam viec cua CA LINH HOAT, phut — va la so phut LAM VIEC
   * THAT (da tru gio nghi, nen `breakMinutes` cua ca nay luon 0). `null` o ca
   * `fixed`, noi do dai duoc suy tu `startTime`/`endTime`.
   *
   * Dung `shiftScheduledMinutes()` (`src/lib/shifts/schedule.ts`) thay vi doc
   * truong nay truc tiep — no la noi duy nhat biet ca hai loai ca.
   */
  durationMinutes: number | null;
  /**
   * Khung gio nghi giua ca, "HH:mm". `null` khi ca khong co gio nghi — hoac
   * khi ca duoc tao TRUOC migration 0025 va chi con con so `breakMinutes`.
   * Hai truong nay luon di cung nhau (rang buoc o database).
   */
  breakStartTime: string | null;
  breakEndTime: string | null;
  /**
   * DO DAI khoang nghi (phut) — thu ma moi phep tinh cong dung de tru. Tu
   * 0025 day la gia tri DAN XUAT tu khung gio o tren, do duong ghi tinh;
   * khong noi goi nao dat rieng no.
   */
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
  /**
   * SAU TRUONG DUOI DAY KHONG BAT BUOC (migration 0028) — `null` nghia la CHUA
   * KHAI, va khong bao gio duoc thay bang mot gia tri dai dien khi hien thi:
   * mot ngay sinh bia ra khong phan biet duoc voi mot ngay sinh that.
   *
   * `departmentId` va `position` con tham gia phep giai PHAM VI cua phu cap /
   * khau tru: chua khai thi KHONG khop pham vi tuong ung, xem
   * `src/lib/payroll/scope.ts`.
   */
  phone: string | null;
  /** "YYYY-MM-DD" */
  dateOfBirth: string | null;
  gender: Gender | null;
  avatarUrl: string | null;

  departmentId: string | null;
  position: string | null;
  contractType: ContractType | null;
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

/* -------------------------------------------------------------------------- */
/* Muc luong (PAY-06, Phase 5.2)                                               */
/* -------------------------------------------------------------------------- */

/** Ba don vi luong khai duoc cho TUNG NGUOI, khong ep chung ca doanh nghiep (D-37). */
export type PayRateUnit = "month" | "day" | "hour";

/**
 * MOT PHIEN BAN muc luong cua mot nhan vien (bang `employee_pay_rates`). Bang
 * la APPEND-ONLY (D-37a): sua luong nghia la them mot dong moi voi
 * `effectiveFrom` khac, dong cu giu nguyen de bang luong cua ky da tra khong
 * tinh lai ra mot con so khac.
 */
export interface PayRate {
  id: string;
  companyId: string;
  employeeId: string;
  unit: PayRateUnit;
  amount: number;
  /** "YYYY-MM-DD" — ngay bat dau co hieu luc */
  effectiveFrom: string;
  /** ISO date-time */
  createdAt: string;
  createdBy: string | null;
}

/**
 * Lich su muc luong cua MOT nhan vien kem phien ban DANG HIEU LUC hom nay.
 * `current` bang `null` nghia la CHUA KHAI — khong bao gio duoc ngam hieu la
 * 0 (D-26).
 */
export interface PayRateHistory {
  employeeId: string;
  current: PayRate | null;
  versions: PayRate[];
}

/**
 * Lich su muc TANG CA RIENG cua MOT nhan vien (0026). `current` bang `null`
 * nghia la nguoi do KHONG khai muc rieng — ho an theo he so cua doanh nghiep,
 * KHONG phai "tang ca bang 0".
 */
export interface EmployeeOvertimeRateHistory {
  employeeId: string;
  current: EmployeeOvertimeRate | null;
  versions: EmployeeOvertimeRate[];
}

/* -------------------------------------------------------------------------- */
/* Phu cap va khau tru (PAY-04, Phase 5.2)                                     */
/* -------------------------------------------------------------------------- */

/** Cong (`allowance`) hay tru (`deduction`). */
export type PayAdjustmentKind = "allowance" | "deduction";

/**
 * CACH KHAI gia tri, khong phai gia tri da quy doi. `percent_of_daily_wage`
 * tinh tren LUONG NGAY (khong phai luong thang) — quy ra tien la viec cua
 * phep tinh luong, khong phai cua kieu nay.
 */
export type PayAdjustmentValueType = "fixed_amount" | "percent_of_daily_wage";

/**
 * `per_period` ap mot lan cho ca ky; `per_late` nhan voi SO LAN di muon he
 * thong da dem (D-41). `per_late` chi hop le voi `deduction`.
 */
export type PayAdjustmentBasis = "per_period" | "per_late";

/** Bon kieu pham vi. `company` la kieu duy nhat khong mang gia tri. */
export type PayAdjustmentScopeType =
  | "company"
  | "department"
  | "position"
  | "employee";

/**
 * MOT dong pham vi. `include` va `exclude` la HAI CHIEU khac nhau, khong phai
 * hai gia tri cua cung mot danh sach: "toan cong ty tru 3 nguoi" la mot dong
 * include/company cong ba dong exclude/employee (D-40).
 */
export interface PayAdjustmentScope {
  id: string;
  companyId: string;
  adjustmentId: string;
  mode: "include" | "exclude";
  scopeType: PayAdjustmentScopeType;
  /** `null` khi va chi khi `scopeType === "company"`. */
  scopeValue: string | null;
}

/**
 * Mot KHOAN phu cap / khau tru do doanh nghiep tu khai (bang `pay_adjustments`).
 *
 * KHONG CO TRUONG THANG (D-40a): moi khoan ap cho moi ky luong. Gioi han da
 * biet — thuong thang, tam ung, phat mot lan chua nhap duoc; muon cong/tru mot
 * lan thi tao khoan, chay ky, roi tat khoan do.
 */
export interface PayAdjustment {
  id: string;
  companyId: string;
  name: string;
  kind: PayAdjustmentKind;
  valueType: PayAdjustmentValueType;
  value: number;
  basis: PayAdjustmentBasis;
  /** Tat mot khoan KHONG xoa no — ban chot luong cua ky da tra van giu no. */
  isActive: boolean;
  /** ISO date-time */
  createdAt: string;
  scopes: PayAdjustmentScope[];
}

/**
 * Cach doanh nghiep dinh nghia MOT NGAY CONG (D-36). Ba gia tri nay khong
 * phai ba bien the giao dien — chung la ba dinh nghia khac nhau, va doanh
 * nghiep that o Viet Nam dung ca ba.
 */
export type WorkMode = "daily_hours" | "shift" | "shift_hourly";

/**
 * Dau vao ma doanh nghiep chua khai, lam phep quy doi ngay cong khong chay
 * duoc (D-38). Chi mot gia tri o phase nay; danh sach nay la noi cac dau vao
 * bat buoc ve sau duoc them vao.
 */
export type WorkModeMissingInput = "standard_hours_per_day";

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
  /**
   * D-36: cach tinh cong cua doanh nghiep. Mac dinh `shift` — doanh nghiep
   * dang chay giu nguyen hanh vi tu Phase 4.
   */
  workMode: WorkMode;
  /**
   * D-38: MAU SO quy doi mot ngay cong ra gio. `null` nghia la CHUA KHAI —
   * khong phai 0, va khong phai 8. Che do `daily_hours` can con so nay moi
   * chay duoc; noi nao can no ma thay `null` phai noi "chua khai", khong doan.
   */
  standardHoursPerDay: number | null;
  /**
   * D-38: MAU SO quy doi luong thang ra don gia ngay. `null` = CHUA KHAI —
   * 22 hay 26 la chuyen cua tung doanh nghiep (D-26).
   */
  standardDaysPerMonth: number | null;
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

  /* D-36 (plan 05-2-02) — so lieu theo CHE DO TINH CONG cua doanh nghiep. */
  /** Che do da duoc ap de ra cac con so duoi day. */
  workMode?: WorkMode;
  /**
   * So NGAY CONG dung de tinh tien. **Co the la so thap phan** o che do
   * `daily_hours` (D-39). Khac `workedDays` — cai do van la phep dem ngay co
   * gio lam va giu nguyen y nghia cu.
   * `null` nghia la THIEU MAU SO (D-26), khong phai "khong lam ngay nao".
   */
  creditedDays?: number | null;
  /** So phut duoc tra theo don gia THUONG; `null` khi thieu mau so. */
  regularMinutes?: number | null;
  /** Tong so phut thua (duong) / thieu (am) so voi ca — chi khac 0 o `shift_hourly`. */
  hourDeltaMinutes?: number;
  /** Dau vao doanh nghiep chua khai, lam phep quy doi khong chay duoc. */
  missingWorkModeInputs?: WorkModeMissingInput[];
}

/* -------------------------------------------------------------------------- */
/* Bang chuan bi luong                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Mot dong cua bang chuan bi luong: tong hop cong cua MOT nhan vien trong MOT
 * thang, kem ngu canh du de ke toan doi chieu.
 *
 * KHONG CO TRUONG TIEN NAO O DAY, va do la co y. TimeFlow V2 chuan bi DU LIEU
 * CONG cho viec tinh luong, khong tinh luong: gross-net, thue TNCN, BHXH/BHYT/
 * BHTN va phieu luong (nhom PAY) hoan sang V3 vi rui ro nghiep vu cao va can
 * dung luat (xem PROJECT.md §Out of Scope). Them mot cot tien vao day ma chua
 * co mo hinh luong la hua mot thu san pham chua lam duoc.
 */
export interface PayrollPrepRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  workedDays: number;
  totalMinutes: number;
  lateCount: number;
  leaveDays: number;
  overtimeMinutes: number;
  overtimeNightMinutes: number;
  /** `null` nghia la THIEU HE SO (D-26), khong phai "khong co gio tang ca". */
  convertedOvertimeHours: number | null;
  missingMultiplierKeys: OvertimeRuleKey[];
  /**
   * D-36/D-39: so ngay cong theo CHE DO tinh cong cua doanh nghiep — **co the
   * la so thap phan**. `null` = thieu mau so quy doi (D-38).
   */
  creditedDays: number | null;
  regularMinutes: number | null;
  hourDeltaMinutes: number;
  missingWorkModeInputs: WorkModeMissingInput[];

  /* PAY-01 (plan 05-2-04) — PHAN TIEN.
   *
   * MOI truong duoi day co the la `null`, va `null` KHONG BAO GIO duoc hien
   * thanh 0: mot so 0 trong bang luong doc nhu mot su that ("nguoi nay khong
   * duoc tra gi") va nguoi ky duyet se ky. `missing` noi ro thieu gi.
   *
   * Con so o day CHUA GOM thue TNCN va BHXH/BHYT/BHTN (ngoai pham vi V2).
   */
  /**
   * MUC LUONG DA AP cho ky nay (hieu luc tai ngay cuoi ky). `null` = chua khai.
   * Co mat o hop dong de ban chot (D-42) chep lai duoc, va de man hinh giai
   * thich duoc con so ma khong phai doc them mot duong nua.
   */
  payUnit: PayRateUnit | null;
  payAmount: number | null;
  /**
   * MUC TANG CA RIENG da ap cho dong nay (0026). `null` = nguoi nay an theo
   * he so cua doanh nghiep. Tuy chon vi ban CHOT luong (payroll_run_lines)
   * chua co cot luu hai gia tri nay — ky da chot tra ve `undefined`.
   */
  overtimeRateValueType?: OvertimeRateValueType | null;
  overtimeRateValue?: number | null;
  /**
   * CHI TIET THEO NGAY. Ba con so tien duoi day la TONG cua mang nay, nen man
   * hinh doi chieu duoc ma khong phai tinh lai gi.
   */
  days: PayrollDayLine[];
  basePay: number | null;
  overtimePay: number | null;
  /** Cong/tru theo gio thuc te — chi khac 0 o che do `shift_hourly`. */
  hourAdjustment: number | null;
  allowanceItems: PayrollAdjustmentItem[];
  deductionItems: PayrollAdjustmentItem[];
  allowanceTotal: number | null;
  deductionTotal: number | null;
  /** THUC NHAN = luong goc + tang ca + lech gio + phu cap − khau tru. */
  netPay: number | null;
  /** Ly do khien dong nay khong ra duoc con so; rong khi du du kien. */
  missing: string[];
}

/**
 * TIEN CUA MOT NGAY trong mot dong luong.
 *
 * Kieu duoc khai O DAY chu khong import tu `@/lib/payroll/compute-daily`: file
 * nay khong import gi ca (moi kieu nghiep vu tu chua), va `compute-daily.ts`
 * thi import NGUOC lai tu day — dat kieu o ben kia se tao mot vong.
 *
 * `DailyPayLine` cua `compute-daily.ts` gan duoc vao kieu nay: no siet `missing`
 * chat hon (`PayrollMissingInput[]` thay vi `string[]`), cung khuon voi truong
 * `missing` cua `PayrollPrepRow` ngay tren.
 */
export interface PayrollDayLine {
  /** "YYYY-MM-DD" */
  date: string;
  dayType: "weekday" | "weekend" | "holiday";
  /**
   * `in_progress` = da cham vao chua cham ra. KHAC HAN voi thieu du kien: ngay
   * nay chua co con so, chu khong phai khong tinh duoc con so — no khong keo
   * ca ky thanh `null`.
   */
  state: "counted" | "in_progress" | "leave_paid" | "leave_unpaid";
  /** Co the la so thap phan o che do `daily_hours` (D-39). */
  creditedDays: number | null;
  regularMinutes: number | null;
  overtimeMinutes: number;
  convertedOvertimeHours: number | null;
  hourDeltaMinutes: number;
  basePay: number | null;
  overtimePay: number | null;
  hourAdjustment: number | null;
  /** Tong ba con so tien DA LAM TRON o tren. */
  dayTotal: number | null;
  missing: string[];
}

/** Mot khoan da quy ra tien trong mot dong luong. */
export interface PayrollAdjustmentItem {
  adjustmentId: string;
  name: string;
  amount: number;
  /** So lan nhan — `per_late` nhan voi so lan di muon; 1 voi `per_period`. */
  multiplier: number;
}

/**
 * Trang thai CHOT LUONG cua mot ky (D-42) — khac `periodStatus` (chot KY CONG).
 *
 * `closed` nghia la con so da duoc dong khung: bang luong doc tu BAN CHOT, va
 * doi muc luong hom nay khong lam doi con so cua ky nay.
 */
export type PayrollStatus = "open" | "closed";

/** Bang chuan bi luong cua mot thang. */
export interface PayrollPrep {
  /** "YYYY-MM" */
  month: string;
  /** D-36: che do tinh cong dang ap cho ca bang (lua chon cua doanh nghiep). */
  workMode: WorkMode;
  /**
   * D-42. `closed` -> moi con so duoi day den tu BAN CHOT, khong tinh lai.
   * `open` -> tinh luc truy van tu cau hinh hien tai.
   */
  payrollStatus: PayrollStatus;
  /** ISO date-time, chi co khi `payrollStatus === "closed"`. */
  payrollClosedAt: string | null;
  payrollClosedBy: string | null;
  /**
   * Trang thai ky cong cua thang do; `null` khi ky chua ton tai trong bang.
   * `closed` nghia la so lieu da khoa (PERD-02) — day la dieu ke toan can biet
   * TRUOC KHI dua con so nay di dau: mot ky dang mo van con doi duoc.
   */
  periodStatus: PeriodStatus | null;
  rows: PayrollPrepRow[];
}

/* -------------------------------------------------------------------------- */
/* Phieu luong cua nhan vien (PAY-05)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Mot ky da chot luong ma nguoi dang nhap CO phieu — dung cho danh sach.
 *
 * Chi ba truong: mot danh sach chi de tra loi "thang nao co phieu, va thang do
 * toi nhan bao nhieu". Moi thu khac thuoc ve man hinh chi tiet.
 */
export interface PayslipSummary {
  /** "YYYY-MM" */
  month: string;
  /** ISO date-time — thoi diem doanh nghiep chot luong ky nay. */
  closedAt: string;
  netPay: number;
}

/**
 * Phieu luong day du cua MOT ky, doc tu BAN CHOT (`payroll_lines`).
 *
 * ======================================================================
 * VI SAO KHONG DUNG LAI `PayrollPrepRow`
 * ======================================================================
 *
 * Hai hinh dang cho ra gan nhu cung mot tap so, nhung `PayrollPrepRow` mang
 * theo ba truong chi co nghia o man hinh CHUAN BI cua quan tri:
 * `missingMultiplierKeys`, `missingWorkModeInputs`, `missing`. O mot ban chot
 * ca ba luon rong — do la mot bat bien duoc cuong che o `closePayroll`, khong
 * phai mot su trung hop.
 *
 * Day chung xuong app nhan vien la day mot khai niem KHONG THUOC VE do ("dong
 * nay con thieu du kien de tinh") vao mot man hinh ma no khong bao gio dung.
 * Mot kieu rieng dat hon vai dong khai bao, va doi lai man hinh khong co cach
 * nao render mot trang thai khong ton tai.
 *
 * MOI CON SO O DAY DEU LA ANH CHUP. Khong truong nao duoc suy lai luc doc —
 * suy lai se lam no doi theo du lieu cua HOM NAY trong khi cac cot tien thi
 * khong, va mot phieu tu mau thuan voi chinh no la thu te hon ca mot phieu sai.
 */
export interface Payslip {
  /** "YYYY-MM" */
  month: string;
  closedAt: string;

  /* Danh tinh tai THOI DIEM CHOT — nguoi co the doi ten hoac doi phong ban. */
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;

  /* Muc luong da ap cho ky nay. */
  payUnit: PayRateUnit;
  payAmount: number;

  /* So lieu cong da dung de ra con so tien. */
  workedDays: number;
  totalMinutes: number;
  leaveDays: number;
  lateCount: number;
  overtimeMinutes: number;
  /** Gio tang ca SAU khi nhan he so — day moi la phan tham gia vao tien. */
  convertedOvertimeHours: number;

  /* Tien. */
  basePay: number;
  overtimePay: number;
  /** Lech gio o che do `shift_hourly`; am khi lam thieu so voi chuan. */
  hourAdjustment: number;
  allowanceItems: PayrollAdjustmentItem[];
  deductionItems: PayrollAdjustmentItem[];
  allowanceTotal: number;
  deductionTotal: number;
  /** THUC NHAN = luong goc + tang ca + lech gio + phu cap − khau tru. */
  netPay: number;
}

/* -------------------------------------------------------------------------- */
/* Input cho cac thao tac ghi                                                  */
/* -------------------------------------------------------------------------- */

export type EmployeeInput = Omit<Employee, "id" | "companyId">;

export type DepartmentInput = Omit<Department, "id" | "companyId">;

/**
 * `breakMinutes` KHONG nam trong duong ghi: tu migration 0025 no la gia tri
 * dan xuat tu khung gio nghi, do `shiftInputSchema` tinh. Cho phep noi goi
 * truyen no vao la mo duong cho hai gia tri lech nhau.
 */
/**
 * Hai cach khai tien tang ca cua MOT NGUOI (migration 0026).
 *
 * `multiplier`   — he so nhan voi don gia gio cua chinh nguoi do (1,5 = 150%).
 * `fixed_hourly` — SO TIEN mot gio tang ca. Doi luong co ban khong lam doi con
 *                  so nay cho toi khi khai mot phien ban moi.
 */
export type OvertimeRateValueType = "multiplier" | "fixed_hourly";

/**
 * MOT PHIEN BAN muc tang ca rieng cua mot nhan vien. Bang APPEND-ONLY nhu
 * `employee_pay_rates` (D-37a) va vi cung mot ly do: sua de mot dong cu lam
 * tien da tra cua ky da qua tinh lai ra con so khac.
 *
 * Muc nay ap cho MOI gio tang ca cua nguoi do va THAY CHO he so theo loai
 * ngay cua doanh nghiep. Khong khai thi ho an theo he so doanh nghiep.
 */
export interface EmployeeOvertimeRate {
  id: string;
  companyId: string;
  employeeId: string;
  valueType: OvertimeRateValueType;
  /** He so (vi du 1.5) hoac so tien mot gio (vi du 60000) — theo `valueType`. */
  value: number;
  /** "YYYY-MM-DD" — ngay bat dau co hieu luc */
  effectiveFrom: string;
  /** ISO date-time */
  createdAt: string;
  createdBy: string | null;
}

export type ShiftInput = Omit<Shift, "id" | "companyId" | "breakMinutes">;

export type WorkSiteInput = Omit<WorkSite, "id" | "companyId" | "createdAt">;

export type HolidayInput = Omit<Holiday, "id" | "companyId">;

export type OvertimeRuleInput = Omit<OvertimeRule, "id" | "companyId">;

/**
 * Dau vao GHI muc luong — luon la MOT PHIEN BAN MOI (D-37a). Khong khai
 * `companyId` (D-12b); `createdAt`/`createdBy` do database va phien quyet
 * dinh, khong nhan tu client (D-19).
 */
export type PayRateInput = Omit<
  PayRate,
  "id" | "companyId" | "createdAt" | "createdBy"
>;

/** Dau vao GHI muc tang ca rieng — cung quy uoc voi `PayRateInput`. */
export type EmployeeOvertimeRateInput = Omit<
  EmployeeOvertimeRate,
  "id" | "companyId" | "createdAt" | "createdBy"
>;

/** MOT dong pham vi trong dau vao ghi — chua co `id`, chua gan vao khoan nao. */
export type PayAdjustmentScopeInput = Pick<
  PayAdjustmentScope,
  "mode" | "scopeType" | "scopeValue"
>;

/**
 * Dau vao GHI mot khoan, KEM TOAN BO tap pham vi. Pham vi la mot TAP chu khong
 * phai mot chuoi lich su, nen duong ghi nhan ca tap moi lan chu khong nhan
 * tung phep them/bot.
 */
export type PayAdjustmentInput = Omit<
  PayAdjustment,
  "id" | "companyId" | "createdAt" | "scopes"
> & {
  scopes: PayAdjustmentScopeInput[];
};

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
