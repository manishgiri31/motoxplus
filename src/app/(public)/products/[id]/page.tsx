import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductDetailClient } from "@/components/products/product-detail-client";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
  });
  if (!product) return { title: "Product Not Found" };
  return { title: product.name, description: product.description || undefined };
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id, isActive: true },
    include: {
      category: true,
      productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });

  if (!product) notFound();

  const relatedProducts = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: product.id },
      isActive: true,
    },
    take: 4,
    include: {
      category: true,
      productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Breadcrumb */}
      <div className="border-b border-white/5 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Link href="/" className="hover:text-red-400 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-red-400 transition-colors">Products</Link>
          <span>/</span>
          <Link href={`/products?category=${product.category.slug}`} className="hover:text-red-400 transition-colors">
            {product.category.name}
          </Link>
          <span>/</span>
          <span className="text-[var(--text-primary)]">{product.name}</span>
        </div>
      </div>

      <ProductDetailClient
        product={JSON.parse(JSON.stringify(product))}
        relatedProducts={JSON.parse(JSON.stringify(relatedProducts))}
      />
    </div>
  );
}
