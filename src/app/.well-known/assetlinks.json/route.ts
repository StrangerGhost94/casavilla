import { NextResponse } from "next/server";
import { ANDROID_FINGERPRINTS, ANDROID_PACKAGE } from "@/lib/android";

// Digital Asset Links: tells Android that the CasaVilla Play Store app may open this site full-screen
// (without it, the app shows a browser address bar). See lib/android.ts for the settings.
export const dynamic = "force-dynamic";

export function GET() {
  const body = ANDROID_FINGERPRINTS.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: ANDROID_FINGERPRINTS } }]
    : [];
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
