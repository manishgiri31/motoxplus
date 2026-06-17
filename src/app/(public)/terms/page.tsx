import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions | MotoXPlus India Pvt. Ltd.",
  description: "Terms and conditions governing use of the MotoXPlus India dealer portal and website.",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[var(--bg-primary)] pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs uppercase tracking-widest mb-4">
              <Link href="/" className="hover:text-red-500 transition-colors">Home</Link>
              <span>/</span>
              <span>Terms &amp; Conditions</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight mb-4">
              Terms &amp; Conditions
            </h1>
            <p className="text-[var(--text-muted)] text-sm">
              Last updated: <span className="text-[var(--text-secondary)]">June 1, 2025</span>
            </p>
          </div>

          {/* Intro */}
          <div className="glass border border-red-900/30 bg-red-900/5 rounded-sm p-5 mb-10">
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              Please read these Terms &amp; Conditions carefully before using the MotoXPlus India dealer portal or
              website. By registering as a dealer or placing an order, you agree to be bound by these terms. If you
              do not agree, do not use our services.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-10 text-[var(--text-secondary)] leading-relaxed">

            <Section title="1. Definitions">
              <ul>
                <li><strong className="text-[var(--text-primary)]">&ldquo;Company&rdquo;</strong> means MotoXPlus India Private Limited (GSTIN: 07AAUCM5765B1Z4), registered at RZ-43/291, Nashirpur, New Delhi – 110045.</li>
                <li><strong className="text-[var(--text-primary)]">&ldquo;Dealer&rdquo;</strong> means a registered business entity approved by the Company to purchase products through the dealer portal.</li>
                <li><strong className="text-[var(--text-primary)]">&ldquo;Platform&rdquo;</strong> means the website motoxplus.in and all associated web applications.</li>
                <li><strong className="text-[var(--text-primary)]">&ldquo;Products&rdquo;</strong> means automotive spare parts listed on the Platform.</li>
                <li><strong className="text-[var(--text-primary)]">&ldquo;Order&rdquo;</strong> means a confirmed purchase submitted by a Dealer through the Platform.</li>
              </ul>
            </Section>

            <Section title="2. Dealer Registration &amp; Eligibility">
              <p>To become an authorised dealer you must:</p>
              <ul>
                <li>Be a legally incorporated business entity in India with a valid GSTIN</li>
                <li>Provide accurate company details, owner information, and contact data during registration</li>
                <li>Receive written approval from the Company before accessing the dealer portal</li>
              </ul>
              <p className="mt-3">
                The Company reserves the right to approve, reject, or suspend any dealer account at its sole
                discretion. False or misleading information provided during registration is grounds for immediate
                account termination.
              </p>
            </Section>

            <Section title="3. Account Security">
              <p>
                You are responsible for maintaining the confidentiality of your dealer account credentials.
                All activities performed under your account are your responsibility. Notify us immediately at{" "}
                <a href="mailto:info@motoxplus.in" className="text-red-500 hover:underline">info@motoxplus.in</a>{" "}
                if you suspect unauthorised access. The Company will not be liable for losses resulting from
                unauthorised account use.
              </p>
            </Section>

            <Section title="4. Orders &amp; Acceptance">
              <p>
                Placing an order through the Platform constitutes an offer to purchase. An order is accepted
                and a binding contract is formed only when:
              </p>
              <ul>
                <li>For <strong className="text-[var(--text-primary)]">online payments (Full / 20% Advance)</strong>: when payment is successfully verified and the order status changes to <em>Confirmed</em>.</li>
                <li>For <strong className="text-[var(--text-primary)]">Cash on Delivery (COD)</strong>: when the order is submitted and immediately auto-confirmed by the system.</li>
              </ul>
              <p className="mt-3">
                The Company reserves the right to cancel any order before dispatch due to stock unavailability,
                pricing errors, or suspected fraud. In such cases, prepaid amounts will be fully refunded.
              </p>
            </Section>

            <Section title="5. Pricing &amp; Taxes">
              <ul>
                <li>All prices displayed on the Platform are exclusive of GST unless stated otherwise.</li>
                <li>GST is charged at the applicable rate for each product category and is displayed at checkout.</li>
                <li>Prices are subject to change without notice; the price applicable at time of order confirmation prevails.</li>
                <li>The Company issues GST-compliant tax invoices for all confirmed orders.</li>
              </ul>
            </Section>

            <Section title="6. Payment Terms">
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-[var(--text-primary)] mb-1">6.1 Full Payment (100%)</p>
                  <p>The full invoice amount is due at the time of order placement via Razorpay.</p>
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)] mb-1">6.2 20% Advance Payment</p>
                  <p>
                    A minimum 20% advance is due at order placement. The remaining 80% balance must be paid
                    before goods are dispatched. Orders will not be shipped until the full balance is settled.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)] mb-1">6.3 Cash on Delivery (COD)</p>
                  <p>
                    For COD orders, the full invoice amount is payable in cash to the delivery agent at the
                    time of delivery. COD availability is subject to your delivery location and order value.
                    The Company reserves the right to withdraw COD as a payment option for any dealer.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)] mb-1">6.4 Failed Payments</p>
                  <p>
                    If an online payment fails, the order remains in <em>Pending</em> status and is not
                    processed. Contact support to retry or choose an alternate payment method.
                  </p>
                </div>
              </div>
            </Section>

            <Section title="7. Shipping &amp; Delivery">
              <ul>
                <li>Estimated delivery timelines are indicative and not guaranteed.</li>
                <li>The Company ships to all serviceable pin codes across India.</li>
                <li>Shipping charges, if any, will be communicated at checkout or invoice stage.</li>
                <li>Risk of loss or damage passes to the Dealer upon handover to the carrier.</li>
                <li>The Company is not liable for delays caused by carrier failures, natural disasters, or circumstances beyond its control (force majeure).</li>
              </ul>
            </Section>

            <Section title="8. Returns &amp; Refunds">
              <p>
                Returns are accepted within <strong className="text-[var(--text-primary)]">7 days</strong> of
                delivery for products that are:
              </p>
              <ul>
                <li>Damaged or defective on arrival (with unboxing evidence)</li>
                <li>Incorrectly shipped (wrong SKU or part number)</li>
              </ul>
              <p className="mt-3">
                Returns are <strong className="text-[var(--text-primary)]">not accepted</strong> for products
                that have been installed, modified, or are not in original packaging. To initiate a return,
                email <a href="mailto:info@motoxplus.in" className="text-red-500 hover:underline">info@motoxplus.in</a>{" "}
                within the return window with your order number and photographic evidence.
              </p>
              <p className="mt-3">
                Approved refunds for prepaid orders will be processed to the original payment source within
                5–7 business days.
              </p>
            </Section>

            <Section title="9. Intellectual Property">
              <p>
                All content on the Platform — including the MotoXPlus brand, logo, product images, descriptions,
                and website design — is the exclusive intellectual property of MotoXPlus India Private Limited.
                Dealers may not reproduce, distribute, or use our brand assets without prior written consent.
              </p>
            </Section>

            <Section title="10. Prohibited Conduct">
              <p>You agree not to:</p>
              <ul>
                <li>Use the Platform for any unlawful purpose or in violation of these Terms</li>
                <li>Resell products to end consumers at prices that damage the MotoXPlus brand reputation</li>
                <li>Attempt to gain unauthorised access to any part of the Platform or its servers</li>
                <li>Scrape, crawl, or automate access to Platform data without permission</li>
                <li>Impersonate MotoXPlus or its employees to third parties</li>
              </ul>
            </Section>

            <Section title="11. Limitation of Liability">
              <p>
                To the maximum extent permitted by applicable law, the Company shall not be liable for any
                indirect, incidental, special, or consequential damages, including lost profits or business
                interruption, arising from use of the Platform or products.
              </p>
              <p className="mt-3">
                The Company&apos;s total liability for any claim arising under these Terms shall not exceed the value
                of the specific order to which the claim relates.
              </p>
            </Section>

            <Section title="12. Indemnification">
              <p>
                You agree to indemnify and hold harmless MotoXPlus India Private Limited, its directors,
                employees, and agents from any claims, damages, or expenses (including legal fees) arising
                from your breach of these Terms or your use of the Platform.
              </p>
            </Section>

            <Section title="13. Governing Law &amp; Dispute Resolution">
              <p>
                These Terms are governed by and construed in accordance with the laws of India. Any disputes
                arising from or relating to these Terms shall be subject to the exclusive jurisdiction of the
                courts of <strong className="text-[var(--text-primary)]">New Delhi, India</strong>.
              </p>
              <p className="mt-3">
                The parties shall first attempt to resolve disputes amicably. If unresolved within 30 days,
                disputes may be referred to arbitration under the Arbitration and Conciliation Act, 1996.
              </p>
            </Section>

            <Section title="14. Amendments">
              <p>
                The Company may revise these Terms at any time. The revised Terms will be posted on this page
                with an updated &ldquo;Last updated&rdquo; date. Your continued use of the Platform following any changes
                constitutes your acceptance of the new Terms.
              </p>
            </Section>

            <Section title="15. Contact">
              <div className="glass border border-[var(--border-color)] rounded-sm p-5 mt-4">
                <p className="text-[var(--text-primary)] font-bold mb-1">MotoXPlus India Private Limited</p>
                <p className="text-[var(--text-muted)] text-sm">RZ-43/291, Nashirpur, New Delhi – 110045</p>
                <p className="text-[var(--text-muted)] text-sm">
                  Email:{" "}
                  <a href="mailto:info@motoxplus.in" className="text-red-500 hover:underline">info@motoxplus.in</a>
                </p>
                <p className="text-[var(--text-muted)] text-sm">Phone: +91 92171 31801</p>
              </div>
            </Section>
          </div>

          {/* Back link */}
          <div className="mt-14 pt-8 border-t border-[var(--border-color)]">
            <Link href="/" className="text-red-500 hover:text-red-400 text-sm font-semibold transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4 flex items-center gap-3">
        <span className="w-1 h-5 bg-red-600 rounded-full block flex-shrink-0" />
        {title}
      </h2>
      <div className="space-y-3 pl-4 border-l border-[var(--border-color)]">{children}</div>
    </section>
  );
}
