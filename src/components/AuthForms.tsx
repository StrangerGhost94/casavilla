"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Building, Check, Eye, EyeOff, Home, KeyRound, Lock, Mail, Phone, User, UserRound, Wrench } from "lucide-react";
import { login, register } from "@/app/auth-actions";

function IconInput({ icon: I, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="relative">
      <I className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone-400" />
      {children}
    </div>
  );
}

function PasswordInput({ autoComplete, minLength }: { autoComplete: string; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <IconInput icon={Lock}>
      <input name="password" type={show ? "text" : "password"} required minLength={minLength} className="input pl-11 pr-11" placeholder="Password" autoComplete={autoComplete} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 hover:text-stone-600">
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </IconInput>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="next" value={next || ""} />
      <IconInput icon={Mail}><input name="email" type="email" required className="input pl-11" placeholder="Email address" autoComplete="email" /></IconInput>
      <PasswordInput autoComplete="current-password" />
      <div className="flex items-center justify-between text-xs">
        <label className="flex items-center gap-2 text-stone-600">
          <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 rounded accent-brand-700" /> Remember me
        </label>
        <a href="https://wa.me/256776593482?text=Hello%20CasaVilla%2C%20I%20forgot%20my%20password." className="font-semibold text-brand-700 hover:underline">Forgot password?</a>
      </div>
      {state?.error && <div className="rounded-xl bg-maroon-50 p-3 text-sm text-maroon-600">{state.error}</div>}
      <button className="btn-primary btn-lg w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="pt-2 text-center text-sm text-stone-500">Don&apos;t have an account? <Link href={`/register${next ? `?next=${next}` : ""}`} className="font-semibold text-brand-700 hover:underline">Sign up</Link></p>
    </form>
  );
}

const roles = [
  { id: "tenant", title: "Tenant", body: "Find a home, pay rent, request services", icon: UserRound, tone: "bg-brand-800 text-gold-300" },
  { id: "landlord", title: "Landlord", body: "List properties, track income, manage tenants", icon: Home, tone: "bg-gold-400 text-brand-950" },
  { id: "provider", title: "Service provider", body: "Offer your services, get hired", icon: Wrench, tone: "bg-brand-800 text-gold-300" },
] as const;

export function RegisterForm({ role: initial, next }: { role?: string; next?: string }) {
  const [state, action, pending] = useActionState(register, undefined);
  const [role, setRole] = useState<string>(roles.some((r) => r.id === initial) ? initial! : "tenant");
  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="next" value={next || ""} />
      <input type="hidden" name="role" value={role} />
      <div className="space-y-2.5">
        {roles.map((r) => {
          const on = role === r.id;
          return (
            <button type="button" key={r.id} onClick={() => setRole(r.id)} aria-pressed={on}
              className={`flex w-full items-center gap-3.5 rounded-2xl border bg-white p-3.5 text-left transition ${on ? "border-brand-700 ring-4 ring-brand-100" : "border-stone-200 hover:border-stone-300"}`}>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${r.tone}`}><r.icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-brand-950">{r.title}</span>
                <span className="block text-xs text-stone-500">{r.body}</span>
              </span>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300"}`}>{on && <Check className="h-3 w-3" />}</span>
            </button>
          );
        })}
      </div>
      <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Your details</div>
      <IconInput icon={User}><input name="name" required className="input pl-11" placeholder="Full name" autoComplete="name" /></IconInput>
      {role === "provider" && (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <IconInput icon={Building}><input name="businessName" className="input pl-11" placeholder="Business name" /></IconInput>
          <input name="area" className="input" placeholder="Area you serve, e.g. Rubaga" />
        </div>
      )}
      <IconInput icon={Phone}><input name="phone" required className="input pl-11" placeholder="Phone (Mobile Money), e.g. 0772 123456" autoComplete="tel" /></IconInput>
      <IconInput icon={Mail}><input name="email" type="email" required className="input pl-11" placeholder="Email address" autoComplete="email" /></IconInput>
      <PasswordInput autoComplete="new-password" minLength={8} />
      {role === "tenant" && <ExistingTenant />}
      {role !== "tenant" && <p className="text-xs text-stone-500">CasaVilla reviews new {role === "landlord" ? "landlords" : "providers"} before they appear publicly. You can set up your account straight away.</p>}
      {state?.error && <div className="rounded-xl bg-maroon-50 p-3 text-sm text-maroon-600">{state.error}</div>}
      <button className="btn-primary btn-lg w-full" disabled={pending}>{pending ? "Creating account…" : "Get started"}</button>
      <p className="pt-1 text-center text-sm text-stone-500">Already registered? <Link href="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link></p>
    </form>
  );
}

/** "Already renting?" — links a new tenant to their landlord by the landlord's phone number. */
export function ExistingTenant() {
  const [on, setOn] = useState(false);
  return (
    <div className={`rounded-2xl border p-3.5 transition ${on ? "border-brand-700 bg-brand-50/60" : "border-stone-200 bg-white"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="existing" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded accent-brand-700" />
        <span>
          <span className="block text-sm font-semibold text-brand-950">I already rent a home</span>
          <span className="block text-xs text-stone-500">Enter your landlord&apos;s phone number and we&apos;ll connect you, so you can pay rent and report repairs in the app.</span>
        </span>
      </label>
      {on && (
        <div className="mt-3 space-y-2.5">
          <IconInput icon={KeyRound}><input name="landlordPhone" required inputMode="tel" className="input pl-11" placeholder="Landlord's phone, e.g. 0772 123456" /></IconInput>
          <input name="unitNote" className="input" maxLength={120} placeholder="Your house / unit (optional), e.g. Rubaga Court Apt A2" />
          <p className="text-[11px] text-stone-500">Your landlord confirms before anything is linked. If they&apos;re not on CasaVilla yet, we&apos;ll invite them and connect you when they join.</p>
        </div>
      )}
    </div>
  );
}
