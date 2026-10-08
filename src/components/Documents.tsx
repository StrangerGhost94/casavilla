import { db } from "@/db";
import { fmtDate } from "@/lib/format";
import { uploadDocument, deleteDocument } from "@/app/doc-actions";
import { Submit, ConfirmSubmit } from "./client";

export async function Documents({ leaseId, propertyId, viewerId, canUpload = true }: { leaseId?: number; propertyId?: number; viewerId: number; canUpload?: boolean }) {
  const docs = await db.document.findMany({
    where: leaseId ? { leaseId } : { propertyId },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const files = await db.file.findMany({ where: { id: { in: docs.map((d) => d.fileId) } }, select: { id: true, name: true, size: true } });
  const fileOf = new Map(files.map((f) => [f.id, f]));
  return (
    <div className="card">
      <div className="h2">Documents</div>
      <ul className="mt-3 divide-y divide-stone-100">
        {docs.length === 0 && <li className="muted py-2">No documents yet.</li>}
        {docs.map((d) => {
          const f = fileOf.get(d.fileId);
          return (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <a href={`/api/files/${d.fileId}`} target="_blank" className="link">{d.title}</a>
                <div className="text-xs text-stone-500">{f?.name} · {((f?.size ?? 0) / 1024).toFixed(0)} KB · {d.uploadedBy.name} · {fmtDate(d.createdAt)}</div>
              </div>
              {d.uploadedById === viewerId && (
                <form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><ConfirmSubmit message="Remove this document?" className="btn-ghost btn-sm">Remove</ConfirmSubmit></form>
              )}
            </li>
          );
        })}
      </ul>
      {canUpload && (
        <form action={uploadDocument} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          {leaseId && <input type="hidden" name="leaseId" value={leaseId} />}
          {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
          <input name="title" className="input" placeholder="Title, e.g. Signed tenancy agreement" required />
          <input name="file" type="file" required className="input py-1.5" accept=".pdf,.doc,.docx,image/*" />
          <Submit className="btn-outline">Upload</Submit>
        </form>
      )}
    </div>
  );
}
