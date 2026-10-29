// Video tours: links to YouTube or TikTok (the videos stay there, so they cost us no storage or bandwidth).

export type Video = { kind: "youtube" | "tiktok"; id: string; url: string };

/** Reads a YouTube or TikTok link into its video id. Short TikTok links (vt./vm.tiktok.com) must be expanded first. */
export function parseVideo(raw: string | null | undefined): Video | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  const yt = (id: string | null | undefined) => (id && /^[\w-]{11}$/.test(id) ? { kind: "youtube" as const, id, url: `https://www.youtube.com/watch?v=${id}` } : null);
  if (host === "youtu.be") return yt(u.pathname.split("/")[1]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") return yt(u.searchParams.get("v"));
    const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/);
    return m ? yt(m[2]) : null;
  }
  if (host === "tiktok.com") {
    const m = u.pathname.match(/\/video\/(\d{8,25})/) ?? u.pathname.match(/^\/embed(?:\/v2)?\/(\d{8,25})/);
    return m ? { kind: "tiktok", id: m[1], url: `https://www.tiktok.com/video/${m[1]}` } : null;
  }
  return null;
}

export const isShortTikTok = (raw: string) => /^(https?:\/\/)?(vm|vt)\.tiktok\.com\//i.test(raw.trim());

/** Where the player loads from (privacy-friendly YouTube domain; no autoplay until tapped). */
export const embedUrl = (v: Video) =>
  v.kind === "youtube" ? `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1` : `https://www.tiktok.com/embed/v2/${v.id}`;

/** A still for the play button (YouTube only; TikTok shows a branded card). */
export const posterUrl = (v: Video) => (v.kind === "youtube" ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : null);
