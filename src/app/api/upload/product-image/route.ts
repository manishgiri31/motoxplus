import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  uploadProductImage,
  folders,
  newUUID,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE,
  logStorageAction,
} from "@/lib/storage";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const productId = (formData.get("productId") as string | null) || undefined;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!IMAGE_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Accepted: JPG, PNG, WEBP" },
      { status: 400 }
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.` },
      { status: 400 }
    );
  }

  const uuid = newUUID();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { original, medium, thumbnail } = await uploadProductImage(buffer, {
      orig: folders.productImage(productId, uuid, "orig"),
      med: folders.productImage(productId, uuid, "med"),
      thumb: folders.productImage(productId, uuid, "thumb"),
    });

    await logStorageAction({
      userId: session.user.id,
      action: "UPLOAD",
      fileKey: original.key,
      fileUrl: original.url,
      metadata: { productId, fileName: file.name, fileSize: file.size, mimeType: file.type },
    });

    return NextResponse.json({
      url: original.url,
      mediumUrl: medium.url,
      thumbnailUrl: thumbnail.url,
      key: original.key,
      fileName: file.name,
      fileSize: original.size,
      mimeType: "image/webp",
    });
  } catch (err: any) {
    console.error("[upload/product-image]", err?.message ?? err);

    if (err?.message?.includes("Missing or placeholder")) {
      return NextResponse.json(
        { error: "Storage not configured. Set R2 credentials in .env and restart the server." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Upload failed. Check server logs." },
      { status: 500 }
    );
  }
}
