import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  uploadFile,
  folders,
  newUUID,
  extFromMime,
  logStorageAction,
  detectImageMimeType,
} from "@/lib/storage";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const orderId = (formData.get("orderId") as string | null) || "unknown";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, WEBP images are accepted." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum 5 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // `file.type` above is client-declared and trivially spoofable — confirm
  // the bytes actually decode as one of the accepted image formats, and
  // derive the stored extension/content-type from that instead of trusting
  // the client further.
  const detectedType = await detectImageMimeType(buffer);
  if (!detectedType) {
    return NextResponse.json({ error: "Only JPG, PNG, WEBP images are accepted." }, { status: 400 });
  }

  const uuid = newUUID();
  const ext = extFromMime(detectedType);
  const key = folders.paymentScreenshot(orderId, uuid, ext);

  try {
    const result = await uploadFile(buffer, key, detectedType, false);

    await logStorageAction({
      userId,
      action: "UPLOAD",
      fileKey: key,
      fileUrl: result.url,
      metadata: { orderId, fileName: file.name, fileSize: file.size, mimeType: detectedType, purpose: "payment_screenshot" },
    });

    return NextResponse.json({ url: result.url, key });
  } catch (err: any) {
    console.error("[upload/payment-screenshot]", err?.message ?? err);
    if (err?.message?.includes("Missing or placeholder")) {
      return NextResponse.json({ error: "Storage not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
