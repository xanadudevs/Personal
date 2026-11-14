// Service worker da app: abre mesmo sem rede com a última versão vista.
const CACHE = "miudos-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const mine = url.pathname === "/" || url.pathname === "/api/miudos" || url.pathname.startsWith("/_next/static/");
  if (!mine) return;
  // A chave vai no cabeçalho; chave de cache só pelo URL.
  const key = new Request(url.pathname + url.search);
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(key).then((hit) => hit || Response.error())),
  );
});
