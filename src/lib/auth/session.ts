import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./jwt";
import crypto from "crypto";

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

interface CreateSessionOptions {
  userId: string;
  email: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

export async function createSession(opts: CreateSessionOptions) {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const sessionId = crypto.randomUUID();

  const refreshToken = await signRefreshToken({ userId: opts.userId, sessionId });

  await prisma.userSession.create({
    data: {
      id: sessionId,
      userId: opts.userId,
      refreshToken,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
      deviceInfo: opts.deviceInfo,
      expiresAt,
    },
  });

  const accessToken = await signAccessToken({
    userId: opts.userId,
    email: opts.email,
    role: opts.role,
    sessionId,
  });

  await prisma.user.update({
    where: { id: opts.userId },
    data: { lastLogin: new Date() },
  });

  return { accessToken, refreshToken };
}

export async function rotateSession(refreshToken: string, ipAddress?: string) {
  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) return null;

  const session = await prisma.userSession.findUnique({
    where: { refreshToken },
    include: { user: true },
  });

  if (!session || !session.isActive || session.expiresAt < new Date()) return null;

  const user = session.user;

  // Issue new tokens
  const newRefreshToken = await signRefreshToken({ userId: user.id, sessionId: session.id });
  const newAccessToken = await signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    sessionId: session.id,
  });

  await prisma.userSession.update({
    where: { id: session.id },
    data: { refreshToken: newRefreshToken, lastUsedAt: new Date(), ipAddress },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function revokeSession(sessionId: string) {
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { isActive: false },
  }).catch(() => null);
}

export async function revokeAllSessions(userId: string) {
  await prisma.userSession.updateMany({
    where: { userId },
    data: { isActive: false },
  });
}

export async function getUserSessions(userId: string) {
  return prisma.userSession.findMany({
    where: { userId, isActive: true, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      deviceInfo: true,
      ipAddress: true,
      userAgent: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });
}
