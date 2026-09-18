"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Lock,
  LockKeyhole,
  SearchX,
  Unlock,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FilterBar } from "@/components/common/filter-bar";
import { SearchInput } from "@/components/common/search-input";
import { SortableHead, type SortState } from "@/components/common/sortable-head";
import { StatusBadge } from "@/components/common/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { PayrollRowDetail } from "@/app/admin/payroll/payroll-row-detail";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataQuery } from "@/hooks/use-data-query";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import {
  PAYROLL_LABEL,
  WORK_MODE_LABEL,
  describeMissingReason,
} from "@/lib/constants";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { closePayroll, getPayrollPrep, reopenPayroll } from "@/lib/data/payroll";
import { useDataStore } from "@/lib/data/store";
import {
  formatDateTime,
  formatMonthLabel,
  formatNumber,
  formatVnd,
  normalizeText,
  shiftMonth,
} from "@/lib/format";
import { downloadPayrollCsv } from "@/lib/payroll/csv";
import { cn } from "@/lib/utils";
import type { PayrollPrep, PayrollPrepRow } from "@/lib/types/domain";

/**
 * Bang CHUAN BI luong (`/admin/payroll`).
 *
 * KHONG CO CON SO TIEN NAO tren man hinh nay, va do la co y: V2 chuan bi du
 * lieu cong cho viec tinh luong, khong tinh luong (PROJECT.md §Out of Scope).
 * Chu tro giup noi thang dieu do thay vi de nguoi dung tu suy ra tu mot bang
 * thieu cot.
 *
 * TRANG THAI KY hien ngay canh thang, vi do la dieu ke toan can biet TRUOC KHI
 * dua con so nay di dau: mot ky dang mo van con doi duoc (mot yeu cau duoc
 * duyet, mot lan cham cong bu), con ky da chot thi khoa (PERD-02).
 *
 * Moi con so den tu `GET /api/payroll/summary`, va duong do dung CHUNG
 * `summarizeMonth()` voi `/api/attendance/summary` — man hinh nay va tong hop
 * cua tung nhan vien khong the noi hai con so khac nhau.
 */

/** Phut -> gio thap phan, hai chu so — don vi ma ke toan dung. */
function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/* Cot nao con thay o be ngang nao                                            */
/*                                                                            */
/* MOT bang duy nhat cho ca ba be ngang, khong phai hai nhanh bang desktop /  */
/* mobile: hai nhanh nghia la sua nghiep vu hai lan, va mot ngay nao do chung */
/* lech nhau ma khong ai biet ben nao dung.                                   */
/*                                                                            */
/* Nguyen tac chon cot (spec 2026-08-29): CAN CU RA QUYET DINH cua man hinh   */
/* nay la "ai duoc bao nhieu" — nen Nhan vien, Ngay cong va THUC NHAN o lai o */
/* moi be ngang. Cot bi an KHONG mat di: no nam trong hang mo rong, va cau    */
/* tro giup ngay tren bang noi ro dieu do.                                    */
/* -------------------------------------------------------------------------- */

/** An tren dien thoai, hien tu may tinh bang (>= 768px). */
const FROM_TABLET = "hidden md:table-cell";

/** Chi hien tren man hinh rong (>= 1024px) — nhom cot tien va cac cot dem phu. */
const FROM_DESKTOP = "hidden lg:table-cell";

/* -------------------------------------------------------------------------- */
/* Loc va sap xep                                                             */
/* -------------------------------------------------------------------------- */

/** Gia tri gia cho "chua gan phong ban" trong o chon. */
const NO_DEPARTMENT = "__none__";

type DataFilter = "all" | "incomplete" | "complete";

type SortKey =
  | "employee"
  | "department"
  | "workedDays"
  | "creditedDays"
  | "hourDelta"
  | "totalHours"
  | "overtime"
  | "leave"
  | "late"
  | "basePay"
  | "overtimePay"
  | "allowance"
  | "deduction"
  | "netPay";

const SORT_VALUE: Record<
  SortKey,
  (row: PayrollPrepRow) => string | number | null
> = {
  employee: (row) => row.employeeName,
  department: (row) => row.departmentName,
  workedDays: (row) => row.workedDays,
  creditedDays: (row) => row.creditedDays,
  hourDelta: (row) => row.hourDeltaMinutes,
  totalHours: (row) => row.totalMinutes,
  overtime: (row) => row.overtimeMinutes,
  leave: (row) => row.leaveDays,
  late: (row) => row.lateCount,
  basePay: (row) => row.basePay,
  overtimePay: (row) => row.overtimePay,
  allowance: (row) => row.allowanceTotal,
  deduction: (row) => row.deductionTotal,
  netPay: (row) => row.netPay,
};

/**
 * DONG CHUA DU DU KIEN LUON NAM CUOI, o ca hai chieu sap xep.
 *
 * `null` khong phai mot gia tri nho hay lon — no la "chua biet". Cho no chay
 * len dau khi sap tang dan se lam nguoi doc tuong day la nhung nguoi luong
 * thap nhat, ma do la mot cau sai ve chinh nhung nguoi de bi tra thieu nhat.
 */
