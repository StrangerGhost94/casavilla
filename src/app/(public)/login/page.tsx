import Link from "next/link";
import { LoginForm } from "@/components/AuthForms";
import { Logo } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="md:py-12">
      <div className="mx-auto max-w-md overflow-hidden md:rounded-3xl md:bg-white md:shadow-float">
        <div className="relative flex h-[38vh] min-h-64 items-center justify-center overflow-hidden bg-brand-900 pt-[env(safe-area-inset-top)] md:h-64">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/launch.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[50%_62%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/25" />
          <Logo tile size="md" className="relative -mt-8 animate-fade-up shadow-float [&_img]:h-14" />
          <Link href="/" className="absolute right-4 top-[calc(env(safe-area-inset-top)+0.9rem)] rounded-full bg-black/30 px-3.5 py-1.5 text-sm font-semibold text-white backdrop-blur">Skip</Link>
        </div>
        <div className="relative -mt-8 rounded-t-[2rem] bg-cream px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8 md:bg-white md:px-8">
          <h1 className="text-[1.6rem] font-bold text-brand-950">Welcome back</h1>
          <p className="muted mb-6 mt-1">Sign in to your account</p>
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
