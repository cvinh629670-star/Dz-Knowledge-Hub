const VERSION = 'v11';
const scope = new URL(self.registration.scope);
const PREFIX = 'dz-hub:' + scope.pathname + ':';
const CACHE = PREFIX + VERSION;
const FILES = [
  'index.html', 'manifest.json',
  'css/style.css', 'css/components.css', 'css/themes.css', 'css/responsive.css', 'css/library.css',
  'css/study.css', 'css/skilltree.css',
  'js/app.js', 'js/router.js', 'js/ui.js', 'js/database.js', 'js/gamification.js', 'js/dashboard.js',
  'js/library.js', 'js/pareto.js', 'js/practice.js', 'js/recall.js', 'js/srs.js', 'js/skilltree.js', 'js/braintree.js', 'js/settings.js',
  'data/subjects.json', 'data/lessons.json', 'data/exercises.json', 'data/flashcards.json',
  'data/skills.json', 'data/achievements.json',
  'assets/backgrounds/grimoire.webp', 'assets/characters/traveler.svg',
  'assets/icons/app.svg', 'assets/icons/app-192.png', 'assets/icons/app-512.png',
  'assets/fonts/inter-latin-wght-normal.woff2', 'assets/fonts/inter-latin-ext-wght-normal.woff2',
  'assets/fonts/inter-vietnamese-wght-normal.woff2',
  'assets/fonts/be-vietnam-pro-latin-700-normal.woff2', 'assets/fonts/be-vietnam-pro-latin-ext-700-normal.woff2',
  'assets/fonts/be-vietnam-pro-vietnamese-700-normal.woff2'
];
const urls = new Set(FILES.map(path => new URL(path, scope).href));
const shell = new URL('index.html', scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([...urls].map(url => new Request(url, {cache:'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const home = request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === new URL(shell).pathname);
  const key = home ? shell : url.href;
  if (!urls.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(key)) ?? fetch(request);
  })());
});
