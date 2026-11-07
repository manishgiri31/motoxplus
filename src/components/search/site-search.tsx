"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bike,
  Clock,
  CornerDownLeft,
  FileText,
  LayoutGrid,
  LifeBuoy,
  Package,
  Search,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { track } from "@/lib/analytics";
import { Highlight } from "./highlight";
import {
  MIN_QUERY_LENGTH,
  POPULAR_SEARCHES,
  SearchUnavailableError,
  addRecent,
  clearRecent,
  countItems,
  getCached,
  normaliseQuery,
  readRecent,
  removeRecent,
  searchApi,
  type SearchIcon,
  type SearchItem,
  type SearchResponse,
} from "./search-api";
import s from "./search.module.css";

const BRAND = "MotoXPlus";
const LIMIT = 8;
const DEBOUNCE_MS = 200;
const EXIT_MS = 200;

const ICONS: Record<SearchIcon, LucideIcon> = {
  product: Package,
  category: LayoutGrid,
  vehicle: Bike,
  support: LifeBuoy,
  page: FileText,
};

/* ------------------------------------------------------------------------------------------------
 * Trigger: the header button, plus the "/" shortcut from anywhere on the page.
 * ---------------------------------------------------------------------------------------------- */

export function SiteSearch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const show = useCallback((trigger: "button" | "shortcut") => {
    const active = document.activeElement;
    returnFocusTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
    setOpen(true);
    track("search_open", { trigger });
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    // Back to whatever opened it; for the "/" shortcut from the page body that is the header button.
    (returnFocusTo.current ?? triggerRef.current)?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
      e.preventDefault();
      show("shortcut");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, show]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => show("button")}
        aria-label="Search MotoXPlus"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="/"
        title="Search ( / )"
        className={className}
      >
        <Search size={16} aria-hidden />
      </button>
      {open && createPortal(<SearchOverlay onClosed={hide} />, document.body)}
    </>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Overlay
 * ---------------------------------------------------------------------------------------------- */

type Status = "idle" | "loading" | "ready" | "offline" | "error";

type Entry =
  | { kind: "result"; item: SearchItem; group: string; position: number }
  | { kind: "recent" | "popular"; text: string; position: number }
  | { kind: "viewAll"; query: string };

