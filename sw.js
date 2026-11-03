// Network-first for the app's own files, so updates always win when online
// and the shell still opens offline. Cross-origin requests (API, map tiles,
// CDNs) are never intercepted.
importScripts('version.js');

const CACHE = `mio-tracker-${APP_VERSION}`;
const SHELL = [
    './',
    'index.html',
    'app.js',
    'notifications.js',
    'styles.css',
    'consent.js',
    'consent.css',
    'version.js',
    'icon.png',
    'icon-dark.png',
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

// Web Push: the backend sends a payload when a watched bus is about to arrive.
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (err) { /* empty or unreadable payload: show a generic notice */ }

    event.waitUntil(Promise.all([
        self.registration.showNotification(data.title || 'MIO Tracker', {
            body: data.body || 'Tu bus está por llegar.',
            tag: data.tag,
            icon: 'icon-192.png',
            badge: 'icon-192.png',
            data: { stopId: data.stopId }
        }),
        // If the app is open, let it drop the alert from its list.
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
            windows.forEach((client) => client.postMessage({ type: 'alert-fired', alertId: data.alertId }));
        })
    ]));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
            const open = windows[0];
            return open ? open.focus() : self.clients.openWindow('./');
        })
    );
});
