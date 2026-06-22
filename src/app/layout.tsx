import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "MOTOXPLUS India Private Limited | Premium Automotive Parts",
    template: "%s | MOTOXPLUS India",
  },
  description:
    "MOTOXPLUS India Private Limited — Engineered For Reliability. Premium two-wheeler spare parts manufacturer. OEM-compatible, quality tested.",
  keywords: [
    "MOTOXPLUS",
    "automotive parts",
    "two-wheeler parts",
    "motorcycle parts",
    "spare parts manufacturer",
    "OEM compatible",
    "India",
  ],
  authors: [{ name: "MOTOXPLUS India Private Limited" }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: "MotoXPlus India | Premium Automotive Parts Manufacturer",
    description: "Engineered for reliability. Built for every journey.",
    siteName: "MotoXPlus India",
    images: [{ url: "/motoxplus/logo.png", width: 512, height: 512, alt: "MotoXPlus India" }],
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
