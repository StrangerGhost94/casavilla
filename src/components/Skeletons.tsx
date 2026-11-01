/** Grey shapes in the layout of what's loading, shown instantly while the server prepares the page. */
export function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-stone-200/80 motion-reduce:animate-none ${className}`} />;
}

const Card = () => (
  <div className="overflow-hidden rounded-3xl border border-stone-200/70 bg-white shadow-card">
    <Bone className="h-44 w-full rounded-none" />
    <div className="space-y-2 p-4">
      <Bone className="h-6 w-2/5" />
      <Bone className="h-4 w-3/4" />
      <Bone className="h-3 w-1/2" />
      <div className="flex gap-3 border-t border-stone-100 pt-3"><Bone className="h-3 w-12" /><Bone className="h-3 w-12" /><Bone className="h-3 w-16" /></div>
    </div>
  </div>
);

/** Marketplace pages: dark band with a search box, then cards. */
export function MarketSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading">
      <section className="bg-brand-950">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-4 md:pb-8 md:pt-8">
          <div className="h-7 w-56 animate-pulse rounded-lg bg-white/15 motion-reduce:animate-none" />
          <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none" />
          <div className="mt-4 h-12 animate-pulse rounded-2xl bg-white/15 motion-reduce:animate-none" />
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 pt-5">
        <div className="flex gap-2 overflow-hidden">{[0, 1, 2, 3, 4].map((i) => <Bone key={i} className="h-8 w-24 shrink-0 rounded-full" />)}</div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Card key={i} />)}</div>
      </div>
    </main>
  );
}

/** One listing, stay, plot, plan or provider: big photo, details, action panel. */
export function DetailSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading" className="mx-auto max-w-6xl md:px-4 md:pt-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Bone className="h-72 w-full rounded-none md:h-96 md:rounded-3xl" />
          <div className="space-y-3 px-4 pt-5 md:px-0">
            <Bone className="h-5 w-28 rounded-full" />
            <Bone className="h-8 w-3/4" />
            <Bone className="h-4 w-1/2" />
            <Bone className="h-9 w-2/5" />
            <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Bone key={i} className="h-16 rounded-2xl" />)}</div>
          </div>
        </div>
        <div className="px-4 md:px-0"><div className="space-y-3 rounded-3xl border border-stone-200/70 bg-white p-5"><Bone className="h-5 w-1/2" /><Bone className="h-11 w-full rounded-xl" /><Bone className="h-11 w-full rounded-xl" /><Bone className="h-12 w-full rounded-xl" /></div></div>
      </div>
    </main>
  );
}

/** Dashboards and lists inside the signed-in areas. */
export function PortalSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="mx-auto max-w-5xl">
      <Bone className="h-7 w-52" />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Bone key={i} className="h-24 rounded-2xl" />)}</div>
      <div className="mt-5 divide-y divide-stone-100 rounded-2xl border border-stone-200/70 bg-white">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4"><Bone className="h-10 w-10 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Bone className="h-4 w-1/2" /><Bone className="h-3 w-3/4" /></div><Bone className="h-5 w-14 rounded-full" /></div>
        ))}
      </div>
    </div>
  );
}
