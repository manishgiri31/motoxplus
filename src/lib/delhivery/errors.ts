/**
 * Thrown by getDelhiveryConfig() when required env vars are missing/invalid.
 * Callers (route handlers) should catch this specifically and return a 503
 * rather than a generic 500 — this is a deployment/config problem, not a
 * Delhivery API failure.
 */
export class DelhiveryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DelhiveryConfigError";
  }
}

/**
 * Thrown where an API request/response shape was deliberately NOT implemented
 * because no verified spec exists yet. Never fill these in from memory — get
 * the real request/response pair first (see delhivery-reference.md).
 */
export class DelhiveryNotSpecifiedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DelhiveryNotSpecifiedError";
  }
}

export const B2B_CARRIER_ACTION_UNSUPPORTED_MESSAGE =
  "Tracking and cancellation are not supported for B2B-channel shipments yet. " +
  "Use the Delhivery B2B (LTL) dashboard for this shipment.";

/**
 * B2B shipments live on ltl-clients-api (JWT), not on track.delhivery.com.
 * Tracking / cancel / serviceability / rates are B2C-token calls, so a B2B
 * order must get a clear error instead of being sent to the wrong API.
 */
export class DelhiveryB2bUnsupportedActionError extends Error {
  constructor(action: string) {
    super(`${B2B_CARRIER_ACTION_UNSUPPORTED_MESSAGE} (action: ${action})`);
    this.name = "DelhiveryB2bUnsupportedActionError";
  }
}

/** Call before any B2C-token carrier action that has an order in hand. */
export function assertB2cCarrierAction(channel: unknown, action: string): void {
  if (channel === "B2B") throw new DelhiveryB2bUnsupportedActionError(action);
}

/** Login rejected, or the cached JWT was rejected by the B2B API. */
export class DelhiveryB2bAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DelhiveryB2bAuthError";
  }
}

/** Login is locked out after bad credentials; no network call was made. */
export class DelhiveryB2bAuthLockedError extends DelhiveryB2bAuthError {
  constructor(public readonly retryAfterMs: number) {
    super(
      `Delhivery B2B login is locked for ${Math.ceil(retryAfterMs / 60_000)} more minute(s) after a rejected login. ` +
        `Check DELHIVERY_B2B_USERNAME / DELHIVERY_B2B_PASSWORD before it retries.`
    );
    this.name = "DelhiveryB2bAuthLockedError";
  }
}

/**
 * The B2B manifest was NOT sent because the target is the production LTL host
 * and nobody has confirmed the manifest works on the dev host yet.
 */
export class DelhiveryB2bProdManifestBlockedError extends Error {
  constructor() {
    super(
      "B2B manifest blocked on the production host: it has not been verified on the dev host yet. " +
        "Run scripts/delhivery-b2b-dev-manifest.ts against DELHIVERY_B2B_BASE_URL=<dev host>, confirm a job_id comes back, " +
        "then set DELHIVERY_B2B_PROD_MANIFEST_VERIFIED=true."
    );
    this.name = "DelhiveryB2bProdManifestBlockedError";
  }
}
