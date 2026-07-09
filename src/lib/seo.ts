import type { Metadata } from "next";

// Always the production domain — must never leak localhost URLs into
// metadata, canonical tags, or structured data, regardless of local env.
export const SITE_URL = "https://motoxplus.com";
export const SITE_NAME = "MOTOXPLUS India Private Limited";
export const SITE_DESCRIPTION =
  "MOTOXPLUS India Private Limited — premium OEM-compatible two-wheeler spare parts manufacturer. Mudguards, visors, brake parts, indicators and more, engineered for reliability and tested to the highest standards.";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

interface BuildMetadataOptions {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}

export function buildMetadata({ title, description, path, image, noIndex }: BuildMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const ogImage = image ? absoluteUrl(image) : absoluteUrl("/motoxplus/logo.png");

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 512, height: 512, alt: title }],
      locale: "en_IN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
