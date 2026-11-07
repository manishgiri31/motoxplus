import type { Metadata } from "next";
import { Suspense } from "react";
import { ApplicationsQueue } from "@/components/admin/vendor-applications/applications-queue";

export const metadata: Metadata = { title: "Vendor applications | Admin" };

export default function VendorApplicationsPage() {
  return (
    <Suspense>
      <ApplicationsQueue />
    </Suspense>
  );
}
