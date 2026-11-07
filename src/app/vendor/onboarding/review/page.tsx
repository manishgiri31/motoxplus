import type { Metadata } from "next";
import { ReviewStep } from "@/components/vendor/onboarding/review-step";

export const metadata: Metadata = { title: "Review | Vendor setup | MotoXPlus" };

export default function Page() {
  return <ReviewStep />;
}
