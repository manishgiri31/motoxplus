import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | MotoXPlus India Pvt. Ltd.",
  description: "Privacy policy for MotoXPlus India — how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
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
              <span>Privacy Policy</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight mb-4">
              Privacy Policy
            </h1>
            <p className="text-[var(--text-muted)] text-sm">
              Last updated: <span className="text-[var(--text-secondary)]">June 1, 2025</span>
            </p>
          </div>

          {/* Content */}
          <div className="prose-motoxplus space-y-10 text-[var(--text-secondary)] leading-relaxed">
            <section>
              <p>
                MotoXPlus India Private Limited (&ldquo;MotoXPlus&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
                &ldquo;our&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect,
                use, disclose, and safeguard your information when you visit our website{" "}
                <strong className="text-[var(--text-primary)]">motoxplus.in</strong> or use our dealer portal.
                Please read this policy carefully. If you disagree with its terms, please discontinue use of our
                platform.
              </p>
            </section>

            <Section title="1. Information We Collect">
              <p>We may collect the following categories of information:</p>
              <SubSection title="Personal Identification Information">
                <ul>
                  <li>Full name, email address, phone number</li>
                  <li>Company name, GST number, business address, city, state, and pincode</li>
                  <li>Login credentials (password stored in hashed form only)</li>
                </ul>
              </SubSection>
              <SubSection title="Transaction Information">
                <ul>
                  <li>Order details, invoice data, payment amounts</li>
                  <li>Razorpay transaction IDs and payment status (we do not store card or bank account numbers)</li>
                </ul>
              </SubSection>
              <SubSection title="Usage Data">
                <ul>
                  <li>IP address, browser type, pages visited, and timestamps</li>
                  <li>Device and operating system information</li>
                </ul>
              </SubSection>
            </Section>

            <Section title="2. How We Use Your Information">
              <p>We use the information we collect to:</p>
              <ul>
                <li>Process and fulfil dealer orders and generate invoices</li>
                <li>Manage dealer accounts and communicate order updates</li>
                <li>Process payments via Razorpay (a PCI-DSS compliant gateway)</li>
                <li>Verify GST registration and business identity during dealer onboarding</li>
                <li>Send transactional emails (order confirmations, invoices, shipping updates)</li>
                <li>Improve our website, products, and services</li>
                <li>Comply with applicable Indian laws and regulations</li>
              </ul>
            </Section>

            <Section title="3. Legal Basis for Processing">
              <p>
                Under applicable Indian data protection law and principles, we process your personal data on the
                following bases:
              </p>
              <ul>
                <li><strong className="text-[var(--text-primary)]">Contract performance</strong> — processing necessary to fulfil orders placed through the dealer portal</li>
                <li><strong className="text-[var(--text-primary)]">Legitimate interest</strong> — fraud prevention, platform security, and business analytics</li>
                <li><strong className="text-[var(--text-primary)]">Legal obligation</strong> — GST compliance, tax record keeping under the Income Tax Act and GST Act</li>
                <li><strong className="text-[var(--text-primary)]">Consent</strong> — where you have explicitly opted in to marketing communications</li>
              </ul>
            </Section>

            <Section title="4. Sharing of Information">
              <p>We do not sell, rent, or trade your personal information. We may share your data with:</p>
              <ul>
                <li><strong className="text-[var(--text-primary)]">Razorpay Financial Solutions Pvt. Ltd.</strong> — for payment processing</li>
                <li><strong className="text-[var(--text-primary)]">Cloudflare Inc.</strong> — for secure media storage (product images)</li>
                <li><strong className="text-[var(--text-primary)]">Logistics partners</strong> — name, phone, and delivery address for order shipment</li>
                <li><strong className="text-[var(--text-primary)]">Government / regulatory authorities</strong> — when required by law (e.g., GST filings, court orders)</li>
              </ul>
              <p>All third-party partners are contractually obligated to protect your data.</p>
            </Section>

            <Section title="5. Data Retention">
              <p>
                We retain your personal data for as long as your dealer account is active and for a period of{" "}
                <strong className="text-[var(--text-primary)]">seven (7) years</strong> thereafter to comply with
                Indian tax and accounting laws. Order and invoice data is retained for the same period. You may
                request deletion of non-statutory data by contacting us.
              </p>
            </Section>

            <Section title="6. Cookies and Tracking">
              <p>
                Our website uses cookies and similar technologies to maintain your session, remember your theme
                preference, and analyse site traffic. You can disable cookies in your browser settings; however,
                certain features (such as the dealer portal login) require cookies to function.
              </p>
              <p className="mt-2">We use the following types of cookies:</p>
              <ul>
                <li><strong className="text-[var(--text-primary)]">Session cookies</strong> — required for authentication; deleted when you close your browser</li>
                <li><strong className="text-[var(--text-primary)]">Preference cookies</strong> — store your dark/light mode setting (key: <code className="text-red-400">motoxplus-theme</code>)</li>
                <li><strong className="text-[var(--text-primary)]">Analytics cookies</strong> — anonymous usage statistics to improve the platform</li>
              </ul>
            </Section>

            <Section title="7. Security">
              <p>
                We implement industry-standard security measures including HTTPS/TLS encryption, bcrypt password
                hashing, HTTP-only session cookies, and role-based access controls. Payment processing is handled
                entirely by Razorpay and we never receive or store raw card or bank account data.
              </p>
              <p className="mt-2">
                Despite these measures, no internet transmission is 100% secure. If you suspect a security
                breach affecting your account, notify us immediately at{" "}
                <a href="mailto:info@motoxplus.in" className="text-red-500 hover:underline">info@motoxplus.in</a>.
              </p>
            </Section>

            <Section title="8. Your Rights">
              <p>Subject to applicable law, you have the right to:</p>
              <ul>
                <li>Access a copy of personal data we hold about you</li>
                <li>Correct inaccurate or incomplete personal data</li>
                <li>Request deletion of your personal data (subject to legal retention requirements)</li>
                <li>Withdraw consent for marketing communications at any time</li>
                <li>Lodge a complaint with the relevant data protection authority</li>
              </ul>
              <p className="mt-2">
                To exercise these rights, email us at{" "}
                <a href="mailto:info@motoxplus.in" className="text-red-500 hover:underline">info@motoxplus.in</a>{" "}
                with the subject line &ldquo;Data Rights Request&rdquo;. We will respond within 30 days.
              </p>
            </Section>

            <Section title="9. Children's Privacy">
              <p>
                Our platform is intended for use by registered businesses (B2B) and is not directed at individuals
                under the age of 18. We do not knowingly collect personal data from minors.
              </p>
            </Section>

            <Section title="10. Third-Party Links">
              <p>
                Our website may contain links to third-party websites (e.g., WhatsApp, LinkedIn). We are not
                responsible for the privacy practices of those sites and encourage you to review their respective
                privacy policies.
              </p>
            </Section>

            <Section title="11. Changes to This Policy">
              <p>
                We may update this Privacy Policy periodically. The &ldquo;Last updated&rdquo; date at the top of this page
                will reflect any changes. Continued use of our platform after changes constitutes acceptance of the
                updated policy. For material changes, we will notify registered dealers via email.
              </p>
            </Section>

            <Section title="12. Contact Us">
              <p>If you have questions about this Privacy Policy, please contact:</p>
              <div className="glass border border-[var(--border-color)] rounded-sm p-5 mt-4 not-prose">
                <p className="text-[var(--text-primary)] font-bold mb-1">MotoXPlus India Private Limited</p>
                <p className="text-[var(--text-muted)] text-sm">RZ-43/291, Nashirpur, New Delhi – 110045</p>
                <p className="text-[var(--text-muted)] text-sm">
                  Email:{" "}
                  <a href="mailto:info@motoxplus.in" className="text-red-500 hover:underline">info@motoxplus.in</a>
                </p>
                <p className="text-[var(--text-muted)] text-sm">Phone: +91 92171 31801</p>
                <p className="text-[var(--text-muted)] text-sm">GSTIN: 07AAUCM5765B1Z4</p>
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

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <div className="pl-4 space-y-1 text-sm">{children}</div>
    </div>
  );
}
