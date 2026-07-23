"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

interface FailedRow {
  rowNumber: number;
  sku: string;
  productName: string;
  error: string;
}

interface ImportReport {
  filename: string;
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  failedRows: FailedRow[];
}

export default function ProductImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      setError("Only .xlsx or .xls files are supported");
      return;
    }
    setFile(f);
    setReport(null);
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/products/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
      } else {
        setReport(data);
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const downloadFailedCSV = () => {
    if (!report?.failedRows.length) return;
    const header = "Row,SKU,Product Name,Error\n";
    const rows = report.failedRows
      .map(
        (r) =>
          `${r.rowNumber},"${r.sku}","${r.productName.replace(/"/g, '""')}","${r.error.replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-failed-rows.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setReport(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/products"
            className="w-9 h-9 flex items-center justify-center rounded-xl glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-[var(--text-primary)] transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Bulk Import</h1>
            <p className="text-[var(--text-muted)] mt-1">Upload an Excel file to create or update products</p>
          </div>
        </div>
        {/* File download, not a page route — Link's client-side transition would intercept the response */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/admin/products/import/template"
          className="flex items-center gap-2 glass border border-green-900/40 text-green-400 font-bold px-4 py-2.5 rounded-xl transition-colors text-sm hover:border-green-600/60"
        >
          <Download size={14} />
          Download Template
        </a>
      </div>

      {/* Upload Panel */}
      {!report && (
        <div className="glass-dark border border-[var(--border-color)] rounded-2xl p-8">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all select-none ${
              dragging
                ? "border-red-500 bg-red-900/10"
                : file
                ? "border-green-500/50 bg-green-900/5"
                : "border-[var(--border-color)] hover:border-red-900/50 hover:bg-red-900/5"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {file ? (
              <>
                <FileSpreadsheet size={40} className="mx-auto mb-4 text-green-400" />
                <p className="text-[var(--text-primary)] font-bold text-lg">{file.name}</p>
                <p className="text-[var(--text-muted)] text-sm mt-1">
                  {(file.size / 1024).toFixed(1)} KB — click to change
                </p>
              </>
            ) : (
              <>
                <Upload size={40} className="mx-auto mb-4 text-[var(--text-muted)]" />
                <p className="text-[var(--text-primary)] font-bold text-lg">Drop your Excel file here</p>
                <p className="text-[var(--text-muted)] text-sm mt-2">or click to browse — .xlsx / .xls supported</p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-3 bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 text-red-400 text-sm">
              <XCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Steps */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                n: "1",
                title: "Download Template",
                body: "Start with the sample Excel file to ensure correct column headers and data format.",
              },
              {
                n: "2",
                title: "Fill in Products",
                body: "Add one product per row. SKU is the unique key — existing SKUs will be updated.",
              },
              {
                n: "3",
                title: "Upload & Review",
                body: "Upload the file and get an instant report. Failed rows download as CSV for easy fixing.",
              },
            ].map((s) => (
              <div key={s.n} className="glass border border-[var(--border-color)] rounded-xl p-4">
                <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-black mb-3">
                  {s.n}
                </div>
                <div className="text-[var(--text-primary)] text-sm font-bold mb-1">{s.title}</div>
                <div className="text-[var(--text-muted)] text-xs leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>

          {/* Required columns */}
          <div className="mt-4 glass border border-amber-900/20 rounded-xl p-4">
            <div className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">
              Required Columns
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                "Product Name",
                "Category",
                "SKU",
                "Part Number",
                "MRP",
                "GST Rate",
                "HSN Code",
                "MOQ",
                "Stock",
              ].map((col) => (
                <span
                  key={col}
                  className="bg-amber-900/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full"
                >
                  {col}
                </span>
              ))}
            </div>
            <p className="text-[var(--text-muted)] text-[10px] mt-2">
              Category must match an existing category name exactly (case-insensitive). GST Rate: 0, 5, 12, 18, or 28. HSN Code: exactly 8 digits.
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Import Products
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Report Panel */}
      {report && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Total Rows",
                value: report.totalRows,
                color: "text-[var(--text-primary)]",
                border: "border-[var(--border-color)]",
              },
              {
                label: "Created",
                value: report.created,
                color: "text-green-400",
                border: "border-green-900/30",
              },
              {
                label: "Updated",
                value: report.updated,
                color: "text-blue-400",
                border: "border-blue-900/30",
              },
              {
                label: "Failed",
                value: report.failed,
                color: "text-red-400",
                border: "border-red-900/30",
              },
            ].map((s) => (
              <div key={s.label} className={`glass border ${s.border} rounded-2xl p-5 text-center`}>
                <div className={`text-4xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Banner */}
          <div
            className={`flex items-start gap-3 rounded-xl px-5 py-4 border ${
              report.failed === 0
                ? "bg-green-900/10 border-green-900/30"
                : report.created + report.updated > 0
                ? "bg-amber-900/10 border-amber-900/30"
                : "bg-red-900/10 border-red-900/30"
            }`}
          >
            {report.failed === 0 ? (
              <CheckCircle size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-[var(--text-primary)] font-bold text-sm">
                {report.failed === 0
                  ? `Import complete — ${report.created} created, ${report.updated} updated`
                  : `Partial import — ${report.created + report.updated} products imported, ${report.failed} rows failed`}
              </div>
              <div className="text-[var(--text-muted)] text-xs mt-0.5">File: {report.filename}</div>
            </div>
          </div>

          {/* Failed Rows Table */}
          {report.failedRows.length > 0 && (
            <div className="glass-dark border border-[var(--border-color)] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                <div>
                  <div className="text-[var(--text-primary)] font-bold">Failed Rows</div>
                  <div className="text-[var(--text-muted)] text-xs mt-0.5">
                    {report.failedRows.length} row{report.failedRows.length !== 1 ? "s" : ""} need attention
                  </div>
                </div>
                <button
                  onClick={downloadFailedCSV}
                  className="flex items-center gap-2 glass border border-red-900/40 text-red-400 text-xs font-bold px-3 py-2 rounded-lg hover:border-red-600/60 transition-colors"
                >
                  <Download size={12} />
                  Download CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      <th className="text-left px-6 py-3 text-[var(--text-muted)] text-xs uppercase tracking-wider w-16">
                        Row
                      </th>
                      <th className="text-left px-6 py-3 text-[var(--text-muted)] text-xs uppercase tracking-wider w-32">
                        SKU
                      </th>
                      <th className="text-left px-6 py-3 text-[var(--text-muted)] text-xs uppercase tracking-wider">
                        Product Name
                      </th>
                      <th className="text-left px-6 py-3 text-[var(--text-muted)] text-xs uppercase tracking-wider">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.failedRows.map((r) => (
                      <tr key={r.rowNumber} className="border-b border-[var(--border-color)] last:border-0">
                        <td className="px-6 py-3 text-[var(--text-muted)] text-sm font-mono">{r.rowNumber}</td>
                        <td className="px-6 py-3 text-[var(--text-primary)] text-sm font-mono">
                          {r.sku || "—"}
                        </td>
                        <td className="px-6 py-3 text-[var(--text-primary)] text-sm">
                          {r.productName || "—"}
                        </td>
                        <td className="px-6 py-3 text-red-400 text-xs">{r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 glass border border-[var(--border-color)] text-[var(--text-secondary)] font-bold px-5 py-2.5 rounded-xl text-sm hover:border-red-900/40 transition-colors"
            >
              <RotateCcw size={14} />
              Import Another File
            </button>
            <Link
              href="/admin/products"
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              View Products
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
