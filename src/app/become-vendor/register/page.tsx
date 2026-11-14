import { redirect } from "next/navigation";

/** Becoming a vendor is one step on /become-vendor now (VendorStartCard); old links land there. */
export default function VendorRegisterPage() {
  redirect("/become-vendor#start");
}
