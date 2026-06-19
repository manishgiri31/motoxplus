export default function AdminOrdersLoading() {
  return (
    <div className="flex-1 p-6 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="skeleton h-7 w-28 rounded-sm" />
        <div className="skeleton h-9 w-36 rounded-sm" />
      </div>
      <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
        <div className="divide-y divide-[var(--border-color)]">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="skeleton h-4 w-28 rounded-sm" />
              <div className="skeleton h-4 w-36 flex-1 rounded-sm" />
              <div className="skeleton h-4 w-20 rounded-sm" />
              <div className="skeleton h-5 w-24 rounded-sm" />
              <div className="skeleton h-7 w-28 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
