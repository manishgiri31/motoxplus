import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Invalid file type. Only JPG, PNG, WEBP allowed." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is 5 MB (got ${(file.size / 1024 / 1024).toFixed(1)} MB).` },
      { status: 400 }
    );
  }

  const uniqueId = crypto.randomUUID();
  const key = `products/${uniqueId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const url = await uploadToR2(buffer, key, file.type);
    return NextResponse.json({ url, key });
  } catch (err) {
    console.error("R2 upload error:", err);
    return NextResponse.json({ error: "Upload to storage failed" }, { status: 500 });
  }
}
