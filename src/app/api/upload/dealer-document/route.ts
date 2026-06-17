import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  uploadFile,
  folders,
  newUUID,
  extFromMime,
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE,
  logStorageAction,
} from "@/lib/storage";
import { DealerDocumentType } from "@prisma/client";

const VALID_TYPES = new Set(Object.values(DealerDocumentType));

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealer = await prisma.dealer.findUnique({ where: { userId: session.user.id } });
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

  const documentType = rawType as DealerDocumentType;
  const uuid = newUUID();
  const ext = extFromMime(file.type);
  const key = folders.dealerDocument(dealer.id, documentType.toLowerCase(), uuid, ext);
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { url } = await uploadFile(buffer, key, file.type, true);

    // Upsert — one document per type per dealer
    const doc = await prisma.dealerDocument.upsert({
      where: { dealerId_documentType: { dealerId: dealer.id, documentType } },
      update: { fileUrl: url, fileName: file.name, fileSize: file.size, mimeType: file.type, key, uploadedAt: new Date() },
      create: { dealerId: dealer.id, documentType, fileUrl: url, fileName: file.name, fileSize: file.size, mimeType: file.type, key },
    });

    await logStorageAction({
      userId: session.user.id,
      action: "UPLOAD",
      fileKey: key,
      fileUrl: url,
      metadata: { dealerId: dealer.id, documentType, fileName: file.name },
    });

    return NextResponse.json({ id: doc.id, url, key, documentType });
  } catch (err: any) {
    console.error("[upload/dealer-document]", err?.message ?? err);

    if (err?.message?.includes("Missing or placeholder")) {
      return NextResponse.json(
        { error: "Storage not configured. Set R2 credentials in .env." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
