"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Trash2, X } from "lucide-react";

function DeleteConfirmModal({
  productName,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  productName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative glass border border-red-900/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-900/30 border border-red-900/40 flex items-center justify-center flex-shrink-0">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-[var(--text-primary)] font-black text-base">Delete Product</h3>
            <p className="text-[var(--text-muted)] text-xs">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-[var(--text-secondary)] text-sm mb-5">
          Are you sure you want to permanently delete{" "}
          <span className="text-[var(--text-primary)] font-semibold">{productName}</span>?
          All images and variants will also be removed.
        </p>

        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-red-900/20 border border-red-900/40 text-red-400 text-xs">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl glass border border-[var(--border-color)] text-[var(--text-secondary)] text-sm font-semibold hover:border-[var(--text-muted)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {loading ? <Spinner size={14} /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminProductActions({
  productId,
  productName,
  isActive,
}: {
  productId: string;
  productName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [toggleLoading, setToggleLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const toggleActive = async () => {
    setToggleLoading(true);
    await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    router.refresh();
    setToggleLoading(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
    if (res.ok) {
      setShowDeleteModal(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error || "Failed to delete product");
    }
    setDeleteLoading(false);
  };

  return (
    <>
      <div className="flex gap-3 items-center">
        <Link
          href={`/admin/products/${productId}/edit`}
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider"
        >
          Edit
        </Link>
        <button
          onClick={toggleActive}
          disabled={toggleLoading}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-50 uppercase tracking-wider ${isActive ? "text-yellow-400 hover:text-yellow-300" : "text-green-400 hover:text-green-300"}`}
        >
          {toggleLoading ? <Spinner size={12} /> : null}
          {isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          onClick={() => { setDeleteError(null); setShowDeleteModal(true); }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider"
        >
          <Trash2 size={11} />
          Delete
        </button>
      </div>

      {showDeleteModal && (
        <DeleteConfirmModal
          productName={productName}
          onConfirm={handleDelete}
          onCancel={() => { setShowDeleteModal(false); setDeleteError(null); }}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
    </>
  );
}
