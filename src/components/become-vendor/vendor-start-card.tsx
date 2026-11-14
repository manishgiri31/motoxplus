import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { WORKSPACE_INFO, isWorkspace } from "@/lib/auth/workspaces";
import { SELLER_SIGNUP_OPEN } from "@/lib/seller/config";
import { AttachVendorProfile } from "@/components/vendor/onboarding/attach-vendor-profile";
import { SellerInterestForm } from "./seller-interest-form";
import { VendorQuickStart } from "./vendor-quick-start";

/**
 * The one place to become a vendor (/become-vendor#start), chosen by who is looking:
 * - nobody signed in: the one-step signup (form, then both codes in the same card, then the dashboard);
 * - a dealer or customer: add selling to the same login in one click;
 * - already a vendor: a link to the dashboard;
 * - while signup is closed (NEXT_PUBLIC_SELLER_SIGNUP_OPEN unset): the interest form.
 */
export async function VendorStartCard() {
  if (!SELLER_SIGNUP_OPEN) return <SellerInterestForm />;

  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (role === "VENDOR") {
    return (
      <div className="border border-black/15 bg-white p-5 sm:p-7">
        <h2 className="font-grotesk text-[24px] font-semibold tracking-[-0.02em] text-mx-black">You&apos;re already a vendor</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-[#5b5b63]">Manage listings, orders and payouts from your dashboard.</p>
        <Link
          href="/vendor/dashboard"
          className="mt-5 inline-flex items-center gap-2 bg-mx-red px-5 py-3 font-grotesk text-[14px] font-semibold uppercase tracking-[0.08em] text-white hover:opacity-90"
        >
          Open vendor dashboard <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    );
  }

  if ((role === "DEALER" || role === "CUSTOMER") && session?.user?.email && isWorkspace(role)) {
    return (
      <div className="border border-black/15 bg-white p-5 sm:p-7">
        <AttachVendorProfile email={session.user.email} workspaceLabel={WORKSPACE_INFO[role].label} />
      </div>
    );
  }

  if (role) {
    // Staff/admin sessions don't sell.
    return (
      <div className="border border-black/15 bg-white p-5 text-[14px] text-[#5b5b63] sm:p-7">
        You&apos;re signed in with a staff account. Sign out to register a vendor.
      </div>
    );
  }

  return <VendorQuickStart />;
}
