import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const areas = ["tenant", "landlord", "provider", "manager", "caretaker"] as const;

export async function middleware(req: NextRequest) {
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
  matcher: ["/", "/listings/:path*", "/stays/:path*", "/sale/:path*", "/services", "/shop", "/tenant/:path*", "/landlord/:path*", "/provider/:path*", "/manager/:path*", "/caretaker/:path*"],
};
