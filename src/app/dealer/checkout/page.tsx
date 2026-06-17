"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Truck, CreditCard, ChevronRight } from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type PaymentType = "ADVANCE_20" | "FULL_100" | "COD";

interface CartSummary {
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  items: Array<{
    product: { name: string; price: number; gstRate: number };
    quantity: number;
  }>;
}

const paymentOptions = [
  {
    id: "FULL_100" as PaymentType,
    title: "Full Payment",
    subtitle: "Pay 100% now via Razorpay",
    icon: <CreditCard size={18} className="text-red-500" />,
    badge: "Recommended",
  },
  {
    id: "ADVANCE_20" as PaymentType,
    title: "20% Advance",
    subtitle: "Pay 20% now, balance before delivery",
    icon: <CreditCard size={18} className="text-blue-400" />,
    badge: null,
  },
  {
    id: "COD" as PaymentType,
    title: "Cash on Delivery",
    subtitle: "Pay full amount when order is delivered",
    icon: <Truck size={18} className="text-green-400" />,
    badge: "COD",
  },
];

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("FULL_100");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cart")
      .then((r) => r.json())
      .then((data) => {
        if (data.items) {
          const subtotal = data.items.reduce(
            (sum: number, item: any) => sum + item.product.price * item.quantity,
            0
          );
          const gstAmount = data.items.reduce(
            (sum: number, item: any) =>
              sum + (item.product.price * item.quantity * item.product.gstRate) / 100,
            0
          );
          setCart({ subtotal, gstAmount, grandTotal: subtotal + gstAmount, items: data.items });
        }
        setCartLoading(false);
      });

    // Preload Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    document.body.appendChild(script);
  }, []);

  const amountDue = cart
    ? paymentType === "ADVANCE_20"
      ? cart.grandTotal * 0.2
      : cart.grandTotal
    : 0;

  const handleCOD = async () => {
    setLoading(true);
    const orderRes = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentType: "COD", notes }),
    });

    if (!orderRes.ok) {
      const err = await orderRes.json();
      alert(err.error || "Failed to place order");
      setLoading(false);
      return;
    }

    const { order } = await orderRes.json();
    router.push(`/dealer/orders/${order.id}?success=1`);
  };

  const handleOnlinePayment = async () => {
    setLoading(true);
    try {
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType, notes }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        alert(err.error || "Failed to create order");
        setLoading(false);
        return;
      }

      const { order } = await orderRes.json();

      const rzpOrderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });

      const rzpData = await rzpOrderRes.json();

      const rzp = new window.Razorpay({
        key: rzpData.keyId,
        amount: rzpData.amount,
        currency: rzpData.currency,
        order_id: rzpData.razorpayOrderId,
        name: "MotoXPlus India Pvt. Ltd.",
        description: `Order ${rzpData.orderNumber}`,
        theme: { color: "#DC2626" },
        handler: async (response: any) => {
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
            router.push(`/dealer/orders/${order.id}?success=1`);
          } else {
            alert("Payment verification failed. Contact support.");
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });

      rzp.open();
    } catch {
      alert("Something went wrong");
      setLoading(false);
    }
  };

  const handlePlaceOrder = () => {
    if (paymentType === "COD") {
      handleCOD();
    } else {
      handleOnlinePayment();
    }
  };

  if (cartLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-[var(--text-muted)]">Loading...</div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
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
        <p className="text-[var(--text-muted)] mt-1">Review your order and choose how to pay.</p>
      </div>

      {/* Order summary */}
      <div className="glass border border-[var(--border-color)] rounded-sm p-6 mb-5">
        <h3 className="text-[var(--text-primary)] font-bold mb-4">Order Summary</h3>
        <div className="space-y-2 mb-4">
          {cart.items.map((item: any, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">
                {item.product.name} × {item.quantity}
              </span>
              <span className="text-[var(--text-primary)]">{formatCurrency(item.product.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--border-color)] pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Subtotal (excl. GST)</span>
            <span className="text-[var(--text-primary)]">{formatCurrency(cart.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">GST</span>
            <span className="text-[var(--text-primary)]">{formatCurrency(cart.gstAmount)}</span>
          </div>
          <div className="flex justify-between font-bold pt-1">
            <span className="text-[var(--text-primary)]">Grand Total</span>
            <span className="text-red-500 text-lg">{formatCurrency(cart.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Payment options */}
      <div className="glass border border-[var(--border-color)] rounded-sm p-6 mb-5">
        <h3 className="text-[var(--text-primary)] font-bold mb-5">Payment Method</h3>
        <div className="space-y-3">
          {paymentOptions.map((option) => {
            const isSelected = paymentType === option.id;
            const amount =
              option.id === "ADVANCE_20"
                ? cart.grandTotal * 0.2
                : cart.grandTotal;

            return (
              <button
                key={option.id}
                onClick={() => setPaymentType(option.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-sm border text-left transition-all duration-200 ${
                  isSelected
                    ? "border-red-600 bg-red-600/5"
                    : "border-[var(--border-color)] hover:border-red-600/40 glass"
                }`}
              >
                {/* Radio */}
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                    isSelected ? "border-red-600" : "border-[var(--text-muted)]"
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 bg-red-600 rounded-full" />}
                </div>

                {/* Icon */}
                <div className={`w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0 ${
                  isSelected ? "bg-red-600/10" : "bg-[var(--bg-card)]"
                }`}>
                  {option.icon}
                </div>

                {/* Text */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-primary)] font-semibold text-sm">{option.title}</span>
                    {option.badge && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                        option.badge === "COD"
                          ? "bg-green-900/20 text-green-400"
                          : "bg-red-900/20 text-red-400"
                      }`}>
                        {option.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[var(--text-muted)] text-xs">{option.subtitle}</div>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <div className="text-[var(--text-primary)] font-black">{formatCurrency(amount)}</div>
                  <div className="text-[var(--text-muted)] text-[10px]">
                    {option.id === "COD" ? "on delivery" : "pay now"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* COD notice */}
        {paymentType === "COD" && (
          <div className="mt-4 flex items-start gap-3 bg-green-900/10 border border-green-800/30 rounded-sm p-3">
            <Truck size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-400 text-xs leading-relaxed">
              Your order will be confirmed immediately. Pay <strong>{formatCurrency(cart.grandTotal)}</strong> in cash
              when the order is delivered. COD charges may apply.
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="glass border border-[var(--border-color)] rounded-sm p-6 mb-5">
        <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
          Order Notes <span className="normal-case text-[var(--text-muted)]">(Optional)</span>
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full themed-input rounded-sm px-4 py-3 text-sm outline-none transition-colors resize-none"
          placeholder="Special instructions, delivery preferences..."
        />
      </div>

      {/* Place order */}
      <div className="glass border border-[var(--border-color)] rounded-sm p-6">
        <div className="flex justify-between items-center mb-5">
          <div>
            <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">
              {paymentType === "COD" ? "Amount on Delivery" : "Amount to Pay Now"}
            </div>
            <div className="text-[var(--text-primary)] font-black text-2xl">{formatCurrency(amountDue)}</div>
          </div>
          {paymentType !== "COD" && (
            <div className="text-right">
              <div className="text-[var(--text-muted)] text-xs">via</div>
              <div className="text-[var(--text-primary)] font-bold text-sm">Razorpay</div>
            </div>
          )}
        </div>

        <button
          onClick={handlePlaceOrder}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors text-sm uppercase tracking-wider"
        >
          {loading ? (
            "Processing..."
          ) : paymentType === "COD" ? (
            <>
              <Truck size={16} />
              Confirm COD Order
            </>
          ) : (
            <>
              <CreditCard size={16} />
              {`Pay ${formatCurrency(amountDue)} via Razorpay`}
            </>
          )}
          {!loading && <ChevronRight size={16} />}
        </button>

        <p className="text-[var(--text-muted)] text-xs text-center mt-3">
          {paymentType === "COD"
            ? "Order confirmed instantly. Invoice generated on dispatch."
            : "Secured by Razorpay. Invoice generated after payment."}
        </p>
      </div>
    </div>
  );
}
