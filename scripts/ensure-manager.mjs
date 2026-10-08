// Runs on every start (after `prisma migrate deploy`): makes sure the CasaVilla manager account exists.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = (process.env.MANAGER_EMAIL || "").trim().toLowerCase();
const password = process.env.MANAGER_PASSWORD;

if (email && password) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: "CasaVilla Manager", email, phone: "+256776593482",
        passwordHash: await bcrypt.hash(password, 10), role: "manager", status: "active",
      },
    });
    console.log("Created manager account", email);
  }
} else {
  console.log("MANAGER_EMAIL / MANAGER_PASSWORD not set — skipping manager account check");
}
await prisma.$disconnect();
