import Link from "next/link";
import { getCancellationPolicy } from "@/lib/orders/cancellation-policy";
import { DEFAULT_CANCELLATION_POLICY } from "@/lib/orders/cancellation";

export const metadata = {
  title: "Cancellation Policy | MotoXPlus India Pvt. Ltd.",
  description: "Cancellation charges, refund timelines, and COD terms for orders placed on the MotoXPlus India dealer portal.",
};

export default async function CancellationPolicyPage() {
  // This is a static informational page, not the transactional cancel/refund
  // path — falling back to the documented default on a transient DB error
  // here is safe and keeps the page up; getCancellationPolicy() itself stays
  // unguarded because api/orders/[id]/cancel relies on it throwing rather
  // than silently charging a possibly-stale default.
  const policy = await getCancellationPolicy().catch(() => DEFAULT_CANCELLATION_POLICY);

  return (
    // Same plain-div/no-<main> convention as terms/privacy — see the comment
    // in those files: (public)/layout.tsx already renders the single <main>.
    <div className="min-h-screen bg-[var(--paper)] pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        <div className="mb-12">
          <div className="flex items-center gap-2 text-[var(--muted)] text-xs uppercase tracking-widest mb-4">
            <Link href="/" className="hover:text-red-500 transition-colors">Home</Link>
            <span>/</span>
            <span>Cancellation Policy</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-[var(--ink)] tracking-tight mb-4">
            Cancellation Policy
          </h1>
          <p className="text-[var(--muted)] text-sm">
            Applies to all orders placed through the MotoXPlus India dealer portal.
          </p>
        </div>

        <div className="border border-[var(--red)]/30 bg-[var(--red-soft)] rounded-sm p-5 mb-10">
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            You can cancel an order any time before it&apos;s delivered. A cancellation charge applies once an order
            has been placed, and it&apos;s higher after your order has shipped — see the two tiers below.
          </p>
        </div>

        <div className="space-y-10 text-[var(--muted)] leading-relaxed">
          <Section title="1. The two charge tiers">
            <p>
              The charge is a percentage of the order total (items + GST), and depends on how far the order has
              progressed when you cancel:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="bg-[var(--card)] border border-[var(--line)] rounded-sm p-5">
                <div className="text-red-500 font-black text-3xl mb-1">{policy.preShipChargePercent}%</div>
                <div className="text-[var(--ink)] font-bold text-sm mb-1">Before dispatch</div>
                <p className="text-[var(--muted)] text-xs">
                  Order is pending, confirmed, or being processed — not yet shipped.
                </p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--line)] rounded-sm p-5">
                <div className="text-red-500 font-black text-3xl mb-1">{policy.postShipChargePercent}%</div>
                <div className="text-[var(--ink)] font-bold text-sm mb-1">After dispatch</div>
                <p className="text-[var(--muted)] text-xs">
                  Order has shipped or is in transit, but hasn&apos;t been delivered yet.
                </p>
              </div>
            </div>
          </Section>

          <Section title="2. Once your order is delivered">
            <p>
              Orders can&apos;t be cancelled online after delivery — the same applies to orders that have already
              been cancelled or refunded. If there&apos;s a problem with a delivered order, please use our return/refund
              process instead, or contact support.
            </p>
          </Section>

          <Section title="3. How your refund is calculated">
            <p>
              Refund amount = the amount you actually paid for the order, minus the cancellation charge for the
              tier you cancelled in. The charge itself is calculated on the full order total (items + GST), not
              just the amount paid.
            </p>
            <p>
              For orders paid with a 20% advance, only the advance you paid is refundable — the charge is deducted
              from that advance, and the unpaid balance is simply not collected.
            </p>
          </Section>

          <Section title="4. Cash on Delivery (COD) orders">
            <p>
              If you haven&apos;t paid anything yet (pure COD, no advance), cancelling before dispatch is free — there&apos;s
              nothing to deduct a charge from, and no refund to process.
            </p>
            <p>
              Once a COD order has shipped, it can&apos;t be cancelled online. Please refuse the delivery at your
              doorstep, or contact support to arrange a return.
            </p>
          </Section>

          <Section title="5. Refund timelines">
            <p>
              Approved refunds are initiated immediately and typically reach your original payment method within
              5–7 working days, depending on your bank. You can track the status (Initiated / Completed / Failed)
              on the order&apos;s detail page.
            </p>
          </Section>

          <Section title="6. Contact">
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-sm p-5 mt-4">
              <p className="text-[var(--ink)] font-bold mb-1">MotoXPlus India Private Limited</p>
              <p className="text-[var(--muted)] text-sm">
                Email:{" "}
                <a href="mailto:info@motoxplus.com" className="text-red-500 hover:underline">info@motoxplus.com</a>
              </p>
              <p className="text-[var(--muted)] text-sm">Phone: +91 92171 31801</p>
            </div>
          </Section>
        </div>

        <div className="mt-14 pt-8 border-t border-[var(--line)]">
          <Link href="/" className="text-red-500 hover:text-red-400 text-sm font-semibold transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-[var(--ink)] mb-4 flex items-center gap-3">
        <span className="w-1 h-5 bg-red-600 rounded-full block flex-shrink-0" />
        {title}
      </h2>
      <div className="space-y-3 pl-4 border-l border-[var(--line)]">{children}</div>
    </section>
  );
}
