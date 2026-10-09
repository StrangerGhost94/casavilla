"use client";
import { startTransition, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Building, Check, Eye, EyeOff, Home, KeyRound, Lock, Mail, MessageCircle, Phone, ShieldCheck, User, UserRound, Wrench } from "lucide-react";
import { login, register, resetPassword, startPhoneCheck, type CodeState } from "@/app/auth-actions";

function IconInput({ icon: I, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="relative">
      <I className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone-400" />
      {children}
    </div>
  );
}

function PasswordInput({ autoComplete, minLength, placeholder = "Password" }: { autoComplete: string; minLength?: number; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <IconInput icon={Lock}>
      <input name="password" type={show ? "text" : "password"} required minLength={minLength} className="input pl-11 pr-11" placeholder={placeholder} autoComplete={autoComplete} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 hover:text-stone-600">
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </IconInput>
  );
}

/**
 * React clears a form after each action — fine for one-step forms, but the code step needs everything typed
 * before it. Submitting by hand keeps the fields (and still passes which button was pressed).
 */
const keepFields = (action: (fd: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
  startTransition(() => action(fd));
};

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="next" value={next || ""} />
      <IconInput icon={Mail}><input name="email" required className="input pl-11" placeholder="Email or phone number" autoComplete="username" /></IconInput>
      <PasswordInput autoComplete="current-password" />
      <div className="flex items-center justify-between text-xs">
        <label className="flex items-center gap-2 text-stone-600">
          <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 rounded accent-brand-700" /> Remember me
        </label>
        <Link href="/forgot" className="font-semibold text-brand-700 hover:underline">Forgot password?</Link>
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

export function RegisterForm({ role: initial, next, messaging = false }: { role?: string; next?: string; messaging?: boolean }) {
  const [state, action, pending] = useActionState(register, undefined);
  const [role, setRole] = useState<string>(roles.some((r) => r.id === initial) ? initial! : "tenant");
  const [editing, setEditing] = useState(false);
  const verifying = state?.step === "verify" && !editing;
  useEffect(() => { if (state?.step === "verify") setEditing(false); }, [state]);
  return (
    <form onSubmit={keepFields(action)} className="space-y-3.5">
      <input type="hidden" name="next" value={next || ""} />
      <input type="hidden" name="role" value={role} />
      {/* The details stay in the form (just hidden) while the code is checked, so nothing has to be typed twice. */}
      <div className={verifying ? "hidden" : "space-y-3.5"}>
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
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <IconInput icon={Building}><input name="businessName" className="input pl-11" placeholder="Business name" /></IconInput>
            <input name="area" className="input" placeholder="Area you serve, e.g. Rubaga" />
          </div>
        )}
        <IconInput icon={Phone}><input name="phone" required inputMode="tel" className="input pl-11" placeholder="Phone (Mobile Money), e.g. 0772 123456" autoComplete="tel" /></IconInput>
        <IconInput icon={Mail}><input name="email" type="email" required className="input pl-11" placeholder="Email address" autoComplete="email" /></IconInput>
        <PasswordInput autoComplete="new-password" minLength={8} />
        {role === "tenant" && <ExistingTenant />}
        {messaging && <label className="flex items-start gap-2.5 text-xs text-stone-600">
          <input type="checkbox" defaultChecked onChange={(e) => { const h = e.currentTarget.form?.elements.namedItem("optIn") as HTMLInputElement | null; if (h) h.value = e.currentTarget.checked ? "on" : "off"; }} className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-700" />
          <span>Send me rent reminders, receipts and updates on WhatsApp or SMS</span>
        </label>}
        <input type="hidden" name="optIn" defaultValue="on" />
        {role !== "tenant" && <p className="text-xs text-stone-500">CasaVilla reviews new {role === "landlord" ? "landlords" : "providers"} before they appear publicly. You can set up your account straight away.</p>}
      </div>
      {verifying && <CodeStep state={state} pending={pending} onBack={() => setEditing(true)} backLabel="Change my details" />}
      {state?.error && <div role="alert" className="rounded-xl bg-maroon-50 p-3 text-sm text-maroon-600">{state.error}</div>}
      {!verifying && <button className="btn-primary btn-lg w-full" disabled={pending}>{pending ? "Please wait…" : "Get started"}</button>}
      <p className="pt-1 text-center text-sm text-stone-500">Already registered? <Link href="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link></p>
    </form>
  );
}

