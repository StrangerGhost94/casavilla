import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { PageHeader, Badge, Empty } from "@/components/ui";
import { ConfirmSubmit } from "@/components/client";
import { withdrawApplication } from "../actions";

export default async function TenantApplications() {
  const u = await requireUser("tenant");
  const rows = (await db.application.findMany({
    where: { tenantId: u.id }, orderBy: { createdAt: "desc" },
    include: { unit: { include: { property: { include: { landlord: { select: { name: true } } } } } } },
  })).map((a) => ({ a, unit: a.unit.label, unitId: a.unit.id, rent: a.unit.rent, property: a.unit.property.name, landlord: a.unit.property.landlord.name }));
  return (
    <>
      <PageHeader title="My applications" actions={<Link href="/listings" className="btn-primary">Find a home</Link>} />
      {rows.length === 0 ? <Empty title="No applications yet">Browse homes and apply to the landlord you like.</Empty> : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>Home</th><th>Landlord</th><th>Rent</th><th>Applied</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.a.id}>
                  <td><Link href={`/listings/${r.unitId}`} className="link">{r.property} · {r.unit}</Link></td>
                  <td>{r.landlord}</td>
                  <td>{ugx(r.rent)}</td>
                  <td>{fmtDate(r.a.createdAt)}</td>
                  <td><Badge>{r.a.status}</Badge></td>
                  <td>{r.a.status === "pending" && (
                    <form action={withdrawApplication}><input type="hidden" name="id" value={r.a.id} /><ConfirmSubmit message="Withdraw this application?">Withdraw</ConfirmSubmit></form>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
