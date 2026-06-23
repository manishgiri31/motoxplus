import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MarkupSettingsForm } from "@/components/admin/markup-settings-form";
import { UpiSettingsForm } from "@/components/admin/upi-settings-form";

const UPI_KEYS = ["upi_id", "upi_name", "upi_enabled", "bank_account_name", "bank_account_number", "bank_ifsc", "bank_account_type"];

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) redirect("/login");

  const markupSetting = await prisma.setting.findUnique({ where: { key: "vendor_markup_percent" } });
  const currentMarkup = markupSetting ? parseFloat(markupSetting.value) : 20;

  const upiSettings = await prisma.setting.findMany({ where: { key: { in: UPI_KEYS } } });
  const upiMap: Record<string, string> = {};
  for (const s of upiSettings) upiMap[s.key] = s.value;

  const vendorProductCount = await prisma.product.count({ where: { vendorId: { not: null } } });
  const pendingCount = await prisma.product.count({ where: { vendorId: { not: null }, isActive: false } });
  const liveCount = await prisma.product.count({ where: { vendorId: { not: null }, isActive: true } });

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
        initial={{
          upiId: upiMap.upi_id || "5118678468276SB1024@mairtel",
          upiName: upiMap.upi_name || "MotoXPlus India Private Limited",
          upiEnabled: upiMap.upi_enabled !== "false",
          bankAccountName: upiMap.bank_account_name || "MotoXPlus India Private Limited",
          bankAccountNumber: upiMap.bank_account_number || "7834839071",
          bankIfsc: upiMap.bank_ifsc || "AIRP0000001",
          bankAccountType: upiMap.bank_account_type || "Current",
        }}
      />

      <MarkupSettingsForm currentMarkup={currentMarkup} />
    </div>
  );
}
