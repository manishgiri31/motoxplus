import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
const uploadFile = vi.fn();
const generateSignedUrl = vi.fn();
const deleteFile = vi.fn();

vi.mock("./r2", () => ({
  getR2Client: () => ({ send }),
  getR2Bucket: () => "public-bucket",
  getR2PrivateBucket: () => process.env.R2_PRIVATE_BUCKET_NAME || null,
}));
vi.mock("./upload", () => ({ uploadFile: (...a: unknown[]) => uploadFile(...a) }));
vi.mock("./signed", () => ({ generateSignedUrl: (...a: unknown[]) => generateSignedUrl(...a) }));
vi.mock("./delete", () => ({ deleteFile: (...a: unknown[]) => deleteFile(...a) }));

const { uploadPrivateDocument, bucketForStoredFile, signStoredFile, deleteStoredFile, PRIVATE_URL_PREFIX } = await import("./private");

const buf = Buffer.from("%PDF-1.4");

describe("private document storage", () => {
  beforeEach(() => {
    send.mockReset().mockResolvedValue({});
    uploadFile.mockReset().mockResolvedValue({ key: "k", url: "https://pub.r2.dev/k", size: buf.length });
    generateSignedUrl.mockReset().mockResolvedValue("https://signed");
    deleteFile.mockReset().mockResolvedValue(undefined);
    delete process.env.R2_PRIVATE_BUCKET_NAME;
  });

  it("uploads to the private bucket and stores a marker, never a public URL", async () => {
    process.env.R2_PRIVATE_BUCKET_NAME = "kyc";
    const r = await uploadPrivateDocument(buf, "dealers/d1/pan.pdf", "application/pdf");
    expect(r).toEqual({ key: "dealers/d1/pan.pdf", storedUrl: `${PRIVATE_URL_PREFIX}dealers/d1/pan.pdf`, size: buf.length, isPrivate: true });
    const put = send.mock.calls[0][0].input;
    expect(put).toMatchObject({ Bucket: "kyc", Key: "dealers/d1/pan.pdf", CacheControl: "private, no-store" });
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("falls back to the legacy public upload when the private bucket is not configured", async () => {
    const r = await uploadPrivateDocument(buf, "k", "application/pdf");
    expect(r.isPrivate).toBe(false);
    expect(r.storedUrl).toBe("https://pub.r2.dev/k");
    expect(send).not.toHaveBeenCalled();
  });

  it("routes signing and deletion by where the file actually is", async () => {
    process.env.R2_PRIVATE_BUCKET_NAME = "kyc";
    expect(bucketForStoredFile(`${PRIVATE_URL_PREFIX}k`)).toBe("kyc");
    expect(bucketForStoredFile("https://pub.r2.dev/k")).toBe("public-bucket");

    await signStoredFile("k", `${PRIVATE_URL_PREFIX}k`, 300);
    expect(generateSignedUrl).toHaveBeenCalledWith("k", 300, "kyc");
    await deleteStoredFile("old", "https://pub.r2.dev/old");
    expect(deleteFile).toHaveBeenCalledWith("old", "public-bucket");
  });

  it("refuses to guess when a private file exists but the bucket is not configured", () => {
    expect(() => bucketForStoredFile(`${PRIVATE_URL_PREFIX}k`)).toThrow(/R2_PRIVATE_BUCKET_NAME/);
  });
});
