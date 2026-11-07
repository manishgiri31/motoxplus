import { getMe } from "@/lib/auth/me";
import { prisma } from "@/lib/prisma";
import { listCategoryOptions } from "@/lib/catalog/category-options";
import { redirect } from "next/navigation";
import { VendorProductForm } from "@/components/vendor/vendor-product-form";
import { getVendorListableCategoryIds } from "@/lib/catalog/part-categories";

export default async function NewVendorProductPage() {
  const me = await getMe();
  if (!me || me.role !== "VENDOR") redirect("/login");

  const vendor = await prisma.vendor.findUnique({ where: { userId: me.id } });
  if (!vendor || vendor.status !== "APPROVED") redirect("/vendor/products");

  // Vendors who chose part categories when applying list only under those (a group covers its
  // subcategories); vendors from before the catalogue existed keep the full list.
  const listable = await getVendorListableCategoryIds(vendor.id);
  const categories = await listCategoryOptions({ isActive: true, ...(listable && { id: { in: [...listable] } }) });

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
