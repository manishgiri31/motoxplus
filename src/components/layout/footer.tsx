import Link from "next/link";

const socialLinks = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/people/Moto-X-Plus-Pvt-Ltd/61583505116513/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/motoxplusin/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
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
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29.94 29.94 0 001 12a29.94 29.94 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29.94 29.94 0 0023 12a29.94 29.94 0 00-.46-5.58z" />
        <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white" />
      </svg>
    ),
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/motoxplus/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    name: "WhatsApp",
    href: "https://wa.me/918816812379",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.556 4.116 1.528 5.843L.057 23.428a.5.5 0 00.611.628l5.703-1.494A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.655-.52-5.17-1.426l-.367-.218-3.807.998 1.014-3.706-.24-.382A9.95 9.95 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </svg>
    ),
  },
];

const columns = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/products" },
      { label: "Body parts", href: "/products?category=body-parts" },
      { label: "Brake parts", href: "/products?category=brake-parts" },
      { label: "Electrical parts", href: "/products?category=electrical-parts" },
      { label: "Shop by vehicle", href: "/vehicles" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Partners",
    links: [
      { label: "Become a dealer", href: "/become-dealer" },
      { label: "Become a vendor", href: "/become-vendor" },
      { label: "Dealer login", href: "/login" },
    ],
  },
  {
    title: "Policies",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Cancellation policy", href: "/cancellation-policy" },
    ],
  },
];

const link = "text-store-gray-700 hover:underline focus-visible:outline-store-accent";

export function Footer() {
  const phone = process.env.NEXT_PUBLIC_COMPANY_PHONE || "+91 88168 12379";
  const email = process.env.NEXT_PUBLIC_COMPANY_EMAIL || "info@motoxplus.com";
  return (
    <footer className="bg-store-bg-alt pb-10 pt-5 font-store text-12 text-store-ink-2">
      <div className="mx-auto w-[calc(100%-32px)] max-w-page bp-md:w-[min(100%-48px,1260px)]">
        <p className="border-b border-store-line pb-4">
          Spare parts and accessories for two-wheelers, manufactured in India.{" "}
          <Link href="/products" className="text-store-link hover:underline focus-visible:outline-store-accent">
            Browse the catalogue &rsaquo;
          </Link>
        </p>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 py-8 bp-tab:grid-cols-5">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-2 text-12 font-semibold tracking-[-0.01em] text-store-ink">{col.title}</h2>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={link}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="col-span-2 bp-tab:col-span-1">
            <h2 className="mb-2 text-12 font-semibold tracking-[-0.01em] text-store-ink">Contact</h2>
            <address className="space-y-2 not-italic">
              <p>{process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "New Delhi, India"}</p>
              <p>
                <a href={`tel:${phone.replace(/\s/g, "")}`} className={link}>
                  {phone}
                </a>
              </p>
              <p>
                <a href={`mailto:${email}`} className={link}>
                  {email}
                </a>
              </p>
            </address>
            <ul className="mt-4 flex flex-wrap gap-1">
              {socialLinks.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.name}
                    className="grid h-11 w-11 place-items-center text-store-ink-2 transition-colors duration-base ease-apple hover:text-store-ink focus-visible:outline-store-accent"
                  >
                    {s.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-store-line pt-4 bp-md:flex-row bp-md:items-center bp-md:justify-between">
          <p>&copy; {new Date().getFullYear()} MOTOXPLUS India Private Limited. All rights reserved.</p>
          {/* /sitemap has no page; only src/app/sitemap.ts, which serves /sitemap.xml */}
          <p>
            <a href="/sitemap.xml" className={link}>
              Sitemap
            </a>
            <span aria-hidden className="mx-2 text-store-line">|</span>
            Made in India
          </p>
        </div>
      </div>
    </footer>
  );
}
