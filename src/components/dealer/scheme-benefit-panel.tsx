"use client";

import { useEffect, useState } from "react";
import { Gift, Search, X, Plus, Minus, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface EligibleScheme {
  id: string;
  name: string;
  code: string;
  benefitPercent: number;
  minOrderValue: number;
  maxBenefitValue: number | null;
  benefit: number;
  eligibleCategoryIds: string[];
}

interface SearchProduct {
  id: string;
  name: string;
  partNumber: string;
  price: number;
  category: { id: string; name: string };
}

export interface SchemeCartItem {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  product: { name: string; price: number };
  variant: { label: string; price: number } | null;
}

interface Selection {
  productId: string;
  name: string;
  dealerPrice: number;
  quantity: number;
}

export function SchemeBenefitPanel({
  subtotal,
  appliedSchemeId,
  schemeItems,
  onChanged,
}: {
  /** Regular (non-scheme) cart subtotal, excl. GST — what the scheme's minOrderValue/benefit are judged against. */
  subtotal: number;
  appliedSchemeId: string | null;
  schemeItems: SchemeCartItem[];
  onChanged: () => void;
}) {
  const [eligible, setEligible] = useState<EligibleScheme[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (subtotal <= 0) {
      setEligible([]);
      return;
    }
    fetch(`/api/schemes/eligible?orderValue=${subtotal}`)
      .then((r) => (r.ok ? r.json() : { schemes: [] }))
      .then((data) => setEligible(data.schemes || []))
      .catch(() => setEligible([]));
  }, [subtotal]);

  useEffect(() => {
    if (!pickerOpen || search.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(search)}&pageSize=10`)
        .then((r) => (r.ok ? r.json() : { products: [] }))
        .then((data) => setResults(data.products || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search, pickerOpen]);

  const activeScheme = eligible[0]; // one scheme applies at a time — server picks/validates whichever schemeId is posted
  const selectedTotal = selections.reduce((sum, s) => sum + s.dealerPrice * s.quantity, 0);

  const addSelection = (product: SearchProduct) => {
    setSelections((prev) => {
      const existing = prev.find((s) => s.productId === product.id);
      if (existing) {
        return prev.map((s) => (s.productId === product.id ? { ...s, quantity: s.quantity + 1 } : s));
      }
      return [...prev, { productId: product.id, name: product.name, dealerPrice: product.price, quantity: 1 }];
    });
  };

  const updateSelectionQty = (productId: string, quantity: number) => {
    setSelections((prev) =>
      quantity <= 0 ? prev.filter((s) => s.productId !== productId) : prev.map((s) => (s.productId === productId ? { ...s, quantity } : s))
    );
  };

  const applySelection = async () => {
    if (!activeScheme || selections.length === 0) return;
    setApplying(true);
    setError(null);
    const res = await fetch("/api/cart/scheme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemeId: activeScheme.id,
        items: selections.map((s) => ({ productId: s.productId, quantity: s.quantity })),
      }),
    });
    setApplying(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not apply the scheme — please review your selection.");
      return;
    }
    setPickerOpen(false);
    setSelections([]);
    onChanged();
  };

  const removeScheme = async () => {
    setRemoving(true);
    await fetch("/api/cart/scheme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schemeId: null }),
    });
    setRemoving(false);
    onChanged();
  };

  // Already applied — show the granted items, dealer price struck through, ₹0.
  if (appliedSchemeId && schemeItems.length > 0) {
    return (
      <div className="mb-5 glass border border-green-900/40 rounded-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
            <Gift size={15} />
            GST Benefit Applied
          </div>
          <button
            onClick={removeScheme}
            disabled={removing}
            className="text-[var(--text-muted)] hover:text-red-400 text-xs font-semibold disabled:opacity-50"
          >
            {removing ? "Removing..." : "Remove"}
          </button>
        </div>
        <div className="space-y-2">
          {schemeItems.map((item) => {
            const price = item.variant?.price ?? item.product.price;
            return (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">
                  {item.product.name}
                  {item.variant && ` (${item.variant.label})`} × {item.quantity}
                </span>
                <span>
                  <span className="text-gray-600 line-through mr-2">{formatCurrency(price * item.quantity)}</span>
                  <span className="text-green-400 font-bold">FREE</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!activeScheme) return null;

  return (
    <div className="mb-5 glass border border-amber-900/40 rounded-sm p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
          <Gift size={15} />
          GST Benefit — {formatCurrency(activeScheme.benefit)} ka maal free
        </div>
        {!pickerOpen && (
          <button
            onClick={() => setPickerOpen(true)}
            className="text-amber-400 hover:text-amber-300 text-xs font-bold uppercase tracking-wider"
          >
            Select Items
          </button>
        )}
      </div>

      {pickerOpen && (
        <div className="mt-3 space-y-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search free products by name or part number..."
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-sm pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-600"
            />
            {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] animate-spin" />}
          </div>

          {results.length > 0 && (
            <div className="border border-[var(--border-color)] rounded-sm divide-y divide-[var(--border-color)] max-h-40 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addSelection(p)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] text-left"
                >
                  <span className="text-[var(--text-primary)] truncate">{p.name}</span>
                  <span className="text-[var(--text-muted)] flex-shrink-0 ml-2">{formatCurrency(p.price)}</span>
                </button>
              ))}
            </div>
          )}

          {selections.length > 0 && (
            <div className="space-y-1.5">
              {selections.map((s) => (
                <div key={s.productId} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)] truncate flex-1">{s.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateSelectionQty(s.productId, s.quantity - 1)} className="p-1 text-[var(--text-muted)] hover:text-white">
                      <Minus size={11} />
                    </button>
                    <span className="w-5 text-center text-[var(--text-primary)] font-semibold">{s.quantity}</span>
                    <button onClick={() => updateSelectionQty(s.productId, s.quantity + 1)} className="p-1 text-[var(--text-muted)] hover:text-white">
                      <Plus size={11} />
                    </button>
                    <button onClick={() => updateSelectionQty(s.productId, 0)} className="p-1 text-[var(--text-muted)] hover:text-red-400">
                      <X size={11} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-xs pt-1.5 border-t border-[var(--border-color)]">
                <span className="text-[var(--text-muted)]">Selected</span>
                <span className={selectedTotal > activeScheme.benefit ? "text-red-400 font-bold" : "text-green-400 font-bold"}>
                  {formatCurrency(selectedTotal)} / {formatCurrency(activeScheme.benefit)}
                </span>
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={applySelection}
              disabled={applying || selections.length === 0 || selectedTotal > activeScheme.benefit}
              className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-2 rounded-sm text-xs uppercase tracking-wider"
            >
              {applying ? "Applying..." : "Apply Free Items"}
            </button>
            <button
              onClick={() => { setPickerOpen(false); setSelections([]); setError(null); }}
              className="px-4 text-[var(--text-muted)] hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
