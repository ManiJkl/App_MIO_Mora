// Network-first for the app's own files, so updates always win when online
// and the shell still opens offline. Cross-origin requests (API, map tiles,
// CDNs) are never intercepted.
importScripts('version.js');

const CACHE = `mio-tracker-${APP_VERSION}`;
const SHELL = [
    './',
    'index.html',
    'app.js',
    'styles.css',
    'consent.js',
    'consent.css',
    'version.js',
    'icon.png',
    'manifest.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            })
            .catch(() => caches.match(request).then((cached) => cached || caches.match('./')))
    );
});
