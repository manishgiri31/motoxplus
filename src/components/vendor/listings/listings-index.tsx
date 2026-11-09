"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImageOff, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { FilterChip } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import {
  getListingsOverview,
  listListings,
  percent,
  rupees,
  type ListingStatus,
  type ListingSummary,
  type ListingsOverview,
  type Page,
} from "@/lib/vendor/listings";

const TABS: { value: ListingStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "LIVE", label: "Live" },
  { value: "DRAFT", label: "Drafts" },
  { value: "UNPUBLISHED", label: "Unpublished" },
];

const PAGE_SIZE = 20;

type State =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; overview: ListingsOverview; page: Page<ListingSummary> };

export function ListingsIndex() {
  const router = useRouter();
  const [tab, setTab] = React.useState<ListingStatus | "ALL">("ALL");
  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [pageNo, setPageNo] = React.useState(0);
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [refreshing, setRefreshing] = React.useState(false);

  // Debounce the search box.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim());
      setPageNo(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const [overview, page] = await Promise.all([
        getListingsOverview(),
        listListings({ status: tab === "ALL" ? undefined : tab, q: query, page: pageNo, size: PAGE_SIZE }),
      ]);
      setState({ kind: "ready", overview, page });
    } catch {
      // The pages behind this are only reachable by approved vendors, so any failure here is an outage.
      setState({ kind: "unavailable" });
    } finally {
      setRefreshing(false);
    }
  }, [tab, query, pageNo]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const newButton = (
    <Button asChild>
      <Link href="/vendor/listings/new">
        <Plus aria-hidden /> New listing
      </Link>
    </Button>
  );

  if (state.kind === "loading") {
    return (
      <div className="mx-auto max-w-[1120px]">
        <PageHeader title="Listings" actions={newButton} rule={false} className="pb-0" />
        <TableSkeleton />
      </div>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <div className="mx-auto max-w-[1120px]">
        <PageHeader title="Listings" rule={false} className="pb-0" />
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-14 text-center">
          <h2 className="text-17 font-semibold text-[var(--text-primary)]">Listings aren&apos;t available right now</h2>
          <p className="mx-auto mt-1.5 max-w-md text-14 text-[var(--text-muted)]">
            We couldn&apos;t reach the listings service. Nothing you saved is lost.
          </p>
          <Button className="mt-6" variant="secondary" icon={<RefreshCw />} onClick={() => void load()} loading={refreshing}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const { overview, page } = state;
  const counts = overview.counts;

  if (counts.ALL === 0) {
    return (
      <div className="mx-auto max-w-[1120px]">
        <PageHeader title="Listings" rule={false} className="pb-0" />
        <WarehouseNotice status={overview.warehouseStatus} />
        <FirstListing commissionBp={overview.commission.saleCommissionBp} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Listings"
        description="Everything you sell on MotoXPlus."
        actions={newButton}
        meta={
          <span className="tnum text-14 text-[var(--text-muted)]">
            {counts.LIVE} live · {counts.DRAFT} {counts.DRAFT === 1 ? "draft" : "drafts"}
            {counts.UNPUBLISHED > 0 && ` · ${counts.UNPUBLISHED} unpublished`}
          </span>
        }
        rule={false}
        className="pb-0"
      />

      <WarehouseNotice status={overview.warehouseStatus} />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:pb-0" role="tablist" aria-label="Filter by status">
          {TABS.map((t) => (
            <FilterChip
              key={t.value}
              active={tab === t.value}
              count={counts[t.value]}
              onClick={() => {
                setTab(t.value);
                setPageNo(0);
              }}
            >
              {t.label}
            </FilterChip>
          ))}
        </div>
        <div className="relative md:w-80">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, part number or SKU"
            aria-label="Search your listings"
            className="pl-9"
          />
        </div>
      </div>

      {page.items.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-12 text-center text-14 text-[var(--text-muted)]">
          {query ? <>No listings match &ldquo;{query}&rdquo;.</> : "Nothing here yet."}
        </div>
      ) : (
        <div className={cn("transition-opacity", refreshing && "opacity-60")}>
          {/* Wide screens: a table that reads across. */}
          <div className="hidden overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] md:block">
            <table className="w-full text-14">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-12 font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                  <th scope="col" className="px-4 py-3 font-semibold">Product</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">MRP</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Retail</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Dealer</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Stock</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {page.items.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => router.push(`/vendor/listings/${l.id}`)}
                    className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Thumb url={l.thumbnailUrl} alt={l.title} />
                        <div className="min-w-0">
                          <Link
                            href={`/vendor/listings/${l.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="line-clamp-1 font-medium text-[var(--text-primary)] hover:underline"
                          >
                            {l.title}
                          </Link>
                          <div className="mt-0.5 truncate font-mono text-12 text-[var(--text-muted)]">
                            {[l.partNumber, l.sku].filter(Boolean).join(" · ") || "No part number yet"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <Money value={l.mrp} />
                    <Money value={l.retailPrice} />
                    <Money value={l.dealerPrice} />
                    <td className="tnum px-3 py-3 text-right text-[var(--text-secondary)]">{l.stock ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusCell listing={l} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one row per listing, the essentials only. */}
          <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] md:hidden">
            {page.items.map((l) => (
              <li key={l.id}>
                <Link href={`/vendor/listings/${l.id}`} className="flex gap-3 px-4 py-3.5 active:bg-[var(--surface-2)]">
                  <Thumb url={l.thumbnailUrl} alt={l.title} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-14 font-medium text-[var(--text-primary)]">{l.title}</div>
                    <div className="tnum mt-1 text-12 text-[var(--text-muted)]">
                      {l.dealerPrice != null ? `${rupees(l.dealerPrice)} dealer` : "No prices yet"}
                      {l.stock != null && ` · ${l.stock} in stock`}
                    </div>
                    <div className="mt-2">
                      <StatusCell listing={l} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {page.totalPages > 1 && (
            <nav className="mt-4 flex items-center justify-between text-14 text-[var(--text-muted)]" aria-label="Pages">
              <span className="tnum">
                {page.page * page.size + 1}–{Math.min(page.total, (page.page + 1) * page.size)} of {page.total}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={<ChevronLeft />} disabled={pageNo === 0} onClick={() => setPageNo((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" iconRight={<ChevronRight />} disabled={pageNo + 1 >= page.totalPages}
                  onClick={() => setPageNo((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}

function Money({ value }: { value: number | null }) {
  return <td className="tnum px-3 py-3 text-right text-[var(--text-secondary)]">{value != null ? rupees(value) : "—"}</td>;
}

function StatusCell({ listing: l }: { listing: ListingSummary }) {
  const remaining = Object.keys(l.readiness.problems).length;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <StatusBadge domain="listing" value={l.status} />
      {l.status !== "LIVE" && (
        <span className={cn("text-12", remaining === 0 ? "font-medium text-[var(--sig-ok-fg)]" : "text-[var(--text-muted)]")}>
          {remaining === 0 ? "Ready to publish" : `${remaining} to finish`}
        </span>
      )}
      {l.status === "LIVE" && !l.storefront.visible && <span className="text-12 text-[var(--text-muted)]">Hidden</span>}
    </div>
  );
}

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  return (
    <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)]">
      {url ? (
        <Image src={url} alt={alt} fill unoptimized sizes="44px" className="object-cover" />
      ) : (
        <ImageOff aria-hidden className="size-4 text-[var(--text-muted)]" />
      )}
    </span>
  );
}

/** First visit: what selling here involves, in the order the editor asks for it. */
function FirstListing({ commissionBp }: { commissionBp: number }) {
  const steps = [
    { n: "1", title: "Describe the part", body: "Title, category, brand and the part number buyers search for." },
    { n: "2", title: "Add photos and prices", body: "Up to 8 photos. You set the MRP, retail and dealer prices." },
    { n: "3", title: "Publish", body: "No review queue: a complete listing is in search straight away." },
  ];
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-10 md:px-10 md:py-12">
      <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text-primary)]">List your first part</h2>
      <p className="mt-1.5 max-w-xl text-14 text-[var(--text-muted)]">
        Dealers and riders across India search MotoXPlus for spare parts. A listing takes a few minutes.
      </p>
      <ol className="mt-8 grid gap-6 md:grid-cols-3 md:gap-8">
        {steps.map((s) => (
          <li key={s.n} className="border-t-2 border-[var(--text-primary)] pt-3">
            <div className="tnum text-12 font-semibold text-[var(--text-muted)]">0{s.n}</div>
            <div className="mt-1 text-14 font-semibold text-[var(--text-primary)]">{s.title}</div>
            <p className="mt-1 text-14 leading-relaxed text-[var(--text-muted)]">{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button asChild>
          <Link href="/vendor/listings/new">
            <Plus aria-hidden /> New listing
          </Link>
        </Button>
        <span className="text-12 text-[var(--text-muted)]">MotoXPlus keeps {percent(commissionBp)} of the selling price on each sale.</span>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-px overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="size-11 animate-pulse rounded-md bg-[var(--surface-2)]" />
          <div className="h-4 flex-1 animate-pulse rounded bg-[var(--surface-2)]" />
        </div>
      ))}
    </div>
  );
}

/** Drafts can be written any time, but nothing goes live until Delhivery can collect from the vendor. */
function WarehouseNotice({ status }: { status: ListingsOverview["warehouseStatus"] }) {
  if (status === "ACTIVE") return null;
  const text =
    status === "PENDING"
      ? "Your pickup warehouse is being set up with Delhivery. Listings can go live once it's active."
      : status === "FAILED"
        ? "Delhivery couldn't set up your pickup warehouse. Fix or retry it before publishing listings."
        : "Add your pickup warehouse so Delhivery can collect your orders. Listings can't go live until then.";
  return (
    <div
      data-tone={status === "FAILED" ? "danger" : "warn"}
      role="status"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-[var(--tone-bd)] bg-[var(--tone-bg)] px-4 py-3 text-14 text-[var(--text-primary)] sm:flex-row sm:items-center sm:justify-between"
    >
      <p>{text}</p>
      <Link href="/vendor/warehouse" className="shrink-0 font-semibold text-[var(--tone-fg)] hover:underline">
        {status ? "View warehouse" : "Add warehouse"}
      </Link>
    </div>
  );
}
