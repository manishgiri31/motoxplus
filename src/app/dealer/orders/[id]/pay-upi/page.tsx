"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Copy, Check, Download, Smartphone, Upload, X,
  ArrowLeft, AlertCircle, CheckCircle2, Clock, Building2, QrCode,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

interface PaymentSettings {
  upiId: string;
  upiName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankAccountName: string;
  upiEnabled: boolean;
}

interface OrderData {
  id: string;
  orderNumber: string;
  grandTotal: number;
  amountDue: number;
  paymentStatus: string;
  paymentSubmissions?: { status: string; utrNumber: string; submittedAt: string }[];
}

type Tab = "upi" | "bank";

export default function PayUpiPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("upi");

  // Copy states
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [copiedIfsc, setCopiedIfsc] = useState(false);

  // Upload states
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploadedKey, setUploadedKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form
  const [form, setForm] = useState({ utr: "", name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/payments/upi/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setOrder(data.order);
        setSettings(data.paymentSettings);
        if (data.order?.dealer?.user?.email) {
          setForm((f) => ({ ...f, email: data.order.dealer.user.email }));
        }
        if (data.order?.dealer?.ownerName) {
          setForm((f) => ({ ...f, name: data.order.dealer.ownerName }));
        }
        if (data.order?.dealer?.phone) {
          setForm((f) => ({ ...f, phone: data.order.dealer.phone }));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const copyText = useCallback(async (text: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }, []);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setSubmitError("Please upload an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError("Image too large. Maximum 5 MB.");
      return;
    }

    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
    setUploadedUrl("");
    setUploadedKey("");
    setSubmitError("");

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("orderId", id);

    const res = await fetch("/api/upload/payment-screenshot", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setSubmitError(data.error || "Screenshot upload failed.");
      return;
    }
    setUploadedUrl(data.url);
    setUploadedKey(data.key);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!uploadedUrl || !uploadedKey) {
      setSubmitError("Please upload your payment screenshot.");
      return;
    }
    if (!form.utr.trim() || form.utr.trim().length < 10) {
      setSubmitError("UTR / Reference number must be at least 10 characters.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/payments/upi/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: id,
        paymentMethod: activeTab === "upi" ? "UPI" : "BANK_TRANSFER",
        utrNumber: form.utr.trim(),
        payerName: form.name.trim(),
        payerEmail: form.email.trim(),
        payerPhone: form.phone.replace(/\D/g, ""),
        screenshotUrl: uploadedUrl,
        screenshotKey: uploadedKey,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setSubmitError(data.error || "Submission failed.");
      return;
    }
    setSubmitted(true);
  };

  const downloadQr = () => {
    if (!order || !settings) return;
    const a = document.createElement("a");
    a.href = `/api/payments/upi/qr?amount=${order.amountDue}&orderId=${order.id}&orderNumber=${order.orderNumber}`;
    a.download = `UPI-QR-${order.orderNumber}.png`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-[var(--text-muted)]">
        <Spinner size={20} />
        <span className="text-sm">Loading payment details...</span>
      </div>
    );
  }

  if (!order || !settings) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--text-muted)]">Order not found.</p>
        <Link href="/dealer/orders" className="text-red-400 hover:text-red-300 text-sm mt-2 inline-block">← Back to orders</Link>
      </div>
    );
  }

  const existingSubmission = order.paymentSubmissions?.[0];
  const alreadyPaid = order.paymentStatus === "PAID";

  if (alreadyPaid) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 bg-green-900/30 border border-green-700/40 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">Payment Verified</h2>
        <p className="text-[var(--text-muted)] text-sm mb-6">Order #{order.orderNumber} has been paid and confirmed.</p>
        <Link href={`/dealer/orders/${id}`} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl text-sm transition-colors">
          View Order
        </Link>
      </div>
    );
  }

  if (submitted || (existingSubmission && ["SUBMITTED", "UNDER_REVIEW"].includes(existingSubmission.status))) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 bg-yellow-900/30 border border-yellow-700/40 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock size={32} className="text-yellow-400" />
        </div>
        <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">Awaiting Verification</h2>
        <p className="text-[var(--text-muted)] text-sm mb-2">
          Your payment for Order #{order.orderNumber} is under review by our accounts team.
        </p>
        {existingSubmission && (
          <p className="text-[var(--text-muted)] text-xs mb-6">
            UTR: <span className="font-mono text-[var(--text-primary)]">{existingSubmission.utrNumber}</span>
          </p>
        )}
        <p className="text-[var(--text-muted)] text-xs mb-6">
          Verification typically takes 1–2 business hours. You'll receive an email once done.
        </p>
        <Link href={`/dealer/orders/${id}`} className="inline-flex items-center gap-2 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold py-3 px-6 rounded-xl text-sm transition-colors">
          <ArrowLeft size={14} /> Back to Order
        </Link>
      </div>
    );
  }

  const upiLink = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.upiName)}&am=${order.amountDue}&cu=INR`;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/dealer/orders/${id}`} className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm mb-4 transition-colors">
          <ArrowLeft size={14} /> Back to Order
        </Link>
        <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">Complete Payment</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Order #{order.orderNumber}</p>
      </div>

      {/* Amount Banner */}
      <div className="glass border border-[var(--border-color)] rounded-2xl p-5 mb-5 flex items-center justify-between">
        <div>
          <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Amount Payable</div>
          <div className="text-red-500 text-3xl font-black">{formatCurrency(order.amountDue)}</div>
        </div>
        <div className="text-right">
          <div className="text-[var(--text-muted)] text-xs">Order Total</div>
          <div className="text-[var(--text-secondary)] text-sm font-semibold">{formatCurrency(order.grandTotal)}</div>
        </div>
      </div>

      {/* Payment Method Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActiveTab("upi")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === "upi" ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/40"}`}
        >
          <Smartphone size={16} /> Direct UPI
        </button>
        <button
          onClick={() => setActiveTab("bank")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === "bank" ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/40"}`}
        >
          <Building2 size={16} /> Bank Transfer
        </button>
      </div>

      {/* UPI Tab */}
      {activeTab === "upi" && settings.upiEnabled && (
        <div className="glass border border-[var(--border-color)] rounded-2xl p-6 mb-5">
          <h3 className="text-[var(--text-primary)] font-bold mb-5 flex items-center gap-2">
            <QrCode size={18} className="text-red-500" /> Scan & Pay via UPI
          </h3>

          {/* QR Code */}
          <div className="flex flex-col items-center mb-6">
            <div className="bg-white p-3 rounded-2xl shadow-lg mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/payments/upi/qr?amount=${order.amountDue}&orderId=${order.id}&orderNumber=${encodeURIComponent(order.orderNumber)}`}
                alt="UPI QR Code"
                width={200}
                height={200}
                className="block"
              />
            </div>
            <p className="text-[var(--text-muted)] text-xs text-center mb-3">
              Scan with any UPI app — GPay, PhonePe, Paytm, BHIM
            </p>
            <button
              onClick={downloadQr}
              className="inline-flex items-center gap-2 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Download size={12} /> Download QR
            </button>
          </div>

          {/* UPI ID */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 mb-4">
            <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">UPI ID</div>
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-[var(--text-primary)] font-semibold text-sm break-all">{settings.upiId}</div>
              <button
                onClick={() => copyText(settings.upiId, setCopiedUpi)}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
              >
                {copiedUpi ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
          </div>

          {/* Open in UPI App */}
          <a
            href={upiLink}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 rounded-xl transition-all text-sm uppercase tracking-wider"
          >
            <Smartphone size={16} /> Open UPI App & Pay {formatCurrency(order.amountDue)}
          </a>

          <div className="mt-3 flex items-start gap-2 text-[var(--text-muted)] text-xs">
            <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
            After paying, fill the form below with your UTR number and upload a screenshot.
          </div>
        </div>
      )}

      {/* Bank Transfer Tab */}
      {activeTab === "bank" && (
        <div className="glass border border-[var(--border-color)] rounded-2xl p-6 mb-5">
          <h3 className="text-[var(--text-primary)] font-bold mb-5 flex items-center gap-2">
            <Building2 size={18} className="text-blue-400" /> Bank Account Details
          </h3>

          <div className="space-y-3">
            {[
              { label: "Account Name", value: settings.bankAccountName, canCopy: false },
              { label: "Account Number", value: settings.bankAccountNumber, canCopy: true, setter: setCopiedAcc, copied: copiedAcc },
              { label: "IFSC Code", value: settings.bankIfsc, canCopy: true, setter: setCopiedIfsc, copied: copiedIfsc },
              { label: "Account Type", value: "Current Account", canCopy: false },
              { label: "Bank", value: "Airtel Payments Bank", canCopy: false },
            ].map((row) => (
              <div key={row.label} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-[var(--text-muted)] text-xs">{row.label}</div>
                  <div className="font-mono text-[var(--text-primary)] font-semibold text-sm mt-0.5">{row.value}</div>
                </div>
                {row.canCopy && (
                  <button
                    onClick={() => copyText(row.value, row.setter!)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold transition-colors"
                  >
                    {row.copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 bg-blue-900/10 border border-blue-800/30 rounded-xl p-3 text-blue-300 text-xs">
            <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
            Use NEFT/IMPS/RTGS. Use order number <strong>#{order.orderNumber}</strong> as the payment reference.
          </div>
        </div>
      )}

      {/* Payment Submission Form */}
      <form onSubmit={handleSubmit} className="glass border border-[var(--border-color)] rounded-2xl p-6">
        <h3 className="text-[var(--text-primary)] font-bold mb-2">Submit Payment Proof</h3>
        <p className="text-[var(--text-muted)] text-xs mb-5">After transferring, submit your details below for verification.</p>

        {/* Screenshot Upload */}
        <div className="mb-4">
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            Payment Screenshot <span className="text-red-500">*</span>
          </label>
          {screenshotPreview ? (
            <div className="relative">
              <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
                <img src={screenshotPreview} alt="Screenshot preview" className="w-full max-h-40 object-contain bg-black" />
              </div>
              <div className="flex items-center gap-3 mt-2">
                {uploading ? (
                  <span className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><Spinner size={12} /> Uploading...</span>
                ) : uploadedUrl ? (
                  <span className="flex items-center gap-2 text-xs text-green-400"><CheckCircle2 size={12} /> Uploaded</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => { setScreenshot(null); setScreenshotPreview(null); setUploadedUrl(""); setUploadedKey(""); }}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <X size={12} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border-color)] hover:border-red-600/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
            >
              <Upload size={24} className="mx-auto text-[var(--text-muted)] mb-2" />
              <p className="text-[var(--text-secondary)] text-sm font-semibold">Click to upload screenshot</p>
              <p className="text-[var(--text-muted)] text-xs mt-1">JPG, PNG, WEBP · max 5 MB</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
        </div>

        {/* UTR Number */}
        <div className="mb-4">
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            UTR / Reference Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            minLength={10}
            value={form.utr}
            onChange={(e) => setForm({ ...form, utr: e.target.value.toUpperCase() })}
            placeholder="12-digit UTR or UPI reference"
            className="w-full themed-input border rounded-xl px-4 py-3 text-sm font-mono outline-none transition-colors focus:border-red-600/60"
          />
          <p className="text-[var(--text-muted)] text-xs mt-1">Found in your UPI app transaction history or bank SMS.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
              className="w-full themed-input border rounded-xl px-4 py-3 text-sm outline-none transition-colors focus:border-red-600/60"
            />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@company.com"
              className="w-full themed-input border rounded-xl px-4 py-3 text-sm outline-none transition-colors focus:border-red-600/60"
            />
          </div>
          <div>
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Phone <span className="text-red-500">*</span></label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              placeholder="10-digit number"
              className="w-full themed-input border rounded-xl px-4 py-3 text-sm outline-none transition-colors focus:border-red-600/60"
            />
          </div>
        </div>

        {submitError && (
          <div className="mb-4 flex items-center gap-2 bg-red-900/20 border border-red-900/40 rounded-xl px-4 py-3 text-red-400 text-sm">
            <AlertCircle size={14} className="flex-shrink-0" />
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || uploading || !uploadedUrl}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors text-sm uppercase tracking-wider"
        >
          {submitting ? <><Spinner size={16} /> Submitting...</> : "Submit for Verification"}
        </button>
      </form>
    </div>
  );
}
