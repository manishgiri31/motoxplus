"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Package } from "lucide-react";
import { AdminProductActions } from "@/components/admin/product-actions";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { PRODUCT_STOCK_STATUS_OPTIONS, productStockBadgeClass, productStockLabel } from "@/lib/stock-status";

type StockStatus = "IN_STOCK" | "FEW_LEFT" | "OUT_OF_STOCK";

export interface AdminProductRow {
  id: string;
  name: string;
  sku: string;
  partNumber: string;
  price: number;
  isActive: boolean;
  stockStatus: StockStatus;
  images: string[];
  category: { name: string };
  vendor: { companyName: string } | null;
  productImages: { imageUrl: string }[];
}

export function ProductsTable({ products, search }: { products: AdminProductRow[]; search?: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<StockStatus>("IN_STOCK");
  const [applying, setApplying] = useState(false);

  const allSelected = products.length > 0 && selected.size === products.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyBulkStatus = async () => {
    setApplying(true);
    await fetch("/api/admin/products/bulk-stock-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), stockStatus: bulkStatus }),
    });
    setApplying(false);
    setSelected(new Set());
    router.refresh();
  };

  const selectedCount = useMemo(() => selected.size, [selected]);

  return (
    <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden">
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 flex-wrap px-4 py-3 border-b border-[var(--border-color)] bg-red-900/10">
          <span className="text-[var(--text-primary)] text-xs font-bold uppercase tracking-wider">
            {selectedCount} selected
          </span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as StockStatus)}
            className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600"
          >
            {PRODUCT_STOCK_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={applyBulkStatus}
            disabled={applying}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-colors"
          >
            {applying ? <Spinner size={12} /> : null}
            Apply to {selectedCount}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-wider"
          >
            Clear
          </button>
        </div>
      )}

      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            <th className="px-4 py-3 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all products"
                className="w-4 h-4 accent-red-600"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Product</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Category</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Part No.</th>
            <th className="px-4 py-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-widest">Price</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden sm:table-cell">Stock</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Status</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {products.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-16 text-center text-[var(--text-muted)]">
                {search ? `No products found matching "${search}"` : "No products found"}
              </td>
            </tr>
          ) : products.map((product) => (
            <tr key={product.id} className="hover:bg-white/2 transition-colors">
              <td className="px-4 py-4">
                <input
                  type="checkbox"
                  checked={selected.has(product.id)}
                  onChange={() => toggleOne(product.id)}
                  aria-label={`Select ${product.name}`}
                  className="w-4 h-4 accent-red-600"
                />
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 bg-zinc-900 rounded-xl flex-shrink-0 overflow-hidden">
                    {(() => {
                      const thumb = product.productImages?.[0]?.imageUrl || product.images[0];
                      return thumb ? (
                        <Image src={thumb} alt={product.name} fill className="object-cover" sizes="40px" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={16} className="text-gray-600" />
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-[var(--text-primary)] font-bold text-sm">{product.name}</div>
                      {product.vendor && (
                        <span className="bg-amber-900/30 text-amber-400 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-amber-900/40">
                          {product.vendor.companyName}
                        </span>
                      )}
                    </div>
                    <div className="text-[var(--text-muted)] text-xs font-mono">{product.sku}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 hidden md:table-cell">
                <span className="text-[var(--text-muted)] text-xs">{product.category.name}</span>
              </td>
              <td className="px-4 py-4 hidden lg:table-cell">
                <span className="text-[var(--text-muted)] text-xs font-mono">{product.partNumber}</span>
              </td>
              <td className="px-4 py-4 text-right">
                <span className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(product.price)}</span>
              </td>
              <td className="px-4 py-4 hidden sm:table-cell">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${productStockBadgeClass(product.stockStatus)}`}>
                  {productStockLabel(product.stockStatus)}
                </span>
              </td>
              <td className="px-4 py-4">
                <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-xl ${product.isActive ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>
                  {product.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-4">
                <AdminProductActions productId={product.id} productName={product.name} isActive={product.isActive} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
