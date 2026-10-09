import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { agreementPdf } from "@/lib/agreement";
import { pdfResponse } from "@/lib/pdf";

/** The tenancy agreement drafted from the lease's current details, as a PDF (tenant, landlord or CasaVilla). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getUser();
  if (!me) return new Response("Sign in to download the agreement", { status: 401 });
  const l = await db.lease.findUnique({ where: { id: Number((await params).id) || 0 }, select: { id: true, tenantId: true, landlordId: true } });
  if (!l || (me.role !== "manager" && me.id !== l.tenantId && me.id !== l.landlordId)) return new Response("Not found", { status: 404 });
  const { bytes, filename } = await agreementPdf(l.id);
  return pdfResponse(bytes, filename, new URL(req.url).searchParams.has("view"));
}
