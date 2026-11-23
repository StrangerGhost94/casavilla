# CasaVilla on Google Play: store listing and Play Console answers

Everything to paste into Play Console. Graphics are in this folder. See `../PLAY_STORE.md` for building the app itself.

## Graphics

| Play Console field | File | Size |
|---|---|---|
| App icon | `icon-512.png` | 512 × 512 PNG (with transparency) |
| Feature graphic | `feature-graphic.png` | 1024 × 500 |
| Phone screenshots (2–8) | `screenshots/1-home.png` … `7-repair.png` | 1080 × 1920 |

The screenshots use demo data (made-up names and amounts). Once real homes with photos are listed, add a screenshot of a
listing page; until then the listing pages would show empty photo spaces.

## Main store listing

**App name** (30 max)
CasaVilla Property Management

**Short description** (80 max)
Find homes, pay rent by Mobile Money, get receipts and report repairs in Uganda.

**Full description** (4,000 max)

CasaVilla Property Management in one app: find a home, pay your rent and get repairs done, all through the CasaVilla office in Kampala.

FOR TENANTS
• Pay rent with MTN or Airtel Mobile Money and approve it on your phone
• Get a numbered receipt straight away, in the app and by email
• Pay one or more months ahead; the app shows what your rent is paid up to
• Report a repair with a photo and follow it until it's fixed
• See your lease, your balance and every payment in one place
• Reminders before rent is due

FIND YOUR NEXT HOME
• Houses and apartments to rent, filtered by area, bedrooms and budget
• Short stays you can book and pay for by Mobile Money
• Land and houses for sale
• Book a viewing and apply in the app
• Homes that CasaVilla has visited show a Verified badge

FOR LANDLORDS
• See the rent coming in and who hasn't paid
• Monthly statements and financial reports, ready to download
• CasaVilla collects rent, follows up late payers and handles repairs for you

ALSO IN THE APP
• Book cleaning, plumbing, electrical and other services from approved providers
• Plan a building project with CasaVilla

Questions: WhatsApp or call CasaVilla on +256 776 593 482.

Developed by Ayebale Elijah for CasaVilla Property Management.

**App category:** House & Home
**Contact email:** info.casavilla026@gmail.com (confirm with the client)
**Phone:** +256 776 593 482
**Website:** https://casavillaproperties.com
**Privacy policy:** https://casavillaproperties.com/privacy (the client must approve the page first)

## App content (Policy → App content)

**App access.** Most features need an account, so Google's reviewers need one. Before submitting, create a tenant
account on the live site just for them (for example `playreview@casavillaproperties.com`, a long random password), and
give it in "All or some functionality is restricted" with this note:
"Sign in with the account above. To see rent payments, open My home. Payments are made with Mobile Money in Uganda."
Don't use a real person's account.

**Ads:** No, the app has no ads.

**Content rating questionnaire:** Category "Utility, productivity, communication or other". No violence, sexual content,
language, drugs or gambling. Users can interact? Choose **No** (there is no chat between users; messages go to CasaVilla).
Shares location? **No** (location is only used to search nearby homes). Digital purchases? **No** (rent and bookings are
real-world services paid by Mobile Money, not in-app purchases).

**Target audience:** 18 and over. Not designed for children.

**News app:** No. **Government app:** No. **Financial features:** none of the listed (no loans, banking or crypto);
the app takes payments for rent and bookings through a licensed payment provider.

**Data safety** (what the app collects; nothing is sold, nothing is used for ads):

| Data type | Collected | Why | Optional? |
|---|---|---|---|
| Name, email address, phone number | Yes | Account, receipts, contacting you | Required |
| Address / area you live in | Yes | Finding homes and services near you | Optional |
| Precise location | Yes, only when you tap "Near me" | Showing homes near you; not stored | Optional |
| Payment info (Mobile Money number) and purchase history (rent, bookings) | Yes | Payments and receipts | Required to pay |
| Photos (repair photos, property photos) | Yes | Repairs and listings | Optional |
| Files and documents (ID and agreements for landlords and agents) | Yes | Checking who people are | Required for landlords and agents |
| Device or other IDs (notification token) | Yes | Push notifications | Optional |

- **Shared with third parties:** the payment provider (Flutterwave) receives the phone number and amount to process a
  Mobile Money payment; the email service (Resend) receives the email address to send receipts and codes. Both act for
  CasaVilla (service providers), which Play does not count as "sharing".
- **Encrypted in transit:** Yes (HTTPS only).
- **Users can ask for data to be deleted:** Yes. In the app: Profile → Delete my account.
  **Delete account URL:** https://casavillaproperties.com/delete-account
- **Data kept after deletion:** payment, receipt, lease and booking records, without the person's name, email or phone,
  because Ugandan law requires them to be kept.

## After the first upload

1. Play Console → Test and release → App integrity → App signing: copy the **SHA-256 certificate fingerprint**.
2. In Railway set `ANDROID_SHA256_CERT` to it (and the upload key's, comma-separated). Without this the app opens
   with a browser address bar.
3. When the listing is public, set `ANDROID_PLAY_LIVE=1` to show the "Get it on Google Play" badge on the site.
