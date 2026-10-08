import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="CasaVilla" className="h-16 w-auto" />
      <h1 className="mt-8 text-xl font-bold text-brand-950">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-xs text-sm text-stone-500">It may have been removed, or the link is out of date.</p>
      <Link href="/" className="btn-primary mt-6">Go to CasaVilla</Link>
    </main>
  );
}
