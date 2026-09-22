"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight, Truck, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { SchemeBenefitPanel } from "@/components/dealer/scheme-benefit-panel";

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  variantId: string | null;
  isSchemeItem: boolean;
  variant: {
    id: string;
    label: string;
    color: string | null;
    price: number;
    moq: number | null;
  } | null;
  product: {
    id: string;
    name: string;
    sku: string;
    partNumber: string;
    price: number;
    gstRate: number;
    moq: number;
    images: string[];
    category: { name: string };
  };
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [schemeId, setSchemeId] = useState<string | null>(null);
  const [schemeClearedReason, setSchemeClearedReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Network-in-flight marker only — the quantity/removal itself already
  // updates `items` instantly (see updateQuantity/removeItem below). React
  // 18 has no useOptimistic, so this is the manual equivalent: update local
  // state first, sync to the server after, revert on failure.
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchCart = async () => {
    const res = await fetch("/api/cart");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setSchemeId(data.schemeId ?? null);
      setSchemeClearedReason(data.schemeCleared ? data.schemeClearedReason || "Your GST Benefit selection was no longer valid and was removed." : null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCart(); }, []);

  const regularItems = items.filter((i) => !i.isSchemeItem);
  const schemeCartItems = items.filter((i) => i.isSchemeItem);

  // Debounced so a burst of +/- clicks (MOQ-stepped) collapses into one
  // write instead of racing several — the visible quantity already moved
  // (see updateQuantity), this just settles what actually gets persisted.
  // Also reconciles scheme-item side effects (a quantity change can push
  // the cart in/out of scheme eligibility), same as the original fetchCart().
  const syncQuantity = (itemId: string, productId: string, quantity: number, variantId: string | null) => {
    if (debounceRef.current[itemId]) clearTimeout(debounceRef.current[itemId]);
    debounceRef.current[itemId] = setTimeout(async () => {
      delete debounceRef.current[itemId];
      setSyncingId(itemId);
      try {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, quantity, variantId }),
        });
        if (!res.ok) throw new Error("update failed");
      } catch {
        // fall through — reconcile below either way
      } finally {
        startTransition(() => { fetchCart(); });
        setSyncingId(null);
      }
    }, 400);
  };

  const updateQuantity = (itemId: string, productId: string, quantity: number, variantId: string | null) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)));
    syncQuantity(itemId, productId, quantity, variantId);
  };

  const removeItem = async (itemId: string) => {
    if (debounceRef.current[itemId]) { clearTimeout(debounceRef.current[itemId]); delete debounceRef.current[itemId]; }
    const snapshot = items;
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setSyncingId(itemId);
    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) throw new Error("remove failed");
      await fetchCart(); // scheme eligibility can shift on removal too
    } catch {
      setItems(snapshot);
    } finally {
      setSyncingId(null);
    }
  };

  const FREE_DELIVERY_THRESHOLD = 25000;
  const itemPrice = (item: CartItem) => item.variant?.price ?? item.product.price;
  // Scheme (free) items never count toward subtotal/GST/shipping — they're
  // priced at ₹0 on the order, same as at checkout (see /api/orders).
  const subtotal = regularItems.reduce((sum, item) => sum + itemPrice(item) * item.quantity, 0);
  const gstAmount = regularItems.reduce(
    (sum, item) => sum + (itemPrice(item) * item.quantity * item.product.gstRate) / 100,
    0
  );
  const orderTotal = subtotal + gstAmount;
  const shippingCost = orderTotal >= FREE_DELIVERY_THRESHOLD ? 0 : Math.round(orderTotal * 0.05 * 100) / 100;
  const grandTotal = orderTotal + shippingCost;
  const freeDeliveryRemaining = Math.max(0, FREE_DELIVERY_THRESHOLD - orderTotal);
  const freeDeliveryProgress = Math.min(100, (orderTotal / FREE_DELIVERY_THRESHOLD) * 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-[var(--text-muted)]">Loading cart...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Cart</h1>
          <p className="text-[var(--text-muted)] mt-1">{items.length} item{items.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/dealer/products"
          className="text-red-400 text-sm font-semibold hover:text-red-300 transition-colors flex items-center gap-2"
        >
          + Add More Products
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 glass border border-[var(--border-color)] rounded-sm">
          <ShoppingCart size={48} className="text-gray-700 mx-auto mb-4" />
          <h2 className="text-[var(--text-primary)] font-bold text-xl mb-2">Your cart is empty</h2>
          <p className="text-[var(--text-muted)] mb-6">Browse our products and add items to your cart.</p>
          <Link
            href="/dealer/products"
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-sm transition-colors text-sm uppercase tracking-wider inline-flex items-center gap-2"
          >
            Browse Products
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items */}
          <div className="lg:col-span-2 space-y-3">
            {schemeClearedReason && (
              <div className="flex items-start gap-2 glass border border-amber-900/40 rounded-sm p-3 text-xs text-amber-400">
                <Info size={14} className="flex-shrink-0 mt-0.5" />
                {schemeClearedReason}
              </div>
            )}
            {regularItems.map((item) => (
              <div
                key={item.id}
                className="glass border border-[var(--border-color)] rounded-sm p-4 flex items-center gap-4"
              >
                {/* Image */}
                <div className="w-16 h-16 bg-gradient-to-br from-zinc-900 to-black rounded-sm flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.product.images[0] ? (
                    <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-2xl text-red-900/30 font-black">◈</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[var(--text-muted)] text-[10px] font-mono">{item.product.partNumber}</div>
                  <h3 className="text-[var(--text-primary)] font-bold text-sm truncate">{item.product.name}</h3>
                  <div className="text-[var(--text-muted)] text-xs">{item.product.category.name}</div>
                  {item.variant && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {item.variant.color && (
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-white/20 flex-shrink-0"
                          style={{ backgroundColor: item.variant.color.toLowerCase() }}
                        />
                      )}
                      <span className="text-red-400 text-[10px] font-semibold">{item.variant.label}</span>
                    </div>
                  )}
                  <div className="text-red-500 font-bold text-sm mt-1">
                    {formatCurrency(itemPrice(item) * (1 + item.product.gstRate / 100))} /pc
                  </div>
                </div>

                {/* Quantity */}
                <div className="flex items-center glass border border-[var(--border-color)] rounded-sm overflow-hidden">
                  {(() => {
                    const moq = item.variant?.moq ?? item.product.moq;
                    return (
                      <>
                        <button
                          onClick={() => updateQuantity(item.id, item.product.id, Math.max(moq, item.quantity - moq), item.variantId)}
                          className="px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="px-3 text-[var(--text-primary)] text-sm font-bold min-w-[40px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.product.id, item.quantity + moq, item.variantId)}
                          className="px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </>
                    );
                  })()}
                </div>

                {/* Total */}
                <div className="text-right flex-shrink-0 w-24">
                  <div className="text-[var(--text-primary)] font-bold text-sm">
                    {formatCurrency(itemPrice(item) * item.quantity * (1 + item.product.gstRate / 100))}
                  </div>
                  <div className="text-gray-600 text-[10px] flex items-center justify-end gap-1">
                    incl. {item.product.gstRate}% GST
                    {syncingId === item.id && <span className="w-1.5 h-1.5 rounded-full bg-red-500/60 animate-pulse" />}
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-gray-600 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div>
            <div className="glass border border-[var(--border-color)] rounded-sm p-6 sticky top-4">
              <h3 className="text-[var(--text-primary)] font-bold text-lg mb-6">Order Summary</h3>

              <SchemeBenefitPanel
                subtotal={subtotal}
                appliedSchemeId={schemeId}
                schemeItems={schemeCartItems}
                onChanged={fetchCart}
              />

              {/* Free delivery bar */}
              {orderTotal < FREE_DELIVERY_THRESHOLD ? (
                <div className="mb-5 glass border border-[var(--border-color)] rounded-sm p-3">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-[var(--text-muted)]">
                      Add <span className="text-[var(--text-primary)] font-semibold">{formatCurrency(freeDeliveryRemaining)}</span> for free delivery
                    </span>
                    <span className="text-green-500 font-bold">₹25K</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 to-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${freeDeliveryProgress}%` }}
                    />
                  </div>
                  <p className="text-[var(--text-muted)] text-[10px] mt-1.5">
                    Shipping: {formatCurrency(shippingCost)} (5% of order)
                  </p>
                </div>
              ) : (
                <div className="mb-5 flex items-center gap-2 bg-green-900/10 border border-green-900/30 rounded-sm px-3 py-2.5">
                  <Truck size={14} className="text-green-400 flex-shrink-0" />
                  <span className="text-green-400 text-xs font-bold">Free delivery unlocked!</span>
                </div>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Subtotal (excl. GST)</span>
                  <span className="text-[var(--text-primary)] font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">GST</span>
                  <span className="text-[var(--text-primary)] font-semibold">{formatCurrency(gstAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)] flex items-center gap-1">
                    <Truck size={12} />
                    Shipping
                  </span>
                  {shippingCost === 0 ? (
                    <span className="text-green-400 font-semibold text-sm">Free</span>
                  ) : (
                    <span className="text-[var(--text-primary)] font-semibold">{formatCurrency(shippingCost)}</span>
                  )}
                </div>
                <div className="border-t border-[var(--border-color)] pt-3 flex justify-between">
                  <span className="text-[var(--text-primary)] font-bold">Grand Total</span>
                  <span className="text-red-500 font-black text-lg">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <Link
                href="/dealer/checkout"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-sm transition-colors text-sm uppercase tracking-wider text-center block"
              >
                Proceed to Checkout
              </Link>

              <p className="text-gray-600 text-xs text-center mt-4">
                MOQ validation applied. Invoices generated after payment.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
