"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SUPPORT_LABELS } from "@/lib/constants";
import { closeSupportSession } from "@/lib/data/mutations/platform-sessions";

/**
 * Tieu chi 2 cua Phase 6: "man hinh LUON hien thi ro dang xem doanh nghiep
 * nao". Banner nay dinh dinh moi trang `/admin/*` khi vai tro phien la
 * `"support"`.
 *
 * Nut GHI tren muoi man hinh quan tri KHONG bi an (D-54). An nut o muoi cho
 * la muoi cho de quen, va la muoi cho de mot phase sau them man hinh thu muoi
 * mot ma khong biet; con thong diep tu choi thi den tu MOT cho duy nhat
 * (`requireRole` trong 16 file mutations) va khong quen duoc.
 *
 * Danh doi da can nhac: doi ho tro bam roi moi biet khong duoc — nhung do la
 * nguoi dung noi bo, con thu duoc bao ve la du lieu cua khach.
 */
export function SupportBanner({
  companyName,
  expiresAt,
}: {
  companyName: string;
  /** ISO date-time */
  expiresAt: string;
}): React.ReactElement {
  const [minutesLeft, setMinutesLeft] = React.useState(() =>
    minutesUntil(expiresAt),
  );
  const [isClosing, setIsClosing] = React.useState(false);

  React.useEffect(() => {
    // 30 giay mot nhip: du de con so khong bao gio lech qua mot phut, va du
    // thua de khong lam gi dang ke ve tai nguyen.
    const timer = setInterval(
      () => setMinutesLeft(minutesUntil(expiresAt)),
      30_000,
    );
    return () => clearInterval(timer);
  }, [expiresAt]);

  const handleClose = React.useCallback(() => {
    setIsClosing(true);
    void closeSupportSession().finally(() => {
      // Tai lai ca tai lieu: sau khi phien dong, MOI truy van duoi /admin deu
      // se tra rong hoac 403, nen o lai trang hien tai la o lai mot man hinh
      // noi doi.
      window.location.assign("/platform");
    });
  }, []);

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">
        {SUPPORT_LABELS.viewing} <strong>{companyName}</strong> —{" "}
        {SUPPORT_LABELS.session},{" "}
        {minutesLeft > 0
          ? `${SUPPORT_LABELS.remaining} ${minutesLeft} phút`
          : SUPPORT_LABELS.expired}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClose}
        disabled={isClosing}
      >
        {SUPPORT_LABELS.close}
      </Button>
    </div>
  );
}

/**
 * Con lai bao nhieu phut, lam tron len.
 *
 * D-19a cam doc dong ho may trong Client Component vi "hom nay" cua DU LIEU
 * phai do server cap. Day la truong hop ngoai le da co tien le
 * (`attendance-status-card.tsx` dong 63-66): mot dong ho DEM NGUOC, khong
 * dung de xac dinh ngay cua bat ky ban ghi nao. Moc het han (`expiresAt`) van
 * do server cap va tu no la nguon su that duy nhat — dong ho may o day chi
 * dung de VE con so dang giam, con quyen truy cap thi `tf_has_support_access()`
 * quyet dinh o tang database, khong phai component nay.
 */
function minutesUntil(iso: string): number {
  // eslint-disable-next-line timeflow/no-date-in-client -- dong ho tick that cho bo dem nguoc, khong phai "hom nay" cua du lieu
  const now = Date.now();
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000));
}
