import type { Metadata } from "next";
import { ApplicationProvider } from "@/components/vendor/onboarding/application-context";
import { OnboardingFrame } from "@/components/vendor/onboarding/onboarding-frame";

export const metadata: Metadata = {
  title: "Vendor setup | MotoXPlus",
  robots: { index: false, follow: false },
};

/** Focused setup flow for vendor applicants: no portal sidebar, one feature per page. */
export default function VendorOnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationProvider>
      <OnboardingFrame>{children}</OnboardingFrame>
    </ApplicationProvider>
  );
}
