import { LoginForm } from "@/components/AuthForms";
import { BuildingArt, Logo } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="md:py-12">
      <div className="mx-auto max-w-md overflow-hidden md:rounded-3xl md:shadow-float">
        <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-b from-brand-800 to-brand-950">
          <BuildingArt className="absolute inset-x-0 bottom-0 h-full w-full text-white/[0.09]" />
          <Logo tone="light" stacked size="lg" className="relative" />
        </div>
        <div className="relative -mt-8 rounded-t-3xl bg-cream px-5 pb-10 pt-7 md:bg-white md:px-8">
          <h1 className="text-2xl font-bold text-brand-950">Welcome back</h1>
          <p className="muted mb-6 mt-1">Sign in to your account</p>
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
