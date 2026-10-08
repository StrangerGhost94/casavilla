import { RegisterForm } from "@/components/AuthForms";
export const metadata = { title: "Create account" };
export default async function Register({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  const { role, next } = await searchParams;
  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <div className="card">
        <h1 className="h1">Join CasaVilla</h1>
        <p className="muted mb-6 mt-1">Choose how you&apos;ll use CasaVilla.</p>
        <RegisterForm role={role} next={next} />
      </div>
    </main>
  );
}
