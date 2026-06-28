import { NextRequest, NextResponse } from "next/server";
import { processDelhiveryWebhook } from "@/lib/delhivery";
import type { DelhiveryWebhookPayload } from "@/lib/delhivery/types";

const WEBHOOK_SECRET = process.env.DELHIVERY_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  // Fail closed: if secret is not configured in production, reject all webhook calls
  if (!WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Delhivery Webhook] DELHIVERY_WEBHOOK_SECRET is not set — rejecting request");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    // Allow in development without a secret
    console.warn("[Delhivery Webhook] Secret not set — skipping verification (dev only)");
  } else if (token !== WEBHOOK_SECRET) {
    console.warn("[Delhivery Webhook] Invalid token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: DelhiveryWebhookPayload;
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      // Delhivery sometimes sends form-encoded
      const text = await req.text();
      const form = new URLSearchParams(text);
      payload = Object.fromEntries(form.entries()) as DelhiveryWebhookPayload;
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await processDelhiveryWebhook(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Delhivery Webhook] Processing error:", err);
    // Always return 200 to prevent Delhivery from retrying indefinitely
    return NextResponse.json({ ok: false, error: "Processing failed" });
  }
}

// Delhivery may send GET to verify the endpoint
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!WEBHOOK_SECRET || token !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, service: "MotoXPlus Delhivery Webhook" });
}
