"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  findPlatformUserIdByEmail,
  grantOwnerMembership,
  resetTempPasswordForUser,
} from "@/lib/data/mutations/platform";

/**
 * Hai duong ghi trang cua SADM-04, dat sau mot hop thoai chung.
 *
 * Ca hai nhan EMAIL chu khong uuid: thu doi van hanh co trong tay khi khach
 * goi den la mot dia chi email. Buoc phan giai email -> user_id nam o server
 * (`findPlatformUserIdByEmail`), va hai ham ghi van nhan `userId` — chung la
 * thao tac nguy hiem va nen nhan mot dinh danh khong go nham duoc.
 */
export type PlatformActionKind = "reset-password" | "grant-owner";

export function PlatformActionDialog({
  kind,
  companyId,
  companyName,
  onClose,
}: {
  kind: PlatformActionKind | null;
  /** Chi co nghia voi `grant-owner`. */
  companyId: string | null;
  companyName: string | null;
  onClose: () => void;
}): React.ReactElement {
  const [email, setEmail] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [isBusy, setIsBusy] = React.useState(false);
  const [issuedPassword, setIssuedPassword] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (kind === null) {
      setEmail("");
      setReason("");
      setIssuedPassword(null);
      setIsBusy(false);
    }
  }, [kind]);

  const handleSubmit = React.useCallback(async () => {
    if (kind === null) return;
    if (email.trim().length === 0) {
      toast.error("Vui lòng nhập email tài khoản.");
      return;
    }
    if (reason.trim().length === 0) {
      toast.error("Vui lòng nhập lý do.");
      return;
    }

    setIsBusy(true);
    try {
      const userId = await findPlatformUserIdByEmail(email);
      if (userId === null) {
        toast.error(`Không tìm thấy tài khoản với email ${email.trim()}.`);
        setIsBusy(false);
        return;
      }

      if (kind === "reset-password") {
        const result = await resetTempPasswordForUser(userId, reason);
        // Mat khau hien DUNG MOT LAN, ngay tai day — no khong duoc luu o dau
        // ca, ke ca audit_log.
        setIssuedPassword(result.temporaryPassword);
      } else {
        if (companyId === null) return;
        await grantOwnerMembership(companyId, userId, reason);
        toast.success(
          `Đã cấp quyền chủ doanh nghiệp cho ${email.trim()} tại ${companyName}.`,
        );
        onClose();
      }
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Thao tác không thành công.",
      );
    } finally {
      setIsBusy(false);
    }
  }, [kind, email, reason, companyId, companyName, onClose]);

  const isReset = kind === "reset-password";

  return (
    <Dialog
      open={kind !== null}
      onOpenChange={(open) => {
        if (!open && !isBusy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isReset ? "Cấp lại mật khẩu tạm" : "Cấp quyền chủ doanh nghiệp"}
          </DialogTitle>
          <DialogDescription>
            {isReset
              ? "Tài khoản sẽ buộc phải đổi mật khẩu ở lần đăng nhập tiếp theo. Thao tác này được ghi vào nhật ký."
              : `Cấp lại quyền chủ cho một tài khoản tại ${companyName}. Thao tác này được ghi vào nhật ký.`}
          </DialogDescription>
        </DialogHeader>

        {issuedPassword !== null ? (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              Mật khẩu tạm cho <strong>{email.trim()}</strong>:
            </p>
            <code className="block rounded-md bg-canvas-soft px-3 py-2 font-mono text-sm">
              {issuedPassword}
            </code>
            <p className="text-sm font-medium text-danger">
              Mật khẩu này không hiện lại được — hãy chép ngay.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform-email">Email tài khoản</Label>
              <Input
                id="platform-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="chu@doanhnghiep.vn"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-reason">Lý do</Label>
              <Textarea
                id="platform-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ví dụ: Ticket #418 — khách mất quyền truy cập"
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {issuedPassword !== null ? (
            <Button onClick={onClose}>Đã chép xong</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={isBusy}>
                Huỷ
              </Button>
              <Button onClick={() => void handleSubmit()} disabled={isBusy}>
                {isBusy ? "Đang xử lý…" : "Xác nhận"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
