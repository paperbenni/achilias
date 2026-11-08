/** Only public, account-independent files belong in the offline cache. */
export function serviceWorkerSource(build: string) {
  return `
const CACHE = ${JSON.stringify(`achilias-shell-${build}`)};
const ASSETS = [
  '/offline.html', '/offline.css', '/offline.js',
  '/icons/app-192.png', '/icons/app-512.png', '/icons/apple-touch-icon.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    ASSETS.map(url => new Request(url, { cache: 'reload', credentials: 'omit' }))
  )));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('achilias-shell-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  // An open app explicitly asks to apply an update. Never reload forms silently.
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.open(CACHE).then(async cache =>
      (await cache.match(request)) || fetch(request)
    ));
    return;
  }
  // Never cache authenticated HTML, RSC payloads, API responses, or files.
  // Failed API requests must remain failures, not receive HTML or be replayed.
  if (request.mode !== 'navigate' || url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/_next/')) return;
  event.respondWith(fetch(request).catch(async () =>
    (await (await caches.open(CACHE)).match('/offline.html')) ||
    new Response('Achilias is offline. Reconnect and try again.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    })
  ));
});
`;
}
