import { LoginForm } from "@/components/AuthForms";
export const metadata = { title: "Sign in" };
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-14">
      <div className="card">
        <h1 className="h1">Sign in</h1>
        <p className="muted mb-6 mt-1">Tenants, landlords, providers and CasaVilla staff.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
