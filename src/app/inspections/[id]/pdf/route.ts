import { getUser } from "@/lib/auth";
import { workableUnit } from "@/lib/access";
import { inspectionFull, inspectionPdf } from "@/lib/inspections";
import { pdfResponse } from "@/lib/pdf";

/** Inspection report PDF — for the tenant on the lease, or anyone who works on the unit. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getUser();
  if (!me) return new Response("Sign in to download the report", { status: 401 });
  const ins = await inspectionFull(Number((await params).id) || 0);
  if (!ins) return new Response("Not found", { status: 404 });
  const tenant = ins.lease?.tenantId === me.id && ins.status !== "draft";
  if (!tenant && !(await workableUnit(me, ins.unitId))) return new Response("Not found", { status: 404 });
  const bytes = await inspectionPdf(ins);
  return pdfResponse(bytes, `inspection-${ins.id}-${ins.unit.label}.pdf`, new URL(req.url).searchParams.has("view"));
}
