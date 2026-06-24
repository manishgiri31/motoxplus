import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { ProductVariantManager } from "@/components/admin/product-variant-manager";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id: params.id },
      include: { productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] } },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Edit Product</h1>
        <p className="text-[var(--text-muted)] mt-1">{product.name}</p>
      </div>
      <ProductForm
        categories={JSON.parse(JSON.stringify(categories))}
        product={JSON.parse(JSON.stringify(product))}
      />
      <ProductVariantManager productId={params.id} />
    </div>
  );
}
