export default function ProductDetailLoading() {
  return (
    <div className="min-h-screen bg-[var(--paper)] animate-fade-in">
      {/* Breadcrumb */}
      <div className="border-b border-[var(--line)] px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <div className="skeleton h-3 w-10 rounded" />
          <div className="skeleton h-3 w-3 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-3 w-3 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16">
          {/* Gallery */}
          <div>
            <div className="skeleton aspect-square w-full rounded-sm mb-4" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton w-16 h-16 flex-shrink-0 rounded-sm" />
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="flex gap-2 mb-4">
              <div className="skeleton h-6 w-24 rounded-sm" />
              <div className="skeleton h-6 w-20 rounded-sm" />
            </div>
            <div className="skeleton h-9 w-4/5 rounded-sm mb-3" />
            <div className="skeleton h-4 w-2/5 rounded-sm mb-8" />

            <div className="border border-[var(--line)] p-5 mb-8 space-y-2">
              <div className="skeleton h-3 w-28 rounded" />
              <div className="skeleton h-9 w-40 rounded" />
              <div className="skeleton h-3 w-32 rounded" />
            </div>

            <div className="space-y-3 mb-8">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-9 w-16 rounded-sm" />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="skeleton h-12 w-32 rounded-sm" />
              <div className="skeleton h-12 flex-1 rounded-sm" />
            </div>
          </div>
        </div>

        {/* Related products */}
        <div>
          <div className="skeleton h-7 w-56 rounded mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--line)] border border-[var(--line)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[var(--card)]">
                <div className="skeleton h-36 w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-3 w-1/3 rounded" />
                  <div className="skeleton h-4 w-4/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
