import { ForgotForm } from "@/components/AuthForms";
import { Logo } from "@/components/ui";
import { otpMode } from "@/lib/messaging";

export const metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default function Forgot() {
  const off = otpMode() === "off";
  return (
    <main className="md:py-12">
      <div className="mx-auto max-w-md px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+2rem)] md:rounded-3xl md:bg-white md:px-8 md:pt-8 md:shadow-float">
        <Logo size="md" />
        <h1 className="mt-6 text-[1.6rem] font-bold text-brand-950">Reset your password</h1>
        {off ? (
          <>
            <p className="muted mb-6 mt-1">Message CasaVilla on WhatsApp and we&apos;ll help you back into your account.</p>
            <a href="https://wa.me/256776593482?text=Hello%20CasaVilla%2C%20I%20forgot%20my%20password." className="btn-primary btn-lg w-full">Message us on WhatsApp</a>
          </>
        ) : (
          <>
            <p className="muted mb-6 mt-1">We&apos;ll send a code to your phone on WhatsApp (or SMS).</p>
            <ForgotForm />
          </>
        )}
      </div>
    </main>
  );
}
