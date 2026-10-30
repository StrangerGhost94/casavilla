"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLink({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn-outline btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* blocked */ } }}>
      {done ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> {label}</>}
    </button>
  );
}
