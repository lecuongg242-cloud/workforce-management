import type { Metadata } from "next";

import { SelectCompanyView } from "@/app/(auth)/select-company/select-company-view";

export const metadata: Metadata = {
  title: "Chọn doanh nghiệp",
};

export default function SelectCompanyPage(): React.ReactElement {
  return (
    <div className="min-h-dvh bg-canvas-soft">
      <SelectCompanyView />
    </div>
  );
}
