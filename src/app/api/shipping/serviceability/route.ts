import { NextRequest, NextResponse } from "next/server";
import { checkServiceability } from "@/lib/delhivery";
import { enforceRateLimit } from "@/lib/auth/rate-limit-budgets";

export async function GET(req: NextRequest) {
  // Each uncached hit becomes a Delhivery API call, so this is the public route where an
  // unthrottled client costs the most.
  const limited = await enforceRateLimit(req, "PUBLIC_API");
  if (limited) return limited;

  const pincode = req.nextUrl.searchParams.get("pincode");

  if (!pincode) {
    return NextResponse.json({ error: "pincode is required" }, { status: 400 });
  }

  const result = await checkServiceability(pincode);
  return NextResponse.json(result);
}