function compareRows(
  a: PayrollPrepRow,
  b: PayrollPrepRow,
  sort: SortState<SortKey>,
): number {
  const left = SORT_VALUE[sort.key](a);
  const right = SORT_VALUE[sort.key](b);
  if (left === null || right === null) {
    if (left === right) return 0;
    return left === null ? 1 : -1;
  }
  const compared =
    typeof left === "string" && typeof right === "string"
      ? left.localeCompare(right, "vi")
      : Number(left) - Number(right);
  return sort.direction === "asc" ? compared : -compared;
}

/**
 * Mot o DEM (ngay cong, gio, so lan).
 *
 * SO 0 LUI VE SAU. Mot bang ma moi con so cung mot mau xam thi mat khong co
 * cho dung: nua bang la `0` khong noi gi ca, va chung dang doc to bang cac
 * con so co nghia. Lam nhat so 0 la cach re nhat de phan con lai noi to len.
 */
function CountCell({
  value,
  tone = "default",
  className,
}: {
  value: number;
  /** `alert`: con so nay la mot NGOAI LE (di muon) — dang de mat dung lai. */
  tone?: "default" | "alert";
  /** Be ngang nao thi hien cot nay — xem `FROM_TABLET` / `FROM_DESKTOP`. */
  className?: string;
}): React.ReactElement {
  if (value === 0) {
    return (
      <TableCell className={cn("num text-right text-ink-muted", className)}>
        0
      </TableCell>
    );
  }
  return (
    <TableCell
      className={cn(
        tone === "alert"
          ? "num text-right font-medium text-warning"
          : "num text-right text-ink-secondary",
        className,
      )}
    >
      {formatNumber(value)}
    </TableCell>
  );
}

/**
 * Mot o SO TIEN.
 *
 * `null` KHONG BAO GIO duoc hien thanh 0: mot o `0` trong bang luong doc nhu
 * MOT SU THAT ("nguoi nay khong duoc tra gi") va nguoi ky duyet se ky. O do
 * mang chu noi THIEU GI, va chu do la mot cau nguoi dung lam duoc gi voi no.
 *
 * Mau o day KHONG phai trang tri, no la thu tu doc: THUC NHAN dam nhat vi do
 * la ket luan cua ca dong, KHAU TRU mang dau tru va mau canh bao vi do la
 * tien bi tru khoi luong nguoi lao dong, so 0 lui ve sau.
 */
function MoneyCell({
  value,
  missing,
  emphasis = false,
  negative = false,
  groupStart = false,
  className,
}: {
  value: number | null;
  missing: readonly string[];
  /** Cot THUC NHAN — ket luan cua dong, dam nhat bang. */
  emphasis?: boolean;
  /** Cot KHAU TRU — tien bi tru, hien dau `−`. */
  negative?: boolean;
  /** Cot dau tien cua nhom TIEN — ke mot vach ngan voi nhom cong. */
  groupStart?: boolean;
  /** Be ngang nao thi hien cot nay — xem `FROM_TABLET` / `FROM_DESKTOP`. */
  className?: string;
}): React.ReactElement {
  const edge = groupStart ? " border-l border-hairline" : "";

  if (value === null) {
    const reason =
      missing.length > 0
        ? describeMissingReason(missing[0])
        : PAYROLL_LABEL.missingReasonFallback;
    return (
      // Cau "chua khai muc luong" dai hon mot o tien, nen o be ngang hep no
      // duoc phep xuong dong: mot chu bi cat mat thi khong con la loi chi duong.
      <TableCell
        className={cn(`text-right whitespace-normal md:whitespace-nowrap${edge}`, className)}
      >
        <span className="text-xs font-normal text-warning">{reason}</span>
      </TableCell>
    );
  }

  const tone = emphasis
    ? "bg-brand-wash font-semibold text-ink"
    : value === 0
      ? "text-ink-muted"
      : negative
        ? "text-danger"
        : "text-ink-secondary";

  return (
    <TableCell className={cn(`num text-right ${tone}${edge}`, className)}>
      {negative && value !== 0 ? "−" : ""}
      {formatVnd(value)}
    </TableCell>
  );
}

function periodBadge(status: PayrollPrep["periodStatus"]): React.ReactElement {
  if (status === "closed") {
    return (
      <StatusBadge
        kind="custom"
        size="sm"
        label={PAYROLL_LABEL.periodClosed}
        tone="neutral"
        icon={Lock}
      />
    );
  }
  return (
    <StatusBadge
      kind="custom"
      size="sm"
      // Ky chua ton tai va ky dang mo deu co nghia "con doi duoc", nhung noi
      // dung tung truong hop de nguoi doc khong phai doan.
      label={status === "open" ? PAYROLL_LABEL.periodOpen : PAYROLL_LABEL.periodMissing}
      tone="warning"
      icon={Unlock}
    />
  );
}

/**
 * Huy hieu trang thai CHOT LUONG (D-42) — khac huy hieu chot KY CONG o tren.
 * Hai thu tra loi hai cau hoi khac nhau va deu can hien: mot ky co the da chot
 * cong ma chua chot luong.
 */
