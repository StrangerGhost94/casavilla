import "server-only";
import { fail } from "./flash";
import { isShortTikTok, parseVideo } from "./video";

/** Reads the optional "video tour" link from a form: a YouTube or TikTok video; short TikTok links are expanded. */
export async function readVideoUrl(fd: FormData): Promise<string | null> {
  let raw = String(fd.get("videoUrl") ?? "").trim().slice(0, 500);
  if (!raw) return null;
  if (isShortTikTok(raw)) {
    // vt.tiktok.com/… redirects to the full link with the video number.
    try {
      const r = await fetch(/^https?:/i.test(raw) ? raw : `https://${raw}`, { redirect: "manual", signal: AbortSignal.timeout(6000) });
      raw = r.headers.get("location") ?? raw;
    } catch { /* falls through to the message below */ }
  }
  const v = parseVideo(raw);
  if (!v) return fail("Paste a YouTube or TikTok video link, e.g. https://youtu.be/… or https://www.tiktok.com/@name/video/…");
  return v.url;
}