interface Section {
  key: string;
  title: string;
  /** indexes into the flat `entries` array */
  start: number;
  count: number;
  action?: { label: string; onClick: () => void };
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function SearchOverlay({ onClosed }: { onClosed: () => void }) {
  const router = useRouter();
  const uid = useId().replace(/:/g, "");
  const listboxId = `${uid}-listbox`;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  const [state, setState] = useState<"closed" | "open">("closed");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const [online, setOnline] = useState(true);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const closingRef = useRef(false);

  const q = normaliseQuery(query);
  const hasQuery = q.length >= MIN_QUERY_LENGTH;

  /* ---------- open / close ---------- */

  useEffect(() => {
    setRecent(readRecent());
    setOnline(navigator.onLine);
    const raf = requestAnimationFrame(() => {
      setState("open");
      inputRef.current?.focus({ preventScroll: true });
    });

    // Lock page scroll without the layout jumping where the scrollbar was.
    const html = document.documentElement;
    const gap = window.innerWidth - html.clientWidth;
    const prev = { overflow: html.style.overflow, paddingRight: document.body.style.paddingRight };
    html.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelAnimationFrame(raf);
      abortRef.current?.abort();
      html.style.overflow = prev.overflow;
      document.body.style.paddingRight = prev.paddingRight;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setState("closed");
    window.setTimeout(onClosed, prefersReducedMotion() ? 0 : EXIT_MS);
  }, [onClosed]);

  /* ---------- fetching: debounced, cancellable, cached ---------- */

  useEffect(() => {
    setActive(-1);
    if (!hasQuery) {
      setResponse(null);
      setStatus("idle");
      return;
    }

    const params = { q, limit: LIMIT };
    const cached = getCached(params);
    if (cached) {
      setResponse(cached);
      setStatus("ready");
      return;
    }
    if (!online) {
      setStatus("offline");
      return;
    }

    setStatus("loading");
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const r = await searchApi(params, ac.signal);
        if (ac.signal.aborted) return;
        setResponse(r);
        setStatus("ready");
        const n = countItems(r);
        track("search_query", { query_length: q.length, result_count: n, source: "overlay" });
        if (n === 0) track("search_no_results", { query_length: q.length, source: "overlay" });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (e instanceof SearchUnavailableError) {
          setStatus("offline");
        } else {
          setError((e as Error).message);
          setStatus("error");
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort(); // the query changed: whatever was in flight is now stale
    };
  }, [q, hasQuery, online]);

  /* ---------- what to show ---------- */

  const showResults = hasQuery && response !== null && (status === "ready" || status === "loading") && response.query.length > 0;
  const results = showResults ? response : null;
  const resultCount = countItems(results);
  const noResults = hasQuery && status === "ready" && resultCount === 0;
  const offline = status === "offline" || (!online && !results);
  const showSuggestions = !hasQuery || offline || status === "error" || (status === "loading" && !results);

  const { entries, sections } = useMemo(() => {
    const entries: Entry[] = [];
    const sections: Section[] = [];
    const push = (section: Omit<Section, "start" | "count">, items: Entry[]) => {
      if (items.length === 0) return;
      sections.push({ ...section, start: entries.length, count: items.length });
      entries.push(...items);
    };

    if (results && resultCount > 0) {
      let position = 0;
      for (const g of results.groups) {
        push(
          { key: g.type, title: g.title },
          g.items.map((item) => ({ kind: "result" as const, item, group: g.type, position: ++position }))
        );
      }
      entries.push({ kind: "viewAll", query: q });
    } else if (noResults) {
      push(
        { key: "try", title: "Try searching for" },
        POPULAR_SEARCHES.slice(0, 3).map((text, i) => ({ kind: "popular" as const, text, position: i + 1 }))
      );
    } else if (showSuggestions) {
      push(
        { key: "recent", title: "Recent searches", action: { label: "Clear", onClick: () => setRecent(clearRecent()) } },
        recent.map((text, i) => ({ kind: "recent" as const, text, position: i + 1 }))
      );
      push(
        { key: "popular", title: "Popular searches" },
        POPULAR_SEARCHES.filter((p) => !recent.some((r) => r.toLowerCase() === p.toLowerCase())).map((text, i) => ({
          kind: "popular" as const,
          text,
          position: i + 1,
        }))
      );
    }
    return { entries, sections };
  }, [results, resultCount, noResults, showSuggestions, recent, q]);

  const viewAllIndex = entries.findIndex((e) => e.kind === "viewAll");

  /* ---------- actions ---------- */

  const go = useCallback(
    (url: string) => {
      router.push(url);
      close();
    },
    [router, close]
  );

  const activate = useCallback(
    (entry: Entry) => {
      switch (entry.kind) {
        case "result":
          setRecent(addRecent(q));
          track("search_result_click", { position: entry.position, group: entry.group, source: "overlay" });
          go(entry.item.url);
          break;
        case "viewAll":
          setRecent(addRecent(entry.query));
          go(`/search?q=${encodeURIComponent(entry.query)}`);
          break;
        case "recent":
        case "popular":
          track("search_result_click", { position: entry.position, group: entry.kind, source: entry.kind });
          setQuery(entry.text);
          inputRef.current?.focus();
          break;
      }
    },
    [q, go]
  );

  const deleteRecent = (text: string) => {
    setRecent(removeRecent(text));
    setActive((i) => Math.min(i, entries.length - 2));
    inputRef.current?.focus();
  };

  /* ---------- keyboard ---------- */

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const n = entries.length;
    switch (e.key) {
      case "ArrowDown":
        if (n === 0) return;
        e.preventDefault();
        setActive((i) => (i + 1 >= n ? 0 : i + 1));
        break;
      case "ArrowUp":
        if (n === 0) return;
        e.preventDefault();
        setActive((i) => (i <= 0 ? (i === 0 ? -1 : n - 1) : i - 1));
        break;
      case "Enter": {
        e.preventDefault();
        const entry = entries[active];
        if (entry) activate(entry);
        else if (hasQuery) activate({ kind: "viewAll", query: q });
        break;
      }
      case "Delete": {
        const entry = entries[active];
        if (entry?.kind === "recent") {
          e.preventDefault();
          deleteRecent(entry.text);
        }
        break;
      }
    }
  };

  // Escape and the Tab focus trap apply wherever focus is inside the dialog.
  const onPanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /* ---------- screen-reader announcement ---------- */

  const announcement =
    status === "loading" || !hasQuery
      ? ""
      : offline
      ? online
        ? "Search is temporarily unavailable. Showing popular searches."
        : "You're offline. Showing popular searches."
      : status === "error"
      ? error
      : noResults
      ? `No results for ${q}.`
      : `${resultCount} result${resultCount === 1 ? "" : "s"} available. Use up and down arrows to review.`;

  const activeEntry = entries[active];

  /* ---------- render ---------- */

