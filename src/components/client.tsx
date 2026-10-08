"use client";
import { useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";

export function Submit({ children, className = "btn-primary", pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText ?? "Working…" : children}
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

/** Dashed "Add photo" box that previews the chosen image. */
export function PhotoPicker({ name }: { name: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <label className="flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-white text-stone-500 transition hover:border-brand-400 hover:text-brand-700">
      <input type="file" name={name} accept="image/*" className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
      {preview
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={preview} alt="Selected photo" className="h-40 w-full object-cover" />
        : <span className="flex flex-col items-center gap-1.5 py-7 text-xs font-medium"><Camera className="h-6 w-6" /> Add photo <span className="font-normal text-stone-400">JPG or PNG, up to 5 MB</span></span>}
    </label>
  );
}
