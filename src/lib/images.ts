import "server-only";
import sharp from "sharp";
import { db } from "@/db";

/** The sizes the app asks for (CSS pixels × screen density, rounded up to one of these). */
export const WIDTHS = [160, 320, 640, 1024, 1600] as const;
const RESIZABLE = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export const snapWidth = (w: number) => WIDTHS.find((x) => x >= w) ?? WIDTHS[WIDTHS.length - 1];

/**
 * Tidies a photo as it is uploaded: turned the right way up, at most 2000px, compressed, and with its
 * metadata (including the GPS position phones record) removed. Anything that can't be read is kept as it was.
 */
export async function normaliseUpload(data: Buffer, mimeType: string): Promise<{ data: Buffer; mimeType: string }> {
  if (!RESIZABLE.includes(mimeType)) return { data, mimeType };
  try {
    const img = sharp(data, { failOn: "none" }).rotate();
    const meta = await img.metadata();
    const fit = img.resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
    // Logos and graphics with see-through parts stay PNG; photos become JPEG.
    const out = meta.hasAlpha ? await fit.png({ compressionLevel: 9, palette: true }).toBuffer() : await fit.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const type = meta.hasAlpha ? "image/png" : "image/jpeg";
    // Keep whichever is smaller (an already-optimised small image can grow when re-encoded).
    return out.length < data.length || mimeType.startsWith("image/hei") ? { data: out, mimeType: type } : { data, mimeType };
  } catch {
    return { data, mimeType };
  }
}

/** A smaller WebP copy of an image file, made once and then served from the database. */
export async function variant(file: { id: number; mimeType: string; data: Uint8Array }, width: number) {
  if (!RESIZABLE.includes(file.mimeType)) return null;
  const w = snapWidth(width);
  const hit = await db.fileVariant.findUnique({ where: { fileId_width: { fileId: file.id, width: w } } });
  if (hit) return hit;
  try {
    const data = await sharp(Buffer.from(file.data), { failOn: "none" })
      .rotate()
      .resize({ width: w, height: w, fit: "inside", withoutEnlargement: true })
      .webp({ quality: w <= 320 ? 68 : 74, effort: 4 })
      .toBuffer();
    const row = { fileId: file.id, width: w, mimeType: "image/webp", data };
    // Two requests for the same size at once: the second simply finds the first one's copy.
    await db.fileVariant.createMany({ data: [row], skipDuplicates: true });
    return row;
  } catch {
    return null;
  }
}
