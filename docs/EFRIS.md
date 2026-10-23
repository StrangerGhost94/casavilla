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

## Automatic issuing ("api" mode)

Landlords can be set to **Issue EFRIS receipts automatically** (EFRIS receipts → Your EFRIS details). Then, the
moment a tenant pays, CasaVilla issues the document and the tenant's single CasaVilla receipt *becomes* the EFRIS
e-receipt (FDN at the top, seller = landlord with TIN, verification code, QR). If URA can't be reached it retries
hourly; if it still has no document, the landlord is reminded to record one.

`EFRIS_MODE` (Railway variable) decides how:

- `off` (default): automatic issuing unavailable; landlords record receipts by hand.
- `sandbox`: TEST documents made locally, marked TEST on screen and in the PDF; nothing is sent to URA.
- `ura`: URA's system-to-system interface — `uraIssue()` in `src/lib/efris.ts`.

### Before `ura` can work

URA must approve CasaVilla's system-to-system integration, and for **each landlord TIN** provide:

- the EFRIS device number and the key pair registered with URA;
- testing on URA's EFRIS test environment before production;
- the rental service registered as a "product" (goods/services code) in EFRIS.

With those, implement `uraIssue()` against URA's interface specification (invoice upload → returned FDN,
verification code and QR), keep keys in environment variables or an encrypted store (never plain in the database),
then set `EFRIS_MODE=ura`.
