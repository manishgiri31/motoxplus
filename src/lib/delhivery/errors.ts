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
