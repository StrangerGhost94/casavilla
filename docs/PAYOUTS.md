# Automatic split, landlord payouts and tax for URA

Every successful tenant payment is split the moment it lands (`src/lib/split.ts`, `src/lib/payouts.ts`):

| Part | Rule |
|---|---|
| CasaVilla commission | landlord's agreed % (Landlord → commission) on rent and late fees, excluding VAT |
| VAT set aside | 18% inside the rent, only for VAT-registered landlords letting *commercial* property (residential is exempt) |
| Rental tax set aside | individual landlords: 12% of rent above UGX 2,820,000 per tax year (July–June), on the margin. Landlords set to "I pay my own tax" (e.g. companies): nothing |
| Pass-through | deposits, utility bills, repair recharges: no commission, no tax |
| Landlord's share | the rest, sent to their Mobile Money or bank |

Cash collected by a landlord or caretaker stays with them, so its commission and tax are owed back and taken from
their next payouts (oldest first). Cash paid at the CasaVilla office (recorded by a manager) counts as CasaVilla's.

Payouts are recorded only for payments made after this feature went live, so nothing already paid is paid again.

## Switching real payouts on (Railway → casavilla → Variables)

1. Make sure Flutterwave **Transfers / Payouts** is enabled on CasaVilla's Flutterwave account, and that the
   account keeps enough UGX balance (collections can take time to settle before they can be sent on).
2. Test first with Flutterwave's test keys: `PAYMENT_PROVIDER=flutterwave`, test `FLW_SECRET_KEY`,
   `PAYOUT_MODE=live`, and make one small payment. Check that the Mobile Money transfer settings work for Uganda
   (`account_bank: "MPS"`, number with 256) and, for banks, put each landlord's Flutterwave bank code in their
   payout details.
3. Then switch to the live key. Optional: `PAYOUT_DAILY_LIMIT=20000000` (UGX) holds anything beyond that per
   24 hours for a manager to release.

Modes: `PAYOUT_MODE=off` (default; split and queue only), `sandbox` (simulated), `live` (real transfers).
Automatic sending only picks up payouts from the last 48 hours; older ones wait on **Payouts to landlords** for
"Send now" or "Paid outside the app".

## Tax for URA

URA doesn't take tax payment-by-payment from apps. On **Tax for URA** CasaVilla sees what it holds per landlord
and tax type; it generates a PRN on URA's portal under the landlord's TIN, pays it, and records it (PRN, amount,
date). Managers get a reminder on the 10th of each month (VAT is due by the 15th).
