"use server";
import { revalidatePath } from "next/cache";
import { db, type Job, type User } from "@/db";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { ugx } from "@/lib/format";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { canMove, JOB_FLOW, JOB_LABEL, payerOf } from "@/lib/rules";
import { id, int, optInt, reqText, text } from "@/lib/validate";

async function loadJob(fd: FormData) {
  const u = await requireUser();
  const job = await db.job.findUnique({ where: { id: id(fd, "jobId") } });
  if (!job) return fail("Job not found");
  return { u, job };
}

const isParty = (u: User, j: Job) =>
  u.role === "manager" || j.requesterId === u.id || j.landlordId === u.id || j.providerId === u.id;
/** Can approve quotes, assign, cancel: the payer, the landlord, or CasaVilla. */
const isOwner = (u: User, j: Job) => u.role === "manager" || j.landlordId === u.id || payerOf(j) === u.id;

const linkFor = (role: string, jid: number) =>
  ({ tenant: `/tenant/requests/${jid}`, landlord: `/landlord/maintenance/${jid}`, provider: `/provider/jobs/${jid}`, manager: `/manager/jobs/${jid}` })[role]!;

async function tellParties(j: Pick<Job, "id" | "requesterId" | "landlordId" | "providerId">, actor: User, msg: string) {
  const ids = [...new Set([j.requesterId, j.landlordId, j.providerId].filter((x): x is number => !!x && x !== actor.id))];
  const people = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true } });
  for (const p of people) await notify(p.id, msg, linkFor(p.role, j.id));
}

const who = (u: User) => u.businessName || u.name;
function refresh() { revalidatePath("/", "layout"); }

/**
 * The only way a job changes status: checks the move is allowed, applies it only if nobody else changed the job
 * in the meantime, and writes a timeline entry.
 */
async function move(job: Job, to: string, actor: User, note: string, data: Prisma.JobUncheckedUpdateInput = {}) {
  if (!canMove(JOB_FLOW, job.status, to)) return fail(`Can't do that while the job is "${JOB_LABEL[job.status] ?? job.status}"`);
  const done = await db.job.updateMany({ where: { id: job.id, status: job.status, updatedAt: job.updatedAt }, data: { ...data, status: to } as Prisma.JobUncheckedUpdateManyInput });
  if (done.count === 0) return fail("Someone else just updated this job — please check the latest status");
  await db.jobNote.create({ data: { jobId: job.id, authorId: actor.id, body: note, system: true } });
  await audit(actor.id, `job.${to}`, "job", job.id, note);
}

export async function addNote(fd: FormData) {
  const { u, job } = await loadJob(fd);
  if (!isParty(u, job)) return fail("Not allowed");
  const body = await reqText(fd, "body", "a message", { max: 2000 });
  await db.jobNote.create({ data: { jobId: job.id, authorId: u.id, body } });
  await db.job.update({ where: { id: job.id }, data: { updatedAt: new Date() } });
  await tellParties(job, u, `${who(u)} on "${job.title}": ${body.length > 80 ? body.slice(0, 77) + "…" : body}`);
  refresh();
}

export async function assignProvider(fd: FormData) {
  const { u, job } = await loadJob(fd);
  if (!(u.role === "manager" || (u.role === "landlord" && job.landlordId === u.id))) return fail("Not allowed");
  const providerId = id(fd, "providerIdOther") || id(fd, "providerId");
  const p = await db.user.findFirst({ where: { id: providerId, role: "provider", status: "active" } });
  if (!p) return fail("Choose an approved provider");
  if (p.id === job.providerId && ["assigned", "quoted", "accepted", "in_progress"].includes(job.status)) return fail(`${who(p)} is already on this job`);
  const previous = job.providerId;
  await move(job, "assigned", u, `${who(u)} assigned ${who(p)}`, { providerId, quote: null, assignedAt: new Date() });
  await notify(providerId, `New job${job.priority === "urgent" ? " (URGENT)" : ""}: ${job.title}. Please accept or decline.`, `/provider/jobs/${job.id}`);
  if (previous && previous !== providerId) await notify(previous, `You've been taken off "${job.title}".`, `/provider/jobs`);
  await tellParties({ ...job, providerId: null }, u, `${who(p)} was assigned to "${job.title}"`);
  refresh();
}

