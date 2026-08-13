import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { JsonLd } from "@/components/seo/json-ld";

// Metadata (OG/Twitter images, canonical, metadataBase) must always resolve to the
// production domain, even when NEXT_PUBLIC_APP_URL is set to localhost for local dev.
const APP_URL = "https://motoxplus.com";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
});

// v2 design system — headings / body / technical-label (SKU, HSN, order ID) fonts.
// Self-hosted (latin subset, extracted from Google Fonts) so `next build` never
// depends on reaching fonts.gstatic.com — see SchibstedGroteskVF.woff2 etc.
const schibstedGrotesk = localFont({
  src: "./fonts/SchibstedGroteskVF.woff2",
  weight: "500 800",
  variable: "--font-display",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/InterVF.woff2",
  weight: "400 600",
  variable: "--font-body",
  display: "swap",
});

const ibmPlexMono = localFont({
  src: [
    {
      path: "./fonts/IBMPlexMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/IBMPlexMono-Medium.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Single value, not a prefers-color-scheme media list: next-themes is configured
  // with enableSystem={false} and defaultTheme="light" (src/components/providers.tsx),
  // so the app's actual chrome color never follows the OS theme — a media-query list
  // here previously gave OS-dark users dark mobile browser chrome around a light site.
  themeColor: "#F4F4F6",
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "MOTOXPLUS India | Premium Two-Wheeler Spare Parts Manufacturer",
    template: "%s | MOTOXPLUS India",
  },
  description:
    "MOTOXPLUS India Private Limited — Engineered For Reliability. Premium two-wheeler spare parts manufacturer. OEM-compatible mudguards, visors, panels & accessories. Quality tested, made in India.",
  keywords: [
    "MOTOXPLUS",
    "automotive spare parts",
    "two-wheeler parts",
    "motorcycle parts",
    "mudguard manufacturer",
    "visor manufacturer",
    "spare parts manufacturer India",
    "OEM compatible parts",
    "bike parts India",
    "motorcycle accessories",
  ],
  authors: [{ name: "MOTOXPLUS India Private Limited", url: APP_URL }],
  creator: "MOTOXPLUS India Private Limited",
  publisher: "MOTOXPLUS India Private Limited",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: APP_URL,
    title: "MOTOXPLUS India | Premium Two-Wheeler Spare Parts Manufacturer",
    description: "Engineered for reliability. Built for every journey. Premium OEM-compatible two-wheeler spare parts manufactured in India.",
    siteName: "MOTOXPLUS India",
    images: [
      {
        url: "/motoxplus/logo.png",
        width: 1536,
        height: 1024,
        alt: "MOTOXPLUS India — Premium Automotive Parts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MOTOXPLUS India | Premium Two-Wheeler Spare Parts",
    description: "Engineered for reliability. Premium OEM-compatible two-wheeler spare parts manufactured in India.",
    images: ["/motoxplus/logo.png"],
  },
  alternates: {
    canonical: APP_URL,
  },
  verification: {
    // Add Google Search Console verification token here when available
    // google: "your_google_verification_token",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${schibstedGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable} antialiased`}
      >
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": `${APP_URL}#organization`,
            name: "MOTOXPLUS India Private Limited",
            url: APP_URL,
            logo: `${APP_URL}/motoxplus/logo.png`,
            description:
              "Premium OEM-compatible two-wheeler spare parts manufacturer based in India.",
            address: {
              "@type": "PostalAddress",
              streetAddress: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "New Delhi, India",
              addressCountry: "IN",
            },
            contactPoint: {
              "@type": "ContactPoint",
              telephone: process.env.NEXT_PUBLIC_COMPANY_PHONE || "",
              email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "",
              contactType: "sales",
              areaServed: "IN",
            },
            sameAs: [
              "https://www.facebook.com/people/Moto-X-Plus-Pvt-Ltd/61583505116513/",
              "https://www.instagram.com/motoxplusin/",
              "https://youtube.com/@motoxplus",
              "https://www.linkedin.com/company/motoxplus/",
            ],
          }}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": `${APP_URL}#website`,
            name: "MOTOXPLUS India",
            url: APP_URL,
            publisher: { "@id": `${APP_URL}#organization` },
            potentialAction: {
              "@type": "SearchAction",
              target: `${APP_URL}/products?search={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
