import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { PageHeader, Badge, Field } from "@/components/ui";
import { Submit } from "@/components/client";
import { setUserStatus, createStaff } from "../actions";
import { Signature } from "@/components/Signature";

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
                <td data-label="" className="font-medium"><Link href={`/manager/people/${u.id}`} className="hover:underline">{u.businessName || u.name}</Link>{u.businessName && <div className="text-xs font-normal text-stone-500">{u.name}</div>}</td>
                <td data-label="Role" className="capitalize">{u.role === "manager" ? (u.superAdmin ? "Super admin" : "Staff") : u.role}</td>
                <td data-label="Contact">{u.phone}<div className="text-xs text-stone-500">{u.email}</div></td>
                <td data-label="Joined" className="whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                <td data-label="Status"><Badge>{u.status}</Badge></td>
                <td data-label="">{u.id !== me.id && (
                  <div className="flex gap-1">
                    {u.status === "pending" && u.role === "provider" ? <form action={setUserStatus}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value="active" /><Submit className="btn-primary btn-sm">Approve</Submit></form>
                      : <Link href={`/manager/people/${u.id}`} className={u.status === "pending" ? "btn-primary btn-sm" : "btn-ghost btn-sm"}>{u.status === "pending" ? (u.role === "landlord" ? "Set commission & approve" : "Review") : "Open"}</Link>}
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {me.superAdmin && <details className="card mt-6 max-w-2xl">
        <summary className="h2 cursor-pointer">Add a CasaVilla office account</summary>
        <p className="mt-2 text-sm text-stone-600">Staff do the daily work. A super admin can also add and suspend office accounts, approve landlords, change commission, waive charges and use the system tools.</p>
        <form action={createStaff} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name"><input name="name" className="input" required /></Field>
          <Field label="Phone"><input name="phone" className="input" required /></Field>
          <Field label="Email"><input name="email" type="email" className="input" required /></Field>
          <Field label="Temporary password"><input name="password" type="password" minLength={8} className="input" required /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="superAdmin" className="h-4 w-4" /> Make this account a super admin</label>
          <div className="sm:col-span-2"><Signature reasonHint="e.g. new receptionist starting Monday" /></div>
          <div><Submit>Create account</Submit></div>
        </form>
      </details>}
    </>
  );
}
