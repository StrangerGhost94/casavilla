"use client";
import { useEffect, useState } from "react";
import { Moon } from "lucide-react";

type Theme = "auto" | "light" | "dark";
const OPTIONS: { value: Theme; label: string }[] = [
  { value: "auto", label: "Automatic" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Profile → Appearance. Saved on this device only; layout.tsx applies it before the page draws. */
export function ThemeChoice() {
  const [theme, setTheme] = useState<Theme>("auto");
  useEffect(() => {
    try {
      const t = localStorage.getItem("cv-theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    try {
      if (t === "auto") localStorage.removeItem("cv-theme");
      else localStorage.setItem("cv-theme", t);
    } catch {}
    if (t === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Moon className="h-[18px] w-[18px]" /></span>
      <span className="min-w-[10rem] flex-1">
        <span className="block text-sm font-medium text-stone-800">Appearance</span>
        <span className="block text-xs text-stone-500">{theme === "auto" ? "Follows your phone's light or dark mode" : `Always ${theme}`}</span>
      </span>
      <div role="radiogroup" aria-label="Appearance" className="ml-12 flex rounded-xl border border-stone-200 bg-stone-50 p-0.5 sm:ml-0">
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={theme === o.value} onClick={() => choose(o.value)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${theme === o.value ? "bg-brand-800 text-white" : "text-stone-600 hover:text-brand-900"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
