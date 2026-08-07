import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
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
 * (2) CHI DOC BAN CHOT — KHONG CO NHANH TINH LUC TRUY VAN
 * ======================================================================
 *
 * `GET /api/payroll/summary` co hai nhanh: ky da chot doc ban chot, ky chua
 * chot tinh live. O day CHI co nhanh mot.
 *
 * Con so cua mot ky chua chot con doi moi khi quan tri sua cau hinh hoac duyet
 * mot yeu cau. Phat no cho nhan vien la phat ra mot con so CHUA AI DUYET, roi
 * thang sau no khac di ma khong ai giai thich duoc. Ky chua chot khong co
 * phieu — va man hinh noi dung nhu vay.
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

    const items = ((data ?? []) as unknown as RawRow[])
      .filter((row) => row.payroll_runs !== null)
      .map((row) => ({
        // `period_start` la ngay dau thang (rang buoc `check` cua 0024) — cat
        // lay "YYYY-MM" thay vi dung `Date`, de khong mot phep doi mui gio nao
        // chen vao giua (cung ly do voi `formatDate` trong `src/lib/format.ts`).
        month: row.payroll_runs!.period_start.slice(0, 7),
        closedAt: row.payroll_runs!.closed_at,
        netPay: Number(row.net_pay),
      }));

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
