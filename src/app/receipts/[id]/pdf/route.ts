import { getUser } from "@/lib/auth";
import { receiptData, receiptPdf } from "@/lib/receipts";
import { pdfResponse } from "@/lib/pdf";

/** Downloadable PDF receipt (tenant, their landlord, or CasaVilla). ?view=1 opens it in the browser instead. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getUser();
  if (!me) return new Response("Sign in to download this receipt", { status: 401 });
  const r = await receiptData(Number((await params).id) || 0, me);
  if (!r) return new Response("Receipt not found", { status: 404 });
  return pdfResponse(await receiptPdf(r), `CasaVilla-receipt-${r.p.receiptNo}.pdf`, new URL(req.url).searchParams.has("view"));
}
