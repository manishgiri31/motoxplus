import type { Metadata } from "next";
import { ListingsIndex } from "@/components/vendor/listings/listings-index";

export const metadata: Metadata = { title: "Listings · Vendor portal" };

/** The vendor's listings. Data comes from the Java API (/api/v1/vendors/me/listings), scoped to the session. */
export default function VendorListingsPage() {
  return <ListingsIndex />;
}
