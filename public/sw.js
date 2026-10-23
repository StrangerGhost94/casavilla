// CasaVilla service worker: makes the app installable, keeps app assets on the phone
// so it opens fast, and copes with flaky connections (some networks drop or block requests).
// Private pages (rent, payments, dashboards) always come fresh from the server and are never stored.
const VERSION = "cv-v32";
const PAGES = "cv-pages-v1";
const PHOTOS = "cv-photos-v1"; // public listing photos, kept on the phone so they open instantly next time
const MAX_PHOTOS = 250;
const SHELL = ["/offline.html", "/launch.jpg", "/logo.png", "/logo-light.png", "/icons/icon-192.png", "/icons/apple-touch-icon.png"];

// Public marketplace pages: kept as a fallback so the app still opens (with a "not up to date" note) when the
// network fails. Nothing behind sign-in is kept, and nothing rendered for a signed-in person.
const PUBLIC = /^\/($|listings(\/\d+)?$|stays(\/\d+)?$|sale(\/\d+)?$|services$|shop$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== PAGES && k !== PHOTOS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A dropped request on mobile data often succeeds a moment later: try three times before giving up. */
async function fetchWithRetry(req) {
  let last;
  for (const delay of [0, 1500, 3500]) {
    if (delay) await wait(delay);
    try { return await fetch(req); } catch (e) { last = e; }
  }
  throw last;
}

// Added after the page has started (the app would remove anything inserted into its markup before that).
const STALE_NOTE = `<script>setTimeout(function(){var d=document.createElement("div");d.textContent="You're offline — showing what you last saw. It will refresh when you're back online.";d.style.cssText="position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top) + 10px);z-index:9999;background:#865f24;color:#fff;font:600 12px/1.4 system-ui,sans-serif;padding:9px 12px;border-radius:12px;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.25)";document.body.appendChild(d);addEventListener("online",function(){location.reload()});setInterval(function(){fetch("/manifest.webmanifest",{cache:"no-store"}).then(function(r){if(r.ok)location.reload()}).catch(function(){})},10000);},1200)</script>`;

/** Keeps the photo store to a sensible size by dropping the oldest entries. */
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_PHOTOS) await Promise.all(keys.slice(0, keys.length - MAX_PHOTOS).map((k) => cache.delete(k)));
}

async function stalePage(req) {
  const hit = await caches.open(PAGES).then((c) => c.match(req, { ignoreSearch: false }));
  if (!hit) return null;
  const html = (await hit.text()).replace("</body>", `${STALE_NOTE}</body>`);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: the network (with retries); for public pages keep a copy; otherwise the offline screen.
  if (req.mode === "navigate") {
    const isPublic = PUBLIC.test(url.pathname);
    event.respondWith((async () => {
      try {
        const res = await fetchWithRetry(req);
        // Only pages rendered for a signed-out visitor are kept (a signed-in home page can show someone's rent).
        if (isPublic && res.ok && res.type === "basic" && !res.headers.get("x-cv-signed-in")) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(req, copy)); }
        return res;
      } catch {
        return (isPublic && (await stalePage(req))) || (await caches.match("/offline.html"));
      }
    })());
    return;
  }

  // Uploaded photos: from the phone if we have them; otherwise fetched and kept — but only public ones
  // (documents and other private files are never stored on the device).
  if (url.pathname.startsWith("/api/files/")) {
    event.respondWith((async () => {
      const cache = await caches.open(PHOTOS);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetchWithRetry(req);
      if (res.ok && (res.headers.get("Cache-Control") || "").includes("public") && (res.headers.get("Content-Type") || "").startsWith("image/")) {
        const copy = res.clone();
        event.waitUntil(cache.put(req, copy).then(() => trim(cache)));
      }
      return res;
    })());
    return;
  }

  // The logo and launch image are kept on the phone so the offline screens look right.
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }

  // Build assets are content-hashed, so they are safe to keep forever.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/splash/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});
