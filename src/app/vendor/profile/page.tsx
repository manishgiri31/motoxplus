import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Building2, MapPin, Phone, Mail, Globe, CreditCard } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  RAW_MATERIALS: "Raw Materials",
  PACKAGING: "Packaging",
  PRINTING: "Printing",
  LOGISTICS: "Logistics",
  MANUFACTURING_COMPONENTS: "Manufacturing Components",
  TOOLING: "Tooling",
  SERVICES: "Services",
};

export default async function VendorProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") redirect("/login");

  const vendor = await prisma.vendor.findUnique({
    where: { userId: session.user.id },
    include: { contacts: true },
  });

  if (!vendor) redirect("/login");

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">My Profile</h1>
        <p className="text-[var(--text-muted)] mt-1">Your vendor account information</p>
      </div>

      <div className="space-y-6">
        {/* Company Info */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-5">
            Company Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Row icon={Building2} label="Company" value={vendor.companyName} />
            <Row icon={Building2} label="Owner" value={vendor.ownerName} />
            <Row icon={Mail} label="Email" value={vendor.email} />
            <Row icon={Phone} label="Phone" value={vendor.phone} />
            <Row icon={Building2} label="Category" value={CATEGORY_LABELS[vendor.category] || vendor.category} />
            <Row icon={Building2} label="Vendor Code" value={vendor.vendorCode} mono />
            {vendor.gstNumber && <Row icon={Building2} label="GST" value={vendor.gstNumber} mono />}
            {vendor.panNumber && <Row icon={Building2} label="PAN" value={vendor.panNumber} mono />}
            {vendor.website && (
              <div className="flex items-start gap-3">
                <Globe size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-0.5">Website</div>
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-sm text-red-400 hover:text-red-300">
                    {vendor.website}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-5">
            Address
          </h2>
          <div className="flex items-start gap-3">
            <MapPin size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
            <div className="text-[var(--text-primary)] text-sm leading-relaxed">
              {vendor.address}
              <br />
              {vendor.city}, {vendor.state} — {vendor.pincode}
            </div>
          </div>
        </div>

        {/* Bank Details */}
        {(vendor.bankName || vendor.accountNumber || vendor.ifscCode) && (
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-5">
              Bank Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {vendor.bankName && <Row icon={Building2} label="Bank" value={vendor.bankName} />}
              {vendor.accountNumber && (
                <Row icon={CreditCard} label="Account" value={vendor.accountNumber} mono />
              )}
              {vendor.ifscCode && (
                <Row icon={CreditCard} label="IFSC" value={vendor.ifscCode} mono />
              )}
            </div>
            <p className="text-[var(--text-muted)] text-xs mt-4">
              To update bank details, contact the MOTOXPLUS procurement team.
            </p>
          </div>
        )}

        {/* Contacts */}
        {vendor.contacts.length > 0 && (
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-5">
              Contact Persons
            </h2>
            <div className="space-y-3">
              {vendor.contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between p-3 glass border border-[var(--border-color)] rounded-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-primary)] text-sm font-bold">{c.name}</span>
                      {c.isPrimary && (
                        <span className="text-[10px] text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                          Primary
                        </span>
                      )}
                    </div>
                    {c.designation && (
                      <div className="text-[var(--text-muted)] text-xs">{c.designation}</div>
                    )}
                    <div className="text-[var(--text-muted)] text-xs mt-1">
                      {c.phone}{c.email && ` · ${c.email}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass border border-[var(--border-color)] rounded-sm p-4">
          <p className="text-[var(--text-muted)] text-xs text-center">
            Registered on {formatDate(vendor.createdAt)} · Credit terms: {vendor.creditDays} days ·
            To update information, contact <span className="text-red-400">support@motoxplus.in</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-0.5">{label}</div>
        <div className={`text-[var(--text-primary)] text-sm font-medium ${mono ? "font-mono" : ""}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
