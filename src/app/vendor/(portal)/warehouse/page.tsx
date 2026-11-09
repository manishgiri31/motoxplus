import type { Metadata } from "next";
import { WarehouseSetup } from "@/components/vendor/warehouse/warehouse-setup";

export const metadata: Metadata = { title: "Pickup warehouse · Vendor portal" };

/** The vendor's Delhivery pickup warehouse. Data comes from the Java API (/api/v1/vendors/me/warehouse). */
export default function VendorWarehousePage() {
  return <WarehouseSetup />;
}
