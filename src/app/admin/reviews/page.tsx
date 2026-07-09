"use client";

import { useEffect, useState } from "react";
import { Star, CheckCircle2, Trash2, Clock } from "lucide-react";

interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  isApproved: boolean;
  createdAt: string;
  user: { name: string | null; email: string };
  vehicle: { name: string } | null;
  product: { name: string } | null;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/reviews");
    if (res.ok) setReviews(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setApproved = async (id: string, isApproved: boolean) => {
    setBusyId(id);
    await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isApproved }),
    });
    await load();
    setBusyId(null);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this review permanently?")) return;
    setBusyId(id);
    await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    await load();
    setBusyId(null);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Review Moderation</h1>
        <p className="text-[var(--text-muted)] mt-1">
          Approve or reject customer reviews before they appear on public vehicle/product pages.
        </p>
      </div>

      {loading ? (
        <p className="text-[var(--text-muted)] text-sm">Loading…</p>
      ) : reviews.length === 0 ? (
        <div className="glass border border-[var(--border-color)] rounded-2xl p-10 text-center">
          <p className="text-[var(--text-muted)] text-sm">No reviews have been submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="glass border border-[var(--border-color)] rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} className={i < r.rating ? "fill-red-500 text-red-500" : "text-[var(--border-color)]"} />
                      ))}
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        r.isApproved ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {r.isApproved ? "Approved" : "Pending"}
                    </span>
                    {r.verifiedPurchase && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="text-[var(--text-muted)] text-xs">
                    {r.vehicle?.name || r.product?.name || "—"} · {r.user.name || r.user.email} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString("en-IN")}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!r.isApproved && (
                    <button
                      onClick={() => setApproved(r.id, true)}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <CheckCircle2 size={12} /> Approve
                    </button>
                  )}
                  {r.isApproved && (
                    <button
                      onClick={() => setApproved(r.id, false)}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-amber-500 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Clock size={12} /> Unapprove
                    </button>
                  )}
                  <button
                    onClick={() => remove(r.id)}
                    disabled={busyId === r.id}
                    className="flex items-center gap-1.5 text-gray-500 hover:text-red-500 p-1.5"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {r.title && <h3 className="text-[var(--text-primary)] font-bold text-sm mb-1">{r.title}</h3>}
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
