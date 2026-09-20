import { prisma } from "@/lib/prisma";
import { SchemeForm } from "@/components/admin/scheme-form";

export default async function NewSchemePage() {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });

  return (
    <div>
      <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight mb-8">New GST Benefit Scheme</h1>
      <SchemeForm categories={categories} />
    </div>
  );
}
