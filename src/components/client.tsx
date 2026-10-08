"use client";
import { useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

/** Submit button: shows "Working…" while sending and a brief "✓ Saved" when the page stays put. */
export function Submit({ children, className = "btn-primary", pendingText, doneText = "Saved" }: { children: React.ReactNode; className?: string; pendingText?: string; doneText?: string }) {
  const { pending } = useFormStatus();
  const was = useRef(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (pending) { was.current = true; setDone(false); return; }
    if (!was.current) return;
    was.current = false; setDone(true);
    const t = setTimeout(() => setDone(false), 2200);
    return () => clearTimeout(t);
  }, [pending]);
  useEffect(() => {
    const off = () => setDone(false);
    window.addEventListener("cv-error", off);
    return () => window.removeEventListener("cv-error", off);
  }, []);
  return (
    <button type="submit" className={className} disabled={pending} aria-live="polite">
      {pending ? pendingText ?? "Working…" : done ? <><Check className="h-4 w-4" /> {doneText}</> : children}
    </button>
  );
}

export function ConfirmSubmit({ children, className = "btn-outline btn-sm", message }: { children: React.ReactNode; className?: string; message: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

export function PrintButton() {
  return <button className="btn-primary no-print" onClick={() => window.print()}>Print / Save PDF</button>;
}

export function AutoRefresh({ seconds = 4 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

/** Shrinks a photo to at most 1600px and re-encodes it as JPEG (also converts iPhone HEIC photos). */
async function shrinkImage(f: File): Promise<File | null> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.82));
    return blob ? new File([blob], f.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : null;
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

const isImage = (f: File) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);

/**
 * File input that makes phone photos upload-friendly: big photos are resized and HEIC is converted to JPEG
 * before the form is sent. Other files (PDF, Word) pass through untouched.
 */
export function FileInput({ onPicked, className = "input py-2", ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { onPicked?: (f: File | null) => void }) {
  return (
    <input {...props} type="file" className={className}
      onChange={async (e) => {
        const input = e.currentTarget;
        const f = input.files?.[0] ?? null;
        if (!f || !isImage(f) || (f.size < 1_000_000 && /jpe?g|png|webp/.test(f.type))) { onPicked?.(f); return; }
        input.setCustomValidity("Preparing your photo… try again in a moment");
        const small = await shrinkImage(f);
        if (small) { const dt = new DataTransfer(); dt.items.add(small); input.files = dt.files; }
        input.setCustomValidity("");
        onPicked?.(small ?? f);
      }} />
  );
}

/** Dashed "Add photo" box that previews the chosen image. */
export function PhotoPicker({ name }: { name: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <label className="flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-white text-stone-500 transition hover:border-brand-400 hover:text-brand-700">
      <FileInput name={name} accept="image/*" className="sr-only" onPicked={(f) => setPreview(f ? URL.createObjectURL(f) : null)} />
      {preview
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={preview} alt="Selected photo" className="h-40 w-full object-cover" />
        : <span className="flex flex-col items-center gap-1.5 py-7 text-xs font-medium"><Camera className="h-6 w-6" /> Add photo <span className="font-normal text-stone-400">Take one or choose from your phone</span></span>}
    </label>
  );
}

/** Round back button for full-screen pages; falls back to `href` when there's no history. */
export function BackButton({ href = "/", className = "" }: { href?: string; className?: string }) {
  const router = useRouter();
  return (
    <button type="button" aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push(href))}
      className={`flex h-10 w-10 items-center justify-center rounded-full ${className}`}>
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}

/** A <details> dropdown that closes on outside tap, on tapping a link inside it, and when the page changes. */
export function AutoCloseDetails({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [path]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => { const d = ref.current; if (d?.open && !d.contains(e.target as Node)) d.open = false; };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return (
    <details ref={ref} className={className}
      onClick={(e) => { if ((e.target as HTMLElement).closest("a") && ref.current) ref.current.open = false; }}>
      {children}
    </details>
  );
}
