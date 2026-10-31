import { DelhiveryNotSpecifiedError } from "../errors";

/**
 * TODO(spec): B2B (ltl-clients) warehouse registration. The request body is not
 * in any spec we hold, so nothing is sent. (The `address_details` / `ret_address`
 * payload belongs to this B2B side, but the full body — required fields,
 * endpoint path, response — still has to come from the doc before this is built.
 * Do not reuse the B2C warehouse payload: it is a different API.)
 */
export async function registerB2bWarehouse(): Promise<never> {
  throw new DelhiveryNotSpecifiedError(
    "B2B warehouse registration is not implemented: the request body spec has not been provided."
  );
}
