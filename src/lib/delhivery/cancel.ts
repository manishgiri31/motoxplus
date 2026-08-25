import { delhiveryConfig } from "./config";
import type { DelhiveryCancelResponse } from "./types";

/**
 * Tag-by-tag scan of a FLAT, single-level XML document (no nesting, no
 * attributes, no CDATA) — e.g. Delhivery's cancel response:
 * `<root><status>True</status><waybill>...</waybill></root>`. This is not a
 * general-purpose XML parser; it walks the string looking for open/close tag
 * pairs rather than regex- or substring-matching a specific field, so
 * malformed/unexpected XML produces missing keys rather than a false match.
 */
function parseFlatXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  let pos = 0;

  while (pos < xml.length) {
    const openStart = xml.indexOf("<", pos);
    if (openStart === -1) break;
    const openEnd = xml.indexOf(">", openStart);
    if (openEnd === -1) break;

    const tagName = xml.slice(openStart + 1, openEnd);

    // Skip the XML declaration (<?xml ...?>) and stray closing tags.
    if (tagName.startsWith("?") || tagName.startsWith("/")) {
      pos = openEnd + 1;
      continue;
    }

    const closeTag = `</${tagName}>`;
    const closeStart = xml.indexOf(closeTag, openEnd + 1);
    if (closeStart === -1) {
      pos = openEnd + 1;
      continue;
    }

    const innerContent = xml.slice(openEnd + 1, closeStart);

    if (innerContent.includes("<")) {
      // Not a leaf (e.g. <root> wrapping <status>/<waybill>/...) — descend
      // into it by only skipping past this opening tag, not the whole
      // element, so the next iteration finds its children.
      pos = openEnd + 1;
      continue;
    }

    result[tagName] = decodeXmlEntities(innerContent.trim());
    pos = closeStart + closeTag.length;
  }

  return result;
}

function decodeXmlEntities(text: string): string {
  // &amp; must decode last, or "&amp;lt;" would incorrectly become "<".
  return text
    .split("&lt;").join("<")
    .split("&gt;").join(">")
    .split("&quot;").join('"')
    .split("&apos;").join("'")
    .split("&amp;").join("&");
}

export interface CancelResult {
  /** The API accepted the cancel request. See the doc comment below —
   * this is NOT "this shipment was newly cancelled by this call." */
  accepted: boolean;
  waybill: string;
  remark: string;
}

/**
 * ⚠️ POST /api/p/edit's response is XML, NOT JSON — confirmed via live
 * capture (delhivery-reference.md, "5. Cancel" / "7. Cancel again",
 * 2026-08-24):
 *   <?xml version="1.0" encoding="utf-8"?>
 *   <root><status>True</status><waybill>...</waybill><order_id>...</order_id>
 *   <remark>Shipment has been cancelled.</remark></root>
 * Every OTHER endpoint in this integration returns JSON. Do not route this
 * call through delhiveryFetch/delhiveryPost (client.ts) — both call
 * response.json(), which would throw on this body. This function fetches
 * raw text and parses XML explicitly instead. It also deliberately does NOT
 * send `Accept: application/json` (unlike delhiveryFetch's default) —
 * untested whether that header would change what Delhivery actually returns
 * here, so this matches the captured working request exactly rather than
 * assuming.
 *
 * IDEMPOTENCY — confirmed via live capture (AWB 57930810000066: cancelled,
 * then cancelled again ~90s later): calling this a second time on an
 * already-cancelled AWB returns the IDENTICAL success response — same HTTP
 * 200, same XML, same "Shipment has been cancelled." remark. There is no
 * distinguishable "already cancelled" error.
 *   - `accepted: true` means "Delhivery accepted the cancel request", NOT
 *     "this call is what cancelled the shipment." A caller cannot tell
 *     fresh-vs-repeat from this response alone — do not name a variable
 *     holding this result something like `wasNewlyCancelled`.
 *   - RETRIES ARE SAFE. Unlike POST /api/cmu/create.json (which must never
 *     be retried automatically — a retry there creates a duplicate
 *     shipment), a retried cancel call is harmless. Do not add "already
 *     cancelled" guards around retrying this call; there is no failure mode
 *     here for such a guard to protect against.
 *   - Cancellation state (has this AWB been cancelled, when, by whom) is OUR
 *     DATABASE's responsibility, not something to infer by calling this API
 *     again. Read your own Shipment/Order record for that.
 *
 * PROPAGATION DELAY — confirmed via live capture: it takes roughly a minute
 * for cancellation to surface in tracking data, and even then it does NOT
 * appear in Status.Status (which stays "Not Picked" for a pre-pickup
 * cancel) — it appears in Status.Instructions ("Seller cancelled the
 * order") / Status.StatusCode ("DTUP-210"). Do not read tracking
 * immediately after calling this and expect it to reflect the cancellation;
 * poll with a delay if you need to confirm from Delhivery's side at all
 * (normally you shouldn't need to — see the DB point above).
 *
 * As of 2026-08-25 this function is not called from any route or business
 * logic — it's a library primitive for a future wiring phase. Whoever wires
 * it up must not defeat any of the properties documented above.
 */
export async function cancelDelhiveryShipment(waybill: string): Promise<CancelResult> {
  const response = await fetch(`${delhiveryConfig.baseUrl}/api/p/edit`, {
    method: "POST",
    headers: {
      Authorization: `Token ${delhiveryConfig.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ waybill, cancellation: "true" }),
    signal: AbortSignal.timeout(15000),
  });

  const xmlText = await response.text();

  if (!response.ok) {
    throw new Error(`Delhivery cancel API error ${response.status}: ${xmlText}`);
  }

  const parsed = parseFlatXml(xmlText);

  const cancelResponse: DelhiveryCancelResponse = {
    status: parsed.status?.toLowerCase() === "true",
    waybill: parsed.waybill ?? waybill,
    orderId: parsed.order_id ?? "",
    remark: parsed.remark ?? "",
  };

  return {
    accepted: cancelResponse.status,
    waybill: cancelResponse.waybill,
    remark: cancelResponse.remark,
  };
}
