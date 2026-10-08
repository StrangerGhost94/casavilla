"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Home, ShieldCheck, Smartphone, UserRound, Wrench } from "lucide-react";
import { Logo } from "./ui";

const ONBOARDED = "cv_onboarded";
const ROLE = "cv_role";
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/** Full-bleed launch photo with gradients so the logo and text stay readable. */
function Photo({ className = "", zoom = false }: { className?: string; zoom?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/launch.jpg" alt="" aria-hidden draggable={false}
      className={`absolute inset-0 h-full w-full object-cover ${zoom ? "animate-ken-burns" : ""} ${className}`} />
  );
}

/* ---------- 1. Splash ---------- */
function Splash() {
  return (
    <div className="relative h-full overflow-hidden bg-brand-950 text-white">
      <Photo zoom />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
      <div className="absolute inset-x-0 top-[calc(11vh+env(safe-area-inset-top))] flex justify-center px-8">
        <Logo tone="light" size="xl" className="animate-fade-up [animation-delay:.15s]" />
      </div>
      <div className="absolute inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex flex-col items-center px-8 text-center">
        <div className="animate-fade-up whitespace-nowrap text-[clamp(1.3rem,6.6vw,1.75rem)] font-semibold leading-tight drop-shadow [animation-delay:.45s]">Connect. Manage. Grow.</div>
        <div className="mt-2 animate-fade-up text-[15px] text-white/85 drop-shadow [animation-delay:.6s]">All your property needs in one place.</div>
      </div>
      <div className="absolute bottom-[calc(2.25rem+env(safe-area-inset-bottom))] left-1/2 h-1 w-28 -translate-x-1/2 overflow-hidden rounded-full bg-white/20">
        <div className="h-full origin-left animate-load-bar rounded-full bg-gold-400" />
      </div>
    </div>
  );
}

/* ---------- 2. Role picker ---------- */
const roles = [
  { id: "tenant", title: "Tenant", body: "Find a home, pay rent, request services", icon: UserRound, tone: "bg-brand-800 text-gold-300" },
  { id: "landlord", title: "Landlord", body: "List properties, track income, manage tenants", icon: Home, tone: "bg-gold-400 text-brand-950" },
  { id: "provider", title: "Service provider", body: "Offer your services, get hired", icon: Wrench, tone: "bg-brand-800 text-gold-300" },
];

