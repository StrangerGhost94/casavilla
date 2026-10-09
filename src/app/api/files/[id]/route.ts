import { NextResponse } from "next/server";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { canSeeFile } from "@/lib/access";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await db.file.findUnique({ where: { id: Number(id) || 0 } });
  if (!f) return new NextResponse("Not found", { status: 404 });
  if (!f.isPublic) {
    const u = await getUser();
    if (!u) return new NextResponse("Sign in required", { status: 401 });
    const ok = await canSeeFile(u, f.id, f.ownerId);
    if (!ok) return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mimeType,
      "Content-Disposition": `${f.mimeType.startsWith("image/") || f.mimeType === "application/pdf" ? "inline" : "attachment"}; filename="${encodeURIComponent(f.name)}"`,
      "Cache-Control": f.isPublic ? "public, max-age=86400" : "private, max-age=300",
    },
  });
}
