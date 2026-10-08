import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type { User, Role, Lease, Charge, Payment, Job, Property, Unit } from "@prisma/client";

export const SERVICE_CATEGORIES = [
  "Cleaning", "Plumbing", "Electrical", "Structural", "Pest control", "Carpentry",
  "Painting", "Security", "Gardening", "Moving", "Other",
] as const;
