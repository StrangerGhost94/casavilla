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
- `ura`: URA's system-to-system interface (`src/lib/efris-ura.ts`), with **each landlord's own TIN, device and key**.

## Direct URA system-to-system (`EFRIS_MODE=ura`)

When a tenant's payment succeeds, CasaVilla builds the invoice for the **amount actually paid** and submits it to
URA (T109) under the landlord's TIN. It then saves the returned FDN, verification code and QR on the tenant's receipt.

**One EFRIS connection per landlord.** No global key: each landlord's EFRIS profile holds:

| Field | Notes |
|---|---|
| URA TIN | 10 digits (landlord's EFRIS details) |
| EFRIS device number | the system-to-system device URA registers for that TIN |
| Private key | uploaded (.pfx/.p12/.pem/.key, with its password) or made here; stored AES-256-GCM-encrypted with `EFRIS_KEY_SECRET`, never shown again (only its fingerprint and public key) |
| Environment | URA test (`efristest.ura.go.ug`) or live |
| Commodity codes | URA goods & services category for residential / commercial rent |
| Measure unit | chosen from URA's list (loaded by "Test connection") |
| Seller names, address | filled from URA's login, editable |

Every call is built from the profile of the payment's landlord, so TINs never mix.

**Rent as a service line.** Each unit's charges are registered with URA (T130) the first time they're receipted.
For example, `Residential Rent - Unit 3B` has the code `CV12-RENT`, and late fees, utilities and repairs each get their own line.
Rows live in `efris_goods`.

**Tax on the document — from URA's commodity list.** "Test connection" asks URA (T124) for the official
treatment of each rent commodity code: standard (with its rate), zero-rated or exempt, and whether the code is a
final item (URA only accepts those). It is stored on the profile (`commodity_tax`), shown on the URA connection
screen, and used on every document:
- Not VAT-registered: e-receipt (invoiceKind 2), out of scope (OOS), no tax details.
- VAT-registered: e-invoice (invoiceKind 1) with URA's treatment for the code (standard rate inside the rent,
  zero-rated, or exempt). Only until URA has answered: commercial rent 18%, residential exempt.
- Changing a commodity code means pressing Test connection again; the old answer isn't used for the new code.
- Deposits are never fiscalised.

**Credit notes.** On a receipt issued automatically, the landlord or CasaVilla can apply for a credit note (full
or part of the document; reason 102 refunded / cancelled, 103 wrongly stated, 104 waived, 105 other with a note):
1. T108 reads the original document's lines; T110 sends the application with those lines negative (a partly
   credited line keeps its unit price, fractional quantity, tax pro rata).
2. T111 follows URA's decision (on submit, then hourly): approved → the credit note's own FDN and verification
   code (T108) are saved and the tenant and landlord are told; rejected → URA's remark is shown.
3. A pending application can be withdrawn (T120); an approved credit note can be cancelled (T114, category 104),
   which completes when URA marks it invalid.
At most the document's amount can be credited in total. In test mode (`sandbox`) the whole flow is simulated.
The credit note corrects the fiscal document only — any money goes back to the tenant separately.
Receipts recorded by hand get their credit notes in URA's own EFRIS app.

Data: `efris_credit_notes`.

> The T110/T111/T114/T120/T124 field names follow the EFRIS interface as published; confirm them against
> URA's Interface Specification v1.5 during UAT on the test environment before going live.

**When URA can't be reached** the payment goes to `efris_attempts` and is retried hourly. After 6 tries it stops and
asks for it to be recorded by hand.

**When URA took it but the answer was lost**, the payment is marked *uncertain*. Before anything is sent again,
CasaVilla asks URA (T106 by the CasaVilla receipt number, then T108) whether the document already exists, so no
payment gets two FDNs. Uncertain payments are never given up automatically. Managers see all of these under
"Automatic issuing needs attention", with "Try now".

Landlords are only told to issue by hand when automatic issuing isn't working for them, so they never issue a
second document alongside CasaVilla's.

### Switching it on

1. In Railway → casavilla → Variables, add `EFRIS_KEY_SECRET`: a long random value (40+ characters) that you make
   yourself. Never change it afterwards, because stored keys can only be opened with it.
2. Set `EFRIS_MODE=ura`.
3. For each landlord, on **EFRIS receipts → Landlords → (name) → URA connection**:
   - enter the device number and commodity code(s);
   - upload their key, or **Make a new key pair** and upload the shown public key in URA's EFRIS portal for that device;
   - choose **URA environment: Test** and press **Test connection**;
   - pick the measure unit, save, and tick **Issue EFRIS receipts automatically** in their EFRIS details.
4. Make a test payment and check the FDN on URA's test portal. Then switch that landlord to **Live EFRIS** and test the connection again.

`EFRIS_TEST_URL` (optional, test environment only) points at a local mock of URA for development.

### Not covered yet

Business (B2B) and government (B2G) tenants are not handled yet: tenants are sent as B2C buyers, and a buyer
with a TIN is only sent as B2B where one is supplied. Buyer TINs are not validated with URA (T119).
