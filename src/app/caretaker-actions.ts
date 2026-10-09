"use server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { notify, notifyManagers } from "@/lib/notify";
import { normalizePhone } from "@/lib/format";
import { appUrl, messagingConfigured, queueMessage, sendQueuedMessages } from "@/lib/messaging";
import { workableProperty } from "@/lib/access";
import { triage } from "@/lib/insights";
import { saveUpload } from "@/lib/uploads";
import { id, oneOf, reqText } from "@/lib/validate";

const refresh = () => revalidatePath("/", "layout");

/**
 * Adds a caretaker to one or more of the landlord's properties, by phone number. If the number already has a
 * caretaker account it's reused; otherwise one is made and the caretaker sets their own password with a code
 * ("Forgot password" on the sign-in page) — the landlord never handles their password.
 */
export async function addCaretaker(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const name = await reqText(fd, "name", "the caretaker's name", { max: 80 });
  const phone = normalizePhone(String(fd.get("phone") || ""));
  if (!/^\+256\d{9}$/.test(phone)) return fail("Enter the caretaker's phone number, e.g. 0772 123 456");
  const propertyIds = fd.getAll("propertyId").map(Number).filter(Boolean);
  if (!propertyIds.length) return fail("Tick at least one property");
  const props = [];
  for (const pid of propertyIds) {
    const p = await workableProperty(u, pid);
    if (!p) return fail("Property not found");
    props.push(p);
  }
  const landlordId = props[0].landlordId;
  if (props.some((p) => p.landlordId !== landlordId)) return fail("Add caretakers for one landlord at a time");
  if (u.role === "landlord" && phone === normalizePhone(u.phone)) return fail("That's your own number — enter the caretaker's");

  const temp = String(fd.get("tempPassword") || "");
  if (temp && temp.length < 8) return fail("The first password must be at least 8 characters");
  // Without WhatsApp/SMS the caretaker can't set a password with a code, so the landlord gives them one.
  if (!temp && !messagingConfigured()) return fail("Give the caretaker a first password (at least 8 characters)");
  let c = await db.user.findFirst({ where: { phone, role: "caretaker" } });
  const isNew = !c;
  if (!c) {
    c = await db.user.create({
      data: {
        name, phone, role: "caretaker", status: "active",
        // Caretakers sign in with their phone number; the email is only a unique placeholder.
        email: `c${phone.replace(/\D/g, "")}.${randomBytes(3).toString("hex")}@phone.casavilla`,
        passwordHash: await bcrypt.hash(temp || randomBytes(24).toString("hex"), 10),
      },
    });
  } else if (temp && isNew === false && !c.phoneVerifiedAt) {
    // Not signed in yet: the landlord may (re)set the first password.
    c = await db.user.update({ where: { id: c.id }, data: { passwordHash: await bcrypt.hash(temp, 10) } });
  }
  const canCollect = fd.get("canCollect") === "on", canSeeBalances = fd.get("canSeeBalances") === "on";
  for (const p of props) {
    await db.caretakerAssignment.upsert({
      where: { caretakerId_propertyId: { caretakerId: c.id, propertyId: p.id } },
      create: { caretakerId: c.id, landlordId, propertyId: p.id, canCollect, canSeeBalances },
      update: { canCollect, canSeeBalances },
    });
  }
  const names = props.map((p) => p.name).join(", ");
  const owner = await db.user.findUniqueOrThrow({ where: { id: landlordId }, select: { name: true } });
  const first = c.name.split(" ")[0];
  const how = temp ? ` Sign in at ${appUrl("/login")} with your phone number and the password ${owner.name.split(" ")[0]} gave you.` : isNew ? ` Set your password here: ${appUrl("/forgot")} (use this phone number), then sign in.` : ` Sign in at ${appUrl("/login")}.`;
  const text = `${owner.name} added you as caretaker for ${names} on CasaVilla.${how}`;
  await queueMessage({ userId: c.id, kind: "notice", dedupeKey: `caretaker:${c.id}:${props.map((p) => p.id).join("-")}`, params: [first, text], text: `Hello ${first}, ${text}` });
  await sendQueuedMessages(5).catch(() => 0);
  await notify(c.id, `You're now caretaker for ${names}.`, "/caretaker");
  await audit(u.id, "caretaker.assigned", "user", c.id, `${c.name} (${phone}) → ${names}`);
  refresh();
}

export async function updateCaretaker(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const a = await db.caretakerAssignment.findUnique({ where: { id: id(fd) } });
  if (!a || (u.role !== "manager" && a.landlordId !== u.id)) return fail("Not found");
  if (fd.get("remove") === "1") {
    await db.caretakerAssignment.delete({ where: { id: a.id } });
    await audit(u.id, "caretaker.removed", "user", a.caretakerId, `property ${a.propertyId}`);
  } else {
    await db.caretakerAssignment.update({ where: { id: a.id }, data: { canCollect: fd.get("canCollect") === "on", canSeeBalances: fd.get("canSeeBalances") === "on" } });
  }
  refresh();
}

/** A caretaker reports a repair on a property they look after (the landlord is told; CasaVilla finds a provider). */
export async function caretakerJob(fd: FormData) {
  const u = await requireUser("caretaker");
  const p = await workableProperty(u, id(fd, "propertyId"));
  if (!p) return fail("Property not found");
  const unitId = id(fd, "unitId") || null;
  if (unitId && !(await db.unit.findFirst({ where: { id: unitId, propertyId: p.id } }))) return fail("Choose a unit in this property");
  const title = await reqText(fd, "title", "a short title", { max: 120 });
  const description = await reqText(fd, "description", "a description", { max: 3000 });
  let priority = await oneOf(fd, "priority", ["low", "normal", "urgent"] as const, "priority", "normal");
  const t = triage(`${title} ${description}`);
  if (t.urgent) priority = "urgent";
  const photoId = await saveUpload(fd.get("photo"), u.id, false, true);
  const job = await db.job.create({
    data: { requesterId: u.id, landlordId: p.landlordId, propertyId: p.id, unitId, photoId, title, description, priority, locationId: p.locationId, category: String(fd.get("category") || t.category || "Other") },
  });
  await audit(u.id, "job.created", "job", job.id, title);
  await notify(p.landlordId, `${u.name} (caretaker) reported a repair at ${p.name}: ${title}`, `/landlord/maintenance/${job.id}`);
  await notifyManagers(`${priority === "urgent" ? "URGENT repair" : "Repair"} at ${p.name}: ${title} (reported by caretaker)`, `/manager/jobs/${job.id}`);
  redirect(`/caretaker/repairs/${job.id}`);
}
