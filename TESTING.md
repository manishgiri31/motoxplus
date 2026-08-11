# Razorpay End-to-End Test Checklist

Razorpay isn't configured on the merchant account yet — the checkout page and
`/api/payments/create-order` are both gated behind `NEXT_PUBLIC_RAZORPAY_ENABLED`
(default `false`, showing only Direct UPI / COD). This checklist is for when
you're ready to test against a **Razorpay test-mode** account, before flipping
that flag on in production.

## 1. Switching to test mode

No hardcoded keys anywhere in the code — confirmed by grepping for `rzp_live`/
`rzp_test` literals across `src/`, `prisma/`, and `next.config.mjs`: zero
matches. Every Razorpay key reference goes through `process.env.RAZORPAY_KEY_ID`
/ `RAZORPAY_KEY_SECRET` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` (`src/app/api/payments/
create-order/route.ts`, `src/app/api/payments/verify/route.ts`). Swapping to
test mode is purely an env var change:

In your `.env` (test/staging environment, not production):
```
NEXT_PUBLIC_RAZORPAY_ENABLED="true"
RAZORPAY_KEY_ID="rzp_test_XXXXXXXXXXXX"
RAZORPAY_KEY_SECRET="<test mode key secret from the Razorpay dashboard>"
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_XXXXXXXXXXXX"
```
Get test keys from **Razorpay Dashboard → Settings → API Keys**, with **Test
Mode** toggled on (top-right switch). Restart the server after changing `.env`
— these are read at process start, not hot-reloaded.

## 2. Full Payment checkout (FULL_100)

1. Add an item to cart, go to checkout, fill delivery details.
2. Confirm "Full Payment via Razorpay" is now visible as a payment option
   (it's hidden when `NEXT_PUBLIC_RAZORPAY_ENABLED` is off — if you don't see
   it, the env var didn't take effect; check you restarted the server).
3. Select it, click "Place Order". Razorpay checkout modal should open with
   the correct amount (grand total, not the 20% figure).
4. Use a [Razorpay test card](https://razorpay.com/docs/payments/payments/test-mode/#test-cards)
   (e.g. `4111 1111 1111 1111`, any future expiry, any CVV) to complete payment.
5. Expect: redirected to `/dealer/orders/{id}?success=1`, order status
   `CONFIRMED`, `paymentStatus: PAID`, `amountDue: 0`, an invoice generated.
6. Confirm the `Payment` row for this order shows `status: PAID` with the
   `razorpayPaymentId` set, and check server logs for a
   `[Payments] verify: capture mismatch` line — there should be none.

## 3. 20% Advance checkout (ADVANCE_20)

Same as above but select "20% Advance via Razorpay". Verify:
- The Razorpay modal amount is 20% of the grand total, not the full amount.
- After success: `paymentStatus: "PARTIAL"`, `amountDue` equals the remaining
  80% (check this is a clean 2-decimal number, not something like
  `1234.5600000000004` — this was a real floating-point bug that was fixed;
  worth eyeballing on a few test orders with odd-cent totals).
- A second payment later against the same order should be able to bring
  `amountDue` to 0 (not covered by this checklist — flag if you need that
  flow tested too, it isn't implemented in the checkout UI as of this pass).

## 4. Confirming the replay/tamper guards actually hold

`/api/payments/verify` now does two checks before marking an order paid, not
just the HMAC signature (see the comments in
`src/app/api/payments/verify/route.ts` for the full reasoning):

1. **Order binding** — the signed `razorpayOrderId`/`razorpayPaymentId` pair
   must match a `Payment` row that was created for *this* `orderId` by
   `/api/payments/create-order`. A signature that's valid for a different
   order (even one the same dealer legitimately paid) is rejected with
   `400 Payment record not found for this order`.
2. **Capture confirmation** — `getRazorpay().payments.fetch(razorpayPaymentId)`
   must report `status: "captured"`, the same `order_id`, and `amount`/
   `currency` matching the `Payment.amount` recorded server-side at
   create-order time (never a client-supplied figure).

Test this before going live:
- **Order-binding check**: create two orders (A cheap, B expensive) for the
  same test dealer. Pay A via Razorpay test mode and capture the
  `razorpayOrderId`/`razorpayPaymentId`/`razorpaySignature` from the network
  tab. Replay them against `/api/payments/verify` with `orderId: B.id`.
  Expect `400 Payment record not found for this order`, and order B
  unchanged (`stockReserved: false`, `paymentStatus: PENDING`).
- **Capture-mismatch check**: hardest to force with a real Razorpay account
  (would require a since-refunded or failed payment ID) — acceptable to
  verify by code review of the `captured.status/order_id/amount/currency`
  comparison instead of a live repro.

## 5. The critical failure case: verify fails *after* Razorpay already captured payment

This is the scenario the recent bug fix specifically targeted (see
`src/app/dealer/checkout/page.tsx`, the `handler` callback in
`handleOnlinePayment`) — Razorpay's `handler` callback only fires *after* it
has already captured the customer's money, so if the follow-up call to
`/api/payments/verify` fails, the customer has paid but the order may not be
confirmed. Before this fix, that left the UI on an infinite spinner with zero
feedback. Confirm the fix actually works:

**How to force it:**
1. Start a Full Payment or 20% Advance checkout, get to the Razorpay modal.
2. Complete payment with a test card (money "captures" in test mode).
3. The instant you see the Razorpay modal start to close (payment accepted,
   about to call `handler`), you need `/api/payments/verify` to fail. Two ways:
   - **DevTools → Network tab → right-click → "Block request URL"**, add
     `/api/payments/verify`, *before* starting the payment. The request will
     fail immediately when fired (cleanest, fully reproducible).
   - **DevTools → Network tab → Throttling → Offline**, toggled on right after
     clicking "Pay" in the Razorpay modal but before it redirects (timing-
     sensitive, harder to land precisely — prefer the block-request approach).
   - Alternatively, temporarily rename/break the route (e.g. comment out the
     export in `verify/route.ts` so it 404s) — crude but guaranteed, just
     remember to revert it.
4. Expect: an alert reading something like *"Your payment for order MXP...
   went through, but we couldn't confirm it with our server. Please contact
   support with this order number — do not pay again."* — not a silent hang,
   not a generic error, and specifically mentioning the order number.
5. Unblock the request, refresh `/dealer/orders/{id}` — the order should still
   be `PENDING`/unpaid in the DB at this point (verify never ran), which is
   the real-world state you'd need to manually reconcile if this happened for
   real (check Razorpay's dashboard for the actual capture, then manually
   mark the order paid, or have the customer retry — there's no automatic
   reconciliation/retry built for this edge case yet).

## 6. Regression check: COD and Direct UPI still work

These don't touch Razorpay at all, but re-verify since the checkout page's
error handling was rewritten in the same pass:
- COD: order created with `status: CONFIRMED`, `paymentStatus: PENDING`,
  redirects to `/dealer/orders/{id}?success=1`.
- Direct UPI: order created with `paymentType: FULL_100`, redirects to
  `/dealer/orders/{id}/pay-upi`.
- Try submitting checkout with the network offline (DevTools throttling) for
  both — expect a clear alert ("Could not reach the server...") and the
  button re-enabling, not a stuck spinner.
