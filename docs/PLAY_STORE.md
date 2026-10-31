# CasaVilla on Google Play

The Android app is a **Trusted Web Activity (TWA)**: a small Android wrapper that opens https://casavillaproperties.com
full-screen. No Flutter or native code — the app *is* the website, so every push to `main` updates it without a new
Play Store upload.

- Package name: `com.casavillaproperties.app` (can never change after the first upload)
- Start page: `/app` (the launch screen), same as the installed web app
- Verification: `https://casavillaproperties.com/.well-known/assetlinks.json` (served by `src/app/.well-known/assetlinks.json/route.ts`)

## 1. Google Play developer account (CasaVilla does this)
1. Go to https://play.google.com/console and sign up with CasaVilla's Google account.
2. Choose an **organisation** account if CasaVilla is registered (needs a D-U-N-S number); otherwise personal.
3. Pay the one-off US$25 fee and complete identity verification (can take a few days).
4. Personal accounts must run a closed test with at least 12 testers for 14 days before going public.

## 2. Build the app bundle (developer)
```
npx @bubblewrap/cli init --manifest https://casavillaproperties.com/manifest.webmanifest
npx @bubblewrap/cli build
```
- `init` asks for the package name (`com.casavillaproperties.app`) and creates a signing key (**upload key**).
  It offers to download Java and the Android SDK — say yes.
- **Back up the keystore file and its passwords somewhere safe.** Losing them means asking Google to reset the upload key.
- `build` produces `app-release-bundle.aab` — this is what gets uploaded.

## 3. Play Console listing (CasaVilla + developer)
- Create the app, upload the `.aab` to a testing track, fill in the store listing (description, screenshots, feature
  graphic 1024×500, icon 512×512), content rating, data safety form, and the privacy policy link
  (`https://casavillaproperties.com/privacy` — have it approved first).
- Play Console → **Test and release → App integrity → App signing**: copy the **SHA-256 certificate fingerprint**
  (and the upload key's too).

## 4. Connect the app to the site (Railway variables)
- `ANDROID_SHA256_CERT` = the fingerprint(s) from step 3, comma-separated
- `ANDROID_PACKAGE` = `com.casavillaproperties.app` (only if different)
- `ANDROID_PLAY_LIVE=1` once the listing is public — the "Get it on Google Play" badge appears on `/get-app`

Check: https://casavillaproperties.com/.well-known/assetlinks.json shows the fingerprint, and the installed app opens
with no address bar.
