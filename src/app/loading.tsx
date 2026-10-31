/** Root skeleton — mirrors the Apple-style home (hero, two tiles, card row) so the swap to real content doesn't shift. */
export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-white" role="status" aria-label="Loading">
      <div className="h-11 bg-white" />
      <div className="mx-auto flex w-[calc(100%-32px)] max-w-page flex-col items-center pt-14 md:pt-20">
        <div className="skeleton h-12 w-[min(90%,640px)] md:h-20" />
        <div className="skeleton mt-4 h-6 w-[min(80%,460px)]" />
        <div className="skeleton mt-6 h-11 w-40 !rounded-pill" />
        <div className="skeleton mt-12 aspect-[1920/1528] w-[min(100%,560px)]" />
        <div className="mt-16 grid w-full gap-5 md:grid-cols-2">
          <div className="skeleton h-[420px] !rounded-[18px] md:h-[560px]" />
          <div className="skeleton hidden h-[560px] !rounded-[18px] md:block" />
        </div>
      </div>
    </div>
  );
}