function RolePicker({ role, setRole, onNext }: { role: string; setRole: (r: string) => void; onNext: () => void }) {
  return (
    <div className="flex h-full flex-col bg-cream px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="flex animate-fade-up justify-center">
        <Logo size="md" />
      </div>
      <h1 className="mt-8 animate-fade-up text-[1.6rem] font-bold leading-tight text-brand-950 [animation-delay:.08s]">How do you want to use CasaVilla?</h1>
      <p className="mt-2 animate-fade-up text-sm text-stone-500 [animation-delay:.12s]">Select your role. You can open another account later.</p>
      <div className="mt-6 space-y-3">
        {roles.map((r, i) => {
          const on = role === r.id;
          return (
            <button key={r.id} type="button" onClick={() => setRole(r.id)} aria-pressed={on} style={{ animationDelay: `${0.16 + i * 0.06}s` }}
              className={`flex w-full animate-fade-up items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-card transition active:scale-[0.99] ${on ? "border-brand-700 ring-4 ring-brand-100" : "border-stone-200/80"}`}>
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${r.tone}`}><r.icon className="h-6 w-6" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-brand-950">{r.title}</span>
                <span className="block text-xs text-stone-500">{r.body}</span>
              </span>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${on ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300"}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-auto pt-6">
        <button type="button" onClick={onNext} className="btn-primary btn-lg w-full rounded-2xl py-4">Get started</button>
        <Link href="/login" className="mt-3 block text-center text-sm text-stone-500">Already have an account? <span className="font-semibold text-brand-700">Sign in</span></Link>
      </div>
    </div>
  );
}

/* ---------- 3. Intro slides ---------- */
const slides = [
  { title: "Better Living Starts Here", body: "Find, rent and manage homes — all in one trusted platform.", icon: Home },
  { title: "Pay Rent in Seconds", body: "MTN MoMo and Airtel Money, with an instant receipt every time.", icon: Smartphone },
  { title: "Repairs, Handled", body: "Report an issue with a photo and a vetted CasaVilla provider gets it done.", icon: ShieldCheck },
];

function Intro({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [i, setI] = useState(0);
  const start = useRef<number | null>(null);
  const go = (n: number) => setI(Math.max(0, Math.min(slides.length - 1, n)));
  const last = i === slides.length - 1;
  const S = slides[i];
  return (
    <div className="flex h-full flex-col bg-cream"
      onTouchStart={(e) => { start.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (start.current == null) return;
        const dx = e.changedTouches[0].clientX - start.current; start.current = null;
        if (dx < -40) (last ? onDone() : go(i + 1)); else if (dx > 40) go(i - 1);
      }}>
      <div className="relative h-[52%] shrink-0 overflow-hidden rounded-b-[2rem] bg-brand-950">
        <Photo />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/30" />
        <button type="button" onClick={i === 0 ? onBack : () => go(i - 1)} aria-label="Back"
          className="absolute left-5 top-[calc(1rem+env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={onDone} className="absolute right-5 top-[calc(1.4rem+env(safe-area-inset-top))] text-sm font-medium text-white/75">Skip</button>
        <div className="absolute inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] flex justify-center"><Logo tone="light" size="md" /></div>
        <div key={i} className="absolute bottom-6 left-1/2 flex h-16 w-16 -translate-x-1/2 animate-fade-up items-center justify-center rounded-2xl bg-gold-400 text-brand-950 shadow-float">
          <S.icon className="h-8 w-8" />
        </div>
      </div>
      <div className="flex flex-1 flex-col px-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-8 text-center">
        <div key={i} className="animate-fade-up">
          <h2 className="text-[1.65rem] font-bold leading-tight text-brand-950">{S.title}</h2>
          <p className="mx-auto mt-3 max-w-[17rem] text-sm leading-relaxed text-stone-500">{S.body}</p>
        </div>
        <div className="mt-7 flex justify-center gap-2">
          {slides.map((_, n) => (
            <button key={n} type="button" aria-label={`Slide ${n + 1}`} onClick={() => go(n)}
              className={`h-2 rounded-full transition-all duration-300 ${n === i ? "w-6 bg-brand-800" : "w-2 bg-stone-300"}`} />
          ))}
        </div>
        <div className="mt-auto pt-6">
          <button type="button" onClick={() => (last ? onDone() : go(i + 1))} className="btn-primary btn-lg w-full rounded-2xl py-4">{last ? "Create my account" : "Next"}</button>
          <Link href="/login" aria-hidden={!last} tabIndex={last ? 0 : -1} className={`mt-3 block text-sm text-stone-500 transition-opacity ${last ? "opacity-100" : "pointer-events-none opacity-0"}`}>I already have an account</Link>
        </div>
      </div>
    </div>
  );
}

/** The app's first-launch experience. Returning visitors see the splash, then go straight to sign in. */
export function AppIntro() {
  const router = useRouter();
  const [step, setStep] = useState<"splash" | "role" | "intro">("splash");
  const [role, setRole] = useState("tenant");

  useEffect(() => {
    const saved = store.get(ROLE);
    if (saved) setRole(saved);
    router.prefetch("/login");
    const t = setTimeout(() => {
      if (store.get(ONBOARDED)) router.replace("/login");
      else setStep("role");
    }, 1900);
    return () => clearTimeout(t);
  }, [router]);

  const finish = () => {
    store.set(ONBOARDED, "1");
    router.push(`/register?role=${role}`);
  };

  return (
    <main className="fixed inset-0 select-none overflow-hidden">
      <div key={step} className="h-full animate-fade-in">
        {step === "splash" && <Splash />}
        {step === "role" && <RolePicker role={role} setRole={(r) => { setRole(r); store.set(ROLE, r); }} onNext={() => setStep("intro")} />}
        {step === "intro" && <Intro onBack={() => setStep("role")} onDone={finish} />}
      </div>
    </main>
  );
}
