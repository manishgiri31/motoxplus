"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Bike, ChevronDown, FileText, LayoutGrid, LifeBuoy, Package, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { Highlight } from "./highlight";
import {
  MIN_QUERY_LENGTH,
  POPULAR_SEARCHES,
  SearchUnavailableError,
  addRecent,
  normaliseQuery,
  searchApi,
  type SearchGroup,
  type SearchIcon,
  type SearchItem,
  type SearchParams,
} from "./search-api";

const PAGE_SIZE = 20;
const SORTS = [
  { value: "relevance", label: "Best match" },
  { value: "name", label: "Name, A–Z" },
  { value: "newest", label: "Newest" },
] as const;
type SortValue = (typeof SORTS)[number]["value"];

const ICONS: Record<SearchIcon, LucideIcon> = {
  product: Package,
  category: LayoutGrid,
  vehicle: Bike,
  support: LifeBuoy,
  page: FileText,
};

interface CategoryOption {
  slug: string;
  name: string;
  parentId: string | null;
  id: string;
}

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-store-accent";

export function SearchResults() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = normaliseQuery(params.get("q") ?? "");
  const category = params.get("category") ?? "";
  const sortParam = params.get("sort");
  const sort: SortValue = SORTS.some((s) => s.value === sortParam) ? (sortParam as SortValue) : "relevance";

  const [draft, setDraft] = useState(q);
  const [products, setProducts] = useState<SearchItem[]>([]);
  const [related, setRelated] = useState<SearchGroup[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "more" | "offline" | "error">("idle");
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setDraft(q), [q]);

  // Category filter options. Optional: if this fails the filter just isn't offered.
  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/categories", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: CategoryOption[]) => Array.isArray(rows) && setCategories(rows))
      .catch(() => {});
    return () => ac.abort();
  }, []);

  const base: SearchParams = useMemo(
    () => ({ q, limit: PAGE_SIZE, type: "all", category: category || undefined, sort }),
    [q, category, sort]
  );

  // First page whenever the query or a filter changes.
  useEffect(() => {
    abortRef.current?.abort();
    if (q.length < MIN_QUERY_LENGTH) {
      setProducts([]);
      setRelated([]);
      setHasMore(false);
      setStatus("idle");
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus("loading");
    searchApi(base, ac.signal)
      .then((r) => {
        const productGroup = r.groups.find((g) => g.type === "products");
        const items = productGroup?.items ?? [];
        setProducts(items);
        // Vehicles / categories / pages only make sense for the unfiltered query.
        setRelated(category ? [] : r.groups.filter((g) => g.type !== "products"));
        setHasMore(r.hasMore);
        setStatus("ready");
        const total = r.groups.reduce((n, g) => n + g.items.length, 0);
        track("search_query", { query_length: q.length, result_count: total, source: "results_page" });
        if (total === 0) track("search_no_results", { query_length: q.length, source: "results_page" });
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        if (e instanceof SearchUnavailableError) setStatus("offline");
        else {
          setError(e.message);
          setStatus("error");
        }
      });
    return () => ac.abort();
  }, [base, q, category]);

  const loadMore = () => {
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus("more");
    searchApi({ ...base, type: "products", offset: products.length }, ac.signal)
      .then((r) => {
        setProducts((prev) => [...prev, ...(r.groups.find((g) => g.type === "products")?.items ?? [])]);
        setHasMore(r.hasMore);
        setStatus("ready");
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setStatus(e instanceof SearchUnavailableError ? "offline" : "ready");
      });
  };

  const setParams = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`${pathname}?${sp}`, { scroll: false });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = normaliseQuery(draft);
    if (next.length < MIN_QUERY_LENGTH) return;
    addRecent(next);
    router.push(`${pathname}?${new URLSearchParams({ q: next })}`);
  };

  const categoryOptions = useMemo(() => {
    const top = categories.filter((c) => !c.parentId);
    return top.flatMap((t) => [
      { slug: t.slug, label: t.name },
      ...categories.filter((c) => c.parentId === t.id).map((c) => ({ slug: c.slug, label: `   ${c.name}` })),
    ]);
  }, [categories]);
  const categoryName = categories.find((c) => c.slug === category)?.name;

  const loading = status === "loading";
  const empty = status === "ready" && products.length === 0 && related.length === 0;

  return (
    <>
      <section className="border-b border-store-line-soft">
        <div className="mx-auto max-w-[980px] px-4 pb-6 pt-10 bp-md:px-[22px] bp-md:pt-14">
          <form role="search" onSubmit={submit} className="group flex items-center gap-3 border-b border-store-line pb-3 focus-within:border-store-ink-3">
            <Search size={22} className="shrink-0 text-store-ink-3" aria-hidden />
            <label htmlFor="search-page-input" className="sr-only">
              Search MotoXPlus
            </label>
            <input
              id="search-page-input"
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search MotoXPlus"
              maxLength={100}
              autoComplete="off"
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent py-1 text-24 font-semibold text-store-ink caret-store-accent outline-none placeholder:text-store-ink-3 bp-md:text-28 [&::-webkit-search-cancel-button]:appearance-none"
            />
          </form>

          {q.length >= MIN_QUERY_LENGTH && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <p className="text-14 text-store-ink-2" aria-live="polite">
                {loading
                  ? "Searching…"
                  : status === "offline"
                  ? (typeof navigator !== "undefined" && !navigator.onLine ? "You’re offline." : "Search is unavailable.")
                  : `${hasMore ? `Showing the first ${products.length} parts` : `${products.length} part${products.length === 1 ? "" : "s"}`} for “${q}”${
                      categoryName ? ` in ${categoryName}` : ""
                    }`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {categoryOptions.length > 0 && (
                  <Select
                    label="Category"
                    value={category}
                    onChange={(v) => setParams({ category: v || undefined })}
                    options={[{ value: "", label: "All categories" }, ...categoryOptions.map((c) => ({ value: c.slug, label: c.label }))]}
                  />
                )}
                <Select
                  label="Sort"
                  value={sort}
                  onChange={(v) => setParams({ sort: v === "relevance" ? undefined : v })}
                  options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[980px] px-4 pb-24 bp-md:px-[22px]">
        {q.length < MIN_QUERY_LENGTH ? (
          <Suggestions title="Popular searches" />
        ) : status === "offline" ? (
          typeof navigator !== "undefined" && !navigator.onLine ? (
            <Message title="You’re offline">Search needs a connection. Try again once you’re back online.</Message>
          ) : (
            <Message title="Search is temporarily unavailable">Please try again in a moment.</Message>
          )
        ) : status === "error" ? (
          <Message title="Search didn’t work">{error}</Message>
        ) : empty ? (
          <>
            <Message title={`No results for “${q}”${categoryName ? ` in ${categoryName}` : ""}`}>
              {category ? (
                <>
                  Try{" "}
                  <button type="button" onClick={() => setParams({ category: undefined })} className={cn("text-store-link hover:underline", focus)}>
                    searching all categories
                  </button>
                  , a part number, or your bike’s model name.
                </>
              ) : (
                <>Check the spelling, search by part number, or try your bike’s model name.</>
              )}
            </Message>
            <Suggestions title="Try searching for" limit={3} />
          </>
        ) : (
          <div className={cn("transition-opacity duration-base", loading && "opacity-50")} aria-busy={loading}>
            {related.length > 0 && (
              <div className="mt-8 grid gap-x-8 gap-y-6 bp-md:grid-cols-3">
                {related.map((g) => (
                  <div key={g.type}>
                    <h2 className="mb-1 text-12 text-store-ink-2">{g.title}</h2>
                    <ul>
                      {g.items.map((item, i) => (
                        <li key={item.url}>
                          <Link
                            href={item.url}
                            onClick={() => track("search_result_click", { position: i + 1, group: g.type, source: "results_page" })}
                            className={cn("group flex items-center gap-1 py-1.5 text-14 text-store-link", focus)}
                          >
                            <span className="truncate group-hover:underline">
                              <Highlight text={item.title} query={q} className="bg-transparent font-semibold text-inherit" />
                            </span>
                            <ArrowRight size={14} className="shrink-0" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {products.length > 0 && (
              <section className="mt-10" aria-labelledby="search-products-heading">
                <h2 id="search-products-heading" className="mb-2 text-12 text-store-ink-2">
                  Parts
                </h2>
                <ul className="divide-y divide-store-line-soft border-y border-store-line-soft">
                  {products.map((item, i) => (
                    <ProductRow key={item.url} item={item} query={q} position={i + 1} />
                  ))}
                </ul>
                {hasMore && (
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={status === "more"}
                      className={cn(
                        "min-h-11 rounded-store-pill border border-store-line px-6 text-14 text-store-ink transition-colors duration-base ease-apple hover:bg-store-bg-alt disabled:opacity-50",
                        focus
                      )}
                    >
                      {status === "more" ? "Loading…" : "Show more parts"}
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ProductRow({ item, query, position }: { item: SearchItem; query: string; position: number }) {
  const Icon = ICONS[item.icon] ?? Package;
  return (
    <li>
      <Link
        href={item.url}
        onClick={() => track("search_result_click", { position, group: "products", source: "results_page" })}
        className={cn("group flex items-center gap-4 py-4", focus)}
      >
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-store-bg-alt text-store-ink-3">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- thumbnails come from arbitrary catalogue hosts
            <img src={item.image} alt="" loading="lazy" decoding="async" className="h-full w-full bg-white object-contain" />
          ) : (
            <Icon size={22} strokeWidth={1.5} aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-17 text-store-ink group-hover:text-store-link">
            <Highlight text={item.title} query={query} className="bg-transparent font-semibold text-inherit" />
          </span>
          <span className="mt-0.5 block truncate text-12 text-store-ink-3">{item.snippet}</span>
        </span>
        <ArrowRight size={16} className="shrink-0 text-store-ink-3 transition-transform duration-base ease-apple group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 max-w-[220px] cursor-pointer appearance-none truncate rounded-store-pill border border-store-line bg-white pl-4 pr-9 text-14 text-store-ink transition-colors duration-base ease-apple hover:border-store-ink-3",
          focus
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3.5 text-store-ink-2" aria-hidden />
    </label>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-14">
      <h2 className="text-24 font-semibold text-store-ink [overflow-wrap:anywhere]">{title}</h2>
      <p className="mt-2 max-w-[560px] text-17 text-store-ink-2">{children}</p>
    </div>
  );
}

function Suggestions({ title, limit }: { title: string; limit?: number }) {
  return (
    <div className="pt-10">
      <h2 className="mb-2 text-12 text-store-ink-2">{title}</h2>
      <ul>
        {POPULAR_SEARCHES.slice(0, limit).map((s, i) => (
          <li key={s}>
            <Link
              href={`/search?q=${encodeURIComponent(s)}`}
              onClick={() => track("search_result_click", { position: i + 1, group: "popular", source: "popular" })}
              className={cn("inline-flex items-center gap-1 py-1.5 text-17 text-store-link hover:underline", focus)}
            >
              {s}
              <ArrowRight size={14} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
