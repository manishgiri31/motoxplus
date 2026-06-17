import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  uploadFile,
  folders,
  newUUID,
  extFromMime,
  MAX_CATALOG_SIZE,
  logStorageAction,
} from "@/lib/storage";

const ALLOWED_SUBFOLDERS = new Set(["logos", "certificates", "catalogs", "marketing", "factory"]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const subfolder = (formData.get("subfolder") as string | null) ?? "marketing";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_SUBFOLDERS.has(subfolder)) {
    return NextResponse.json(
      { error: `Invalid subfolder. Must be one of: ${Array.from(ALLOWED_SUBFOLDERS).join(", ")}` },
      { status: 400 }
    );
  }

  if (file.size > MAX_CATALOG_SIZE) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Maximum is 50 MB.` },
      { status: 400 }
    );
  }

  const uuid = newUUID();
  const ext = extFromMime(file.type) || file.name.split(".").pop() || "bin";
  const key = folders.companyAsset(subfolder, uuid, ext);
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { url } = await uploadFile(buffer, key, file.type, false);

    await logStorageAction({
      userId: session.user.id,
      action: "UPLOAD",
      fileKey: key,
      fileUrl: url,
      metadata: { subfolder, fileName: file.name, fileSize: file.size },
    });

    return NextResponse.json({ url, key, subfolder, fileName: file.name });
  } catch (err: any) {
    console.error("[upload/company-asset]", err?.message ?? err);

    if (err?.message?.includes("Missing or placeholder")) {
      return NextResponse.json(
        { error: "Storage not configured. Set R2 credentials in .env." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
