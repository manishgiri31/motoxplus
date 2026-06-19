export default function AdminLoading() {
  return (
    <div className="flex-1 p-6 md:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-7 w-40 rounded-sm" />
          <div className="skeleton h-4 w-28 rounded-sm" />
        </div>
        <div className="skeleton h-9 w-32 rounded-sm" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass border border-[var(--border-color)] rounded-sm p-5 space-y-3">
            <div className="skeleton h-3 w-20 rounded-sm" />
            <div className="skeleton h-8 w-28 rounded-sm" />
            <div className="skeleton h-3 w-16 rounded-sm" />
          </div>
        ))}
      </div>

      <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-3">
          <div className="skeleton h-5 w-24 rounded-sm" />
          <div className="skeleton h-8 w-56 rounded-sm ml-auto" />
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="skeleton h-4 w-28 rounded-sm" />
              <div className="skeleton h-4 w-40 flex-1 rounded-sm" />
              <div className="skeleton h-4 w-20 rounded-sm" />
              <div className="skeleton h-5 w-16 rounded-sm" />
              <div className="skeleton h-4 w-12 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
