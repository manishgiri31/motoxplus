import { randomUUID } from "crypto";

// All folder path builders live here.
// Returns the R2 object key (path within bucket).

export const folders = {
  /** Product image variants */
  productImage(productId: string | undefined, uuid: string, variant: "orig" | "med" | "thumb"): string {
    const base = productId ? `products/${productId}` : "products";
    const suffix = variant === "orig" ? "" : `_${variant}`;
    return `${base}/${uuid}${suffix}.webp`;
  },

  /** Private dealer documents */
  dealerDocument(dealerId: string, type: string, uuid: string, ext: string): string {
    return `dealers/${dealerId}/${type}_${uuid}.${ext}`;
  },

  /** Company-owned assets (logo, certs, marketing) */
  companyAsset(subfolder: string, uuid: string, ext: string): string {
    return `company/${subfolder}/${uuid}.${ext}`;
  },

  /** Invoice PDFs */
  invoice(year: number, invoiceNumber: string): string {
    return `invoices/${year}/${invoiceNumber}.pdf`;
  },

  /** Product catalog PDFs (downloadable by dealers) */
  catalog(uuid: string, originalName: string): string {
    const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `catalogs/${uuid}_${safe}`;
  },

  /** Temporary uploads (cleaned up daily) */
  temp(uuid: string, ext: string): string {
    return `temp/${uuid}.${ext}`;
  },
};

export function newUUID(): string {
  return randomUUID();
}

export function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  return map[mime] ?? "bin";
}
