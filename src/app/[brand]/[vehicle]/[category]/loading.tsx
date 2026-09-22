export default function BrandVehicleCategoryLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] animate-fade-in">
      {/* Breadcrumb + header */}
      <section className="py-16 px-4 md:px-8 border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <div className="skeleton h-3 w-10 rounded" />
            <div className="skeleton h-3 w-3 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-3 w-3 rounded" />
            <div className="skeleton h-3 w-16 rounded" />
          </div>
          <div className="skeleton h-11 w-3/4 max-w-xl rounded-sm mb-4" />
          <div className="skeleton h-4 w-full max-w-2xl rounded-sm" />
        </div>
      </section>

      {/* Product grid */}
      <section className="py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-[var(--border-color)]">
                <div className="skeleton h-44 w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-2.5 w-1/3 rounded" />
                  <div className="skeleton h-4 w-4/5 rounded" />
                  <div className="pt-3 border-t border-[var(--border-color)] space-y-1.5">
                    <div className="skeleton h-2.5 w-2/5 rounded" />
                    <div className="skeleton h-5 w-1/2 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
