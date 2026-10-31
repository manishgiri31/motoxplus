/**
 * Dev-host smoke test for the Delhivery B2B manifest.
 *
 * WHY: the manifest structures come from the docs' curl example and `freight_mode`
 * ("fop") is still unconfirmed. Per the rollout rule, the manifest must NOT be
 * run on the production LTL host until a job_id has come back from the dev host.
 * This script is how you see that job_id.
 *
 * It sends ONE manifest built by the same code real orders use
 * (buildB2bManifestInput -> submitB2bManifest) from a clearly fake order, and
 * prints the job_id. It refuses to run against the production host. It never
 * prints the JWT or the password.
 *
 * Needs (in .env, for the DEV account/host):
 *   DELHIVERY_B2B_BASE_URL=<dev host, https://...>
 *   DELHIVERY_USERNAME_B2B, DELHIVERY_PASSWORD_B2B, DELHIVERY_PICKUP_LOCATION_B2B
 *
 * Run (after reviewing with --dry-run, which makes NO network call):
 *   npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/delhivery-b2b-dev-manifest.ts --dry-run
 *   npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/delhivery-b2b-dev-manifest.ts
 *
 * Once a job_id prints, set DELHIVERY_B2B_PROD_MANIFEST_VERIFIED=true in the
 * PRODUCTION env (and confirm freight_mode with Delhivery).
 */
import * as dotenv from "dotenv";
dotenv.config();

import { getB2bConfig } from "../src/lib/delhivery/b2b/config";
import { buildB2bManifestInput } from "../src/lib/delhivery/b2b/order-mapping";
import { submitB2bManifest } from "../src/lib/delhivery/b2b/manifest";

const IS_DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const cfg = getB2bConfig();
  if (cfg.isProd) {
    console.error(
      "Refusing to run: DELHIVERY_B2B_BASE_URL is the PRODUCTION host. Point it at the dev host for this test."
    );
    process.exit(1);
  }

  const manifest = buildB2bManifestInput({
    orderNumber: `DEVTEST-${Date.now()}`,
    grandTotal: 1000,
    amountDue: 0,
    consignee: {
      name: "DEV TEST",
      address: "Test address, not a real delivery",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110045",
      phone: "9999999999",
      email: "",
    },
    items: [{ name: "Dev test item", quantity: 1, weightKg: 1 }],
  });

  console.log(`Target: ${cfg.baseUrl}  (dev)  warehouse: ${manifest.pickupLocationName}`);
  console.log("Manifest fields:", JSON.stringify({ ...manifest, dropoffLocation: "(see below)" }, null, 2));
  console.log("dropoff_location:", JSON.stringify(manifest.dropoffLocation));

  if (IS_DRY_RUN) {
    console.log("\n--dry-run: nothing was sent.");
    return;
  }

  const { jobId } = await submitB2bManifest(manifest);
  console.log(`\nSUCCESS — job_id: ${jobId}`);
  console.log("Next: confirm freight_mode with Delhivery, then set DELHIVERY_B2B_PROD_MANIFEST_VERIFIED=true in the production env.");
}

main().catch((err) => {
  // Error messages from the B2B modules never contain the password or JWT.
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
