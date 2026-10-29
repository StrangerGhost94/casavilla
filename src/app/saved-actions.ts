"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getUser, requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { alertLabel, cleanParams, newestId, type AlertKind, type SaveKind } from "@/lib/saved";

const KINDS: SaveKind[] = ["rent", "stay", "sale"];

/** Saves or unsaves a home (the heart). Returns the new state; signed-out visitors get null. */
export async function toggleSaved(kind: SaveKind, itemId: number): Promise<boolean | null> {
  const u = await getUser();
  if (!u) return null;
  if (!KINDS.includes(kind) || !Number.isInteger(itemId) || itemId < 1) return false;
  const key = { userId_kind_itemId: { userId: u.id, kind, itemId } };
  if (await db.savedListing.findUnique({ where: key })) { await db.savedListing.delete({ where: key }); revalidatePath("/saved"); return false; }
  await db.savedListing.create({ data: { userId: u.id, kind, itemId } });
  revalidatePath("/saved");
  return true;
}

/** "Alert me": remembers this search and tells the person (app + phone) when new listings match it. */
export async function createAlert(fd: FormData) {
  const u = await requireUser();
  const kind = String(fd.get("kind")) as AlertKind;
  if (!["rent", "stays", "sale"].includes(kind)) return fail("Unknown search");
  let raw: Record<string, unknown> = {};
  try { raw = JSON.parse(String(fd.get("params") ?? "{}")); } catch { /* none */ }
  const params = cleanParams(kind, raw);
  const mine = await db.searchAlert.findMany({ where: { userId: u.id }, select: { kind: true, params: true } });
  if (mine.length >= 20) return fail("You have 20 alerts already. Remove one on the Saved page first.");
  if (mine.some((a) => a.kind === kind && JSON.stringify(a.params) === JSON.stringify(params))) return;
  await db.searchAlert.create({ data: { userId: u.id, kind, params, label: await alertLabel(kind, params), lastSeenId: await newestId(kind) } });
  revalidatePath("/", "layout");
}

export async function deleteAlert(fd: FormData) {
  const u = await requireUser();
  await db.searchAlert.deleteMany({ where: { id: Number(fd.get("id")) || 0, userId: u.id } });
  revalidatePath("/saved");
}
