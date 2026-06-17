import { prisma } from "@/lib/prisma";

export type AuditAction = "UPLOAD" | "DELETE" | "DOWNLOAD" | "SIGN" | "GENERATE";

export async function logStorageAction(params: {
  userId?: string;
  action: AuditAction;
  fileKey: string;
  fileUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.storageAuditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        fileKey: params.fileKey,
        fileUrl: params.fileUrl,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });
  } catch {
    // Audit logging is non-critical — never let it break the main flow
  }
}
