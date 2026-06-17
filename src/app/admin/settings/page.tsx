import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  Cloud,
  CreditCard,
  Globe,
  Building2,
  Lock,
} from "lucide-react";

function envStatus(key: string): "ok" | "placeholder" | "missing" {
  const val = process.env[key];
  if (!val) return "missing";
  if (val.startsWith("your_") || val.startsWith("your-") || val.includes("your_") || val === "rzp_test_your_key_id") return "placeholder";
  return "ok";
}

function mask(val: string | undefined, show = 4): string {
  if (!val) return "—";
  if (val.length <= show) return "•".repeat(val.length);
  return val.slice(0, show) + "•".repeat(Math.min(val.length - show, 20));
}

function StatusIcon({ status }: { status: "ok" | "placeholder" | "missing" }) {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
  if (status === "placeholder") return <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
  return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
}

function StatusBadge({ status }: { status: "ok" | "placeholder" | "missing" }) {
  const cls =
    status === "ok"
      ? "bg-green-900/20 text-green-400"
      : status === "placeholder"
      ? "bg-yellow-900/20 text-yellow-400"
      : "bg-red-900/20 text-red-400";
  const label = status === "ok" ? "Configured" : status === "placeholder" ? "Placeholder" : "Missing";
  return <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm ${cls}`}>{label}</span>;
}

function Row({ label, value, status }: { label: string; value?: string; status?: "ok" | "placeholder" | "missing" }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-color)] last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {status && <StatusIcon status={status} />}
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      <div className="flex items-center gap-2 ml-4">
        {value && <span className="text-xs font-mono text-[var(--text-muted)] truncate max-w-[200px]">{value}</span>}
        {status && <StatusBadge status={status} />}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
        <Icon className="w-4 h-4 text-red-500" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isSuperAdmin) redirect("/admin/dashboard");

  // DB health check
  let dbOk = false;
  let dbStats = { products: 0, dealers: 0, orders: 0, users: 0 };
  try {
    const [products, dealers, orders, users] = await Promise.all([
      prisma.product.count(),
      prisma.dealer.count(),
      prisma.order.count(),
      prisma.user.count(),
    ]);
    dbOk = true;
    dbStats = { products, dealers, orders, users };
  } catch {}

  const r2Status = {
    accountId: envStatus("R2_ACCOUNT_ID"),
    accessKey: envStatus("R2_ACCESS_KEY_ID"),
    secretKey: envStatus("R2_SECRET_ACCESS_KEY"),
    bucket: envStatus("R2_BUCKET_NAME"),
    publicUrl: envStatus("R2_PUBLIC_URL"),
  };
  const r2AllOk = Object.values(r2Status).every((s) => s === "ok");

  const razorpayStatus = {
    keyId: envStatus("RAZORPAY_KEY_ID"),
    keySecret: envStatus("RAZORPAY_KEY_SECRET"),
  };
  const razorpayAllOk = Object.values(razorpayStatus).every((s) => s === "ok");

  const nextAuthStatus = {
    url: envStatus("NEXTAUTH_URL"),
    secret: envStatus("NEXTAUTH_SECRET"),
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Settings</h1>
        <p className="text-[var(--text-muted)] mt-1">System configuration and integration status</p>
      </div>

      {/* System health summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Database", ok: dbOk, icon: Database },
          { label: "Storage (R2)", ok: r2AllOk, icon: Cloud },
          { label: "Payments", ok: razorpayAllOk, icon: CreditCard },
          { label: "Auth", ok: nextAuthStatus.secret === "ok", icon: Lock },
        ].map(({ label, ok, icon: Icon }) => (
          <div key={label} className={`glass border rounded-sm p-4 flex flex-col items-center gap-2 ${ok ? "border-green-900/30" : "border-yellow-900/30"}`}>
            <Icon className={`w-5 h-5 ${ok ? "text-green-500" : "text-yellow-500"}`} />
            <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${ok ? "text-green-500" : "text-yellow-500"}`}>
              {ok ? "Ready" : "Check required"}
            </span>
          </div>
        ))}
      </div>

      {/* Database */}
      <Section icon={Database} title="Database">
        <Row
          label="Connection"
          value={mask(process.env.DATABASE_URL, 30)}
          status={dbOk ? "ok" : "missing"}
        />
        {dbOk && (
          <>
            <Row label="Users" value={String(dbStats.users)} />
            <Row label="Dealers" value={String(dbStats.dealers)} />
            <Row label="Products" value={String(dbStats.products)} />
            <Row label="Orders" value={String(dbStats.orders)} />
          </>
        )}
      </Section>

      {/* Company info */}
      <Section icon={Building2} title="Company Information">
        <Row label="Name" value={process.env.NEXT_PUBLIC_COMPANY_NAME || "—"} />
        <Row label="Email" value={process.env.NEXT_PUBLIC_COMPANY_EMAIL || "—"} />
        <Row label="Phone" value={process.env.NEXT_PUBLIC_COMPANY_PHONE || "—"} />
        <Row label="GST Number" value={process.env.NEXT_PUBLIC_COMPANY_GST || "—"} />
        <Row label="Address" value={process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "—"} />
        <Row label="WhatsApp" value={process.env.NEXT_PUBLIC_COMPANY_WHATSAPP || "—"} />
        <Row label="Website" value={process.env.NEXT_PUBLIC_COMPANY_WEBSITE || "—"} />
        <div className="py-3">
          <p className="text-xs text-[var(--text-muted)]">
            Edit company information in <code className="font-mono bg-[var(--bg-card)] px-1 py-0.5 rounded text-red-400">.env</code> and restart the server to apply changes.
          </p>
        </div>
      </Section>

      {/* App URL */}
      <Section icon={Globe} title="Application">
        <Row label="App URL" value={process.env.NEXT_PUBLIC_APP_URL} status={envStatus("NEXT_PUBLIC_APP_URL")} />
        <Row label="NextAuth URL" value={process.env.NEXTAUTH_URL} status={nextAuthStatus.url} />
        <Row label="NextAuth Secret" value={mask(process.env.NEXTAUTH_SECRET)} status={nextAuthStatus.secret} />
        <Row label="Node Environment" value={process.env.NODE_ENV || "development"} />
      </Section>

      {/* Cloudflare R2 */}
      <Section icon={Cloud} title="Cloudflare R2 Storage">
        <Row label="Account ID" value={mask(process.env.R2_ACCOUNT_ID)} status={r2Status.accountId} />
        <Row label="Access Key ID" value={mask(process.env.R2_ACCESS_KEY_ID)} status={r2Status.accessKey} />
        <Row label="Secret Access Key" value={mask(process.env.R2_SECRET_ACCESS_KEY)} status={r2Status.secretKey} />
        <Row label="Bucket Name" value={process.env.R2_BUCKET_NAME} status={r2Status.bucket} />
        <Row label="Public URL" value={process.env.R2_PUBLIC_URL} status={r2Status.publicUrl} />
        {!r2AllOk && (
          <div className="py-3">
            <p className="text-xs text-yellow-500">
              R2 credentials are not fully configured. Image uploads will fail until all values are set in <code className="font-mono bg-[var(--bg-card)] px-1 py-0.5 rounded">.env</code>.
            </p>
          </div>
        )}
      </Section>

      {/* Razorpay */}
      <Section icon={CreditCard} title="Razorpay Payments">
        <Row label="Key ID" value={mask(process.env.RAZORPAY_KEY_ID, 8)} status={razorpayStatus.keyId} />
        <Row label="Key Secret" value={mask(process.env.RAZORPAY_KEY_SECRET)} status={razorpayStatus.keySecret} />
        {!razorpayAllOk && (
          <div className="py-3">
            <p className="text-xs text-yellow-500">
              Razorpay keys are not configured. Payment processing will fail until real keys are set in <code className="font-mono bg-[var(--bg-card)] px-1 py-0.5 rounded">.env</code>.
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}
