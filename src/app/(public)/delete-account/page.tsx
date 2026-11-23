import Link from "next/link";

// Public, no-login page that Google Play's Data safety form links to as the
// "delete account URL". Play requires it to name the app/developer, list the
// steps to request deletion, and say what is deleted or kept. Keep the
// "What gets deleted" section in sync with DELETE /api/dealer/account.
export const metadata = {
  title: "Delete Your Account | MotoXPlus",
  description:
    "How to delete your MotoXPlus dealer account from the MotoXPlus app or website, and what data is deleted.",
};

const EMAIL = "info@motoxplus.com";

export default function DeleteAccountPage() {
  return (
    // A plain div, not <main> — (public)/layout.tsx already renders the page's <main>.
    <div className="min-h-screen bg-[var(--paper)] pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        <div className="mb-12">
          <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-4">
            <Link href="/" className="hover:text-red-500 transition-colors">Home</Link>
            <span>/</span>
            <span>Delete account</span>
          </div>
          <h1 className="text-[clamp(36px,5.5vw,56px)] leading-[1.08] font-black text-[var(--ink)] tracking-tight mb-4">
            Delete your MotoXPlus account
          </h1>
          <p className="text-[var(--muted)]">
            This page explains how to delete your account in the <strong className="text-[var(--ink)]">MotoXPlus</strong>{" "}
            app (Android) and on motoxplus.com, both run by MotoXPlus India Private Limited.
          </p>
        </div>

        <div className="space-y-10 text-[var(--muted)] leading-relaxed">
          <Section title="Option 1: In the MotoXPlus app">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the MotoXPlus app and sign in.</li>
              <li>Go to the <strong className="text-[var(--ink)]">Account</strong> tab and tap <strong className="text-[var(--ink)]">Settings</strong>.</li>
              <li>Tap <strong className="text-[var(--ink)]">Delete account</strong>, then <strong className="text-[var(--ink)]">Continue</strong>.</li>
              <li>Enter your password to confirm. Your account is deleted straight away and you are signed out.</li>
            </ol>
          </Section>

          <Section title="Option 2: On the website">
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Sign in at <Link href="/login" className="text-red-500 hover:underline">motoxplus.com/login</Link>.
              </li>
              <li>Open <strong className="text-[var(--ink)]">Profile</strong> from the dealer menu.</li>
              <li>Under <strong className="text-[var(--ink)]">Danger Zone</strong>, click <strong className="text-[var(--ink)]">Delete My Account</strong>.</li>
              <li>Type DELETE and your password to confirm.</li>
            </ol>
          </Section>

          <Section title="Option 3: If you can't sign in">
            <p>
              Email{" "}
              <a href={`mailto:${EMAIL}?subject=Account%20deletion%20request`} className="text-red-500 hover:underline">
                {EMAIL}
              </a>{" "}
              from the email address registered on your account, with the subject &ldquo;Account deletion
              request&rdquo;. Include your company name and registered mobile number. We may contact you to confirm
              the request is yours, and we will delete the account within 7 days of confirming it.
            </p>
          </Section>

          <Section title="What gets deleted">
            <p>When your account is deleted, the following is permanently removed:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your login details and dealer profile (name, email, mobile number, address)</li>
              <li>Business details: company name, GSTIN, PAN and Aadhaar numbers</li>
              <li>Verification documents you uploaded</li>
              <li>Your cart, orders, invoices and payment records held by MotoXPlus</li>
              <li>Notification tokens for your devices</li>
            </ul>
            <p>
              Account records are deleted immediately. Uploaded document files and backup copies are removed within
              30 days. Deletion cannot be undone, so download any invoices you need before deleting your account.
            </p>
            <p>
              Payments are processed by Razorpay, which keeps its own transaction records as required by Indian
              law. Those records are governed by Razorpay&rsquo;s privacy policy.
            </p>
          </Section>

          <Section title="Questions">
            <p>
              Contact us at{" "}
              <a href={`mailto:${EMAIL}`} className="text-red-500 hover:underline">{EMAIL}</a>. See also our{" "}
              <Link href="/privacy" className="text-red-500 hover:underline">Privacy Policy</Link>.
            </p>
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
        <span className="w-1 h-5 bg-[var(--accent)] rounded-full block flex-shrink-0" />
        {title}
      </h2>
      <div className="space-y-3 pl-4 border-l border-[var(--line)]">{children}</div>
    </section>
  );
}
