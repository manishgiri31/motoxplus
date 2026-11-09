import { ApiError, NetworkError } from "@/lib/api/client";
import { orderedErrors, type FieldErrors } from "@/lib/vendor/listings";

/**
 * The listings API is missing or down: marketplace switched off (Java then answers unknown routes with 404/500),
 * Java not running, or a proxy error. A 404 that names NOT_FOUND is a real "no such listing", not an outage.
 */
export function unavailable(e: unknown): boolean {
  if (e instanceof NetworkError) return true;
  if (!(e instanceof ApiError)) return false;
  return e.status >= 500 || (e.status === 404 && e.code !== "NOT_FOUND");
}

/** Field errors (in editor order) and a one-line summary for the banner. */
export function errorsFrom(e: unknown): { fields: FieldErrors; message: string } {
  if (e instanceof ApiError) {
    if (unavailable(e)) return { fields: {}, message: "We couldn't reach the listings service. Nothing was lost; try again shortly." };
    if (e.status === 403 && e.code === "VENDOR_NOT_ACTIVE") {
      return { fields: {}, message: "Your vendor account isn't active, so listings can't be changed right now." };
    }
    return { fields: orderedErrors(e.fieldErrors ?? {}), message: e.message };
  }
  return { fields: {}, message: "We couldn't reach the server. Check your connection and try again." };
}

/** A single message, preferring the given field's error (e.g. "images" for photo uploads). */
export function messageFrom(e: unknown, field?: keyof FieldErrors): string {
  const { fields, message } = errorsFrom(e);
  return (field && fields[field]) || message;
}
