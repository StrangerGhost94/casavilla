import { PrismaClient } from "@prisma/client";
import { trackChange, tracked } from "./track";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
// One client (and one connection pool) per server. PRISMA_LOG=1 prints every query, to spot slow pages and N+1s.
const base = globalForPrisma.prisma ?? new PrismaClient(process.env.PRISMA_LOG ? { log: ["query"] } : undefined);
globalForPrisma.prisma = base;

/**
 * The database, with every change an office account makes recorded in the audit trail (see ./track).
 * The extension only watches queries, so the client is used exactly like a plain PrismaClient.
 */
export const db = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!tracked(model, operation)) return query(args);
        return trackChange(base, model, operation, args as Record<string, unknown>, query as (a: unknown) => Promise<unknown>);
      },
    },
  },
}) as unknown as PrismaClient;

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
