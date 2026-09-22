export default function AccountOrdersLoading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8 space-y-2">
        <div className="skeleton h-8 w-32 rounded-sm" />
        <div className="skeleton h-4 w-28 rounded-sm" />
      </div>

      <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden">
        <div className="divide-y divide-white/5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-4 flex items-center gap-4">
              <div className="skeleton h-4 w-24 rounded-sm" />
              <div className="skeleton h-4 w-20 rounded-sm hidden md:block" />
              <div className="skeleton h-4 w-14 rounded-sm hidden sm:block" />
              <div className="skeleton h-4 w-16 rounded-sm ml-auto" />
              <div className="skeleton h-5 w-20 rounded-xl" />
              <div className="skeleton h-4 w-14 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
