export default function DealerCheckoutLoading() {
  return (
    <div className="flex-1 p-6 md:p-8 animate-fade-in">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="skeleton h-8 w-40 rounded-sm" />

        {/* Delivery address card */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6 space-y-4">
          <div className="skeleton h-5 w-40 rounded-sm" />
          <div className="skeleton h-11 w-full rounded-sm" />
          <div className="skeleton h-11 w-full rounded-sm" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-11 w-full rounded-sm" />
            <div className="skeleton h-11 w-full rounded-sm" />
          </div>
        </div>

        {/* Order summary card */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6 space-y-3">
          <div className="skeleton h-5 w-32 rounded-sm" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="skeleton h-4 w-40 rounded" />
              <div className="skeleton h-4 w-16 rounded" />
            </div>
          ))}
          <div className="skeleton h-6 w-full rounded-sm mt-2" />
        </div>

        <div className="skeleton h-14 w-full rounded-sm" />
      </div>
    </div>
  );
}
