import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, type Role, type User } from "@/db";
import { SESSION_COOKIE, signSession, verifySession } from "./session";

export async function getUser(): Promise<User | null> {
  const store = await cookies();
  const s = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const u = await db.user.findUnique({ where: { id: s.uid } });
  // Caretaker accounts were retired: the CasaVilla office does the on-site work, so they can no longer sign in.
  if (!u || u.status === "suspended" || u.role === "caretaker") return null;
  return u;
}

export async function requireUser(...roles: Role[]): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/login");
  if (roles.length && !roles.includes(u.role)) redirect(homeFor(u.role));
  // New office accounts set their own password and accept the office rules before anything else.
  if (u.role === "manager" && (u.mustChangePassword || !u.rulesAcceptedAt)) redirect("/onboarding");
  return u;
}

/** Office accounts with full control: staff accounts, landlord approval and commission, waiving charges, system tools. */
export async function requireSuperAdmin(): Promise<User> {
  const u = await requireUser("manager");
  if (!u.superAdmin) redirect("/manager");
  return u;
}

export async function startSession(u: User, remember = true) {
  await db.user.update({ where: { id: u.id }, data: { lastLoginAt: new Date() } }).catch(() => null);
  const token = await signSession({ uid: u.id, role: u.role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export function homeFor(role: Role) {
  return { tenant: "/tenant", landlord: "/landlord", provider: "/provider", manager: "/manager", caretaker: "/caretaker", agent: "/agent" }[role];
}
