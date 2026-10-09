import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { db } from "@/db";

/** Built-in PDF fonts only speak Windows-1252: swap the few characters the app uses that it can't draw. */
export function safe(s: string) {
  return s
    .replace(/[→⟶]/g, "->").replace(/[★☆]/g, "*").replace(/[✓✔]/g, "v").replace(/[✕✗]/g, "x")
    .replace(/[   ]/g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e -ÿ–—‘’“”•…€]/g, "");
}

const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const GREY = rgb(0.42, 0.4, 0.38), INK = rgb(0.1, 0.1, 0.1), LINE = rgb(0.88, 0.87, 0.85);

/**
 * Tiny flowing-layout writer on top of pdf-lib: A4 pages, wrapped paragraphs, label/value rows, simple tables,
 * automatic page breaks and a footer with page numbers.
 */
export class PdfWriter {
  doc!: PDFDocument; page!: PDFPage; font!: PDFFont; bold!: PDFFont; italic!: PDFFont;
  y = 0; readonly W = 595.28; readonly H = 841.89; readonly M = 48;
  accent = hex("#124331"); footer = "";
  pages: PDFPage[] = [];

  static async create(o: { accent?: string; footer?: string; title: string; author?: string }) {
    const w = new PdfWriter();
    w.doc = await PDFDocument.create();
    w.doc.setTitle(safe(o.title)); w.doc.setAuthor(safe(o.author ?? "CasaVilla Property Management")); w.doc.setCreator("CasaVilla");
    w.font = await w.doc.embedFont(StandardFonts.Helvetica);
    w.bold = await w.doc.embedFont(StandardFonts.HelveticaBold);
    w.italic = await w.doc.embedFont(StandardFonts.HelveticaOblique);
    if (o.accent && /^#[0-9a-f]{6}$/i.test(o.accent)) w.accent = hex(o.accent);
    w.footer = safe(o.footer ?? "");
    w.newPage();
    return w;
  }

  newPage() {
    this.page = this.doc.addPage([this.W, this.H]);
    this.pages.push(this.page);
    this.y = this.H - this.M;
  }
  ensure(h: number) { if (this.y - h < this.M + 24) this.newPage(); }
  gap(h = 8) { this.y -= h; }

  wrap(text: string, size: number, font: PDFFont, width: number) {
    const out: string[] = [];
    for (const para of safe(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width) line = next;
        else { if (line) out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  }

  text(s: string, o: { size?: number; bold?: boolean; italic?: boolean; color?: ReturnType<typeof rgb>; x?: number; width?: number; align?: "left" | "right" | "center"; leading?: number } = {}) {
    const size = o.size ?? 10, font = o.bold ? this.bold : o.italic ? this.italic : this.font;
    const x = o.x ?? this.M, width = o.width ?? this.W - this.M - x;
    const lead = o.leading ?? size * 1.4;
    for (const line of this.wrap(s, size, font, width)) {
      this.ensure(lead);
      const w = font.widthOfTextAtSize(line, size);
      const dx = o.align === "right" ? width - w : o.align === "center" ? (width - w) / 2 : 0;
      this.page.drawText(line, { x: x + dx, y: this.y - size, size, font, color: o.color ?? INK });
      this.y -= lead;
    }
  }

  heading(s: string, size = 12) { this.gap(6); this.ensure(size * 2); this.text(s, { size, bold: true, color: this.accent }); this.gap(2); }
  rule(color = LINE) { this.ensure(10); this.page.drawLine({ start: { x: this.M, y: this.y }, end: { x: this.W - this.M, y: this.y }, thickness: 0.8, color }); this.gap(10); }

  /** Two columns of label/value pairs. */
  facts(rows: [string, string][], cols = 2) {
    const colW = (this.W - 2 * this.M) / cols;
    for (let i = 0; i < rows.length; i += cols) {
      const startY = this.y; let lowest = this.y;
      rows.slice(i, i + cols).forEach(([k, v], j) => {
        this.y = startY;
        const x = this.M + j * colW;
        this.text(k, { size: 8, color: GREY, x, width: colW - 12 });
        this.text(v || "—", { size: 10, bold: true, x, width: colW - 12 });
        lowest = Math.min(lowest, this.y);
      });
      this.y = lowest - 6;
    }
  }

  /** Simple table: first column wraps, the rest are right-aligned amounts. */
  table(head: string[], rows: string[][], o: { widths?: number[]; totalRows?: string[][] } = {}) {
    const full = this.W - 2 * this.M;
    const widths = o.widths ?? [full * 0.6, ...head.slice(1).map(() => (full * 0.4) / (head.length - 1))];
    const draw = (cells: string[], style: { bold?: boolean; color?: ReturnType<typeof rgb>; size?: number }) => {
      const startY = this.y; let lowest = this.y; let x = this.M;
      cells.forEach((c, i) => {
        this.y = startY;
        this.text(c, { x: x + (i ? 0 : 6), width: widths[i] - 12, align: i ? "right" : "left", bold: style.bold, color: style.color, size: style.size ?? 10 });
        lowest = Math.min(lowest, this.y); x += widths[i];
      });
      this.y = lowest;
    };
    this.ensure(30);
    this.page.drawRectangle({ x: this.M, y: this.y - 16, width: full, height: 18, color: rgb(0.96, 0.96, 0.94) });
    this.gap(2); draw(head, { bold: true, color: GREY, size: 8.5 }); this.gap(2);
    for (const r of rows) { draw(r, {}); this.page.drawLine({ start: { x: this.M, y: this.y + 3 }, end: { x: this.W - this.M, y: this.y + 3 }, thickness: 0.5, color: LINE }); this.gap(3); }
    for (const r of o.totalRows ?? []) { this.gap(2); draw(r, { bold: true }); }
  }

  image(img: PDFImage, maxW: number, maxH: number, x = this.M) {
    const s = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * s, h = img.height * s;
    this.ensure(h);
    this.page.drawImage(img, { x, y: this.y - h, width: w, height: h });
    return { w, h };
  }

  signature(lines: { label: string; name?: string }[]) {
    const colW = (this.W - 2 * this.M) / lines.length;
    this.ensure(70); this.gap(30);
    const y = this.y;
    lines.forEach((l, i) => {
      const x = this.M + i * colW;
      this.page.drawLine({ start: { x, y }, end: { x: x + colW - 24, y }, thickness: 0.8, color: INK });
      this.page.drawText(safe(l.label), { x, y: y - 12, size: 8, font: this.font, color: GREY });
      if (l.name) this.page.drawText(safe(l.name), { x, y: y - 24, size: 9, font: this.bold, color: INK });
      this.page.drawText("Date: ____________________", { x, y: y - 38, size: 8, font: this.font, color: GREY });
    });
    this.y = y - 50;
  }

  async bytes() {
    this.pages.forEach((p, i) => {
      const label = `${this.footer}${this.footer ? "   ·   " : ""}Page ${i + 1} of ${this.pages.length}`;
      const w = this.font.widthOfTextAtSize(label, 7.5);
      p.drawText(label, { x: (this.W - w) / 2, y: 24, size: 7.5, font: this.font, color: GREY });
    });
    return this.doc.save();
  }
}

/** The landlord's own logo if they uploaded one, otherwise CasaVilla's. Unreadable images are skipped. */
export async function embedLogo(w: PdfWriter, fileId?: number | null): Promise<PDFImage | null> {
  try {
    if (fileId) {
      const f = await db.file.findUnique({ where: { id: fileId }, select: { data: true, mimeType: true } });
      if (f?.mimeType === "image/png") return await w.doc.embedPng(f.data);
      if (f?.mimeType === "image/jpeg") return await w.doc.embedJpg(f.data);
    }
    return await w.doc.embedPng(await readFile(path.join(process.cwd(), "public", "logo-pdf.png")));
  } catch {
    return null;
  }
}

export const pdfResponse = (bytes: Uint8Array, filename: string, inline = false) =>
  new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^\w.-]+/g, "-")}"`,
      "Cache-Control": "private, no-store",
    },
  });
