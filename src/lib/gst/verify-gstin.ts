import type { GstinVerificationStatus } from "@prisma/client";

/**
 * Live GST-registry check for a dealer GSTIN. The verification logic lives in
 * the Java API (backend-java gst/GstinVerificationService, which owns the
 * provider credentials); this is only the server-to-server client the Node
 * registration routes use until they are ported to Java.
 *
 * Never throws. If the Java API or the provider can't give a definite answer
 * the result is PENDING: the GSTIN is saved unverified and Java's
 * GstinRecheckJob retries it. A PENDING GSTIN is never printed on an invoice.
 */
export interface GstinCheck {
  gstin: string;
  status: GstinVerificationStatus;
  legalName: string | null;
  tradeName: string | null;
  registrationStatus: string | null;
  principalAddress: string | null;
}

const STATUSES: ReadonlySet<string> = new Set(["VERIFIED", "INVALID", "INACTIVE", "PENDING"]);

function javaApiBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.JAVA_API_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
}

function pending(gstin: string): GstinCheck {
  return { gstin, status: "PENDING", legalName: null, tradeName: null, registrationStatus: null, principalAddress: null };
}

function textOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function verifyGstin(gstin: string, fetchImpl: typeof fetch = fetch): Promise<GstinCheck> {
  const token = process.env.INTERNAL_API_TOKEN?.trim();
  if (!token) {
    console.warn("[GSTIN] INTERNAL_API_TOKEN not set; GSTIN saved unverified (PENDING)");
    return pending(gstin);
  }
  try {
    const res = await fetchImpl(`${javaApiBaseUrl()}/api/internal/gstin/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Token": token },
      body: JSON.stringify({ gstin }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[GSTIN] verification service HTTP ${res.status}; GSTIN saved unverified (PENDING)`);
      return pending(gstin);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const status = typeof data.status === "string" && STATUSES.has(data.status) ? (data.status as GstinVerificationStatus) : "PENDING";
    return {
      gstin,
      status,
      legalName: textOrNull(data.legalName),
      tradeName: textOrNull(data.tradeName),
      registrationStatus: textOrNull(data.registrationStatus),
      principalAddress: textOrNull(data.principalAddress),
    };
  } catch (err) {
    console.warn("[GSTIN] verification service unreachable; GSTIN saved unverified (PENDING):", (err as Error).name);
    return pending(gstin);
  }
}
