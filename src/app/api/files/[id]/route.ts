import { NextResponse } from "next/server";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { canSeeFile } from "@/lib/access";
import { variant } from "@/lib/images";

// A file never changes once uploaded (a new photo gets a new id), so public ones can be kept for a year.
const PUBLIC_CACHE = "public, max-age=31536000, immutable";
const PRIVATE_CACHE = "private, max-age=3600";

/** `?w=640` returns a smaller WebP copy of an image (see lib/images); without it, the original file. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const width = Number(new URL(req.url).searchParams.get("w")) || 0;
  const f = await db.file.findUnique({ where: { id: Number(id) || 0 } });
  if (!f) return new NextResponse("Not found", { status: 404 });
  if (!f.isPublic) {
    const u = await getUser();
    if (!u) return new NextResponse("Sign in required", { status: 401 });
    const ok = await canSeeFile(u, f.id, f.ownerId);
    if (!ok) return new NextResponse("Forbidden", { status: 403 });
  }
  const cache = f.isPublic ? PUBLIC_CACHE : PRIVATE_CACHE;
  if (width > 0 && f.mimeType.startsWith("image/")) {
    const v = await variant(f, width);
    if (v) return new NextResponse(new Uint8Array(v.data), { headers: { "Content-Type": v.mimeType, "Cache-Control": cache, "Content-Length": String(v.data.length) } });
  }
  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mimeType,
      "Content-Length": String(f.data.length),
      "Content-Disposition": `${f.mimeType.startsWith("image/") || f.mimeType === "application/pdf" ? "inline" : "attachment"}; filename="${encodeURIComponent(f.name)}"`,
      "Cache-Control": cache,
    },
  });
}
