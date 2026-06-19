export default function OrdersLoading() {
  return (
    <div className="flex-1 p-6 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="skeleton h-7 w-28 rounded-sm" />
      </div>
      <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
        <div className="divide-y divide-[var(--border-color)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="skeleton h-5 w-32 rounded-sm" />
                <div className="skeleton h-5 w-20 rounded-sm" />
              </div>
              <div className="flex gap-4">
                <div className="skeleton h-4 w-24 rounded-sm" />
                <div className="skeleton h-4 w-28 rounded-sm" />
                <div className="skeleton h-4 w-20 rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
