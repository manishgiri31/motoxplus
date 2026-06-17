import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/product-form";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Add Product</h1>
        <p className="text-[var(--text-muted)] mt-1">Create a new product listing.</p>
      </div>
      <ProductForm categories={JSON.parse(JSON.stringify(categories))} />
    </div>
  );
}
