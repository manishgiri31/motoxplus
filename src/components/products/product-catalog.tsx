"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Lock, Package, ChevronLeft, ChevronRight, X, Clock, Zap, Heart, Eye, Scale, Check } from "lucide-react";
import { TiltCard } from "@/components/3d/tilt-card";

const RECENT_KEY = "motox_recent_searches";
const WISHLIST_KEY = "motox_wishlist";
const MAX_RECENT = 5;
const MAX_COMPARE = 4;

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
  stock: number;
  category: { name: string; slug: string };
}

function getWishlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
  } catch { return []; }
}

function toggleWishlist(id: string): string[] {
  const current = getWishlist();
  const next = current.includes(id) ? current.filter((w) => w !== id) : [...current, id];
  try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

function productThumb(product: Product): string | undefined {
  return product.productImages && product.productImages.length > 0
    ? (product.productImages.find((i) => i.isPrimary) || product.productImages[0]).imageUrl
    : product.images[0];
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

const POPULAR_SEARCHES = [
  "Hero Splendor",
  "Honda Activa",
  "Brake Shoe",
  "Head Light Visor",
  "Mudguard",
  "Indicator",
];

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
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // Load recent searches + wishlist on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
    setWishlist(getWishlist());
  }, []);

  const handleToggleWishlist = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlist(toggleWishlist(id));
  }, []);

  const handleToggleCompare = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < MAX_COMPARE ? [...prev, id] : prev
    );
  }, []);

  const handleQuickView = useCallback((e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickView(product);
  }, []);

  const compareProducts = products.filter((p) => compareIds.includes(p.id));

  // Fetch autocomplete suggestions. Guards against out-of-order responses
  // (a slower earlier request resolving after a faster later one) by only
  // applying the result if it's still the most recent request in flight.
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    const requestId = ++requestIdRef.current;
    setSuggestionsLoading(true);
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
      if (requestId !== requestIdRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (requestId !== requestIdRef.current) return;
        setSuggestions(data.suggestions || []);
      }
    } catch { /* ignore */ }
    finally {
      if (requestId === requestIdRef.current) setSuggestionsLoading(false);
    }
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
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setSuggestions([]);
    setInputFocused(false);
    setSearch(suggestion.name);
    saveRecentSearch(suggestion.name);
    setRecentSearches(getRecentSearches());
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

  const showingRecent = search.length === 0 && recentSearches.length > 0;
  const showingPopular = search.length === 0 && recentSearches.length === 0;
  const navigableCount = suggestions.length > 0
    ? suggestions.length
    : showingRecent
      ? recentSearches.length
      : showingPopular
        ? POPULAR_SEARCHES.length
        : 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((i) => Math.min(i + 1, navigableCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0 && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        handleSuggestionClick(suggestions[activeSuggestion]);
      } else if (showingRecent && activeSuggestion >= 0 && recentSearches[activeSuggestion]) {
        handleRecentClick(recentSearches[activeSuggestion]);
      } else if (showingPopular && activeSuggestion >= 0 && POPULAR_SEARCHES[activeSuggestion]) {
        handleRecentClick(POPULAR_SEARCHES[activeSuggestion]);
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

  // "/" focuses the search input, unless the user is already typing somewhere
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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
    search.length === 0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      {/* Search — large, prominent, full-width */}
      <div className="w-full relative mb-6">
        <div className="relative">
          <Search
            size={22}
            className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${
              inputFocused ? "text-red-400" : "text-[var(--text-muted)]"
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { setInputFocused(true); setActiveSuggestion(-1); }}
            onKeyDown={handleKeyDown}
            placeholder="Search by name, part number, vehicle (e.g. Hero Glamour)..."
            className={`w-full themed-input border rounded-2xl pl-14 pr-14 py-5 text-base md:text-lg font-medium transition-all duration-200 ${
              inputFocused
                ? "border-red-600/60 shadow-[0_0_0_4px_rgba(220,38,38,0.1)]"
                : ""
            }`}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            aria-controls="product-search-listbox"
            aria-activedescendant={activeSuggestion >= 0 ? `product-search-option-${activeSuggestion}` : undefined}
          />
          {search ? (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
            >
              <X size={15} />
            </button>
          ) : (
            !inputFocused && (
              <kbd className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 items-center justify-center w-6 h-6 rounded-md border border-[var(--border-color)] text-[var(--text-muted)] text-xs font-mono bg-[var(--bg-card)] pointer-events-none">
                /
              </kbd>
            )
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            id="product-search-listbox"
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1.5 glass border border-[var(--border-color)] rounded-xl shadow-2xl z-50 overflow-x-hidden overflow-y-auto animate-dropdown-in max-h-[70vh]"
          >
              {/* Loading */}
              {suggestionsLoading && suggestions.length === 0 && search.length >= 2 && (
                <div className="py-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="skeleton h-3 w-3/5 rounded" />
                        <div className="skeleton h-2.5 w-1/4 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions (kept visible, stale-while-revalidate, during background refetch) */}
              {suggestions.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1.5 flex items-center gap-2 text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold">
                    Products
                    {suggestionsLoading && (
                      <div className="w-2.5 h-2.5 border border-[var(--text-muted)] border-t-red-400 rounded-full animate-spin" />
                    )}
                  </div>
                  {suggestions.map((s, i) => (
                    <button
                      key={s.id}
                      id={`product-search-option-${i}`}
                      role="option"
                      aria-selected={i === activeSuggestion}
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
                <div className="px-4 py-6 text-center">
                  <div className="w-9 h-9 bg-[var(--bg-card)] rounded-xl flex items-center justify-center mx-auto mb-2.5">
                    <Search size={15} className="text-[var(--text-muted)]" />
                  </div>
                  <p className="text-[var(--text-primary)] text-sm font-semibold">No matches for &ldquo;{search}&rdquo;</p>
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
                  {recentSearches.map((term, i) => (
                    <button
                      key={term}
                      id={`product-search-option-${i}`}
                      role="option"
                      aria-selected={i === activeSuggestion}
                      onClick={() => handleRecentClick(term)}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors group ${
                        i === activeSuggestion
                          ? "bg-red-600/10"
                          : "hover:bg-[var(--bg-card-hover)]"
                      }`}
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

              {/* Popular searches — shown when there's no query and no search history yet */}
              {showingPopular && (
                <div>
                  <div className="px-4 pt-3 pb-1.5">
                    <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold">Popular Searches</span>
                  </div>
                  {POPULAR_SEARCHES.map((term, i) => (
                    <button
                      key={term}
                      id={`product-search-option-${i}`}
                      role="option"
                      aria-selected={i === activeSuggestion}
                      onClick={() => handleRecentClick(term)}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        i === activeSuggestion
                          ? "bg-red-600/10"
                          : "hover:bg-[var(--bg-card-hover)]"
                      }`}
                    >
                      <Zap size={13} className="text-red-500/70 flex-shrink-0" />
                      <span className="flex-1 text-[var(--text-secondary)] text-sm">{term}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-8">
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
          <div className="flex items-center gap-2 glass border border-red-500/30 rounded-full px-3 py-1">
            <Zap size={10} className="text-red-500" />
            <span className="text-red-500 text-xs font-semibold">&quot;{currentSearch}&quot;</span>
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
            const thumb = productThumb(product);
            const discountPct = product.mrp && product.mrp > product.price
              ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
              : null;
            const isWishlisted = wishlist.includes(product.id);
            const isComparing = compareIds.includes(product.id);
            const outOfStock = product.stock <= 0;

            return (
              <TiltCard key={product.id} intensity={8}>
              <Link
                href={`/products/${product.id}`}
                className="group relative glass border border-[var(--border-color)] hover:border-red-900/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-black/10 transition-all duration-300 block"
              >
                {/* Image */}
                <div className="relative h-48 bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden">
                  {thumb ? (
                    <Image
                      src={thumb}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                      sizes="300px"
                      unoptimized
                    />
                  ) : (
                    <div className="text-6xl text-red-500/20 font-black">◈</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Top-left badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                    <span className="bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                      {product.category.name}
                    </span>
                    {discountPct && discountPct > 0 && (
                      <span className="bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                        {discountPct}% OFF
                      </span>
                    )}
                    {outOfStock && (
                      <span className="bg-zinc-800 text-white/80 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                        Out of Stock
                      </span>
                    )}
                  </div>

                  {/* Top-right quick actions */}
                  <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                    <button
                      onClick={(e) => handleToggleWishlist(e, product.id)}
                      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                      className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-colors ${
                        isWishlisted
                          ? "bg-red-600 border-red-600 text-white"
                          : "bg-black/40 border-white/20 text-white hover:bg-red-600 hover:border-red-600"
                      }`}
                    >
                      <Heart size={13} className={isWishlisted ? "fill-current" : ""} />
                    </button>
                    <button
                      onClick={(e) => handleQuickView(e, product)}
                      aria-label="Quick view"
                      className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border bg-black/40 border-white/20 text-white hover:bg-red-600 hover:border-red-600 transition-colors"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={(e) => handleToggleCompare(e, product.id)}
                      aria-label={isComparing ? "Remove from compare" : "Add to compare"}
                      className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-colors ${
                        isComparing
                          ? "bg-red-600 border-red-600 text-white"
                          : "bg-black/40 border-white/20 text-white hover:bg-red-600 hover:border-red-600"
                      }`}
                    >
                      {isComparing ? <Check size={13} /> : <Scale size={13} />}
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest mb-1 font-mono opacity-70">
                    {currentSearch ? highlight(product.partNumber, currentSearch) : product.partNumber}
                  </div>
                  <h3 className="text-[var(--text-primary)] font-bold text-sm mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">
                    {currentSearch ? highlight(product.name, currentSearch) : product.name}
                  </h3>
                  {product.description && (
                    <p className="text-[var(--text-muted)] text-xs leading-relaxed mb-2 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  {product.compatibility.length > 0 && (
                    <div className="text-[var(--text-muted)] text-xs mb-3 opacity-70">
                      Fits: {product.compatibility.slice(0, 2).join(", ")}
                      {product.compatibility.length > 2 && " +more"}
                    </div>
                  )}
                  <div className="pt-3 border-t border-[var(--border-color)]">
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <div className="text-red-500 font-black text-xl leading-tight tracking-tight">
                          ₹{product.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </div>
                        {product.mrp && product.mrp > product.price && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[var(--text-muted)] text-[10px] line-through">MRP ₹{product.mrp.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[var(--text-muted)] text-[9px] uppercase tracking-wide font-bold glass border border-[var(--border-color)] rounded-full px-2 py-1 flex-shrink-0">
                        MOQ {product.moq}
                      </span>
                    </div>
                    {!isDealer && (
                      <div className="mt-2 flex items-center gap-1.5 glass border border-red-500/20 rounded-full px-2.5 py-1 w-fit">
                        <Lock size={9} className="text-red-500" />
                        <span className="text-red-500 text-[9px] font-bold">Login to Order</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
              </TiltCard>
            );
          })}
        </div>
      )}

      {/* Floating compare bar */}
      <AnimatePresence>
        {compareIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 glass border border-[var(--border-color)] rounded-2xl shadow-2xl px-5 py-3.5 flex items-center gap-4"
          >
            <div className="flex items-center gap-2">
              <Scale size={15} className="text-red-500" />
              <span className="text-[var(--text-primary)] text-sm font-semibold">
                {compareIds.length} product{compareIds.length === 1 ? "" : "s"} selected
              </span>
            </div>
            <button
              onClick={() => setShowCompare(true)}
              disabled={compareIds.length < 2}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-colors"
            >
              Compare
            </button>
            <button
              onClick={() => setCompareIds([])}
              aria-label="Clear compare selection"
              className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick view modal */}
      <AnimatePresence>
        {quickView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setQuickView(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="glass border border-[var(--border-color)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                <div className="relative h-64 md:h-full bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden">
                  {productThumb(quickView) ? (
                    <Image src={productThumb(quickView)!} alt={quickView.name} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="text-6xl text-red-500/20 font-black">◈</div>
                  )}
                  <button
                    onClick={() => setQuickView(null)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white md:hidden"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-6 relative">
                  <button
                    onClick={() => setQuickView(null)}
                    className="hidden md:flex absolute top-4 right-4 w-8 h-8 rounded-full glass border border-[var(--border-color)] items-center justify-center text-[var(--text-muted)] hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                  <span className="bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                    {quickView.category.name}
                  </span>
                  <h3 className="text-[var(--text-primary)] font-black text-xl mt-3 mb-1">{quickView.name}</h3>
                  <div className="text-[var(--text-muted)] text-xs font-mono mb-4">{quickView.partNumber}</div>
                  {quickView.description && (
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-4 line-clamp-4">
                      {quickView.description}
                    </p>
                  )}
                  <div className="flex items-end gap-3 mb-4">
                    <span className="text-red-500 font-black text-2xl">
                      ₹{quickView.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </span>
                    {quickView.mrp && quickView.mrp > quickView.price && (
                      <span className="text-[var(--text-muted)] text-sm line-through mb-1">
                        MRP ₹{quickView.mrp.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide font-bold glass border border-[var(--border-color)] rounded-full px-2.5 py-1">
                      MOQ {quickView.moq}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wide font-bold rounded-full px-2.5 py-1 ${quickView.stock > 0 ? "text-emerald-500 bg-emerald-500/10" : "text-[var(--text-muted)] bg-[var(--bg-secondary)]"}`}>
                      {quickView.stock > 0 ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                  <Link
                    href={`/products/${quickView.id}`}
                    className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors uppercase tracking-wider text-sm"
                  >
                    View Full Details
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compare modal */}
      <AnimatePresence>
        {showCompare && compareProducts.length >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowCompare(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="glass border border-[var(--border-color)] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[var(--text-primary)] font-black text-xl">Compare Products</h3>
                  <button
                    onClick={() => setShowCompare(false)}
                    className="w-8 h-8 rounded-full glass border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <tbody>
                      <tr>
                        <td className="py-2 pr-4 text-[var(--text-muted)] text-xs uppercase tracking-wider font-semibold align-top w-28">Image</td>
                        {compareProducts.map((p) => (
                          <td key={p.id} className="py-2 px-3">
                            <div className="relative h-24 w-24 rounded-xl overflow-hidden bg-[var(--bg-secondary)]">
                              {productThumb(p) && (
                                <Image src={productThumb(p)!} alt={p.name} fill className="object-cover" unoptimized />
                              )}
                            </div>
                          </td>
                        ))}
                      </tr>
                      {[
                        { label: "Name", render: (p: Product) => p.name },
                        { label: "Part No.", render: (p: Product) => p.partNumber },
                        { label: "Category", render: (p: Product) => p.category.name },
                        { label: "Price", render: (p: Product) => `₹${p.price.toLocaleString("en-IN")}` },
                        { label: "MRP", render: (p: Product) => (p.mrp ? `₹${p.mrp.toLocaleString("en-IN")}` : "—") },
                        { label: "MOQ", render: (p: Product) => String(p.moq) },
                        { label: "Stock", render: (p: Product) => (p.stock > 0 ? "In Stock" : "Out of Stock") },
                      ].map((row) => (
                        <tr key={row.label} className="border-t border-[var(--border-color)]">
                          <td className="py-3 pr-4 text-[var(--text-muted)] text-xs uppercase tracking-wider font-semibold align-top">
                            {row.label}
                          </td>
                          {compareProducts.map((p) => (
                            <td key={p.id} className="py-3 px-3 text-[var(--text-primary)] font-medium align-top">
                              {row.render(p)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="border-t border-[var(--border-color)]">
                        <td className="py-3 pr-4" />
                        {compareProducts.map((p) => (
                          <td key={p.id} className="py-3 px-3">
                            <Link
                              href={`/products/${p.id}`}
                              className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors uppercase tracking-wider"
                            >
                              View
                            </Link>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
