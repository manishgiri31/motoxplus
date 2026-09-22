export default function AccountCartLoading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-8 w-24 rounded-sm" />
          <div className="skeleton h-4 w-20 rounded-sm" />
        </div>
        <div className="skeleton h-4 w-32 rounded-sm" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass border border-[var(--border-color)] rounded-sm p-4 flex items-center gap-4">
              <div className="skeleton w-16 h-16 rounded-sm flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-2.5 w-20 rounded" />
                <div className="skeleton h-4 w-48 rounded" />
                <div className="skeleton h-4 w-16 rounded" />
              </div>
              <div className="skeleton h-9 w-28 rounded-sm" />
              <div className="skeleton h-5 w-16 rounded-sm" />
            </div>
          ))}
        </div>

        <div>
          <div className="glass border border-[var(--border-color)] rounded-sm p-6 space-y-4">
            <div className="skeleton h-5 w-32 rounded-sm" />
            <div className="skeleton h-4 w-full rounded-sm" />
            <div className="skeleton h-6 w-full rounded-sm" />
            <div className="skeleton h-12 w-full rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
