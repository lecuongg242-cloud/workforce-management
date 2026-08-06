import type { PayAdjustmentScope } from "@/lib/types/domain";

/**
 * Phep giai PHAM VI cua mot khoan phu cap / khau tru (D-40).
 *
 * Module THUAN: khong dung client co so du lieu, khong doc bien moi truong,
 * khong doc dong ho he thong — cung khuon `overtime-cap.ts` / `work-mode.ts`.
 *
 * ======================================================================
 * BA QUY TAC, VA VI SAO CHUNG DUOC CHON NHU VAY
 * ======================================================================
 *
 * (1) KHONG CO `include` NAO -> KHONG AI BI AP.
 *
 * Im lang KHONG phai la "tat ca". Mot khoan vua tao ma chua khai pham vi la
 * mot khoan CHUA KHAI XONG; neu no duoc hieu la "toan cong ty" thi mot lan
 * bam nham se cong tien cho tat ca moi nguoi, va man hinh se trong nhu binh
 * thuong. Cung lap luan voi D-26.
 *
 * (2) `exclude` LUON THANG `include` — ke ca khi `include` cu the hon.
 *
 * Mot quy tac "cu the thang chung chung" nghe thong minh hon: khai `include`
 * cho DUNG mot nguoi thi le ra phai thang `exclude` ca phong ban ho. Nhung khi
 * ay nguoi khai phai giu trong dau mot bang uu tien de tra loi cau hoi "ai bi
 * ap", va ho se doan sai — trong khi khong co gi bao dong neu ho doan sai.
 *
 * Quy tac o day DOAN DUOC bang mot cau: "bi loai tru thi khong duoc, het."
 * Va khoi xem truoc cua man hinh khai chinh la cho de kiem lai cau do.
 *
 * (3) `position` SO KHOP THEO CHUOI, sau khi cat khoang trang hai dau.
 *
 * `employees.position` la text tu do (migration 0004), khong phai bang tra
 * cuu. HE QUA phai biet truoc: "Nhan vien kho" va "Nhan vien Kho" la HAI chuc
 * vu khac nhau, va go sai chinh ta cho ra 0 nguoi bi ap chu khong bao loi.
 * KHONG chuan hoa dau va KHONG bo phan biet hoa thuong o day: mot phep so
 * khop "thong minh" se gom nham hai chuc vu that su khac nhau lai voi nhau,
 * va do la loi nang hon — no CONG tien cho nguoi khong duoc huong, thay vi
 * hien 0 nguoi mot cach de thay.
 */

/** Chi hai truong nay cua mot nhan vien tham gia phep giai pham vi. */
export interface ScopeEmployee {
  id: string;
  departmentId: string | null;
  position: string;
}

/** So khop MOT dong pham vi voi MOT nhan vien. */
function matches(scope: PayAdjustmentScope, employee: ScopeEmployee): boolean {
  switch (scope.scopeType) {
    case "company":
      return true;
    case "department":
      return (
        employee.departmentId !== null && employee.departmentId === scope.scopeValue
      );
    case "position":
      // Xem quy tac (3) o khoi tren: cat khoang trang, khong chuan hoa gi khac.
      return (
        employee.position.trim() === (scope.scopeValue ?? "").trim() &&
        employee.position.trim() !== ""
      );
    case "employee":
      return employee.id === scope.scopeValue;
    default:
      // Mot `scope_type` moi them vao database ma quen them o day se roi vao
      // nhanh nay va KHONG khop ai — chieu an toan: khong ai bong nhien nhan
      // them tien vi mot nhanh bi bo sot.
      return false;
  }
}

/** Nhan vien nay co bi ap khoan mang tap pham vi nay khong. */
export function isTargeted({
  employee,
  scopes,
}: {
  employee: ScopeEmployee;
  scopes: readonly PayAdjustmentScope[];
}): boolean {
  let included = false;

  for (const scope of scopes) {
    if (!matches(scope, employee)) continue;
    // Quy tac (2): mot dong `exclude` khop la du de tra loi, khong can xet
    // tiep — va khong mot dong `include` nao lat nguoc duoc no.
    if (scope.mode === "exclude") return false;
    included = true;
  }

  // Quy tac (1): khong `include` nao khop -> khong bi ap.
  return included;
}

/**
 * Danh sach nhan vien THUC SU bi ap khoan nay — dung cho khoi xem truoc cua
 * man hinh khai.
 *
 * Khoi xem truoc do khong phai mot tien ich: nguoi khai KHONG co cach nao tu
 * suy ra "ai bi ap" tu bon o cau hinh, va neu ho doan sai thi khong co gi bao
 * dong — nguoi mat phu cap dang co se khong biet de hoi.
 */
export function resolveTargets({
  employees,
  scopes,
}: {
  employees: readonly ScopeEmployee[];
  scopes: readonly PayAdjustmentScope[];
}): ScopeEmployee[] {
  return employees.filter((employee) => isTargeted({ employee, scopes }));
}

/**
 * Cau tom tat pham vi de hien trong bang ("Toan cong ty, tru 2 nguoi").
 *
 * Nhan cua tung loai pham vi do noi goi truyen vao (`labels`) — module nay
 * thuan, khong import `constants.ts` de khong keo mot cay phu thuoc giao dien
 * vao mot phep tinh.
 */
export function describeScopes({
  scopes,
  labels,
}: {
  scopes: readonly PayAdjustmentScope[];
  labels: {
    company: string;
    department: (value: string) => string;
    position: (value: string) => string;
    employee: (value: string) => string;
    /** "trừ {n} người" */
    excludeSuffix: (count: number) => string;
    none: string;
  };
}): string {
  const includes = scopes.filter((scope) => scope.mode === "include");
  const excludeCount = scopes.filter((scope) => scope.mode === "exclude").length;

  if (includes.length === 0) return labels.none;

  const parts = includes.map((scope) => {
    const value = scope.scopeValue ?? "";
    switch (scope.scopeType) {
      case "company":
        return labels.company;
      case "department":
        return labels.department(value);
      case "position":
        return labels.position(value);
      default:
        return labels.employee(value);
    }
  });

  const head = parts.join(", ");
  return excludeCount > 0 ? `${head}, ${labels.excludeSuffix(excludeCount)}` : head;
}
