// TEMPORARY, for watching the Razorpay flow step-by-step in server logs
// while testing. Silent by default (gated behind PAYMENT_DEBUG=true) so
// leaving it in is safe even if forgotten — but it should still be removed,
// or at minimum left unset, before production.
// TODO(remove-before-prod): delete this file and its call sites in
// src/app/api/payments/create-order/route.ts and
// src/app/api/payments/verify/route.ts once Razorpay testing is done.
export function paymentDebug(step: string, data?: Record<string, unknown>) {
  if (process.env.PAYMENT_DEBUG !== "true") return;
  console.log(`[PAYMENT-DEBUG] ${new Date().toISOString()} ${step}`, data ?? "");
}
