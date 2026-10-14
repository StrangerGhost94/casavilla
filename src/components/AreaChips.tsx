"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { NearMe } from "./NearMe";

/** Popular areas as one swipeable row. Picking one filters the whole home page; picking it again clears it. */
export function AreaChips({ areas, active }: { areas: string[]; active?: string }) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    row.current?.querySelector<HTMLElement>("[aria-current=true]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);
  return (
    <div ref={row} role="list" aria-label="Popular areas"
      className="-mx-4 flex snap-x items-center gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <NearMe />
      <Link href="/" scroll={false} role="listitem" aria-current={!active} className={`snap-start ${!active ? "chip-active" : "chip"}`}>All areas</Link>
      {areas.map((a) => {
        const on = active?.toLowerCase() === a.toLowerCase();
        return (
          <Link key={a} role="listitem" aria-current={on} scroll={false} href={on ? "/" : `/?area=${encodeURIComponent(a)}`} className={`snap-start ${on ? "chip-active" : "chip"}`}>
            {on ? <Check className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />} {a}
          </Link>
        );
      })}
    </div>
  );
}
