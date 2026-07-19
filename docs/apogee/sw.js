/* APOGEE service worker — cache-first app shell so the game launches offline once installed. */
var CACHE = 'apogee-v1';
var SHELL = [
  './index.html',
  './game.js',
  './vendor/three.bundle.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request).then(function (resp) { var copy = resp.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy).catch(function () {}); }); return resp; }).catch(function () { return caches.match('./index.html'); }); }));
});
