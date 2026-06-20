"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductImageUploader, ImageUploaderRef } from "@/components/admin/product-image-uploader";

interface Category { id: string; name: string; }
interface Props {
  categories: Category[];
  product?: any;
}

const INPUT = "w-full themed-input border focus:border-red-600/60 rounded-xl px-4 py-3 text-sm outline-none transition-colors";
const LABEL = "text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2";
const SECTION = "glass-dark border border-[var(--border-color)] rounded-xl p-6 space-y-4";
const SECTION_TITLE = "text-[var(--text-secondary)] text-xs uppercase tracking-widest font-bold mb-4 flex items-center gap-2";

const WARRANTY_OPTIONS = ["No Warranty", "3 Months", "6 Months", "12 Months"];
const GST_OPTIONS = [0, 5, 12, 18, 28];

export function ProductForm({ categories, product }: Props) {
  const router = useRouter();
  const isEdit = !!product;
  const imgRef = useRef<ImageUploaderRef>(null);

  const isVendorProduct = !!(product as any)?.vendorId;
  const vendorCostPrice = (product as any)?.vendorCostPrice ?? null;

  const [form, setForm] = useState({
    // Basic
    name: product?.name || "",
    sku: product?.sku || "",
    partNumber: product?.partNumber || "",
    description: product?.description || "",
    categoryId: product?.categoryId || "",
    isActive: product?.isActive ?? true,
    // Pricing & Tax
    price: product?.price?.toString() || "",
    mrp: (product as any)?.mrp?.toString() || "",
    markupPercent: (product as any)?.markupPercent?.toString() || "",
    gstRate: product?.gstRate?.toString() || "18",
    hsnCode: product?.hsnCode || "",
    // Inventory
    moq: product?.moq?.toString() || "1",
    stock: product?.stock?.toString() || "0",
    // Product Identity
    brand: product?.brand || "MOTOXPLUS",
    oemNumber: product?.oemNumber || "",
    warranty: product?.warranty || "No Warranty",
    countryOfOrigin: product?.countryOfOrigin || "India",
    // Packaging
    packageWeight: product?.packageWeight?.toString() || "",
    packageLength: product?.packageLength?.toString() || "",
    packageWidth: product?.packageWidth?.toString() || "",
    packageHeight: product?.packageHeight?.toString() || "",
    // Compatibility
    compatibility: product?.compatibility?.join(", ") || "",
  });

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uploaderImages = imgRef.current?.getImages() ?? [];
    const uploadingAny = uploaderImages.some((i: any) => i.status === "uploading");
    if (uploadingAny) {
      setErrorMsg("Please wait for all images to finish uploading.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    const productImages = (imgRef.current?.getImages() ?? []).map((img: any, i: number) => ({
      id: img.id,
      url: img.url,
      key: img.key,
      isPrimary: img.isPrimary,
      sortOrder: i,
    }));
    const deletedImageKeys = imgRef.current?.getDeletedKeys() ?? [];

    const payload = {
      name: form.name,
      sku: form.sku,
      partNumber: form.partNumber,
      description: form.description || undefined,
      categoryId: form.categoryId,
      isActive: form.isActive,
      price: parseFloat(form.price),
      mrp: form.mrp ? parseFloat(form.mrp) : undefined,
      markupPercent: form.markupPercent ? parseFloat(form.markupPercent) : undefined,
      gstRate: parseFloat(form.gstRate),
      hsnCode: form.hsnCode,
      moq: parseInt(form.moq),
      stock: parseInt(form.stock),
      brand: form.brand,
      oemNumber: form.oemNumber || undefined,
      warranty: form.warranty,
      countryOfOrigin: form.countryOfOrigin,
      packageWeight: parseFloat(form.packageWeight),
      packageLength: parseFloat(form.packageLength),
      packageWidth: parseFloat(form.packageWidth),
      packageHeight: parseFloat(form.packageHeight),
      compatibility: form.compatibility.split(",").map((s: string) => s.trim()).filter(Boolean),
      images: [],
      productImages,
      deletedImageKeys,
    };

    const url = isEdit ? `/api/products/${product.id}` : "/api/products";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      setErrorMsg(err.error || (err.details ? JSON.stringify(err.details) : "Failed to save product"));
      setStatus("error");
      return;
    }

    setStatus("success");
    router.push("/admin/products");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Basic Information ── */}
      <div className={SECTION}>
        <div className={SECTION_TITLE}>
          <span className="w-1 h-4 bg-red-600 rounded-full inline-block" />
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
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className={INPUT + " resize-none"}
            placeholder="Product description..."
          />
        </div>
      </div>

      {/* ── Pricing & Tax ── */}
      <div className={SECTION}>
        <div className={SECTION_TITLE}>
          <span className="w-1 h-4 bg-red-600 rounded-full inline-block" />
          Pricing &amp; Tax
        </div>

        {/* Vendor product: show cost + markup controls */}
        {isVendorProduct && vendorCostPrice != null && (
          <div className="glass border border-amber-900/30 rounded-xl p-4 mb-4">
            <div className="text-[10px] uppercase tracking-widest text-amber-500 font-bold mb-3">Vendor Submission</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[var(--text-muted)] text-xs mb-1">Vendor Cost Price</div>
                <div className="text-amber-400 font-black text-lg">₹{vendorCostPrice.toLocaleString("en-IN")}</div>
              </div>
              <div>
                <label className={LABEL}>Markup (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.markupPercent}
                  onChange={(e) => {
                    set("markupPercent", e.target.value);
                    if (e.target.value && vendorCostPrice) {
                      const computed = (vendorCostPrice * (1 + parseFloat(e.target.value) / 100)).toFixed(2);
                      set("price", computed);
                    }
                  }}
                  className={INPUT}
                  placeholder="20"
                />
                <p className="text-[var(--text-muted)] text-[10px] mt-1">Auto-updates dealer price</p>
              </div>
              <div>
                <div className="text-[var(--text-muted)] text-xs mb-1">Computed Dealer Price</div>
                <div className="text-[var(--text-primary)] font-black text-lg">
                  {form.markupPercent && vendorCostPrice
                    ? `₹${(vendorCostPrice * (1 + parseFloat(form.markupPercent) / 100)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                    : form.price ? `₹${parseFloat(form.price).toLocaleString("en-IN")}` : "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={LABEL}>Dealer Price (₹) <span className="text-red-500">*</span></label>
            <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} className={INPUT} placeholder="0.00" />
            <p className="text-[var(--text-muted)] text-[10px] mt-1">Shown only to approved dealers</p>
          </div>
          <div>
            <label className={LABEL}>MRP / Retail Price (₹)</label>
            <input type="number" step="0.01" min="0" value={form.mrp} onChange={(e) => set("mrp", e.target.value)} className={INPUT} placeholder="0.00" />
            <p className="text-[var(--text-muted)] text-[10px] mt-1">Shown to public visitors</p>
          </div>
          <div>
            <label className={LABEL}>GST Rate (%) <span className="text-red-500">*</span></label>
            <select required value={form.gstRate} onChange={(e) => set("gstRate", e.target.value)} className={INPUT}>
              {GST_OPTIONS.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>HSN Code <span className="text-red-500">*</span></label>
            <input
              required
              value={form.hsnCode}
              onChange={(e) => set("hsnCode", e.target.value.replace(/\D/g, "").slice(0, 8))}
              className={INPUT}
              placeholder="87141090"
              maxLength={8}
              pattern="\d{8}"
              title="Exactly 8 digits required"
            />
          </div>
        </div>
      </div>

      {/* ── Inventory ── */}
      <div className={SECTION}>
        <div className={SECTION_TITLE}>
          <span className="w-1 h-4 bg-red-600 rounded-full inline-block" />
          Inventory
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>MOQ (Min Order Qty) <span className="text-red-500">*</span></label>
            <input required type="number" min="1" value={form.moq} onChange={(e) => set("moq", e.target.value)} className={INPUT} placeholder="1" />
          </div>
          <div>
            <label className={LABEL}>Stock Quantity <span className="text-red-500">*</span></label>
            <input required type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} className={INPUT} placeholder="0" />
          </div>
        </div>
      </div>

      {/* ── Product Identity ── */}
      <div className={SECTION}>
        <div className={SECTION_TITLE}>
          <span className="w-1 h-4 bg-red-600 rounded-full inline-block" />
          Product Identity
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Brand <span className="text-red-500">*</span></label>
            <input required value={form.brand} onChange={(e) => set("brand", e.target.value)} className={INPUT} placeholder="MOTOXPLUS" />
          </div>
          <div>
            <label className={LABEL}>OEM Number</label>
            <input value={form.oemNumber} onChange={(e) => set("oemNumber", e.target.value)} className={INPUT} placeholder="Original equipment manufacturer number" />
          </div>
          <div>
            <label className={LABEL}>Warranty <span className="text-red-500">*</span></label>
            <select required value={form.warranty} onChange={(e) => set("warranty", e.target.value)} className={INPUT}>
              {WARRANTY_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Country of Origin <span className="text-red-500">*</span></label>
            <input required value={form.countryOfOrigin} onChange={(e) => set("countryOfOrigin", e.target.value)} className={INPUT} placeholder="India" />
          </div>
        </div>
      </div>

      {/* ── Packaging ── */}
      <div className={SECTION}>
        <div className={SECTION_TITLE}>
          <span className="w-1 h-4 bg-red-600 rounded-full inline-block" />
          Packaging &amp; Dimensions
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={LABEL}>Weight (kg) <span className="text-red-500">*</span></label>
            <input required type="number" step="0.001" min="0.001" value={form.packageWeight} onChange={(e) => set("packageWeight", e.target.value)} className={INPUT} placeholder="0.500" />
          </div>
          <div>
            <label className={LABEL}>Length (cm) <span className="text-red-500">*</span></label>
            <input required type="number" step="0.1" min="0.1" value={form.packageLength} onChange={(e) => set("packageLength", e.target.value)} className={INPUT} placeholder="20.0" />
          </div>
          <div>
            <label className={LABEL}>Width (cm) <span className="text-red-500">*</span></label>
            <input required type="number" step="0.1" min="0.1" value={form.packageWidth} onChange={(e) => set("packageWidth", e.target.value)} className={INPUT} placeholder="15.0" />
          </div>
          <div>
            <label className={LABEL}>Height (cm) <span className="text-red-500">*</span></label>
            <input required type="number" step="0.1" min="0.1" value={form.packageHeight} onChange={(e) => set("packageHeight", e.target.value)} className={INPUT} placeholder="5.0" />
          </div>
        </div>
      </div>

      {/* ── Compatibility ── */}
      <div className={SECTION}>
        <div className={SECTION_TITLE}>
          <span className="w-1 h-4 bg-red-600 rounded-full inline-block" />
          Compatibility
        </div>
        <div>
          <label className={LABEL}>Compatible Vehicles (comma-separated)</label>
          <input
            value={form.compatibility}
            onChange={(e) => set("compatibility", e.target.value)}
            className={INPUT}
            placeholder="Honda Activa, TVS Jupiter, Hero Splendor"
          />
        </div>
      </div>

      {/* ── Images ── */}
      <div className={SECTION}>
        <div className={SECTION_TITLE}>
          <span className="w-1 h-4 bg-red-600 rounded-full inline-block" />
          Product Images
        </div>
        <ProductImageUploader
          ref={imgRef}
          initialImages={product?.productImages ?? []}
        />
      </div>

      {/* ── Status ── */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="isActive"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className="w-4 h-4 accent-red-600"
        />
        <label htmlFor="isActive" className="text-[var(--text-secondary)] text-sm">
          Product is active (visible to dealers)
        </label>
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
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
        >
          {status === "loading" ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="glass border border-[var(--border-color)] text-[var(--text-secondary)] font-bold px-6 py-3 rounded-xl transition-colors text-sm hover:border-red-900/40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
