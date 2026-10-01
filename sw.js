// 서비스 워커: 앱 셸 선캐시 + stale-while-revalidate.
// 파일을 바꿔 배포하면 다음 실행부터 반영된다. 즉시 반영하려면 VERSION을 올린다.
const VERSION = 'v31';
const CACHE = `bosses-${VERSION}`;
const SHELL = [
  './',
  'index.html',
  'style.css',
  'config.js',
  'characters.json',
  'manifest.json',
  'js/main.js',
  'js/game.js',
  'js/board.js',
  'js/tween.js',
  'js/fx.js',
  'js/sprites.js',
  'js/effects.js',
  'js/audio.js',
  'js/input.js',
  'js/storage.js',
  'js/faces.js',
  'js/emblems.js',
  'assets/fonts/rye-latin.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bosses-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isNav = req.mode === 'navigate';
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(isNav ? 'index.html' : req, { ignoreSearch: isNav });
      const network = fetch(req)
        .then((res) => {
          // 200만 캐시 (없는 얼굴 이미지 404는 캐시하지 않아 나중에 추가해도 바로 잡힘)
          if (res.ok) cache.put(isNav ? 'index.html' : req, res.clone());
          return res;
        })
        .catch(() => cached || Response.error());
      if (cached) {
        e.waitUntil(network.catch(() => {}));
        return cached;
      }
      return network;
    }),
  );
});
