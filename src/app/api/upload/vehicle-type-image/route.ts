import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { VehicleCategory } from "@prisma/client";
import {
  uploadProductImage,
  folders,
  newUUID,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE,
  logStorageAction,
  detectImageMimeType,
} from "@/lib/storage";

/** Category-card hero images for the /vehicles landing page (Motorcycles, Scooters, Electric, Commercial). */
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const category = (formData.get("category") as string | null)?.toUpperCase();

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!category || !(category in VehicleCategory)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
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

  if (!(await detectImageMimeType(buffer))) {
    return NextResponse.json(
      { error: "File content is not a valid JPG, PNG, or WEBP image." },
      { status: 400 }
    );
  }

  try {
    const { original, medium, thumbnail } = await uploadProductImage(buffer, {
      orig: folders.vehicleTypeImage(category, uuid, "orig"),
      med: folders.vehicleTypeImage(category, uuid, "med"),
      thumb: folders.vehicleTypeImage(category, uuid, "thumb"),
    });

    await logStorageAction({
      userId: session.user.id,
      action: "UPLOAD",
      fileKey: original.key,
      fileUrl: original.url,
      metadata: { category, fileName: file.name, fileSize: file.size, mimeType: file.type },
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("Missing or placeholder")) {
      return NextResponse.json(
        { error: "Storage not configured. Set R2 credentials in .env and restart the server." },
        { status: 503 }
      );
    }

    console.error("[upload/vehicle-type-image]", msg);
    return NextResponse.json(
      { error: "Upload failed. Check server logs." },
      { status: 500 }
    );
  }
}
