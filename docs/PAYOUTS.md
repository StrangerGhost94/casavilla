# Automatic split and tax for URA

Every successful tenant payment is split the moment it lands (`src/lib/split.ts`, `src/lib/payouts.ts`):

| Part | Rule |
|---|---|
| CasaVilla commission | landlord's agreed % (Landlord → commission) on rent and late fees, excluding VAT |
| VAT set aside | 18% inside the rent, only for VAT-registered landlords letting *commercial* property (residential is exempt) |
| Rental tax set aside | individual landlords: 12% of rent above UGX 2,820,000 per tax year (July–June), on the margin. Landlords set to "I pay my own tax" (e.g. companies): nothing |
| Pass-through | deposits, utility bills, repair recharges: no commission, no tax |
| Landlord's share | the rest, paid to them by CasaVilla's finance department |

All cash is recorded by the CasaVilla office (landlords no longer record payments, and there are no caretakers),
so it counts as CasaVilla's like Mobile Money.

## Paying landlords (outside the app)

Since November 2026 the app never sends money to landlords: CasaVilla's finance department pays them outside the
app, from the monthly **Landlord statements**. The split above is still worked out and recorded for every payment,
so statements and **Tax for URA** stay correct. `PAYOUT_MODE` and `PAYOUT_DAILY_LIMIT` are ignored, and the payout
pages and actions are switched off (`payoutMode()` in `src/lib/payouts.ts` always returns `off`).

Caretaker accounts were retired at the same time, so all cash is recorded by the CasaVilla office.

## Tax for URA

URA doesn't take tax payment-by-payment from apps. On **Tax for URA** CasaVilla sees what it holds per landlord
and tax type; it generates a PRN on URA's portal under the landlord's TIN, pays it, and records it (PRN, amount,
date). Managers get a reminder on the 10th of each month (VAT is due by the 15th).
