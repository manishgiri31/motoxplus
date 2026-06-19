export default function ProductsLoading() {
  return (
    <div className="flex-1 p-6 md:p-8 animate-fade-in">
      <div className="flex gap-4 mb-6">
        <div className="skeleton h-10 flex-1 rounded-sm" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-20 rounded-sm" />
          ))}
        </div>
      </div>
      <div className="skeleton h-4 w-36 mb-4 rounded-sm" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
            <div className="skeleton h-36 w-full" />
            <div className="p-4 space-y-3">
              <div className="skeleton h-3 w-32 rounded-sm" />
              <div className="skeleton h-4 w-full rounded-sm" />
              <div className="skeleton h-3 w-20 rounded-sm" />
              <div className="flex items-center justify-between">
                <div className="skeleton h-6 w-24 rounded-sm" />
                <div className="skeleton h-5 w-16 rounded-sm" />
              </div>
              <div className="skeleton h-9 w-full rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
