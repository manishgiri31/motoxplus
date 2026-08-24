import * as dotenv from "dotenv";
dotenv.config();

import { delhiveryConfig } from "../src/lib/delhivery/config";

const AWB = "57930810000066";

function redact(text: string): string {
  return text.split(delhiveryConfig.token).join("***REDACTED***");
}

async function main() {
  const authHeaders = { Authorization: `Token ${delhiveryConfig.token}` };

  const cancelRes = await fetch(`${delhiveryConfig.baseUrl}/api/p/edit`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ waybill: AWB, cancellation: "true" }),
  });
  const cancelText = await cancelRes.text();
  console.log("=== CANCEL #2 ===");
  console.log("STATUS", cancelRes.status);
  console.log(redact(cancelText));

  const trackRes = await fetch(`${delhiveryConfig.baseUrl}/api/v1/packages/json/?waybill=${AWB}&verbose=0`, {
    headers: { ...authHeaders, Accept: "application/json" },
  });
  const trackText = await trackRes.text();
  console.log("=== TRACK AFTER CANCEL #2 ===");
  console.log("STATUS", trackRes.status);
  console.log(redact(trackText));
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
