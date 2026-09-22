export default function ProductsLoading() {
  return (
    <div className="min-h-screen bg-[var(--paper)] animate-fade-in">
      {/* Header */}
      <section className="py-14 px-4 md:px-8 border-b border-[var(--line)]">
        <div className="max-w-7xl mx-auto">
          <div className="skeleton h-3 w-32 rounded-full mb-4" />
          <div className="skeleton h-9 w-72 rounded-sm mb-3" />
          <div className="skeleton h-4 w-96 max-w-full rounded-sm" />
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        {/* Category chips row */}
        <div className="flex gap-2 mb-8 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Product grid — matches ProductCatalog's card shape */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--line)] overflow-hidden">
              <div className="skeleton h-48 w-full rounded-none" />
              <div className="p-4 space-y-2">
                <div className="skeleton h-2.5 w-1/3 rounded" />
                <div className="skeleton h-4 w-4/5 rounded" />
                <div className="skeleton h-4 w-3/5 rounded" />
                <div className="pt-3 mt-1 border-t border-[var(--line)] space-y-1.5">
                  <div className="skeleton h-2.5 w-2/5 rounded" />
                  <div className="skeleton h-6 w-1/2 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
