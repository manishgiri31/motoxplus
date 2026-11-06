import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth/me";
import { prisma } from "@/lib/prisma";
import { CategoryManager } from "@/components/admin/category-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const me = await getMe();
  if (!me || !["ADMIN", "SUPER_ADMIN"].includes(me.role)) redirect("/admin/dashboard");

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, slug: true, description: true, isActive: true, sortOrder: true, parentId: true,
      _count: { select: { products: true, vendors: true, children: true } },
    },
  });

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">Categories</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          One catalogue for the shop and for supplier applications. Deactivate instead of deleting — products and
          vendor approvals keep their category, but it disappears from the shop and the supplier form.
        </p>
      </div>
      <CategoryManager categories={categories} />
    </div>
  );
}
