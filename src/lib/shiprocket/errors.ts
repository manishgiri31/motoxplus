/**
 * Typed errors for the Shiprocket integration. Callers should catch these
 * specifically rather than a bare Error so config problems (fix .env) are
 * distinguishable from auth/API failures (transient, retry-worthy) at a
 * glance in logs and error boundaries.
 */

export class ShiprocketConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShiprocketConfigError";
  }
}

export class ShiprocketAuthError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ShiprocketAuthError";
  }
}
