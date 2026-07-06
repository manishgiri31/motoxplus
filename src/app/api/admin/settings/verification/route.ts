import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getVerificationConfig, setVerificationConfig } from "@/lib/settings/verification";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getVerificationConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only Super Admin can change verification requirements" }, { status: 401 });
  }

  const body = await req.json();
  const update: { gstRequired?: boolean; panRequired?: boolean; gstRequiredCategories?: string[] } = {};

  if (typeof body.gstRequired === "boolean") update.gstRequired = body.gstRequired;
  if (typeof body.panRequired === "boolean") update.panRequired = body.panRequired;
  if (Array.isArray(body.gstRequiredCategories)) update.gstRequiredCategories = body.gstRequiredCategories.map(String);

  await setVerificationConfig(update);

  const config = await getVerificationConfig();
  return NextResponse.json({ message: "Verification settings updated.", ...config });
}
