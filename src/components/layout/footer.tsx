import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Globe } from "lucide-react";

const socialLinks = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/people/Moto-X-Plus-Pvt-Ltd/61583505116513/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/motoxplusin/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    href: "https://youtube.com/@motoxplus",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29.94 29.94 0 001 12a29.94 29.94 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29.94 29.94 0 0023 12a29.94 29.94 0 00-.46-5.58z" />
        <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white" />
      </svg>
    ),
  },
  {
    name: "LinkedIn",
    href: "https://linkedin.com/company/motoxplus-india",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    name: "WhatsApp",
    href: "https://wa.me/919217131801",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.556 4.116 1.528 5.843L.057 23.428a.5.5 0 00.611.628l5.703-1.494A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.655-.52-5.17-1.426l-.367-.218-3.807.998 1.014-3.706-.24-.382A9.95 9.95 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </svg>
    ),
  },
];

export function Footer() {
  return (
    <footer className="bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">

          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-5 group">
              <Image
                src="/motoxplus/logo.png"
                alt="MOTOXPLUS India Private Limited"
                width={400}
                height={300}
                className="h-12 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
              />
              <div>
                <span className="text-[var(--text-primary)] font-black text-lg tracking-wide leading-none">
                  MOTOX<span className="text-red-500">PLUS</span>
                </span>
                <div className="text-[9px] text-[var(--text-muted)] tracking-widest leading-none mt-0.5">
                  India Private Limited
                </div>
              </div>
            </Link>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-6">
              Premium automotive spare parts manufacturer. Engineered for reliability,
              built for every journey.
            </p>

            {/* Social links */}
            <div className="flex gap-3 flex-wrap">
              {socialLinks.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="w-8 h-8 rounded-sm glass border border-[var(--border-color)] hover:border-red-600/50 hover:text-red-500 flex items-center justify-center text-[var(--text-muted)] transition-all duration-200"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-[var(--text-primary)] font-semibold text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-4 h-px bg-red-600" />
              Quick Links
            </h4>
            <ul className="space-y-3">
              {[
                { label: "Home", href: "/" },
                { label: "Products", href: "/products" },
                { label: "About Us", href: "/about" },
                { label: "Become a Dealer", href: "/become-dealer" },
                { label: "Contact", href: "/contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[var(--text-muted)] hover:text-red-500 text-sm transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-[var(--text-primary)] font-semibold text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-4 h-px bg-red-600" />
              Products
            </h4>
            <ul className="space-y-3">
              {[
                { label: "Brake Parts", slug: "brake-parts" },
                { label: "Engine Parts", slug: "engine-parts" },
                { label: "Suspension Parts", slug: "suspension-parts" },
                { label: "Electrical Parts", slug: "electrical-parts" },
                { label: "Transmission Parts", slug: "transmission-parts" },
                { label: "Body Parts", slug: "body-parts" },
              ].map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/products?category=${item.slug}`}
                    className="text-[var(--text-muted)] hover:text-red-500 text-sm transition-colors duration-200"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[var(--text-primary)] font-semibold text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-4 h-px bg-red-600" />
              Contact
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-[var(--text-muted)] text-sm leading-relaxed">
                  {process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "New Delhi, India"}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={15} className="text-red-500 flex-shrink-0" />
                <a
                  href={`tel:${process.env.NEXT_PUBLIC_COMPANY_PHONE}`}
                  className="text-[var(--text-muted)] hover:text-red-500 text-sm transition-colors"
                >
                  {process.env.NEXT_PUBLIC_COMPANY_PHONE || "+91 92171 31801"}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={15} className="text-red-500 flex-shrink-0" />
                <a
                  href={`mailto:${process.env.NEXT_PUBLIC_COMPANY_EMAIL}`}
                  className="text-[var(--text-muted)] hover:text-red-500 text-sm transition-colors"
                >
                  {process.env.NEXT_PUBLIC_COMPANY_EMAIL || "info@motoxplus.in"}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Globe size={15} className="text-red-500 flex-shrink-0" />
                <a
                  href="https://www.motoxplus.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-muted)] hover:text-red-500 text-sm transition-colors"
                >
                  www.motoxplus.in
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-8 border-t border-[var(--border-color)] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[var(--text-muted)] text-xs">
            © {new Date().getFullYear()} MOTOXPLUS India Private Limited. All rights reserved.
          </p>

          <div className="flex gap-5">
            <Link href="/privacy" className="text-[var(--text-muted)] hover:text-red-500 text-xs transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-[var(--text-muted)] hover:text-red-500 text-xs transition-colors">
              Terms of Service
            </Link>
            <Link href="/sitemap" className="text-[var(--text-muted)] hover:text-red-500 text-xs transition-colors">
              Sitemap
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-[#FF671F] rounded-sm" />
            <div className="w-3.5 h-3.5 bg-white border border-gray-200 rounded-sm" />
            <div className="w-3.5 h-3.5 bg-[#046A38] rounded-sm" />
            <span className="text-[var(--text-muted)] text-xs ml-1">Made in India</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
