"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search, GitMerge, Check, AlertTriangle, ArrowLeft, Loader2,
  ChevronRight, Zap, List, ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  partNumber: string;
  price: number;
  stock: number;
}

interface AutoGroup {
  prefix: string;
  count: number;
  products: ProductRow[];
  suggestedParentId: string;
}

type GroupStatus = "idle" | "consolidating" | "done" | "error";

// ─── Manual‑mode types ────────────────────────────────────────────────────────

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

type ManualStep = "search" | "preview" | "done";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Auto-consolidate component ───────────────────────────────────────────────

function AutoGroupCard({
  group,
  onConsolidated,
}: {
  group: AutoGroup;
  onConsolidated: (prefix: string, count: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<GroupStatus>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ variantsCreated: number; newProductName: string; parentProductId: string } | null>(null);

  const consolidate = async () => {
    setStatus("consolidating");
    setError("");
    try {
      const parentId = group.suggestedParentId;
      const variantIds = group.products.filter((p) => p.id !== parentId).map((p) => p.id);

      // Auto-build variant data: label = suffix after common prefix
      const prefix = commonPrefixClient(group.products.map((p) => p.name));
      const variants: Record<string, { label: string; partNumber: string; price: number }> = {};
      for (const p of group.products) {
        if (p.id !== parentId) {
          const label = p.name.slice(prefix.length).trim() || p.name;
          variants[p.id] = { label, partNumber: p.partNumber, price: p.price };
        }
      }

      const res = await fetch("/api/admin/products/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentProductId: parentId, variantProductIds: variantIds, variants }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); setStatus("error"); return; }
      setResult(data);
      setStatus("done");
      onConsolidated(group.prefix, data.variantsCreated);
    } catch {
      setError("Network error");
      setStatus("error");
    }
  };

  if (status === "done" && result) {
    return (
      <div className="glass border border-green-900/30 rounded-xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-green-900/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Check size={14} className="text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-green-400 font-semibold text-sm truncate">{result.newProductName}</p>
          <p className="text-[var(--text-muted)] text-xs">{result.variantsCreated} variants created · products deactivated</p>
        </div>
        <Link
          href={`/admin/products/${result.parentProductId}/edit`}
          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          Edit <ChevronRight size={12} />
        </Link>
      </div>
    );
  }

  return (
    <div className={`glass border rounded-xl overflow-hidden transition-colors ${
      status === "error" ? "border-red-900/40" : "border-[var(--border-color)]"
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[var(--text-primary)] font-semibold text-sm truncate">{group.prefix}</p>
            <span className="flex-shrink-0 text-[10px] bg-purple-900/30 text-purple-400 font-bold px-1.5 py-0.5 rounded-full">
              {group.count} products
            </span>
          </div>
          {error && <p className="text-red-400 text-xs mt-0.5">{error}</p>}
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 flex-shrink-0"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          onClick={consolidate}
          disabled={status === "consolidating"}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          {status === "consolidating" ? (
            <><Loader2 size={11} className="animate-spin" />Merging...</>
          ) : (
            <><GitMerge size={11} />Consolidate</>
          )}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border-color)] bg-[var(--bg-card)]/50 px-4 py-2 space-y-1 max-h-48 overflow-y-auto">
          {group.products.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 py-1 text-xs">
              {i === 0 && (
                <span className="text-[9px] text-green-400 font-bold uppercase bg-green-900/20 px-1.5 py-0.5 rounded flex-shrink-0">
                  parent
                </span>
              )}
              <span className="text-[var(--text-secondary)] flex-1 truncate">{p.name}</span>
              <span className="text-[var(--text-muted)] font-mono flex-shrink-0">{p.partNumber}</span>
              <span className="text-red-400 font-semibold flex-shrink-0">{formatCurrency(p.price)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Auto Mode ────────────────────────────────────────────────────────────────

function AutoMode() {
  const [search, setSearch] = useState("");
  const [minWords, setMinWords] = useState(3);
  const [loading, setLoading] = useState(false);
  const [consolidatingAll, setConsolidatingAll] = useState(false);
  const [groups, setGroups] = useState<AutoGroup[] | null>(null);
  const [totalFound, setTotalFound] = useState(0);
  const [error, setError] = useState("");
  const [consolidatedGroups, setConsolidatedGroups] = useState<Set<string>>(new Set());
  const [allDone, setAllDone] = useState(false);

  const detect = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setError("");
    setGroups(null);
    setConsolidatedGroups(new Set());
    setAllDone(false);
    try {
      const res = await fetch(
        `/api/admin/products/auto-groups?search=${encodeURIComponent(search)}&minWords=${minWords}`
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); return; }
      setGroups(data.groups);
      setTotalFound(data.totalFound);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  };

  const onConsolidated = (prefix: string) => {
    setConsolidatedGroups((prev) => new Set([...Array.from(prev), prefix]));
  };

  const consolidateAll = async () => {
    if (!groups || groups.length === 0) return;
    setConsolidatingAll(true);
    setError("");

    const pending = groups.filter((g) => !consolidatedGroups.has(g.prefix));
    let done = 0;

    for (const g of pending) {
      try {
        const parentId = g.suggestedParentId;
        const variantIds = g.products.filter((p) => p.id !== parentId).map((p) => p.id);
        const prefix = commonPrefixClient(g.products.map((p) => p.name));
        const variants: Record<string, { label: string; partNumber: string; price: number }> = {};
        for (const p of g.products) {
          if (p.id !== parentId) {
            variants[p.id] = {
              label: p.name.slice(prefix.length).trim() || p.name,
              partNumber: p.partNumber,
              price: p.price,
            };
          }
        }
        const res = await fetch("/api/admin/products/consolidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentProductId: parentId, variantProductIds: variantIds, variants }),
        });
        if (res.ok) {
          onConsolidated(g.prefix);
          done++;
        }
      } catch { /* skip failed, continue */ }
    }

    setConsolidatingAll(false);
    if (done === pending.length) setAllDone(true);
  };

  const doneCount = consolidatedGroups.size;
  const totalGroups = groups?.length ?? 0;
  const pendingGroups = groups?.filter((g) => !consolidatedGroups.has(g.prefix)) ?? [];

  return (
    <div>
      <div className="glass border border-[var(--border-color)] rounded-xl p-5 mb-5">
        <p className="text-[var(--text-muted)] text-sm mb-4">
          Type a keyword (e.g. <span className="text-[var(--text-primary)] font-mono">visor</span>). The system clusters all matching products by shared name prefix, then you consolidate in one click.
        </p>

        <div className="flex gap-3 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && detect()}
              placeholder='e.g. "visor" or "indicator" or "tail lamp"'
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-xl pl-11 pr-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none"
              autoFocus
            />
          </div>
          <button
            onClick={detect}
            disabled={loading || !search.trim()}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold px-5 py-3 rounded-xl transition-colors text-sm flex-shrink-0"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {loading ? "Detecting..." : "Detect Groups"}
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span>Min. shared words:</span>
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setMinWords(n)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                minWords === n
                  ? "bg-purple-600 text-white"
                  : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {n}
            </button>
          ))}
          <span className="text-[var(--text-muted)]">
            {minWords === 2 ? "— broader" : minWords === 3 ? "— balanced (recommended)" : "— tighter groups"}
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {groups !== null && (
        <>
          {/* Stats + Consolidate All bar */}
          <div className="glass border border-[var(--border-color)] rounded-xl px-5 py-4 mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-[var(--text-muted)]">
                  <span className="text-[var(--text-primary)] font-bold">{totalFound}</span> products →{" "}
                  <span className="text-purple-400 font-bold">{totalGroups}</span> groups detected
                </span>
                {doneCount > 0 && (
                  <span className="text-green-400 font-semibold">
                    ✓ {doneCount}/{totalGroups} done
                  </span>
                )}
              </div>
              {totalGroups > 0 && doneCount < totalGroups && (
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  After consolidation: {totalFound - (totalGroups - doneCount) * 1} products become {totalGroups - doneCount} master product{totalGroups - doneCount !== 1 ? "s" : ""} with variants
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={detect}
                className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-colors px-3 py-2 glass border border-[var(--border-color)] rounded-xl"
              >
                <RefreshCw size={11} />
                Re-detect
              </button>
              {pendingGroups.length > 1 && (
                <button
                  onClick={consolidateAll}
                  disabled={consolidatingAll}
                  className="flex items-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl transition-colors text-sm"
                >
                  {consolidatingAll ? (
                    <><Loader2 size={14} className="animate-spin" />Merging all...</>
                  ) : (
                    <><Zap size={14} />Consolidate All {pendingGroups.length} Groups</>
                  )}
                </button>
              )}
            </div>
          </div>

          {allDone && (
            <div className="flex items-center gap-3 bg-green-900/20 border border-green-900/30 rounded-xl px-5 py-4 mb-4">
              <div className="w-8 h-8 bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Check size={16} className="text-green-400" />
              </div>
              <div>
                <p className="text-green-400 font-bold text-sm">All groups consolidated!</p>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  {totalFound} products merged into {totalGroups} master products with variants. Dealers now see one card per model with color/type selector.
                </p>
              </div>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="text-center py-12 glass border border-[var(--border-color)] rounded-xl">
              <GitMerge size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-[var(--text-muted)] text-sm">No groups found. Try reducing "Min. shared words" or a broader keyword.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) =>
                consolidatedGroups.has(g.prefix) ? (
                  <div key={g.prefix} className="glass border border-green-900/20 rounded-xl px-4 py-2.5 flex items-center gap-2 opacity-60">
                    <Check size={12} className="text-green-400 flex-shrink-0" />
                    <span className="text-[var(--text-muted)] text-sm truncate">{g.prefix}</span>
                    <span className="text-green-400 text-xs ml-auto">{g.count} variants</span>
                  </div>
                ) : (
                  <AutoGroupCard key={g.prefix} group={g} onConsolidated={onConsolidated} />
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Manual Mode ──────────────────────────────────────────────────────────────

function ManualMode() {
  const [step, setStep] = useState<ManualStep>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<(ProductRow & { isActive: boolean; category: { name: string } })[]>([]);
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
    } catch { /* ignore */ } finally { setSearching(false); }
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
    if (selected.size < 2) { setError("Select at least 2 products."); return; }
    if (!parentId) { setError("Set one product as the parent."); return; }
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
        edits[s.id] = { label: s.suggestedLabel, partNumber: s.partNumber, price: String(s.price), mrp: s.mrp != null ? String(s.mrp) : "" };
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
        if (e) variants[id] = { label: e.label, partNumber: e.partNumber, price: parseFloat(e.price), mrp: e.mrp ? parseFloat(e.mrp) : null };
      }
      const res = await fetch("/api/admin/products/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentProductId: parentId, variantProductIds: nonParentIds, variants }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); return; }
      setResult(data);
      setStep("done");
    } catch { setError("Network error"); } finally { setConsolidating(false); }
  };

  const setEditField = (id: string, field: keyof VariantEdit, value: string) => {
    setEditedVariants((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const selectedCount = selected.size;
  const variantIds = Array.from(selected).filter((id) => id !== parentId);

  return (
    <div>
      {error && (
        <div className="flex items-center gap-2 bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {step === "search" && (
        <div>
          <div className="flex items-center gap-2 mb-5">
            {(["search", "preview", "done"] as ManualStep[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  step === s ? "bg-purple-600 text-white" :
                  ["search", "preview", "done"].indexOf(step) > i ? "bg-green-900/30 text-green-400" :
                  "glass border border-[var(--border-color)] text-[var(--text-muted)]"
                }`}>
                  {["search", "preview", "done"].indexOf(step) > i ? <Check size={10} /> : <span>{i + 1}</span>}
                  {s === "search" ? "Select" : s === "preview" ? "Review" : "Done"}
                </div>
                {i < 2 && <ChevronRight size={14} className="text-[var(--text-muted)]" />}
              </div>
            ))}
          </div>

          <div className="relative mb-4">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder='Search products to consolidate…'
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-xl pl-11 pr-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none"
            />
            {searching && <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] animate-spin" />}
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 glass border border-purple-900/30 rounded-xl">
              <span className="text-purple-400 text-sm font-bold">{selectedCount} selected</span>
              {parentId && (
                <span className="text-[var(--text-muted)] text-xs">
                  Parent: <span className="text-[var(--text-primary)]">
                    {searchResults.find((p) => p.id === parentId)?.name}
                  </span>
                </span>
              )}
              <button onClick={() => { setSelected(new Set()); setParentId(null); }} className="ml-auto text-[var(--text-muted)] hover:text-red-400 text-xs">
                Clear
              </button>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden mb-6">
              <div className="px-4 py-2.5 border-b border-[var(--border-color)] flex items-center justify-between">
                <span className="text-[var(--text-muted)] text-xs">{searchResults.length} found</span>
                <button
                  onClick={() => {
                    setSelected(new Set(searchResults.map((p) => p.id)));
                    if (!parentId && searchResults.length > 0) setParentId(searchResults[0].id);
                  }}
                  className="text-purple-400 text-xs font-semibold"
                >
                  Select all
                </button>
              </div>
              {searchResults.map((product) => {
                const isSel = selected.has(product.id);
                const isPar = parentId === product.id;
                return (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] last:border-0 cursor-pointer transition-colors ${isSel ? "bg-purple-900/10" : "hover:bg-[var(--bg-card-hover)]"}`}
                    onClick={() => toggleSelect(product.id)}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSel ? "bg-purple-600 border-purple-600" : "border-[var(--border-color)]"}`}>
                      {isSel && <Check size={11} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-primary)] text-sm font-semibold truncate">{product.name}</span>
                        {!product.isActive && <span className="text-[10px] text-red-400 font-bold uppercase bg-red-900/20 px-1.5 py-0.5 rounded">inactive</span>}
                      </div>
                      <div className="text-[var(--text-muted)] text-xs font-mono">{product.partNumber} · {product.category?.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[var(--text-primary)] text-sm font-bold">{formatCurrency(product.price)}</div>
                      <div className="text-[var(--text-muted)] text-xs">Stock: {product.stock}</div>
                    </div>
                    {isSel && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setParentId(product.id); }}
                        className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${isPar ? "bg-green-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-green-600/50 hover:text-green-400"}`}
                      >
                        {isPar ? "Parent ✓" : "Set Parent"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handlePreview}
              disabled={selectedCount < 2}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Review & Merge <ChevronRight size={16} />
            </button>
            <span className="text-[var(--text-muted)] text-xs">
              {selectedCount < 2 ? "Select at least 2 products" : `${selectedCount} products → 1 parent + ${selectedCount - 1} variants`}
            </span>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          <div className="glass border border-[var(--border-color)] rounded-xl p-5 mb-5">
            <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-2">Group / Product Name</label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none"
            />
            <p className="text-[var(--text-muted)] text-xs mt-1.5">Auto-detected: <span className="font-mono text-[var(--text-secondary)]">"{detectedPrefix}"</span></p>
          </div>

          <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden mb-5">
            <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
              <GitMerge size={14} className="text-purple-400" />
              <span className="text-[var(--text-primary)] font-semibold text-sm">Variant Preview</span>
              <span className="text-[var(--text-muted)] text-xs ml-auto">Edit labels before merging</span>
            </div>
            {suggestions.map((s) => {
              const isPar = s.id === parentId;
              const edit = editedVariants[s.id];
              return (
                <div key={s.id} className="border-b border-[var(--border-color)] last:border-0 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${isPar ? "bg-green-900/30 text-green-400" : "bg-purple-900/20 text-purple-400"}`}>
                      {isPar ? "Parent" : "Variant"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-muted)] text-xs font-mono truncate mb-2">{s.originalName}</p>
                      {isPar ? (
                        <p className="text-[var(--text-secondary)] text-sm">Name will update to the group name above.</p>
                      ) : edit ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-1 block">Label</label>
                            <input value={edit.label} onChange={(e) => setEditField(s.id, "label", e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-1 block">Part No.</label>
                            <input value={edit.partNumber} onChange={(e) => setEditField(s.id, "partNumber", e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm font-mono focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-1 block">Price</label>
                            <input type="number" value={edit.price} onChange={(e) => setEditField(s.id, "price", e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-1 block">MRP</label>
                            <input type="number" value={edit.mrp} onChange={(e) => setEditField(s.id, "mrp", e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-purple-600 rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm focus:outline-none" />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass border border-yellow-900/30 bg-yellow-900/5 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-[var(--text-muted)] space-y-0.5">
                <p className="text-yellow-300 font-semibold mb-1">What will happen:</p>
                <p>• <strong className="text-[var(--text-primary)]">{variantIds.length}</strong> products deactivated (data preserved)</p>
                <p>• <strong className="text-[var(--text-primary)]">{variantIds.length}</strong> variants added to the parent</p>
                <p>• Parent renamed to: <span className="font-mono text-[var(--text-primary)]">"{groupName || detectedPrefix}"</span></p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setStep("search")} className="glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold px-5 py-3 rounded-xl transition-colors text-sm">
              Back
            </button>
            <button onClick={handleConsolidate} disabled={consolidating} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm">
              {consolidating ? <><Loader2 size={14} className="animate-spin" />Merging...</> : <><GitMerge size={14} />Consolidate {selectedCount} Products</>}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-900/20 border border-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">Done!</h2>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            <span className="text-[var(--text-primary)] font-semibold">"{result.newProductName}"</span> now has {result.variantsCreated} variants.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href={`/admin/products/${result.parentProductId}/edit`} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl transition-colors text-sm">
              Edit Product
            </Link>
            <button onClick={() => { setStep("search"); setSelected(new Set()); setParentId(null); setSearchQuery(""); setSearchResults([]); setResult(null); }}
              className="glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold px-5 py-3 rounded-xl transition-colors text-sm">
              Consolidate More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "auto" | "manual";

export default function ConsolidatePage() {
  const [tab, setTab] = useState<Tab>("auto");

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
            Merge duplicate products (same model, different colors/types) into one product with variant selection
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-8 glass border border-[var(--border-color)] rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("auto")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            tab === "auto" ? "bg-purple-600 text-white shadow" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Zap size={14} />
          Auto-detect Groups
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            tab === "manual" ? "bg-purple-600 text-white shadow" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <List size={14} />
          Manual Select
        </button>
      </div>

      {tab === "auto" ? <AutoMode /> : <ManualMode />}
    </div>
  );
}
