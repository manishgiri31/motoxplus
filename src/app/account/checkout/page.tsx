"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, MapPin, CreditCard, Smartphone, ShieldCheck, Lock } from "lucide-react";
import { PincodeChecker } from "@/components/shipping/pincode-checker";
import { ShippingEstimate } from "@/components/shipping/shipping-estimate";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, roundToPaise } from "@/lib/utils";
import { computeOrderPricing } from "@/lib/pricing/compute";
import { computeShippingQuote } from "@/lib/shipping/quote";

declare global {
  interface Window { Razorpay: any; }
}

type PaymentMethod = "DIRECT_UPI" | "RAZORPAY";

interface CartItem {
  productId: string;
  variantId: string | null;
  variant: { label: string; mrp: number | null } | null;
  product: { name: string; mrp: number | null; gstRate: number };
  quantity: number;
}

interface ServiceabilityResult {
  serviceable: boolean;
  city: string | null;
  state: string | null;
}

interface DeliveryForm {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

// Razorpay isn't configured on the merchant account yet — same flag the
// dealer checkout uses (src/app/dealer/checkout/page.tsx).
const RAZORPAY_ENABLED = process.env.NEXT_PUBLIC_RAZORPAY_ENABLED === "true";

// B2C checkout — one price (GST-inclusive), FULL_100 only (no 20% advance,
// that's a B2B credit arrangement), no scheme/dues/MOQ concepts. See
// B2C-EXPANSION-PLAN.md Phase 2. Deliberately a separate, simpler page
// rather than the dealer checkout with channel branches threaded through it.
export default function AccountCheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [upiEnabled, setUpiEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(RAZORPAY_ENABLED ? "RAZORPAY" : "DIRECT_UPI");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [serviceabilityResult, setServiceabilityResult] = useState<ServiceabilityResult | null>(null);

  const [delivery, setDelivery] = useState<DeliveryForm>({ name: "", phone: "", address: "", city: "", state: "", pincode: "" });
  const updateDelivery = (field: keyof DeliveryForm, value: string) => setDelivery((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    fetch("/api/cart")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setCartLoading(false);
      });

    fetch("/api/admin/settings/upi")
      .then((r) => r.json())
      .then((data) => {
        const enabled = data.upiEnabled !== false;
        setUpiEnabled(enabled);
        if (enabled) setPaymentMethod("DIRECT_UPI");
      })
      .catch(() => {});

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    document.body.appendChild(script);
  }, []);

  const itemMrp = (item: CartItem) => item.variant?.mrp ?? item.product.mrp;
  const pricing = computeOrderPricing({
    channel: "B2C",
    items: items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      variantLabel: item.variant?.label ?? null,
      variantSku: null,
      quantity: item.quantity,
      unitPrice: itemMrp(item) ?? 0,
      gstRate: item.product.gstRate,
    })),
  });
  const orderTotal = roundToPaise(pricing.subtotal + pricing.gstAmount);
  const { shippingCost } = computeShippingQuote({ channel: "B2C", orderTotal });
  const grandTotal = roundToPaise(orderTotal + shippingCost);

  const isDeliveryComplete =
    delivery.name.trim() && delivery.phone.trim() && delivery.address.trim() &&
    delivery.city.trim() && delivery.state.trim() && delivery.pincode.length === 6;

  const buildOrderPayload = () => ({
    paymentType: "FULL_100",
    deliveryName: delivery.name,
    deliveryPhone: delivery.phone,
    deliveryAddress: delivery.address,
    deliveryCity: delivery.city,
    deliveryState: delivery.state,
    deliveryPincode: delivery.pincode,
  });

  const safeJson = async (res: Response): Promise<any> => {
    try { return await res.json(); } catch { return null; }
  };

  const handleDirectUpi = async () => {
    setLoading(true);
    setError("");
    try {
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOrderPayload()),
      });
      const data = await safeJson(orderRes);
      if (!orderRes.ok || !data?.order) {
        setError(data?.error || "Failed to create order. Please try again.");
        setLoading(false);
        return;
      }
      router.push(`/account/orders/${data.order.id}/pay-upi`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setLoading(false);
    }
  };

  const handleRazorpay = async () => {
    setLoading(true);
    setError("");
    try {
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOrderPayload()),
      });
      const orderData = await safeJson(orderRes);
      if (!orderRes.ok || !orderData?.order) {
        setError(orderData?.error || "Failed to create order. Please try again.");
        setLoading(false);
        return;
      }
      const { order } = orderData;

      const rzpOrderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const rzpData = await safeJson(rzpOrderRes);
      if (!rzpOrderRes.ok || !rzpData?.data) {
        setError(rzpData?.error || `Could not start payment. Your order was saved — contact support with order number ${order.orderNumber}.`);
        setLoading(false);
        return;
      }
      const razorpayOrder = rzpData.data;

      const rzp = new window.Razorpay({
        key: razorpayOrder.keyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        order_id: razorpayOrder.razorpayOrderId,
        name: "MotoXPlus India Pvt. Ltd.",
        description: `Order ${razorpayOrder.orderNumber}`,
        theme: { color: "#DC2626" },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                orderId: order.id,
              }),
            });
            if (verifyRes.ok) {
              router.push(`/account/orders/${order.id}?success=1`);
              return;
            }
            const verifyData = await safeJson(verifyRes);
            setError(
              (verifyData?.error || "Payment verification failed.") +
                ` Your payment was received for order ${order.orderNumber} — contact support if it doesn't confirm shortly.`
            );
          } catch {
            setError(`Your payment for order ${order.orderNumber} went through, but we couldn't confirm it with our server. Please contact support — do not pay again.`);
          } finally {
            setLoading(false);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.open();
    } catch {
      setError("Something went wrong starting the payment. Please try again.");
      setLoading(false);
    }
  };

  const handlePlaceOrder = () => {
    if (!isDeliveryComplete) {
      setError("Please complete all delivery address fields.");
      return;
    }
    setError("");
    if (paymentMethod === "DIRECT_UPI") handleDirectUpi();
    else handleRazorpay();
  };

  if (cartLoading) {
    return (
      <div className="flex items-center justify-center gap-3 h-64 text-[var(--text-muted)]">
        <Spinner size={20} /> <span className="text-sm">Loading cart...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--text-muted)]">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Checkout</h1>
        <p className="text-[var(--text-muted)] mt-1">Enter your delivery details and pay.</p>
      </div>

      {/* Delivery address */}
      <div className="glass border border-[var(--border-color)] rounded-sm p-6 mb-5">
        <h3 className="text-[var(--text-primary)] font-bold mb-5">Delivery Address</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Full Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input type="text" value={delivery.name} onChange={(e) => updateDelivery("name", e.target.value)} placeholder="Recipient name" className="w-full themed-input rounded-sm pl-9 pr-4 py-3 text-sm outline-none transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Phone <span className="text-red-500">*</span></label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input type="tel" value={delivery.phone} onChange={(e) => updateDelivery("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" className="w-full themed-input rounded-sm pl-9 pr-4 py-3 text-sm outline-none transition-colors" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Street Address <span className="text-red-500">*</span></label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-3 text-[var(--text-muted)]" />
              <textarea rows={2} value={delivery.address} onChange={(e) => updateDelivery("address", e.target.value)} placeholder="House/Flat No., Street, Area" className="w-full themed-input rounded-sm pl-9 pr-4 py-3 text-sm outline-none transition-colors resize-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">City <span className="text-red-500">*</span></label>
              <input type="text" value={delivery.city} onChange={(e) => updateDelivery("city", e.target.value)} placeholder="City" className="w-full themed-input rounded-sm px-4 py-3 text-sm outline-none transition-colors" />
            </div>
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">State <span className="text-red-500">*</span></label>
              <input type="text" value={delivery.state} onChange={(e) => updateDelivery("state", e.target.value)} placeholder="State" className="w-full themed-input rounded-sm px-4 py-3 text-sm outline-none transition-colors" />
            </div>
          </div>

          <PincodeChecker
            value={delivery.pincode}
            onChange={(v) => updateDelivery("pincode", v)}
            onResult={(result) => {
              setServiceabilityResult(result);
              if (result?.city && !delivery.city) updateDelivery("city", result.city);
              if (result?.state && !delivery.state) updateDelivery("state", result.state);
            }}
          />
        </div>
      </div>

      {/* Order summary */}
      <div className="glass border border-[var(--border-color)] rounded-sm p-6 mb-5">
        <h3 className="text-[var(--text-primary)] font-bold mb-4">Order Summary</h3>
        <div className="space-y-2 mb-4">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{item.product.name} × {item.quantity}</span>
              <span className="text-[var(--text-primary)]">{itemMrp(item) != null ? formatCurrency((itemMrp(item) as number) * item.quantity) : "—"}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--border-color)] pt-4 space-y-2">
          <ShippingEstimate shippingCost={shippingCost} />
          <div className="flex justify-between font-bold pt-1 border-t border-[var(--border-color)]">
            <span className="text-[var(--text-primary)]">Grand Total</span>
            <span className="text-red-500 text-lg">{formatCurrency(grandTotal)}</span>
          </div>
          <p className="text-[var(--text-muted)] text-[10px]">Inclusive of all taxes.</p>
        </div>
      </div>

      {/* Payment method */}
      <div className="glass border border-[var(--border-color)] rounded-sm p-6 mb-5">
        <h3 className="text-[var(--text-primary)] font-bold mb-5">Payment Method</h3>
        <div className="space-y-3">
          {upiEnabled && (
            <button
              onClick={() => setPaymentMethod("DIRECT_UPI")}
              className={`w-full flex items-center gap-4 p-4 rounded-sm border text-left transition-all duration-200 ${paymentMethod === "DIRECT_UPI" ? "border-red-600 bg-red-600/5 ring-1 ring-red-600/20" : "border-[var(--border-color)] hover:border-red-600/40 glass"}`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${paymentMethod === "DIRECT_UPI" ? "border-red-600" : "border-[var(--text-muted)]"}`}>
                {paymentMethod === "DIRECT_UPI" && <div className="w-2 h-2 bg-red-600 rounded-full" />}
              </div>
              <Smartphone size={18} className="text-purple-400 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-[var(--text-primary)] font-semibold text-sm">Direct UPI / Bank Transfer</div>
                <div className="text-[var(--text-muted)] text-xs">Pay via UPI QR or NEFT/IMPS — verified within 1–2 hours</div>
              </div>
            </button>
          )}
          {RAZORPAY_ENABLED && (
            <button
              onClick={() => setPaymentMethod("RAZORPAY")}
              className={`w-full flex items-center gap-4 p-4 rounded-sm border text-left transition-all duration-200 ${paymentMethod === "RAZORPAY" ? "border-red-600 bg-red-600/5 ring-1 ring-red-600/20" : "border-[var(--border-color)] hover:border-red-600/40 glass"}`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${paymentMethod === "RAZORPAY" ? "border-red-600" : "border-[var(--text-muted)]"}`}>
                {paymentMethod === "RAZORPAY" && <div className="w-2 h-2 bg-red-600 rounded-full" />}
              </div>
              <CreditCard size={18} className="text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-[var(--text-primary)] font-semibold text-sm">Pay Online</div>
                <div className="text-[var(--text-muted)] text-xs">Cards, netbanking, UPI — instant confirmation</div>
              </div>
            </button>
          )}
          {!upiEnabled && !RAZORPAY_ENABLED && (
            <p className="text-amber-400 text-xs">No payment method is currently available. Please contact support.</p>
          )}
        </div>

        {paymentMethod === "RAZORPAY" && RAZORPAY_ENABLED && (
          <div className="mt-4 flex items-start gap-3 bg-red-900/10 border border-red-800/30 rounded-sm p-3">
            <Lock size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs leading-relaxed">
              You&apos;ll be redirected to Razorpay&apos;s secure checkout. Your card/UPI details are never seen or stored by MotoXPlus.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-5 bg-red-900/20 border border-red-900/40 rounded-sm p-4 text-red-400 text-sm">{error}</div>
      )}

      <button
        onClick={handlePlaceOrder}
        disabled={loading || (!upiEnabled && !RAZORPAY_ENABLED)}
        className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors text-sm uppercase tracking-wider"
      >
        {loading ? <><Spinner size={16} /> Placing order...</> : <><ShieldCheck size={16} /> Place Order — {formatCurrency(grandTotal)}</>}
      </button>
    </div>
  );
}
