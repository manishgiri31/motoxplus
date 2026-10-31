import type { Metadata } from "next";

// Always the production domain — must never leak localhost URLs into
// metadata, canonical tags, or structured data, regardless of local env.
export const SITE_URL = "https://motoxplus.com";
export const SITE_NAME = "MOTOXPLUS India Private Limited";
export const SITE_NAME_SHORT = "MotoXPlus";
export const SITE_DESCRIPTION =
  "MOTOXPLUS India Private Limited — premium OEM-compatible two-wheeler spare parts manufacturer. Mudguards, visors, brake parts, indicators and more, engineered for reliability and tested to the highest standards.";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const DEFAULT_PRODUCT_IMAGE = "/motoxplus/logo.png";

/**
 * Image URLs for Product structured data. Google requires at least one valid,
 * absolute `image`, so empty/blank entries are dropped, relative paths are made
 * absolute, and the brand logo is used when a product has no photo yet.
 */
export function productJsonLdImages(...sources: Array<ReadonlyArray<string | null | undefined> | null | undefined>): string[] {
  const urls = sources
    .flatMap((s) => s ?? [])
    .map((u) => u?.trim())
    .filter((u): u is string => !!u)
    .map((u) => (/^https?:\/\//i.test(u) ? u : absoluteUrl(u)));
  return urls.length > 0 ? Array.from(new Set(urls)) : [absoluteUrl(DEFAULT_PRODUCT_IMAGE)];
}

/** Truncates at a word boundary and appends "…" — never cuts mid-word like a blind `.slice()`. */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLen * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
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
