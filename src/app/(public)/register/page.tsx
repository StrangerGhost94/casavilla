import { RegisterForm } from "@/components/AuthForms";
import { LogoMark } from "@/components/ui";

export const metadata = { title: "Create account" };

export default async function Register({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  const { role, next } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-5 pb-10 pt-8 md:mt-10 md:rounded-3xl md:bg-white md:px-8 md:shadow-float">
      <LogoMark className="h-9 w-10" />
      <h1 className="mt-4 text-2xl font-bold leading-tight text-brand-950">How do you want to use CasaVilla?</h1>
      <p className="muted mb-5 mt-1">Choose your role. You can open another account later.</p>
      <RegisterForm role={role} next={next} />
    </main>
  );
}
