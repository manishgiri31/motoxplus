import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CANCELLATION_POLICY_ID, getCancellationPolicy } from "@/lib/orders/cancellation-policy";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Public GET — percentages aren't sensitive, and the checkout page and the
// public /cancellation-policy page both need them to stay in sync with
// whatever the admin last configured, same as GET /api/admin/settings/upi.
export async function GET() {
  const policy = await getCancellationPolicy();
  return NextResponse.json(policy);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const preShip = Number(body.preShipChargePercent);
  const postShip = Number(body.postShipChargePercent);

  if (!Number.isFinite(preShip) || preShip < 0 || preShip > 100) {
    return NextResponse.json({ error: "Pre-ship charge % must be between 0 and 100" }, { status: 400 });
  }
  if (!Number.isFinite(postShip) || postShip < 0 || postShip > 100) {
    return NextResponse.json({ error: "Post-ship charge % must be between 0 and 100" }, { status: 400 });
  }

  const updated = await prisma.cancellationPolicy.upsert({
    where: { id: CANCELLATION_POLICY_ID },
    update: { preShipChargePercent: preShip, postShipChargePercent: postShip, updatedById: session.user.id },
    create: {
      id: CANCELLATION_POLICY_ID,
      preShipChargePercent: preShip,
      postShipChargePercent: postShip,
      updatedById: session.user.id,
    },
  });

  return NextResponse.json(updated);
}
