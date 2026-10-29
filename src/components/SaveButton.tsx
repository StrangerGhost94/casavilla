"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleSaved } from "@/app/saved-actions";

type Kind = "rent" | "stay" | "sale";
type Saved = { signedIn: boolean } & Record<Kind, number[]>;

// One request per page for all the hearts on it.
let loading: Promise<Saved> | null = null;
const load = () => (loading ??= fetch("/api/saved", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ signedIn: false, rent: [], stay: [], sale: [] })));

/** The heart on cards and listing pages. */
export function SaveButton({ kind, id, variant = "card" }: { kind: Kind; id: number; variant?: "card" | "page" }) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { load().then((s) => setSaved(s[kind]?.includes(id) ?? false)); }, [kind, id]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    const s = await load();
    if (!s.signedIn) { router.push(`/login?next=${encodeURIComponent(path)}`); return; }
    setBusy(true); setSaved((x) => !x);
    const now = await toggleSaved(kind, id).catch(() => null);
    if (now === null) setSaved((x) => !x);
    else { setSaved(now); const list: number[] = s[kind] ?? []; s[kind] = now ? [...list, id] : list.filter((x: number) => x !== id); }
    setBusy(false);
  };

  const on = !!saved;
  const size = variant === "page" ? "h-10 w-10" : "h-9 w-9";
  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={on ? "Remove from saved" : "Save this home"} title={on ? "Saved" : "Save"}
      className={`flex ${size} items-center justify-center rounded-full bg-white/90 shadow-card backdrop-blur transition active:scale-90 ${on ? "text-maroon-500" : "text-brand-900 hover:text-maroon-500"}`}>
      <Heart className={`h-5 w-5 ${on ? "fill-current" : ""}`} />
    </button>
  );
}
