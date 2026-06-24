"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, GitMerge, X, ChevronRight, Check, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  name: string;
  partNumber: string;
  price: number;
  mrp: number | null;
  stock: number;
  isActive: boolean;
  category: { name: string };
}

interface Suggestion {
  id: string;
  originalName: string;
  suggestedLabel: string;
  partNumber: string;
  price: number;
  mrp: number | null;
  stock: number;
}

interface VariantEdit {
  label: string;
  partNumber: string;
  price: string;
  mrp: string;
}

type Step = "search" | "preview" | "done";

function commonPrefixClient(names: string[]): string {
  if (!names.length) return "";
  let prefix = names[0];
  for (let i = 1; i < names.length; i++) {
    while (!names[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (!prefix) return "";
    }
  }
  return prefix.trimEnd();
}

export default function ConsolidatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [parentId, setParentId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [detectedPrefix, setDetectedPrefix] = useState("");
  const [editedVariants, setEditedVariants] = useState<Record<string, VariantEdit>>({});
  const [groupName, setGroupName] = useState("");
  const [consolidating, setConsolidating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&adminAll=1&pageSize=50`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.products || []);
      }
    } catch { /* ignore */ }
    finally { setSearching(false); }
  }, []);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 350);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (parentId === id) setParentId(null);
      } else {
        next.add(id);
        if (!parentId) setParentId(id);
      }
      return next;
    });
  };

  const handlePreview = async () => {
    if (selected.size < 2) { setError("Select at least 2 products to consolidate."); return; }
    if (!parentId) { setError("Mark one product as the parent (it stays as the main product)."); return; }
    setError("");

    const nonParentIds = Array.from(selected).filter((id) => id !== parentId);
    const res = await fetch(`/api/admin/products/consolidate?ids=${[parentId, ...nonParentIds].join(",")}`);
    if (!res.ok) { setError("Failed to preview"); return; }
    const data = await res.json();

    setSuggestions(data.suggestions);
    setDetectedPrefix(data.prefix);
    setGroupName(data.prefix.trim());

    const edits: Record<string, VariantEdit> = {};
    for (const s of data.suggestions) {
      if (s.id !== parentId) {
        edits[s.id] = {
          label: s.suggestedLabel,
          partNumber: s.partNumber,
          price: String(s.price),
          mrp: s.mrp != null ? String(s.mrp) : "",
        };
      }
    }
    setEditedVariants(edits);
    setStep("preview");
  };

  const handleConsolidate = async () => {
    setConsolidating(true);
    setError("");
    try {
      const nonParentIds = Array.from(selected).filter((id) => id !== parentId);
      const variants: Record<string, any> = {};
      for (const id of nonParentIds) {
        const e = editedVariants[id];
        if (e) {
          variants[id] = {
            label: e.label,
            partNumber: e.partNumber,
            price: parseFloat(e.price),
            mrp: e.mrp ? parseFloat(e.mrp) : null,
          };
        }
      }

      const res = await fetch("/api/admin/products/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentProductId: parentId,
          variantProductIds: nonParentIds,
          variants,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Consolidation failed"); return; }
      setResult(data);
      setStep("done");
    } catch (e) { setError("Network error"); }
    finally { setConsolidating(false); }
  };

  const setEditField = (id: string, field: keyof VariantEdit, value: string) => {
    setEditedVariants((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const selectedCount = selected.size;
  const variantIds = Array.from(selected).filter((id) => id !== parentId);

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/admin/products" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight flex items-center gap-3">
            <GitMerge size={24} className="text-purple-400" />
            Consolidate Products
          </h1>
          <p className="text-[var(--text-muted)] mt-1 text-sm">
            Merge similar products (same model, different colors) into one product with variant selection
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {(["search", "preview", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              step === s ? "bg-purple-600 text-white" :
              (["search", "preview", "done"].indexOf(step) > i) ? "bg-green-900/30 text-green-400" :
              "glass border border-[var(--border-color)] text-[var(--text-muted)]"
            }`}>
              {["search", "preview", "done"].indexOf(step) > i ? <Check size={10} /> : <span>{i + 1}</span>}
              {s === "search" ? "Select" : s === "preview" ? "Review" : "Done"}
            </div>
            {i < 2 && <ChevronRight size={14} className="text-[var(--text-muted)]" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 mb-5 text-red-400 text-sm">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* ── STEP 1: SELECT ── */}
      {step === "search" && (
        <div>
          <div className="mb-5">
            <p className="text-[var(--text-muted)] text-sm mb-3">
              Search for products to consolidate. Example: search <span className="text-[var(--text-primary)] font-mono">&quot;HEAD LIGHT VISOR ACHIEVER&quot;</span> to find all Achiever visor colors.
            </p>
            <div className="relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder='e.g. "HEAD LIGHT VISOR ACHIEVER"'
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-xl pl-11 pr-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-muted)]"
                autoFocus
              />
              {searching && (
                <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] animate-spin" />
              )}
            </div>
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 glass border border-purple-900/30 rounded-xl">
              <span className="text-purple-400 text-sm font-bold">{selectedCount} selected</span>
              {parentId && (
                <span className="text-[var(--text-muted)] text-xs">
                  Parent: <span className="text-[var(--text-primary)]">
                    {searchResults.find((p) => p.id === parentId)?.name || "..."}
                  </span>
                </span>
              )}
              <button
                onClick={() => { setSelected(new Set()); setParentId(null); }}
                className="ml-auto text-[var(--text-muted)] hover:text-red-400 text-xs"
              >
                Clear all
              </button>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden mb-6">
              <div className="px-4 py-2.5 border-b border-[var(--border-color)] flex items-center justify-between">
                <span className="text-[var(--text-muted)] text-xs">{searchResults.length} products found</span>
                <button
                  onClick={() => {
                    const allIds = new Set(searchResults.map((p) => p.id));
                    setSelected(allIds);
                    if (!parentId && searchResults.length > 0) setParentId(searchResults[0].id);
                  }}
                  className="text-purple-400 text-xs font-semibold hover:text-purple-300"
                >
                  Select all
                </button>
              </div>
              {searchResults.map((product) => {
                const isSelected = selected.has(product.id);
                const isParent = parentId === product.id;
                return (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] last:border-0 cursor-pointer transition-colors ${
                      isSelected ? "bg-purple-900/10" : "hover:bg-[var(--bg-card-hover)]"
                    }`}
                    onClick={() => toggleSelect(product.id)}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? "bg-purple-600 border-purple-600" : "border-[var(--border-color)]"
                    }`}>
                      {isSelected && <Check size={11} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-primary)] text-sm font-semibold truncate">{product.name}</span>
                        {!product.isActive && (
                          <span className="text-[10px] text-red-400 font-bold uppercase bg-red-900/20 px-1.5 py-0.5 rounded">inactive</span>
                        )}
                      </div>
                      <div className="text-[var(--text-muted)] text-xs font-mono">{product.partNumber} · {product.category.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[var(--text-primary)] text-sm font-bold">{formatCurrency(product.price)}</div>
                      <div className="text-[var(--text-muted)] text-xs">Stock: {product.stock}</div>
                    </div>
                    {isSelected && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setParentId(product.id); }}
                        className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          isParent
                            ? "bg-green-600 text-white"
                            : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-green-600/50 hover:text-green-400"
                        }`}
                      >
                        {isParent ? "Parent ✓" : "Set Parent"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <div className="text-center py-12 glass border border-[var(--border-color)] rounded-xl">
              <Search size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-[var(--text-muted)] text-sm">No products found for &quot;{searchQuery}&quot;</p>
            </div>
          )}

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handlePreview}
              disabled={selectedCount < 2}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Review & Merge
              <ChevronRight size={16} />
            </button>
            <span className="text-[var(--text-muted)] text-xs">
              {selectedCount < 2 ? "Select at least 2 products" : `${selectedCount} products selected — 1 parent + ${selectedCount - 1} become variants`}
            </span>
          </div>
        </div>
      )}

      {/* ── STEP 2: PREVIEW / EDIT ── */}
      {step === "preview" && (
        <div>
          <div className="glass border border-[var(--border-color)] rounded-xl p-5 mb-6">
            <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-2">
              Group / Product Name (displayed to dealers)
            </label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none"
            />
            <p className="text-[var(--text-muted)] text-xs mt-2">
              Auto-detected common prefix: <span className="font-mono text-[var(--text-secondary)]">&quot;{detectedPrefix}&quot;</span>
            </p>
          </div>

          <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
              <GitMerge size={14} className="text-purple-400" />
              <span className="text-[var(--text-primary)] font-semibold text-sm">Variant Preview</span>
              <span className="text-[var(--text-muted)] text-xs ml-auto">Edit labels and prices before merging</span>
            </div>
            {suggestions.map((s) => {
              const isParent = s.id === parentId;
              const edit = editedVariants[s.id];
              return (
                <div key={s.id} className="border-b border-[var(--border-color)] last:border-0 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                      isParent ? "bg-green-900/30 text-green-400" : "bg-purple-900/20 text-purple-400"
                    }`}>
                      {isParent ? "Parent" : "Variant"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-muted)] text-xs font-mono truncate mb-2">{s.originalName}</p>
                      {isParent ? (
                        <p className="text-[var(--text-secondary)] text-sm">
                          This product stays as the main product. Its name will update to the group name above.
                        </p>
                      ) : edit ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-1 block">Variant Label</label>
                            <input
                              value={edit.label}
                              onChange={(e) => setEditField(s.id, "label", e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-1 block">Part Number</label>
                            <input
                              value={edit.partNumber}
                              onChange={(e) => setEditField(s.id, "partNumber", e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm font-mono focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-1 block">Wholesale Price</label>
                            <input
                              type="number"
                              value={edit.price}
                              onChange={(e) => setEditField(s.id, "price", e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-1 block">MRP</label>
                            <input
                              type="number"
                              value={edit.mrp}
                              onChange={(e) => setEditField(s.id, "mrp", e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm focus:outline-none"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass border border-yellow-900/30 bg-yellow-900/5 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-yellow-300 font-semibold mb-1">What will happen:</p>
                <ul className="text-[var(--text-muted)] space-y-0.5 text-xs">
                  <li>• <strong className="text-[var(--text-primary)]">{variantIds.length}</strong> products will be <span className="text-red-400">deactivated</span> (not deleted — all data preserved)</li>
                  <li>• <strong className="text-[var(--text-primary)]">{variantIds.length}</strong> new variants will be added to the parent product</li>
                  <li>• Parent product name will change to: <span className="font-mono text-[var(--text-primary)]">&quot;{groupName || detectedPrefix}&quot;</span></li>
                  <li>• Dealers will see ONE product with a variant selector instead of {selectedCount} separate cards</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep("search")}
              className="glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold px-5 py-3 rounded-xl transition-colors text-sm"
            >
              Back
            </button>
            <button
              onClick={handleConsolidate}
              disabled={consolidating}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              {consolidating ? (
                <><Loader2 size={14} className="animate-spin" /> Merging...</>
              ) : (
                <><GitMerge size={14} /> Consolidate {selectedCount} Products</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: DONE ── */}
      {step === "done" && result && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-900/20 border border-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">Consolidation Complete</h2>
          <div className="flex items-center justify-center gap-6 mt-6 mb-8">
            <div className="text-center">
              <div className="text-3xl font-black text-purple-400">{result.variantsCreated}</div>
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mt-1">Variants Created</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-red-400">{result.productsDeactivated}</div>
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mt-1">Products Deactivated</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-green-400">1</div>
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mt-1">Master Product</div>
            </div>
          </div>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            Product <span className="text-[var(--text-primary)] font-semibold">&quot;{result.newProductName}&quot;</span> now has {result.variantsCreated} variants.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href={`/admin/products/${result.parentProductId}/edit`}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl transition-colors text-sm"
            >
              Edit Parent Product
            </Link>
            <button
              onClick={() => {
                setStep("search");
                setSelected(new Set());
                setParentId(null);
                setSearchQuery("");
                setSearchResults([]);
                setResult(null);
                setError("");
              }}
              className="glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold px-5 py-3 rounded-xl transition-colors text-sm"
            >
              Consolidate More
            </button>
            <Link href="/admin/products" className="text-[var(--text-muted)] text-sm hover:text-[var(--text-primary)]">
              ← Back to Products
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
