import { prisma } from "@/lib/prisma";

/** Generic Setting key/value row — same pattern as cancellation-policy.ts's CARRIER_STALE_DAYS_SETTING_KEY. */
export const SELLER_STATE_SETTING_KEY = "seller.state";

/** GSTIN 07... (see terms/privacy pages) — the registered business state, if nothing else resolves it. */
const DEFAULT_SELLER_STATE = "Delhi";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { value: string; expiresAt: number } | null = null;

/**
 * The seller's registered GST state — used as one side of the same-state-vs-
 * inter-state comparison in lib/tax/gst-split.ts. Sourced from the Setting
 * table (admin-editable via PUT /api/admin/settings, key "seller.state")
 * rather than an env var: this is a business/registration fact, not deploy
 * config, and changing it (e.g. a new GST registration state) shouldn't need
 * a redeploy. Falls back to SELLER_STATE env, then a hardcoded default — an
 * order must never fail to place just because this setting was never seeded.
 * Cached in-process for CACHE_TTL_MS so this isn't a DB round-trip on every
 * order; a change made in the admin UI takes effect within that window.
 */
export async function getSellerState(): Promise<string> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const row = await prisma.setting.findUnique({ where: { key: SELLER_STATE_SETTING_KEY } });
  let value = row?.value?.trim();
  if (!value) {
    console.warn(
      `[GST] Setting "${SELLER_STATE_SETTING_KEY}" not found — falling back to SELLER_STATE env / default. ` +
        `Set it via PUT /api/admin/settings to silence this.`
    );
    value = process.env.SELLER_STATE?.trim() || DEFAULT_SELLER_STATE;
  }

  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
