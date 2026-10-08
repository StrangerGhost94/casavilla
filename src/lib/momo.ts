import "server-only";

/**
 * Mobile Money adapter.
 * - PAYMENT_PROVIDER=sandbox (default): no money moves; the payment page offers test approve/decline buttons.
 * - PAYMENT_PROVIDER=flutterwave: charges MTN / Airtel Uganda mobile money through Flutterwave.
 */
export const provider = (process.env.PAYMENT_PROVIDER || "sandbox") as "sandbox" | "flutterwave";
const FLW = "https://api.flutterwave.com/v3";

export type InitResult = { ok: true; redirect?: string } | { ok: false; error: string };

export async function initiateCharge(opts: {
  reference: string; amount: number; phone: string; network: "mtn" | "airtel"; email: string; name: string;
}): Promise<InitResult> {
  if (provider === "sandbox") return { ok: true };
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${FLW}/charges?type=mobile_money_uganda`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: opts.reference, amount: opts.amount, currency: "UGX", email: opts.email,
        phone_number: opts.phone.replace("+", ""), fullname: opts.name, network: opts.network.toUpperCase(),
        redirect_url: `${appUrl}/pay/${opts.reference}`,
      }),
    });
    const json = await res.json();
    if (json.status !== "success") return { ok: false, error: json.message || "Payment could not be started" };
    return { ok: true, redirect: json.meta?.authorization?.redirect };
  } catch (e) {
    return { ok: false, error: "Could not reach the payment provider. Try again." };
  }
}

/** Returns the final status of a charge from the provider, or "pending" if not settled yet. */
export async function verifyCharge(reference: string, expectedAmount: number): Promise<"success" | "failed" | "pending"> {
  if (provider === "sandbox") return "pending";
  try {
    const res = await fetch(`${FLW}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` }, cache: "no-store",
    });
    const json = await res.json();
    const d = json.data;
    if (!d) return "pending";
    if (d.status === "successful" && d.currency === "UGX" && Number(d.amount) >= expectedAmount) return "success";
    if (d.status === "failed") return "failed";
    return "pending";
  } catch {
    return "pending";
  }
}
