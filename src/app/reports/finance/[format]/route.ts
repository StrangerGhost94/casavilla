import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { pdfResponse } from "@/lib/pdf";
import { financialReport, periodFrom, scopeName } from "@/lib/reports";
import { reportPdf, reportXlsx } from "@/lib/report-files";

/** /reports/finance/pdf or /reports/finance/xlsx — managers: any scope; landlords: their own portfolio only. */
export async function GET(req: Request, { params }: { params: Promise<{ format: string }> }) {
  const me = await getUser();
  if (!me) return new Response("Sign in to download reports", { status: 401 });
  if (me.role !== "manager" && me.role !== "landlord") return new Response("Not found", { status: 404 });
  const { format } = await params;
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const period = periodFrom(q);
  const landlordId = me.role === "landlord" ? me.id : Number(q.landlord) || undefined;
  const propertyId = Number(q.property) || undefined;
  if (propertyId) {
    const p = await db.property.findUnique({ where: { id: propertyId }, select: { landlordId: true } });
    if (!p || (me.role === "landlord" && p.landlordId !== me.id)) return new Response("Not found", { status: 404 });
  }
  const r = await financialReport(period, { landlordId, propertyId });
  const scopeLabel = await scopeName(landlordId, propertyId);
  const base = `CasaVilla-report-${period.label.replace(/[^\w]+/g, "-")}`.replace(/-+$/, "");
  if (format === "pdf") return pdfResponse(await reportPdf(r, scopeLabel), `${base}.pdf`, q.view === "1");
  if (format === "xlsx") {
    return new Response(new Uint8Array(await reportXlsx(r, scopeLabel)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response("Not found", { status: 404 });
}
