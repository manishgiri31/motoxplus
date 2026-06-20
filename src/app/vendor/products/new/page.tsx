import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { VendorProductForm } from "@/components/vendor/vendor-product-form";

export default async function NewVendorProductPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") redirect("/login");

  const vendor = await prisma.vendor.findUnique({ where: { userId: session.user.id } });
  if (!vendor || vendor.status !== "APPROVED") redirect("/vendor/products");

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const markupSetting = await prisma.setting.findUnique({ where: { key: "vendor_markup_percent" } });
  const defaultMarkup = markupSetting ? parseFloat(markupSetting.value) : 20;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Submit Product</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Enter your product details and cost price. Our team will review and list it.
        </p>
      </div>
      <VendorProductForm categories={categories} defaultMarkup={defaultMarkup} />
    </div>
  );
}
