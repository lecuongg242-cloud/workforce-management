import type { Metadata } from "next";

import { OnboardingWizard } from "@/app/(auth)/onboarding/onboarding-wizard";

export const metadata: Metadata = {
  title: "Tạo doanh nghiệp",
};

export default function OnboardingPage(): React.ReactElement {
  return <OnboardingWizard />;
}
