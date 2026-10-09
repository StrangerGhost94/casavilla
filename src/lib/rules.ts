/** Allowed status changes. Anything not listed here is refused, so records can't jump into impossible states. */
export const JOB_FLOW: Record<string, string[]> = {
  open: ["assigned", "cancelled"],
  assigned: ["assigned", "quoted", "accepted", "open", "cancelled"],
  quoted: ["assigned", "accepted", "cancelled"],
  accepted: ["assigned", "in_progress", "cancelled"],
  in_progress: ["assigned", "done", "cancelled"],
  done: ["open", "assigned"],
  cancelled: ["open", "assigned"],
};

export const ORDER_FLOW: Record<string, string[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export const canMove = (flow: Record<string, string[]>, from: string, to: string) => (flow[from] ?? []).includes(to);

export const JOB_LABEL: Record<string, string> = {
  open: "Waiting for a provider", assigned: "Waiting for provider to accept", quoted: "Quote awaiting approval",
  accepted: "Accepted — work not started", in_progress: "Work in progress", done: "Completed", cancelled: "Cancelled",
};

/** Who pays for a job: direct bookings are paid by whoever booked; repair requests by the landlord. */
export const payerOf = (j: { serviceId: number | null; landlordId: number | null; requesterId: number }) =>
  j.serviceId ? j.requesterId : j.landlordId ?? j.requesterId;

export const CHARGE_KINDS = ["utility", "repair", "other"] as const;
export const CHARGE_KIND_LABEL: Record<string, string> = {
  rent: "Rent", deposit: "Deposit", late_fee: "Late fee", utility: "Utility bill", repair: "Repair / damage", other: "Other",
};

/** Days of grace after the due date before a late fee is added. */
export const LATE_FEE_GRACE_DAYS = 7;
/** Pending mobile-money payments older than this are closed as failed. */
export const PAYMENT_TIMEOUT_MIN = 30;
/** Tenants can pay ahead by up to this many months of rent. */
export const MAX_ADVANCE_MONTHS = 6;

/** Features a landlord can tick for a unit (shown on listings and in the tenancy agreement). */
export const AMENITIES = ["Water (NWSC)", "Water tank", "Yaka power", "Solar backup", "Parking", "Security / askari", "CCTV", "Wi-Fi", "Balcony", "Garden", "Tiled floors", "Fitted kitchen", "Wardrobes", "Hot shower", "Gated", "Pet friendly"] as const;
