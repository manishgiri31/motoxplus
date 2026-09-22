import Link from "next/link";
import { getLegalSettings } from "@/lib/legal-settings";

export const metadata = {
  title: "Terms & Conditions | MotoXPlus India Pvt. Ltd.",
  description: "Terms and conditions governing use of the MotoXPlus India dealer portal and website, for both dealer (B2B) and retail customer (B2C) accounts.",
};

// Draft — pending lawyer review. Bump this on every substantive content
// change (Amendments, Section 15, requires it).
const LAST_UPDATED = "September 22, 2026";

export default async function TermsPage() {
  const legal = await getLegalSettings();

  return (
    // A plain div, not <main> — (public)/layout.tsx already renders the page's one
    // <main> landmark; this page previously imported Navbar/Footer directly and
    // nested a second <main> inside it, so it rendered the site chrome twice.
    <div className="min-h-screen bg-[var(--paper)] pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-2 text-[var(--muted)] text-xs uppercase tracking-widest mb-4">
              <Link href="/" className="hover:text-red-500 transition-colors">Home</Link>
              <span>/</span>
              <span>Terms &amp; Conditions</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-[var(--ink)] tracking-tight mb-4">
              Terms &amp; Conditions
            </h1>
            <p className="text-[var(--muted)] text-sm">
              Last updated: <span className="text-[var(--muted)]">{LAST_UPDATED}</span>
            </p>
          </div>

          {/* Draft notice */}
          <div className="border border-amber-500/40 bg-amber-500/10 rounded-sm p-4 mb-6">
            <p className="text-[var(--muted)] text-xs leading-relaxed">
              <strong className="text-[var(--ink)]">Draft — pending legal review.</strong> This page is being
              updated to separately cover dealer (B2B) and retail customer (B2C) accounts and is not yet final.
            </p>
          </div>

          {/* Intro */}
          <div className="border border-[var(--red)]/30 bg-[var(--red-soft)] rounded-sm p-5 mb-10">
            <p className="text-[var(--muted)] text-sm leading-relaxed">
              These Terms &amp; Conditions govern use of the MotoXPlus India website and dealer portal. They apply
              to two kinds of accounts: <strong className="text-[var(--ink)]">Dealers</strong> (registered
              businesses buying at wholesale for resale — Part A below) and{" "}
              <strong className="text-[var(--ink)]">Retail Customers</strong> (individuals buying for personal use —
              Part B below). Sections outside Parts A and B apply to both. By registering an account or placing an
              order, you agree to be bound by the Terms applicable to your account type. If you do not agree, do
              not use our services.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-10 text-[var(--muted)] leading-relaxed">

            <Section title="1. Definitions">
              <ul>
                <li><strong className="text-[var(--ink)]">&ldquo;Company&rdquo;</strong> means {legal.companyName} (GSTIN: {legal.gstin}), registered at {legal.registeredAddress}.</li>
                <li><strong className="text-[var(--ink)]">&ldquo;Dealer&rdquo;</strong> means a registered business entity that has created an account to purchase products at wholesale prices through the dealer portal (Part A applies).</li>
                <li><strong className="text-[var(--ink)]">&ldquo;Retail Customer&rdquo;</strong> means an individual who has created an account to purchase products for personal use through the website (Part B applies).</li>
                <li><strong className="text-[var(--ink)]">&ldquo;Platform&rdquo;</strong> means the website motoxplus.in and all associated web applications.</li>
                <li><strong className="text-[var(--ink)]">&ldquo;Products&rdquo;</strong> means automotive spare parts listed on the Platform.</li>
                <li><strong className="text-[var(--ink)]">&ldquo;Order&rdquo;</strong> means a confirmed purchase submitted by a Dealer or Retail Customer through the Platform.</li>
              </ul>
            </Section>

            <Section title="2. Account Security">
              <p>
                You are responsible for maintaining the confidentiality of your account credentials. All
                activities performed under your account are your responsibility. Notify us immediately at{" "}
                <a href={`mailto:${legal.customerCareEmail}`} className="text-red-500 hover:underline">{legal.customerCareEmail}</a>{" "}
                if you suspect unauthorised access. The Company will not be liable for losses resulting from
                unauthorised account use.
              </p>
            </Section>

            {/* ── PART A: DEALER (B2B) TERMS ── */}
            <div className="border-t-2 border-[var(--red)]/40 pt-10">
              <div className="mb-6">
                <span className="inline-block bg-[var(--red)] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                  Part A
                </span>
                <h2 className="text-2xl font-black text-[var(--ink)] tracking-tight">Dealer (B2B) Terms</h2>
                <p className="text-sm mt-1">Applies to registered Dealer accounts purchasing at wholesale prices.</p>
              </div>

              <div className="space-y-10">
                <Section title="A1. Dealer Registration &amp; Eligibility">
                  <p>To register as a dealer you must:</p>
                  <ul>
                    <li>Be a legally incorporated business entity in India with a valid GSTIN</li>
                    <li>Provide accurate company details, owner information, and contact data during registration</li>
                    <li>Verify your email address and mobile number to activate the account</li>
                  </ul>
                  <p className="mt-3">
                    Dealer accounts are activated on registration without a prior approval step. The Company
                    nevertheless reserves the right to suspend or terminate any dealer account at its sole
                    discretion. False or misleading information provided during registration is grounds for
                    immediate account termination.
                  </p>
                </Section>

                <Section title="A2. Orders &amp; Acceptance">
                  <p>
                    Placing an order through the dealer portal constitutes an offer to purchase. An order is
                    accepted and a binding contract is formed only when payment (Full Payment or the 20% Advance,
                    see A4) is successfully verified and the order status changes to <em>Confirmed</em>. Every
                    dealer order requires at least a 20% payment at placement — the Company does not offer a
                    zero-advance Cash on Delivery option.
                  </p>
                  <p className="mt-3">
                    The Company reserves the right to cancel any order before dispatch due to stock unavailability,
                    pricing errors, or suspected fraud. In such cases, prepaid amounts will be fully refunded.
                  </p>
                </Section>

                <Section title="A3. Pricing &amp; Taxes">
                  <ul>
                    <li>Dealer prices displayed on the Platform are exclusive of GST.</li>
                    <li>GST is charged at the rate applicable to each product (shown on the product page) and added at checkout.</li>
                    <li>Prices are subject to change without notice; the price applicable at time of order confirmation prevails.</li>
                    <li>The Company issues GST-compliant tax invoices for all confirmed orders.</li>
                  </ul>
                </Section>

                <Section title="A4. Payment Terms">
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold text-[var(--ink)] mb-1">A4.1 Full Payment (100%)</p>
                      <p>The full invoice amount is due at the time of order placement via Razorpay.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--ink)] mb-1">A4.2 20% Advance Payment</p>
                      <p>
                        A minimum 20% advance is due at order placement via Razorpay. The remaining 80% balance is
                        collected in cash or UPI by the delivery agent at the time of delivery. Advance-payment
                        orders are queued for dispatch behind fully-paid orders. The Company reserves the right to
                        withdraw or restrict this option for any dealer, delivery location, or order value.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--ink)] mb-1">A4.3 Failed Payments</p>
                      <p>
                        If an online payment fails, the order remains in <em>Pending</em> status and is not
                        processed. Contact support to retry or choose an alternate payment method.
                      </p>
                    </div>
                  </div>
                </Section>

                <Section title="A5. Minimum Order Quantity (MOQ)">
                  <p>
                    Each product on the dealer portal has a minimum order quantity (MOQ), shown on the product
                    listing and detail page. Orders must be placed in multiples of a product&rsquo;s MOQ; the
                    Platform will not accept a dealer order below or between MOQ multiples for that product. MOQ
                    does not apply to Retail Customer orders (see Part B).
                  </p>
                </Section>

                <Section title="A6. GST Benefit Scheme">
                  <p>
                    From time to time the Company may run a &ldquo;GST Benefit Scheme&rdquo; for dealer orders that meet
                    a scheme&rsquo;s minimum order value. An eligible order earns a benefit equal to a percentage
                    (set per scheme) of the order&rsquo;s taxable value, subject to a maximum benefit cap where one
                    applies. The benefit may be redeemed for additional products from the categories eligible under
                    that scheme, invoiced at full dealer price with a corresponding scheme discount applied against
                    those items. Scheme eligibility, benefit percentage, eligible categories, and validity period
                    are set by the Company for each scheme and may be changed, withdrawn, or discontinued at any
                    time without prior notice. Any unused benefit on an order lapses and does not carry forward.
                    Cancelling or partially cancelling an order that used a scheme may reduce or reverse the
                    associated benefit — see the Cancellation Policy (Section B/6 below).
                  </p>
                </Section>

                <Section title="A7. Returns &amp; Refunds">
                  <p>
                    Returns are accepted within <strong className="text-[var(--ink)]">7 days</strong> of
                    delivery for products that are:
                  </p>
                  <ul>
                    <li>Damaged or defective on arrival (with unboxing evidence)</li>
                    <li>Incorrectly shipped (wrong SKU or part number)</li>
                  </ul>
                  <p className="mt-3">
                    Returns are <strong className="text-[var(--ink)]">not accepted</strong> for products
                    that have been installed, modified, or are not in original packaging. To initiate a return,
                    email <a href={`mailto:${legal.customerCareEmail}`} className="text-red-500 hover:underline">{legal.customerCareEmail}</a>{" "}
                    within the return window with your order number and photographic evidence.
                  </p>
                  <p className="mt-3">
                    Approved refunds for prepaid amounts will be processed to the original payment source within
                    5–7 business days.
                  </p>
                </Section>
              </div>
            </div>

            {/* ── PART B: RETAIL CUSTOMER (B2C) TERMS ── */}
            <div className="border-t-2 border-[var(--red)]/40 pt-10">
              <div className="mb-6">
                <span className="inline-block bg-[var(--red)] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                  Part B
                </span>
                <h2 className="text-2xl font-black text-[var(--ink)] tracking-tight">Retail Customer (B2C) Terms</h2>
                <p className="text-sm mt-1">Applies to Retail Customer accounts purchasing for personal use.</p>
              </div>

              <div className="space-y-10">
                <Section title="B1. Orders &amp; Acceptance">
                  <p>
                    Placing an order constitutes an offer to purchase. An order is accepted and a binding contract
                    is formed only when payment is successfully verified and the order status changes to{" "}
                    <em>Confirmed</em>.
                  </p>
                  <p className="mt-3">
                    The Company reserves the right to cancel any order before dispatch due to stock unavailability,
                    pricing errors, or suspected fraud. In such cases, the amount paid will be fully refunded.
                  </p>
                </Section>

                <Section title="B2. Pricing &amp; Taxes">
                  <ul>
                    <li>All prices shown to Retail Customers are the MRP, <strong className="text-[var(--ink)]">inclusive of GST</strong> — the number you see is the number you pay for that item.</li>
                    <li>Where an ex-GST price and GST rate are also shown alongside the MRP, they are shown for transparency only; the MRP is the price used for your order.</li>
                    <li>Prices are subject to change without notice; the price applicable at the time your order is confirmed prevails.</li>
                    <li>The Company issues a GST-compliant tax invoice for every confirmed order.</li>
                  </ul>
                </Section>

                <Section title="B3. Payment Terms">
                  <p>
                    Retail Customer orders require full payment (100% of the order value) at the time of order
                    placement, via Razorpay. The Company does not offer a partial-advance or Cash on Delivery
                    option for Retail Customer orders. If an online payment fails, the order remains in{" "}
                    <em>Pending</em> status and is not processed.
                  </p>
                </Section>

                <Section title="B4. Returns &amp; Refunds">
                  <p>
                    Returns are accepted within <strong className="text-[var(--ink)]">7 days</strong> of delivery,
                    except for the categories listed below. To initiate a return, email{" "}
                    <a href={`mailto:${legal.customerCareEmail}`} className="text-red-500 hover:underline">{legal.customerCareEmail}</a>{" "}
                    within the return window with your order number and photographic evidence.
                  </p>
                  <p className="mt-3 font-semibold text-[var(--ink)]">Not eligible for return:</p>
                  <ul>
                    <li>Electrical parts once installed or wired in</li>
                    <li>Safety-critical parts (e.g. brakes, suspension, structural components) once fitted</li>
                    <li>Consumables (e.g. oils, filters, gaskets, seals) once the packaging has been opened</li>
                    <li>Custom-order or made-to-order products</li>
                  </ul>
                  <p className="mt-3">
                    Approved refunds will be processed to the original payment source within 5–7 business days.
                  </p>
                </Section>
              </div>
            </div>

            {/* ── GENERAL TERMS (both Dealers and Retail Customers) ── */}
            <div className="border-t-2 border-[var(--line)] pt-10">
              <h2 className="text-2xl font-black text-[var(--ink)] tracking-tight mb-6">General Terms</h2>

              <div className="space-y-10">
                <Section title="C1. Shipping &amp; Delivery">
                  <ul>
                    <li>Estimated delivery timelines are indicative and not guaranteed.</li>
                    <li>The Company ships to all serviceable pin codes across India.</li>
                    <li>Shipping charges, if any, will be communicated at checkout or invoice stage.</li>
                    <li>Risk of loss or damage passes to you upon handover to the carrier.</li>
                    <li>The Company is not liable for delays caused by carrier failures, natural disasters, or circumstances beyond its control (force majeure).</li>
                  </ul>
                </Section>

                <Section title="C2. Cancellations">
                  <p>
                    Order cancellation charges and timelines (before vs. after dispatch) are set out in the{" "}
                    <Link href="/cancellation-policy" className="text-red-500 hover:underline">Cancellation Policy</Link>,
                    which forms part of these Terms.
                  </p>
                </Section>

                <Section title="C3. Intellectual Property">
                  <p>
                    All content on the Platform — including the MotoXPlus brand, logo, product images, descriptions,
                    and website design — is the exclusive intellectual property of {legal.companyName}. You may
                    not reproduce, distribute, or use our brand assets without prior written consent.
                  </p>
                </Section>

                <Section title="C4. Prohibited Conduct">
                  <p>You agree not to:</p>
                  <ul>
                    <li>Use the Platform for any unlawful purpose or in violation of these Terms</li>
                    <li>Resell products in a manner that damages the MotoXPlus brand reputation (Dealers only)</li>
                    <li>Attempt to gain unauthorised access to any part of the Platform or its servers</li>
                    <li>Scrape, crawl, or automate access to Platform data without permission</li>
                    <li>Impersonate MotoXPlus or its employees to third parties</li>
                  </ul>
                </Section>

                <Section title="C5. Limitation of Liability">
                  <p>
                    To the maximum extent permitted by applicable law, the Company shall not be liable for any
                    indirect, incidental, special, or consequential damages, including lost profits or business
                    interruption, arising from use of the Platform or products.
                  </p>
                  <p className="mt-3">
                    The Company&apos;s total liability for any claim arising under these Terms shall not exceed the
                    value of the specific order to which the claim relates. Nothing in this section limits any
                    liability that cannot be excluded or limited under applicable Indian consumer protection law.
                  </p>
                </Section>

                <Section title="C6. Indemnification">
                  <p>
                    You agree to indemnify and hold harmless {legal.companyName}, its directors, employees, and
                    agents from any claims, damages, or expenses (including legal fees) arising from your breach
                    of these Terms or your use of the Platform.
                  </p>
                </Section>

                <Section title="C7. Governing Law &amp; Dispute Resolution">
                  <p>
                    These Terms are governed by and construed in accordance with the laws of India. Any disputes
                    arising from or relating to these Terms shall be subject to the exclusive jurisdiction of the
                    courts of <strong className="text-[var(--ink)]">{legal.jurisdiction}</strong>.
                  </p>
                  <p className="mt-3">
                    The parties shall first attempt to resolve disputes amicably. If unresolved within 30 days,
                    disputes may be referred to arbitration under the Arbitration and Conciliation Act, 1996.
                  </p>
                </Section>

                <Section title="C8. Grievance Officer">
                  <p>
                    In accordance with the Consumer Protection (E-Commerce) Rules, 2020, the details of the
                    Grievance Officer are as follows:
                  </p>
                  <div className="bg-[var(--card)] border border-[var(--line)] rounded-sm p-5 mt-4">
                    <p className="text-[var(--ink)] font-bold mb-1">
                      {legal.grievanceOfficerName || <span className="text-[var(--muted)] italic font-normal">[Grievance Officer name — to be added]</span>}
                    </p>
                    <p className="text-[var(--muted)] text-sm">
                      Email:{" "}
                      {legal.grievanceOfficerEmail ? (
                        <a href={`mailto:${legal.grievanceOfficerEmail}`} className="text-red-500 hover:underline">{legal.grievanceOfficerEmail}</a>
                      ) : (
                        <span className="italic">[to be added]</span>
                      )}
                    </p>
                    <p className="text-[var(--muted)] text-sm">
                      Phone: {legal.grievanceOfficerPhone || <span className="italic">[to be added]</span>}
                    </p>
                    <p className="text-[var(--muted)] text-sm">
                      Response time: {legal.grievanceResponseTime || <span className="italic">[to be added]</span>}
                    </p>
                  </div>
                </Section>

                <Section title="C9. Amendments">
                  <p>
                    The Company may revise these Terms at any time. The revised Terms will be posted on this page
                    with an updated &ldquo;Last updated&rdquo; date. Your continued use of the Platform following any changes
                    constitutes your acceptance of the new Terms.
                  </p>
                </Section>

                <Section title="C10. Contact &amp; Customer Care">
                  <div className="bg-[var(--card)] border border-[var(--line)] rounded-sm p-5 mt-4">
                    <p className="text-[var(--ink)] font-bold mb-1">{legal.companyName}</p>
                    <p className="text-[var(--muted)] text-sm">{legal.registeredAddress}</p>
                    <p className="text-[var(--muted)] text-sm">
                      Email:{" "}
                      <a href={`mailto:${legal.customerCareEmail}`} className="text-red-500 hover:underline">{legal.customerCareEmail}</a>
                    </p>
                    <p className="text-[var(--muted)] text-sm">Phone: {legal.customerCarePhone}</p>
                    <p className="text-[var(--muted)] text-sm">GSTIN: {legal.gstin}</p>
                  </div>
                </Section>
              </div>
            </div>
          </div>

          {/* Back link */}
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
