import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { DeleteAccountDialog } from "@/components/dealer/delete-account-dialog";
import { VerificationStatusCard } from "@/components/auth/verification-status-card";

export default async function DealerProfilePage() {
  const session = await getServerSession(authOptions);
  const dealer = await prisma.dealer.findUnique({
    where: { userId: session!.user.id },
    include: { user: true },
  });

  if (!dealer) return null;

  const fields = [
    { label: "Company Name", value: dealer.companyName },
    { label: "Owner Name", value: dealer.ownerName },
    { label: "Email", value: dealer.user.email || "" },
    { label: "Phone", value: dealer.phone },
    { label: "GST Number", value: dealer.gstNumber },
    { label: "Address", value: dealer.address },
    { label: "City", value: dealer.city },
    { label: "State", value: dealer.state },
    { label: "Pincode", value: dealer.pincode },
    { label: "Member Since", value: formatDate(dealer.createdAt) },
    { label: "Account Status", value: dealer.status },
  ];

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Profile</h1>
        <p className="text-[var(--text-muted)] mt-1">Your dealer account information.</p>
      </div>

      <div className="glass border border-[var(--border-color)] rounded-xl p-8">
        {/* Avatar */}
        <div className="flex items-center gap-6 mb-8 pb-8 border-b border-[var(--border-color)]">
          <div className="w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center">
            <span className="text-[var(--text-primary)] font-black text-2xl">
              {dealer.companyName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="text-[var(--text-primary)] font-black text-xl">{dealer.companyName}</div>
            <div className="text-[var(--text-muted)] text-sm">{dealer.ownerName}</div>
            <div className="mt-2 inline-flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="text-green-400 text-xs font-semibold uppercase tracking-widest">
                {dealer.status} Dealer
              </span>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fields.map((field) => (
            <div key={field.label}>
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-1">{field.label}</div>
              <div className={`text-sm font-semibold ${
                field.label === "Account Status"
                  ? field.value === "ACTIVE" ? "text-green-400" : "text-yellow-400"
                  : field.label === "GST Number"
                  ? "text-[var(--text-primary)] font-mono"
                  : "text-[var(--text-primary)]"
              }`}>
                {field.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--border-color)]">
          <p className="text-[var(--text-muted)] text-sm">
            To update your profile information, please contact{" "}
            <a href="mailto:support@motoxplus.in" className="text-red-400 hover:text-red-300">
              support@motoxplus.in
            </a>
          </p>
        </div>
      </div>

      <div className="mt-6">
        <VerificationStatusCard
          email={dealer.user.email}
          emailVerified={!!dealer.user.emailVerified}
          mobileVerified={dealer.user.mobileVerified}
          gstNumber={dealer.gstNumber}
          gstVerified={dealer.gstVerified}
          accountStatus={dealer.status}
        />
      </div>

      <DeleteAccountDialog />
    </div>
  );
}
