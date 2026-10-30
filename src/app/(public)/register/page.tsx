import { RegisterForm } from "@/components/AuthForms";
import { messagingConfigured } from "@/lib/messaging";
import { LogoMark } from "@/components/ui";
import { BackButton } from "@/components/client";
import Link from "next/link";

export const metadata = { title: "Create a free account", alternates: { canonical: "/register" } };

export default async function Register({ searchParams }: { searchParams: Promise<{ role?: string; next?: string; landlord?: string }> }) {
  const { role, next, landlord } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] md:mt-10 md:rounded-3xl md:bg-white md:px-8 md:pt-6 md:shadow-float">
      <div className="flex items-center justify-between">
        <BackButton href="/" className="-ml-2 text-brand-900 hover:bg-stone-100" />
        <LogoMark className="h-6" />
        <Link href="/" className="rounded-full px-3 py-1.5 text-sm font-semibold text-stone-500 hover:bg-stone-100">Skip</Link>
      </div>
      <h1 className="mt-4 text-[1.6rem] font-bold leading-tight text-brand-950">Create your account</h1>
      <p className="muted mb-5 mt-1">Choose how you&apos;ll use CasaVilla, then add your details.</p>
      <RegisterForm role={landlord ? "tenant" : role} next={next} messaging={messagingConfigured()} landlordPhone={landlord?.replace(/[^\d+]/g, "").slice(0, 16)} />
    </main>
  );
}
