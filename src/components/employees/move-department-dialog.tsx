"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import type { Department } from "@/lib/types/domain";

/** Hop thoai chuyen phong ban cho mot hoac nhieu nhan vien */
export function MoveDepartmentDialog({
  open,
  onOpenChange,
  departments,
  count,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  count: number;
  isPending: boolean;
  onConfirm: (departmentId: string) => void;
}): React.ReactElement {
  const [departmentId, setDepartmentId] = React.useState("");

  React.useEffect(() => {
    if (open) setDepartmentId("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chuyển phòng ban</DialogTitle>
          <DialogDescription>
            {count === 1
              ? "Chọn phòng ban mới cho nhân viên đã chọn."
              : `Chọn phòng ban mới cho ${formatNumber(count)} nhân viên đã chọn.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="move-department">Phòng ban mới</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger id="move-department" className="w-full">
              <SelectValue placeholder="Chọn phòng ban" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Hủy
          </Button>
          <Button
            disabled={!departmentId || isPending}
            onClick={() => onConfirm(departmentId)}
          >
            {isPending ? "Đang chuyển…" : "Chuyển phòng ban"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
