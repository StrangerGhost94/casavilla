"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, X } from "lucide-react";

/** Shows ?error=… from a refused action as a banner at the top of the screen, then tidies the URL. */
export function Flash() {
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const error = params.get("error");
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    setShown(error);
    window.dispatchEvent(new Event("cv-error")); // cancels any "Saved" tick on submit buttons
    const rest = new URLSearchParams(params.toString()); rest.delete("error");
    router.replace(path + (rest.size ? `?${rest}` : ""), { scroll: false });
    const t = setTimeout(() => setShown(null), 7000);
    return () => clearTimeout(t);
  }, [error, params, path, router]);

  if (!shown) return null;
  return (
    <div role="alert" className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[70] mx-auto max-w-md animate-fade-up">
      <div className="flex items-start gap-3 rounded-2xl border border-maroon-100 bg-white p-3.5 text-sm text-stone-800 shadow-float">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-maroon-500" />
        <div className="flex-1">{shown}</div>
        <button type="button" onClick={() => setShown(null)} aria-label="Dismiss" className="-m-1 rounded-full p-1 text-stone-400 hover:text-stone-700"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
