"use client";

import * as React from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateReadablePassword } from "@/lib/auth/generate-password";
import { PASSWORD_FIELD_LABELS } from "@/lib/constants";

/**
 * O nhap mat khau DAT CHO NGUOI KHAC: mot o + nut sinh mat khau + nut hien/an.
 *
 * Dung o hai cho — tao tai khoan va dat lai mat khau nhan vien — deu la tinh
 * huong quan tri dat mat khau cho nguoi khac roi doc cho ho.
 *
 * KHONG dung cho man hinh nguoi dung tu doi mat khau cua CHINH minh: o do
 * nguoi ta go bi mat cua minh, khong nen co nut hien ra man hinh, va van can o
 * "nhap lai" de bat go nham.
 *
 * Bam sinh mat khau thi TU HIEN luon — bam sinh la de doc chuoi do cho nhan
 * vien, che lai thi vo nghia.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}): React.ReactElement {
  const [isVisible, setIsVisible] = React.useState(false);

  const handleGenerate = (): void => {
    onChange(generateReadablePassword());
    setIsVisible(true);
  };

  return (
    <div className="grid gap-2">
      <Field id={id} label={label} error={error} required>
        <Input
          type={isVisible ? "text" : "password"}
          autoComplete="new-password"
          // `num` cho chuoi sinh ra deu net va de doc tung ky tu mot.
          className={isVisible ? "num" : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleGenerate}>
          <RefreshCw aria-hidden="true" />
          {PASSWORD_FIELD_LABELS.generateButton}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={isVisible}
          onClick={() => setIsVisible((previous) => !previous)}
        >
          {isVisible ? (
            <>
              <EyeOff aria-hidden="true" />
              {PASSWORD_FIELD_LABELS.hidePassword}
            </>
          ) : (
            <>
              <Eye aria-hidden="true" />
              {PASSWORD_FIELD_LABELS.showPassword}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
