import type { Metadata } from "next";
import { DocumentsStep } from "@/components/vendor/onboarding/documents-step";

export const metadata: Metadata = { title: "Documents | Vendor setup | MotoXPlus" };

export default function Page() {
  return <DocumentsStep />;
}
