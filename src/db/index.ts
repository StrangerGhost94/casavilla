import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type { User, Role, Lease, Charge, Payment, Job, Property, Unit } from "@prisma/client";

export const SERVICE_CATEGORIES = [
  "Cleaning", "Plumbing", "Electrical", "Structural", "Pest control", "Carpentry",
  "Painting", "Security", "Gardening", "Moving", "Other",
] as const;

/** Fit-out offered by providers (not a repair type). Construction and house plans are CasaVilla's own service (/build). */
export const BUILD_CATEGORIES = ["Interior design"] as const;
/** Categories providers used to offer that CasaVilla now does itself; old services in them are no longer shown. */
export const CASAVILLA_ONLY: string[] = ["Construction", "House plans"];
/** Everything a provider can offer: repairs and upkeep, then build & fit-out. */
export const ALL_SERVICE_CATEGORIES = [...SERVICE_CATEGORIES, ...BUILD_CATEGORIES] as const;

/** Shop sections. */
export const PRODUCT_CATEGORIES = [
  "Building materials", "Plumbing & fittings", "Electrical", "Paint & finishes", "Furniture & interiors",
  "Cleaning & pest control", "Other",
] as const;
