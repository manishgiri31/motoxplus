export default function VehicleDetailLoading() {
  return (
    <div className="min-h-screen bg-[var(--paper)] animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <div className="skeleton h-3 w-10 rounded" />
          <div className="skeleton h-3 w-3 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-3 rounded" />
          <div className="skeleton h-3 w-28 rounded" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-14">
          {/* Viewer / hero image */}
          <div className="skeleton w-full h-[420px] md:h-[520px] rounded-sm" />

          <div>
            <div className="skeleton h-3 w-24 rounded-full mb-4" />
            <div className="skeleton h-10 w-4/5 rounded-sm mb-6" />

            {/* Spec grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border border-[var(--line)] p-3 space-y-2">
                  <div className="skeleton h-2.5 w-2/3 rounded" />
                  <div className="skeleton h-4 w-1/2 rounded" />
                </div>
              ))}
            </div>

            {/* Color swatches */}
            <div className="flex gap-2 mb-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton w-9 h-9 rounded-full" />
              ))}
            </div>

            <div className="skeleton h-12 w-48 rounded-sm" />
          </div>
        </div>

        {/* Compatible parts section */}
        <div>
          <div className="skeleton h-7 w-64 rounded mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[var(--card)] border border-[var(--line)] overflow-hidden">
                <div className="skeleton h-40 w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-2.5 w-1/3 rounded" />
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
