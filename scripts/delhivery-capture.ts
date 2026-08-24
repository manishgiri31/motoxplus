/**
 * Delhivery API capture script — calls the live API directly with raw fetch
 * (NOT through src/lib/delhivery's client/retry logic) and appends every raw
 * request/response pair to delhivery-reference.md, so that file can become
 * genuinely live-verified instead of the code-derived guesses currently in it.
 *
 * The create.json payload itself is built via
 * src/lib/delhivery/shipment.ts's buildCreateShipmentRequest — the same
 * function real orders use — so this actually exercises the production
 * payload-construction path, not a hand-rolled copy that can drift from it.
 *
 * STEP 3 CREATES A REAL SHIPMENT. STEP 5 CANCELS IT (runs in a `finally`) and
 * is mandatory once a real AWB exists — if cancellation can't be confirmed,
 * the script exits non-zero and prints a loud manual-cancellation warning.
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
import { buildCreateShipmentRequest } from "../src/lib/delhivery/shipment";
import type { DelhiveryBulkWaybillResponse } from "../src/lib/delhivery/types";

// ---------------------------------------------------------------------------
// FILL THESE IN WITH A REAL, REACHABLE ADDRESS BEFORE RUNNING FOR REAL.
// Not required for --dry-run, which only previews the built payload.
// ---------------------------------------------------------------------------
const PLACEHOLDER = "REPLACE_ME";

const DEST_NAME = "Manish Giri";
const DEST_PHONE = "7206794749"; // 10 digits, no country code
const DEST_ADDRESS = "House No. 123, Model Town Road";
const DEST_CITY = "Yamunanagar";
const DEST_STATE = "Haryana";
const DEST_PINCODE = "135001"; // 6 digits
// Matches shipment.ts's production value exactly (see FIX 2: the capture
// uses the same builder as real orders, so this must match what real orders
// actually send, not what best describes this specific test address).
const ADDRESS_TYPE: "home" | "office" = "office";
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

function buildRequest() {
  const orderRef = `CAPTURE-${Date.now()}`;
  const orderDate = new Date().toISOString().split("T")[0];

  return buildCreateShipmentRequest({
    destName: DEST_NAME,
    destAddress: DEST_ADDRESS,
    destPincode: DEST_PINCODE,
    destCity: DEST_CITY,
    destState: DEST_STATE,
    destPhone: DEST_PHONE,
    orderRef,
    paymentMode: "Prepaid",
    codAmount: 0,
    totalAmount: ORDER_VALUE,
    productsDesc: PRODUCT_DESC,
    hsnCode: HSN_CODE,
    quantity: 1,
    weightKg: WEIGHT_KG,
    addressType: ADDRESS_TYPE,
    orderDate,
  });
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
    const request = buildRequest();
    console.log("--dry-run: no network calls will be made.\n");
    console.log("Built create.json request (shipments + pickup_location):");
    console.log(JSON.stringify(request, null, 2));
    console.log("\nEncoded form body (format=json&data=<urlencoded JSON>):");
    console.log(new URLSearchParams({ format: "json", data: JSON.stringify(request) }).toString());
    console.log("\nPickup/return + GST fields above came from delhiveryConfig — nothing here is hardcoded.");
    return;
  }

  assertRealConstants();
  const request = buildRequest();
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
    // Delhivery's docs (bulk-waybill.md) show this endpoint taking `cl`
    // (client/HQ name) as a query param alongside auth. `cl` is an account
    // identifier, not a secret, so it's fine in the URL — the token itself
    // stays in the Authorization header only, never in the query string,
    // so it can't end up in access logs.
    const { text: bulkWaybillText } = await call(
      "2. Bulk waybill fetch",
      "GET",
      `${delhiveryConfig.baseUrl}/waybill/api/bulk/json/?cl=${encodeURIComponent(delhiveryConfig.clientName)}&count=1`,
      { ...authHeaders, Accept: "application/json" }
    );
    // Response is a bare JSON string (e.g. "57930810000011"), not an object —
    // do not assume `.waybill` or similar on it.
    const fetchedWaybill: DelhiveryBulkWaybillResponse = JSON.parse(bulkWaybillText);
    console.log(`[2. Bulk waybill fetch] parsed waybill: ${fetchedWaybill}`);

    // 3. Create shipment — REAL
    const formBody = new URLSearchParams({ format: "json", data: JSON.stringify(request) }).toString();
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
      let cancelConfirmed = false;

      try {
        // 5. Cancel — MANDATORY once a real AWB exists. Delhivery's Edit/
        // Cancel Order API docs confirm POST /api/p/edit with
        // {"cancellation":"true"} but don't show a full body example —
        // "waybill" is the identifier field used by every other Delhivery
        // endpoint here, so that's what's sent. The captured response below
        // is the actual answer for whether that's correct.
        const cancelBody = JSON.stringify({ waybill: awb, cancellation: "true" });
        const { status: cancelStatus } = await call(
          "5. Cancel",
          "POST",
          `${delhiveryConfig.baseUrl}/api/p/edit`,
          { ...authHeaders, "Content-Type": "application/json" },
          cancelBody
        );
        console.log(
          `\nCancel HTTP response: ${cancelStatus}. Not trusting that alone — re-checking tracking to confirm the shipment actually shows cancelled.`
        );

        try {
          // 6. Re-track the same AWB. This, not the cancel call's HTTP
          // status, is the source of truth.
          //
          // Confirmed empirically 2026-08-24 on a shipment cancelled before
          // pickup: Status.Status stayed "Not Picked" throughout — it never
          // became "Cancelled"/"Returned" as Delhivery's own Cancel Order API
          // docs describe (that mapping appears to be for post-pickup
          // cancellations only). The real signal was in Instructions/
          // StatusCode ("Seller cancelled the order" / "DTUP-210"), and it
          // took time to appear: the immediate re-track below still showed
          // the generic "Shipment not received from client" / "X-PNP" — a
          // check ~90s later (after a second cancel call) was the first to
          // show the specific cancellation instruction. So this retries with
          // increasing delay rather than checking once.
          const delaysMs = [3000, 5000, 8000];
          for (let attempt = 0; attempt < delaysMs.length && !cancelConfirmed; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));

            const { text: trackText } = await call(
              `6. Track (post-cancel, attempt ${attempt + 1}/${delaysMs.length})`,
              "GET",
              `${delhiveryConfig.baseUrl}/api/v1/packages/json/?waybill=${awb}&verbose=0`,
              { ...authHeaders, Accept: "application/json" }
            );

            const trackData = JSON.parse(trackText);
            const shipmentStatus = trackData?.ShipmentData?.[0]?.Shipment?.Status;
            const statusStr: string = shipmentStatus?.Status || "";
            const instructionsStr: string = shipmentStatus?.Instructions || "";
            console.log(
              `\nPost-cancel status for AWB ${awb}: Status="${statusStr}" Instructions="${instructionsStr}"`
            );

            if (/cancel|return/i.test(statusStr) || /cancel/i.test(instructionsStr)) {
              cancelConfirmed = true;
              console.log(
                `\nCancellation CONFIRMED via tracking — AWB ${awb}: Status="${statusStr}" Instructions="${instructionsStr}".`
              );
            }
          }
        } catch (err) {
          console.error(`\n[6. Track post-cancel] failed — could not confirm cancellation from tracking:`, err);
        }
      } catch (err) {
        console.error(`\nCANCELLATION REQUEST THREW:`, err);
      }

      if (!cancelConfirmed) {
        const bang = "!".repeat(70);
        console.error(
          `\n${bang}\n` +
            `  CANCELLATION NOT CONFIRMED — DO NOT ASSUME THIS SHIPMENT IS CANCELLED.\n` +
            `  AWB: ${awb}\n` +
            `  Public tracking: https://www.delhivery.com/track/package/${awb}\n` +
            `  Log in to your Delhivery partner/seller dashboard now and cancel\n` +
            `  this AWB manually.\n` +
            `${bang}\n`
        );
        // Do not move on silently — reflect the failure in the exit code.
        process.exitCode = 1;
      } else {
        try {
          // 7. Cancel again on the already-cancelled AWB. Production will
          // hit "already cancelled" (retries, double-clicks, replayed jobs)
          // far more often than the happy path, so this is worth capturing
          // even though the first cancel already succeeded.
          const secondCancelBody = JSON.stringify({ waybill: awb, cancellation: "true" });
          await call(
            "7. Cancel again (already-cancelled AWB)",
            "POST",
            `${delhiveryConfig.baseUrl}/api/p/edit`,
            { ...authHeaders, "Content-Type": "application/json" },
            secondCancelBody
          );
        } catch (err) {
          console.error(`\n[7. Cancel again] threw (informational only — first cancel already confirmed):`, err);
        }
      }

      shoutAwb(awb);
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
