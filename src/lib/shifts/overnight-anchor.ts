/**
 * Ca qua dem: gio bat dau ca THEO KE HOACH roi vao NGAY LICH nao?
 *
 * VAN DE
 * `checkIn()` do di muon bang `now - tf_local_instant(work_date, start_time)`.
 * Voi ca trong ngay thi dung. Voi ca QUA DEM (22:00-06:00) va mot luot cham
 * sau nua dem, no sai han mot ngay: `work_date` cua khoanh khac 00:09 la ngay
 * HOM NAY (D-08 — ngay cong cua mot khoanh khac la ngay lich cua chinh no, ep
 * bang CHECK constraint o `0004_core_entities.sql:109`), nen gio bat dau ca
 * giai ra la 22:00 TOI NAY — mot moc trong TUONG LAI. So phut muon thanh am,
 * bi kep ve 0, va nguoi vao muon hai tieng duoc ghi `on_time`.
 *
 * QUY TAC
 * Voi ca qua dem, mot luot cham xay ra TRUOC gio KET THUC ca cua ngay cong
 * dang nam o NUA SAU cua khung gio ca — tuc ca do da bat dau TU HOM QUA.
 *
 *   ca 22:00-06:00, cham 00:09 (truoc 06:00 hom nay) -> bat dau 22:00 HOM QUA
 *   ca 22:00-06:00, cham 21:55 (sau  06:00 hom nay)  -> bat dau 22:00 HOM NAY
 *   ca 08:00-17:00 (khong qua dem)                    -> luon HOM NAY
 *
 * VI SAO SO HAI KHOANH KHAC CHU KHONG SO GIO-TRONG-NGAY
 * Suy "gio trong ngay theo gio VN" o tang JavaScript se dung `tf_tz()` lan
 * thu hai o mot noi khac — dung dieu `src/lib/today.ts` va `0003_enums_time.sql`
 * cam. Hai moc duoi day deu la `timestamptz` do CHINH database cap
 * (`tf_server_now`, `tf_local_instant`), nen phep so sanh la so hai diem
 * tuyet doi tren truc thoi gian: khong co mui gio nao tham gia.
 *
 * HAM NAY KHONG DUNG TOI `work_date` VA KHONG DUNG TOI D-08.
 * `work_date` van la ngay lich cua khoanh khac cham vao, y nguyen. Thu duy
 * nhat doi la MOC DUOC DEM MUON SO VOI — mot phep do, khong phai mot cach
 * phan loai ngay cong.
 */

export interface OvernightAnchorInput {
  /** Cot SINH cua bang `shifts` (`end_time < start_time`) — doc lai, khong tinh lai. */
  overnight: boolean;
  /** `tf_server_now()` — khoanh khac cua luot cham, ISO timestamptz. */
  punchInstant: string;
  /**
   * `tf_local_instant(work_date, shift.end_time)` — gio KET THUC ca dat tren
   * chinh ngay cong. `null` o ca linh hoat (khong co gio ket thuc).
   */
  shiftEndInstantOnWorkDate: string | null;
}

/**
 * `-1` neu gio bat dau ca nam o NGAY HOM TRUOC so voi ngay cong, `0` neu cung
 * ngay. Noi goi cong so nay vao `work_date` truoc khi giai gio bat dau ca.
 *
 * Tra `0` cho moi ca khong qua dem va moi ca linh hoat.
 */
export function scheduledStartDayOffset(input: OvernightAnchorInput): -1 | 0 {
  if (!input.overnight) return 0;
  if (input.shiftEndInstantOnWorkDate === null) return 0;

  const punch = new Date(input.punchInstant).getTime();
  const shiftEnd = new Date(input.shiftEndInstantOnWorkDate).getTime();

  return punch < shiftEnd ? -1 : 0;
}
