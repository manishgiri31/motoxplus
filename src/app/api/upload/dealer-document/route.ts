import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  uploadFile,
  folders,
  newUUID,
  extFromMime,
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE,
  logStorageAction,
  looksLikePdf,
  detectImageMimeType,
} from "@/lib/storage";
import { DealerDocumentType } from "@prisma/client";

const VALID_TYPES = new Set(Object.values(DealerDocumentType));

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealer = await prisma.dealer.findUnique({ where: { userId } });
  if (!dealer) return NextResponse.json({ error: "Dealer not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const rawType = (formData.get("documentType") as string | null)?.toUpperCase();

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!rawType || !VALID_TYPES.has(rawType as DealerDocumentType)) {
    return NextResponse.json(
      { error: `Invalid documentType. Must be one of: ${Array.from(VALID_TYPES).join(", ")}` },
      { status: 400 }
    );
  }

  if (!DOCUMENT_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Accepted: PDF, JPG, PNG" },
      { status: 400 }
    );
  }

  if (file.size > MAX_DOCUMENT_SIZE) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // `file.type` above is client-declared and trivially spoofable — the
  // DOCUMENT_MIME_TYPES check is only a fast prefilter. The type actually
  // used for storage/content-type is derived from the bytes themselves.
  const detectedType = looksLikePdf(buffer) ? "application/pdf" : await detectImageMimeType(buffer);
  if (!detectedType || !DOCUMENT_MIME_TYPES.has(detectedType)) {
    return NextResponse.json(
      { error: "Invalid file type. Accepted: PDF, JPG, PNG" },
      { status: 400 }
    );
  }

  const documentType = rawType as DealerDocumentType;
  const uuid = newUUID();
  const ext = extFromMime(detectedType);
  const key = folders.dealerDocument(dealer.id, documentType.toLowerCase(), uuid, ext);

  try {
    const { url } = await uploadFile(buffer, key, detectedType, true);

    // Upsert — one document per type per dealer
    const doc = await prisma.dealerDocument.upsert({
      where: { dealerId_documentType: { dealerId: dealer.id, documentType } },
      update: { fileUrl: url, fileName: file.name, fileSize: file.size, mimeType: detectedType, key, uploadedAt: new Date() },
      create: { dealerId: dealer.id, documentType, fileUrl: url, fileName: file.name, fileSize: file.size, mimeType: detectedType, key },
    });

    await logStorageAction({
      userId,
      action: "UPLOAD",
      fileKey: key,
      fileUrl: url,
      metadata: { dealerId: dealer.id, documentType, fileName: file.name },
    });

    // These are KYC documents (Aadhaar/PAN/GST). The client never needs the
    // direct object URL — the UI only reads `id` and fetches a short-lived
    // link from /api/files/signed/[id] when actually viewing a document — so
    // it's deliberately withheld here rather than handed out on every upload.
    return NextResponse.json({ id: doc.id, key, documentType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("Missing or placeholder")) {
      return NextResponse.json(
        { error: "Storage not configured. Set R2 credentials in .env." },
        { status: 503 }
      );
    }

    console.error("[upload/dealer-document]", msg);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
