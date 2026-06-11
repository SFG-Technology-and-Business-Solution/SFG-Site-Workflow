// Kill-switch service worker. The previous Site Buddy PWA registered a
// service worker at /sw.js on visitors' browsers; this replacement takes
// over on their next visit, clears the old caches, and unregisters itself
// so they get the live VSM Buddy app instead of stale cached pages.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
