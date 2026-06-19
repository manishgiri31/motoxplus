import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateShippingRate } from "@/lib/delhivery";

const ORIGIN_PINCODE = process.env.DELHIVERY_ORIGIN_PINCODE || "110046";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { destinationPincode, weightKg, paymentMode, codAmount } = body;

  if (!destinationPincode || !weightKg) {
    return NextResponse.json(
      { error: "destinationPincode and weightKg are required" },
      { status: 400 }
    );
  }

  const result = await calculateShippingRate({
    originPincode: ORIGIN_PINCODE,
    destinationPincode,
    weightKg: Number(weightKg),
    paymentMode: paymentMode || "Prepaid",
    codAmount: codAmount ? Number(codAmount) : undefined,
  });

  return NextResponse.json(result);
}
