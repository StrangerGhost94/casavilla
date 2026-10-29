import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { savedIds } from "@/lib/saved";

/** The signed-in person's saved homes (for the hearts on cards). Never cached. */
export async function GET() {
  const u = await getUser();
  const body = u ? { signedIn: true, ...(await savedIds(u.id)) } : { signedIn: false, rent: [], stay: [], sale: [] };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
