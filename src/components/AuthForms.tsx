"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { login, register } from "@/app/auth-actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next || ""} />
      <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
      <label className="block"><span className="label">Password</span><input name="password" type="password" required className="input" autoComplete="current-password" /></label>
      {state?.error && <div className="rounded-lg bg-maroon-50 p-3 text-sm text-maroon-600">{state.error}</div>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="text-center text-sm text-stone-500">New here? <Link href={`/register${next ? `?next=${next}` : ""}`} className="link">Create an account</Link></p>
    </form>
  );
}

const roles = [
  { id: "tenant", title: "Tenant", body: "I rent or want to rent a home" },
  { id: "landlord", title: "Landlord", body: "I own properties to rent out" },
  { id: "provider", title: "Service provider", body: "I offer services or sell items" },
] as const;

export function RegisterForm({ role: initial, next }: { role?: string; next?: string }) {
  const [state, action, pending] = useActionState(register, undefined);
  const [role, setRole] = useState<string>(roles.some((r) => r.id === initial) ? initial! : "tenant");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next || ""} />
      <input type="hidden" name="role" value={role} />
      <div className="grid gap-2 sm:grid-cols-3">
        {roles.map((r) => (
          <button type="button" key={r.id} onClick={() => setRole(r.id)}
            className={`rounded-xl border p-3 text-left ${role === r.id ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-stone-200 bg-white hover:border-stone-300"}`}>
            <div className="text-sm font-semibold">{r.title}</div>
            <div className="text-xs text-stone-500">{r.body}</div>
          </button>
        ))}
      </div>
      <label className="block"><span className="label">Full name</span><input name="name" required className="input" autoComplete="name" /></label>
      {role === "provider" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">Business name</span><input name="businessName" className="input" /></label>
          <label className="block"><span className="label">Area you serve</span><input name="area" className="input" placeholder="e.g. Rubaga, Kampala" /></label>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Phone (MoMo)</span><input name="phone" required className="input" placeholder="0772 123456" autoComplete="tel" /></label>
        <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
      </div>
      <label className="block"><span className="label">Password</span><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></label>
      {role !== "tenant" && <p className="text-xs text-stone-500">CasaVilla reviews new {role === "landlord" ? "landlords" : "providers"} before they appear publicly. You can set up your account straight away.</p>}
      {state?.error && <div className="rounded-lg bg-maroon-50 p-3 text-sm text-maroon-600">{state.error}</div>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
      <p className="text-center text-sm text-stone-500">Already registered? <Link href="/login" className="link">Sign in</Link></p>
    </form>
  );
}
