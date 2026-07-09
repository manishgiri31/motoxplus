import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";

// Metadata (OG/Twitter images, canonical, metadataBase) must always resolve to the
// production domain, even when NEXT_PUBLIC_APP_URL is set to localhost for local dev.
const APP_URL = "https://motoxplus.com";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  preload: true,
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
