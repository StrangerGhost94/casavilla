import ExcelJS from "exceljs";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { actionLabel, auditWhere, changes } from "@/lib/audit-view";

/** The filtered audit trail as an Excel file (up to 20,000 entries). Super admins: everyone; staff: their own. */
export async function GET(req: Request) {
  const me = await getUser();
  if (!me || me.role !== "manager") return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const date = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const where = auditWhere({
    actorId: me.superAdmin ? Number(q.get("who")) || undefined : me.id,
    q: q.get("q")?.trim().slice(0, 80) || undefined, from: date(q.get("from")), to: date(q.get("to")), signed: q.get("signed") === "1", all: q.get("all") === "1",
  });
  const rows = await db.auditLog.findMany({ where, orderBy: { seq: "asc" }, take: 20000 });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Audit trail");
  ws.columns = [
    { header: "No.", key: "seq", width: 8 }, { header: "When (Kampala)", key: "when", width: 18 }, { header: "Who", key: "who", width: 22 },
    { header: "Level", key: "role", width: 13 }, { header: "What", key: "what", width: 28 }, { header: "Record", key: "rec", width: 14 },
    { header: "Details", key: "detail", width: 40 }, { header: "Reason", key: "reason", width: 30 }, { header: "Signed", key: "signed", width: 8 },
    { header: "Changes", key: "changes", width: 50 }, { header: "Hash", key: "hash", width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      seq: Number(r.seq ?? 0), when: new Date(r.createdAt.getTime() + 3 * 3600000).toISOString().slice(0, 16).replace("T", " "),
      who: r.actorName ?? "System", role: r.actorRole ?? "", what: actionLabel(r.action, r.entity), rec: r.entityId ? `${r.entity} #${r.entityId}` : r.entity,
      detail: r.detail ?? "", reason: r.reason ?? "", signed: r.signed ? "Yes" : "", changes: changes(r.before, r.after).map((d) => `${d.field}: ${d.from} → ${d.to}`).join("; "),
      hash: (r.hash ?? "").slice(0, 16),
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="casavilla-audit-trail-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
