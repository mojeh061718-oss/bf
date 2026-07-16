/* PROVING GROUNDS — service worker.
   Precaches same-directory assets for full offline play.
   Strategy: network-first with cache fallback, so local dev always sees
   fresh files and ?seed=/?c= URLs resolve to the cached shell offline. */
'use strict';

var CACHE_VERSION = 'pg-m2-v1';
var PRECACHE = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './sim.js',
  './audio.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './vendor/three.min.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // the game makes no external requests anyway
  e.respondWith(
    fetch(req).then(function (res) {
      // keep the cache warm with whatever the network just proved fresh
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      // offline: ?seed=ABCDE etc. must still land on the shell
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('./index.html', { ignoreSearch: true });
      });
    })
  );
});
