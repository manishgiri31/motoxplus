import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchResults } from "@/components/search/search-results";

export const metadata: Metadata = {
  title: "Search",
  description: "Search MotoXPlus spare parts, vehicles and help pages.",
  // Result pages are infinite and thin by nature; keep them out of the index.
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-white font-store">
      {/* useSearchParams() needs a Suspense boundary to keep the shell statically rendered */}
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
    </div>
  );
}
