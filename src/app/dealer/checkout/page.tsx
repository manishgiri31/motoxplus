"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Truck, CreditCard, ChevronRight, User, Phone, MapPin, Smartphone } from "lucide-react";
import { PincodeChecker } from "@/components/shipping/pincode-checker";
import { ShippingEstimate } from "@/components/shipping/shipping-estimate";
import { Spinner } from "@/components/ui/spinner";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type PaymentType = "ADVANCE_20" | "FULL_100" | "COD" | "DIRECT_UPI";

interface CartItem {
  product: {
    name: string;
    price: number;
    gstRate: number;
    packageWeight?: number | null;
    weight?: number | null;
  };
  quantity: number;
}

interface CartSummary {
  subtotal: number;
  gstAmount: number;
  items: CartItem[];
}

interface ServiceabilityResult {
  serviceable: boolean;
  estimatedDeliveryDays: number | null;
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

const ALL_PAYMENT_OPTIONS = [
  {
    id: "DIRECT_UPI" as PaymentType,
    title: "Direct UPI / Bank Transfer",
    subtitle: "Pay via UPI QR or NEFT/IMPS — instant verification",
    icon: <Smartphone size={18} className="text-purple-400" />,
    badge: "Recommended",
    requiresUpi: true,
  },
  {
    id: "FULL_100" as PaymentType,
    title: "Full Payment via Razorpay",
    subtitle: "Pay 100% now via cards, netbanking, UPI",
    icon: <CreditCard size={18} className="text-red-500" />,
    badge: null,
    requiresUpi: false,
  },
  {
    id: "ADVANCE_20" as PaymentType,
    title: "20% Advance via Razorpay",
    subtitle: "Pay 20% now, balance before delivery",
    icon: <CreditCard size={18} className="text-blue-400" />,
    badge: null,
    requiresUpi: false,
  },
  {
    id: "COD" as PaymentType,
    title: "Cash on Delivery",
    subtitle: "Pay full amount when order is delivered",
    icon: <Truck size={18} className="text-green-400" />,
    badge: "COD",
    requiresUpi: false,
  },
];

function calculateCartWeight(items: CartItem[]): number {
  let total = 0;
  for (const item of items) {
    const w = item.product.packageWeight ?? item.product.weight ?? 0.5;
    total += w * item.quantity;
  }
  return Math.max(0.5, total);
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("FULL_100");
  const [upiEnabled, setUpiEnabled] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(true);
  const [serviceabilityResult, setServiceabilityResult] = useState<ServiceabilityResult | null>(null);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [shippingLoading, setShippingLoading] = useState(false);

  const [delivery, setDelivery] = useState<DeliveryForm>({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const updateDelivery = (field: keyof DeliveryForm, value: string) => {
    setDelivery((prev) => ({ ...prev, [field]: value }));
  };

  // Pre-fill dealer profile
  useEffect(() => {
    fetch("/api/dealer/account")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setDelivery((prev) => ({
            ...prev,
            name: prev.name || data.ownerName || "",
            phone: prev.phone || data.phone || "",
            address: prev.address || data.address || "",
            city: prev.city || data.city || "",
            state: prev.state || data.state || "",
            pincode: prev.pincode || data.pincode || "",
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch cart + UPI settings in parallel
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
          setCart({ subtotal, gstAmount, items: data.items });
        }
        setCartLoading(false);
      });

    fetch("/api/admin/settings/upi")
      .then((r) => r.json())
      .then((data) => {
        const enabled = data.upiEnabled !== false;
        setUpiEnabled(enabled);
        if (enabled) setPaymentType("DIRECT_UPI");
      })
      .catch(() => {});

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    document.body.appendChild(script);
  }, []);

  // Fetch shipping cost when pincode + serviceability + cart ready
  const fetchShippingCost = useCallback(async () => {
    if (!cart || !delivery.pincode || !serviceabilityResult?.serviceable) {
      setShippingCost(0);
      return;
    }
    setShippingLoading(true);
    try {
      const weightKg = calculateCartWeight(cart.items);
      const isCOD = paymentType === "COD";
      const res = await fetch("/api/shipping/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationPincode: delivery.pincode,
          weightKg,
          paymentMode: isCOD ? "COD" : "Prepaid",
          codAmount: isCOD ? (cart.subtotal + cart.gstAmount) : undefined,
        }),
      });
      const data = await res.json();
      setShippingCost(data.shippingCost ?? 0);
    } catch {
      setShippingCost(0);
    } finally {
      setShippingLoading(false);
    }
  }, [cart, delivery.pincode, serviceabilityResult, paymentType]);

