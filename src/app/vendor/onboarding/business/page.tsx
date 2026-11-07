import type { Metadata } from "next";
import { BusinessStep } from "@/components/vendor/onboarding/business-step";

export const metadata: Metadata = { title: "Business | Vendor setup | MotoXPlus" };

export default function Page() {
  return <BusinessStep />;
}
