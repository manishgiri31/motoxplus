import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  uploadFile,
  folders,
  newUUID,
  extFromMime,
  logStorageAction,
} from "@/lib/storage";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DEALER") {
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

  const uuid = newUUID();
  const ext = extFromMime(file.type);
  const key = folders.paymentScreenshot(orderId, uuid, ext);
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await uploadFile(buffer, key, file.type, false);

    await logStorageAction({
      userId: session.user.id,
      action: "UPLOAD",
      fileKey: key,
      fileUrl: result.url,
      metadata: { orderId, fileName: file.name, fileSize: file.size, mimeType: file.type, purpose: "payment_screenshot" },
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
