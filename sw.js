/* sw.js — Service worker: guarda la aplicación para uso sin conexión.
   Los archivos WHONET nunca pasan por aquí: se leen en memoria desde el equipo del usuario. */
const CACHE = 'germen-whonet-v1.1.0';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/lectores.js', 'js/organismos.js', 'js/calidad.js', 'js/anonimizar.js', 'js/app.js',
  'vendor/xlsx.full.min.js', 'vendor/sql-wasm.js', 'vendor/sql-wasm.wasm',
  'icons/logo_germen.png', 'icons/favicon-64.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/maskable-512.png', 'icons/apple-touch-icon.png'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(resp => {
    if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
    return resp;
  }).catch(() => caches.match('index.html'))));
});
