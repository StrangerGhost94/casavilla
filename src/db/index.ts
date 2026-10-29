import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type { User, Role, Lease, Charge, Payment, Job, Property, Unit } from "@prisma/client";

export const SERVICE_CATEGORIES = [
  "Cleaning", "Plumbing", "Electrical", "Structural", "Pest control", "Carpentry",
  "Painting", "Security", "Gardening", "Moving", "Other",
] as const;

/** Build & fit-out: new construction, interiors and house plans (offered by providers, not repair types). */
export const BUILD_CATEGORIES = ["Construction", "Interior design", "House plans"] as const;
/** Everything a provider can offer: repairs and upkeep, then build & fit-out. */
export const ALL_SERVICE_CATEGORIES = [...SERVICE_CATEGORIES, ...BUILD_CATEGORIES] as const;

/** Shop sections. */
export const PRODUCT_CATEGORIES = [
  "Building materials", "Plumbing & fittings", "Electrical", "Paint & finishes", "Furniture & interiors",
  "Cleaning & pest control", "House plans", "Other",
] as const;
