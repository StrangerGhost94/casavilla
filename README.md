# CasaVilla Property Management

One web app (works on phones and computers) that connects four kinds of people, each with their own dashboard:

| Who | What they do |
|---|---|
| **Tenants** | Browse vacant homes and apply to the landlord they choose · pay rent by MTN / Airtel Mobile Money · get instant receipts · report repairs with photos · see their lease and documents · book providers and buy items |
| **Landlords** | Add properties and units · approve tenant applications (creates the lease and starts rent billing) · see who has paid and who owes · record cash/bank payments · assign repairs to providers · end leases |
| **Service providers** | List their services (cleaning, plumbing, electrical, structural, pest control, carpentry, painting…) · receive jobs, quote, start, mark done · sell items (paint, fittings, sprays…) and manage orders |
| **CasaVilla managers** | See everything · approve or suspend landlords and providers · assign unassigned repairs · act on any landlord's behalf · all payments and orders |

Built with Next.js 15, PostgreSQL and Prisma. Photos and documents are stored in the database, so no extra storage service is needed.

---

## Deploy on Railway

1. Push this folder to a new GitHub repo.
2. In Railway: **New project → Deploy from GitHub repo** → pick the repo.
3. In the same project: **New → Database → PostgreSQL**.
4. Open the app service → **Variables** and add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference to the database) |
   | `AUTH_SECRET` | any long random string (e.g. 40+ random characters) |
   | `MANAGER_EMAIL` | the email the CasaVilla office will log in with |
   | `MANAGER_PASSWORD` | a strong password for that account |
   | `APP_URL` | your public URL, e.g. `https://casavilla.up.railway.app` |
   | `PAYMENT_PROVIDER` | `sandbox` for now (see Mobile Money below) |

5. Railway builds with `npm run build` (which runs `prisma generate`) and starts with `npm start`, which runs `prisma migrate deploy` and creates the manager account if it doesn't exist.
6. **Settings → Networking → Generate domain** (or add your own domain).

Log in with `MANAGER_EMAIL` / `MANAGER_PASSWORD`. Landlords, tenants and providers sign up themselves at `/register`. Landlords and providers stay "pending" (hidden from the public) until a manager approves them in **People & approvals**.

### Optional demo data
To fill an empty database with sample landlords, tenants, providers, rent history and jobs, run once (Railway → app service → ⋯ → *Run command*, or locally with the Railway `DATABASE_URL`):

```
npm run seed
```

All demo accounts use the password `casavilla123`: `manager@demo.casavilla`, `landlord@demo.casavilla`, `tenant@demo.casavilla`, `provider@demo.casavilla` (and `tenant2`, `tenant3`, `provider2`, `landlord2`). **Don't run this on the live site with real customers.**

---

## Mobile Money

- `PAYMENT_PROVIDER=sandbox` (default): nothing is charged. After "Pay now", the payment page shows **Approve / Decline** test buttons so you can try the whole flow, receipts included.
- `PAYMENT_PROVIDER=flutterwave`: real MTN and Airtel Uganda collections through Flutterwave.
  1. Open a Flutterwave business account and enable Uganda Mobile Money (UGX).
  2. Set `FLW_SECRET_KEY` (from Flutterwave → Settings → API keys).
  3. In Flutterwave → Settings → Webhooks, set the URL to `https://YOUR-DOMAIN/api/payments/webhook` and choose a secret hash; put the same value in `FLW_WEBHOOK_HASH`.
  4. Test with a small real payment before telling tenants.

  The app never trusts the webhook alone: it re-checks every transaction with Flutterwave (status, currency and amount) before issuing a receipt.

Cash and bank payments are recorded by the landlord or a manager on the tenant's page, and also produce a numbered receipt (`CV-YYYY-000123`).

---

## The phone app

CasaVilla installs on phones straight from the website — no app store needed.

- **Android (Chrome):** open the site and tap **Install** on the "Get the CasaVilla app" card (or ⋮ → *Install app*).
- **iPhone (Safari):** tap **Install** on the card for the steps: Share → *Add to Home Screen* → Add.

The installed app has the CasaVilla icon, opens full-screen with its own splash screen, and starts at `/app`
(first launch: role picker and three welcome slides; after that it goes straight to sign in or the dashboard).
It also shows a branded screen when the phone is offline. Pages and payments always load fresh from the server.

Files: `src/app/manifest.ts` (name, icon, colours), `public/sw.js` (offline support), `public/icons/`, and
`public/splash/` (iPhone launch screens, generated from the `/app` splash), `public/launch.jpg` (launch photo) and `public/logo.png` (logo with transparent background). If you change the service worker,
bump `VERSION` at the top of `sw.js` so phones pick up the new one.

---

## How rent works

- Approving an application creates the lease. A deposit charge (if any) and one rent charge per month are raised automatically, due on the lease's due day.
- Tenants can pay part of a charge; it shows as *partial* until fully paid.
- Anything unpaid after its due date shows as *overdue* to the tenant, landlord and managers.
- Ending a lease frees the unit (and can re-list it straight away).

All dates and times use Kampala time.

---

## Run it on your computer

Needs Node 20+ and PostgreSQL.

```
cp .env.example .env      # edit DATABASE_URL etc.
npm install               # also runs prisma generate
npx prisma migrate deploy
npm run seed              # optional demo data
npm run dev               # http://localhost:3000
```

If you change `prisma/schema.prisma`, run `npx prisma migrate dev --name what-changed` to create a new migration in `prisma/migrations/`, then commit it. Railway applies it on the next deploy.

## Project layout

```
src/app/(public)   home, listings, providers, shop, login/register, my orders
src/app/tenant     tenant dashboard
src/app/landlord   landlord dashboard
src/app/provider   service provider dashboard
src/app/manager    CasaVilla manager dashboard
src/app/receipts   printable receipts
src/app/pay        Mobile Money payment status page
src/components     shared screens (jobs, leases, ledger, documents, properties)
src/lib            login sessions, billing, Mobile Money, uploads
prisma/schema.prisma   database tables
prisma/migrations/     database migrations (applied on start)
scripts/               ensure-manager (runs on start) and seed
```
