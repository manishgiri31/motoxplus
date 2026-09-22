import { SectionIntro } from "@/components/ui/section-intro";
import { OrderTimeline, type OrderTimelineStep } from "@/components/orders/order-timeline";

// Illustrative sequence for the homepage explainer — not tied to any real
// order. Dealer-portal order pages compute this from actual Order/Shipment
// state (see src/app/dealer/orders/[id]); this is presentation only.
const STEPS: OrderTimelineStep[] = [
  { key: "placed", label: "Order Placed", state: "completed" },
  { key: "payment", label: "Payment Confirmed", state: "completed" },
  { key: "processing", label: "Processing", state: "completed" },
  { key: "packed", label: "Packed", state: "current" },
  { key: "dispatched", label: "Dispatched", state: "pending" },
  { key: "delivered", label: "Delivered", state: "pending" },
];

/** Section 10 — the order → delivery lifecycle, reusing OrderTimeline (the
 *  same component the dealer portal's real order-tracking page will use). */
export function OrderLifecycleSection() {
  return (
    <section className="border-t border-[var(--line)] bg-[var(--paper)] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionIntro
          index="10"
          eyebrow="Order to Delivery"
          headline="Every order, tracked end to end."
          description="From payment confirmation through dispatch — backed by our Razorpay/UPI payment flow and Delhivery shipment tracking."
          align="center"
          className="mb-16"
        />
        <OrderTimeline steps={STEPS} orientation="horizontal" />
      </div>
    </section>
  );
}
