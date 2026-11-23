"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { endSession, getUser, requireSuperAdmin, requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { notifyManagers } from "@/lib/notify";
import { requireSignature } from "@/lib/signature";
import { deletionBlockers, eraseAccount } from "@/lib/account-deletion";
import { clearFailures, lockedFor, noteFailure } from "@/lib/throttle";
import { id } from "@/lib/validate";

/** The account holder deletes their own account: password and the word DELETE, then it's done and they're signed out. */
export async function deleteMyAccount(fd: FormData) {
  const me = await requireUser();
  if (String(fd.get("confirm") || "").trim().toUpperCase() !== "DELETE") return fail("Type DELETE to confirm");
  const key = `delete:${me.id}`;
  if (lockedFor(key)) return fail("Too many wrong passwords. Try again later.");
  if (!(await bcrypt.compare(String(fd.get("password") || ""), me.passwordHash))) { noteFailure(key); return fail("Your password was wrong, so nothing was deleted"); }
  clearFailures(key);
  const blockers = await deletionBlockers(me);
  if (blockers.length) return fail(blockers[0]);
  await eraseAccount(me.id, me.id, "self");
  await endSession();
  redirect("/delete-account?done=1");
}

/** Anyone (signed in or not) asks CasaVilla to delete their account. The office does it and confirms. */
export async function requestAccountDeletion(fd: FormData) {
  const me = await getUser();
  const contact = String(fd.get("contact") || me?.email || "").trim().slice(0, 120);
  const reason = String(fd.get("reason") || "").trim().slice(0, 500);
  if (contact.length < 5) return fail("Enter the email or phone number on your account");
  const key = `delreq:${contact.toLowerCase()}`;
  if (lockedFor(key)) return fail("We already have your request. CasaVilla will contact you.");
  noteFailure(key);
  await notifyManagers(`Account deletion request from ${me ? `${me.name} (${me.email})` : contact}${reason ? `: ${reason}` : ""}. Delete it from their page within 7 days and confirm with them.`, me ? `/manager/people/${me.id}` : `/manager/people?q=${encodeURIComponent(contact)}`);
  await audit(me?.id ?? null, "account.deletion_requested", "user", me?.id ?? null, me ? "Requested in the app" : "Requested on the website");
  redirect("/delete-account?sent=1");
}

/** A super admin deletes an account on the person's request, signed with a reason and their password. */
export async function deleteAccountByOffice(fd: FormData) {
  const me = await requireSuperAdmin();
  const u = await db.user.findUnique({ where: { id: id(fd) } });
  if (!u) return fail("Person not found");
  if (u.id === me.id) return fail("You can't delete your own account here");
  if (u.email.endsWith("@deleted.casavillaproperties.com")) return fail("This account is already deleted");
  const blockers = await deletionBlockers(u, true);
  if (blockers.length) return fail(blockers[0]);
  const reason = await requireSignature(fd, me);
  await eraseAccount(u.id, me.id, "office");
  await audit(me.id, "account.delete_signed", "user", u.id, "Office deletion on request", db, { reason, signed: true });
  revalidatePath("/", "layout");
  redirect(`/manager/people?ok=${encodeURIComponent("Account deleted")}`);
}
