"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import type { ApplicationState } from "@/lib/vendor/onboarding";
import { STATE_LABELS, listApplications, type ApplicationRow, type Page } from "@/lib/vendor/review";
import { StateBadge } from "./state-badge";

const FILTERS: (ApplicationState | "ALL")[] = ["UNDER_REVIEW", "DOCUMENTS_PENDING", "DRAFT", "PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "REJECTED", "BLOCKED", "ALL"];

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

/** /admin/vendors/applications: self-registered vendors, newest first, defaulting to the ones waiting for a decision. */
export function ApplicationsQueue() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const state = sp.get("state") ?? "UNDER_REVIEW";
  const q = sp.get("q") ?? "";
  const page = Number(sp.get("page") ?? "0") || 0;
  const [query, setQuery] = React.useState(q);
  const [data, setData] = React.useState<Page<ApplicationRow> | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let live = true;
    setError("");
    listApplications({ state, q, page }).then(
      (d) => live && setData(d),
      (e) => {
        if (!live) return;
        setData(null);
        setError(
          e instanceof ApiError && e.status === 403
            ? "You don't have permission to view vendor applications."
            : e instanceof ApiError && [404, 502, 503, 504].includes(e.status)
              ? "The vendor review service isn't available. Check that the Java API is running with MARKETPLACE_ENABLED=true."
              : "Couldn't load applications."
        );
      }
    );
    return () => {
      live = false;
    };
  }, [state, q, page]);

  function go(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">Vendor applications</h1>
        <p className="mt-1 text-[var(--text-muted)]">Self-registered vendors. Every account is activated by a reviewer.</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by state">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={state === f}
              onClick={() => go({ state: f === "UNDER_REVIEW" ? null : f })}
              className={`rounded-sm px-3 py-2 text-xs font-semibold transition-colors ${
                state === f ? "bg-[var(--accent)] text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {f === "ALL" ? "All" : STATE_LABELS[f]}
            </button>
          ))}
        </div>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: query.trim() || null });
          }}
          className="relative w-full lg:w-72"
        >
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <label htmlFor="app-search" className="sr-only">
            Search applications
          </label>
          <input
            id="app-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Business, name, email, code"
            className="themed-input w-full rounded-sm py-2.5 pl-9 pr-3 text-sm"
          />
        </form>
      </div>

      {error ? (
        <div role="alert" className="rounded-sm border border-[var(--sig-danger-bd)] bg-[var(--sig-danger-bg)] px-4 py-3 text-sm text-[var(--sig-danger-fg)]">
          {error}
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-sm border border-[var(--border-color)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-left text-xs text-[var(--text-muted)]">
                <th className="px-4 py-3 font-semibold">Business</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Contact</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Location</th>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {!data ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-4">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--surface-2,rgba(0,0,0,0.05))]" />
                    </td>
                  </tr>
                ))
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-[var(--text-muted)]">
                    {state === "UNDER_REVIEW" ? "Nothing waiting for review." : "No applications here."}
                  </td>
                </tr>
              ) : (
                data.items.map((r) => (
                  <tr key={r.vendorId} className="hover:bg-black/[.02]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/vendors/applications/${r.vendorId}`} className="font-semibold text-[var(--text-primary)] hover:underline">
                        {r.businessName || <span className="font-normal italic text-[var(--text-muted)]">Business details not added yet</span>}
                      </Link>
                      <div className="font-mono text-xs text-[var(--text-muted)]">{r.vendorCode}</div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="text-[var(--text-primary)]">{r.ownerName}</div>
                      <div className="text-xs text-[var(--text-muted)]">{r.email}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--text-secondary)] lg:table-cell">{[r.city, r.businessState].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-3">
                      <StateBadge state={r.state} />
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--text-secondary)] sm:table-cell">{when(r.submittedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-muted)]">
          <span>
            {data.total} applications · page {data.page + 1} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => go({ page: String(page - 1) })} className="glass rounded-sm border border-[var(--border-color)] px-3 py-1.5 disabled:opacity-40">
              Previous
            </button>
            <button
              disabled={page + 1 >= data.totalPages}
              onClick={() => go({ page: String(page + 1) })}
              className="glass rounded-sm border border-[var(--border-color)] px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
