import type { Metadata } from "next";

import { SupportLogView } from "@/app/platform/log/support-log-view";

export const metadata: Metadata = {
  title: "Nhật ký hỗ trợ",
};

export default function SupportLogPage(): React.ReactElement {
  return <SupportLogView />;
}
