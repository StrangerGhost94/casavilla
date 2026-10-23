# EFRIS receipts (URA)

Renting real estate is one of URA's designated EFRIS sectors. A landlord who must use EFRIS issues an
**e-receipt** for rent received (an **e-invoice** with VAT if they are VAT-registered), under **their own TIN**.
CasaVilla's own receipt (CV-2026-…) is a payment record; the EFRIS document is the fiscal one.

## How it works now ("record" mode)

1. The landlord (or CasaVilla for them) sets up **EFRIS receipts → Your EFRIS details**: registered or not
   required, 10-digit TIN, VAT-registered or not, and the date from which payments need an EFRIS receipt.
2. When a payment comes in, the landlord gets a notification and the payment appears under
   **Waiting for an EFRIS receipt** (also counted on the dashboard).
3. They issue the receipt in URA's EFRIS app, desktop client or web portal, then record its **FDN**, the
   verification code, the date, and optionally URA's PDF/photo.
4. The tenant is notified; the FDN shows on their CasaVilla receipt (web and PDF) with URA's copy attached.
   Payments show an "EFRIS" or "EFRIS to follow" badge. The Excel financial report has an "EFRIS FDN" column.

Data: `efris_profiles` (one per landlord) and `efris_receipts` (one per payment, FDN unique).

## Switching on automatic issuing later ("api" mode)

URA's system-to-system integration lets CasaVilla issue the receipt itself the moment a payment succeeds.
It needs, **for each landlord TIN**:

- URA approval for system-to-system integration (request via the URA touchpoint / EFRIS team);
- the EFRIS device number URA assigns, and the key pair registered with URA;
- testing on URA's EFRIS test environment before production;
- the landlord's rental service registered as a "product" in EFRIS (goods/services code).

Once those exist, implement `issueAutomatically()` in `src/lib/efris.ts` against URA's interface
specification (invoice upload, then store the returned FDN/verification code/QR in `efris_receipts` with
`source = "api"`), call it from `completePayment()` in `src/lib/billing.ts` when the landlord's profile has
`mode = "api"`, and keep "record" mode as the fallback when URA is unreachable (EFRIS allows issuing offline
and uploading later). Credentials belong in environment variables or an encrypted store — never in the database
in plain text.
