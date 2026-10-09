import { getUser } from "@/lib/auth";
import { pdfResponse } from "@/lib/pdf";
import { statement, statementPdf } from "@/lib/statements";

/** Monthly statement PDF — for the landlord themselves, or CasaVilla. */
export async function GET(req: Request) {
  const me = await getUser();
  if (!me) return new Response("Sign in to download the statement", { status: 401 });
  const q = new URL(req.url).searchParams;
  const landlordId = me.role === "manager" ? Number(q.get("landlord")) || 0 : me.id;
  if (me.role !== "manager" && me.role !== "landlord") return new Response("Not found", { status: 404 });
  const month = /^\d{4}-\d{2}$/.test(q.get("month") ?? "") ? q.get("month")! : new Date().toISOString().slice(0, 7);
  const propertyId = Number(q.get("property")) || undefined;
  try {
    const s = await statement(landlordId, month, propertyId);
    return pdfResponse(await statementPdf(s), `statement-${month}-${(s.landlord.businessName || s.landlord.name).replace(/\s+/g, "-")}.pdf`, q.has("view"));
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
