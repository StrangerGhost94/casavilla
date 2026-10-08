import { NextResponse } from "next/server";
import { db } from "@/db";
import { getUser } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await db.file.findUnique({ where: { id: Number(id) || 0 } });
  if (!f) return new NextResponse("Not found", { status: 404 });
  if (!f.isPublic) {
    const u = await getUser();
    if (!u) return new NextResponse("Sign in required", { status: 401 });
    let ok = u.role === "manager" || f.ownerId === u.id;
    if (!ok) {
      // Private documents: the tenant and landlord on the lease, or the property's landlord.
      const doc = await db.document.findFirst({
        where: {
          fileId: f.id,
          OR: [
            { lease: { OR: [{ tenantId: u.id }, { landlordId: u.id }] } },
            { property: { landlordId: u.id } },
          ],
        },
      });
      // Repair photos: anyone on the job.
      const job = doc ? null : await db.job.findFirst({
        where: { photoId: f.id, OR: [{ requesterId: u.id }, { landlordId: u.id }, { providerId: u.id }] },
      });
      ok = !!doc || !!job;
    }
    if (!ok) return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mimeType,
      "Content-Disposition": `${f.mimeType.startsWith("image/") || f.mimeType === "application/pdf" ? "inline" : "attachment"}; filename="${encodeURIComponent(f.name)}"`,
      "Cache-Control": f.isPublic ? "public, max-age=86400" : "private, max-age=300",
    },
  });
}
