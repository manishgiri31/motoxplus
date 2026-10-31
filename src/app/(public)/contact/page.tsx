import type { Metadata } from "next";
import { ContactSection } from "@/components/home/contact-section";
import { Eyebrow } from "@/components/ui/technical";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with MotoXPlus India for dealer enquiries, product information, and partnerships.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      {/* Hero */}
      <section className="py-16 md:py-20 px-4 md:px-8 text-center">
        <Eyebrow className="justify-center mb-5">Contact</Eyebrow>
        <h1 className="font-display text-[clamp(36px,5.5vw,56px)] leading-[1.08] font-bold text-[var(--ink)] tracking-tight">
          We&apos;d love to hear from you.
        </h1>
      </section>
      <ContactSection />
    </div>
  );
}
