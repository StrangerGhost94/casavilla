import "server-only";
import { randomBytes } from "crypto";
import { db, type User } from "@/db";
import { notify, notifyManagers } from "./notify";
import { ugx } from "./format";
import { provider, verifyCharge } from "./momo";
import { PAYMENT_TIMEOUT_MIN } from "./rules";

/** Largest single Mobile Money payment the app asks for (set MOMO_MAX_UGX to the networks' current limit). Bigger amounts: several payments or bank. */
export const MOMO_MAX = Number(process.env.MOMO_MAX_UGX) || 5_000_000;

export const newBuildRef = () => `CP${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;

/** A site with each stage's paid / balance, the totals and how far along it is. */
export async function siteSummary(siteId: number) {
  const site = await db.buildSite.findUnique({
    where: { id: siteId },
    include: {
      stages: { orderBy: [{ sort: "asc" }, { id: "asc" }] },
      payments: { orderBy: { createdAt: "desc" } },
      updates: { orderBy: { createdAt: "desc" }, include: { photos: { orderBy: [{ isCover: "desc" }, { sort: "asc" }] }, stage: { select: { name: true } }, author: { select: { name: true } } } },
      client: { select: { id: true, name: true, phone: true, email: true } },
      plan: { select: { id: true, title: true } },
      request: { select: { id: true } },
    },
  });
  if (!site) return null;
  const ok = site.payments.filter((p) => p.status === "success");
  const stages = site.stages.map((s) => {
    const paid = ok.filter((p) => p.stageId === s.id).reduce((a, p) => a + p.amount, 0);
    return { ...s, paid, balance: Math.max(0, s.amount - paid) };
  });
  const paid = ok.reduce((a, p) => a + p.amount, 0);
  const scheduled = stages.reduce((a, s) => a + s.amount, 0);
  const done = stages.filter((s) => s.status === "done").length;
  // Progress by the value of stages finished (half for the one under way).
  const progress = scheduled ? Math.round((stages.reduce((a, s) => a + (s.status === "done" ? s.amount : s.status === "in_progress" ? s.amount / 2 : 0), 0) / scheduled) * 100) : 0;
  // What's due now: stages under way or finished that aren't fully paid.
  const due = stages.filter((s) => s.status !== "upcoming" && s.balance > 0);
  const next = due[0] ?? stages.find((s) => s.balance > 0) ?? null;
  return { site, stages, paid, balance: Math.max(0, site.contractSum - paid), scheduled, done, progress, due: due.reduce((a, s) => a + s.balance, 0), next };
}
export type SiteSummary = NonNullable<Awaited<ReturnType<typeof siteSummary>>>;

/** Marks a payment paid (once), gives it a receipt number and tells the client and CasaVilla. */
export async function completeBuildPayment(id: number) {
  const year = new Date().getFullYear();
  const receiptNo = `CVB-${year}-${String(id).padStart(6, "0")}`;
  const claimed = await db.buildPayment.updateMany({ where: { id, status: "pending" }, data: { status: "success", receiptNo, paidAt: new Date() } });
  if (!claimed.count) return false;
  const p = await db.buildPayment.findUniqueOrThrow({ where: { id }, include: { site: { select: { id: true, title: true, clientId: true } }, stage: { select: { name: true } } } });
  const what = `${ugx(p.amount)} for ${p.stage ? `“${p.stage.name}”` : "your build"}`;
  if (p.site.clientId) await notify(p.site.clientId, `Payment received: ${what} on ${p.site.title}. Receipt ${receiptNo}.`, `/build/receipt/${p.id}`);
  await notifyManagers(`Build payment received: ${what} — ${p.site.title}.`, `/manager/build/sites/${p.site.id}`);
  return true;
}

export async function failBuildPayment(id: number) {
  await db.buildPayment.updateMany({ where: { id, status: "pending" }, data: { status: "failed" } });
}

/** Mobile Money prompts nobody answered: check with the provider, then close them. */
export async function expireStaleBuildPayments() {
  const cutoff = new Date(Date.now() - PAYMENT_TIMEOUT_MIN * 60000);
  const stale = await db.buildPayment.findMany({ where: { status: "pending", createdAt: { lt: cutoff }, method: { in: ["mtn", "airtel"] } }, take: 50 });
  for (const p of stale) {
    const r = provider === "sandbox" ? "failed" : await verifyCharge(p.reference, p.amount);
    if (r === "success") await completeBuildPayment(p.id);
    else await failBuildPayment(p.id);
  }
  return stale.length;
}

/** Sites for this person. A site with no account yet is linked when they sign in with the same, verified phone. */
export async function sitesFor(u: User) {
  if (u.phoneVerifiedAt) {
    const claim = await db.buildSite.updateMany({ where: { clientId: null, clientPhone: u.phone }, data: { clientId: u.id } });
    if (claim.count) await notifyManagers(`${u.name} signed in and was linked to ${claim.count} building site${claim.count === 1 ? "" : "s"} by phone.`, "/manager/build/sites");
  }
  return db.buildSite.findMany({ where: { clientId: u.id, status: { not: "cancelled" } }, orderBy: { createdAt: "desc" } });
}

/** Can this person see the site? Its client, or CasaVilla staff. */
export const canSeeSite = (u: User, s: { clientId: number | null }) => u.role === "manager" || s.clientId === u.id;
