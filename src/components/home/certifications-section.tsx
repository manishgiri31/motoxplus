import { ShieldCheck, BadgeCheck, Factory, FileCheck2 } from "lucide-react";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";

const certifications = [
  {
    Icon: ShieldCheck,
    title: "ISO 9001:2015",
    description: "Certified quality management system across our manufacturing facility.",
  },
  {
    Icon: BadgeCheck,
    title: "OEM Compatible",
    description: "Every part engineered and verified against original equipment specifications.",
  },
  {
    Icon: FileCheck2,
    title: "GST Registered",
    description: "Fully compliant invoicing and tax documentation for every order.",
  },
  {
    Icon: Factory,
    title: "Made in India",
    description: "Manufactured domestically, supporting local supply chains and jobs.",
  },
];

export function CertificationsSection() {
  return (
    <section className="py-20 px-4 md:px-8 bg-[var(--bg-secondary)] border-y border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto">
        <RevealGroup className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border-color)] rounded-2xl overflow-hidden">
          {certifications.map((cert) => (
            <RevealItem key={cert.title}>
            <div className="group bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] p-8 flex flex-col items-center text-center gap-3 transition-colors duration-300 h-full">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500/15 transition-colors">
                <cert.Icon size={22} className="text-red-500" />
              </div>
              <h3 className="text-[var(--text-primary)] font-bold text-sm">{cert.title}</h3>
              <p className="text-[var(--text-muted)] text-xs leading-relaxed max-w-[200px]">
                {cert.description}
              </p>
            </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
