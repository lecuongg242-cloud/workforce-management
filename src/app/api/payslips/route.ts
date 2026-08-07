import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { toIsoDate } from "@/lib/format";
import { buildPayrollRows } from "@/lib/payroll/payroll-rows";
import { assertCanViewOwnPayslip } from "@/lib/payroll/payslip-access";
import { createServerSupabase } from "@/lib/supabase/server";
import { payslipListResponseSchema } from "@/lib/validation/api/payslips";

/**
 * Danh sach cac ky DA CHOT LUONG ma nguoi dang nhap co phieu (PAY-05).
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`.
 *
 * ======================================================================
 * (1) PHAM VI DEN TU PHIEN, KHONG CO THAM SO NAO DOI DUOC
 * ======================================================================
 *
 * Route nay KHONG NHAN `employeeId`. Khong phai "nhan roi kiem tra" — khong
 * nhan. Do la khac biet co chu dich voi `GET /api/attendance`, noi tham so la
 * tuy chon va vi vay phep kiem quyen chi chay khi client CHIU gui tham so.
 * Mot duong doc du lieu luong khong duoc phep co hinh dang do.
 *
 * ======================================================================
 * (2) DANH SACH GOM CA KY DANG MO — VA DIEU KIEN DI KEM
 * ======================================================================
 *
 * Truoc day route nay CHI doc ban chot, voi ly do: con so cua mot ky chua chot
 * con doi moi khi quan tri sua cau hinh hoac duyet mot yeu cau, nen phat no
 * cho nhan vien la phat ra mot con so CHUA AI DUYET, roi thang sau no khac di
 * ma khong ai giai thich duoc.
 *
 * Quyet dinh do DA DUOC DAO, CO Y THUC. Ly do: nguoi lam cong hoi "hom nay toi
 * duoc bao nhieu", va bat ho doi den cuoi ky moi biet la bat ho tin ma khong
 * kiem duoc. Rui ro cu khong bien mat — no duoc XU LY bang ba dieu kien:
 *
 *   - Moi muc mang `status`, va ky dang mo LUON la `provisional`. Man hinh
 *     doc co do chu khong suy tu `closedAt === null`.
 *   - Nhan "Tam tinh" tren man hinh la BAT BUOC, khong phai trang tri: do la
 *     dieu kien de quyet dinh nay dung, chu khong phai mot lua chon thiet ke.
 *   - So cua ky dang mo den tu CHINH `buildPayrollRows()` ma man hinh quan tri
 *     va `closePayroll()` dung. Khong co duong tinh thu hai, nen con so nhan
 *     vien thay hom nay la con so SE DUOC CHOT neu khong gi thay doi.
 *
 * Ky DA CHOT van doc tu ban chot va khong bao gio tinh lai.
 *
 * ======================================================================
 * (3) VI SAO KHONG THEM MOT NHANH VAO `/api/payroll/summary`
 * ======================================================================
 *
 * Route do gop luong CUA TOAN BO NHAN VIEN vao mot phan hoi va tu bao ve bang
 * `requireRole(role, ['owner','admin'])` ngay dong dau. Them mot nhanh
 * `employee` vao giua no la dat mot cai re quyen vao trong mot ham dang gia
 * dinh nguoi goi la quan tri — hong mot lan la lo bang luong ca cong ty.
 */
export const dynamic = "force-dynamic";

interface RawRow {
  net_pay: string | number;
  payroll_runs: { period_start: string; closed_at: string } | null;
}

export async function GET(): Promise<NextResponse> {
  try {
    const { companyId, employeeId } = await getSessionContext();

    // Tai khoan co membership nhung chua gan voi mot dong `employees` thi
    // khong co phieu nao — danh sach rong la du lieu hop le, khong phai loi.
    if (!employeeId) {
      return NextResponse.json(payslipListResponseSchema.parse([]));
    }

    await assertCanViewOwnPayslip(employeeId, companyId);

    const supabase = await createServerSupabase();

    // `.eq("employee_id", employeeId)` la DIEU KIEN CO DINH, khong nam trong
    // mot nhanh `if` nao — xem muc (1).
    const { data, error } = await supabase
      .from("payroll_lines")
      .select("net_pay, payroll_runs!inner(period_start, closed_at)")
      .eq("company_id", companyId)
      .eq("employee_id", employeeId)
      .order("period_start", {
        referencedTable: "payroll_runs",
        ascending: false,
      });

    if (error) {
      console.error("Không thể tải danh sách phiếu lương:", error.message);
      return NextResponse.json(
        { error: "Không thể tải danh sách phiếu lương." },
        { status: 500 },
      );
    }

    const closed = ((data ?? []) as unknown as RawRow[])
      .filter((row) => row.payroll_runs !== null)
      .map((row) => ({
        status: "closed" as const,
        // `period_start` la ngay dau thang (rang buoc `check` cua 0024) — cat
        // lay "YYYY-MM" thay vi dung `Date`, de khong mot phep doi mui gio nao
        // chen vao giua (cung ly do voi `formatDate` trong `src/lib/format.ts`).
        month: row.payroll_runs!.period_start.slice(0, 7),
        closedAt: row.payroll_runs!.closed_at,
        netPay: Number(row.net_pay),
      }));

    // KY DANG MO — thang hien tai, neu no chua co ban chot. Dong ho lay o MAY
    // CHU (`toIsoDate(new Date())`), cung nguon voi moi cho khac; mot dau thoi
    // gian tu client la mo duong cho nguoi dung tu chon minh dang o thang nao.
    const currentMonth = toIsoDate(new Date()).slice(0, 7);
    const items = closed.some((item) => item.month === currentMonth)
      ? closed
      : await (async () => {
          const { rows } = await buildPayrollRows({
            companyId,
            month: currentMonth,
            employeeId,
          });
          const row = rows[0];
          // Khong co dong nao trong ky (moi vao lam, hoac chua cham cong lan
          // nao) -> khong co muc tam tinh. Danh sach rong la du lieu hop le.
          if (!row) return closed;
          return [
            {
              status: "provisional" as const,
              month: currentMonth,
              closedAt: null,
              netPay: row.netPay,
            },
            ...closed,
          ];
        })();

    return NextResponse.json(payslipListResponseSchema.parse(items));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      return NextResponse.json(payslipListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/payslips:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách phiếu lương." },
      { status: 500 },
    );
  }
}
