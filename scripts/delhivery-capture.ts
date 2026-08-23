/**
 * Delhivery API capture script — calls the live API directly with raw fetch
 * (NOT through src/lib/delhivery's client/retry logic) and appends every raw
 * request/response pair to delhivery-reference.md, so that file can become
 * genuinely live-verified instead of the code-derived guesses currently in it.
 *
 * STEP 3 CREATES A REAL SHIPMENT. STEP 5 CANCELS IT (runs in a `finally`).
 * Fill in the DEST_* constants below with a real address you control before
 * running for real — the script refuses to run (outside --dry-run) until
 * you do.
 *
 * Run:
 *   npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/delhivery-capture.ts --dry-run
 *   npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/delhivery-capture.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import * as fs from "fs";
import * as path from "path";
import { delhiveryConfig } from "../src/lib/delhivery/config";

// ---------------------------------------------------------------------------
// FILL THESE IN WITH A REAL, REACHABLE ADDRESS BEFORE RUNNING FOR REAL.
// Not required for --dry-run, which only previews the built payload.
// ---------------------------------------------------------------------------
const PLACEHOLDER = "REPLACE_ME";

const DEST_NAME = PLACEHOLDER;
const DEST_PHONE = PLACEHOLDER; // 10 digits, no country code
const DEST_ADDRESS = PLACEHOLDER;
const DEST_CITY = PLACEHOLDER;
const DEST_STATE = PLACEHOLDER;
const DEST_PINCODE = PLACEHOLDER; // 6 digits
const ADDRESS_TYPE: "home" | "office" = "home";
const PRODUCT_DESC = "Capture test item";
const HSN_CODE = "87141090";
const ORDER_VALUE = 100; // Prepaid, so this is also total_amount; cod_amount stays 0
const WEIGHT_KG = 0.5; // 500g
// ---------------------------------------------------------------------------

const IS_DRY_RUN = process.argv.includes("--dry-run");
const REFERENCE_FILE = path.resolve(__dirname, "../delhivery-reference.md");

function redact(text: string): string {
  return text.split(delhiveryConfig.token).join("***REDACTED***");
}

function shoutAwb(awb: string) {
  const line = "=".repeat(70);
  console.log(
    `\n${line}\n  AWB: ${awb}\n  If this script dies before cancellation completes, CANCEL IT MANUALLY.\n${line}\n`
  );
}

interface CapturedCall {
  label: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  status: number;
  statusText: string;
  responseBody: string;
}

const captured: CapturedCall[] = [];

async function call(
  label: string,
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string
): Promise<{ status: number; text: string }> {
  console.log(`\n[${label}] ${method} ${url}`);
  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  console.log(`[${label}] -> ${res.status} ${res.statusText}`);
  console.log(redact(text));

  captured.push({
    label,
    method,
    url,
    requestHeaders: headers,
    requestBody: body ?? null,
    status: res.status,
    statusText: res.statusText,
    responseBody: text,
  });

  return { status: res.status, text };
}

function assertRealConstants() {
  const fields = { DEST_NAME, DEST_PHONE, DEST_ADDRESS, DEST_CITY, DEST_STATE, DEST_PINCODE };
  const unfilled = Object.entries(fields)
    .filter(([, v]) => !v || v === PLACEHOLDER)
    .map(([k]) => k);
  if (unfilled.length > 0) {
    throw new Error(
      `Fill in these constants at the top of scripts/delhivery-capture.ts before running for real: ${unfilled.join(", ")}\n` +
        `(Run with --dry-run to preview the payload without needing real values.)`
    );
  }
  if (!/^\d{10}$/.test(DEST_PHONE)) {
    throw new Error(`DEST_PHONE must be exactly 10 digits, got: "${DEST_PHONE}"`);
  }
  if (!/^\d{6}$/.test(DEST_PINCODE)) {
    throw new Error(`DEST_PINCODE must be exactly 6 digits, got: "${DEST_PINCODE}"`);
  }
}

function buildCreatePayload() {
  const orderRef = `CAPTURE-${Date.now()}`;
  const orderDate = new Date().toISOString().split("T")[0];

  const shipment = {
    name: DEST_NAME,
    add: DEST_ADDRESS,
    pin: DEST_PINCODE,
    city: DEST_CITY,
    state: DEST_STATE,
    country: "India",
    phone: DEST_PHONE,
    order: orderRef,
    payment_mode: "Prepaid" as const,
    return_pin: delhiveryConfig.pickup.pincode,
    return_city: delhiveryConfig.pickup.city,
    return_phone: delhiveryConfig.pickup.phone,
    return_name: delhiveryConfig.pickup.name,
    return_add: delhiveryConfig.pickup.address,
    return_state: delhiveryConfig.pickup.state,
    return_country: "India",
    products_desc: PRODUCT_DESC,
    hsn_code: HSN_CODE,
    cod_amount: 0,
    order_date: orderDate,
    total_amount: ORDER_VALUE,
    seller_gst_tin: delhiveryConfig.companyGst,
    shipping_mode: "Surface" as const,
    address_type: ADDRESS_TYPE,
    quantity: 1,
    weight: WEIGHT_KG,
  };

  return { shipments: [shipment] };
}

function appendToReferenceFile() {
  const timestamp = new Date().toISOString();
  const sections = captured.map((c) => {
    const reqHeaderLines = Object.entries(c.requestHeaders)
      .map(([k, v]) => `${k}: ${redact(v)}`)
      .join("\n");
    const reqBody = c.requestBody ? `\n\n${redact(c.requestBody)}` : "";
    return [
      `### ${c.label}`,
      "",
      "REQUEST:",
      "```",
      `${c.method} ${c.url}`,
      reqHeaderLines,
      reqBody.trim(),
      "```",
      "",
      `RESPONSE: ${c.status} ${c.statusText}`,
      "```",
      redact(c.responseBody),
      "```",
      "",
    ].join("\n");
  });

  const block = ["", "---", "", `## CAPTURED — ${timestamp} (scripts/delhivery-capture.ts)`, "", ...sections].join(
    "\n"
  );

  fs.appendFileSync(REFERENCE_FILE, block);
  console.log(`\nAppended ${captured.length} raw request/response pair(s) to ${REFERENCE_FILE}`);
}

async function main() {
  if (IS_DRY_RUN) {
    const payload = buildCreatePayload();
    console.log("--dry-run: no network calls will be made.\n");
    console.log("Built create.json payload (shipments[0]):");
    console.log(JSON.stringify(payload, null, 2));
    console.log("\nEncoded form body (format=json&data=<urlencoded JSON>):");
    console.log(new URLSearchParams({ format: "json", data: JSON.stringify(payload) }).toString());
    console.log("\nPickup/return + GST fields above came from delhiveryConfig — nothing here is hardcoded.");
    return;
  }

  assertRealConstants();
  const payload = buildCreatePayload();
  const authHeaders = { Authorization: `Token ${delhiveryConfig.token}` };
  let awb: string | null = null;

  try {
    // 1. Pincode serviceability
    await call(
      "1. Pincode serviceability",
      "GET",
      `${delhiveryConfig.baseUrl}/c/api/pin-codes/json/?filter_codes=${DEST_PINCODE}`,
      { ...authHeaders, Accept: "application/json" }
    );

    // 2. Bulk waybill fetch
    // NOTE: Delhivery's own docs (bulk-waybill.md) show this specific endpoint
    // taking `cl` (client/HQ name) and `token` as query params, unlike every
    // other endpoint here which authenticates via the Authorization header
    // alone. We don't have a configured client/HQ name — delhivery-reference.md's
    // Account section still has that field blank — so this call is header-auth
    // only, matching the rest of the client. If Delhivery rejects it for that
    // reason, that's a real, useful answer and gets captured below regardless.
    await call(
      "2. Bulk waybill fetch",
      "GET",
      `${delhiveryConfig.baseUrl}/waybill/api/bulk/json/?count=1`,
      { ...authHeaders, Accept: "application/json" }
    );

    // 3. Create shipment — REAL
    const formBody = new URLSearchParams({ format: "json", data: JSON.stringify(payload) }).toString();
    const { text: createText } = await call(
      "3. Create shipment (REAL)",
      "POST",
      `${delhiveryConfig.baseUrl}/api/cmu/create.json`,
      { ...authHeaders, "Content-Type": "application/x-www-form-urlencoded" },
      formBody
    );

    const createResponse = JSON.parse(createText);
    const pkg = createResponse?.packages?.[0];
    if (!pkg?.waybill) {
      throw new Error(`No waybill in create response — refusing to continue. Raw response: ${createText}`);
    }
    awb = pkg.waybill;
    shoutAwb(awb!);

    try {
      // 4. Track
      await call(
        "4. Track",
        "GET",
        `${delhiveryConfig.baseUrl}/api/v1/packages/json/?waybill=${awb}&verbose=0`,
        { ...authHeaders, Accept: "application/json" }
      );
    } catch (err) {
      console.error(`[4. Track] failed (continuing to cancellation regardless):`, err);
    }
  } finally {
    if (awb) {
      shoutAwb(awb);
      try {
        // 5. Cancel. Delhivery's Edit/Cancel Order API docs confirm
        // POST /api/p/edit with {"cancellation":"true"} but don't show a full
        // body example — "waybill" is the identifier field used by every
        // other Delhivery endpoint here, so that's what's sent. The captured
        // response below is the actual answer for whether that's correct.
        const cancelBody = JSON.stringify({ waybill: awb, cancellation: "true" });
        const { status } = await call(
          "5. Cancel",
          "POST",
          `${delhiveryConfig.baseUrl}/api/p/edit`,
          { ...authHeaders, "Content-Type": "application/json" },
          cancelBody
        );
        if (status >= 200 && status < 300) {
          console.log(`\nCancellation request for AWB ${awb} returned ${status} — verify the outcome manually.`);
        } else {
          console.error(`\nCANCELLATION MAY HAVE FAILED (HTTP ${status}) — CANCEL AWB ${awb} MANUALLY.`);
        }
      } catch (err) {
        console.error(`\nCANCELLATION REQUEST THREW — CANCEL AWB ${awb} MANUALLY.`, err);
      } finally {
        shoutAwb(awb);
      }
    }

    if (captured.length > 0) {
      appendToReferenceFile();
    }
  }
}

main().catch((err) => {
  console.error("\n[delhivery-capture] FAILED:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
