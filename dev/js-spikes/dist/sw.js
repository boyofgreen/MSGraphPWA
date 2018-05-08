var cacheName = 'goat-cache-v3';
var urlsToCache = [
    '/',
    '/index.css',
    '/bundle.js',
    '/manifest.json',
    '/images/goat-notification.png',
    '/images/icons/icon-128x128.png',
    '/images/icons/icon-144x144.png',
    '/images/icons/icon-152x152.png',
    '/images/icons/icon-192x192.png',
    '/images/icons/icon-384x384.png',
    '/images/icons/icon-512x512.png',
    '/images/icons/icon-72x72.png',
    '/images/icons/icon-96x96.png'
];

self.addEventListener('install', function (event) {
    // offline cache
    event.waitUntil(
        caches.open(cacheName)
            .then(function (cache) {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            var staleCaches = cacheNames.filter(name => name !== cacheName);
            console.log('removing stale caches', staleCaches);
            return Promise.all(
                staleCaches.map(name => caches.delete(name)));
        }));
});

self.addEventListener('fetch', function (event) {
    event.respondWith(
        caches.match(event.request)
            .then(function (response) {
                return response || fetch(event.request);
            }));
});