"use client";
import { usePathname } from "next/navigation";
import { CardsSkeleton, MarketSkeleton } from "@/components/Skeletons";

/** The Build page opens with a tall hero; the pages under it (plans, projects) use the usual layout. */
export default function Loading() {
  if (usePathname() !== "/build") return <MarketSkeleton />;
  return (
    <main aria-busy="true" aria-label="Loading">
      <section className="bg-brand-950"><div className="mx-auto h-[26rem] max-w-6xl md:h-[30rem]" /></section>
      <CardsSkeleton />
    </main>
  );
}
