export default function PublicLoading() {
  return (
    <div className="min-h-[70vh] px-4 md:px-8 py-16">
      <div className="max-w-7xl mx-auto">
        <div className="skeleton h-3 w-40 rounded-full mb-4" />
        <div className="skeleton h-10 w-2/3 max-w-lg rounded-xl mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-[var(--border-color)]">
              <div className="skeleton h-48 w-full rounded-none" />
              <div className="p-4 space-y-2.5">
                <div className="skeleton h-3 w-1/3 rounded" />
                <div className="skeleton h-4 w-4/5 rounded" />
                <div className="skeleton h-3 w-2/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
