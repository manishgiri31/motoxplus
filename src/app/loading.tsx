export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="min-h-screen flex flex-col items-center justify-center px-4 md:px-8 gap-8">
        <div className="skeleton h-6 w-64 rounded-full" />
        <div className="flex flex-col items-center gap-4">
          <div className="skeleton h-16 md:h-24 w-[280px] md:w-[520px] rounded-2xl" />
          <div className="skeleton h-16 md:h-24 w-[240px] md:w-[440px] rounded-2xl" />
        </div>
        <div className="skeleton h-5 w-[90%] max-w-xl rounded-full" />
        <div className="flex gap-4">
          <div className="skeleton h-14 w-44 rounded-xl" />
          <div className="skeleton h-14 w-44 rounded-xl" />
        </div>
        <div className="flex gap-4 w-full max-w-lg mt-8">
          <div className="skeleton h-24 flex-1 rounded-xl" />
          <div className="skeleton h-24 flex-1 rounded-xl" />
          <div className="skeleton h-24 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
