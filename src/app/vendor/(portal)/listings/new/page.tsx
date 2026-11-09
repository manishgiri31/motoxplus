import type { Metadata } from "next";
import { ListingEditor } from "@/components/vendor/listings/listing-editor";

export const metadata: Metadata = { title: "New listing · Vendor portal" };

export default function NewVendorListingPage() {
  return <ListingEditor />;
}
