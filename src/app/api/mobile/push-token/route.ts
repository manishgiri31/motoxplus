import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser, getClientIP } from "@/lib/auth/middleware";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { rejectOversizedBody } from "@/lib/auth/rate-limit-budgets";

// Expo push tokens look like `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`.
const bodySchema = z.object({
  token: z.string().min(1).max(255).regex(/^ExponentPushToken\[.+\]$/, "Not an Expo push token"),
  platform: z.enum(["IOS", "ANDROID"]),
});

const deleteSchema = z.object({ token: z.string().min(1).max(255) });

/** Resolves the DEALER record for the current Bearer token, or null. */
async function currentDealerId(req: NextRequest): Promise<string | null> {
  const payload = await getAuthUser(req);
  if (!payload) return null;
  const dealer = await prisma.dealer.findUnique({ where: { userId: payload.userId }, select: { id: true } });
  return dealer?.id ?? null;
}

// POST /api/mobile/push-token — register (or refresh) the calling device's
// Expo push token for the current dealer. Called by the app right after login.
export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, 4 * 1024);
  if (oversized) return oversized;

  if (!(await checkIPRateLimit(getClientIP(req), 30, 60))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const dealerId = await currentDealerId(req);
  if (!dealerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid Expo push token and platform are required" }, { status: 400 });
  }
  const { token, platform } = parsed.data;

  // Unique on token: the same physical device re-registering (token unchanged)
  // updates its row; a device previously signed in as another dealer is
  // reassigned to whoever is signed in now.
  await prisma.deviceToken.upsert({
    where: { token },
    create: { dealerId, token, platform },
    update: { dealerId, platform },
  });

  return NextResponse.json({ success: true });
}

// DELETE /api/mobile/push-token — drop this device's token. Called on logout
// so a signed-out device stops receiving this dealer's order notifications.
export async function DELETE(req: NextRequest) {
  const oversized = rejectOversizedBody(req, 4 * 1024);
  if (oversized) return oversized;

  if (!(await checkIPRateLimit(getClientIP(req), 30, 60))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const dealerId = await currentDealerId(req);
  if (!dealerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A token is required" }, { status: 400 });
  }

  // Scoped to the current dealer — a token can only be removed by the dealer
  // it is currently registered to.
  await prisma.deviceToken.deleteMany({ where: { token: parsed.data.token, dealerId } });

  return NextResponse.json({ success: true });
}
