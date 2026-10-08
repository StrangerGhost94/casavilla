import "server-only";
import { db } from "@/db";
import { fail } from "@/lib/flash";

const MAX = 8 * 1024 * 1024;
const OK = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

/** Saves an uploaded File into the database and returns its id, or null when no file was chosen. */
export async function saveUpload(f: FormDataEntryValue | null, ownerId: number, isPublic: boolean, imagesOnly = false) {
  if (!f || typeof f === "string" || f.size === 0) return null;
  if (f.size > MAX) return fail("That file is larger than 8 MB. Please choose a smaller one.");
  if (!OK.includes(f.type) || (imagesOnly && !f.type.startsWith("image/"))) return fail(imagesOnly ? "Please choose a photo (JPG or PNG)." : "Please choose a PDF, Word document or photo.");
  const data = Buffer.from(await f.arrayBuffer());
  const row = await db.file.create({ data: { ownerId, name: f.name, mimeType: f.type, size: f.size, data, isPublic }, select: { id: true } });
  return row.id;
}
