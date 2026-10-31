import { b2bRequest } from "./client";

/**
 * GET /manifest for a job_id.
 *
 * TODO(spec): the query format for looking up by job_id is NOT confirmed. This
 * sends `?job_id=<id>` as the most direct reading of "GET /manifest, job_id se";
 * the test pins that URL so a wrong guess shows up as a deliberate change, not
 * a silent one. Confirm against a real call and update both.
 *
 * Also unspecified: the response shape (where the LR number lives), so the raw
 * parsed body is returned untouched.
 *
 * NOT called anywhere automatically. The manifest is processed asynchronously,
 * so never call this immediately after submitB2bManifest — poll later.
 */
export async function getB2bManifestStatus(jobId: string): Promise<unknown> {
  const { json, text } = await b2bRequest(`/manifest?job_id=${encodeURIComponent(jobId)}`, { method: "GET" });
  return json ?? text;
}