function payrollBadge(
  status: PayrollPrep["payrollStatus"],
  closedAt: string | null,
): React.ReactElement {
  if (status === "closed") {
    return (
      <StatusBadge
        kind="custom"
        size="sm"
        label={
          closedAt
            ? `${PAYROLL_LABEL.payrollClosed} · ${PAYROLL_LABEL.payrollClosedBySuffix} ${formatDateTime(closedAt)}`
            : PAYROLL_LABEL.payrollClosed
        }
        tone="success"
        icon={LockKeyhole}
      />
    );
  }
  return (
    <StatusBadge
      kind="custom"
      size="sm"
      label={PAYROLL_LABEL.payrollOpen}
      tone="neutral"
      icon={Unlock}
    />
  );
}

export function PayrollView({ today }: { today: string }): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  // Mac dinh la THANG TRUOC: bang luong duoc lam sau khi thang da qua, va
  // thang hien tai thi chua co gi de ban giao.
  const [month, setMonth] = React.useState(() => shiftMonth(today.slice(0, 7), -1));

  const { data, isLoading, error, reload } = useDataQuery(
    () => getPayrollPrep(month),
    [session.companyId, month],
  );

  /* ------------------------------------------------------------------ */
  /* Loc va sap xep                                                      */
  /*                                                                     */
  /* Lam o phia trinh duyet, khong goi lai API: ca thang cua mot doanh    */
  /* nghiep vua va nho chi la vai chuc dong, va loc tren du lieu da co    */
  /* thi khong the lam bang lech voi tong o tren.                        */
  /* ------------------------------------------------------------------ */
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [departmentFilter, setDepartmentFilter] = React.useState("all");
  const [dataFilter, setDataFilter] = React.useState<DataFilter>("all");
  const [sort, setSort] = React.useState<SortState<SortKey> | null>(null);

  const allRows = React.useMemo(() => data?.rows ?? [], [data]);

  const departmentOptions = React.useMemo(() => {
    const names = new Set<string>();
    let hasNone = false;
    allRows.forEach((row) => {
      if (row.departmentName) names.add(row.departmentName);
      else hasNone = true;
    });
    const options = [...names]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((name) => ({ value: name, label: name }));
    // Nguoi chua gan phong ban van phai loc ra duoc — ho la nhom de bi bo sot
    // nhat khi ra soat truoc luc chot.
    return hasNone
      ? [
          ...options,
          { value: NO_DEPARTMENT, label: PAYROLL_LABEL.filterNoDepartment },
        ]
      : options;
  }, [allRows]);

  const rows = React.useMemo(() => {
    const keyword = normalizeText(debouncedSearch);
    const filtered = allRows.filter((row) => {
      if (
        keyword !== "" &&
        !normalizeText(`${row.employeeName} ${row.employeeCode}`).includes(keyword)
      ) {
        return false;
      }
      if (
        departmentFilter !== "all" &&
        (row.departmentName ?? NO_DEPARTMENT) !== departmentFilter
      ) {
        return false;
      }
      if (dataFilter === "incomplete" && row.netPay !== null) return false;
      if (dataFilter === "complete" && row.netPay === null) return false;
      return true;
    });
    // Chua chon cot nao thi giu nguyen thu tu tu API (theo ma nhan vien) —
    // do la thu tu ke toan doi chieu voi danh sach cua ho.
    return sort ? [...filtered].sort((a, b) => compareRows(a, b, sort)) : filtered;
  }, [allRows, debouncedSearch, departmentFilter, dataFilter, sort]);

  const hasActiveFilter =
    search.trim() !== "" || departmentFilter !== "all" || dataFilter !== "all";

  const resetFilters = (): void => {
    setSearch("");
    setDepartmentFilter("all");
    setDataFilter("all");
    setSort(null);
  };

  // Tong mo ta NHUNG DONG DANG THAY. Loc mot phong ban roi van hien tong ca
  // ky thi con so tren man hinh khong con noi ve cai bang ben duoi no nua.
  const totals = React.useMemo(() => {
    return {
      employees: rows.length,
      workedDays: rows.reduce((sum, row) => sum + row.workedDays, 0),
      minutes: rows.reduce((sum, row) => sum + row.totalMinutes, 0),
      overtimeMinutes: rows.reduce((sum, row) => sum + row.overtimeMinutes, 0),
      // Tong THUC NHAN cong tu chinh cac o hien ra o cot do — nen tong bang
      // dung tong cac dong. Dong nao chua tinh duoc thi KHONG duoc coi la 0:
      // no bi dem rieng va noi ra thanh mot con so nguoi, khong lang le tut
      // khoi tong.
      netPay: rows.reduce((sum, row) => sum + (row.netPay ?? 0), 0),
      incompleteCount: rows.filter((row) => row.netPay === null).length,
    };
  }, [rows]);

  // Dong dang mo khoi chi tiet — `null` khi khong dong nao mo.
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const hasMissingWorkModeInput = allRows.some(
    (row) => row.missingWorkModeInputs.length > 0,
  );
  // Cot "Lech gio so voi ca" chi co nghia o `shift_hourly`; o hai che do con
  // lai no luon bang 0, va mot cot toan so 0 lam bang dai ra ma khong noi gi.
  const showHourDelta = data?.workMode === "shift_hourly";

  // Xuat DUNG NHUNG GI DANG THAY — nguoi vua loc ra mot phong ban ma bam xuat
  // thi mong doi tep chua dung phong ban do. Nhung im lang thi nguy hiem: cau
  // toast noi ro tep nay khong phai ca ky.
  const handleExport = (): void => {
    if (!data) return;
    downloadPayrollCsv({ ...data, rows });
    toast.success(
      hasActiveFilter
        ? PAYROLL_LABEL.exportedFilteredToast.replace("{n}", String(rows.length))
        : PAYROLL_LABEL.exportedToast,
    );
  };

  /* ------------------------------------------------------------------ */
  /* Chot luong / huy chot luong (D-42/D-45)                             */
  /* ------------------------------------------------------------------ */
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [confirmReopen, setConfirmReopen] = React.useState(false);
  const [reopenReason, setReopenReason] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);

  const isPayrollClosed = data?.payrollStatus === "closed";
  // Dem tren CA KY, khong tren cac dong dang thay: neu khong, loc bot vai dong
  // thieu du kien di la nut "Chot luong" sang len va ky bi chot voi cho trong.
  const incompleteCount = allRows.filter((row) => row.netPay === null).length;
  // Hai ly do khien nut bi vo hieu, moi ly do co MOT CAU noi ro phai lam gi —
  // mot nut xam im lang chi lam nguoi dung doan.
  const closeBlockedReason: string | null = !data
    ? null
    : data.periodStatus !== "closed"
      ? PAYROLL_LABEL.closeBlockedPeriodOpen
      : incompleteCount > 0
        ? PAYROLL_LABEL.closeBlockedIncomplete.replace(
            "{n}",
            String(incompleteCount),
          )
        : data.rows.length === 0
          ? PAYROLL_LABEL.emptyBody
          : null;

  const handleClose = async (): Promise<void> => {
    setIsPending(true);
    try {
      await closePayroll(month);
      toast.success(PAYROLL_LABEL.closeSuccess);
      invalidate();
      reload();
      setConfirmClose(false);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : PAYROLL_LABEL.closeError,
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleReopen = async (): Promise<void> => {
    setIsPending(true);
    try {
      await reopenPayroll(month, reopenReason);
      toast.success(PAYROLL_LABEL.reopenSuccess);
      invalidate();
      reload();
      setConfirmReopen(false);
      setReopenReason("");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : PAYROLL_LABEL.reopenError,
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title={PAYROLL_LABEL.pageTitle}
        description={PAYROLL_LABEL.pageDescription}
        actions={
          // Duoi `md`: hai HANG trai het be ngang — chon thang o tren, hai
          // thao tac chia doi o duoi. Tu `md` tro len ve dung mot hang nhu cu.
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center md:gap-1.5">
            <div className="flex items-center gap-1.5">
              {/* 44px o dien thoai (kich thuoc cham toi thieu), 40px tu `md`
                  tro len — dung y nhu truoc tren may tinh. */}
              <Button
                variant="outline"
                size="icon"
                className="size-11 md:size-10"
                aria-label="Tháng trước"
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              {/* Nhan thang gian ra giua hai nut o dien thoai, de ngon tay voi
                  tu hai ria man hinh — cho de voi nhat khi cam mot tay. */}
              <span className="num flex-1 text-center text-sm font-medium text-ink md:min-w-[8.5rem] md:flex-none">
                {formatMonthLabel(month)}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-11 md:size-10"
                aria-label="Tháng sau"
                onClick={() => setMonth((current) => shiftMonth(current, 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>

            <div className="flex items-center gap-2 md:gap-1.5">
              <Button
                variant="outline"
                className="h-11 flex-1 md:ml-1 md:h-10 md:flex-none"
                onClick={handleExport}
                disabled={!data || data.rows.length === 0}
              >
                <Download aria-hidden="true" />
                {PAYROLL_LABEL.exportAction}
              </Button>

              {/* MOT nut filled indigo cua khu vuc nay (quy uoc globals.css) la
                  "Chot luong ky" — do la thao tac chinh cua man hinh. Ky da chot
                  thi cho nut phu tong canh bao. */}
              {isPayrollClosed ? (
                <Button
                  variant="outline"
                  className="h-11 flex-1 text-danger md:h-10 md:flex-none"
                  onClick={() => setConfirmReopen(true)}
                >
                  <Unlock aria-hidden="true" />
                  {PAYROLL_LABEL.reopenAction}
                </Button>
              ) : (
                <Button
                  className="h-11 flex-1 md:h-10 md:flex-none"
                  onClick={() => setConfirmClose(true)}
                  disabled={!data || closeBlockedReason !== null}
                >
                  <LockKeyhole aria-hidden="true" />
                  {PAYROLL_LABEL.closeAction}
                </Button>
              )}
            </div>
          </div>
        }
      />

      {/* Nut bi vo hieu KHONG duoc im lang: cau duoi day noi ro can lam gi. */}
      {data && !isPayrollClosed && closeBlockedReason ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5 text-[13px] text-ink-secondary"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {closeBlockedReason}{" "}
            {data.periodStatus !== "closed" ? (
              <Link href="/admin/attendance" className="font-medium underline">
                Mở trang Chấm công để chốt kỳ
              </Link>
            ) : null}
          </span>
        </p>
      ) : null}

      {data ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {periodBadge(data.periodStatus)}
          {payrollBadge(data.payrollStatus, data.payrollClosedAt)}
          {/* D-36: che do dang ap noi ngay canh trang thai ky. Cung mot bang
              doc ra hai con so khac nhau o hai che do khac nhau, nen nguoi
              doc phai biet minh dang nhin bang nao. */}
          <span className="text-[13px] text-ink-muted">
            {PAYROLL_LABEL.workModePrefix}{" "}
            <span className="font-medium text-ink">
              {WORK_MODE_LABEL[data.workMode]}
            </span>
          </span>
          {/* Cau tom tat MOT DONG — chi tu `lg` tro len. O be ngang hep no vo
              thanh bon nam dong chu chay tran, nen o duoi co mot luoi dung
              CHINH nhung con so nay. */}
          <span className="hidden text-[13px] text-ink-muted lg:inline">
            <span className="num font-medium text-ink">
              {formatNumber(totals.employees)}
            </span>{" "}
            nhân viên ·{" "}
            <span className="num font-medium text-ink">
              {formatNumber(totals.workedDays)}
            </span>{" "}
            ngày công ·{" "}
            <span className="num font-medium text-ink">
              {formatNumber(toHours(totals.minutes))}
            </span>{" "}
            giờ làm ·{" "}
            <span className="num font-medium text-ink">
              {formatNumber(toHours(totals.overtimeMinutes))}
            </span>{" "}
            giờ tăng ca ·{" "}
            <span className="num font-semibold text-ink">
              {formatVnd(totals.netPay)}
            </span>{" "}
            thực nhận
            {/* Dong chua tinh duoc KHONG bi coi la 0 va lang le tut khoi tong —
                no duoc dem rieng va noi ra. */}
            {totals.incompleteCount > 0 ? (
              <span className="text-warning">
                {" "}
                (chưa gồm{" "}
                <span className="num font-medium">{totals.incompleteCount}</span>{" "}
                người chưa đủ dữ kiện)
              </span>
            ) : null}
            {/* Sau khi loc, day khong con la tong ca ky — phai noi ra. */}
            {hasActiveFilter ? (
              <span className="text-ink-muted">
                {" "}
                {PAYROLL_LABEL.filteredSummarySuffix}
              </span>
            ) : null}
          </span>

          {/* CUNG NHUNG CON SO DO o be ngang hep, xep thanh luoi. Khong con so
              nao bi bo di khi man hinh nho lai — mot bang luong noi thieu mot
              con so thi nguoi doc khong biet la minh dang thieu. */}
          <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-2.5 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5 sm:grid-cols-3 lg:hidden">
            <SummaryStat
              label={PAYROLL_LABEL.summaryEmployees}
              value={formatNumber(totals.employees)}
            />
            <SummaryStat
              label={PAYROLL_LABEL.summaryWorkedDays}
              value={formatNumber(totals.workedDays)}
            />
            <SummaryStat
              label={PAYROLL_LABEL.summaryHours}
              value={formatNumber(toHours(totals.minutes))}
            />
            <SummaryStat
              label={PAYROLL_LABEL.summaryOvertime}
              value={formatNumber(toHours(totals.overtimeMinutes))}
            />
            <SummaryStat
              label={PAYROLL_LABEL.summaryNetPay}
              value={formatVnd(totals.netPay)}
              emphasis
            />
            {totals.incompleteCount > 0 || hasActiveFilter ? (
              <div className="col-span-2 text-[12px] sm:col-span-3">
                {totals.incompleteCount > 0 ? (
                  <span className="text-warning">
                    {PAYROLL_LABEL.summaryIncomplete.replace(
                      "{n}",
                      formatNumber(totals.incompleteCount),
                    )}
                  </span>
                ) : null}{" "}
                {hasActiveFilter ? (
                  <span className="text-ink-muted">
                    {PAYROLL_LABEL.filteredSummarySuffix}
                  </span>
                ) : null}
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {/* (c) Chu thich CO DINH, khong phai mot dong nho o goc: hieu nham rang
          con so nay da tru thue va bao hiem la dieu de xay ra nhat cua ca man
          hinh, va hau qua la doanh nghiep tra thieu cho nguoi lao dong. */}
      <p className="flex items-start gap-2 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5 text-[13px] text-ink-secondary">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          {PAYROLL_LABEL.taxDisclaimer}{" "}
          {/* Duoi `lg` cau nay phai noi ro hon: bang dang an nhom cot tien, va
              hang mo rong la duong duy nhat den cho chung. */}
          <span className="text-ink-muted lg:hidden">
            {PAYROLL_LABEL.expandHintCompact}
          </span>
          <span className="hidden text-ink-muted lg:inline">
            {PAYROLL_LABEL.expandHint}
          </span>
        </span>
      </p>

      {/* D-38: thieu mau so quy doi thi noi THANG va chi duong sang cho khai,
          thay vi de mot cot "—" ma khong ai biet vi sao no trong. */}
      {hasMissingWorkModeInput ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-control border border-warning-border bg-warning-soft px-3 py-2.5 text-[13px] text-ink"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {PAYROLL_LABEL.missingWorkModeBanner}{" "}
            <Link href="/admin/settings" className="font-medium underline">
              Mở trang Cài đặt
            </Link>
          </span>
        </p>
      ) : null}

      <div className="surface-card overflow-hidden">
        {/* Thanh loc chi hien khi da co du lieu de loc — mot bo loc treo tren
            mot bang trong chi lam nguoi dung tuong minh vua loc mat het. */}
        {data && allRows.length > 0 ? (
          <FilterBar
            search={
              <SearchInput
                value={search}
                onValueChange={setSearch}
                label={PAYROLL_LABEL.searchLabel}
                placeholder={PAYROLL_LABEL.searchPlaceholder}
              />
            }
            filters={[
              {
                id: "payroll-filter-department",
                label: PAYROLL_LABEL.filterDepartmentLabel,
                value: departmentFilter,
                allLabel: PAYROLL_LABEL.filterDepartmentAll,
                options: departmentOptions,
                onChange: setDepartmentFilter,
              },
              {
                id: "payroll-filter-data",
                label: PAYROLL_LABEL.filterDataLabel,
                value: dataFilter,
                allLabel: PAYROLL_LABEL.filterDataAll,
                // Loc ra dung nhung dong con thieu la viec phai lam TRUOC khi
                // chot ky — no la danh sach viec, khong phai mot bo loc cho vui.
                options: [
                  {
                    value: "incomplete",
                    label: PAYROLL_LABEL.filterDataIncomplete,
                  },
                  { value: "complete", label: PAYROLL_LABEL.filterDataComplete },
                ],
                onChange: (value) => setDataFilter(value as DataFilter),
              },
            ]}
            hasActiveFilter={hasActiveFilter}
            onReset={resetFilters}
            trailing={
              <p className="num text-[13px] text-ink-muted">
                {formatNumber(rows.length)}/{formatNumber(allRows.length)} dòng
              </p>
            }
          />
        ) : null}

        {error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : isLoading || !data ? (
          <>
            <div className="hidden lg:block">
              <DataTableSkeleton rows={6} columns={8} />
            </div>
            <div className="hidden md:block lg:hidden">
              <DataTableSkeleton rows={6} columns={5} />
            </div>
            <div className="md:hidden">
              <DataTableSkeleton rows={6} columns={3} />
            </div>
          </>
        ) : allRows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={PAYROLL_LABEL.emptyTitle}
            description={PAYROLL_LABEL.emptyBody}
          />
        ) : rows.length === 0 ? (
          // Loc khong ra gi KHAC voi ky khong co ai: mot ben la bo loc qua chat,
          // ben kia la thang khong co du lieu. Noi nham thi nguoi dung di sai
          // huong hoan toan.
          <EmptyState
            icon={SearchX}
            title={PAYROLL_LABEL.filteredEmptyTitle}
            description={PAYROLL_LABEL.filteredEmptyBody}
            action={
              <Button variant="outline" onClick={resetFilters}>
                Xóa bộ lọc
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            {/* Nen bang lai de 14-16 cot vao vua mot man hinh: dem ngang hep
                hon va tieu de duoc phep xuong dong ("Ngày công quy đổi" chiem
                hai dong thay vi keo cot rong gap doi). O du lieu van
                `whitespace-nowrap` — mot so tien bi ngat dong thi doc sai. */}
            <Table className="[&_th]:px-2 [&_th]:leading-tight [&_th]:whitespace-normal [&_td]:px-2">
              <TableHeader>
                {/* MOI cot deu sap xep duoc. Cau hoi cua nguoi lam luong luon
                    la mot cau so sanh — "ai tang ca nhieu nhat", "ai bi tru
                    nhieu nhat" — va cot nao cung co the la cot bi hoi.

                    Cot chu mac dinh sap TANG (A-Z), cot so mac dinh sap GIAM:
                    hoi ve mot cot so gan nhu luon la hoi "ai nhieu nhat". */}
                <TableRow>
                  <SortableHead
                    sortKey="employee"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                  >
                    {PAYROLL_LABEL.employeeColumn}
                  </SortableHead>
                  <SortableHead
                    sortKey="department"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    className={FROM_TABLET}
                  >
                    {PAYROLL_LABEL.departmentColumn}
                  </SortableHead>
                  <SortableHead
                    sortKey="workedDays"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    defaultDirection="desc"
                  >
                    {PAYROLL_LABEL.workedDaysColumn}
                  </SortableHead>
                  {/* Cot RIENG, khong thay the "Ngay cong": o che do
                      `daily_hours` hai con so nay khac nhau, va gop chung lai
                      se lam ke toan cong nham. */}
                  <SortableHead
                    sortKey="creditedDays"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    defaultDirection="desc"
                    title={PAYROLL_LABEL.creditedDaysHint}
                    className={FROM_TABLET}
                  >
                    {PAYROLL_LABEL.creditedDaysColumn}
                  </SortableHead>
                  {showHourDelta ? (
                    <SortableHead
                      sortKey="hourDelta"
                      sort={sort}
                      onSort={setSort}
                      align="center"
                      defaultDirection="desc"
                      title={PAYROLL_LABEL.hourDeltaHint}
                      className={FROM_DESKTOP}
                    >
                      {PAYROLL_LABEL.hourDeltaColumn}
                    </SortableHead>
                  ) : null}
                  <SortableHead
                    sortKey="totalHours"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    defaultDirection="desc"
                    className={FROM_TABLET}
                  >
                    {PAYROLL_LABEL.totalHoursColumn}
                  </SortableHead>
                  <SortableHead
                    sortKey="overtime"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    defaultDirection="desc"
                    className={FROM_TABLET}
                  >
                    {PAYROLL_LABEL.overtimeColumn}
                  </SortableHead>
                  <SortableHead
                    sortKey="leave"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    defaultDirection="desc"
                    className={FROM_DESKTOP}
                  >
                    {PAYROLL_LABEL.leaveColumn}
                  </SortableHead>
                  <SortableHead
                    sortKey="late"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    defaultDirection="desc"
                    className={FROM_DESKTOP}
                  >
                    {PAYROLL_LABEL.lateColumn}
                  </SortableHead>
                  {/* Cac cot TIEN, ben phai cac cot cong — vach ngan o day noi
                      cho mat biet minh vua doi tu "cong" sang "tien". */}
                  <SortableHead
                    sortKey="basePay"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    defaultDirection="desc"
                    className={cn("border-l border-hairline", FROM_DESKTOP)}
                  >
                    {PAYROLL_LABEL.basePayColumn}
                  </SortableHead>
                  <SortableHead
                    sortKey="overtimePay"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    defaultDirection="desc"
                    className={FROM_DESKTOP}
                  >
                    {PAYROLL_LABEL.overtimePayColumn}
                  </SortableHead>
                  <SortableHead
                    sortKey="allowance"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    defaultDirection="desc"
                    className={FROM_DESKTOP}
                  >
                    {PAYROLL_LABEL.allowanceColumn}
                  </SortableHead>
                  <SortableHead
                    sortKey="deduction"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    defaultDirection="desc"
                    className={FROM_DESKTOP}
                  >
                    {PAYROLL_LABEL.deductionColumn}
                  </SortableHead>
                  {/* Cot ket luan: mot mang nen rat nhat chay doc suot bang de
                      mat tim duoc no ngay ma khong can to mau tung con so. */}
                  <SortableHead
                    sortKey="netPay"
                    sort={sort}
                    onSort={setSort}
                    align="center"
                    defaultDirection="desc"
                    className="border-l border-hairline bg-brand-wash text-ink lg:border-l-0"
                  >
                    {PAYROLL_LABEL.netPayColumn}
                  </SortableHead>

                  {/* Cot MO CHI TIET — chi co duoi `lg`. Tu `lg` tro len bang
                      da hien du cot nen mui neo nay khong con noi them gi. */}
                  <TableHead className="w-12 lg:hidden">
                    <span className="sr-only">
                      {PAYROLL_LABEL.expandColumnLabel}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <React.Fragment key={row.employeeId}>
                  <TableRow
                    // (b) Bam mot dong de thay VI SAO ra con so do. Khoi chi
                    // tiet la thu duy nhat tra loi duoc cau hoi ay ma khong
                    // phai di hoi ai.
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(
                        expandedId === row.employeeId ? null : row.employeeId,
                      )
                    }
                  >
                    {/* Ten nguoi KHONG BI CAT o man hep — no duoc phep xuong
                        dong. Mot cai ten bi cat con nua thi ke toan phai doan
                        xem dong nay la ai. */}
                    <TableCell className="whitespace-normal md:whitespace-nowrap">
                      <div className="font-medium text-ink">{row.employeeName}</div>
                      <div className="num text-xs text-ink-muted">
                        {row.employeeCode}
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-ink-secondary", FROM_TABLET)}>
                      {row.departmentName ?? "—"}
                    </TableCell>
                    <CountCell value={row.workedDays} />
                    <TableCell className={cn("num text-right", FROM_TABLET)}>
                      {row.creditedDays === null ? (
                        // Thieu mau so quy doi (D-38) — noi thang la chua
                        // khai, KHONG hien 0. Mot o `0` o day doc ra thanh
                        // "nguoi nay khong lam ngay nao".
                        <span
                          className="text-xs font-normal text-warning"
                          title={PAYROLL_LABEL.missingWorkModeInputHint}
                        >
                          {PAYROLL_LABEL.missingWorkModeInput}
                        </span>
                      ) : (
                        <span
                          className={
                            row.creditedDays === 0
                              ? "text-ink-muted"
                              : "font-medium text-ink"
                          }
                        >
                          {formatNumber(row.creditedDays)}
                        </span>
                      )}
                    </TableCell>
                    {showHourDelta ? (
                      <CountCell
                        value={toHours(row.hourDeltaMinutes)}
                        className={FROM_DESKTOP}
                      />
                    ) : null}
                    <CountCell
                      value={toHours(row.totalMinutes)}
                      className={FROM_TABLET}
                    />
                    <CountCell
                      value={toHours(row.overtimeMinutes)}
                      className={FROM_TABLET}
                    />
                    {/* Khong con cot "Gio quy doi". Canh bao thieu he so KHONG
                        mat theo no: o "Tien tang ca" cua dong do hien thang
                        "chua khai he so tang ca" thay vi mot con so — D-26 van
                        duoc gac, va gac o dung cho no thanh hai. */}
                    <CountCell value={row.leaveDays} className={FROM_DESKTOP} />
                    {/* Di muon la NGOAI LE — no duoc phep dung mat lai, khac
                        voi cac cot dem con lai. */}
                    <CountCell
                      value={row.lateCount}
                      tone="alert"
                      className={FROM_DESKTOP}
                    />

                    {/* Nam o TIEN. Dong thieu du kien hien CHU noi thieu gi,
                        khong hien mot con so — mot o `0` doc nhu mot su that
                        va nguoi ky duyet se ky. */}
                    <MoneyCell
                      value={row.basePay}
                      missing={row.missing}
                      groupStart
                      className={FROM_DESKTOP}
                    />
                    <MoneyCell
                      value={row.overtimePay}
                      missing={row.missing}
                      className={FROM_DESKTOP}
                    />
                    <MoneyCell
                      value={row.allowanceTotal}
                      missing={row.missing}
                      className={FROM_DESKTOP}
                    />
                    <MoneyCell
                      value={row.deductionTotal}
                      missing={row.missing}
                      negative
                      className={FROM_DESKTOP}
                    />
                    <MoneyCell
                      value={row.netPay}
                      missing={row.missing}
                      emphasis
                      className="border-l border-hairline lg:border-l-0"
                    />

                    {/* Nut MO CHI TIET (chi duoi `lg`): 44px cham duoc, va
                        `aria-expanded` de trinh doc man hinh noi duoc dieu ma
                        mui neo chi noi bang mat. Ca dong van bam duoc — nut nay
                        chan noi bam de mot cu cham khong lam hai lan dong/mo. */}
                    <TableCell className="px-1 text-right lg:hidden">
                      <button
                        type="button"
                        aria-expanded={expandedId === row.employeeId}
                        aria-label={`${PAYROLL_LABEL.expandRowLabel} ${row.employeeName}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedId(
                            expandedId === row.employeeId ? null : row.employeeId,
                          );
                        }}
                        className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-canvas-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        <ChevronDown
                          aria-hidden="true"
                          className={cn(
                            "size-4 transition-transform",
                            expandedId === row.employeeId && "rotate-180",
                          )}
                        />
                      </button>
                    </TableCell>
                  </TableRow>

                  {expandedId === row.employeeId ? (
                    <TableRow className="bg-canvas-soft hover:bg-canvas-soft">
                      <TableCell colSpan={showHourDelta ? 17 : 16} className="p-0">
                        <PayrollRowDetail row={row} showHourDelta={showHourDelta} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Hop thoai CHOT — noi du ba dieu: cai gi duoc dong khung, he qua cua
          viec dong khung, va duong lui. Thieu dieu thu ba thi nguoi dung se
          khong dam bam. */}
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={PAYROLL_LABEL.closeDialogTitle}
        description={PAYROLL_LABEL.closeDialogBody}
        confirmLabel={PAYROLL_LABEL.closeConfirm}
        isPending={isPending}
        onConfirm={handleClose}
      />

      {/* Hop thoai HUY — LY DO BAT BUOC (D-45): huy mot ban tuyen bo tai chinh
          ma khong noi vi sao la xoa mot su kien trong im lang. */}
      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={(open) => {
          setConfirmReopen(open);
          if (!open) setReopenReason("");
        }}
        title={PAYROLL_LABEL.reopenDialogTitle}
        description={
          <div className="grid gap-3">
            <p>{PAYROLL_LABEL.reopenDialogBody}</p>
            {/* D-57: khai nham muc luong KHONG phai ly do de huy chot. Cau nay
                phai nam ngay trong hop thoai, vi day la cho nguoi dung dinh
                lam dung viec do. */}
            <p className="rounded-control border border-hairline bg-canvas-soft px-3 py-2.5 text-xs text-ink-secondary">
              {PAYROLL_LABEL.reopenScopeNote}
            </p>
            <div className="grid gap-1.5">
              <label
                htmlFor="payroll-reopen-reason"
                className="text-[13px] font-medium text-ink-secondary"
              >
                {PAYROLL_LABEL.reopenReasonLabel}
                <span className="text-danger" aria-hidden="true">
                  *
                </span>
              </label>
              <Textarea
                id="payroll-reopen-reason"
                rows={3}
                value={reopenReason}
                placeholder={PAYROLL_LABEL.reopenReasonPlaceholder}
                onChange={(event) => setReopenReason(event.target.value)}
              />
              <p className="text-xs text-ink-muted">
                {PAYROLL_LABEL.reopenReasonRequired}
              </p>
            </div>
          </div>
        }
        confirmLabel={PAYROLL_LABEL.reopenConfirm}
        tone="destructive"
        isPending={isPending}
        // Chan ngay tai nut: khong de nguoi dung bam roi moi nhan mot loi.
        confirmDisabled={reopenReason.trim().length === 0}
        onConfirm={handleReopen}
      />
    </div>
  );
}

/**
 * Mot o cua luoi tom tat o man hep.
 *
 * Nhan nam TREN con so, khong nam canh: hai cot chu-so canh nhau tren mot man
 * 375px lam con so bi ep xuong dong giua cac chu so, va mot so tien bi ngat
 * dong thi doc sai.
 */
function SummaryStat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  /** THUC NHAN — ket luan cua ca bang, dam nhat luoi. */
  emphasis?: boolean;
}): React.ReactElement {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] tracking-wide text-ink-muted uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "num truncate text-[14px] text-ink",
          emphasis ? "font-semibold" : "font-medium",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
