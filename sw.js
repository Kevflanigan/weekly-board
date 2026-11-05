// Bored of Dinner service worker: lets the installed app open with no signal, WITHOUT ever serving an out-of-date page while online.
//  - Pages: network first (you always get the latest when online); the last good copy is only a fallback when offline.
//  - Icons and the manifest: show the saved copy instantly, refresh it in the background.
//  - Everything else (sign-in, Firebase, the scanner, fonts, any write) is never touched.
// To switch it off: open the app with ?nosw=1, or replace this file with one that only unregisters itself.
const VERSION = "bod-v1", PAGES = VERSION + "-pages", STATIC = VERSION + "-static";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== PAGES && k !== STATIC) await caches.delete(k);   // old versions
  await self.clients.claim();
})()));
async function networkFirst(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic") await cache.put("/", res.clone());   // one page app: keep the last good copy
    return res;
  } catch (e) {
    return (await cache.match("/")) || Response.error();
  }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC), hit = await cache.match(req);
  const refresh = fetch(req).then(res => { if (res && res.ok && res.type === "basic") cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await refresh) || Response.error();
}
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return;       // writes and other sites: not ours
  if (r.mode === "navigate") { e.respondWith(networkFirst(r)); return; }
  if (/\.(?:png|jpe?g|svg|ico|webmanifest)$/i.test(u.pathname) || u.pathname === "/manifest.json") e.respondWith(staleWhileRevalidate(r));
});
