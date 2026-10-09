import { getUser } from "@/lib/auth";
import { bookingData, bookingPdf } from "@/lib/stays";
import { pdfResponse } from "@/lib/pdf";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getUser();
  if (!me) return new Response("Sign in first", { status: 401 });
  const d = await bookingData(Number((await params).id) || 0, me);
  if (!d || d.b.status === "blocked") return new Response("Not found", { status: 404 });
  return pdfResponse(await bookingPdf(d), `CasaVilla-booking-${d.b.receiptNo ?? d.b.reference}.pdf`, new URL(req.url).searchParams.has("view"));
}
