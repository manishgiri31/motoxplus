import type { Metadata } from "next";
import { ListingEditor } from "@/components/vendor/listings/listing-editor";

export const metadata: Metadata = { title: "Edit listing · Vendor portal" };

/** Ownership is checked by the Java API from the session: another vendor's id answers 404. */
export default async function EditVendorListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingEditor listingId={id} />;
}
