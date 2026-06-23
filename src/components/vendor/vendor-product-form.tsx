"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

interface Category { id: string; name: string; }
interface Props {
  categories: Category[];
  defaultMarkup: number;
}

const INPUT = "w-full themed-input border focus:border-amber-500/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors";
const LABEL = "text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2";
const SECTION = "glass-dark border border-[var(--border-color)] rounded-xl p-6 space-y-4";
const SECTION_TITLE = "text-[var(--text-secondary)] text-xs uppercase tracking-widest font-bold mb-4 flex items-center gap-2";

const WARRANTY_OPTIONS = ["No Warranty", "3 Months", "6 Months", "12 Months"];
const GST_OPTIONS = [0, 5, 12, 18, 28];

export function VendorProductForm({ categories, defaultMarkup }: Props) {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    sku: "",
    partNumber: "",
    description: "",
    categoryId: "",
    vendorCostPrice: "",
    gstRate: "18",
    hsnCode: "",
    moq: "1",
    brand: "",
    oemNumber: "",
    warranty: "No Warranty",
    countryOfOrigin: "India",
    packageWeight: "",
    packageLength: "",
    packageWidth: "",
    packageHeight: "",
    compatibility: "",
  });

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const computedPrice = form.vendorCostPrice
    ? (parseFloat(form.vendorCostPrice) * (1 + defaultMarkup / 100)).toFixed(2)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const payload = {
      name: form.name,
      sku: form.sku,
      partNumber: form.partNumber,
      description: form.description || undefined,
      categoryId: form.categoryId,
      vendorCostPrice: parseFloat(form.vendorCostPrice),
      gstRate: parseFloat(form.gstRate),
      hsnCode: form.hsnCode || undefined,
      moq: parseInt(form.moq),
      brand: form.brand || undefined,
      oemNumber: form.oemNumber || undefined,
      warranty: form.warranty,
      countryOfOrigin: form.countryOfOrigin,
      packageWeight: form.packageWeight ? parseFloat(form.packageWeight) : undefined,
      packageLength: form.packageLength ? parseFloat(form.packageLength) : undefined,
      packageWidth: form.packageWidth ? parseFloat(form.packageWidth) : undefined,
      packageHeight: form.packageHeight ? parseFloat(form.packageHeight) : undefined,
      compatibility: form.compatibility.split(",").map((s) => s.trim()).filter(Boolean),
    };

    const res = await fetch("/api/vendor/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      setErrorMsg(err.error || "Failed to submit product");
      setStatus("error");
      return;
    }

    setStatus("success");
    router.push("/vendor/products");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className={SECTION}>
        <div className={SECTION_TITLE}>
          <span className="w-1 h-4 bg-amber-500 rounded-full inline-block" />
          Basic Information
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Product Name <span className="text-red-500">*</span></label>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={INPUT} placeholder="Full product name" />
          </div>
          <div>
            <label className={LABEL}>Category <span className="text-red-500">*</span></label>
            <select required value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={INPUT}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>SKU <span className="text-red-500">*</span></label>
            <input required value={form.sku} onChange={(e) => set("sku", e.target.value)} className={INPUT} placeholder="e.g. BRK-001" />
          </div>
          <div>
            <label className={LABEL}>Part Number <span className="text-red-500">*</span></label>
            <input required value={form.partNumber} onChange={(e) => set("partNumber", e.target.value)} className={INPUT} placeholder="OEM Part Number" />
          </div>
        </div>
        <div>
          <label className={LABEL}>Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} className={INPUT + " resize-none"} placeholder="Product description..." />
        </div>
      </div>

      {/* Pricing */}
      <div className={SECTION}>
        <div className={SECTION_TITLE}>
          <span className="w-1 h-4 bg-amber-500 rounded-full inline-block" />
          Your Cost Price
        </div>
        <div className="flex items-start gap-3 glass border border-amber-900/30 rounded-xl px-4 py-3 mb-4">
          <Info size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-[var(--text-muted)] text-xs leading-relaxed">
            Enter your cost price. Our team will apply a markup of <span className="text-amber-400 font-bold">{defaultMarkup}%</span> to determine the final dealer price.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={LABEL}>Your Cost Price (₹) <span className="text-red-500">*</span></label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={form.vendorCostPrice}
              onChange={(e) => set("vendorCostPrice", e.target.value)}
              className={INPUT}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className={LABEL}>Markup Applied</label>
            <div className="themed-input border rounded-xl px-4 py-3 text-sm text-amber-400 font-bold bg-amber-900/10">
              +{defaultMarkup}%
            </div>
            <p className="text-[var(--text-muted)] text-[10px] mt-1">Set by MotoXPlus</p>
          </div>
          <div>
            <label className={LABEL}>Base Dealer Price (excl. GST)</label>
            <div className="themed-input border rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-black">
              {computedPrice ? `₹${parseFloat(computedPrice).toLocaleString("en-IN")}` : "—"}
            </div>
            <p className="text-[var(--text-muted)] text-[10px] mt-1">Before GST is added</p>
          </div>
          <div>
            <label className={LABEL}>Dealer Pays (incl. GST)</label>
            <div className="themed-input border rounded-xl px-4 py-3 text-sm text-green-400 font-black">
              {computedPrice && form.gstRate
                ? `₹${(parseFloat(computedPrice) * (1 + parseFloat(form.gstRate) / 100)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                : "—"}
            </div>
            <p className="text-[var(--text-muted)] text-[10px] mt-1">What dealer actually pays</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>GST Rate (%)</label>
            <select value={form.gstRate} onChange={(e) => set("gstRate", e.target.value)} className={INPUT}>
              {GST_OPTIONS.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>HSN Code</label>
            <input
              value={form.hsnCode}
              onChange={(e) => set("hsnCode", e.target.value.replace(/\D/g, "").slice(0, 8))}
              className={INPUT}
              placeholder="87141090"
              maxLength={8}
            />
          </div>
        </div>
      </div>

      {/* Product Details */}
      <div className={SECTION}>
        <div className={SECTION_TITLE}>
          <span className="w-1 h-4 bg-amber-500 rounded-full inline-block" />
          Product Details
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Brand</label>
            <input value={form.brand} onChange={(e) => set("brand", e.target.value)} className={INPUT} placeholder="Brand name" />
          </div>
          <div>
            <label className={LABEL}>OEM Number</label>
            <input value={form.oemNumber} onChange={(e) => set("oemNumber", e.target.value)} className={INPUT} placeholder="OEM reference" />
          </div>
          <div>
            <label className={LABEL}>Warranty</label>
            <select value={form.warranty} onChange={(e) => set("warranty", e.target.value)} className={INPUT}>
              {WARRANTY_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>MOQ (Min Order Qty)</label>
            <input type="number" min="1" value={form.moq} onChange={(e) => set("moq", e.target.value)} className={INPUT} placeholder="1" />
          </div>
          <div>
            <label className={LABEL}>Country of Origin</label>
            <input value={form.countryOfOrigin} onChange={(e) => set("countryOfOrigin", e.target.value)} className={INPUT} placeholder="India" />
          </div>
        </div>
        <div>
          <label className={LABEL}>Compatible Vehicles (comma-separated)</label>
          <input
            value={form.compatibility}
            onChange={(e) => set("compatibility", e.target.value)}
            className={INPUT}
            placeholder="Honda Activa, TVS Jupiter"
          />
        </div>
      </div>

      {/* Packaging */}
      <div className={SECTION}>
        <div className={SECTION_TITLE}>
          <span className="w-1 h-4 bg-amber-500 rounded-full inline-block" />
          Packaging &amp; Dimensions
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={LABEL}>Weight (kg)</label>
            <input type="number" step="0.001" min="0" value={form.packageWeight} onChange={(e) => set("packageWeight", e.target.value)} className={INPUT} placeholder="0.500" />
          </div>
          <div>
            <label className={LABEL}>Length (cm)</label>
            <input type="number" step="0.1" min="0" value={form.packageLength} onChange={(e) => set("packageLength", e.target.value)} className={INPUT} placeholder="20.0" />
          </div>
          <div>
            <label className={LABEL}>Width (cm)</label>
            <input type="number" step="0.1" min="0" value={form.packageWidth} onChange={(e) => set("packageWidth", e.target.value)} className={INPUT} placeholder="15.0" />
          </div>
          <div>
            <label className={LABEL}>Height (cm)</label>
            <input type="number" step="0.1" min="0" value={form.packageHeight} onChange={(e) => set("packageHeight", e.target.value)} className={INPUT} placeholder="5.0" />
          </div>
        </div>
      </div>

      {status === "error" && (
        <div className="bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
        >
          {status === "loading" ? "Submitting..." : "Submit Product for Review"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="glass border border-[var(--border-color)] text-[var(--text-secondary)] font-bold px-6 py-3 rounded-xl transition-colors text-sm hover:border-amber-900/40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
