// The Android app in Google Play: a Trusted Web Activity that opens this site full-screen.
// Set in Railway once the Play Console app exists:
//   ANDROID_PACKAGE      com.casavillaproperties.app by default (must match the Play listing; it can never change after the first upload)
//   ANDROID_SHA256_CERT  the app signing key's SHA-256 fingerprint(s) from Play Console → App integrity, comma-separated
//   ANDROID_PLAY_LIVE=1  once the listing is public, so the site shows the "Get it on Google Play" badge

export const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE || "com.casavillaproperties.app";
export const ANDROID_FINGERPRINTS = (process.env.ANDROID_SHA256_CERT || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
export const PLAY_URL = process.env.ANDROID_PLAY_LIVE === "1" ? `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}` : null;
