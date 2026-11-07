/**
 * Seller-acquisition switches. NEXT_PUBLIC_* values are inlined at build time and are public by design:
 * none of these is a secret.
 */

/**
 * `true` once the Java `POST /api/v1/vendors/register` endpoint exists in the deployed environment.
 * While false the register section shows an interest form (existing /api/contact) instead of a wizard
 * that could only fail at the last step.
 */
export const SELLER_SIGNUP_OPEN = process.env.NEXT_PUBLIC_SELLER_SIGNUP_OPEN === "true";

/** Version string of the seller agreement the applicant ticked; stored server-side with the application. */
export const SELLER_AGREEMENT_VERSION = process.env.NEXT_PUBLIC_SELLER_AGREEMENT_VERSION || "unpublished";

/** Where the agreement is published. Falls back to the general terms until a seller agreement exists. */
export const SELLER_AGREEMENT_URL = process.env.NEXT_PUBLIC_SELLER_AGREEMENT_URL || "/terms";

/** Where every "Start selling" button goes: the registration flow once it's open, the interest form until then. */
export const START_SELLING_HREF = SELLER_SIGNUP_OPEN ? "/become-vendor/register" : "#register";