/** "We sent a code to 0772 •••456" + the 6-digit box, a resend timer and the confirm button. */
function CodeStep({ state, pending, onBack, backLabel, confirmLabel = "Confirm & create account" }: { state: NonNullable<CodeState>; pending: boolean; onBack?: () => void; backLabel?: string; confirmLabel?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const wait = Math.max(0, 45 - Math.floor((now - (state.sentAt ?? 0)) / 1000));
  const via = state.channel === "whatsapp" ? "WhatsApp" : state.channel === "sms" ? "SMS" : "WhatsApp or SMS";
  return (
    <div className="space-y-3.5">
      <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white"><MessageCircle className="h-5 w-5" /></span>
        <div className="text-sm text-brand-950">
          <div className="font-semibold">Check your {via}</div>
          <div className="text-stone-600">We sent a 6-digit code to <b>{state.sentTo}</b>.</div>
        </div>
      </div>
      {state.testCode && <div className="rounded-xl border border-dashed border-gold-400 bg-gold-50 p-3 text-xs text-gold-700">Test mode — WhatsApp/SMS isn&apos;t connected yet, so the code is shown here: <b className="font-mono text-base tracking-widest">{state.testCode}</b></div>}
      <IconInput icon={ShieldCheck}>
        <input name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} autoFocus
          className="input pl-11 font-mono text-lg tracking-[0.4em]" placeholder="••••••"
          onInput={(e) => { const el = e.currentTarget; el.value = el.value.replace(/\D/g, "").slice(0, 6); if (el.value.length === 6) el.form?.requestSubmit(); }} />
      </IconInput>
      <button className="btn-primary btn-lg w-full" disabled={pending}>{pending ? "Checking…" : confirmLabel}</button>
      <div className="flex items-center justify-between text-xs">
        {onBack ? <button type="button" onClick={onBack} className="font-semibold text-stone-500 hover:text-stone-700">← {backLabel}</button> : <span />}
        <button type="submit" name="intent" value="resend" formNoValidate disabled={wait > 0 || pending} className="font-semibold text-brand-700 disabled:text-stone-400">
          {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
        </button>
      </div>
    </div>
  );
}

/** Forgot password: phone → code → new password (and which account, if the number has several). */
export function ForgotForm() {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const [phone, setPhone] = useState("");
  const step = state?.step;
  return (
    <form onSubmit={keepFields(action)} className="space-y-3.5">
      <div className={step ? "hidden" : ""}>
        <IconInput icon={Phone}><input name="phone" required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input pl-11" placeholder="Phone number on your account" autoComplete="tel" /></IconInput>
      </div>
      {step === "verify" && <CodeStep state={state!} pending={pending} confirmLabel="Continue" />}
      {step === "choose" && (
        <>
          <input type="hidden" name="ticket" value={state!.ticket} />
          <div className="flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900"><Check className="h-4 w-4" /> Number confirmed. Choose a new password.</div>
          {state!.accounts && (
            <fieldset className="space-y-2">
              <legend className="label">Which account?</legend>
              {state!.accounts.map((a) => (
                <label key={a.id} className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white p-3 text-sm has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50">
                  <input type="radio" name="account" value={a.id} required className="accent-brand-700" /> {a.label}
                </label>
              ))}
            </fieldset>
          )}
          <PasswordInput autoComplete="new-password" minLength={8} placeholder="New password (8+ characters)" />
          <button className="btn-primary btn-lg w-full" disabled={pending}>{pending ? "Saving…" : "Save & sign in"}</button>
        </>
      )}
      {state?.error && <div role="alert" className="rounded-xl bg-maroon-50 p-3 text-sm text-maroon-600">{state.error}</div>}
      {!step && <button className="btn-primary btn-lg w-full" disabled={pending}>{pending ? "Sending…" : "Send me a code"}</button>}
      <p className="pt-1 text-center text-sm text-stone-500"><Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link></p>
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

/** "Confirm your number" on the profile, for accounts made before phone codes existed. */
export function PhoneCheck() {
  const [state, action, pending] = useActionState(startPhoneCheck, undefined);
  if (state?.step === "done") return <div className="flex items-center gap-2 text-sm font-semibold text-brand-700"><Check className="h-4 w-4" /> Number confirmed</div>;
  return (
    <form onSubmit={keepFields(action)} className="space-y-3">
      {state?.step === "verify" ? <CodeStep state={state} pending={pending} confirmLabel="Confirm number" /> : <button className="btn-outline btn-sm" disabled={pending}>{pending ? "Sending…" : "Confirm my number"}</button>}
      {state?.error && <div role="alert" className="rounded-xl bg-maroon-50 p-3 text-sm text-maroon-600">{state.error}</div>}
    </form>
  );
}
