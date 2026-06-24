"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Lock, Package, ChevronLeft, ChevronRight, X, Clock, Zap } from "lucide-react";

const RECENT_KEY = "motox_recent_searches";
const MAX_RECENT = 5;

interface ProductImage { id: string; imageUrl: string; isPrimary: boolean; sortOrder: number; }

interface Product {
  id: string;
  name: string;
  sku: string;
  partNumber: string;
  description: string | null;
  images: string[];
  productImages?: ProductImage[];
  compatibility: string[];
  price: number;
  mrp?: number | null;
  gstRate: number;
  moq: number;
  category: { name: string; slug: string };
}

interface Category { id: string; name: string; slug: string; }

interface Suggestion {
  id: string;
  name: string;
  partNumber: string;
  brand: string;
  categoryName: string;
  imageUrl?: string;
  matchType: "name" | "partNumber" | "compatibility" | "brand";
}

interface Props {
  products: Product[];
  categories: Category[];
  totalProducts: number;
  currentPage: number;
  pageSize: number;
  currentCategory?: string;
  currentSearch?: string;
}

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-red-500/20 text-red-300 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch { return []; }
}

function saveRecentSearch(term: string) {
  try {
    const recent = getRecentSearches().filter((r) => r !== term);
    recent.unshift(term);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

function removeRecentSearch(term: string) {
  try {
    const recent = getRecentSearches().filter((r) => r !== term);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch { /* ignore */ }
}

const MATCH_LABELS: Record<string, string> = {
  compatibility: "Compatible vehicle",
  partNumber: "Part no.",
  brand: "Brand",
  name: "",
};

export function ProductCatalog({
  products,
  categories,
  totalProducts,
  currentPage,
  pageSize,
  currentCategory,
  currentSearch,
}: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const totalPages = Math.ceil(totalProducts / pageSize);
  const isDealer = session?.user?.role === "DEALER";

  const [search, setSearch] = useState(currentSearch || "");
  const [inputFocused, setInputFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    setSuggestionsLoading(true);
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch { /* ignore */ }
    finally { setSuggestionsLoading(false); }
  }, []);

  // Debounce autocomplete fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!inputFocused || !search) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(search), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, inputFocused, fetchSuggestions]);

  // Debounce auto-submit search to URL
  const doSearch = useCallback((term: string) => {
    const params = new URLSearchParams();
    if (term) params.set("search", term);
    if (currentCategory) params.set("category", currentCategory);
    if (term) saveRecentSearch(term);
    setRecentSearches(getRecentSearches());
    router.push(`/products?${params.toString()}`);
  }, [currentCategory, router]);

  const handleInputChange = (value: string) => {
    setSearch(value);
    setActiveSuggestion(-1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!value) {
      // Immediate clear
      doSearch("");
      return;
    }
    searchDebounceRef.current = setTimeout(() => doSearch(value), 500);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setSuggestions([]);
    setInputFocused(false);
    setSearch(suggestion.name);
    doSearch(suggestion.name);
    router.push(`/products/${suggestion.id}`);
  };

  const handleRecentClick = (term: string) => {
    setSearch(term);
    setSuggestions([]);
    doSearch(term);
  };

  const handleRemoveRecent = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    removeRecentSearch(term);
    setRecentSearches(getRecentSearches());
  };

  const handleClear = () => {
    setSearch("");
    setSuggestions([]);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    doSearch("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const items = suggestions.length > 0 ? suggestions : [];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        handleSuggestionClick(suggestions[activeSuggestion]);
      } else {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        doSearch(search);
        setSuggestions([]);
        setInputFocused(false);
      }
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setInputFocused(false);
      inputRef.current?.blur();
    }
  };

  const handleCategory = (slug: string | null) => {
    const params = new URLSearchParams();
    if (slug) params.set("category", slug);
    if (search) params.set("search", search);
    router.push(`/products?${params.toString()}`);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setSuggestions([]);
        setInputFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showDropdown = inputFocused && (
    suggestions.length > 0 ||
    suggestionsLoading ||
    (search.length === 0 && recentSearches.length > 0)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="flex-1 relative">
          <div className="relative">
            <Search
              size={15}
              className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                inputFocused ? "text-red-400" : "text-[var(--text-muted)]"
              }`}
            />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search by name, part number, vehicle (e.g. Hero Glamour)..."
              className={`w-full themed-input border rounded-xl pl-11 pr-10 py-3 text-sm transition-all ${
                inputFocused
                  ? "border-red-600/60 shadow-[0_0_0_3px_rgba(220,38,38,0.08)]"
                  : ""
              }`}
              autoComplete="off"
              spellCheck={false}
            />
            {search && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1.5 glass border border-[var(--border-color)] rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Loading */}
              {suggestionsLoading && search.length >= 2 && (
                <div className="px-4 py-3 text-[var(--text-muted)] text-xs flex items-center gap-2">
                  <div className="w-3 h-3 border border-[var(--text-muted)] border-t-red-400 rounded-full animate-spin" />
                  Searching...
                </div>
              )}

              {/* Suggestions */}
              {!suggestionsLoading && suggestions.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1.5 text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold">
                    Products
                  </div>
                  {suggestions.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => handleSuggestionClick(s)}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === activeSuggestion
                          ? "bg-red-600/10 border-l-2 border-red-600"
                          : "hover:bg-[var(--bg-card-hover)] border-l-2 border-transparent"
                      }`}
                    >
                      {/* Thumb */}
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-800 to-black flex-shrink-0 overflow-hidden">
                        {s.imageUrl ? (
                          <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-red-900/40 font-black text-xs">◈</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[var(--text-primary)] text-sm font-semibold truncate">
                          {highlight(s.name, search)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[var(--text-muted)] text-[10px] font-mono">
                            {highlight(s.partNumber, search)}
                          </span>
                          {MATCH_LABELS[s.matchType] && (
                            <span className="text-red-400/70 text-[9px] font-semibold uppercase tracking-wider">
                              via {MATCH_LABELS[s.matchType]}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[var(--text-muted)] text-[10px] flex-shrink-0">{s.categoryName}</span>
                    </button>
                  ))}
                  <div className="border-t border-[var(--border-color)] px-4 py-2">
                    <button
                      onClick={() => { setSuggestions([]); setInputFocused(false); doSearch(search); }}
                      className="text-red-400 text-xs font-semibold hover:text-red-300 flex items-center gap-1.5"
                    >
                      <Search size={11} />
                      See all results for &ldquo;{search}&rdquo;
                    </button>
                  </div>
                </div>
              )}

              {/* No suggestions */}
              {!suggestionsLoading && suggestions.length === 0 && search.length >= 2 && (
                <div className="px-4 py-4 text-center">
                  <p className="text-[var(--text-muted)] text-sm">No matches for &ldquo;{search}&rdquo;</p>
                  <p className="text-[var(--text-muted)] text-xs mt-1">Try a vehicle name, part number, or category</p>
                </div>
              )}

              {/* Recent searches */}
              {search.length === 0 && recentSearches.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
                    <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold">Recent</span>
                    <button
                      onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]); }}
                      className="text-[var(--text-muted)] text-[10px] hover:text-red-400 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleRecentClick(term)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[var(--bg-card-hover)] transition-colors group"
                    >
                      <Clock size={13} className="text-[var(--text-muted)] flex-shrink-0" />
                      <span className="flex-1 text-[var(--text-secondary)] text-sm">{term}</span>
                      <button
                        onClick={(e) => handleRemoveRecent(e, term)}
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition-all"
                      >
                        <X size={12} />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategory(null)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              !currentCategory
                ? "bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.3)]"
                : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-[var(--text-primary)]"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategory(cat.slug)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                currentCategory === cat.slug
                  ? "bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.3)]"
                  : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-[var(--text-primary)]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Results count + active search badge */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-[var(--text-muted)] text-sm">
          Showing <span className="text-[var(--text-primary)] font-semibold">{products.length}</span> of{" "}
          <span className="text-[var(--text-primary)] font-semibold">{totalProducts}</span> products
          {currentCategory && (
            <span className="text-red-500"> in &quot;{currentCategory}&quot;</span>
          )}
        </span>
        {currentSearch && (
          <div className="flex items-center gap-2 glass border border-red-900/30 rounded-full px-3 py-1">
            <Zap size={10} className="text-red-400" />
            <span className="text-red-300 text-xs font-semibold">&quot;{currentSearch}&quot;</span>
            <button
              onClick={handleClear}
              className="text-[var(--text-muted)] hover:text-red-400 transition-colors ml-1"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Product Grid */}
      {products.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-[var(--text-muted)]" />
          </div>
          <h3 className="text-[var(--text-primary)] font-bold text-xl mb-2">No products found</h3>
          {currentSearch ? (
            <>
              <p className="text-[var(--text-muted)] mb-4">
                No results for &quot;<span className="text-[var(--text-primary)]">{currentSearch}</span>&quot;
              </p>
              <p className="text-[var(--text-muted)] text-sm mb-6">
                Try searching by vehicle name (e.g. &quot;Hero Splendor&quot;), part number, brand, or category.
              </p>
              <button
                onClick={handleClear}
                className="text-red-400 hover:text-red-300 text-sm font-semibold transition-colors"
              >
                Clear search
              </button>
            </>
          ) : (
            <p className="text-[var(--text-muted)]">Try adjusting your search or filter criteria.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => {
            const thumb =
              product.productImages && product.productImages.length > 0
                ? (product.productImages.find((i) => i.isPrimary) || product.productImages[0]).imageUrl
                : product.images[0];
            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-2xl overflow-hidden transition-all duration-300 card-hover"
              >
                {/* Image */}
                <div className="relative h-48 bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center overflow-hidden">
                  {thumb ? (
                    <Image
                      src={thumb}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="300px"
                      unoptimized
                    />
                  ) : (
                    <div className="text-6xl text-red-900/20 font-black">◈</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-3 left-3">
                    <span className="bg-black/70 backdrop-blur-sm text-red-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                      {product.category.name}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest mb-1 font-mono opacity-70">
                    {currentSearch ? highlight(product.partNumber, currentSearch) : product.partNumber}
                  </div>
                  <h3 className="text-[var(--text-primary)] font-bold text-sm mb-2 line-clamp-2 group-hover:text-red-100 transition-colors">
                    {currentSearch ? highlight(product.name, currentSearch) : product.name}
                  </h3>
                  {product.compatibility.length > 0 && (
                    <div className="text-[var(--text-muted)] text-xs mb-3 opacity-70">
                      Fits: {product.compatibility.slice(0, 2).join(", ")}
                      {product.compatibility.length > 2 && " +more"}
                    </div>
                  )}
                  <div className="pt-3 border-t border-[var(--border-color)]">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-red-400 font-black text-base leading-tight">
                          ₹{product.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </div>
                        {product.mrp && product.mrp > product.price && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-gray-500 text-[10px] line-through">MRP ₹{product.mrp.toLocaleString("en-IN")}</span>
                            <span className="text-green-500 text-[10px] font-bold">
                              {Math.round(((product.mrp - product.price) / product.mrp) * 100)}% off
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide font-semibold">MOQ: {product.moq}</div>
                    </div>
                    {!isDealer && (
                      <div className="mt-2 flex items-center gap-1.5 glass border border-red-900/20 rounded-full px-2.5 py-1 w-fit">
                        <Lock size={9} className="text-red-500" />
                        <span className="text-red-500 text-[9px] font-bold">Login to Order</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12">
          {currentPage > 1 && (
            <Link
              href={`/products?page=${currentPage - 1}${currentCategory ? `&category=${currentCategory}` : ""}${currentSearch ? `&search=${currentSearch}` : ""}`}
              className="w-9 h-9 flex items-center justify-center rounded-xl glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-[var(--text-primary)] transition-all"
            >
              <ChevronLeft size={16} />
            </Link>
          )}
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            // Show pages around current
            const mid = Math.min(Math.max(currentPage, 4), totalPages - 3);
            const start = Math.max(1, mid - 3);
            const end = Math.min(totalPages, start + 6);
            return start + i <= end ? start + i : null;
          })
            .filter(Boolean)
            .map((p) => (
              <Link
                key={p}
                href={`/products?page=${p}${currentCategory ? `&category=${currentCategory}` : ""}${currentSearch ? `&search=${currentSearch}` : ""}`}
                className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                  p === currentPage
                    ? "bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.3)]"
                    : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-[var(--text-primary)]"
                }`}
              >
                {p}
              </Link>
            ))}
          {currentPage < totalPages && (
            <Link
              href={`/products?page=${currentPage + 1}${currentCategory ? `&category=${currentCategory}` : ""}${currentSearch ? `&search=${currentSearch}` : ""}`}
              className="w-9 h-9 flex items-center justify-center rounded-xl glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-[var(--text-primary)] transition-all"
            >
              <ChevronRight size={16} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
