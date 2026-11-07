import type { Metadata } from "next";
import { ApplicationReview } from "@/components/admin/vendor-applications/application-review";

export const metadata: Metadata = { title: "Review vendor application | Admin" };

export default async function VendorApplicationReviewPage(props: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await props.params;
  return <ApplicationReview vendorId={vendorId} />;
}
