import type { Metadata } from "next";
import { ContactSection } from "@/components/home/contact-section";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with MotoXPlus India for dealer enquiries, product information, and partnerships.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero */}
      <section className="py-20 px-4 md:px-8 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-950/15 rounded-full blur-[80px]" />
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">Contact</span>
            <div className="w-8 h-px bg-red-600" />
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-[var(--text-primary)] tracking-tight">
            We&apos;d Love to <span className="text-gradient-red">Hear</span> From You.
          </h1>
        </div>
      </section>
      <ContactSection />
    </div>
  );
}
