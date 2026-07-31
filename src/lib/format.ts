import {
  DEFAULT_LOCALE,
  WEEKDAY_LABEL_LONG,
} from "@/lib/constants";
import type { WeekdayNumber } from "@/lib/types/domain";

/* -------------------------------------------------------------------------- */
/* Ngay thang — lam viec truc tiep tren chuoi "YYYY-MM-DD" de tranh lech       */
/* mui gio giua server (UTC) va trinh duyet (Asia/Ho_Chi_Minh).                */
/* -------------------------------------------------------------------------- */

/** "2026-07-27" -> "27/07/2026" */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

/** "2026-07-27" -> "27/07" */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  if (!month || !day) return isoDate;
  return `${day}/${month}`;
}

/** "2026-07" -> "Tháng 07/2026" */
export function formatMonthLabel(isoMonth: string): string {
  const [year, month] = isoMonth.split("-");
  if (!year || !month) return isoMonth;
  return `Tháng ${month}/${year}`;
}

/** So thu tu ngay trong tuan theo chuan ISO: 1 = Thứ Hai ... 7 = Chủ Nhật */
export function getWeekday(isoDate: string): WeekdayNumber {
  const [year, month, day] = isoDate.split("-").map(Number);
  // Date.UTC de khong bi anh huong boi mui gio may chu
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (jsDay === 0 ? 7 : jsDay) as WeekdayNumber;
}

/** "2026-07-27" -> "Thứ Hai" */
export function formatWeekday(isoDate: string): string {
  return WEEKDAY_LABEL_LONG[getWeekday(isoDate)];
}

/** "2026-07-27" -> "Thứ Hai 27/07/2026" */
export function formatFullDate(isoDate: string): string {
  return `${formatWeekday(isoDate)} ${formatDate(isoDate)}`;
}

/** Cong them so ngay vao mot chuoi ngay ISO */
export function addDays(isoDate: string, amount: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return toIsoDate(next);
}

/** Doi doi tuong Date (theo UTC) sang "YYYY-MM-DD" */
export function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "2026-07" -> so ngay trong thang */
export function daysInMonth(isoMonth: string): number {
  const [year, month] = isoMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Danh sach toan bo ngay cua mot thang duoi dang "YYYY-MM-DD" */
export function listMonthDates(isoMonth: string): string[] {
  const total = daysInMonth(isoMonth);
  return Array.from(
    { length: total },
    (_, index) => `${isoMonth}-${`${index + 1}`.padStart(2, "0")}`,
  );
}

/** "2026-07" +/- so thang */
export function shiftMonth(isoMonth: string, amount: number): string {
  const [year, month] = isoMonth.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${next.getUTCFullYear()}-${`${next.getUTCMonth() + 1}`.padStart(2, "0")}`;
}

/** "2026-07-27" -> "2026-07" */
export function toIsoMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/* -------------------------------------------------------------------------- */
/* Gio va thoi luong                                                          */
/* -------------------------------------------------------------------------- */

/** Chuan hoa "8:5" -> "08:05" */
export function formatTime(time: string | null): string {
  if (!time) return "--:--";
  const [hour, minute] = time.split(":");
  if (hour === undefined || minute === undefined) return time;
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/** "08:30" -> 510 */
export function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/** 510 -> "08:30" */
export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = `${Math.floor(normalized / 60)}`.padStart(2, "0");
  const minute = `${normalized % 60}`.padStart(2, "0");
  return `${hour}:${minute}`;
}

/** 505 -> "8 giờ 25 phút" */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 phút";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} phút`;
  if (minutes === 0) return `${hours} giờ`;
  return `${hours} giờ ${minutes} phút`;
}

/** 505 -> "8h25" — ban gon dung trong bang */
export function formatDurationShort(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0h00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = `${totalMinutes % 60}`.padStart(2, "0");
  return `${hours}h${minutes}`;
}

/**
 * So phut giua hai moc gio, tu dong xu ly ca qua dem
 * ("22:00" -> "06:00" cho ra 480 phut).
 */
export function minutesBetween(start: string, end: string): number {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  return endMinutes > startMinutes
    ? endMinutes - startMinutes
    : endMinutes + 1440 - startMinutes;
}

/** Ca ket thuc vao ngay hom sau hay khong */
export function isOvernight(start: string, end: string): boolean {
  return timeToMinutes(end) <= timeToMinutes(start);
}

/* -------------------------------------------------------------------------- */
/* Tien te va so lieu                                                          */
/* -------------------------------------------------------------------------- */

const numberFormatter = new Intl.NumberFormat(DEFAULT_LOCALE);

/** 12500000 -> "12.500.000 ₫" */
export function formatVnd(amount: number): string {
  return `${numberFormatter.format(Math.round(amount))} ₫`;
}

/** 1234 -> "1.234" */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** 3 -> "+3" ; -2 -> "-2" ; 0 -> "0" */
export function formatDelta(value: number): string {
  if (value > 0) return `+${formatNumber(value)}`;
  return formatNumber(value);
}

/* -------------------------------------------------------------------------- */
/* Van ban                                                                     */
/* -------------------------------------------------------------------------- */

/** "Nguyễn Minh Anh" -> "NA" */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return `${first}${last}`.toUpperCase();
}

/** "Nguyễn Minh Anh" -> "Anh" */
export function getShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : fullName;
}

/** Dau thanh dieu to hop (U+0300 - U+036F) */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Bo dau tieng Viet de tim kiem khong phan biet dau */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/** Loi chao theo gio trong ngay */
export function greetingByHour(hour: number): string {
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 13) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/** ISO date-time -> "27/07/2026 lúc 08:05" */
export function formatDateTime(isoDateTime: string): string {
  const [datePart, timePart] = isoDateTime.split("T");
  if (!datePart || !timePart) return isoDateTime;
  return `${formatDate(datePart)} lúc ${timePart.slice(0, 5)}`;
}

/** Khoang cach tuong doi don gian, so voi ngay tham chieu */
export function formatRelativeDay(isoDate: string, today: string): string {
  if (isoDate === today) return "Hôm nay";
  if (isoDate === addDays(today, -1)) return "Hôm qua";
  if (isoDate === addDays(today, 1)) return "Ngày mai";
  return formatDate(isoDate);
}
