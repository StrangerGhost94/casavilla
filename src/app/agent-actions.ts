"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { notifyManagers } from "@/lib/notify";
import { saveUpload } from "@/lib/uploads";

/** An agent's ID document or signed CasaVilla agent agreement (private files the office checks before approval). */
export async function uploadAgentDocument(fd: FormData) {
  const u = await requireUser("agent");
  const kind = fd.get("kind") === "agreement" ? "agreement" : "id";
  const fileId = await saveUpload(fd.get("file"), u.id, false);
  if (!fileId) return fail("Choose the file (PDF or photo)");
  const user = await db.user.update({ where: { id: u.id }, data: kind === "id" ? { idFileId: fileId } : { agreementFileId: fileId } });
  await audit(u.id, kind === "id" ? "agent.id_uploaded" : "agent.agreement_uploaded", "user", u.id, u.name);
  if (user.status === "pending" && user.idFileId && user.agreementFileId) await notifyManagers(`Agent ${u.businessName || u.name} uploaded their ID and agreement — ready to approve`, `/manager/people/${u.id}`);
  revalidatePath("/agent");
}
