import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { getUser } from "@/lib/auth";

/** Opening a notification marks it read, then goes where it points. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) return NextResponse.redirect(new URL("/login", req.url));
  const id = Number((await params).id) || 0;
  const n = await db.notification.findFirst({ where: { id, userId: u.id } });
  if (n && !n.read) await db.notification.update({ where: { id }, data: { read: true } });
  // Only follow links inside the app.
  const to = n?.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : "/notifications";
  return NextResponse.redirect(new URL(to, req.url));
}
