"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CartItem {
  id: string;
  quantity: number;
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

  const updateQuantity = async (itemId: string, productId: string, quantity: number) => {
    setUpdating(itemId);
    await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity }),
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

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const gstAmount = items.reduce(
    (sum, item) => sum + (item.product.price * item.quantity * item.product.gstRate) / 100,
    0
  );
  const grandTotal = subtotal + gstAmount;

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
        <div className="text-center py-20 glass border border-[var(--border-color)] rounded-xl">
          <ShoppingCart size={48} className="text-gray-700 mx-auto mb-4" />
          <h2 className="text-[var(--text-primary)] font-bold text-xl mb-2">Your cart is empty</h2>
          <p className="text-[var(--text-muted)] mb-6">Browse our products and add items to your cart.</p>
          <Link
            href="/dealer/products"
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-xl transition-colors text-sm uppercase tracking-wider inline-flex items-center gap-2"
          >
            Browse Products
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={`glass border border-[var(--border-color)] rounded-xl p-4 flex items-center gap-4 transition-opacity ${
                  updating === item.id ? "opacity-50" : ""
                }`}
              >
                {/* Image */}
                <div className="w-16 h-16 bg-gradient-to-br from-zinc-900 to-black rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                  <div className="text-red-400 font-bold text-sm mt-1">
                    {formatCurrency(item.product.price)} /pc
                  </div>
                </div>

                {/* Quantity */}
                <div className="flex items-center glass border border-[var(--border-color)] rounded-xl overflow-hidden">
                  <button
                    onClick={() => updateQuantity(item.id, item.product.id, Math.max(item.product.moq, item.quantity - item.product.moq))}
                    disabled={!!updating}
                    className="px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="px-3 text-[var(--text-primary)] text-sm font-bold min-w-[40px] text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, item.product.id, item.quantity + item.product.moq)}
                    disabled={!!updating}
                    className="px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Total */}
                <div className="text-right flex-shrink-0 w-20">
                  <div className="text-[var(--text-primary)] font-bold text-sm">
                    {formatCurrency(item.product.price * item.quantity)}
                  </div>
                  <div className="text-gray-600 text-[10px]">excl. GST</div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeItem(item.id)}
                  disabled={!!updating}
                  className="text-gray-600 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div>
            <div className="glass border border-[var(--border-color)] rounded-xl p-6 sticky top-4">
              <h3 className="text-[var(--text-primary)] font-bold text-lg mb-6">Order Summary</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Subtotal (excl. GST)</span>
                  <span className="text-[var(--text-primary)] font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">GST</span>
                  <span className="text-[var(--text-primary)] font-semibold">{formatCurrency(gstAmount)}</span>
                </div>
                <div className="border-t border-[var(--border-color)] pt-3 flex justify-between">
                  <span className="text-[var(--text-primary)] font-bold">Grand Total</span>
                  <span className="text-red-400 font-black text-lg">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <Link
                href="/dealer/checkout"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors text-sm uppercase tracking-wider text-center block"
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
