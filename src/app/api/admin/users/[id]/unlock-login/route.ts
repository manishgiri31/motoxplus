import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resetRateLimit } from "@/lib/auth/rate-limit";

// Manual escape hatch for a false-positive (or legitimately expired-but-
// stuck) lockout: clears both the DB-backed account lock
// (failedLoginAttempts/accountLockedUntil, which auto-expires after 30min
// anyway) and the Redis/in-memory LOGIN + OTP_SEND + OTP_VERIFY counters
// keyed to this user's email/mobile (the abuse-rate-limit layer, which
// otherwise only clears itself when its window elapses). Only the
// per-identifier buckets are cleared — per-IP buckets aren't, since a given
// user's IP isn't tracked on the account and clearing "the" IP bucket isn't
// well-defined when a dealer signs in from more than one place; those expire
// on their own (15min for LOGIN, 60s-15min for OTP) regardless.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, mobileNumber: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { failedLoginAttempts: 0, accountLockedUntil: null },
  });

  const identifiers = [user.email?.trim().toLowerCase(), user.mobileNumber].filter((v): v is string => !!v);
  await Promise.all(
    identifiers.flatMap((value) => [
      resetRateLimit(`rl:LOGIN:id:${value}`),
      resetRateLimit(`rl:OTP_SEND:id:${value}`),
      resetRateLimit(`rl:OTP_SEND:id-daily:${value}`),
      resetRateLimit(`rl:OTP_VERIFY:id:${value}`),
    ])
  );

  return NextResponse.json({ message: "Login lockout and rate-limit counters cleared" });
}
