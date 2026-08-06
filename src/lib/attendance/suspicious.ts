/**
 * Module thuan (khong phu thuoc React, khong cham database) cho quy tac
 * "danh dau dang ngo" cua D-21/ATT-07 — lop phat hien GIAN cua toan phase
 * sau khi D-20 bien "trong ban kinh" tu dieu kien chan thanh mot ghi chu
 * (xem REQUIREMENTS.md §ATT-02 ghi chu thu hep 2026-08-02). Day la NGUON DUY
 * NHAT cua nguong va ham quyet dinh nay trong toan repo — 03-01/03-03 tam
 * khai mot ban sao cuc bo trong `mutations/attendance.ts` de co banner tuc
 * thi; module nay la noi so huu chinh thuc, mutations/attendance.ts (Rule 1
 * cua plan nay) chuyen sang IMPORT hang so o day thay vi tu khai lai.
 */

/**
 * Nguong danh dau dang ngo, boi so cua BAN KINH work_site gan nhat.
 *
 * (1) TU PLAN 04-01 (D-29), day KHONG con la nguong van hanh — no la GIA TRI
 *     MAC DINH dung khi doanh nghiep chua khai gi. Nguong that nam o cot
 *     `company_settings.suspicious_distance_multiplier` va duoc truyen vao
 *     `isSuspiciousPunch()` qua tham so `multiplier`. Day la lan dong lai cua
 *     loi hua D-21a ("nguong khong duoc nhung cung") ma Phase 3 de lai.
 * (2) Doanh nghiep co chi nhanh xa nhau (kho, nha may) can noi rong nguong
 *     nay — 5 lan ban kinh la mot gia tri KHOI DIEM hop ly, khong phai mot
 *     con so tuyet doi dung cho moi doanh nghiep. Gio ho tu noi duoc o
 *     `/admin/settings`.
 * (3) Day la nguong de HOI, khong phai nguong de KET LUAN. Vuot nguong chi
 *     co nghia "dang vao danh sach can nguoi xem lai" — KHONG co nghia "day
 *     la gian lan". GPS trong nha xuong sai 20-50m, nhan vien co the dang di
 *     cong tac, hoac diem lam viec bi khai sai toa do — ba kha nang nay deu
 *     that hon kha nang gian lan trong da so truong hop.
 */
export const SUSPICIOUS_DISTANCE_MULTIPLIER = 5;

export interface IsSuspiciousPunchInput {
  /** met, do server tinh qua tf_distance_meters() — null nghia la CHUA do duoc (chua co diem lam viec nao) */
  distanceMeters: number | null;
  /** met, ban kinh cua work_site GAN NHAT voi lan cham nay */
  radiusMeters: number | null;
  /** Employee.canCheckInRemotely — nhan vien duoc phep cham cong ngoai dia diem */
  canCheckInRemotely: boolean;
  /**
   * Boi so nguong cua CHINH doanh nghiep do
   * (`company_settings.suspicious_distance_multiplier`). Khong truyen thi
   * dung `SUSPICIOUS_DISTANCE_MULTIPLIER` — chi de call site cu (va test)
   * khong phai khai lai gia tri mac dinh, KHONG phai de tang du lieu duoc
   * phep bo qua cau hinh.
   */
  multiplier?: number;
}

/**
 * MOT ham quyet dinh duy nhat cho toan bo lop phat hien cua D-21/ATT-07.
 *
 * - `canCheckInRemotely` bang `true` LOAI nhan vien do khoi dieu kien dang
 *   ngo VO DIEU KIEN, du khoang cach lon toi dau: truong nay da ton tai tu V1
 *   va giao dien nhan vien (`attendance-status-card.tsx` dong 198-200) da
 *   HUA voi ho rang ho duoc phep cham cong ngoai dia diem. Dua ho vao danh
 *   sach can xem lai vua trai loi hua do, vua lam danh sach day NHIEU toi
 *   muc quan tri ngung doc — va sau D-20 day la lop phat hien CHINH, nen lam
 *   no thanh nhieu la go bo bien phap kiem soat duy nhat con lai trong khi
 *   van de nguyen ve ngoai cua no (T-03-06-02). Khoang cach cua ho VAN duoc
 *   GHI (distance_meters khong doi) va van xem lai duoc tu ho so ca nhan —
 *   CHI dieu kien loc cua danh sach nay loai ho ra.
 * - `distanceMeters` bang `null` (doanh nghiep chua khai diem lam viec nao,
 *   hoac ban ghi tao truoc phase nay) tra `false` — THIEU phep do KHONG PHAI
 *   bang chung cua bat thuong, no chi la thieu du lieu.
 * - `radiusMeters` bang `null` hoac `0` tra `false` — khong co moc thi khong
 *   co boi so nao co nghia de so sanh.
 * - Bien: khoang cach BANG DUNG ban kinh nhan nguong tra `false` — "qua xa"
 *   la LON HON nguong, khong phai BANG nguong.
 */
export function isSuspiciousPunch(input: IsSuspiciousPunchInput): boolean {
  const {
    distanceMeters,
    radiusMeters,
    canCheckInRemotely,
    multiplier = SUSPICIOUS_DISTANCE_MULTIPLIER,
  } = input;

  if (canCheckInRemotely) return false;
  if (distanceMeters === null) return false;
  if (radiusMeters === null || radiusMeters === 0) return false;
  // Nguong <= 0 la du lieu cau hinh hong (rang buoc CHECK cua migration 0015
  // khong cho, nhung ham nay khong duoc phep tin dieu do): coi nhu khong co
  // nguong thay vi bien MOI lan cham thanh dang ngo.
  if (multiplier <= 0) return false;

  return distanceMeters > radiusMeters * multiplier;
}

