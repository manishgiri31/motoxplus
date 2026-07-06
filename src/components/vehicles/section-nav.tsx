"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface SectionOption {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export function SectionNav({
  sections,
  selectedSectionSlug,
}: {
  sections: SectionOption[];
  selectedSectionSlug: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (sections.length === 0) return null;

  function selectSection(slug: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("section", slug);
    else params.delete("section");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      <button
        onClick={() => selectSection(null)}
        className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors ${
          !selectedSectionSlug
            ? "bg-red-600 border-red-600 text-white"
            : "border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500"
        }`}
      >
        All Parts
      </button>
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => selectSection(s.slug)}
          className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors ${
            selectedSectionSlug === s.slug
              ? "bg-red-600 border-red-600 text-white"
              : "border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500"
          }`}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}
