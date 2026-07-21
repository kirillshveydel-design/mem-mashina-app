// Service worker «Мем-машина» — офлайн-кэш SPA + офлайн-пак шаблонов
const CACHE_NAME = 'mem-mashina-v15';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './published-log.js',
  './editor.js',
  './captions.js',
  './video.js',
  './templates.js',
  './queue.js',
  './notes.js',
  './tabs.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './templates-pack/metadata.json',
  './templates-pack/tpl_181913649.jpg',
  './templates-pack/tpl_87743020.jpg',
  './templates-pack/tpl_112126428.jpg',
  './templates-pack/tpl_222403160.jpg',
  './templates-pack/tpl_217743513.jpg',
  './templates-pack/tpl_124822590.jpg',
  './templates-pack/tpl_322841258.png',
  './templates-pack/tpl_135256802.jpg',
  './templates-pack/tpl_252600902.png',
  './templates-pack/tpl_131087935.jpg',
  './templates-pack/tpl_131940431.jpg',
  './templates-pack/tpl_80707627.jpg',
  './templates-pack/tpl_4087833.jpg',
  './templates-pack/tpl_91538330.jpg',
  './templates-pack/tpl_129242436.jpg',
  './templates-pack/tpl_657846647.png',
  './templates-pack/tpl_97984.jpg',
  './templates-pack/tpl_161865971.jpg',
  './templates-pack/tpl_102156234.jpg',
  './templates-pack/tpl_101470.jpg',
  './templates-pack/tpl_309868304.jpg',
  './templates-pack/tpl_438680.jpg',
  './templates-pack/tpl_124055727.jpg',
  './templates-pack/tpl_188390779.jpg',
  './templates-pack/tpl_224015000.png',
  './templates-pack/tpl_79132341.jpg',
  './templates-pack/tpl_93895088.jpg',
  './templates-pack/tpl_61579.jpg',
  './templates-pack/tpl_100777631.jpg',
  './templates-pack/tpl_505705955.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => {
        console.error('SW install/precache failed:', err);
        throw err;
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Внешние API (imgflip, reddit, ffmpeg cdn) не кэшируем — пусть идут в сеть как есть
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res.ok && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
