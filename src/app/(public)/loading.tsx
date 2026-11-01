"use client";
import { usePathname } from "next/navigation";
import { HomeSkeleton, MarketSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return usePathname() === "/" ? <HomeSkeleton /> : <MarketSkeleton />;
}
