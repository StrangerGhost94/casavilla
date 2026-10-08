import "server-only";
import { db } from "@/db";

const MAX = 5 * 1024 * 1024;
const OK = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

/** Saves an uploaded File into the database and returns its id, or null when no file was chosen. */
export async function saveUpload(f: FormDataEntryValue | null, ownerId: number, isPublic: boolean, imagesOnly = false) {
  if (!f || typeof f === "string" || f.size === 0) return null;
  if (f.size > MAX) throw new Error("File is larger than 5 MB");
  if (!OK.includes(f.type) || (imagesOnly && !f.type.startsWith("image/"))) throw new Error("Unsupported file type");
  const data = Buffer.from(await f.arrayBuffer());
  const row = await db.file.create({ data: { ownerId, name: f.name, mimeType: f.type, size: f.size, data, isPublic }, select: { id: true } });
  return row.id;
}
