import "server-only";
import webpush from "web-push";
import { db } from "@/db";

/**
 * Web Push: notifications that pop up on the phone (Android, and iPhone once CasaVilla is added to the home
 * screen) even when the app is closed. Free — no SMS or WhatsApp costs. Needs three Railway variables:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   from `npx web-push generate-vapid-keys` (make once, never change)
 *   VAPID_SUBJECT                          mailto: address the push services can contact, e.g. mailto:info@…
 * See docs/MESSAGING.md. Without them the "phone notifications" button is hidden and nothing is sent.
 */
export const pushConfigured = () => !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

let ready = false;
function setup() {
  if (ready || !pushConfigured()) return ready;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:info.casavilla026@gmail.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return (ready = true);
}

/** Sends to every phone the person turned notifications on for. Never throws; drops phones that unsubscribed. */
export async function sendPush(userId: number, p: { body: string; url?: string | null; title?: string; tag?: string }) {
  if (!setup()) return 0;
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: p.title ?? "CasaVilla", body: p.body, url: p.url || "/notifications", tag: p.tag }),
        { TTL: 60 * 60 * 24, urgency: "normal" },
      );
      sent++;
      await db.pushSubscription.update({ where: { id: s.id }, data: { lastOkAt: new Date() } }).catch(() => {});
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // 404/410: the phone turned notifications off or the subscription expired — forget it.
      if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      else console.error("push", userId, code ?? (e as Error).message);
    }
  }));
  return sent;
}
