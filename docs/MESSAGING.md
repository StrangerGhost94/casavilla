# WhatsApp, SMS & phone notifications set-up

## 0. Phone notifications (Web Push) — free, set up first

Every notification in the app (rent reminders, payments, repairs, applications…) can also pop up on people's
phones like any app notification, even when CasaVilla is closed. No per-message cost.

- Android: works in Chrome straight away.
- iPhone (iOS 16.4+): only after CasaVilla is added to the home screen (Share → Add to Home Screen); the app
  explains this when someone tries to turn notifications on.

People turn it on with **Turn on** on their home screen, on the Notifications page or in Profile.
Rent reminders go out **7 days before**, **3 days before** and **on the due day**, then when rent is late.
(Next month's rent is raised 7 days before it falls due so these can go out in time.)

Set up once:

```bash
npx web-push generate-vapid-keys
```

Railway variables (make the keys once and never change them, or everyone has to turn notifications on again):

```
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:info.casavilla026@gmail.com
```

Without them the Turn on button is hidden and nothing is sent.


CasaVilla sends sign-up codes, password-reset codes, rent reminders, receipts and notices to people's phones.
It tries **WhatsApp first** and falls back to **SMS**. Until at least one is connected:

- in development, codes are shown on screen ("test mode");
- in production, sign-up works without a code and "Forgot password" points to CasaVilla's WhatsApp;
- reminders and receipts are recorded (status "test") on **Manager → WhatsApp & SMS** but not sent.

Set `OTP_TEST_MODE=1` in Railway to try the code screens in production before a provider is connected
(the code is then shown on screen, so turn it off again afterwards).

## 1. WhatsApp (Meta WhatsApp Cloud API)

1. Create a Meta Business account (business.facebook.com) and verify the business.
2. In developers.facebook.com create an app → add **WhatsApp**. Add a phone number that is **not** already
   used on the WhatsApp app (a new SIM is easiest) and verify it.
3. Create a **permanent access token**: Business settings → System users → add a system user (Admin) →
   assign the app and the WhatsApp account → Generate token with `whatsapp_business_messaging` and
   `whatsapp_business_management`.
4. Create these message templates (WhatsApp Manager → Message templates). Language: **English (en)**.

| Name | Category | Body (exactly; the {{n}} are filled in by the app) |
|---|---|---|
| `casavilla_code` | **Authentication** | Use Meta's standard authentication text, with a **Copy code** button. Tick "Add security recommendation" and set expiry to 10 minutes. |
| `rent_reminder` | Utility | `Hello {{1}}, this is a reminder from CasaVilla: {{2}} for {{3}} {{4}}. You can pay with Mobile Money here: {{5}} Thank you.` |
| `casavilla_notice` | Utility | `Hello {{1}}, {{2}} Thank you, CasaVilla.` |

   Sample values for review: `{{1}}` Okello · `{{2}}` UGX 850,000 · `{{3}}` October 2026 rent (Rubaga Court · Apt A1)
   · `{{4}}` is due on 5 Oct 2026 · `{{5}}` https://casavilla-production.up.railway.app/tenant/pay/12

5. In Railway → your service → Variables, add:

```
WHATSAPP_TOKEN=<the permanent token>
WHATSAPP_PHONE_ID=<"Phone number ID" from WhatsApp → API setup>
```

Optional: `WHATSAPP_OTP_TEMPLATE`, `WHATSAPP_REMINDER_TEMPLATE`, `WHATSAPP_NOTICE_TEMPLATE` if you used other
names; `WHATSAPP_LANG` (default `en`); `WHATSAPP_API_VERSION` (default `v24.0`).

Meta charges per message for authentication and utility templates (Uganda rates are listed on Meta's pricing
page). Messages only reach people who agreed — the sign-up form has a tick box, and each person can switch it
off under Profile → WhatsApp & SMS.

## 2. SMS (Africa's Talking) — the fallback

1. Sign up at africastalking.com, create a team and an app for Uganda, and top up.
2. Optional: request a sender ID (e.g. `CASAVILLA`) — without one, messages come from a shared short code.
3. Railway variables:

```
AT_USERNAME=<your app username>
AT_API_KEY=<the app's API key>
AT_SENDER_ID=CASAVILLA        # only once approved
```

Using `AT_USERNAME=sandbox` with a sandbox key sends to Africa's Talking's simulator instead of real phones.

## 3. Check it

Manager → **WhatsApp & SMS** shows which providers are connected and every message with its status.
Tap **Send a test to my phone**. Failed messages show the reason, and System health flags them.

## What gets sent

- Sign-up: a 6-digit code to confirm the number (10-minute expiry, 5 tries, at most 3 codes per 10 minutes).
- Forgot password: a code, then a new password (the person picks the account if several share the number).
- Rent: 3 days before the due date, on the day, then 3 and 7 days late — 8am–8pm Kampala time only,
  and only if the landlord has reminders on (Profile → WhatsApp & SMS).
- Receipts when a payment is recorded; inspection reports ready to review; utility bills; caretaker invitations.
