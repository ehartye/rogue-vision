const VERSION = "__VERSION__";
const SHELL = __SHELL__;
const PREFIX = "fogfall-" + encodeURIComponent(self.registration.scope) + "-";
const CACHE = PREFIX + VERSION;
const urls = SHELL.map((path) => new URL(path, self.registration.scope).href);
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(urls))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith(PREFIX) && name !== CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    !url.href.startsWith(self.registration.scope)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const key =
        event.request.mode === "navigate"
          ? new URL("index.html", self.registration.scope).href
          : event.request;
      return (await cache.match(key)) || fetch(event.request);
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CHECK_CACHE") return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const ready = (
        await Promise.all(urls.map((url) => cache.match(url)))
      ).every(Boolean);
      event.ports[0]?.postMessage({ ready, version: VERSION });
    })(),
  );
});
