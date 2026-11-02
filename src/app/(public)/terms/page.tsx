import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/store/container";
import { LegalToc } from "@/components/legal/legal-toc";
import { getLegalSettings } from "@/lib/legal-settings";
import { getCancellationPolicy } from "@/lib/orders/cancellation-policy";
import { DEFAULT_CANCELLATION_POLICY } from "@/lib/orders/cancellation";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms for buying from MotoXPlus India — covering dealer (B2B) and retail customer (B2C) accounts: orders, pricing and GST, payment, shipping, cancellations and returns.",
};

// Bump on every substantive content change (see "Changes to these terms").
// Written in-house and not yet reviewed by counsel — get it reviewed before
// relying on it in a dispute.
const LAST_UPDATED = "2 November 2026";

const linkClass = "text-store-link hover:underline";

interface TermsSection {
  id: string;
  title: string;
  /** Set when the whole section applies to one account type only. */
  audience?: string;
  body: React.ReactNode;
}

export default async function TermsPage() {
  const legal = await getLegalSettings();
  // Same rationale as the cancellation-policy page: a static informational
  // page falls back to the documented default rather than going down.
  const policy = await getCancellationPolicy().catch(() => DEFAULT_CANCELLATION_POLICY);

  const email = (
    <a href={`mailto:${legal.customerCareEmail}`} className={linkClass}>
      {legal.customerCareEmail}
    </a>
  );
  const cancellationLink = (
    <Link href="/cancellation-policy" className={linkClass}>
      Cancellation Policy
    </Link>
  );

  const hasOfficer = Boolean(legal.grievanceOfficerName);

  const sections: TermsSection[] = [
    {
      id: "about",
      title: "About these terms",
      body: (
        <>
          <p>
            These Terms &amp; Conditions are an agreement between you and {legal.companyName} (GSTIN {legal.gstin}),
            registered at {legal.registeredAddress} (&ldquo;MotoXPlus&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
            They apply whenever you browse motoxplus.in, create an account or place an order.
          </p>
          <p>There are two kinds of account, and a few terms differ between them. We label these wherever they do:</p>
          <ul>
            <li>
              <strong>Dealers</strong> are registered businesses buying at wholesale for resale.
            </li>
            <li>
              <strong>Retail customers</strong> are individuals buying for their own use.
            </li>
          </ul>
          <p>
            By creating an account or placing an order you agree to these Terms, our{" "}
            {cancellationLink} and our{" "}
            <Link href="/privacy" className={linkClass}>
              Privacy Policy
            </Link>
            , which explains how we handle your personal data. If you don&rsquo;t agree, please don&rsquo;t use the
            platform.
          </p>
        </>
      ),
    },
    {
      id: "definitions",
      title: "Definitions",
      body: (
        <ul>
          <li>
            <strong>Platform</strong> — our website, motoxplus.in, and the MotoXPlus apps.
          </li>
          <li>
            <strong>Products</strong> — the automotive spare parts and accessories listed on the Platform.
          </li>
          <li>
            <strong>Order</strong> — a purchase of Products that you submit through the Platform.
          </li>
          <li>
            <strong>Dealer</strong> — a registered business with an account to buy Products at wholesale prices.
          </li>
          <li>
            <strong>Retail customer</strong> — an individual with an account to buy Products for personal use.
          </li>
        </ul>
      ),
    },
    {
      id: "accounts",
      title: "Your account",
      body: (
        <>
          <p>
            You&rsquo;re responsible for keeping your login details confidential, and for everything done through your
            account. Give us accurate information and keep it up to date. If you think someone else has accessed your
            account, email {email} straight away. We aren&rsquo;t liable for losses caused by unauthorised use of your
            account, except where the law says otherwise.
          </p>
          <Sub>Dealers</Sub>
          <p>To register as a Dealer you must:</p>
          <ul>
            <li>be a legally incorporated business in India with a valid GSTIN;</li>
            <li>give accurate company, owner and contact details; and</li>
            <li>verify your email address and mobile number.</li>
          </ul>
          <p>
            Dealer accounts are active as soon as you register — there&rsquo;s no separate approval step.
          </p>
          <Sub>Retail customers</Sub>
          <p>You must be 18 or older and able to enter into a binding contract.</p>
          <Sub>Suspension</Sub>
          <p>
            We may suspend or close any account that breaches these Terms, is used for fraud, or was opened with false or
            misleading information.
          </p>
        </>
      ),
    },
    {
      id: "product-information",
      title: "Product information",
      body: (
        <p>
          We work to keep descriptions, images, vehicle-fitment details and stock levels accurate, but they&rsquo;re a
          guide, not a guarantee. Please check that a part fits your vehicle before you order. Photographs may differ
          slightly from the product you receive.
        </p>
      ),
    },
    {
      id: "orders",
      title: "Orders & acceptance",
      body: (
        <>
          <p>
            Placing an order is an offer to buy. We accept it — and a binding contract is formed — only when the order
            shows as <em>Confirmed</em>.
          </p>
          <Sub>Dealers</Sub>
          <p>
            An order is Confirmed once your payment is verified. Every Dealer order needs at least 20% paid upfront;
            there is no zero-advance Cash on Delivery option (see Payment).
          </p>
          <Sub>Retail customers</Sub>
          <p>
            An order paid online is Confirmed once the payment is verified. A Cash on Delivery order is Confirmed when
            you place it.
          </p>
          <Sub>Cancelling before dispatch</Sub>
          <p>
            We may cancel any order before it ships because of stock unavailability, a pricing error or suspected
            fraud. If we do, we refund everything you&rsquo;ve paid in full.
          </p>
        </>
      ),
    },
    {
      id: "pricing",
      title: "Pricing & GST",
      body: (
        <>
          <Sub>Dealers</Sub>
          <p>
            Prices on the Platform exclude GST. GST is charged at the rate for each Product (shown on the product page)
            and added at checkout.
          </p>
          <Sub>Retail customers</Sub>
          <p>
            Prices are the MRP and <strong>include GST</strong> — the price you see is the price you pay for that item.
            Where an ex-GST price and GST rate are also shown, that&rsquo;s for transparency only; the MRP is what your
            order uses.
          </p>
          <Sub>Everyone</Sub>
          <p>
            Prices can change without notice. The price applicable when your order is confirmed is the one that counts.
            We issue a GST-compliant tax invoice for every confirmed order.
          </p>
        </>
      ),
    },
    {
      id: "payment",
      title: "Payment",
      body: (
        <>
          <p>
            The payment options available are shown at checkout and can vary by account type, order and delivery
            location. Online payments are processed by Razorpay — we never see or store your card or bank details.
          </p>
          <Sub>Dealers</Sub>
          <ul>
            <li>
              <strong>Full payment online.</strong> The full invoice amount, by card, netbanking or UPI through Razorpay.
            </li>
            <li>
              <strong>20% advance.</strong> At least 20% online when you place the order; the remaining 80% is paid in
              cash or UPI to the delivery agent on delivery. Advance orders are dispatched after fully paid orders. We
              can withdraw or restrict this option for any Dealer, delivery location or order value.
            </li>
            <li>
              <strong>Direct UPI or bank transfer.</strong> Pay in full by UPI or NEFT/IMPS, then submit the transaction
              reference (UTR) on the portal. The order moves ahead once we&rsquo;ve verified the payment.
            </li>
          </ul>
          <Sub>Retail customers</Sub>
          <ul>
            <li>
              <strong>Pay online in full</strong> by card, netbanking or UPI through Razorpay.
            </li>
            <li>
              <strong>Cash on Delivery</strong>, where available — you pay the full amount to the delivery agent. It&rsquo;s
              only offered for pin codes where our courier can collect cash.
            </li>
          </ul>
          <Sub>Failed payments</Sub>
          <p>
            If an online payment fails, the order stays <em>Pending</em> and isn&rsquo;t processed. Try again, choose
            another payment method, or contact us.
          </p>
        </>
      ),
    },
    {
      id: "moq",
      title: "Minimum order quantity",
      audience: "Dealers",
      body: (
        <p>
          Each Product on the dealer portal has a minimum order quantity (MOQ), shown on its listing and detail page.
          Orders must be placed in multiples of that MOQ — the portal won&rsquo;t accept a quantity below it or between
          multiples. MOQ doesn&rsquo;t apply to retail orders.
        </p>
      ),
    },
    {
      id: "gst-benefit-scheme",
      title: "GST Benefit Scheme",
      audience: "Dealers",
      body: (
        <>
          <p>
            From time to time we may run a GST Benefit Scheme for Dealer orders that meet a minimum order value. An
            eligible order earns a benefit equal to a percentage of its taxable value (set per scheme), up to a maximum
            where one applies.
          </p>
          <p>
            The benefit can be redeemed for additional Products from the categories the scheme covers. Those items are
            invoiced at the full dealer price, with a matching scheme discount applied.
          </p>
          <p>
            Eligibility, percentage, categories and validity are set for each scheme and may be changed, withdrawn or
            ended at any time without notice. Unused benefit lapses and doesn&rsquo;t carry forward. Cancelling or
            partly cancelling an order that used a scheme may reduce or reverse its benefit — see{" "}
            <a href="#cancellations" className={linkClass}>
              Cancellations
            </a>
            .
          </p>
        </>
      ),
    },
    {
      id: "shipping",
      title: "Shipping & delivery",
      body: (
        <ul>
          <li>We ship through courier partners to serviceable pin codes across India.</li>
          <li>Delivery timelines are estimates, not guarantees.</li>
          <li>Shipping charges, and any free-delivery threshold, are shown at checkout or on your invoice.</li>
          <li>Risk of loss or damage passes to you when the parcel is handed to the carrier.</li>
          <li>
            If a parcel arrives damaged, tell us within the return window — see{" "}
            <a href="#returns" className={linkClass}>
              Returns &amp; refunds
            </a>
            .
          </li>
          <li>
            We aren&rsquo;t liable for delays caused by carriers, natural disasters or other circumstances beyond our
            control.
          </li>
        </ul>
      ),
    },
    {
      id: "cancellations",
      title: "Cancellations",
      body: (
        <>
          <p>
            You can cancel an order online at any point before it&rsquo;s delivered. A cancellation charge applies:{" "}
            <strong>{policy.preShipChargePercent}%</strong> before dispatch and{" "}
            <strong>{policy.postShipChargePercent}%</strong> after dispatch. Your refund is what you paid, minus that
            charge.
          </p>
          <p>
            The {cancellationLink} sets out exactly how the charge works, including for 20% advance orders, and forms
            part of these Terms.
          </p>
          <p>
            Cash on Delivery orders that have already shipped can&rsquo;t be cancelled online — contact us instead. Once
            an order is delivered it can&rsquo;t be cancelled; use a return.
          </p>
        </>
      ),
    },
    {
      id: "returns",
      title: "Returns & refunds",
      body: (
        <>
          <p>
            To start a return, email {email} within <strong>7 days of delivery</strong> with your order number and
            photographs of the item.
          </p>
          <Sub>Dealers</Sub>
          <p>We accept returns of Products that are:</p>
          <ul>
            <li>damaged or defective on arrival (with unboxing evidence); or</li>
            <li>incorrectly shipped — the wrong SKU or part number.</li>
          </ul>
          <p>We don&rsquo;t accept returns of Products that have been installed, modified or aren&rsquo;t in their original packaging.</p>
          <Sub>Retail customers</Sub>
          <p>We accept returns within 7 days of delivery, except for:</p>
          <ul>
            <li>electrical parts once installed or wired in;</li>
            <li>safety-critical parts (brakes, suspension, structural components) once fitted;</li>
            <li>consumables — oils, filters, gaskets, seals — once the packaging has been opened; and</li>
            <li>custom-order or made-to-order Products.</li>
          </ul>
          <Sub>Refunds</Sub>
          <p>Approved refunds go to your original payment source within 5–7 business days.</p>
        </>
      ),
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      body: (
        <>
          <p>You agree not to:</p>
          <ul>
            <li>use the Platform for any unlawful purpose or in breach of these Terms;</li>
            <li>resell Products in a way that damages the MotoXPlus brand (Dealers);</li>
            <li>try to gain unauthorised access to any part of the Platform or our servers;</li>
            <li>scrape, crawl or automate access to Platform data without permission; or</li>
            <li>pretend to be MotoXPlus or one of our people.</li>
          </ul>
        </>
      ),
    },
    {
      id: "intellectual-property",
      title: "Intellectual property",
      body: (
        <p>
          Everything on the Platform — the MotoXPlus name and logo, product images and descriptions, and the site design
          — belongs to {legal.companyName}. You may not copy, distribute or use our brand assets without our written
          consent.
        </p>
      ),
    },
    {
      id: "liability",
      title: "Liability",
      body: (
        <>
          <p>
            To the extent the law allows, we aren&rsquo;t liable for indirect, incidental, special or consequential
            losses — including lost profit or business interruption — arising from your use of the Platform or
            Products. Our total liability for any claim under these Terms is limited to the value of the order it
            relates to.
          </p>
          <p>
            Nothing in these Terms limits any liability, or any right you have as a consumer, that cannot be excluded
            under Indian law, including the Consumer Protection Act, 2019 and the Consumer Protection (E-Commerce)
            Rules, 2020.
          </p>
          <p>
            You agree to cover {legal.companyName}, its directors, employees and agents against claims, damages and
            expenses (including legal fees) that result from your breach of these Terms.
          </p>
        </>
      ),
    },
    {
      id: "governing-law",
      title: "Governing law & disputes",
      body: (
        <>
          <p>
            These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the
            courts of <strong>{legal.jurisdiction}</strong>.
          </p>
          <p>
            We&rsquo;ll first try to settle any dispute amicably. If it isn&rsquo;t resolved within 30 days, either side
            may refer it to arbitration under the Arbitration and Conciliation Act, 1996.
          </p>
        </>
      ),
    },
    {
      id: "grievance-officer",
      title: "Grievance officer",
      body: (
        <>
          <p>
            In line with the Consumer Protection (E-Commerce) Rules, 2020, send complaints about the Platform or your
            orders to our grievance contact:
          </p>
          <address className="not-italic">
            <p className="font-semibold text-store-ink">
              {hasOfficer ? legal.grievanceOfficerName : `${legal.companyName} — Customer Care`}
            </p>
            <p>
              Email:{" "}
              <a href={`mailto:${legal.grievanceOfficerEmail || legal.customerCareEmail}`} className={linkClass}>
                {legal.grievanceOfficerEmail || legal.customerCareEmail}
              </a>
            </p>
            <p>Phone: {legal.grievanceOfficerPhone || legal.customerCarePhone}</p>
            {legal.grievanceResponseTime && <p>Response time: {legal.grievanceResponseTime}</p>}
          </address>
        </>
      ),
    },
    {
      id: "changes",
      title: "Changes to these terms",
      body: (
        <p>
          We may update these Terms from time to time. The new version is posted here with a new &ldquo;Last
          updated&rdquo; date, and by continuing to use the Platform after that you accept it.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Contact us",
      body: (
        <address className="not-italic">
          <p className="font-semibold text-store-ink">{legal.companyName}</p>
          <p>{legal.registeredAddress}</p>
          <p>Email: {email}</p>
          <p>
            Phone:{" "}
            <a href={`tel:${legal.customerCarePhone.replace(/\s/g, "")}`} className={linkClass}>
              {legal.customerCarePhone}
            </a>
          </p>
          <p>GSTIN: {legal.gstin}</p>
        </address>
      ),
    },
  ];

  const facts = [
    { label: "Returns", value: "7 days", note: "from delivery. Some items can’t be returned once fitted or opened." },
    {
      label: "Cancellation charge",
      value: `${policy.preShipChargePercent}% · ${policy.postShipChargePercent}%`,
      note: "before · after dispatch.",
    },
    { label: "Retail prices", value: "Incl. GST", note: "Dealer prices exclude GST." },
    { label: "Refunds", value: "5–7 days", note: "to your original payment source." },
  ];

  return (
    // A plain div — (public)/layout.tsx already renders the page's one <main>.
    <div className="bg-white font-store text-17 tracking-[-0.022em] text-store-ink">
      <header className="pb-[clamp(32px,5vw,56px)] pt-[clamp(48px,7vw,96px)]">
        <Container>
          <p className="text-17 font-semibold text-store-accent">Legal</p>
          <h1 className="mt-2 text-[clamp(36px,6vw,64px)] font-semibold leading-[1.06] tracking-[-0.015em]">
            Terms &amp; Conditions
          </h1>
          <p className="mt-4 max-w-[36ch] text-[clamp(19px,2.2vw,24px)] leading-[1.3] text-store-ink-2">
            The terms for buying from MotoXPlus — as a dealer buying wholesale, or as an individual buying for your own
            bike.
          </p>
          <p className="mt-4 text-14 text-store-ink-2">
            Last updated <time dateTime="2026-11-02">{LAST_UPDATED}</time>
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-store-line pt-6 bp-lg:grid-cols-4 bp-lg:gap-x-8">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-14 text-store-ink-2">{f.label}</dt>
                <dd className="tnum mt-1 text-[clamp(24px,2.6vw,28px)] font-semibold leading-[1.14] whitespace-nowrap">{f.value}</dd>
                <dd className="mt-1 max-w-[30ch] text-14 text-store-ink-2">{f.note}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-14 text-store-ink-2">
            This is a summary. The full terms below are what apply.
          </p>
        </Container>
      </header>

      <div className="border-t border-store-line-soft py-[clamp(32px,5vw,72px)]">
        <Container className="grid gap-8 bp-lg:grid-cols-[240px_minmax(0,700px)] bp-lg:gap-16">
          <LegalToc items={sections.map(({ id, title }) => ({ id, title }))} />

          <div>
            {sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                aria-labelledby={`${s.id}-heading`}
                className="scroll-mt-24 border-t border-store-line-soft py-10 first:border-t-0 first:pt-0 last:pb-0"
              >
                <h2
                  id={`${s.id}-heading`}
                  className="flex gap-3 text-[clamp(24px,3vw,32px)] font-semibold leading-[1.125] tracking-[-0.01em]"
                >
                  <span className="tnum text-store-ink-3">{i + 1}</span>
                  <span>{s.title}</span>
                </h2>
                {s.audience && <p className="mt-2 text-14 font-semibold text-store-accent">For {s.audience.toLowerCase()}</p>}
                <div className="mt-5 space-y-4 leading-[1.6] text-store-gray-700 [&_a]:underline-offset-2 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-store-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </Container>
      </div>
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="!mt-7 text-17 font-semibold text-store-ink">{children}</h3>;
}
