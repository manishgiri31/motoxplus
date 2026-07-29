import Razorpay from "razorpay";

// Singleton — avoid re-creating client on every request. Shared by
// payments/create-order and the cancel-order refund path so there's only
// ever one Razorpay client in the process.
let _razorpay: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      throw new Error("Razorpay credentials not configured");
    }
    _razorpay = new Razorpay({ key_id, key_secret });
  }
  return _razorpay;
}

export interface RefundResult {
  refundId: string;
  status: string;
}

/**
 * Partial refund — cancellation fees mean we're refunding 98%/80% of the
 * capture, never the full amount, so this always passes an explicit amount
 * rather than omitting it (which would refund 100%).
 */
export async function refundPayment(
  razorpayPaymentId: string,
  amountInPaise: number,
  notes?: Record<string, string>
): Promise<RefundResult> {
  const refund = await getRazorpay().payments.refund(razorpayPaymentId, {
    amount: amountInPaise,
    speed: "normal",
    notes,
  });
  return { refundId: refund.id, status: refund.status };
}
