"use client";
import { useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";

const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const isIOS = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function nameFrom(res: Response, fallback: string) {
  const m = /filename="?([^";]+)"?/i.exec(res.headers.get("Content-Disposition") ?? "");
  try { return m?.[1] ? decodeURIComponent(m[1]) : fallback; } catch { return m?.[1] ?? fallback; }
}

/**
 * Gets a file (PDF receipt, agreement, uploaded document) without ever leaving the app.
 * Opening a PDF inside the installed app leaves no way back, so instead:
 *  - phones: the system share sheet (Save to Files / Print / WhatsApp / open), which shows a preview;
 *  - computers & Android browsers: a normal download.
 */
export async function getFile(href: string, fallbackName: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(href, { signal: ctrl.signal, credentials: "same-origin" });
    if (!res.ok) throw new Error(res.status === 401 ? "Please sign in again" : res.status === 404 ? "File not found" : "Couldn't get the file");
    const blob = await res.blob();
    const name = nameFrom(res, fallbackName);
    const file = new File([blob], name, { type: blob.type || "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if ((isStandalone() || isIOS()) && nav.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return "shared"; }
      catch (e) { if ((e as Error).name === "AbortError") return "cancelled"; /* fall through to download */ }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return "downloaded";
  } finally {
    clearTimeout(timer);
  }
}

export function FileButton({ href, name = "document.pdf", children, className = "btn-primary btn-sm" }: { href: string; name?: string; children?: React.ReactNode; className?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [msg, setMsg] = useState("");
  return (
    <span className="inline-flex flex-col">
      <button type="button" className={className} disabled={state === "busy"}
        onClick={async () => {
          setState("busy"); setMsg("");
          try { await getFile(href, name); setState("idle"); }
          catch (e) { setState("error"); setMsg((e as Error).name === "AbortError" ? "It's taking too long — check your connection and try again" : (e as Error).message); }
        }}>
        {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {state === "busy" ? "Preparing…" : children ?? "Download PDF"}
      </button>
      {state === "error" && <span className="mt-1 text-[11px] text-maroon-600">{msg}</span>}
    </span>
  );
}

/** Tap-to-enlarge photo that stays inside the app (instead of opening the raw image with no way back). */
export function PhotoZoom({ src, alt, className, children }: { src: string; alt: string; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} aria-label={`View ${alt}`}>{children}</button>
      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/95 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]" onClick={() => setOpen(false)}>
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="truncate text-sm">{alt}</span>
            <button type="button" aria-label="Close" className="rounded-full bg-white/15 p-2"><X className="h-5 w-5" /></button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="m-auto max-h-[85vh] max-w-full object-contain" />
        </div>
      )}
    </>
  );
}

/**
 * Safety net for the installed app: any remaining link to a PDF or uploaded file is fetched and saved/shared
 * instead of being opened full-screen (which would leave the user stuck with no back button).
 */
export function StandaloneFileLinks() {
  useEffect(() => {
    if (!isStandalone()) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.("a") as HTMLAnchorElement | null;
      if (!a || !a.href || e.defaultPrevented) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return;
      if (!/\/pdf$|\/agreement$|^\/api\/files\//.test(u.pathname)) return;
      e.preventDefault();
      getFile(u.pathname + u.search, "document.pdf").catch(() => alert("Couldn't get the file — check your connection and try again."));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

/**
 * iPhone keeps the page nudged up after the keyboard closes (e.g. after typing in a search box), which leaves
 * the fixed bottom menu out of place. When a field loses focus or the keyboard goes away, snap the view back.
 */
export function ViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    let full = vv?.height ?? window.innerHeight;
    const settle = () => setTimeout(() => {
      if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      window.scrollTo(window.scrollX, window.scrollY);
      if (document.documentElement.scrollHeight <= window.innerHeight + 1) window.scrollTo(0, 0);
    }, 120);
    const onResize = () => { if (!vv) return; if (vv.height >= full - 1) settle(); full = Math.max(full, vv.height); };
    document.addEventListener("focusout", settle);
    vv?.addEventListener("resize", onResize);
    return () => { document.removeEventListener("focusout", settle); vv?.removeEventListener("resize", onResize); };
  }, []);
  return null;
}