  const renderEntry = (entry: Entry, i: number) => {
    const selected = i === active;
    const common = {
      id: optionId(i),
      role: "option" as const,
      "aria-selected": selected,
      tabIndex: -1,
      onMouseMove: () => active !== i && setActive(i),
    };

    if (entry.kind === "result") {
      const Icon = ICONS[entry.item.icon] ?? FileText;
      return (
        <a
          key={common.id}
          {...common}
          href={entry.item.url}
          className={s.option}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let the browser open a new tab
            e.preventDefault();
            activate(entry);
          }}
        >
          <span className={s.tile} aria-hidden>
            {entry.item.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- tiny thumbnail from arbitrary catalogue hosts
              <img src={entry.item.image} alt="" loading="lazy" decoding="async" />
            ) : (
              <Icon size={16} strokeWidth={1.75} />
            )}
          </span>
          <span className={s.text}>
            <span className={s.title}>
              <Highlight text={entry.item.title} query={q} className={s.mark} />
            </span>
            {entry.item.snippet && <span className={s.snippet}>{entry.item.snippet}</span>}
          </span>
          <ArrowRight size={16} className={s.go} aria-hidden />
        </a>
      );
    }

    if (entry.kind === "viewAll") {
      return (
        <a
          key={common.id}
          {...common}
          href={`/search?q=${encodeURIComponent(entry.query)}`}
          className={`${s.option} ${s.viewAll}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            activate(entry);
          }}
        >
          <span className={s.text}>View all results for “{entry.query}”</span>
          <ArrowRight size={16} className={s.go} aria-hidden />
        </a>
      );
    }

    const Icon = entry.kind === "recent" ? Clock : TrendingUp;
    return (
      <div key={common.id} {...common} className={`${s.option} ${s.compact}`} onClick={() => activate(entry)}>
        <Icon size={16} className={s.plainIcon} aria-hidden />
        <span className={s.text}>
          <span className={s.title}>{entry.text}</span>
        </span>
        {entry.kind === "recent" ? (
          // Mouse/touch affordance; keyboard users press Delete on the highlighted row (see footer).
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className={s.remove}
            onClick={(e) => {
              e.stopPropagation();
              deleteRecent(entry.text);
            }}
          >
            <X size={14} />
          </button>
        ) : (
          <ArrowRight size={16} className={s.go} aria-hidden />
        )}
      </div>
    );
  };

  return (
    <div className={s.root} data-state={state}>
      <div className={s.scrim} onClick={close} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search MotoXPlus"
        className={s.panel}
        onKeyDown={onPanelKeyDown}
      >
        <div className={s.inner}>
          <form
            role="search"
            className={s.field}
            onSubmit={(e) => e.preventDefault()}
          >
            {status === "loading" ? <span className={s.spinner} aria-hidden /> : <Search size={20} className={s.fieldIcon} aria-hidden />}
            <input
              ref={inputRef}
              className={s.input}
              type="search"
              role="combobox"
              aria-label={`Search ${BRAND}`}
              aria-expanded={entries.length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? optionId(active) : undefined}
              aria-describedby={`${uid}-hints`}
              placeholder={`Search ${BRAND}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              maxLength={100}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            <button type="button" className={s.iconButton} onClick={close} aria-label="Close search">
              <X size={20} aria-hidden />
            </button>
          </form>
        </div>

        <div className={s.body}>
          <div className={s.inner}>
            {noResults && (
              <div className={s.empty}>
                <p className={s.emptyTitle}>No results for “{q}”</p>
                <p className={s.emptyText}>
                  Check the spelling, search by part number, or try your bike’s model name. You can also{" "}
                  <Link href="/products" onClick={close}>
                    browse all parts
                  </Link>
                  .
                </p>
              </div>
            )}

            {offline && (
              <p className={s.note}>
                <span className={s.dot} aria-hidden />
                {online
                  ? "Search is temporarily unavailable — showing saved searches. Try again in a moment."
                  : "Offline — showing saved searches. Results will appear when you’re back online."}
              </p>
            )}
            {status === "error" && (
              <p className={s.note}>
                <span className={s.dot} aria-hidden />
                {error}
              </p>
            )}

            <div
              id={listboxId}
              role="listbox"
              aria-label={hasQuery && results ? `Results for ${q}` : "Search suggestions"}
              className={status === "loading" && results ? s.stale : undefined}
            >
              {sections.map((sec) => (
                <div key={sec.key} role="group" aria-labelledby={`${uid}-${sec.key}`} className={s.section}>
                  <div className={s.sectionHead} role="presentation">
                    <span id={`${uid}-${sec.key}`}>{sec.title}</span>
                    {sec.action && (
                      <button type="button" className={s.textButton} onClick={sec.action.onClick}>
                        {sec.action.label}
                        <span className={s.srOnly}> recent searches</span>
                      </button>
                    )}
                  </div>
                  {entries.slice(sec.start, sec.start + sec.count).map((entry, j) => renderEntry(entry, sec.start + j))}
                </div>
              ))}
              {viewAllIndex >= 0 && renderEntry(entries[viewAllIndex], viewAllIndex)}
            </div>
          </div>
        </div>

        <div className={s.footer}>
          <div className={s.inner}>
            <ul className={s.hints} id={`${uid}-hints`} aria-label="Keyboard shortcuts">
              <li>
                <kbd className={s.kbd} aria-label="Up arrow">
                  <ArrowUp size={12} aria-hidden />
                </kbd>
                <kbd className={s.kbd} aria-label="Down arrow">
                  <ArrowDown size={12} aria-hidden />
                </kbd>
                to navigate
              </li>
              <li>
                <kbd className={s.kbd} aria-label="Enter">
                  <CornerDownLeft size={12} aria-hidden />
                </kbd>
                to open
              </li>
              <li>
                <kbd className={s.kbd}>esc</kbd>
                to close
              </li>
              {activeEntry?.kind === "recent" && (
                <li>
                  <kbd className={s.kbd}>del</kbd>
                  to remove
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className={s.srOnly} role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
      </div>
    </div>
  );
}
