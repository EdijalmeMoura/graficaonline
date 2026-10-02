/* PrimePrint PWA — atualize C junto com ?v= das páginas */
const C = 'pp-v36';
const CORE = ['/', '/index.html', '/orcamento.html', '/manifest.json',
  '/css/style.css?v=36', '/css/dash.css?v=36',
  '/js/app.js?v=36', '/js/shop.js?v=36', '/js/conta.js?v=36', '/js/admin.js?v=36',
  '/img/icon-192.png', '/img/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/uploads/')) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    const cp = r.clone();
    caches.open(C).then(c => c.put(e.request, cp));
    return r;
  }).catch(() => caches.match('/index.html'))));
});
