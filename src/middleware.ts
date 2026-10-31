import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const areas = ["tenant", "landlord", "provider", "manager", "caretaker"] as const;

export async function middleware(req: NextRequest) {
  // One address for Google and for the Play Store app: www.casavillaproperties.com → casavillaproperties.com (same path).
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim();
  if (host.startsWith("www.")) {
    return NextResponse.redirect(`https://${host.slice(4)}${req.nextUrl.pathname}${req.nextUrl.search}`, 308);
  }
  const area = req.nextUrl.pathname.split("/")[1];
  if (!(areas as readonly string[]).includes(area)) {
    // Public pages: tell the service worker not to keep a copy when someone is signed in.
    const res = NextResponse.next();
    if (req.cookies.get(SESSION_COOKIE)) res.headers.set("x-cv-signed-in", "1");
    return res;
  }
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(req.nextUrl.pathname)}`, req.url));
  if (s.role !== area) return NextResponse.redirect(new URL(`/${s.role}`, req.url));
  return NextResponse.next();
}

export const config = {
  // Every page (for the www redirect), but not Next's static files or the API (payment webhooks must never be redirected).
  matcher: ["/((?!_next/static|_next/image|api/).*)"],
};
