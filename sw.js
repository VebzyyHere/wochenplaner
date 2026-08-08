/* Wochenplaner — Service Worker

   Zweck: die App startet vom Homescreen auch ohne Netz.

   Bewusst **network-first** für die Seite selbst. Die naheliegende Variante
   (cache-first) ist schneller, aber sie zeigt nach einer Veröffentlichung
   tagelang die alte Fassung — genau der Fehler, der in diesem Projekt schon
   zu „die Seite sieht alt aus" geführt hat. Hier gilt: gibt es Netz, kommt
   die frische Datei; gibt es keins, kommt die letzte gespeicherte.

   Fremde Adressen (Supabase) werden nie angefasst. Ein zwischengespeicherter
   Plan wäre schlimmer als kein Plan.
*/

const V = "wp-v1.19";
const SCHALE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(SCHALE.map(u => c.add(new Request(u, { cache: "reload" })))))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter(n => n !== V).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Die App darf das Warten abkürzen, wenn der Nutzer „Jetzt laden" tippt.
self.addEventListener("message", e => {
  if (e.data === "uebernehmen") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase & Co: unberührt

  e.respondWith((async () => {
    try {
      const frisch = await fetch(req);
      if (frisch && frisch.ok) {
        const c = await caches.open(V);
        c.put(req, frisch.clone());
      }
      return frisch;
    } catch (err) {
      const treffer = await caches.match(req, { ignoreSearch: true });
      if (treffer) return treffer;
      if (req.mode === "navigate") {
        const seite = await caches.match("./index.html");
        if (seite) return seite;
      }
      throw err;
    }
  })());
});
