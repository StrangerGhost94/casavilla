"use client";
import { useState } from "react";
import { Play } from "lucide-react";
import { embedUrl, parseVideo, posterUrl } from "@/lib/video";

/**
 * The listing's video tour. Shows a still with a play button and loads the player only when tapped,
 * so the page stays light on mobile data.
 */
export function VideoTour({ url, title }: { url: string; title: string }) {
  const [on, setOn] = useState(false);
  const v = parseVideo(url);
  if (!v) return null;
  const tall = v.kind === "tiktok";
  const poster = posterUrl(v);
  return (
    <section id="video" className="mt-6 scroll-mt-20">
      <h2 className="h2">Video tour</h2>
      <div className={`relative mt-2 overflow-hidden rounded-2xl bg-brand-950 ${tall ? "mx-auto aspect-[9/16] max-h-[36rem] w-full max-w-xs" : "aspect-video w-full"}`}>
        {on ? (
          <iframe src={embedUrl(v)} title={`Video tour: ${title}`} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        ) : (
          <button type="button" onClick={() => setOn(true)} className="group absolute inset-0 flex items-center justify-center" aria-label={`Play the video tour of ${title}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {poster && <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />}
            {!poster && <span className="absolute inset-0 bg-gradient-to-br from-brand-800 to-brand-950" />}
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-brand-900 shadow-float transition group-hover:scale-105"><Play className="ml-1 h-7 w-7 fill-current" /></span>
            <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">{v.kind === "youtube" ? "YouTube" : "TikTok"} · tap to play</span>
          </button>
        )}
      </div>
    </section>
  );
}