export async function providerRespond(fd: FormData) {
  const { u, job } = await loadJob(fd);
  if (u.role !== "provider" || job.providerId !== u.id) return fail("Not allowed");
  const action = String(fd.get("action"));
  if (action === "accept") {
    const quote = await optInt(fd, "quote", "your quote", { min: 0, max: 200_000_000 });
    const payer = payerOf(job);
    // A quote needs the payer's OK before work starts; without one the job is simply accepted.
    if (quote && payer !== u.id) {
      await move(job, "quoted", u, `${who(u)} quoted ${ugx(quote)}`, { quote });
      await tellParties(job, u, `${who(u)} quoted ${ugx(quote)} for "${job.title}". Approve it so work can start.`);
    } else {
      await move(job, "accepted", u, `${who(u)} accepted the job`, { quote });
      await tellParties(job, u, `${who(u)} accepted "${job.title}"`);
    }
  } else if (action === "decline") {
    const reason = await text(fd, "reason", "a reason", { optional: true, max: 300 });
    await move(job, "open", u, `${who(u)} declined${reason ? `: ${reason}` : ""}`, { providerId: null, quote: null, assignedAt: null });
    await tellParties(job, u, `${who(u)} declined "${job.title}". Please assign another provider.`);
  } else if (action === "start") {
    await move(job, "in_progress", u, `${who(u)} started work`);
    await tellParties(job, u, `Work has started on "${job.title}"`);
  } else if (action === "done") {
    const finalCost = await optInt(fd, "cost", "the final cost", { min: 0, max: 200_000_000 });
    if (finalCost != null && job.quote != null && finalCost > job.quote * 1.2) {
      return fail(`The final cost is more than 20% above the approved quote (${ugx(job.quote)}). Send a new quote as a message first.`);
    }
    const cost = finalCost ?? job.quote;
    await move(job, "done", u, `${who(u)} marked the job as done${cost != null ? ` — ${ugx(cost)}` : ""}`, { completedAt: new Date(), quote: cost });
    await tellParties(job, u, `"${job.title}" is done. Please check the work and rate ${who(u)}.`);
  } else return fail("Unknown action");
  refresh();
}

export async function decideQuote(fd: FormData) {
  const { u, job } = await loadJob(fd);
  if (!isOwner(u, job)) return fail("Only the person paying for this job can approve the quote");
  if (job.status !== "quoted") return fail("There's no quote waiting for approval");
  if (fd.get("decision") === "approve") {
    await move(job, "accepted", u, `${who(u)} approved the quote of ${ugx(job.quote)}`);
    await tellParties(job, u, `Your quote of ${ugx(job.quote)} for "${job.title}" was approved — you can start.`);
  } else {
    await move(job, "assigned", u, `${who(u)} turned down the quote of ${ugx(job.quote)}`, { quote: null });
    await tellParties(job, u, `The quote for "${job.title}" wasn't approved. Send a revised quote or decline the job.`);
  }
  refresh();
}

export async function cancelJob(fd: FormData) {
  const { u, job } = await loadJob(fd);
  const can = u.role === "manager" || job.requesterId === u.id || job.landlordId === u.id;
  if (!can) return fail("Not allowed");
  if (job.status === "in_progress" && u.role !== "manager" && job.landlordId !== u.id) return fail("Work has already started — ask your landlord or CasaVilla to cancel");
  const reason = await text(fd, "reason", "a reason", { optional: true, max: 300 });
  await move(job, "cancelled", u, `${who(u)} cancelled the request${reason ? `: ${reason}` : ""}`);
  await tellParties(job, u, `"${job.title}" was cancelled`);
  refresh();
}

export async function reopenJob(fd: FormData) {
  const { u, job } = await loadJob(fd);
  const can = u.role === "manager" || job.requesterId === u.id || job.landlordId === u.id;
  if (!can) return fail("Not allowed");
  const provider = job.providerId ? await db.user.findFirst({ where: { id: job.providerId, status: "active" } }) : null;
  const to = provider ? "assigned" : "open";
  await move(job, to, u, `${who(u)} reopened the job${job.status === "done" ? " — the problem isn't fixed" : ""}`, { providerId: provider?.id ?? null, completedAt: null, rating: null, review: null, assignedAt: provider ? new Date() : null });
  await tellParties(job, u, `"${job.title}" was reopened`);
  refresh();
}

export async function rateJob(fd: FormData) {
  const { u, job } = await loadJob(fd);
  if (job.status !== "done" || !job.providerId) return fail("You can rate a job once it's done");
  if (!(job.requesterId === u.id || job.landlordId === u.id)) return fail("Only the requester or landlord can rate this job");
  if (job.rating) return fail("This job has already been rated");
  const rating = await int(fd, "rating", "a rating", { min: 1, max: 5 });
  const review = await text(fd, "review", "your review", { optional: true, max: 500 });
  const done = await db.job.updateMany({ where: { id: job.id, rating: null }, data: { rating, review } });
  if (done.count) {
    await db.jobNote.create({ data: { jobId: job.id, authorId: u.id, body: `${who(u)} rated the work ${"★".repeat(rating)}${review ? ` — "${review}"` : ""}`, system: true } });
    await notify(job.providerId, `You got ${rating}★ for "${job.title}"${review ? `: "${review}"` : ""}`, `/provider/jobs/${job.id}`);
    await audit(u.id, "job.rated", "job", job.id, `${rating}★`);
  }
  refresh();
}
