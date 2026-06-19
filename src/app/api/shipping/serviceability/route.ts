import { NextRequest, NextResponse } from "next/server";
import { checkServiceability } from "@/lib/delhivery";

export async function GET(req: NextRequest) {
  const pincode = req.nextUrl.searchParams.get("pincode");

  if (!pincode) {
    return NextResponse.json({ error: "pincode is required" }, { status: 400 });
  }

  const result = await checkServiceability(pincode);
  return NextResponse.json(result);
}
