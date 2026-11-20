import { redirect } from "next/navigation";
import { getUser, homeFor } from "@/lib/auth";
import { OFFICE_RULES } from "@/lib/office-rules";
import { Logo } from "@/components/ui";
import { Submit } from "@/components/client";
import { completeOnboarding } from "@/app/control-actions";

export const metadata = { title: "Welcome to the CasaVilla office" };
export const dynamic = "force-dynamic";

/** First sign-in for an office account: a password of their own (new staff) and the office rules. */
export default async function Onboarding() {
  const u = await getUser();
  if (!u) redirect("/login");
  if (u.role !== "manager" || (!u.mustChangePassword && u.rulesAcceptedAt)) redirect(homeFor(u.role));
  return (
    <main className="md:py-12">
      <div className="mx-auto max-w-md px-6 pb-10 pt-[calc(env(safe-area-inset-top)+2rem)] md:rounded-3xl md:bg-white md:px-8 md:pt-8 md:shadow-float">
        <Logo size="md" />
        <h1 className="mt-6 text-[1.6rem] font-bold text-brand-950">Welcome, {u.name.split(" ")[0]}</h1>
        <p className="muted mb-6 mt-1">Before you start{u.mustChangePassword ? ", choose your own password and" : ""} read and accept the office rules.</p>
        <form action={completeOnboarding} className="space-y-4">
          {u.mustChangePassword && (
            <div className="space-y-2">
              <input name="next" type="password" required minLength={8} autoComplete="new-password" placeholder="New password (8+ characters)" aria-label="New password" className="input" />
              <input name="confirm" type="password" required minLength={8} autoComplete="new-password" placeholder="Type it again" aria-label="Confirm new password" className="input" />
            </div>
          )}
          {!u.rulesAcceptedAt && (
            <fieldset className="space-y-2 rounded-2xl border border-stone-200 p-3.5">
              <legend className="px-1 text-sm font-semibold text-brand-950">Office rules</legend>
              {OFFICE_RULES.map((r, i) => (
                <label key={i} className="flex items-start gap-2.5 text-sm text-stone-700"><input type="checkbox" name={`rule_${i}`} required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" /> {r}</label>
              ))}
            </fieldset>
          )}
          <Submit className="btn-primary btn-lg w-full">I agree, continue</Submit>
        </form>
      </div>
    </main>
  );
}
