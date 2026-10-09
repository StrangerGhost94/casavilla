import { RegisterForm } from "@/components/AuthForms";
import { messagingConfigured } from "@/lib/messaging";
import { LogoMark } from "@/components/ui";
import { BackButton } from "@/components/client";

export const metadata = { title: "Create account" };

export default async function Register({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  const { role, next } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] md:mt-10 md:rounded-3xl md:bg-white md:px-8 md:pt-6 md:shadow-float">
      <div className="flex items-center justify-between">
        <BackButton href="/app" className="-ml-2 text-brand-900 hover:bg-stone-100" />
        <LogoMark className="h-6" />
        <span className="w-10" />
      </div>
      <h1 className="mt-4 text-[1.6rem] font-bold leading-tight text-brand-950">Create your account</h1>
      <p className="muted mb-5 mt-1">Choose how you&apos;ll use CasaVilla, then add your details.</p>
      <RegisterForm role={role} next={next} messaging={messagingConfigured()} />
    </main>
  );
}
