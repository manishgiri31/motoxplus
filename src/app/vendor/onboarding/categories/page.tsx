import type { Metadata } from "next";
import { CategoriesStep } from "@/components/vendor/onboarding/categories-step";

export const metadata: Metadata = { title: "Categories | Vendor setup | MotoXPlus" };

export default function Page() {
  return <CategoriesStep />;
}
