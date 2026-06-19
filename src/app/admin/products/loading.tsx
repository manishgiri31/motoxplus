export default function AdminProductsLoading() {
  return (
    <div className="flex-1 p-6 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="skeleton h-7 w-28 rounded-sm" />
        <div className="skeleton h-9 w-36 rounded-sm" />
      </div>
      <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="skeleton h-8 w-64 rounded-sm" />
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="skeleton h-10 w-10 rounded-sm flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-4 w-48 rounded-sm" />
                <div className="skeleton h-3 w-28 rounded-sm" />
              </div>
              <div className="skeleton h-4 w-16 rounded-sm" />
              <div className="skeleton h-4 w-16 rounded-sm" />
              <div className="skeleton h-5 w-14 rounded-sm" />
              <div className="skeleton h-4 w-24 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
