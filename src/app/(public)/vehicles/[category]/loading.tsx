export default function VehicleCategoryLoading() {
  return (
    <div className="min-h-screen bg-[var(--paper)] animate-fade-in">
      <section className="py-14 px-4 md:px-8 border-b border-[var(--line)]">
        <div className="max-w-7xl mx-auto">
          <div className="skeleton h-3 w-24 rounded-full mb-4" />
          <div className="skeleton h-9 w-56 rounded-sm mb-3" />
          <div className="skeleton h-4 w-72 rounded-sm" />
        </div>
      </section>

      <section className="py-16 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="skeleton h-12 w-full max-w-md rounded-lg mb-10" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-[var(--border-color)]">
                <div className="skeleton h-40 w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-3 w-1/3 rounded" />
                  <div className="skeleton h-5 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
