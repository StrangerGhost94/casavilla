import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { PageHeader, Badge, Field } from "@/components/ui";
import { Submit } from "@/components/client";
import { setUserStatus, createStaff } from "../actions";

export default async function People({ searchParams }: { searchParams: Promise<{ role?: string; status?: string; q?: string }> }) {
  const me = await requireUser("manager");
  const sp = await searchParams;
  const roles = ["tenant", "landlord", "provider", "manager"] as const;
  const statuses = ["pending", "active", "suspended"] as const;
  const role = roles.find((r) => r === sp.role);
  const status = statuses.find((s) => s === sp.status);
  const has = (field: "name" | "email" | "phone" | "businessName"): Prisma.UserWhereInput => ({ [field]: { contains: sp.q, mode: "insensitive" } });
  const list = await db.user.findMany({
    where: { role, status, ...(sp.q ? { OR: [has("name"), has("email"), has("phone"), has("businessName")] } : {}) },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 300,
  });
  const tab = (label: string, q: string) => {
    const active = `?${new URLSearchParams(Object.fromEntries(Object.entries({ role: sp.role, status: sp.status }).filter(([, v]) => v)) as Record<string, string>)}` === q || (q === "?" && !sp.role && !sp.status);
    return <Link href={`/manager/people${q}`} className={`rounded-full border px-3 py-1.5 text-sm ${active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-stone-200 bg-white"}`}>{label}</Link>;
  };
  return (
    <>
      <PageHeader title="People & approvals" subtitle="Approve landlords and providers before they go public. Suspend anyone who breaks the rules." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab("Everyone", "?")}{tab("Awaiting approval", "?status=pending")}{tab("Landlords", "?role=landlord")}{tab("Tenants", "?role=tenant")}{tab("Providers", "?role=provider")}{tab("Staff", "?role=manager")}
        <form className="ml-auto flex gap-2">
          {sp.role && <input type="hidden" name="role" value={sp.role} />}
          <input name="q" defaultValue={sp.q} className="input" placeholder="Search name, email, phone" />
          <button className="btn-outline">Search</button>
        </form>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table table-stack">
          <thead><tr><th>Name</th><th>Role</th><th>Contact</th><th>Joined</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td data-label="" className="font-medium">{u.businessName || u.name}{u.businessName && <div className="text-xs font-normal text-stone-500">{u.name}</div>}</td>
                <td data-label="Role" className="capitalize">{u.role}</td>
                <td data-label="Contact">{u.phone}<div className="text-xs text-stone-500">{u.email}</div></td>
                <td data-label="Joined" className="whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                <td data-label="Status"><Badge>{u.status}</Badge></td>
                <td data-label="">{u.id !== me.id && (
                  <div className="flex gap-1">
                    {u.status !== "active" && <form action={setUserStatus}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value="active" /><Submit className="btn-primary btn-sm">{u.status === "pending" ? "Approve" : "Reactivate"}</Submit></form>}
                    {u.status !== "suspended" && <form action={setUserStatus}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value="suspended" /><Submit className="btn-ghost btn-sm text-maroon-600">Suspend</Submit></form>}
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="card mt-6 max-w-2xl">
        <summary className="h2 cursor-pointer">Add a CasaVilla staff account</summary>
        <form action={createStaff} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input name="name" className="input" required /></Field>
          <Field label="Phone"><input name="phone" className="input" required /></Field>
          <Field label="Email"><input name="email" type="email" className="input" required /></Field>
          <Field label="Temporary password"><input name="password" type="password" minLength={8} className="input" required /></Field>
          <div><Submit>Create staff account</Submit></div>
        </form>
      </details>
    </>
  );
}
