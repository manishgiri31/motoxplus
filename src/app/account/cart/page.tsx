"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, Truck } from "lucide-react";
import { formatCurrency, roundToPaise } from "@/lib/utils";
import { computeOrderPricing } from "@/lib/pricing/compute";
import { computeShippingQuote } from "@/lib/shipping/quote";

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  variantId: string | null;
  variant: { id: string; label: string; color: string | null; mrp: number | null; stock: number } | null;
  product: {
    id: string;
    name: string;
    partNumber: string;
    mrp: number | null;
    gstRate: number;
    images: string[];
    category: { name: string };
  };
}

// B2C cart — deliberately simpler than the dealer cart (no scheme panel, no
// MOQ stepping, one price per item: MRP, GST-inclusive). See
// B2C-EXPANSION-PLAN.md Phase 2.
export default function AccountCartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchCart = async () => {
    const res = await fetch("/api/cart");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCart(); }, []);

  const updateQuantity = async (itemId: string, productId: string, quantity: number, variantId: string | null) => {
    if (quantity < 1) return;
    setUpdating(itemId);
    await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity, variantId }),
    });
    await fetchCart();
    setUpdating(null);
  };

  const removeItem = async (itemId: string) => {
    setUpdating(itemId);
    await fetch("/api/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    await fetchCart();
    setUpdating(null);
  };

  const itemMrp = (item: CartItem) => item.variant?.mrp ?? item.product.mrp;

  // Same computeOrderPricing() the server uses at checkout (see /api/orders)
  // — per-line rounding, order totals derived from the already-rounded
  // lines, so this preview can't drift from what's actually charged.
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
  const unpriced = items.filter((item) => itemMrp(item) == null);

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
        <Link href="/products" className="text-red-400 text-sm font-semibold hover:text-red-300 transition-colors flex items-center gap-2">
          + Add More Products
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 glass border border-[var(--border-color)] rounded-sm">
          <ShoppingCart size={48} className="text-gray-700 mx-auto mb-4" />
          <h2 className="text-[var(--text-primary)] font-bold text-xl mb-2">Your cart is empty</h2>
          <p className="text-[var(--text-muted)] mb-6">Browse our products and add items to your cart.</p>
          <Link
            href="/products"
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-sm transition-colors text-sm uppercase tracking-wider inline-flex items-center gap-2"
          >
            Browse Products <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {unpriced.length > 0 && (
              <div className="text-xs text-amber-400 bg-amber-900/10 border border-amber-900/30 rounded-sm p-3">
                Some items in your cart are no longer available for retail purchase — remove them to check out.
              </div>
            )}
            {items.map((item) => {
              const mrp = itemMrp(item);
              return (
                <div
                  key={item.id}
                  className={`glass border border-[var(--border-color)] rounded-sm p-4 flex items-center gap-4 transition-opacity ${updating === item.id ? "opacity-50" : ""}`}
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-zinc-900 to-black rounded-sm flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.product.images[0] ? (
                      <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-2xl text-red-900/30 font-black">◈</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[var(--text-muted)] text-[10px] font-mono">{item.product.partNumber}</div>
                    <h3 className="text-[var(--text-primary)] font-bold text-sm truncate">{item.product.name}</h3>
                    <div className="text-[var(--text-muted)] text-xs">{item.product.category.name}</div>
                    {item.variant && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {item.variant.color && (
                          <span className="w-2.5 h-2.5 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: item.variant.color.toLowerCase() }} />
                        )}
                        <span className="text-red-400 text-[10px] font-semibold">{item.variant.label}</span>
                      </div>
                    )}
                    <div className="text-red-500 font-bold text-sm mt-1">
                      {mrp != null ? `${formatCurrency(mrp)} /pc` : "Not available for retail"}
                    </div>
                  </div>

                  <div className="flex items-center glass border border-[var(--border-color)] rounded-sm overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.id, item.productId, item.quantity - 1, item.variantId)}
                      disabled={!!updating || item.quantity <= 1}
                      className="px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-30"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="px-3 text-[var(--text-primary)] text-sm font-bold min-w-[40px] text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.productId, item.quantity + 1, item.variantId)}
                      disabled={!!updating}
                      className="px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div className="text-right flex-shrink-0 w-24">
                    <div className="text-[var(--text-primary)] font-bold text-sm">{mrp != null ? formatCurrency(mrp * item.quantity) : "—"}</div>
                    <div className="text-gray-600 text-[10px]">incl. taxes</div>
                  </div>

                  <button onClick={() => removeItem(item.id)} disabled={!!updating} className="text-gray-600 hover:text-red-500 transition-colors p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          <div>
            <div className="glass border border-[var(--border-color)] rounded-sm p-6 sticky top-4">
              <h3 className="text-[var(--text-primary)] font-bold text-lg mb-6">Order Summary</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)] flex items-center gap-1"><Truck size={12} /> Shipping</span>
                  {shippingCost === 0 ? (
                    <span className="text-green-400 font-semibold text-sm">Free</span>
                  ) : (
                    <span className="text-[var(--text-primary)] font-semibold text-sm">{formatCurrency(shippingCost)}</span>
                  )}
                </div>
                <div className="flex justify-between font-bold pt-3 border-t border-[var(--border-color)]">
                  <span className="text-[var(--text-primary)]">Grand Total</span>
                  <span className="text-red-500 text-lg">{formatCurrency(grandTotal)}</span>
                </div>
                <p className="text-[var(--text-muted)] text-[10px]">Inclusive of all taxes.</p>
              </div>
              <Link
                href="/account/checkout"
                aria-disabled={unpriced.length > 0}
                className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-sm transition-colors text-sm uppercase tracking-wider ${
                  unpriced.length > 0 ? "bg-[var(--line)] text-[var(--muted)] pointer-events-none" : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                Proceed to Checkout <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
