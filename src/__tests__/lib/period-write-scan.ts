/**
 * Bo quet "khong duong ghi thang nao vao du lieu cham cong" (Phase 5, plan
 * 05-06).
 *
 * Tach ra khoi file test de chinh no kiem duoc BANG MOT MAU VI PHAM GIA LAP —
 * mot cong chua tung bao do la mot cong chua duoc chung minh la con thuc (cung
 * khuon `work-rule-scan.ts` cua 04-06 va `route-handler-check.ts` cua 02-04).
 *
 * VI SAO CAN CONG NAY
 *
 * PERD-02 noi rang sau khi chot ky, moi thay doi vao du lieu cua ky chi di
 * duoc qua mot yeu cau duoc duyet. Trigger `attendance_period_guard` (0021)
 * cuong che dieu do o database — nhung no chi biet ky NAO DA CHOT. Bat bien
 * rong hon ma phase nay dung len la: **phan ghi vao `attendance_records` phai
 * tap trung o mot vai cho co ten**, chu khong rai rac o bat ky Server Action
 * nao ai do viet sau nay.
 *
 * Mot `insert` tien tay o mot plan tuong lai se khong bi trigger chan chung
 * nao ky con dang mo — va den luc ky bi chot thi no thanh mot loi chay that.
 * Cong nay bat dieu do o luc viet ma, khong phai o luc chay.
 *
 * QUET TREN MA DA BO COMMENT NHUNG GIU NOI DUNG CHUOI. Khac 04-06 o dung diem
 * nay, va la mot khac biet BAT BUOC: ten bang nam BEN TRONG mot chuoi
 * (`from("attendance_records")`), nen bo noi dung chuoi la lam cong mu hoan
 * toan. Comment thi van phai bo — chinh file nay va cac file mutation deu
 * nhac ten bang trong comment giai thich quy tac.
 */

import { stripComments } from "@/__tests__/lib/work-rule-scan";

export interface PeriodWriteViolation {
  line: number;
  text: string;
}

/**
 * Mot lenh GHI vao `attendance_records` qua PostgREST.
 *
 * Doi CA HAI thu tren cung mot dong: ten bang VA mot dong tu ghi. Chi ten bang
 * la khong du — `from("attendance_records").select(...)` la mot phep DOC, va
 * moi duong doc cua Phase 3/4 deu dung no.
 */
const WRITE_PATTERN =
  /from\(\s*(["'`])attendance_records\1\s*\)[\s\S]{0,80}?\.(insert|update|upsert|delete)\s*\(/;

/**
 * Cac file DUOC PHEP ghi thang, kem LY DO. Toi da 3 muc (acceptance criteria
 * 05-06) — danh sach nay chi duoc thu hep, khong duoc noi rong de lam cong
 * xanh.
 *
 * Chu y no chi co MOT muc: duong yeu cau duoc duyet KHONG nam o day, vi no
 * khong ghi thang — toan bo phan ghi cua no nam trong `tf_apply_approved_request()`
 * (D-32a), va do chinh la dieu lam no di qua duoc trigger cua ky da chot.
 */
export const PERIOD_WRITE_EXEMPTIONS: Array<{ path: string; reason: string }> = [
  {
    path: "src/lib/data/mutations/attendance.ts",
    reason:
      "checkIn/checkOut — duong ghi cham cong hang ngay cua nhan vien. Ky dang mo thi ghi binh thuong; ky da chot thi chinh trigger 0021 tu choi va lop dich loi o period-guard.ts doi thanh mot cau noi duoc.",
  },
];

export function isPeriodWriteExempt(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return PERIOD_WRITE_EXEMPTIONS.some((item) => normalized === item.path);
}

/**
 * Quet mot file; tra ve cac dong co lenh ghi vao `attendance_records`.
 *
 * Quet theo TUNG DONG nhung doi chieu tren mot cua so noi lien nhieu dong (cac
 * lenh PostgREST thuong duoc xuong dong sau moi `.method()`), nen mau duoc ap
 * len chuoi ghep tu dong hien tai va vai dong sau no.
 */
export function scanPeriodWriteSource(source: string): PeriodWriteViolation[] {
  const lines = stripComments(source);
  const violations: PeriodWriteViolation[] = [];

  lines.forEach((line, index) => {
    if (!/from\(\s*(["'`])attendance_records\1\s*\)/.test(line)) return;
    // Noi voi bon dong ke tiep: du de bat mot chuoi
    // `.from(...)` -> `.insert({...})` xuong dong, va khong dai toi muc vo
    // tinh nuot mot lenh khac o duoi.
    const window = lines.slice(index, index + 5).join("\n");
    if (WRITE_PATTERN.test(window)) {
      violations.push({ line: index + 1, text: line.trim() });
    }
  });

  return violations;
}
