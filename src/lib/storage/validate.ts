/**
 * Content-based upload validation. `file.type` on a multipart FormData entry
 * is whatever Content-Type the client declared — trivially spoofable — so it
 * must never be the only gate on what gets stored and served back out.
 */

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");

/** True if the buffer actually starts with the PDF magic number. */
export function looksLikePdf(buffer: Buffer): boolean {
  return buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}

const SHARP_FORMAT_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Decodes the buffer with sharp and returns the real image MIME type it
 * detected from the pixel data, or null if it can't be parsed as one of the
 * accepted image formats at all. Returns null (rather than throwing) both
 * when sharp itself is unavailable and when the content isn't a real image —
 * callers treat both as "reject the upload".
 */
export async function detectImageMimeType(buffer: Buffer): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(buffer).metadata();
    if (!metadata.format) return null;
    return SHARP_FORMAT_TO_MIME[metadata.format] ?? null;
  } catch {
    return null;
  }
}
