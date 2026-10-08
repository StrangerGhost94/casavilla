"use client";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

// Friendly screen for unexpected problems (instead of a blank "Application error" page).
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="CasaVilla" className="h-16 w-auto" />
      <h1 className="mt-8 text-xl font-bold text-brand-950">Something went wrong</h1>
      <p className="mt-2 max-w-xs text-sm text-stone-500">That didn&apos;t work as expected. Please try again — if it keeps happening, contact CasaVilla on WhatsApp +256 776 593 482.</p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={reset} className="btn-primary"><RefreshCw className="h-4 w-4" /> Try again</button>
        <Link href="/" className="btn-outline">Home</Link>
      </div>
    </main>
  );
}
