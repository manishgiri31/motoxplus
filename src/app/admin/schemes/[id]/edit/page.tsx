import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SchemeForm } from "@/components/admin/scheme-form";

export default async function EditSchemePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  const [scheme, categories] = await Promise.all([
    prisma.scheme.findUnique({
      where: { id: params.id },
      include: { eligibleCategories: { select: { category: { select: { id: true } } } } },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!scheme) notFound();

  return (
    <div>
      <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight mb-8">Edit Scheme</h1>
      <SchemeForm
        categories={categories}
        scheme={{
          id: scheme.id,
          name: scheme.name,
          code: scheme.code,
          isActive: scheme.isActive,
          benefitPercent: scheme.benefitPercent,
          minOrderValue: scheme.minOrderValue,
          maxBenefitValue: scheme.maxBenefitValue,
          startsAt: scheme.startsAt.toISOString(),
          endsAt: scheme.endsAt.toISOString(),
          eligibleCategories: scheme.eligibleCategories,
        }}
      />
    </div>
  );
}
