import type { Metadata } from "next";

import { PlatformView } from "@/app/platform/platform-view";

export const metadata: Metadata = {
  title: "Doanh nghiệp",
};

export default function PlatformPage(): React.ReactElement {
  return <PlatformView />;
}
