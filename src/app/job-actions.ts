"use server";
import { revalidatePath } from "next/cache";
import { db, type Job, type User } from "@/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { ugx } from "@/lib/format";

async function loadJob(fd: FormData) {
  const u = await requireUser();
  const job = await db.job.findUnique({ where: { id: Number(fd.get("jobId")) } });
  if (!job) throw new Error("Job not found");
  return { u, job };
}

const isParty = (u: User, j: Job) =>
  u.role === "manager" || j.requesterId === u.id || j.landlordId === u.id || j.providerId === u.id;

const linkFor = (role: string, id: number) =>
  ({ tenant: `/tenant/requests/${id}`, landlord: `/landlord/maintenance/${id}`, provider: `/provider/jobs/${id}`, manager: `/manager/jobs/${id}` })[role]!;

async function tellParties(j: Job, actor: User, msg: string) {
  const ids = [...new Set([j.requesterId, j.landlordId, j.providerId].filter((x): x is number => !!x && x !== actor.id))];
  const people = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true } });
  for (const p of people) await notify(p.id, msg, linkFor(p.role, j.id));
}

function refresh() { revalidatePath("/", "layout"); }

export async function addNote(fd: FormData) {
  const { u, job } = await loadJob(fd);
  if (!isParty(u, job)) throw new Error("Not allowed");
  const body = String(fd.get("body") || "").trim();
  if (!body) return;
  await db.jobNote.create({ data: { jobId: job.id, authorId: u.id, body } });
  await tellParties(job, u, `${u.businessName || u.name} commented on "${job.title}"`);
  refresh();
}

export async function assignProvider(fd: FormData) {
  const { u, job } = await loadJob(fd);
  if (!(u.role === "manager" || (u.role === "landlord" && job.landlordId === u.id))) throw new Error("Not allowed");
  const providerId = Number(fd.get("providerId"));
  const p = await db.user.findFirst({ where: { id: providerId, role: "provider", status: "active" } });
  if (!p) throw new Error("Choose an approved provider");
  await db.job.update({ where: { id: job.id }, data: { providerId, status: "assigned", quote: null } });
  await notify(providerId, `New job assigned: ${job.title}`, `/provider/jobs/${job.id}`);
  await tellParties({ ...job, providerId: null }, u, `${p.businessName || p.name} was assigned to "${job.title}"`);
  refresh();
}

export async function providerRespond(fd: FormData) {
  const { u, job } = await loadJob(fd);
  if (u.role !== "provider" || job.providerId !== u.id) throw new Error("Not allowed");
  const action = String(fd.get("action"));
  const who = u.businessName || u.name;
  if (action === "accept") {
    const quote = Number(fd.get("quote")) || null;
    await db.job.update({ where: { id: job.id }, data: { status: "accepted", quote } });
    await tellParties(job, u, `${who} accepted "${job.title}"${quote ? ` — quote ${ugx(quote)}` : ""}`);
  } else if (action === "decline") {
    await db.job.update({ where: { id: job.id }, data: { status: "open", providerId: null, quote: null } });
    await tellParties(job, u, `${who} declined "${job.title}". Please assign another provider.`);
  } else if (action === "start") {
    await db.job.update({ where: { id: job.id }, data: { status: "in_progress" } });
    await tellParties(job, u, `Work has started on "${job.title}"`);
  } else if (action === "done") {
    await db.job.update({ where: { id: job.id }, data: { status: "done" } });
    await tellParties(job, u, `"${job.title}" is marked as done`);
  }
  refresh();
}

export async function cancelJob(fd: FormData) {
  const { u, job } = await loadJob(fd);
  const can = u.role === "manager" || job.requesterId === u.id || job.landlordId === u.id;
  if (!can || job.status === "done") throw new Error("Not allowed");
  await db.job.update({ where: { id: job.id }, data: { status: "cancelled" } });
  await tellParties(job, u, `"${job.title}" was cancelled`);
  refresh();
}

export async function reopenJob(fd: FormData) {
  const { u, job } = await loadJob(fd);
  const can = u.role === "manager" || job.requesterId === u.id || job.landlordId === u.id;
  if (!can) throw new Error("Not allowed");
  await db.job.update({ where: { id: job.id }, data: { status: job.providerId ? "assigned" : "open" } });
  await tellParties(job, u, `"${job.title}" was reopened`);
  refresh();
}
