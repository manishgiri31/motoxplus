import { getMe } from "@/lib/auth/me";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MarkupSettingsForm } from "@/components/admin/markup-settings-form";
import { UpiSettingsForm } from "@/components/admin/upi-settings-form";
import { CancellationPolicySettingsForm } from "@/components/admin/cancellation-policy-settings-form";
import { CANCELLATION_POLICY_ID, getCancellationPolicy } from "@/lib/orders/cancellation-policy";
import { formatDate } from "@/lib/utils";
import { UPI_SETTING_KEYS, isUpiFlagEnabled, toUpiFormInitial } from "@/lib/payments/upi-settings";

export default async function AdminSettingsPage() {
  const me = await getMe();
  if (!me || !["ADMIN", "SUPER_ADMIN"].includes(me.role)) redirect("/login");

  const markupSetting = await prisma.setting.findUnique({ where: { key: "vendor_markup_percent" } });
  const currentMarkup = markupSetting ? parseFloat(markupSetting.value) : 20;

  const upiSettings = await prisma.setting.findMany({ where: { key: { in: [...UPI_SETTING_KEYS] } } });
  const upiMap: Record<string, string> = {};
  for (const s of upiSettings) upiMap[s.key] = s.value;

  const vendorProductCount = await prisma.product.count({ where: { vendorId: { not: null } } });
  const pendingCount = await prisma.product.count({ where: { vendorId: { not: null }, isActive: false } });
  const liveCount = await prisma.product.count({ where: { vendorId: { not: null }, isActive: true } });

  const cancellationPolicy = await getCancellationPolicy();
  const cancellationPolicyRow = await prisma.cancellationPolicy.findUnique({ where: { id: CANCELLATION_POLICY_ID } });
  const cancellationPolicyUpdater = cancellationPolicyRow?.updatedById
    ? await prisma.user.findUnique({ where: { id: cancellationPolicyRow.updatedById }, select: { name: true } })
    : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Platform Settings</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Control global pricing and vendor markup settings</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Vendor Products", value: vendorProductCount, color: "text-blue-400" },
          { label: "Pending Review", value: pendingCount, color: "text-yellow-400" },
          { label: "Live", value: liveCount, color: "text-green-400" },
        ].map((stat) => (
          <div key={stat.label} className="glass border border-[var(--border-color)] rounded-xl p-4 text-center">
            <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <UpiSettingsForm
        // Stored values only; an unset field is "" and the form flags it "Not set".
        initial={toUpiFormInitial(upiMap, isUpiFlagEnabled(upiMap))}
      />

      <MarkupSettingsForm currentMarkup={currentMarkup} />

      <div className="mt-6">
        <CancellationPolicySettingsForm
          currentPreShip={cancellationPolicy.preShipChargePercent}
          currentPostShip={cancellationPolicy.postShipChargePercent}
          updatedAt={cancellationPolicyRow ? formatDate(cancellationPolicyRow.updatedAt) : null}
          updatedByName={cancellationPolicyUpdater?.name ?? null}
        />
      </div>
    </div>
  );
}