  useEffect(() => {
    fetchShippingCost();
  }, [fetchShippingCost]);

  const handleServiceabilityResult = (result: ServiceabilityResult | null) => {
    setServiceabilityResult(result);
    // Auto-fill city/state from serviceability result
    if (result?.city && !delivery.city) updateDelivery("city", result.city);
    if (result?.state && !delivery.state) updateDelivery("state", result.state);
  };

  const grandTotal = (cart?.subtotal ?? 0) + (cart?.gstAmount ?? 0) + shippingCost;
  const amountDue =
    paymentType === "ADVANCE_20" ? grandTotal * 0.2 :
    paymentType === "DIRECT_UPI" ? grandTotal : grandTotal;

  const isDeliveryComplete =
    delivery.name && delivery.phone && delivery.address &&
    delivery.city && delivery.state && delivery.pincode.length === 6;

  const buildOrderPayload = () => ({
    paymentType,
    notes,
    deliveryName: delivery.name,
    deliveryPhone: delivery.phone,
    deliveryAddress: delivery.address,
    deliveryCity: delivery.city,
    deliveryState: delivery.state,
    deliveryPincode: delivery.pincode,
    clientShippingCost: shippingCost,
  });

  const handleCOD = async () => {
    setLoading(true);
    const orderRes = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...buildOrderPayload(), paymentType: "COD" }),
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
        body: JSON.stringify(buildOrderPayload()),
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

  const handleDirectUpi = async () => {
    setLoading(true);
    const orderRes = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...buildOrderPayload(), paymentType: "FULL_100" }),
    });
    if (!orderRes.ok) {
      const err = await orderRes.json();
      alert(err.error || "Failed to create order");
      setLoading(false);
      return;
    }
    const { order } = await orderRes.json();
    router.push(`/dealer/orders/${order.id}/pay-upi`);
  };

  const handlePlaceOrder = () => {
    if (!isDeliveryComplete) {
      alert("Please complete all delivery address fields.");
      return;
    }
    if (paymentType === "COD") handleCOD();
    else if (paymentType === "DIRECT_UPI") handleDirectUpi();
    else handleOnlinePayment();
  };

  if (cartLoading) {
    return (
      <div className="flex items-center justify-center gap-3 h-64 text-[var(--text-muted)]">
        <Spinner size={20} />
        <span className="text-sm">Loading cart...</span>
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
        <p className="text-[var(--text-muted)] mt-1">Enter delivery details and choose how to pay.</p>
      </div>

      {/* Delivery Address */}
      <div className="glass border border-[var(--border-color)] rounded-sm p-6 mb-5">
        <h3 className="text-[var(--text-primary)] font-bold mb-5">Delivery Address</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={delivery.name}
                  onChange={(e) => updateDelivery("name", e.target.value)}
                  placeholder="Recipient name"
                  className="w-full themed-input rounded-sm pl-9 pr-4 py-3 text-sm outline-none transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
                Phone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="tel"
                  value={delivery.phone}
                  onChange={(e) => updateDelivery("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile"
                  className="w-full themed-input rounded-sm pl-9 pr-4 py-3 text-sm outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
              Street Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-3 text-[var(--text-muted)]" />
              <textarea
                rows={2}
                value={delivery.address}
                onChange={(e) => updateDelivery("address", e.target.value)}
                placeholder="House/Shop No., Street, Area"
                className="w-full themed-input rounded-sm pl-9 pr-4 py-3 text-sm outline-none transition-colors resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={delivery.city}
                onChange={(e) => updateDelivery("city", e.target.value)}
                placeholder="City"
                className="w-full themed-input rounded-sm px-4 py-3 text-sm outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={delivery.state}
                onChange={(e) => updateDelivery("state", e.target.value)}
                placeholder="State"
                className="w-full themed-input rounded-sm px-4 py-3 text-sm outline-none transition-colors"
              />
            </div>
          </div>

          <PincodeChecker
            value={delivery.pincode}
            onChange={(v) => updateDelivery("pincode", v)}
            onResult={handleServiceabilityResult}
          />
        </div>
      </div>

      {/* Order summary */}
      <div className="glass border border-[var(--border-color)] rounded-sm p-6 mb-5">
        <h3 className="text-[var(--text-primary)] font-bold mb-4">Order Summary</h3>
        <div className="space-y-2 mb-4">
          {cart.items.map((item: any, i: number) => (
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
          <ShippingEstimate
            shippingCost={shippingCost}
            estimatedDays={serviceabilityResult?.estimatedDeliveryDays ?? null}
            loading={shippingLoading}
          />
          <div className="flex justify-between font-bold pt-1 border-t border-[var(--border-color)]">
            <span className="text-[var(--text-primary)]">Grand Total</span>
            <span className="text-red-500 text-lg">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Payment options */}
      <div className="glass border border-[var(--border-color)] rounded-sm p-6 mb-5">
        <h3 className="text-[var(--text-primary)] font-bold mb-5">Payment Method</h3>
        <div className="space-y-3">
          {ALL_PAYMENT_OPTIONS.filter((o) => !o.requiresUpi || upiEnabled).map((option) => {
            const isSelected = paymentType === option.id;
            const amount = option.id === "ADVANCE_20" ? grandTotal * 0.2 : grandTotal;

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
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? "border-red-600" : "border-[var(--text-muted)]"}`}>
                  {isSelected && <div className="w-2 h-2 bg-red-600 rounded-full" />}
                </div>
                <div className={`w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-red-600/10" : "bg-[var(--bg-card)]"}`}>
                  {option.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-primary)] font-semibold text-sm">{option.title}</span>
                    {option.badge && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${option.badge === "COD" ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>
                        {option.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[var(--text-muted)] text-xs">{option.subtitle}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[var(--text-primary)] font-black">{formatCurrency(amount)}</div>
                  <div className="text-[var(--text-muted)] text-[10px]">{option.id === "COD" ? "on delivery" : "pay now"}</div>
                </div>
              </button>
            );
          })}
        </div>

        {paymentType === "COD" && (
          <div className="mt-4 flex items-start gap-3 bg-green-900/10 border border-green-800/30 rounded-sm p-3">
            <Truck size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-400 text-xs leading-relaxed">
              Your order will be confirmed immediately. Pay <strong>{formatCurrency(grandTotal)}</strong> in cash when delivered.
            </p>
          </div>
        )}
        {paymentType === "DIRECT_UPI" && (
          <div className="mt-4 flex items-start gap-3 bg-purple-900/10 border border-purple-800/30 rounded-sm p-3">
            <Smartphone size={16} className="text-purple-400 flex-shrink-0 mt-0.5" />
            <p className="text-purple-300 text-xs leading-relaxed">
              Your order will be created and you'll be redirected to pay via UPI QR or bank transfer. Verification takes 1–2 business hours.
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

        {serviceabilityResult && !serviceabilityResult.serviceable && (
          <div className="mb-4 flex items-center gap-2 bg-yellow-900/10 border border-yellow-800/30 rounded-sm px-3 py-2 text-yellow-400 text-xs">
            Pincode <strong>{delivery.pincode}</strong> may be outside standard courier coverage. Your order will still be placed and our team will arrange delivery.
          </div>
        )}

        <button
          onClick={handlePlaceOrder}
          disabled={loading || !isDeliveryComplete || shippingLoading}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-sm transition-colors text-sm uppercase tracking-wider"
        >
          {loading ? (
            <><Spinner size={16} />Processing...</>
          ) : paymentType === "COD" ? (
            <><Truck size={16} />Confirm COD Order<ChevronRight size={16} /></>
          ) : paymentType === "DIRECT_UPI" ? (
            <><Smartphone size={16} />Place Order & Pay via UPI<ChevronRight size={16} /></>
          ) : (
            <><CreditCard size={16} />{`Pay ${formatCurrency(amountDue)} via Razorpay`}<ChevronRight size={16} /></>
          )}
        </button>

        <p className="text-[var(--text-muted)] text-xs text-center mt-3">
          {paymentType === "COD"
            ? "Order confirmed instantly. Shipment created via Delhivery."
            : paymentType === "DIRECT_UPI"
            ? "No extra charges. Pay directly to MotoXPlus bank account."
            : "Secured by Razorpay. Shipment created after payment."}
        </p>
      </div>
    </div>
  );
}