/**
 * Boi so khoang cach/ban kinh, lam tron toi MOT chu so thap phan — dung de
 * HIEN THI (vi du "gap 6.2 lan ban kinh"), khong dung de quyet dinh (quyet
 * dinh la viec cua `isSuspiciousPunch`, dung phep so sanh nguyen, khong qua
 * mot gia tri da lam tron trung gian). Tra `null` khi thieu mot trong hai
 * dau vao — khong co gi de hien thi thi tra `null`, khong bia mot con so 0
 * gay hieu nham "khong lech".
 */
export function suspiciousMultiplier(
  distanceMeters: number | null,
  radiusMeters: number | null,
): number | null {
  if (distanceMeters === null || radiusMeters === null || radiusMeters === 0) {
    return null;
  }
  return Math.round((distanceMeters / radiusMeters) * 10) / 10;
}

/* -------------------------------------------------------------------------- */
/* Ngoai khung gio ca — tin hieu thu hai cua danh sach "Can xem lai"          */
/* -------------------------------------------------------------------------- */

/**
 * Bien do noi rong hai dau khung gio ca. CO CHU DICH rong: mot he thong danh
 * dau nguoi den som muoi phut la mot he thong ma quan ly se ngung doc danh
 * sach. 120 phut du rong de khong hoi nguoi den chuan bi som hay con nan lai
 * xu ly viec cuoi ca, nhung van nhan ra duoc lan cham cong o mot khung gio
 * hoan toan khac ca duoc phan.
 *
 * Truoc day hang so nay nam o `mutations/attendance.ts` va dung de TU CHOI
 * cham cong. Gio no chi de HOI (cung khuon voi `SUSPICIOUS_DISTANCE_MULTIPLIER`
 * o tren).
 *
 * TU PLAN 04-01 (D-29): day la GIA TRI MAC DINH khi doanh nghiep chua khai.
 * Bien do that nam o `company_settings.shift_window_grace_minutes` va di vao
 * day qua tham so `graceMinutes` co san cua `isOutsideShiftWindow()`.
 */
export const SHIFT_WINDOW_GRACE_MINUTES = 120;

const MINUTES_PER_DAY = 1440;

function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/** Khoang cach xuoi chieu tu `from` toi `to` theo phut, vong qua nua dem. */
function forwardMinutes(from: string, to: string): number {
  const diff = timeToMinutes(to) - timeToMinutes(from);
  return diff >= 0 ? diff : diff + MINUTES_PER_DAY;
}

export interface IsOutsideShiftWindowInput {
  /** Gio cham cong theo gio Viet Nam, "HH:mm" (chinh la `AttendanceRecord.checkIn`). */
  punchTime: string;
  /** "HH:mm" */
  shiftStartTime: string;
  /** "HH:mm" — co the nho hon `shiftStartTime` neu la ca qua dem. */
  shiftEndTime: string;
  graceMinutes?: number;
}

/**
 * Lan cham cong nay co nam ngoai khung gio ca duoc phan khong?
 *
 * Lam viec tren "HH:mm" theo gio Viet Nam — chinh la dang ma
 * `attendanceRecordSchema` da chuyen `check_in_at` sang. Nho vay khong noi
 * nao phai tu lam phep doi mui gio (quy uoc cua du an: moi phep tinh gio di
 * qua RPC cua database, khong tu viet lai o tang ung dung).
 *
 * Ca QUA DEM duoc xu ly bang phep do XUOI CHIEU tu gio bat dau ca: moi moc
 * deu quy ve "bao nhieu phut sau khi ca bat dau", vong qua nua dem, nen
 * khong can nhanh rieng cho ca qua dem.
 */
export function isOutsideShiftWindow({
  punchTime,
  shiftStartTime,
  shiftEndTime,
  graceMinutes = SHIFT_WINDOW_GRACE_MINUTES,
}: IsOutsideShiftWindowInput): boolean {
  const shiftMinutes = forwardMinutes(shiftStartTime, shiftEndTime);
  const offset = forwardMinutes(shiftStartTime, punchTime);

  // Trong ca (tinh tu luc bat dau) cong bien do sau khi ca ket thuc.
  if (offset <= shiftMinutes + graceMinutes) return false;
  // Truoc gio bat dau ca trong pham vi bien do — do dac xuoi chieu nen "som
  // 30 phut" hien ra thanh 1410 phut, tuc gan het mot vong ngay.
  if (offset >= MINUTES_PER_DAY - graceMinutes) return false;

  return true;
}

/**
 * KHONG CO HAM NAO trong module nay nhan HAI lan cham lien tiep lam dau
 * vao. Cach do theo TOC DO DI CHUYEN giua hai lan cham da bi BAC BO tuong
 * minh (REQUIREMENTS.md §ATT-07, ghi chu "Sua cach do ngay 2026-08-02"):
 * chuoi cham cong cua san pham LUON la vao roi ra, cach nhau TRON MOT CA
 * (vi du 8 tieng), du thoi gian di bat cu dau trong Viet Nam — nen mot luat
 * theo toc do gan nhu KHONG BAO GIO kich hoat. Mot luat khong bao gio chay
 * TE HON khong co luat nao ca, vi no tao cam giac an toan gia (D-21b). Day
 * KHONG PHAI mot thieu sot can bo sung sau — day la mot ranh gioi CO CHU Y,
 * ghi lai o day de khong ai vo tinh them lai mot ham "khoang cach giua hai
 * lan cham" vao module nay trong tuong lai.
 */
