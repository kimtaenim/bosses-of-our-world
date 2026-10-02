// 서비스 워커: 앱 셸 선캐시 + 네트워크 우선 (오프라인이면 캐시).
// 예전 파일과 새 파일이 섞여 게임이 멈추는 일이 없도록 항상 최신 파일을 먼저 받는다.
// 파일을 바꿔 배포하면 VERSION을 올린다.
const VERSION = 'v92';
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
  'js/items.js',
  'assets/fonts/rye-latin.woff2',
  'icons/icon-192.png',
  'icons/favicon-32.png',
  'icons/favicon-48.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // HTTP 캐시를 거치지 않고 새로 받아서 저장 (옛 파일이 섞여 들어가지 않게)
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
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
  const key = isNav ? 'index.html' : req;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        // 네트워크 우선 (HTTP 캐시도 확인만 하고 바뀌었으면 새로)
        const res = await fetch(req, { cache: 'no-cache' });
        // 200만 캐시 (없는 얼굴 이미지·소리 404는 캐시하지 않음)
        if (res.ok) cache.put(key, res.clone());
        return res;
      } catch (_) {
        const cached = await cache.match(key, { ignoreSearch: isNav });
        return cached || Response.error();
      }
    }),
  );
});
