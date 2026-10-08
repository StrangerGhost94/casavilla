"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { homeFor, startSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { notify } from "@/lib/notify";

export type FormState = { error?: string } | undefined;

const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "";
};

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const u = await db.user.findUnique({ where: { email } });
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) return { error: "Wrong email or password." };
  if (u.status === "suspended") return { error: "This account is suspended. Contact CasaVilla." };
  await startSession(u, fd.get("remember") === "on");
  redirect(safeNext(fd.get("next")) || homeFor(u.role));
}

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().min(9, "Enter a valid phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["tenant", "landlord", "provider"]),
  businessName: z.string().trim().optional(),
  area: z.string().trim().optional(),
});

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const exists = await db.user.findUnique({ where: { email: d.email }, select: { id: true } });
  if (exists) return { error: "An account with this email already exists. Sign in instead." };
  const u = await db.user.create({ data: {
    name: d.name, email: d.email, phone: normalizePhone(d.phone), passwordHash: await bcrypt.hash(d.password, 10), role: d.role,
    // Landlords and providers are reviewed by CasaVilla before they appear publicly.
    status: d.role === "tenant" ? "active" : "pending",
    businessName: d.businessName || null, area: d.area || null,
  } });
  if (d.role !== "tenant") {
    const managers = await db.user.findMany({ where: { role: "manager" }, select: { id: true } });
    for (const m of managers) await notify(m.id, `New ${d.role} sign-up awaiting approval: ${d.businessName || d.name}`, "/manager/people");
  }
  await startSession(u);
  redirect(safeNext(fd.get("next")) || homeFor(u.role));
}
